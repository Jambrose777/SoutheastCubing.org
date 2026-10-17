const wca = require('../../integrations/wca.integration.js');
const authService = require('../auth.service.js');
const competitionsDb = require('../../database/competitions/competitions-table/competitions.database.js');
const competitionPlannerDb = require('../../database/competitions/competitions-table/competitionPlanner.database.js');
const competitionWcaDriveDb = require('../../database/competitions/competitions-table/competitionWcaDrive.database.js');
const competitionEventsDb = require('../../database/competitions/competitionEvents.database.js');
const competitionDelegatesDb = require('../../database/competitions/competitionDelegates.database.js');
const competitionOrganizersDb = require('../../database/competitions/competitionOrganizers.database.js');
const majorChampionships = require('./majorChampionships.service.js');
const { resolvePersonIdFromWcaPerson } = require('../people/people.service.js');
const { httpError } = require('../../helpers/httpError.helper.js');
const { derivePlannerStatus } = require('../../helpers/competitions/competitionStatus.helper.js');
const {
  getEligibleUnlinkedManagedCompetitions,
} = require('./competitionManagedCompetitions.service.js');
const { isEligibleManagedCompetition } = require('../../helpers/competitions/competitionEligibility.helper.js');
const {
  filterCompetitionsToTrackedSEStates,
  isMultipleCitiesWcaCompetition,
} = require('../../helpers/competitions/states.helper.js');
const { fetchRegistrationDataByWcaId } = require('./competitionRegistrations.service.js');
const { formatCompetitionData } = require('../../helpers/competitions/competitionWcaData.helper.js');
const {
  assertWcaDriveOptions,
  validateWcaDriveRequest,
  createWcaDriveFolderForCompetition,
  setCompetitionWcaDriveLink,
  syncWcaDriveFolderBestEffort,
} = require('./competitionWcaDrive.service.js');

// Syncs one competition's delegates/organizers from the already-fetched WCA
// data. WCA's API exposes no lead-delegate signal, `existingIsLeadByPeopleId`
// carries forward any manual pick for a delegate who's still on the competition.
async function syncDelegatesAndOrganizers({ id, delegates, organizers, existingIsLeadByPeopleId }) {
  const delegatePeopleIds = await Promise.all((delegates ?? []).map(resolvePersonIdFromWcaPerson));
  const organizerPeopleIds = await Promise.all((organizers ?? []).map(resolvePersonIdFromWcaPerson));

  await competitionDelegatesDb.replaceDelegatesForCompetition(
    id,
    delegatePeopleIds.map((peopleId) => ({
      peopleId,
      isLead: existingIsLeadByPeopleId.get(peopleId) ?? false,
    })),
  );
  await competitionOrganizersDb.replaceOrganizersForCompetition(id, organizerPeopleIds);
}

