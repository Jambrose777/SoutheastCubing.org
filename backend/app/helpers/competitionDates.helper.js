const moment = require('moment');

// Formats a competition's start/end dates for display, with the multi-day
// rules WCA competitions need: same day, multi-day within a month, spanning
// months, and spanning years all render differently (see examples below).
function getFullCompetitionDate(start, end) {
  // 1 day competition has no special logic. Output example: "Jan 1, 2023"
  if (start === end) {
    return moment(start).format('MMM D, YYYY');
  }

  let mstart = moment(start);
  let mend = moment(end);

  // Check that year matches
  if (mstart.year === mend.year) {
    // Check that month matches
    if (mstart.month === mend.month) {
      // Multi day competition with a few days difference. Output example: Jan 1 - 2, 2023
      return mstart.format('MMM D') + ' - ' + mend.format('D, YYYY');
    } else {
      // Multi day competitiion with a month difference included. Output example: Jan 31 - Feb 2, 2023
      return mstart.format('MMM D') + ' - ' + mend.format('MMM D, YYYY');
    }
  } else {
    // Multi day competitiion with a year difference included. Output example: Dec 31, 2022 - Jan 1, 2023
    return mstart.format('MMM D, YYYY') + ' - ' + mend.format('MMM D, YYYY');
  }
}

module.exports = { getFullCompetitionDate };
