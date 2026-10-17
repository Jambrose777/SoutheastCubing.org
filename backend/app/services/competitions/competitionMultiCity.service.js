const wca = require('../../integrations/wca.integration.js');
const competitionsDb = require('../../database/competitions/competitions-table/competitions.database.js');
const competitionPlannerDb = require('../../database/competitions/competitions-table/competitionPlanner.database.js');
const competitionWcaDriveDb = require('../../database/competitions/competitions-table/competitionWcaDrive.database.js');
const competitionEventsDb = require('../../database/competitions/competitionEvents.database.js');
const competitionDelegatesDb = require('../../database/competitions/competitionDelegates.database.js');
const competitionOrganizersDb = require('../../database/competitions/competitionOrganizers.database.js');
const competitionEquipmentHoldersDb = require('../../database/competitions/competitionEquipmentHolders.database.js');
const authService = require('../auth.service.js');
const { resolvePersonIdFromWcaPerson } = require('../people/people.service.js');
const {
  getEligibleUnlinkedManagedCompetitions,
} = require('./competitionManagedCompetitions.service.js');
const {
  assertWcaDriveOptions,
  validateWcaDriveRequest,
  createWcaDriveFolderForCompetition,
  setCompetitionWcaDriveLink,
  syncWcaDriveFolderBestEffort,
} = require('./competitionWcaDrive.service.js');
const { fetchRegistrationDataByWcaId } = require('./competitionRegistrations.service.js');
const { invalidateCache } = require('./competitionPublicList.service.js');
const { httpError } = require('../../helpers/httpError.helper.js');
const {
  isEligibleManagedCompetition,
} = require('../../helpers/competitions/competitionEligibility.helper.js');
const {
  getEquipmentHolders,
  getValidatedMultiCityLocation,
} = require('../../helpers/competitions/competitionValidation.helper.js');
const {
  isMultipleCitiesWcaCompetition,
} = require('../../helpers/competitions/states.helper.js');
const {
  assertPeopleExist,
  assertEquipmentHoldersAreDelegates,
} = require('./competitionPlanner.service.js');
const { formatCompetitionData } = require('../../helpers/competitions/competitionWcaData.helper.js');

