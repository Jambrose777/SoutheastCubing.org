const moment = require('moment');

const logger = require('../../utils/logger.util.js');
const wca = require('../../integrations/wca.integration.js');
const googleForm = require('../../integrations/googleForm.integration.js');
const discord = require('../../integrations/discord.integration.js');
const authService = require('../auth.service.js');
const competitionsDb = require('../../database/competitions/competitions-table/competitions.database.js');
const competitionPlannerDb = require('../../database/competitions/competitions-table/competitionPlanner.database.js');
const competitionsMetaDb = require('../../database/competitions/competitionsMeta.database.js');
const competitionRemindersDb = require('../../database/competitions/competitions-table/competitionReminders.database.js');
const competitionEventsDb = require('../../database/competitions/competitionEvents.database.js');
const competitionDelegatesDb = require('../../database/competitions/competitionDelegates.database.js');
const competitionOrganizersDb = require('../../database/competitions/competitionOrganizers.database.js');
const discordPingPatternsDb = require('../../database/competitions/discordPingPatterns.database.js');
const majorChampionships = require('./majorChampionships.service.js');
const { chunk } = require('../../helpers/chunk.helper.js');
const { groupBy } = require('../../helpers/groupBy.helper.js');
const { httpError } = require('../../helpers/httpError.helper.js');
const { withCompetitionEvents } = require('./competitionEnrichment.service.js');
const { formatCompetitionData } = require('../../helpers/competitions/competitionWcaData.helper.js');
const {
  filterCompetitionsToTrackedSEStates,
  isInSEState,
} = require('../../helpers/competitions/states.helper.js');
const { invalidateCache } = require('./competitionPublicList.service.js');
const { syncDelegatesAndOrganizers } = require('./competitionPlannerLinking.service.js');
const { fetchRegistrationDataByWcaId } = require('./competitionRegistrations.service.js');
const {
  fetchManagedWcaCompetitions,
  isUpcomingCompetition,
} = require('./competitionManagedCompetitions.service.js');
const { syncAllWcaDriveFoldersBestEffort } = require('./competitionWcaDrive.service.js');
const { refreshUpcomingMultiCityCompetitions } = require('./competitionMultiCity.service.js');

// Max rows upserted per statement, to keep each one well under DSQL's
// 3,000-row transaction cap as the retained history keeps growing.
const UPSERT_CHUNK_SIZE = 500;
const BULK_REFRESH_COOLDOWN_MINUTES = 5;

