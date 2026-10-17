const moment = require('moment');

// Appends the end date's year to a hand-entered name that has no 4-digit year in it already.
function withYearInName(name, endDate) {
  if (/\d{4}/.test(name)) return name;
  return `${name.trim()} ${moment(endDate).format('YYYY')}`;
}

module.exports = { withYearInName };