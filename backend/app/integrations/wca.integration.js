const axios = require('axios');

// Logger
const logger = require('../utils/logger.util.js');

// Number of competitions requested per page from the WCA competitions list
// endpoint - exported so callers can detect a short (final) page.
const US_COMPETITIONS_PAGE_SIZE = 1000;

// Fetches one page of WCA competitions filtered to country_iso2=US and
// starting on/after `startDate` (a 'YYYY-MM-DD' string), validating the
// response shape so the rest of the app can trust it's always an array.
async function fetchUSCompetitionsPage({ page, startDate }) {
  const url =
    'https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=' +
    US_COMPETITIONS_PAGE_SIZE +
    '&page=' +
    page +
    '&start=' +
    startDate;
  try {
    const res = await axios.get(url);

    if (!Array.isArray(res.data)) {
      throw new Error('Unexpected WCA competitions response shape');
    }

    logger.debug(`WCA competitions page fetch succeeded (${res.data.length} results): ${url}`);
    return res.data;
  } catch (err) {
    logger.error(`WCA competitions page fetch failed: ${url} - `, err);
    throw err;
  }
}

// Looks up a single competition directly by id. Set `suppressNotFoundLogging`
// when a 404 is an expected, routine outcome for the caller (e.g. probing for
// a not-yet-announced future competition) - logs at debug instead of error in
// that case
async function fetchCompetitionById(competitionId, { suppressNotFoundLogging = false } = {}) {
  const url = `https://www.worldcubeassociation.org/api/v0/competitions/${competitionId}`;
  try {
    const res = await axios.get(url);
    logger.debug(`WCA competition lookup succeeded: ${url}`);
    return res.data;
  } catch (err) {
    if (suppressNotFoundLogging && err.response?.status === 404) {
      logger.debug(`WCA competition lookup returned 404: ${url}`);
    } else {
      logger.error(`WCA competition lookup failed: ${url} - `, err);
    }
    throw err;
  }
}

// Fetches the number of accepted registrations for a competition.
async function fetchCompetitionRegistrationsCount(competitionId) {
  const url = `https://www.worldcubeassociation.org/api/v0/competitions/${competitionId}/registrations`;
  try {
    const res = await axios.get(url);
    logger.debug(`WCA registrations count fetch succeeded: ${url}`);
    return res.data.length;
  } catch (err) {
    logger.error(`WCA registrations count fetch failed: ${url} - `, err);
    throw err;
  }
}

module.exports = {
  US_COMPETITIONS_PAGE_SIZE,
  fetchUSCompetitionsPage,
  fetchCompetitionById,
  fetchCompetitionRegistrationsCount,
};