// Upserts `comps` in chunks under DSQL's row cap, returning the ids newly
// inserted across every chunk. On first-time population, announced rows are
// stamped as posted to avoid a Discord backlog; unannounced rows stay pending.
// Returns linked competitions whose folder names may need updating.
async function upsertCompetitions(comps, isFirstPopulation) {
  if (!comps.length) {
    return { insertedIds: [], wcaDriveFolderNameChangedIds: [] };
  }

  try {
    const wasEmpty = isFirstPopulation ?? (await competitionsDb.getCompetitionsCount()) === 0;

    let insertedIds = [];
    let allBatchWithIds = [];
    let wcaDriveFolderNameChangedIds = [];
    for (const batch of chunk(comps, UPSERT_CHUNK_SIZE)) {
      const result = await competitionsDb.upsertCompetitionsBatch(batch);
      insertedIds = insertedIds.concat(result.insertedIds);
      allBatchWithIds = allBatchWithIds.concat(result.batchWithIds);
      wcaDriveFolderNameChangedIds = wcaDriveFolderNameChangedIds.concat(
        result.wcaDriveFolderNameChangedIds,
      );
    }

    await competitionEventsDb.replaceEventIds(
      allBatchWithIds.map(({ id, comp }) => ({ id, event_ids: comp.event_ids })),
    );

    // Delegate/organizer sync - Existing delegates (for carrying forward any
    // manual lead pick) are fetched.
    const linkedBatchWithIds = allBatchWithIds.filter(({ comp }) => comp.wca_competition_id);
    const existingDelegateRowsByCompetition = groupBy(
      await competitionDelegatesDb.listForCompetitions(linkedBatchWithIds.map(({ id }) => id)),
      'competition_id',
    );
    for (const { id, comp } of linkedBatchWithIds) {
      const existingIsLeadByPeopleId = new Map(
        (existingDelegateRowsByCompetition.get(id) ?? []).map((row) => [
          row.people_id,
          row.is_lead,
        ]),
      );
      await syncDelegatesAndOrganizers({
        id,
        delegates: comp.delegates,
        organizers: comp.organizers,
        existingIsLeadByPeopleId,
      });
    }

    invalidateCache();

    if (wasEmpty) {
      const insertedIdSet = new Set(insertedIds);
      const announcedInsertedIds = allBatchWithIds
        .filter(({ id, comp }) => insertedIdSet.has(id) && comp.is_announced)
        .map(({ id }) => id);
      if (announcedInsertedIds.length) {
        await competitionsDb.markAnnounced(announcedInsertedIds);
      }
      logger.debug(
        `Upserted ${comps.length} competitions in the competitions table (first-time population).`,
      );
      return { insertedIds, wcaDriveFolderNameChangedIds: [] };
    }

    logger.debug(
      `Upserted ${comps.length} competitions in the competitions table (${insertedIds.length} newly inserted).`,
    );
    return { insertedIds, wcaDriveFolderNameChangedIds };
  } catch (err) {
    logger.error(`Failed to upsert ${comps.length} competitions in the competitions table: `, err);
    throw err;
  }
}

// Links a detected major to a manual row only when exactly one candidate matches.
async function linkDetectedMajorsToUniqueManualRows(competitions, plannerCompetitions) {
  const linkedWcaCompetitionIds = new Set(
    plannerCompetitions
      .map((competition) => competition.wca_competition_id)
      .filter(Boolean)
      .map(String),
  );

  for (const competition of competitions) {
    const wcaCompetitionId = String(competition.wca_competition_id);
    if (linkedWcaCompetitionIds.has(wcaCompetitionId)) continue;

    const candidates = plannerCompetitions.filter(
      (plannerCompetition) =>
        plannerCompetition.is_major &&
        !plannerCompetition.wca_competition_id &&
        plannerCompetition.start_date === competition.start_date &&
        plannerCompetition.end_date === competition.end_date,
    );
    const matches = majorChampionships.findMatchingManualMajorCompetitions(
      competition.city,
      candidates,
    );
    if (matches.length !== 1) continue;

    const manualCompetition = matches[0];
    const existingDelegateRows = await competitionDelegatesDb.listForCompetitions([
      manualCompetition.id,
    ]);
    const existingIsLeadByPeopleId = new Map(
      existingDelegateRows.map((row) => [row.people_id, row.is_lead]),
    );
    const linked = await competitionPlannerDb.linkPlannerCompetitionToWca(
      manualCompetition.id,
      competition,
    );
    if (!linked) continue;

    await competitionEventsDb.replaceEventIds([
      { id: manualCompetition.id, event_ids: competition.event_ids ?? [] },
    ]);
    await syncDelegatesAndOrganizers({
      id: manualCompetition.id,
      delegates: competition.delegates,
      organizers: competition.organizers,
      existingIsLeadByPeopleId,
    });
  }
}

// Refetches competitions from WCA if the stored data is stale.
async function fetchCompetitions() {
  const lastBulkRefreshAt = await competitionsMetaDb.getLastBulkRefreshAt();

  if (
    !lastBulkRefreshAt ||
    lastBulkRefreshAt.isBefore(moment().set('hour', 0).set('minute', 0).set('second', 0))
  ) {
    logger.info('Stored competitions data is stale - fetching from WCA.');
    await runCoordinatedCompetitionRefresh();
    logger.info('Successfully fetched competitions from WCA.');
  } else {
    logger.info('Stored competitions data is already fresh - skipping fetch.');
  }
}