// Creates linked Planner rows for every validated Southeast location of one managed WCA competition.
async function createMultiCityCompetitionFromWca({
  peopleId,
  wcaCompetitionId,
  locations,
  createWcaDriveFolder,
  wcaDriveLink,
}) {
  assertWcaDriveOptions({ createWcaDriveFolder, wcaDriveLink });

  // Confirm the caller can manage the selected WCA competition.
  const accessToken = await authService.getValidAccessTokenForPerson(peopleId);
  if (!accessToken) {
    throw httpError(
      403,
      'WCA manage_competitions access is required to create a linked competition.',
    );
  }

  const eligibleCompetitions = await getEligibleUnlinkedManagedCompetitions(accessToken, peopleId);
  if (!eligibleCompetitions.some((comp) => comp.wca_competition_id === String(wcaCompetitionId))) {
    throw httpError(400, 'This WCA competition is not available to link.');
  }

  // Fetch and validate the selected WCA record before the first Planner write.
  const wcaCompetition = await wca.fetchCompetitionById(String(wcaCompetitionId), { accessToken });
  if (
    !isEligibleManagedCompetition(wcaCompetition) ||
    !isMultipleCitiesWcaCompetition(wcaCompetition)
  ) {
    throw httpError(400, 'This WCA competition is not an eligible multi-city competition.');
  }

  // Validate every location and assignment before creating any rows.
  if (!Array.isArray(locations) || !locations.length) {
    throw httpError(400, 'At least one location is required to create a multi-city competition.');
  }
  const validatedLocations = locations.map((location) => {
    const validatedLocation = getValidatedMultiCityLocation(location);
    const delegatePeopleIds = location.delegatePeopleIds;
    const equipmentHolders = getEquipmentHolders(location);
    if (!Array.isArray(delegatePeopleIds) || !delegatePeopleIds.length) {
      throw httpError(400, 'At least one Delegate is required for each multi-city location.');
    }
    if (!delegatePeopleIds.includes(location.leadPeopleId)) {
      throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
    }
    return {
      ...validatedLocation,
      delegatePeopleIds,
      leadPeopleId: location.leadPeopleId,
      equipmentHolders,
    };
  });
  await assertPeopleExist(
    validatedLocations.flatMap((location) => location.delegatePeopleIds),
    'Delegates',
  );
  await assertEquipmentHoldersAreDelegates(
    validatedLocations.flatMap((location) => location.equipmentHolders),
  );

  // Reuse an existing shared folder; otherwise validate any requested Drive action.
  const existingDriveFolder = await competitionWcaDriveDb.getWcaDriveLinkByWcaCompetitionId(
    wcaCompetition.id,
  );
  if (!existingDriveFolder && (createWcaDriveFolder || wcaDriveLink)) {
    validateWcaDriveRequest(wcaDriveLink);
  }

  // Fetch registration data and format WCA-owned fields once for all local rows.
  const registrationDataByWcaId = await fetchRegistrationDataByWcaId([wcaCompetition], {
    accessToken,
    adminCompetitionIds: new Set([String(wcaCompetition.id)]),
  });
  const [formattedCompetition] = formatCompetitionData(
    [wcaCompetition],
    [],
    registrationDataByWcaId,
  );
  if (!formattedCompetition) {
    throw httpError(400, 'This WCA competition could not be prepared for Planner.');
  }
  formattedCompetition.is_multiple_cities_competition = true;

  // Create one local Planner row for each validated Southeast location.
  const competitionIds = [];
  for (const location of validatedLocations) {
    const competitionId = await competitionPlannerDb.createPlannerCompetitionLinkedToWca({
      ...formattedCompetition,
      city: `${location.city}, ${location.state}`,
      state: location.state,
      venue_address: location.venueAddress,
      venue_details: location.venueDetails,
      venue: location.venue,
      venue_url: location.venueUrl,
      latitude_degrees: location.latitudeDegrees,
      longitude_degrees: location.longitudeDegrees,
      competitor_limit: location.competitorLimit,
    });
    competitionIds.push(competitionId);
  }

  // Store shared events and organizers alongside each location's assignments.
  await competitionEventsDb.replaceEventIds(
    competitionIds.map((id) => ({ id, event_ids: formattedCompetition.event_ids ?? [] })),
  );
  const organizerPeopleIds = await Promise.all(
    (formattedCompetition.organizers ?? []).map(resolvePersonIdFromWcaPerson),
  );
  for (const [index, competitionId] of competitionIds.entries()) {
    const location = validatedLocations[index];
    await competitionOrganizersDb.replaceOrganizersForCompetition(
      competitionId,
      organizerPeopleIds,
    );
    await competitionDelegatesDb.replaceDelegatesForCompetition(
      competitionId,
      location.delegatePeopleIds.map((peopleId) => ({
        peopleId,
        isLead: peopleId === location.leadPeopleId,
      })),
    );
    await competitionEquipmentHoldersDb.replaceEquipmentHoldersForCompetition(
      competitionId,
      location.equipmentHolders,
    );
  }

  // Share one Drive folder across the rows, creating or preparing it only once.
  const firstCompetitionId = competitionIds[0];
  if (existingDriveFolder) {
    for (const competitionId of competitionIds) {
      await competitionWcaDriveDb.setWcaDriveLink(
        competitionId,
        existingDriveFolder.wca_drive_link,
        existingDriveFolder.wca_drive_folder_type,
      );
    }
    const competition = await competitionsDb.getCompetitionById(firstCompetitionId);
    await syncWcaDriveFolderBestEffort(competition, 'WCA competition linking', undefined, true);
  } else if (createWcaDriveFolder) {
    await createWcaDriveFolderForCompetition(firstCompetitionId);
    const firstCompetition = await competitionsDb.getCompetitionById(firstCompetitionId);
    for (const competitionId of competitionIds.slice(1)) {
      await competitionWcaDriveDb.setWcaDriveLink(
        competitionId,
        firstCompetition.wca_drive_link,
        firstCompetition.wca_drive_folder_type,
      );
    }
  } else if (wcaDriveLink) {
    await setCompetitionWcaDriveLink(firstCompetitionId, wcaDriveLink);
    const firstCompetition = await competitionsDb.getCompetitionById(firstCompetitionId);
    for (const competitionId of competitionIds.slice(1)) {
      await competitionWcaDriveDb.setWcaDriveLink(
        competitionId,
        firstCompetition.wca_drive_link,
        firstCompetition.wca_drive_folder_type,
      );
    }
  }

  return competitionIds;
}

