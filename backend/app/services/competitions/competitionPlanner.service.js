const crypto = require('crypto');

const logger = require('../../utils/logger.util.js');
const competitionsDb = require('../../database/competitions/competitions-table/competitions.database.js');
const competitionPlannerDb = require('../../database/competitions/competitions-table/competitionPlanner.database.js');
const competitionEventsDb = require('../../database/competitions/competitionEvents.database.js');
const competitionDelegatesDb = require('../../database/competitions/competitionDelegates.database.js');
const competitionOrganizersDb = require('../../database/competitions/competitionOrganizers.database.js');
const competitionEquipmentHoldersDb = require('../../database/competitions/competitionEquipmentHolders.database.js');
const competitionUnofficialEventsDb = require('../../database/competitions/competitionUnofficialEvents.database.js');
const peopleDb = require('../../database/people/people.database.js');
const delegatesDb = require('../../database/people/delegates.database.js');
const { getFullCompetitionDate } = require('../../helpers/competitions/competitionDates.helper.js');
const { groupBy } = require('../../helpers/groupBy.helper.js');
const { withResolvedPicture } = require('../../helpers/personPicture.helper.js');
const { httpError } = require('../../helpers/httpError.helper.js');
const { withYearInName } = require('../../helpers/competitions/competitionNames.helper.js');
const { derivePlannerStatus } = require('../../helpers/competitions/competitionStatus.helper.js');
const {
  getEquipmentHolders,
  assertValidEventIds,
  assertValidUnofficialEvents,
  assertValidPlannerDates,
  assertValidCompetitorLimit,
  getSoutheastState,
  getValidatedMultiCityLocation,
  assertStartDateFarEnoughOut,
} = require('../../helpers/competitions/competitionValidation.helper.js');
const {
  assertWcaDriveOptions,
  validateWcaDriveRequest,
  getWcaDriveFolderName,
  createWcaDriveFolderForCompetition,
  setCompetitionWcaDriveLink,
  syncWcaDriveFolderBestEffort,
} = require('./competitionWcaDrive.service.js');
const { withCompetitionEvents } = require('./competitionEnrichment.service.js');
const { invalidateCache } = require('./competitionPublicList.service.js');