// Links an eligible managed WCA competition to an existing Potential row or creates a new row.
async function linkManagedCompetitionToPlanner({
  peopleId,
  wcaCompetitionId,
  plannerCompetitionId,
  createWcaDriveFolder,
  wcaDriveLink,
}) {
  assertWcaDriveOptions({ createWcaDriveFolder, wcaDriveLink });

  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) {
    throw httpError(403, 'WCA manage_competitions access is required to link a competition.');
  }

  const eligibleCompetitions = await getEligibleUnlinkedManagedCompetitions(accessToken, peopleId);
  const eligibleCompetition = eligibleCompetitions.find(
    (competition) => competition.wca_competition_id === String(wcaCompetitionId),
  );
  if (!eligibleCompetition) {
    throw httpError(400, 'This WCA competition is not available to link.');
  }

  let existingIsLeadByPeopleId = new Map();
  let plannerCompetition = null;
  if (plannerCompetitionId) {
    plannerCompetition = await competitionsDb.getCompetitionById(plannerCompetitionId);
    if (!plannerCompetition) throw httpError(404, 'Competition not found.');
    if (derivePlannerStatus(plannerCompetition) !== 'potential') {
      throw httpError(400, 'Only a Potential competition can be linked to WCA.');
    }

    const existingDelegateRows = await competitionDelegatesDb.listForCompetitions([
      plannerCompetitionId,
    ]);
    existingIsLeadByPeopleId = new Map(
      existingDelegateRows.map((row) => [row.people_id, row.is_lead]),
    );
  }

  // Fetch and validate the selected WCA record before the first Planner write.
  const wcaCompetition = await wca.fetchCompetitionById(String(wcaCompetitionId), { accessToken });
  const majorWcaIds = eligibleCompetition.is_major
    ? new Set([String(wcaCompetition.id)])
    : new Set();
  if (!isEligibleManagedCompetition(wcaCompetition, majorWcaIds)) {
    throw httpError(400, 'This WCA competition is no longer eligible to link.');
  }
  const isMajor = majorWcaIds.has(String(wcaCompetition.id));
  if (plannerCompetition && Boolean(plannerCompetition.is_major) !== isMajor) {
    throw httpError(
      400,
      'The Planner row and WCA competition must both be majors or both be regular competitions.',
    );
  }

  // Multi-city locations must start from a manually entered Potential row.
  const isMultipleCities = isMultipleCitiesWcaCompetition(wcaCompetition);
  if (isMultipleCities && !plannerCompetition) {
    throw httpError(
      400,
      'Create a Southeast location row before linking a multi-city WCA competition.',
    );
  }
  const existingMultiCityDriveFolder =
    isMultipleCities && !isMajor
      ? await competitionWcaDriveDb.getWcaDriveLinkByWcaCompetitionId(wcaCompetition.id)
      : null;
  if (!isMajor && !existingMultiCityDriveFolder && (createWcaDriveFolder || wcaDriveLink)) {
    validateWcaDriveRequest(wcaDriveLink);
  }

  const competitionsToPrepare =
    isMajor || isMultipleCities
      ? [wcaCompetition]
      : filterCompetitionsToTrackedSEStates([wcaCompetition]);
  const preparedCompetitions = isMajor
    ? await majorChampionships.prepareMajorCompetitionsForFormatting(
        competitionsToPrepare,
        majorWcaIds,
      )
    : { competitions: competitionsToPrepare, stateByWcaId: new Map() };

  // Fetch registration data to add to the competition.
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId(
    preparedCompetitions.competitions,
    {
      accessToken,
      adminCompetitionIds: new Set([String(wcaCompetition.id)]),
    },
  );

  // Format Competition information.
  const [formattedCompetition] = formatCompetitionData(
    preparedCompetitions.competitions,
    [],
    registrationDataByWcaId,
    majorWcaIds,
    preparedCompetitions.stateByWcaId,
  );
  if (!formattedCompetition) {
    throw httpError(400, 'This WCA competition could not be prepared for Planner.');
  }
  if (isMultipleCities) {
    Object.assign(formattedCompetition, {
      city: plannerCompetition.city,
      state: plannerCompetition.state,
      venue_address: plannerCompetition.venue_address,
      venue_details: plannerCompetition.venue_details,
      venue: plannerCompetition.venue,
      venue_url: plannerCompetition.venue_url,
      latitude_degrees: plannerCompetition.latitude_degrees,
      longitude_degrees: plannerCompetition.longitude_degrees,
      competitor_limit: plannerCompetition.competitor_limit,
      is_multiple_cities_competition: true,
    });
  }

  // Check that the competition has not already been linked
  let competitionId = plannerCompetitionId;
  if (competitionId) {
    const linked = await competitionPlannerDb.linkPlannerCompetitionToWca(
      competitionId,
      formattedCompetition,
    );
    if (!linked) {
      throw httpError(409, 'This Potential competition has already been linked.');
    }
  } else {
    competitionId = await competitionPlannerDb.createPlannerCompetitionLinkedToWca(
      formattedCompetition,
    );
  }

  await competitionEventsDb.replaceEventIds([
    { id: competitionId, event_ids: formattedCompetition.event_ids ?? [] },
  ]);
  if (isMultipleCities) {
    // Organizers are WCA-owned; multi-city Delegates are assigned per location.
    await competitionOrganizersDb.replaceOrganizersForCompetition(
      competitionId,
      await Promise.all(
        (formattedCompetition.organizers ?? []).map(resolvePersonIdFromWcaPerson),
      ),
    );
  } else {
    await syncDelegatesAndOrganizers({
      id: competitionId,
      delegates: formattedCompetition.delegates,
      organizers: formattedCompetition.organizers,
      existingIsLeadByPeopleId,
    });
  }

  // WCA Drive creation & Sync.
  if (isMajor) {
    // Major competitions do not use WCA Drive linkage or folder automation.
  } else if (existingMultiCityDriveFolder) {
    await competitionWcaDriveDb.setWcaDriveLink(
      competitionId,
      existingMultiCityDriveFolder.wca_drive_link,
      existingMultiCityDriveFolder.wca_drive_folder_type,
    );
    const linkedCompetition = await competitionsDb.getCompetitionById(competitionId);
    await syncWcaDriveFolderBestEffort(
      linkedCompetition,
      'WCA competition linking',
      undefined,
      true,
    );
  } else if (createWcaDriveFolder) {
    await createWcaDriveFolderForCompetition(competitionId);
  } else if (wcaDriveLink) {
    await setCompetitionWcaDriveLink(competitionId, wcaDriveLink);
  } else {
    const linkedCompetition = await competitionsDb.getCompetitionById(competitionId);
    await syncWcaDriveFolderBestEffort(
      linkedCompetition,
      'WCA competition linking',
      undefined,
      true,
    );
  }

  return competitionId;
}

module.exports = {
  syncDelegatesAndOrganizers,
  linkManagedCompetitionToPlanner,
};