// Posts every competition in `competitions` to Discord (chunked/rate-limit-safe
// - see discord.js's postToDiscordInChunks). A competition whose wca_competition_id
// matches any stored pattern gets an @everyone ping instead of its state's
// role ping. Only ids whose post succeeds are marked announced - anything
// still failing after discord.js's retries is left unannounced so it's
// retried on the next refresh.
async function postCompetitionsToDiscord(competitions) {
  return discord.postToDiscordInChunks(sortForDiscordPosting(competitions), {
    postFn: (competition) =>
      discord.postCompetitionInDiscord(
        { ...competition, id: competition.wca_competition_id },
        {
          pingOverride: competition.is_major ? 'everyone' : undefined,
        },
      ),
    markAnnouncedFn: (ids) => competitionsDb.markAnnounced(ids),
    getId: (competition) => competition.id,
  });
}

// Orders competitions for a Discord posting run: grouped by state first, then
// by start_date ascending, then alphabetically by name.
function sortForDiscordPosting(competitions) {
  const stateOrder = Object.keys(discord.stateTagIds);
  return [...competitions].sort((a, b) => {
    const stateDiff = stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state);
    if (stateDiff !== 0) {
      return stateDiff;
    }
    const dateDiff = moment(a.start_date).diff(moment(b.start_date));
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return a.name.localeCompare(b.name);
  });
}

// Claims the global refresh slot and records only successful full refreshes.
async function runCoordinatedCompetitionRefresh(actor) {
  const cooldownCutoff = moment().subtract(BULK_REFRESH_COOLDOWN_MINUTES, 'minutes');
  const refreshState = await competitionsMetaDb.tryStartBulkRefresh(cooldownCutoff.toDate());

  if (!refreshState.started) {
    const reason = refreshState.isRunning
      ? 'A competition refresh is already in progress.'
      : 'Competitions were refreshed less than 5 minutes ago.';
    const error = httpError(409, reason);
    error.refreshState = refreshState;
    throw error;
  }

  try {
    const result = await refreshCompetitionsFromWCA(actor);
    if (result.competitions.length) {
      await competitionsMetaDb.completeBulkRefresh(moment(), refreshState.bulkRefreshStartedAt);
    } else {
      await competitionsMetaDb.releaseBulkRefresh(refreshState.bulkRefreshStartedAt);
    }
    return result;
  } catch (err) {
    await competitionsMetaDb.releaseBulkRefresh(refreshState.bulkRefreshStartedAt);
    throw err;
  }
}

