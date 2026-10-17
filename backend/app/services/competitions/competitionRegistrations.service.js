const moment = require('moment');

const wca = require('../../integrations/wca.integration.js');

// Fetches registration counts, using the admin endpoint only when the caller has an assigned token.
async function getRegistrationsFromWCA(competition, accessToken) {
  // Before registration opens there can't be any registrants yet - skip the
  // call rather than hitting WCA for a guaranteed 0.
  if (moment.utc(competition.registration_open).isAfter(moment.now())) {
    return {
      acceptedRegistrations: 0,
      waitingListCount: null,
      waitingListCountUpdatedAt: null,
    };
  }

  let adminRegistrationFetchFailed = false;
  if (accessToken) {
    try {
      const registrations = await wca.fetchCompetitionAdminRegistrations(
        String(competition.id),
        accessToken,
      );
      return {
        acceptedRegistrations: registrations.filter(
          (registration) => registration?.competing?.registration_status === 'accepted',
        ).length,
        waitingListCount: registrations.filter(
          (registration) => registration?.competing?.registration_status === 'waiting_list',
        ).length,
        waitingListCountUpdatedAt: new Date(),
      };
    } catch {
      // The integration logs the admin failure; continue with the public accepted count
      // as a fallback.
      adminRegistrationFetchFailed = true;
    }
  }

  let acceptedRegistrations = 0;
  try {
    acceptedRegistrations = await wca.fetchCompetitionRegistrationsCount(competition.id);
  } catch {
    // The integration logs the public failure; preserve the refresh flow with a zero result.
  }
  return {
    acceptedRegistrations,
    waitingListCount: null,
    waitingListCountUpdatedAt: null,
    adminRegistrationFetchFailed,
  };
}

// Fetches counts at the call site so competition formatting remains API-independent.
async function fetchRegistrationDataByWcaId(
  competitions,
  { accessToken, adminCompetitionIds = new Set() } = {},
) {
  const entries = await Promise.all(
    competitions.map(async (competition) => {
      const competitionId = String(competition.id);
      const token = adminCompetitionIds.has(competitionId) ? accessToken : undefined;
      return [competitionId, await getRegistrationsFromWCA(competition, token)];
    }),
  );
  return new Map(entries);
}

module.exports = {
  fetchRegistrationDataByWcaId,
};