const crypto = require('crypto');

const logger = require('../../utils/logger.util.js');
const competitionsDb = require('../../database/competitions/competitions-table/competitions.database.js');
const { withCompetitionEvents } = require('./competitionEnrichment.service.js');

// In-process cache of the last getAnnouncedUpcomingCompetitions() result.
// Cleared by invalidateCache() whenever a write changes the store, so repeat
// requests between refreshes don't all re-query the database.
let competitionsCache = null;
const competitionsCacheInstanceId = crypto.randomUUID();
let competitionsCacheRevision = 0;

function invalidateCache() {
  competitionsCache = null;
  competitionsCacheRevision++;
}

// Provides a cheap validator for the public competition list without reading its data.
function getAnnouncedUpcomingCompetitionsRevision() {
  return `${competitionsCacheInstanceId}-${competitionsCacheRevision}`;
}

// Checks that a multi-city competition has the required public location data.
function hasCompletePublicMultiCityData(competition) {
  return (
    !!competition.city?.trim() &&
    !!competition.state &&
    !!competition.venue_address?.trim() &&
    !!competition.venue_details?.trim() &&
    !!competition.venue?.trim() &&
    Number.isFinite(competition.latitude_degrees) &&
    Number.isFinite(competition.longitude_degrees) &&
    competition.competitor_limit != null &&
    competition.competitor_limit >= 1
  );
}

// Public page's announced upcoming list, cached since it's hit on every page load.
async function getAnnouncedUpcomingCompetitions() {
  if (competitionsCache) {
    logger.debug('Served upcoming competitions from cache.');
    return competitionsCache;
  }

  const comps = await competitionsDb.getAnnouncedUpcomingCompetitions();
  const publicCompetitions = comps.filter(
    (competition) =>
      !competition.is_multiple_cities_competition || hasCompletePublicMultiCityData(competition),
  );

  competitionsCache = await withCompetitionEvents(publicCompetitions);
  logger.debug(
    `Fetched ${competitionsCache.length} upcoming competition(s) from the competitions table.`,
  );
  return competitionsCache;
}

module.exports = {
  invalidateCache,
  getAnnouncedUpcomingCompetitionsRevision,
  getAnnouncedUpcomingCompetitions,
};