// Competition Planner's full list for one date scope, including every status.
async function getCompetitionsForPlanner(view) {
  const comps = await withCompetitionEvents(await competitionPlannerDb.getCompetitionsForPlanner(view));
  const competitionIds = comps.map((comp) => comp.id);

  const delegateRowsByCompetition = groupBy(
    await competitionDelegatesDb.listForCompetitions(competitionIds),
    'competition_id',
  );
  const organizerRowsByCompetition = groupBy(
    await competitionOrganizersDb.listForCompetitions(competitionIds),
    'competition_id',
  );
  const equipmentRowsByCompetition = groupBy(
    await competitionEquipmentHoldersDb.listForCompetitions(competitionIds),
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

  // An equipment holder's people_id is null for the plain "Other" option.
  const toEquipmentHolder = (row) => ({
    ...(row.people_id === null ? { peopleId: null } : toPerson(row)),
    equipmentDetails: row.equipment_details,
  });

  return comps.map((comp) => ({
    ...comp,
    status: derivePlannerStatus(comp),
    delegates: (delegateRowsByCompetition.get(comp.id) ?? []).map(toPerson),
    organizers: (organizerRowsByCompetition.get(comp.id) ?? []).map(toPerson),
    equipmentHolders: (equipmentRowsByCompetition.get(comp.id) ?? []).map(toEquipmentHolder),
  }));
}

// Throws if any id in `peopleIds` doesn't exist as a `people` row.
async function assertPeopleExist(peopleIds, label) {
  if (!peopleIds.length) return;
  const existingIds = await peopleDb.findExistingIds(peopleIds);
  const missing = peopleIds.filter((id) => !existingIds.includes(id));
  if (missing.length) {
    throw httpError(400, `${label} includes unknown person id(s): ${missing.join(', ')}`);
  }
}

// Person assignments must reference current Delegates; null represents "Other".
async function assertEquipmentHoldersAreDelegates(equipmentHolders) {
  const peopleIds = equipmentHolders
    .map((holder) => holder.peopleId)
    .filter((peopleId) => peopleId !== null);
  if (!peopleIds.length) return;
  const openDelegatePeopleIds = await delegatesDb.findOpenDelegatePeopleIds(peopleIds);
  const invalid = peopleIds.some((peopleId) => !openDelegatePeopleIds.includes(peopleId));
  if (invalid) {
    throw httpError(400, 'Equipment holders must be current Delegates.');
  }
}

// Creates a brand-new Planner competition.
async function createCompetition(input) {
  const { name, city, state, startDate, endDate, leadPeopleId } = input;
  if (!name || !city || !state || !startDate || !endDate || !leadPeopleId) {
    throw httpError(
      400,
      'name, city, state, start date, end date, and lead Delegate are required.',
    );
  }
  const southeastState = getSoutheastState(state);
  assertValidPlannerDates(startDate, endDate);
  assertStartDateFarEnoughOut(startDate);
  assertValidCompetitorLimit(input.competitorLimit);

  // Validates Google Drive params.
  assertWcaDriveOptions(input);
  if (input.createWcaDriveFolder || input.wcaDriveLink) {
    validateWcaDriveRequest(input.wcaDriveLink);
  }

  const delegatePeopleIds = input.delegatePeopleIds ?? [];
  const organizerPeopleIds = input.organizerPeopleIds ?? [];
  const equipmentHolders = getEquipmentHolders(input);
  const eventIds = input.eventIds ?? [];
  const unofficialEvents = input.unofficialEvents ?? [];
  if (!delegatePeopleIds.includes(leadPeopleId)) {
    throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
  }
  await assertPeopleExist(delegatePeopleIds, 'Delegates');
  await assertPeopleExist(organizerPeopleIds, 'Organizers');
  await assertEquipmentHoldersAreDelegates(equipmentHolders);
  assertValidEventIds(eventIds);
  assertValidUnofficialEvents(unofficialEvents);

  const id = crypto.randomUUID();
  await competitionPlannerDb.createPlannerCompetition({
    id,
    name: withYearInName(name, endDate),
    city: `${city}, ${southeastState}`,
    state: southeastState,
    venueAddress: input.venueAddress,
    venueDetails: input.venueDetails,
    venue: input.venue,
    venueUrl: input.venueUrl,
    latitudeDegrees: input.latitudeDegrees,
    longitudeDegrees: input.longitudeDegrees,
    startDate,
    endDate,
    fullDate: getFullCompetitionDate(startDate, endDate),
    competitorLimit: input.competitorLimit,
  });

  await competitionDelegatesDb.replaceDelegatesForCompetition(
    id,
    delegatePeopleIds.map((peopleId) => ({
      peopleId,
      isLead: peopleId === leadPeopleId,
    })),
  );
  await competitionOrganizersDb.replaceOrganizersForCompetition(id, organizerPeopleIds);
  await competitionEquipmentHoldersDb.replaceEquipmentHoldersForCompetition(id, equipmentHolders);
  await competitionEventsDb.replaceEventIds([{ id, event_ids: eventIds }]);
  await competitionUnofficialEventsDb.replaceUnofficialEventsForCompetition(id, unofficialEvents);

  if (input.createWcaDriveFolder) {
    await createWcaDriveFolderForCompetition(id);
  } else if (input.wcaDriveLink) {
    await setCompetitionWcaDriveLink(id, input.wcaDriveLink);
  }

  logger.debug(
    `Created Planner competition "${name}" (id ${id}), led by people_id ${leadPeopleId}.`,
  );
  return id;
}

// Creates a manual major without Southeast-only location or lead-Delegate requirements.
async function createMajorCompetition(input) {
  // Validate input.
  const { name, city, stateOrCountry, startDate, endDate } = input;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof city !== 'string' ||
    !city.trim() ||
    typeof stateOrCountry !== 'string' ||
    !stateOrCountry.trim() ||
    !startDate ||
    !endDate
  ) {
    throw httpError(
      400,
      'Name, city, State / Country, start date, and end date are required for a major.',
    );
  }
  if (input.createWcaDriveFolder || input.wcaDriveLink) {
    throw httpError(400, 'Major competitions do not use WCA Drive folders.');
  }

  const normalizedStateOrCountry = stateOrCountry.trim();
  assertValidPlannerDates(startDate, endDate);
  assertStartDateFarEnoughOut(startDate);
  assertValidCompetitorLimit(input.competitorLimit);

  const delegatePeopleIds = input.delegatePeopleIds ?? [];
  const organizerPeopleIds = input.organizerPeopleIds ?? [];
  const equipmentHolders = getEquipmentHolders(input);
  const eventIds = input.eventIds ?? [];
  const unofficialEvents = input.unofficialEvents ?? [];
  if (
    !Array.isArray(delegatePeopleIds) ||
    !Array.isArray(organizerPeopleIds) ||
    !Array.isArray(eventIds) ||
    !Array.isArray(unofficialEvents)
  ) {
    throw httpError(
      400,
      'Delegates, organizers, events, and unofficial events must be arrays.',
    );
  }

  const leadPeopleId = input.leadPeopleId ?? null;
  if (leadPeopleId && !delegatePeopleIds.includes(leadPeopleId)) {
    throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
  }
  await assertPeopleExist(delegatePeopleIds, 'Delegates');
  await assertPeopleExist(organizerPeopleIds, 'Organizers');
  await assertEquipmentHoldersAreDelegates(equipmentHolders);
  assertValidEventIds(eventIds);
  assertValidUnofficialEvents(unofficialEvents);

  // Create a new competition.
  const id = crypto.randomUUID();
  await competitionPlannerDb.createPlannerCompetition({
    id,
    name: withYearInName(name, endDate),
    city: `${city.trim()}, ${normalizedStateOrCountry}`,
    state: normalizedStateOrCountry,
    venueAddress: input.venueAddress,
    venueDetails: input.venueDetails,
    venue: input.venue,
    venueUrl: input.venueUrl,
    latitudeDegrees: input.latitudeDegrees,
    longitudeDegrees: input.longitudeDegrees,
    startDate,
    endDate,
    fullDate: getFullCompetitionDate(startDate, endDate),
    competitorLimit: input.competitorLimit,
    isMajor: true,
  });

  await competitionDelegatesDb.replaceDelegatesForCompetition(
    id,
    delegatePeopleIds.map((peopleId) => ({
      peopleId,
      isLead: peopleId === leadPeopleId,
    })),
  );
  await competitionOrganizersDb.replaceOrganizersForCompetition(id, organizerPeopleIds);
  await competitionEquipmentHoldersDb.replaceEquipmentHoldersForCompetition(id, equipmentHolders);
  await competitionEventsDb.replaceEventIds([{ id, event_ids: eventIds }]);
  await competitionUnofficialEventsDb.replaceUnofficialEventsForCompetition(id, unofficialEvents);

  logger.debug(`Created manual major Planner competition "${name}".`);
  return id;
}

