const moment = require('moment');

const logger = require('../utils/logger.util.js');

const wca = require('../integrations/wca.integration.js');
const googleForm = require('../integrations/googleForm.integration.js');
const contentful = require('../integrations/contentful.integration.js');
const discord = require('../integrations/discord.integration.js');
const competitionsDb = require('../database/competitions.database.js');
const competitionEventsDb = require('../database/competitionEvents.database.js');
const competitionDelegatesDb = require('../database/competitionDelegates.database.js');
const competitionOrganizersDb = require('../database/competitionOrganizers.database.js');
const peopleDb = require('../database/people.database.js');
const discordPingPatternsDb = require('../database/discordPingPatterns.database.js');
const majorChampionships = require('./majorChampionships.service.js');
const { getFullCompetitionDate } = require('../helpers/competitionDates.helper.js');
const { SOUTHEAST_STATES } = require('../helpers/southeastStates.helper.js');
const { chunk } = require('../helpers/chunk.helper.js');
const { groupBy } = require('../helpers/groupBy.helper.js');
const { withResolvedPicture } = require('../helpers/personPicture.helper.js');

// Max rows upserted per statement, to keep each one well under DSQL's
// 3,000-row transaction cap as the retained history keeps growing.
const UPSERT_CHUNK_SIZE = 500;

// In-process cache of the last getAnnouncedUpcomingCompetitions() result.
// Cleared by invalidateCache() whenever a write changes the store, so repeat
// requests between refreshes don't all re-query the database.
let competitionsCache = null;

function invalidateCache() {
  competitionsCache = null;
}

// Merges each comp's event ids with its data.
async function withEventIds(comps) {
  const eventIdsByCompetition = await competitionEventsDb.getEventIdsByCompetition(
    comps.map((comp) => comp.id),
  );
  return comps.map((comp) => ({
    ...comp,
    event_ids: eventIdsByCompetition.get(comp.id) ?? [],
  }));
}

// Public page's announced-only upcoming list, cached since it's hit on every
// page load.
async function getAnnouncedUpcomingCompetitions() {
  if (competitionsCache) {
    logger.debug('Served upcoming competitions from cache.');
    return competitionsCache;
  }

  const comps = await withEventIds(await competitionsDb.getAnnouncedUpcomingCompetitions());
  competitionsCache = comps;
  logger.debug(`Fetched ${comps.length} upcoming competition(s) from the competitions table.`);
  return competitionsCache;
}

// Derives a competition's Competition Planner status from its raw
// wca_competition_id/is_announced fields.
function derivePlannerStatus(comp) {
  if (!comp.wca_competition_id) return 'potential';
  return comp.is_announced ? 'announced' : 'planning';
}

// Competition Planner's full (every status) upcoming list - never cached.
async function getAllUpcomingCompetitionsForPlanner() {
  const comps = await withEventIds(await competitionsDb.getAllUpcomingCompetitionsForPlanner());
  const competitionIds = comps.map((comp) => comp.id);

  const delegateRowsByCompetition = groupBy(
    await competitionDelegatesDb.listForCompetitions(competitionIds),
    'competition_id',
  );
  const organizerRowsByCompetition = groupBy(
    await competitionOrganizersDb.listForCompetitions(competitionIds),
    'competition_id',
  );

  const toPerson = (row) => {
    const resolved = withResolvedPicture(row);
    return {
      peopleId: resolved.people_id,
      name: resolved.name,
      wcaId: resolved.wca_id,
      pictureUrl: resolved.picture_url,
      thumbnailCropX: resolved.thumbnail_crop_x,
      thumbnailCropY: resolved.thumbnail_crop_y,
      thumbnailCropW: resolved.thumbnail_crop_w,
      thumbnailCropH: resolved.thumbnail_crop_h,
      isLead: resolved.is_lead,
    };
  };

  return comps.map((comp) => ({
    ...comp,
    status: derivePlannerStatus(comp),
    delegates: (delegateRowsByCompetition.get(comp.id) ?? []).map(toPerson),
    organizers: (organizerRowsByCompetition.get(comp.id) ?? []).map(toPerson),
  }));
}

// Resolves a WCA Person sub-resource into a `people` row id.
async function resolvePersonId(wcaPerson) {
  const person = await peopleDb.findOrCreatePersonFromWcaProfile({
    wcaId: wcaPerson.wca_id ?? null,
    wcaUserId: String(wcaPerson.id),
    name: wcaPerson.name,
    pictureUrl: wcaPerson.avatar?.thumb_url ?? null,
  });
  return person.id;
}

