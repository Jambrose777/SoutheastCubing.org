const moment = require('moment');

const { httpError } = require('../httpError.helper.js');
const { SOUTHEAST_STATES } = require('./states.helper.js');
const { VALID_EVENT_IDS } = require('./wcaEvents.helper.js');

// Validates the Planner's equipment-holder assignment objects.
function getEquipmentHolders(input) {
  const equipmentHolders = input.equipmentHolders;
  if (!Array.isArray(equipmentHolders)) {
    throw httpError(400, 'Equipment holders must be an array.');
  }
  if (
    equipmentHolders.some(
      (holder) =>
        !holder ||
        typeof holder !== 'object' ||
        Array.isArray(holder) ||
        !Object.hasOwn(holder, 'peopleId') ||
        (holder.peopleId !== null && typeof holder.peopleId !== 'string') ||
        !Object.hasOwn(holder, 'equipmentDetails') ||
        (holder.equipmentDetails !== null && typeof holder.equipmentDetails !== 'string'),
    )
  ) {
    throw httpError(400, 'Equipment holders must be valid assignment objects.');
  }
  if (new Set(equipmentHolders.map((holder) => holder.peopleId)).size !== equipmentHolders.length) {
    throw httpError(400, 'Equipment holders must not contain duplicate assignments.');
  }
  return equipmentHolders;
}

// Throws if any id in `eventIds` isn't a real WCA event id.
function assertValidEventIds(eventIds) {
  const invalid = eventIds.filter((eventId) => !VALID_EVENT_IDS.includes(eventId));
  if (invalid.length) {
    throw httpError(400, `Invalid event id(s): ${invalid.join(', ')}`);
  }
}

// Validates the saved name and upstream icon class for each unofficial event.
function assertValidUnofficialEvents(events) {
  if (
    !Array.isArray(events) ||
    events.some(
      (event) =>
        !event ||
        typeof event.eventName !== 'string' ||
        typeof event.icon !== 'string' ||
        !event.icon.trim(),
    )
  ) {
    throw httpError(400, 'Unofficial events must include a name and icon class.');
  }
}

// Parse only real calendar dates in the Planner API's YYYY-MM-DD format.
function parsePlannerDate(value, fieldName) {
  const parsed = typeof value === 'string' ? moment.utc(value, 'YYYY-MM-DD', true) : null;
  if (!parsed?.isValid()) {
    throw httpError(400, `${fieldName} must be a valid date in YYYY-MM-DD format.`);
  }
  return parsed;
}

// Validate the date pair before deriving dates or persisting competition fields.
function assertValidPlannerDates(startDate, endDate) {
  const start = parsePlannerDate(startDate, 'Start date');
  const end = parsePlannerDate(endDate, 'End date');
  if (end.isBefore(start, 'day')) {
    throw httpError(400, 'End date must be on or after start date.');
  }
}

// The database column is INTEGER; omitted and null limits both mean unlimited.
function assertValidCompetitorLimit(competitorLimit) {
  if (competitorLimit == null) return;
  if (!Number.isInteger(competitorLimit) || competitorLimit < 0) {
    throw httpError(400, 'Competitor limit must be a non-negative integer.');
  }
}

// Validates a Planner location state and returns its canonical display name.
function getSoutheastState(state) {
  const canonicalState =
    typeof state === 'string'
      ? SOUTHEAST_STATES.find((candidate) => candidate.toLowerCase() === state.trim().toLowerCase())
      : undefined;
  if (!canonicalState) {
    throw httpError(400, 'State must be one of the Southeast states.');
  }
  return canonicalState;
}

// Validates required manual values for a multi-city location and canonicalizes its state.
function getValidatedMultiCityLocation(location) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw httpError(400, 'Each multi-city location must be an object.');
  }
  const requiredTextFields = [
    ['city', location.city],
    ['venue address', location.venueAddress],
    ['venue details', location.venueDetails],
    ['venue', location.venue],
  ];
  const missingField = requiredTextFields.find(
    ([, value]) => typeof value !== 'string' || !value.trim(),
  );
  if (missingField) {
    throw httpError(400, `${missingField[0]} is required for a multi-city location.`);
  }
  if (!Number.isFinite(location.latitudeDegrees) || !Number.isFinite(location.longitudeDegrees)) {
    throw httpError(400, 'Latitude and longitude are required for a multi-city location.');
  }
  if (location.competitorLimit == null) {
    throw httpError(400, 'Competitor limit is required for a multi-city location.');
  }
  assertValidCompetitorLimit(location.competitorLimit);

  return {
    city: location.city.trim(),
    state: getSoutheastState(location.state),
    venueAddress: location.venueAddress.trim(),
    venueDetails: location.venueDetails.trim(),
    venue: location.venue.trim(),
    venueUrl: typeof location.venueUrl === 'string' ? location.venueUrl.trim() || null : null,
    latitudeDegrees: location.latitudeDegrees,
    longitudeDegrees: location.longitudeDegrees,
    competitorLimit: location.competitorLimit,
  };
}

// WCA competitions need at least this many days' notice - a hand-entered
// Planner start date earlier than that isn't a realistic competition date.
const MIN_START_DATE_LEAD_DAYS = 28;

// Throws if `startDate` is less than MIN_START_DATE_LEAD_DAYS out from today.
function assertStartDateFarEnoughOut(startDate) {
  if (moment(startDate).isBefore(moment().add(MIN_START_DATE_LEAD_DAYS, 'days'), 'day')) {
    throw httpError(400, `Start date must be at least ${MIN_START_DATE_LEAD_DAYS} days out.`);
  }
}

module.exports = {
  MIN_START_DATE_LEAD_DAYS,
  getEquipmentHolders,
  assertValidEventIds,
  assertValidUnofficialEvents,
  parsePlannerDate,
  assertValidPlannerDates,
  assertValidCompetitorLimit,
  getSoutheastState,
  getValidatedMultiCityLocation,
  assertStartDateFarEnoughOut,
};
