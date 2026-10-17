// The 6 states SECI tracks/considers "Southeast"
const SOUTHEAST_STATES = [
  'Alabama',
  'Florida',
  'Georgia',
  'North Carolina',
  'South Carolina',
  'Tennessee',
];

// Returns the trimmed segment after the last comma in a competition city string
// (e.g. "Atlanta, Georgia" -> "Georgia")
function getStateFromCity(city) {
  if (!city) return undefined;
  return city.substring(city.lastIndexOf(',') + 1).trim();
}

// Identifies a WCA competition whose locations are represented by separate local rows.
function isMultipleCitiesWcaCompetition(comp) {
  return comp.city?.trim().toLowerCase() === 'multiple cities';
}

// Returns the canonical Title-Case tracked-state name if `city`'s parsed state
// matches one of TRACKED_SE_STATES case-insensitively, or undefined otherwise.
function getTrackedSEState(city) {
  const state = getStateFromCity(city);
  return state && SOUTHEAST_STATES.find((tracked) => tracked.toLowerCase() === state.toLowerCase());
}

// True if a competition's city belongs to a state SECI tracks.
function isInSEState(comp) {
  return !!getTrackedSEState(comp.city);
}

// Keeps only competitions whose cities belong to a tracked Southeast state.
function filterCompetitionsToTrackedSEStates(competitions) {
  return competitions.filter(isInSEState);
}

module.exports = {
  SOUTHEAST_STATES,
  getStateFromCity,
  getTrackedSEState,
  isInSEState,
  filterCompetitionsToTrackedSEStates,
  isMultipleCitiesWcaCompetition,
};