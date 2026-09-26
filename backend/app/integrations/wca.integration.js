const axios = require('axios');

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

// Exchanges a Doorkeeper authorization code for an access token, using the
// standard OAuth2 authorization-code grant. The returned token is only ever
// used once (immediately below, for fetchWcaProfile) and then discarded -
// nothing from a sign-in grant is persisted or refreshed.
async function exchangeAuthorizationCodeForToken({ code, clientId, clientSecret, redirectUri }) {
  const url = 'https://www.worldcubeassociation.org/oauth/token';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  try {
    const res = await axios.post(url, body);
    logger.debug('WCA OAuth token exchange succeeded.');
    return res.data.access_token;
  } catch (err) {
    logger.error('WCA OAuth token exchange failed: ', err);
    throw err;
  }
}

// Calls GET /api/v0/me to read the profile fields. Called exactly once per sign-in.
async function fetchWcaProfile(accessToken) {
  const url = 'https://www.worldcubeassociation.org/api/v0/me';
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    logger.debug('WCA profile fetch (GET /api/v0/me) succeeded.');
    return res.data.me;
  } catch (err) {
    logger.error('WCA profile fetch (GET /api/v0/me) failed: ', err);
    throw err;
  }
}

// Looks up a person on WCA directly by WCA ID.
async function fetchPersonByWcaId(wcaId) {
  const url = `https://www.worldcubeassociation.org/api/v0/search/users?q=${encodeURIComponent(wcaId)}&persons_table=true`;
  try {
    const res = await axios.get(url);
    const person = res.data.result?.find((candidate) => candidate.wca_id === wcaId) ?? null;
    logger.debug(`WCA person lookup ${person ? 'succeeded' : 'found no match'}: ${url}`);
    return person;
  } catch (err) {
    logger.error(`WCA person lookup failed: ${url} - `, err);
    throw err;
  }
}

// Downloads the raw bytes of a WCA avatar image at `avatarUrl`. Returns a Buffer.
async function fetchAvatarImage(avatarUrl) {
  try {
    const res = await axios.get(avatarUrl, { responseType: 'arraybuffer' });
    logger.debug(`WCA avatar image download succeeded: ${avatarUrl}`);
    return Buffer.from(res.data);
  } catch (err) {
    logger.error(`WCA avatar image download failed: ${avatarUrl} - `, err);
    throw err;
  }
}

module.exports = {
  US_COMPETITIONS_PAGE_SIZE,
  fetchUSCompetitionsPage,
  fetchCompetitionById,
  fetchCompetitionRegistrationsCount,
  exchangeAuthorizationCodeForToken,
  fetchWcaProfile,
  fetchPersonByWcaId,
  fetchAvatarImage,
};
