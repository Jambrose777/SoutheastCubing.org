const axios = require('axios');

// Number of competitions requested per page from the WCA competitions list
// endpoint - exported so callers can detect a short (final) page.
const US_COMPETITIONS_PAGE_SIZE = 1000;

// Fetches one page of WCA competitions filtered to country_iso2=US and
// starting on/after `startDate` (a 'YYYY-MM-DD' string), validating the
// response shape so the rest of the app can trust it's always an array.
async function fetchUSCompetitionsPage({ page, startDate }) {
  const res = await axios.get(
    'https://www.worldcubeassociation.org/api/v0/competitions?country_iso2=US&per_page=' +
      US_COMPETITIONS_PAGE_SIZE +
      '&page=' +
      page +
      '&start=' +
      startDate,
  );

  if (!Array.isArray(res.data)) {
    throw new Error('Unexpected WCA competitions response shape');
  }

  return res.data;
}

// Looks up a single competition directly by id.
async function fetchCompetitionById(competitionId) {
  const res = await axios.get(
    `https://www.worldcubeassociation.org/api/v0/competitions/${competitionId}`,
  );
  return res.data;
}

// Fetches the number of accepted registrations for a competition.
async function fetchCompetitionRegistrationsCount(competitionId) {
  const res = await axios.get(
    `https://www.worldcubeassociation.org/api/v0/competitions/${competitionId}/registrations`,
  );
  return res.data.length;
}

module.exports = {
  US_COMPETITIONS_PAGE_SIZE,
  fetchUSCompetitionsPage,
  fetchCompetitionById,
  fetchCompetitionRegistrationsCount,
};