// Updates an existing Planner competition, enforcing the status-gated
// editability rules: hand-entered fields and Delegates/Organizers are only
// writable while still Potential (unsynced).
async function updateCompetition(id, input) {
  const comp = await competitionsDb.getCompetitionById(id);
  if (!comp) throw httpError(404, 'Competition not found.');
  const status = derivePlannerStatus(comp);
  const unofficialEvents = input.unofficialEvents ?? [];
  assertValidUnofficialEvents(unofficialEvents);
  const hasDriveLinkUpdate = Object.hasOwn(input, 'wcaDriveLink'); // true even if null.
  if (hasDriveLinkUpdate && input.wcaDriveLink) {
    validateWcaDriveRequest(input.wcaDriveLink);
  }

  if (!comp.is_major && !input.leadPeopleId) {
    throw httpError(400, 'Lead Delegate is required.');
  }

  const equipmentHolders = getEquipmentHolders(input);
  await assertEquipmentHoldersAreDelegates(equipmentHolders);

  let updatedCompetition = null;
  if (status === 'potential') {
    const { name, city, startDate, endDate } = input;
    const stateOrCountry = comp.is_major ? input.stateOrCountry : input.state;
    if (!name || !city || !stateOrCountry || !startDate || !endDate) {
      throw httpError(
        400,
        comp.is_major
          ? 'name, city, State / Country, start date, and end date are required.'
          : 'name, city, state, start date, and end date are required.',
      );
    }
    const state = comp.is_major ? stateOrCountry.trim() : getSoutheastState(stateOrCountry);
    assertValidPlannerDates(startDate, endDate);
    assertStartDateFarEnoughOut(startDate);
    assertValidCompetitorLimit(input.competitorLimit);

    const delegatePeopleIds = input.delegatePeopleIds ?? [];
    const organizerPeopleIds = input.organizerPeopleIds ?? [];
    const eventIds = input.eventIds ?? [];
    if (input.leadPeopleId && !delegatePeopleIds.includes(input.leadPeopleId)) {
      throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
    }
    await assertPeopleExist(delegatePeopleIds, 'Delegates');
    await assertPeopleExist(organizerPeopleIds, 'Organizers');
    assertValidEventIds(eventIds);

    const fullDate = getFullCompetitionDate(input.startDate, input.endDate);
    updatedCompetition = await competitionPlannerDb.updatePlannerCompetitionFields(id, {
      name: withYearInName(input.name, input.endDate),
      city: `${input.city.trim()}, ${state}`,
      state,
      venueAddress: input.venueAddress,
      venueDetails: input.venueDetails,
      venue: input.venue,
      venueUrl: input.venueUrl,
      latitudeDegrees: input.latitudeDegrees,
      longitudeDegrees: input.longitudeDegrees,
      startDate: input.startDate,
      endDate: input.endDate,
      fullDate,
      competitorLimit: input.competitorLimit,
    });
    await competitionOrganizersDb.replaceOrganizersForCompetition(id, organizerPeopleIds);
    await competitionDelegatesDb.replaceDelegatesForCompetition(
      id,
      delegatePeopleIds.map((peopleId) => ({
        peopleId,
        isLead: peopleId === input.leadPeopleId,
      })),
    );
    await competitionEventsDb.replaceEventIds([{ id, event_ids: eventIds }]);
  } else if (comp.is_multiple_cities_competition) {
    const location = getValidatedMultiCityLocation(input);
    const delegatePeopleIds = input.delegatePeopleIds ?? [];
    if (!Array.isArray(delegatePeopleIds) || !delegatePeopleIds.includes(input.leadPeopleId)) {
      throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
    }
    await assertPeopleExist(delegatePeopleIds, 'Delegates');

    updatedCompetition = await competitionPlannerDb.updateMultiCityLocationFields(id, {
      ...location,
      city: `${location.city}, ${location.state}`,
    });
    if (!updatedCompetition) throw httpError(404, 'Competition not found.');
    await competitionDelegatesDb.replaceDelegatesForCompetition(
      id,
      delegatePeopleIds.map((peopleId) => ({
        peopleId,
        isLead: peopleId === input.leadPeopleId,
      })),
    );
  } else if (comp.is_major) {
    // announced majors can change lead Delegate.
    const leadPeopleId = input.leadPeopleId ?? null;
    if (leadPeopleId) {
      const currentDelegatePeopleIds = (await competitionDelegatesDb.listForCompetitions([id])).map(
        (row) => row.people_id,
      );
      if (!currentDelegatePeopleIds.includes(leadPeopleId)) {
        throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
      }
    }
    // Allows null to clear.
    if (Object.hasOwn(input, 'leadPeopleId')) {
      await competitionDelegatesDb.setLead(id, leadPeopleId);
    }
  } else {
    // Once linked, membership is sync-owned and only the lead flag changes
    // here (setLead), never which rows exist.
    const currentDelegatePeopleIds = (await competitionDelegatesDb.listForCompetitions([id])).map(
      (row) => row.people_id,
    );
    if (!currentDelegatePeopleIds.includes(input.leadPeopleId)) {
      throw httpError(400, "Lead Delegate must already be one of this competition's Delegates.");
    }
    await competitionDelegatesDb.setLead(id, input.leadPeopleId);
  }

  // Equipment stays editable regardless of status - Planner-owned, never synced.
  await competitionEquipmentHoldersDb.replaceEquipmentHoldersForCompetition(id, equipmentHolders);
  const unofficialEventsChanged =
    await competitionUnofficialEventsDb.replaceUnofficialEventsForCompetition(id, unofficialEvents);
  if (status === 'announced' && unofficialEventsChanged) invalidateCache();

  if (hasDriveLinkUpdate) {
    await setCompetitionWcaDriveLink(id, input.wcaDriveLink);
  } else if (
    comp.wca_drive_link &&
    updatedCompetition &&
    getWcaDriveFolderName(comp) !== getWcaDriveFolderName(updatedCompetition)
  ) {
    await syncWcaDriveFolderBestEffort(updatedCompetition, 'competition update', undefined, true);
  }

  logger.debug(`Updated Planner competition (id ${id}, status ${status}).`);
}

