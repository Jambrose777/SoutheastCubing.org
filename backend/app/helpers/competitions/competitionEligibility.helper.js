const moment = require('moment');

const { MIN_START_DATE_LEAD_DAYS } = require('./competitionValidation.helper.js');
const { isInSEState, isMultipleCitiesWcaCompetition } = require('./states.helper.js');

// True for an upcoming managed WCA competition in a tracked state or multi-city format.
function isEligibleManagedCompetition(comp, majorWcaIds) {
  const startDate = moment(comp.start_date, 'YYYY-MM-DD', true);
  const isMultipleCities = isMultipleCitiesWcaCompetition(comp);
  const isMajor = majorWcaIds?.has(String(comp.id));
  const hasEnoughNotice = !startDate.isBefore(
    moment().add(MIN_START_DATE_LEAD_DAYS, 'days'),
    'day',
  );
  return (
    !!comp.id &&
    startDate.isValid() &&
    (isMultipleCities || (hasEnoughNotice && (isMajor || isInSEState(comp))))
  );
}

module.exports = { isEligibleManagedCompetition };