// Checks each upcoming multi-city WCA id once and refreshes all its local rows when public.
async function refreshUpcomingMultiCityCompetitions(
  plannerCompetitions,
  volunteerCompetitionNames,
  accessToken,
  adminRegistrationCompetitionIds,
) {
  // Group all the same WCA Ids together for multi city competitions.
  const announcedByWcaCompetitionId = new Map();
  for (const competition of plannerCompetitions) {
    if (!competition.is_multiple_cities_competition || !competition.wca_competition_id) continue;
    const wcaCompetitionId = String(competition.wca_competition_id);
    announcedByWcaCompetitionId.set(
      wcaCompetitionId,
      announcedByWcaCompetitionId.get(wcaCompetitionId) || Boolean(competition.is_announced),
    );
  }

  const failedWcaCompetitionIds = [];
  const updatedWcaCompetitionIds = [];
  let shouldInvalidatePublicCache = false;

  for (const [wcaCompetitionId, wasAnnounced] of announcedByWcaCompetitionId) {
    // Fetch competition from WCA.
    let wcaCompetition;
    try {
      wcaCompetition = await wca.fetchCompetitionById(wcaCompetitionId, {
        suppressNotFoundLogging: !wasAnnounced,
        accessToken,
      });
    } catch (error) {
      if (error.response?.status !== 404 || wasAnnounced) {
        failedWcaCompetitionIds.push(wcaCompetitionId);
      }
      continue;
    }

    // fetch registrations for competition.
    const registrationDataByWcaId = await fetchRegistrationDataByWcaId([wcaCompetition], {
      accessToken,
      adminCompetitionIds: adminRegistrationCompetitionIds,
    });

    // Format competition.
    const [formattedCompetition] = formatCompetitionData(
      [wcaCompetition],
      volunteerCompetitionNames,
      registrationDataByWcaId,
    );
    formattedCompetition.is_multiple_cities_competition = true;

    // Preform update. Returns all internal ids that link to the same WCA Id.
    const competitionIds = await competitionsDb.updateMultiCityCompetitionRowsByWcaId(
      wcaCompetitionId,
      formattedCompetition,
    );
    if (!competitionIds.length) continue;
    shouldInvalidatePublicCache ||= wasAnnounced || formattedCompetition.is_announced;

    await competitionEventsDb.replaceEventIds(
      competitionIds.map((id) => ({ id, event_ids: formattedCompetition.event_ids ?? [] })),
    );
    const organizerPeopleIds = await Promise.all(
      (formattedCompetition.organizers ?? []).map(resolvePersonIdFromWcaPerson),
    );
    for (const competitionId of competitionIds) {
      await competitionOrganizersDb.replaceOrganizersForCompetition(
        competitionId,
        organizerPeopleIds,
      );
    }
    updatedWcaCompetitionIds.push(wcaCompetitionId);
  }

  if (shouldInvalidatePublicCache) invalidateCache();
  return { failedWcaCompetitionIds, updatedWcaCompetitionIds };
}

module.exports = {
  createMultiCityCompetitionFromWca,
  refreshUpcomingMultiCityCompetitions,
};