// Deletes a Planner competition - never allowed once Announced.
async function deleteCompetition(id) {
  const comp = await competitionsDb.getCompetitionById(id);
  if (!comp) throw httpError(404, 'Competition not found.');
  if (derivePlannerStatus(comp) === 'announced') {
    throw httpError(400, 'An announced competition can never be deleted.');
  }

  await syncWcaDriveFolderBestEffort(comp, 'Planner competition deletion', 'abandoned', true);
  await competitionPlannerDb.deletePlannerCompetition(id);
  logger.debug(`Deleted Planner competition (id ${id}).`);
}

// Unlinks a Planning competition while retaining its Planner data and related rows.
async function unlinkCompetitionFromWca(id) {
  const comp = await competitionsDb.getCompetitionById(id);
  if (!comp) throw httpError(404, 'Competition not found.');
  if (derivePlannerStatus(comp) !== 'planning') {
    throw httpError(400, 'Only Planning competitions can be unlinked from WCA.');
  }

  const unlinked = await competitionPlannerDb.unlinkPlannerCompetitionFromWca(id);
  if (!unlinked) {
    const currentCompetition = await competitionsDb.getCompetitionById(id);
    if (!currentCompetition) throw httpError(404, 'Competition not found.');
    throw httpError(400, 'Only Planning competitions can be unlinked from WCA.');
  }
  logger.debug(`Unlinked WCA from Planner competition (id ${id}).`);
}

module.exports = {
  getCompetitionsForPlanner,
  assertPeopleExist,
  assertEquipmentHoldersAreDelegates,
  createCompetition,
  createMajorCompetition,
  updateCompetition,
  deleteCompetition,
  unlinkCompetitionFromWca,
};
