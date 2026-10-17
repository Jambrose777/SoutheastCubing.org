const moment = require('moment');

const logger = require('../utils/logger.util.js');
const wca = require('../integrations/wca.integration.js');
const authService = require('./auth.service.js');
const competitionPlannerDb = require('../database/competitions/competitions-table/competitionPlanner.database.js');
const competitionBannerDismissalsDb = require('../database/competitions/competitionBannerDismissals.database.js');
const discordPingPatternsDb = require('../database/competitions/discordPingPatterns.database.js');
const majorChampionships = require('./majorChampionships.service.js');
const { isEligibleManagedCompetition } = require('../helpers/competitions/competitionEligibility.helper.js');
const {
  getStateFromCity,
  getTrackedSEState,
  isMultipleCitiesWcaCompetition,
} = require('../helpers/competitions/states.helper.js');

// Matches the Planner's upcoming window, including its one-day timezone grace period.
function isUpcomingCompetition(comp) {
  const endDate = moment(comp.end_date, 'YYYY-MM-DD', true);
  return endDate.isValid() && !endDate.isBefore(moment().subtract(1, 'day'), 'day');
}

// Reads every page of the current Delegate's managed US competitions.
async function fetchManagedWcaCompetitions(
  accessToken,
  peopleId,
  {
    startDate = moment().subtract(1, 'day').format('YYYY-MM-DD'),
    isEligible = isEligibleManagedCompetition,
  } = {},
) {
  let competitions = [];

  for (let page = 1; page <= wca.WCA_MAX_PAGES; page++) {
    let pageData;
    try {
      pageData = await wca.fetchManagedCompetitionsPage({ page, startDate, accessToken });
    } catch (err) {
      if (err.wcaAuthorizationFailure === wca.WCA_MANAGED_COMPETITIONS_UNAUTHORIZED_CODE) {
        await authService.invalidateManageCompetitionsGrant(peopleId, 'managed_competitions_401');
        throw authService.createManageCompetitionsReauthRequiredError();
      }
      throw err;
    }
    competitions = competitions.concat(pageData);

    if (pageData.length < wca.US_COMPETITIONS_PAGE_SIZE) break;
    if (page === wca.WCA_MAX_PAGES) {
      logger.warn(
        `Hit the WCA managed competitions pagination cap of ${wca.WCA_MAX_PAGES} pages - some competitions may be missing.`,
      );
    }
  }

  return competitions.filter(isEligible);
}

// Lists eligible managed competitions and formats any matching major locations.
async function getEligibleUnlinkedManagedCompetitions(
  accessToken,
  peopleId,
  { includeLinkedMultiCity = true } = {},
) {
  // Fetch dependencies for compiling managed competitions.
  const [managedCompetitions, plannerCompetitions, patterns] = await Promise.all([
    fetchManagedWcaCompetitions(accessToken, peopleId, { isEligible: isUpcomingCompetition }),
    competitionPlannerDb.getCompetitionsForPlanner('upcoming'),
    discordPingPatternsDb.getPatterns(),
  ]);

  // Create references for Major Championships.
  const detectedMajors = majorChampionships.detectMajorChampionships(managedCompetitions, patterns);
  const preparedMajors = await majorChampionships.prepareMajorCompetitionsForFormatting(
    detectedMajors,
    new Set(detectedMajors.map((competition) => String(competition.id))),
  );
  const preparedMajorByWcaId = new Map(
    preparedMajors.competitions.map((competition) => [String(competition.id), competition]),
  );
  const majorWcaIds = new Set(preparedMajorByWcaId.keys());

  // Already linked competitions.
  const linkedWcaIds = new Set(
    plannerCompetitions
      .map((competition) => competition.wca_competition_id)
      .filter(Boolean)
      .map(String),
  );

  // Create a set of managed competitions w/ majors overwritten.
  const competitionsByWcaId = new Map(
    managedCompetitions.map((competition) => [String(competition.id), competition]),
  );
  for (const [wcaCompetitionId, competition] of preparedMajorByWcaId) {
    competitionsByWcaId.set(wcaCompetitionId, competition);
  }

  return [...competitionsByWcaId.values()]
    .filter((competition) => isEligibleManagedCompetition(competition, majorWcaIds))
    .filter(
      (competition) =>
        (includeLinkedMultiCity && isMultipleCitiesWcaCompetition(competition)) ||
        !linkedWcaIds.has(String(competition.id)),
    )
    .map((competition) => {
      const wcaCompetitionId = String(competition.id);
      const major = preparedMajorByWcaId.get(wcaCompetitionId);
      return {
        wca_competition_id: wcaCompetitionId,
        name: competition.name,
        url: competition.url,
        website: competition.website,
        city: major?.city ?? competition.city,
        state:
          preparedMajors.stateByWcaId.get(wcaCompetitionId) ??
          (major ? getStateFromCity(major.city) : getTrackedSEState(competition.city)),
        start_date: competition.start_date,
        end_date: competition.end_date,
        event_ids: competition.event_ids ?? [],
        delegates: (competition.delegates ?? []).map((person) => ({
          name: person.name,
          wcaId: person.wca_id ?? null,
        })),
        organizers: (competition.organizers ?? []).map((person) => person.name),
        is_multiple_cities_competition: isMultipleCitiesWcaCompetition(competition),
        is_major: Boolean(major),
      };
    });
}

// Supplies upcoming managed competitions and detected majors for banners.
async function getUnannouncedCompetitionBanners(peopleId) {
  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) return [];

  const [competitions, dismissedIds] = await Promise.all([
    getEligibleUnlinkedManagedCompetitions(accessToken, peopleId, {
      includeLinkedMultiCity: false,
    }),
    competitionBannerDismissalsDb.listDismissedWcaCompetitionIds(peopleId),
  ]);
  const dismissedIdSet = new Set(dismissedIds.map(String));
  return competitions.filter((comp) => !dismissedIdSet.has(comp.wca_competition_id));
}

// Supplies every eligible unlinked managed competition for the standalone sheet.
async function getUnannouncedCompetitionLinkOptions(peopleId) {
  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) return [];
  return getEligibleUnlinkedManagedCompetitions(accessToken, peopleId);
}

// Permanently hides one WCA competition banner for this Delegate.
async function dismissUnannouncedCompetition(peopleId, wcaCompetitionId) {
  await competitionBannerDismissalsDb.createDismissal(peopleId, wcaCompetitionId);
}

module.exports = {
  isUpcomingCompetition,
  fetchManagedWcaCompetitions,
  getEligibleUnlinkedManagedCompetitions,
  getUnannouncedCompetitionBanners,
  getUnannouncedCompetitionLinkOptions,
  dismissUnannouncedCompetition,
};