// Fetches and persists the full competition list from WCA and supporting sources.
async function refreshCompetitionsFromWCA(actor) {
  // WCA paginates at per_page results; loop through successive pages
  // (stopping once a page returns fewer than per_page results, the
  // standard "last page" signal) so a true count over 1000 doesn't
  // silently drop competitions. Capped at WCA_MAX_PAGES (20,000 competitions)
  // as a guard against an unexpected API change causing an infinite loop.
  let wcaCompetitions = [];
  for (let page = 1; page <= wca.WCA_MAX_PAGES; page++) {
    const pageData = await wca.fetchUSCompetitionsPage({
      page,
      startDate: moment().add(-1, 'day').format('YYYY-MM-DD'),
    });

    wcaCompetitions = wcaCompetitions.concat(pageData);

    if (pageData.length < wca.US_COMPETITIONS_PAGE_SIZE) {
      // Short page means there's nothing more to fetch.
      break;
    }

    if (page === wca.WCA_MAX_PAGES) {
      logger.warn(
        `Hit the WCA competitions pagination cap of ${wca.WCA_MAX_PAGES} pages - some competitions may be missing.`,
      );
    }
  }

  const publicWcaCompetitionIds = new Set(
    wcaCompetitions.map((competition) => String(competition.id)),
  );
  const plannerCompetitions = await competitionPlannerDb.getCompetitionsForPlanner('upcoming');

  // Get managed competitions and registration-admin access for assigned organizers/delegates.
  let managedOnlyCompetitions = [];
  const peopleId = actor?.peopleId;
  let accessToken;
  let privateDataRefreshFailed = false;
  let adminRegistrationCompetitionIds = new Set();
  if (peopleId) {
    const plannerCompetitionIds = plannerCompetitions.map((competition) => competition.id);
    const [delegateRows, organizerRows] = await Promise.all([
      competitionDelegatesDb.listForCompetitions(plannerCompetitionIds),
      competitionOrganizersDb.listForCompetitions(plannerCompetitionIds),
    ]);
    const assignedPlannerCompetitionIds = new Set(
      [...delegateRows, ...organizerRows]
        .filter((row) => String(row.people_id) === String(peopleId))
        .map((row) => String(row.competition_id)),
    );
    const assignedPlannerCompetitions = plannerCompetitions.filter((competition) =>
      assignedPlannerCompetitionIds.has(String(competition.id)),
    );
    adminRegistrationCompetitionIds = new Set(
      assignedPlannerCompetitions
        .filter(
          (competition) =>
            competition.wca_competition_id &&
            !moment.utc(competition.registration_open).isAfter(moment.now()),
        )
        .map((competition) => String(competition.wca_competition_id)),
    );

    // Only fetch unannounced WCA competitions assigned to this caller.
    const managedPlannerCompetitionIds = new Set(
      assignedPlannerCompetitions
        .filter((competition) => !competition.is_announced && competition.wca_competition_id)
        .map((competition) => String(competition.wca_competition_id)),
    );

    // Fetch Access Token
    if (adminRegistrationCompetitionIds.size || managedPlannerCompetitionIds.size) {
      try {
        accessToken = await authService.getValidAccessTokenForPerson(peopleId);
      } catch {
        privateDataRefreshFailed = true;
      }
      if (!accessToken) privateDataRefreshFailed = true;
    }

    if (managedPlannerCompetitionIds.size && accessToken) {
      try {
        const managedCompetitions = await fetchManagedWcaCompetitions(accessToken, peopleId, {
          startDate: moment().subtract(1, 'day').format('YYYY-MM-DD'),
          isEligible: (competition) =>
            isUpcomingCompetition(competition) && isInSEState(competition),
        });
        managedOnlyCompetitions = managedCompetitions.filter(
          (competition) =>
            managedPlannerCompetitionIds.has(String(competition.id)) &&
            !publicWcaCompetitionIds.has(String(competition.id)),
        );
      } catch {
        privateDataRefreshFailed = true;
      }
    }
  }

  const managedOnlyCompetitionIds = new Set(
    managedOnlyCompetitions.map((competition) => String(competition.id)),
  );
  wcaCompetitions = wcaCompetitions.concat(managedOnlyCompetitions);

  // fetch competitions with a volunteer application
  let competitionsWithVolunteerApp = await googleForm.getCompetitionsInVolunteerForm();

  const patterns = await discordPingPatternsDb.getPatterns();
  const detectedMajors = await majorChampionships.getDetectedMajorChampionships(
    wcaCompetitions,
    patterns,
  );
  const majorWcaIds = new Set(detectedMajors.map((competition) => String(competition.id)));
  const competitionByWcaId = new Map();
  [...filterCompetitionsToTrackedSEStates(wcaCompetitions), ...detectedMajors].forEach(
    (competition) => competitionByWcaId.set(String(competition.id), competition),
  );

  // Include every detected major in the same row-based formatting and persistence flow.
  const competitionsToFormat = [...competitionByWcaId.values()];
  const preparedCompetitions = await majorChampionships.prepareMajorCompetitionsForFormatting(
    competitionsToFormat,
    majorWcaIds,
  );
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId(
    preparedCompetitions.competitions,
    {
      accessToken,
      adminCompetitionIds: adminRegistrationCompetitionIds,
    },
  );
  privateDataRefreshFailed ||= [...registrationDataByWcaId.values()].some(
    (registrationData) => registrationData.adminRegistrationFetchFailed,
  );
  const formattedCompetitions = formatCompetitionData(
    preparedCompetitions.competitions,
    competitionsWithVolunteerApp,
    registrationDataByWcaId,
    majorWcaIds,
    preparedCompetitions.stateByWcaId,
  );

  // check if blank database before populating any of it.
  const isFirstPopulation = (await competitionsDb.getCompetitionsCount()) === 0;
  await linkDetectedMajorsToUniqueManualRows(
    formattedCompetitions.filter((competition) => competition.is_major),
    plannerCompetitions,
  );
  const comps = formattedCompetitions;

  // overwrite is_announced of the private managed only competitions
  for (const comp of comps) {
    if (managedOnlyCompetitionIds.has(String(comp.wca_competition_id))) {
      comp.is_announced = false;
    }
  }

  let nameChangedDriveFolderIds = [];
  if (comps && comps.length) {
    logger.debug(`Formatted ${comps.length} competitions for the public list.`);

    // Upsert into the database. upsertCompetitions handles the cold-start
    // case internally (stamping a first-time population as already
    // announced).
    const upsertResult = await upsertCompetitions(comps, isFirstPopulation);
    nameChangedDriveFolderIds = upsertResult.wcaDriveFolderNameChangedIds;

    // Only recorded on a non-empty result - an empty result is more likely a
    // WCA API glitch than a genuine zero-competition period in these states,
    // so it's treated as an unconfirmed check rather than a successful one.
    // This keeps update-competitions' rate limit and fetchCompetitions'
    // staleness check retrying instead of going stale on bad data.
    invalidateCache();
  } else {
    logger.warn('There are no competitions!');
  }

  // Refresh Multiple City Competitions.
  const multiCityRefreshResult = await refreshUpcomingMultiCityCompetitions(
    plannerCompetitions,
    competitionsWithVolunteerApp,
    accessToken,
    adminRegistrationCompetitionIds,
  );
  const multiCityRefreshFailedIds = multiCityRefreshResult.failedWcaCompetitionIds;

  // Posts pending competitions on Discord.
  let discordPostFailures = [];
  if (comps.length || multiCityRefreshResult.updatedWcaCompetitionIds.length) {
    const updatedMultiCityIdSet = new Set(multiCityRefreshResult.updatedWcaCompetitionIds);
    // A regular refresh scans all pending public rows, including multi-city rows; otherwise,
    // limit announcements to multi-city WCA ids refreshed in this run.
    const competitionsPendingDiscordAnnouncement = await withCompetitionEvents(
      (await competitionRemindersDb.getCompetitionsPendingDiscordAnnouncement()).filter((competition) =>
        comps.length
          ? !managedOnlyCompetitionIds.has(String(competition.wca_competition_id))
          : updatedMultiCityIdSet.has(String(competition.wca_competition_id)),
      ),
    );
    if (competitionsPendingDiscordAnnouncement.length) {
      discordPostFailures = await postCompetitionsToDiscord(competitionsPendingDiscordAnnouncement);
    }
  }

  // Sync WCA Drive Folders
  await syncAllWcaDriveFoldersBestEffort(nameChangedDriveFolderIds);

  return {
    competitions: comps,
    discordPostFailures,
    privateDataRefreshFailed,
    multiCityRefreshFailedIds,
  };
}

// Maps WCA records to the competition-row shape used by the database and frontend.
module.exports = {
  upsertCompetitions,
  fetchCompetitions,
  runCoordinatedCompetitionRefresh,
  refreshCompetitionsFromWCA,
};