// Syncs one competition's delegates/organizers from the already-fetched WCA
// data. WCA's API exposes no lead-delegate signal, `existingIsLeadByPeopleId` 
// carries forward any manual pick for a delegate who's still on the competition.
async function syncDelegatesAndOrganizers({ id, delegates, organizers, existingIsLeadByPeopleId }) {
  const delegatePeopleIds = await Promise.all((delegates ?? []).map(resolvePersonId));
  const organizerPeopleIds = await Promise.all((organizers ?? []).map(resolvePersonId));

  await competitionDelegatesDb.replaceDelegatesForCompetition(
    id,
    delegatePeopleIds.map((peopleId) => ({
      peopleId,
      isLead: existingIsLeadByPeopleId.get(peopleId) ?? false,
    })),
  );
  await competitionOrganizersDb.replaceOrganizersForCompetition(id, organizerPeopleIds);
}

// Upserts `comps` in chunks under DSQL's row cap, returning the ids newly
// inserted across every chunk. If the table was empty before this call, every 
// newly-inserted id is immediately stamped as already-announced, so a 
// first-time-populated store doesn't post its entire backlog to Discord.
async function upsertCompetitions(comps) {
  if (!comps.length) return [];

  try {
    const wasEmpty = (await competitionsDb.getCompetitionsCount()) === 0;

    let insertedIds = [];
    let allBatchWithIds = [];
    for (const batch of chunk(comps, UPSERT_CHUNK_SIZE)) {
      const result = await competitionsDb.upsertCompetitionsBatch(batch);
      insertedIds = insertedIds.concat(result.insertedIds);
      allBatchWithIds = allBatchWithIds.concat(result.batchWithIds);
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
      if (insertedIds.length) {
        await competitionsDb.markAnnounced(insertedIds);
      }
      logger.debug(
        `Upserted ${comps.length} competitions in the competitions table (first-time population).`,
      );
      return [];
    }

    logger.debug(
      `Upserted ${comps.length} competitions in the competitions table (${insertedIds.length} newly inserted).`,
    );
    return insertedIds;
  } catch (err) {
    logger.error(`Failed to upsert ${comps.length} competitions in the competitions table: `, err);
    throw err;
  }
}

