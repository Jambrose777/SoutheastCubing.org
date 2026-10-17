const wca = require('../../integrations/wca.integration.js');
const authService = require('../auth.service.js');
const competitionsDb = require('../../database/competitions/competitions-table/competitions.database.js');
const competitionDelegatesDb = require('../../database/competitions/competitionDelegates.database.js');
const competitionOrganizersDb = require('../../database/competitions/competitionOrganizers.database.js');
const majorChampionships = require('./majorChampionships.service.js');
const { httpError } = require('../../helpers/httpError.helper.js');
const { filterCompetitionsToTrackedSEStates } = require('../../helpers/competitions/states.helper.js');
const { fetchRegistrationDataByWcaId } = require('./competitionRegistrations.service.js');
const { formatCompetitionData } = require('../../helpers/competitions/competitionWcaData.helper.js');
const { upsertCompetitions } = require('./competitionRefresh.service.js');
const { syncWcaDriveFolderBestEffort } = require('./competitionWcaDrive.service.js');

// Refreshes one existing Planner row without taking the global bulk-refresh slot.
async function refreshCompetitionFromWCA(competitionId, actor = {}) {
  const plannerCompetition = await competitionsDb.getCompetitionById(competitionId);
  if (!plannerCompetition || !plannerCompetition.wca_competition_id) {
    throw httpError(404, 'WCA-linked competition not found.');
  }

  const { peopleId } = actor;
  const [isAssignedDelegate, isAssignedOrganizer] = peopleId
    ? await Promise.all([
        competitionDelegatesDb.isDelegateOnCompetition(peopleId, plannerCompetition.id),
        competitionOrganizersDb.isOrganizerOnCompetition(peopleId, plannerCompetition.id),
      ])
    : [false, false];
  const isAssignedManager = isAssignedDelegate || isAssignedOrganizer;
  let accessToken;

  // Unannounced competitions can only be refreshed by an assigned manager.
  if (!plannerCompetition.is_announced) {
    if (!isAssignedManager) {
      throw httpError(403, 'Only an assigned Delegate or Organizer can refresh this competition.');
    }

    accessToken = await authService.getValidAccessTokenForPerson(peopleId);
    if (!accessToken) {
      throw httpError(
        403,
        'WCA manage_competitions access is required to refresh this competition.',
      );
    }
  } else if (isAssignedManager && peopleId) {
    try {
      accessToken = await authService.getValidAccessTokenForPerson(peopleId);
    } catch {
      // Public competition and registration data can still refresh without the private token.
      accessToken = null;
    }
  }

  const wcaCompetition = await wca.fetchCompetitionById(
    String(plannerCompetition.wca_competition_id),
    accessToken ? { accessToken } : undefined,
  );

  const competitionsToPrepare = plannerCompetition.is_major
    ? [wcaCompetition]
    : filterCompetitionsToTrackedSEStates([wcaCompetition]);
  const majorWcaIds = plannerCompetition.is_major
    ? new Set([String(wcaCompetition.id)])
    : new Set();
  const preparedCompetitions = plannerCompetition.is_major
    ? await majorChampionships.prepareMajorCompetitionsForFormatting(
        competitionsToPrepare,
        majorWcaIds,
      )
    : { competitions: competitionsToPrepare, stateByWcaId: new Map() };
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId(
    preparedCompetitions.competitions,
    {
      accessToken,
      adminCompetitionIds: isAssignedManager ? new Set([String(wcaCompetition.id)]) : new Set(),
    },
  );
  const [competition] = formatCompetitionData(
    preparedCompetitions.competitions,
    [],
    registrationDataByWcaId,
    majorWcaIds,
    preparedCompetitions.stateByWcaId,
  );
  if (!competition) {
    throw httpError(400, 'Competition is no longer in a tracked state.');
  }

  competition.is_announced = Boolean(wcaCompetition.announced_at);
  competition.is_in_volunteer_application = plannerCompetition.is_in_volunteer_application;
  await upsertCompetitions([competition]);
  const refreshedCompetition = await competitionsDb.getCompetitionById(plannerCompetition.id);
  await syncWcaDriveFolderBestEffort(
    refreshedCompetition,
    'single competition refresh',
    undefined,
    true,
  );

  return { ...competition, id: plannerCompetition.id };
}
module.exports = { refreshCompetitionFromWCA };