// Refetches competitions from WCA if the stored data is stale.
async function fetchCompetitions() {
  const lastChecked = await competitionsDb.getLastChecked();

  if (
    !lastChecked ||
    lastChecked.isBefore(moment().set('hour', 0).set('minute', 0).set('second', 0))
  ) {
    logger.info('Stored competitions data is stale - fetching from WCA.');
    await refreshCompetitionsFromWCA();
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
  const patterns = await discordPingPatternsDb.getPatterns();
  const usesEveryonePing = (wcaCompetitionId) =>
    patterns.some((pattern) =>
      discordPingPatternsDb.matchesIdPattern(wcaCompetitionId, pattern.id_pattern),
    );

  return discord.postToDiscordInChunks(sortForDiscordPosting(competitions), {
    postFn: (competition) =>
      discord.postCompetitionInDiscord(
        { ...competition, id: competition.wca_competition_id },
        {
          pingOverride: usesEveryonePing(competition.wca_competition_id) ? 'everyone' : undefined,
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

// gets full competition list from WCA
async function refreshCompetitionsFromWCA() {
  // WCA paginates at per_page results; loop through successive pages
  // (stopping once a page returns fewer than per_page results, the
  // standard "last page" signal) so a true count over 1000 doesn't
  // silently drop competitions. Capped at maxPages (20,000 competitions)
  // as a guard against an unexpected API change causing an infinite loop.
  const maxPages = 20;
  let wcaCompetitions = [];
  for (let page = 1; page <= maxPages; page++) {
    const pageData = await wca.fetchUSCompetitionsPage({
      page,
      startDate: moment().add(-1, 'day').format('YYYY-MM-DD'),
    });

    wcaCompetitions = wcaCompetitions.concat(pageData);

    if (pageData.length < wca.US_COMPETITIONS_PAGE_SIZE) {
      // Short page means there's nothing more to fetch.
      break;
    }

    if (page === maxPages) {
      logger.warn(
        `Hit the WCA competitions pagination cap of ${maxPages} pages - some competitions may be missing.`,
      );
    }
  }

  // fetch manual competitions from Contentful. Isolated in its own
  // try/catch so a Contentful outage doesn't block the WCA-only data from
  // being formatted and saved below - it just means no manually-added
  // competitions are merged in for this cycle.
  let contentfulEntries;
  try {
    contentfulEntries = await contentful.getContentfulCompetitions();
  } catch {
    contentfulEntries = { items: [] };
  }

  // Guard against a malformed/missing `items` field (a Contentful response
  // shape break).
  if (!Array.isArray(contentfulEntries.items)) {
    logger.warn('Contentful competitions response has no items array, treating as empty.');
    contentfulEntries = { items: [] };
  }

  let contentfulCompetitions = await Promise.all(
    contentfulEntries.items.map(async (contentfulComp) => {
      // Skip entries missing the fields this merge relies on, instead of
      // crashing the whole fetch cycle over one malformed Contentful entry.
      if (!contentfulComp.fields || !contentfulComp.fields.id || !contentfulComp.fields.name) {
        logger.warn(
          `Skipping malformed Contentful competition entry (sys id: ${contentfulComp.sys && contentfulComp.sys.id}) - missing fields.id or fields.name.`,
        );
        return null;
      }

      // fetch info on contentful competition from WCA
      const wcaCompetition = await getWCACompetition(wcaCompetitions, contentfulComp.fields.id);

      // Drop this manual competition entirely if its WCA lookup failed
      if (!wcaCompetition) {
        logger.warn(
          `Dropping manual competition "${contentfulComp.fields.name}" (${contentfulComp.fields.id}) - WCA lookup failed.`,
        );
        return null;
      }

      logger.debug(
        `Merged manual competition "${contentfulComp.fields.name}" (${contentfulComp.fields.id}) from Contentful.`,
      );

      return {
        ...wcaCompetition,
        name: contentfulComp.fields.name,
        city: contentfulComp.fields.city,
        venue_address: contentfulComp.fields.venueAddress,
        venue_details: contentfulComp.fields.venueDetails,
        latitude_degrees: contentfulComp.fields.latitudeDegrees,
        longitude_degrees: contentfulComp.fields.longitudeDegrees,
        country_iso2: contentfulComp.fields.countryIso2,
        competitor_limit: contentfulComp.fields.competitorLimit,
      };
    }),
  );

  // Filter out competitions whose WCA lookup failed, then past competitions
  contentfulCompetitions = contentfulCompetitions
    .filter((comp) => comp)
    .filter((comp) => moment(comp.end_date).isAfter(moment().add(-1, 'day')));

  // fetch competitions with a volunteer application
  let competitionsWithVolunteerApp = await googleForm.getCompetitionsInVolunteerForm();

  const patterns = await discordPingPatternsDb.getPatterns();
  const matchesDiscordPingPattern = (competitionId) =>
    patterns.some((pattern) =>
      discordPingPatternsDb.matchesIdPattern(competitionId, pattern.id_pattern),
    );

  // Nats/NAC/Worlds are usually held outside the tracked SE states, so
  // they're normally Discord-only and tracked separately rather than ever reaching the public
  // competitions page. But any of them CAN land in an SE state - when that happens it should
  // still show up on the public page like any other SE competition, just
  // with an @everyone ping instead of its state's role ping.
  const seHostedPatternMatchIds = new Set(
    wcaCompetitions
      .filter((comp) => matchesDiscordPingPattern(comp.id) && isInSEState(comp))
      .map((comp) => comp.id),
  );
  const majorChampionshipDiscordFailures = await majorChampionships.refreshMajorChampionships(
    wcaCompetitions,
    patterns,
    seHostedPatternMatchIds,
  );

  // format competition data
  let comps = await formatCompetitionData(
    wcaCompetitions.concat(contentfulCompetitions),
    competitionsWithVolunteerApp,
  );

  let discordPostFailures = [...majorChampionshipDiscordFailures];
  if (comps && comps.length) {
    logger.debug(`Formatted ${comps.length} competitions for the public list.`);

    // Upsert into the database. upsertCompetitions handles the cold-start
    // case internally (stamping a first-time population as already
    // announced).
    await upsertCompetitions(comps);

    const unannouncedCompetitions = await withEventIds(
      await competitionsDb.getUnannouncedCompetitions(),
    );
    if (unannouncedCompetitions.length) {
      discordPostFailures = discordPostFailures.concat(
        await postCompetitionsToDiscord(unannouncedCompetitions),
      );
    }

    // Only recorded on a non-empty result - an empty result is more likely a
    // WCA API glitch than a genuine zero-competition period in these states,
    // so it's treated as an unconfirmed check rather than a successful one.
    // This keeps update-competitions' rate limit and fetchCompetitions'
    // staleness check retrying instead of going stale on bad data.
    await competitionsDb.setLastChecked(moment());
    invalidateCache();
  } else {
    logger.warn('There are no competitions!');
  }

  return { competitions: comps, discordPostFailures };
}

// Filters `comps` down to competitions in the tracked SE states and maps
// each one to the trimmed/enriched object shape used by the database layer
// and frontend
async function formatCompetitionData(comps, competitionsWithVolunteerApp) {
  return await Promise.all(
    comps
      // Filter to only SE comp Dates.
      .filter((comp) => {
        // Guard for a missing city first - a competition without one can't
        // match any SE state.
        if (!comp.city) {
          logger.warn(
            `Skipping competition ${comp.id || '(no id)'} "${comp.name || '(no name)'}" - missing city.`,
          );
          return false;
        }
        return isInSEState(comp);
      })

      //  Sort by date
      .sort((a, b) => (moment(a.start_date).isBefore(b.start_date) ? -1 : 1))

      // Create extra fields for competititon data & strip out unnecessary data
      .map(async (competition) => ({
        url: competition.url,
        wca_competition_id: competition.id,
        name: competition.name,
        website: competition.website,
        city: competition.city,
        venue_address: competition.venue_address,
        venue_details: competition.venue_details,
        latitude_degrees: competition.latitude_degrees,
        longitude_degrees: competition.longitude_degrees,
        country_iso2: competition.country_iso2,
        start_date: competition.start_date,
        registration_open: competition.registration_open,
        registration_close: competition.registration_close,
        end_date: competition.end_date,
        competitor_limit: competition.competitor_limit,
        event_ids: competition.event_ids,
        delegates: competition.delegates,
        organizers: competition.organizers,
        venue: getCompetitionVenueName(competition.venue),
        venue_url: getCompetitionVenueUrl(competition.venue),
        state: getStateFromCity(competition.city),
        is_in_volunteer_application: competitionsWithVolunteerApp.includes(competition.name),
        accepted_registrations: await getRegistrationsFromWCA(competition),
        full_date: getFullCompetitionDate(competition.start_date, competition.end_date),
        // Every competition reaching this point came from WCA's own public list.
        is_announced: true,
      })),
  );
}

// gets registration data & returns how many registered competitors there are for a competition.
function getRegistrationsFromWCA(competition) {
  // Before registration opens there can't be any registrants yet - skip the
  // call rather than hitting WCA for a guaranteed 0.
  if (moment.utc(competition.registration_open).isAfter(moment.now())) {
    return Promise.resolve(0);
  } else {
    // fetch registrations from WCA
    return wca.fetchCompetitionRegistrationsCount(competition.id).catch(() => {
      // Don't let one competition's failed lookup break the whole fetch cycle -
      // treat it as having 0 registrations rather than propagating undefined.
      return 0;
    });
  }
}

// Fetches a single competition's information
function getWCACompetition(competitions, competitionId) {
  // chcek if competition is already in the list of fetched competitions
  let wcaCompetition = competitions.find((wcaCompetition) => wcaCompetition.id === competitionId);
  if (wcaCompetition) {
    return Promise.resolve(wcaCompetition);
  } else {
    // fetch competition from WCA - wca.integration.js already logs the failure
    return wca.fetchCompetitionById(competitionId).catch(() => {
      // Signal failure explicitly so callers can drop this competition instead of
      // spreading undefined fields into a broken/incomplete record.
      return null;
    });
  }
}

// Matches a `[name](url)` markdown-style venue link. Greedy captures so an unbalanced
// `)`/`]` inside the name or URL doesn't truncate the match early - this finds the
// *last* `)`/`]` in the string rather than the first.
const VENUE_LINK_PATTERN = /\[(.+)\]\((.+)\)/;

// If Venue includes a hyperlink in markdown format, then strip "text" out of it. ie. [text](url)
// If not, then return Venue name as is
function getCompetitionVenueName(venue) {
  const match = venue && venue.match(VENUE_LINK_PATTERN);
  return match ? match[1] : venue;
}

// If Venue includes a hyperlink in markdown format, then strip "url" out of it. ie. [text](url)
// If not, then return nothing
function getCompetitionVenueUrl(venue) {
  const match = venue && venue.match(VENUE_LINK_PATTERN);
  return match ? match[2] : undefined;
}

// Returns the trimmed segment after the last comma in a WCA/Contentful city string
// (e.g. "Atlanta, Georgia" -> "Georgia")
function getStateFromCity(city) {
  if (!city) {
    return undefined;
  }
  return city.substring(city.lastIndexOf(',') + 1).trim();
}

// Returns the canonical Title-Case tracked-state name if `city`'s parsed state
// matches one of TRACKED_SE_STATES case-insensitively, or undefined otherwise.
function getTrackedSEState(city) {
  const state = getStateFromCity(city);
  return state && SOUTHEAST_STATES.find((tracked) => tracked.toLowerCase() === state.toLowerCase());
}

// True if `comp`'s city is in one of the 6 states SECI tracks.
function isInSEState(comp) {
  return !!getTrackedSEState(comp.city);
}

module.exports = {
  fetchCompetitions,
  refreshCompetitionsFromWCA,
  getAnnouncedUpcomingCompetitions,
  getAllUpcomingCompetitionsForPlanner,
};
