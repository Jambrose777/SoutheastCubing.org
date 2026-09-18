const schedule = require('node-schedule');

// Logger
const logger = require('../utils/logger.util.js');

const {
  fetchCompetitions,
  refreshCompetitionsFromWCA,
} = require('../services/competitions.service.js');

// Fetches competitions once immediately on boot (if the stored data is
// stale) and schedules a recurring daily refresh at midnight UTC - kept
// together here so any future scheduled/background work (e.g. a nightly
// delegate sync) has the same home instead of being bolted onto a
// controller/service file.
function registerCompetitionsRefreshJob() {
  fetchCompetitions().catch((e) => {
    logger.error('Error on fetching competitions on startup: ', e);
  });

  schedule.scheduleJob('0 0 * * *', () => {
    logger.info('Fetching competitions on scheduled update.');
    refreshCompetitionsFromWCA()
      .then(() => logger.info('Successfully fetched competitions on scheduled update.'))
      .catch((e) => logger.error('Error on fetching competitions on scheduled update: ', e));
  });
}

module.exports = { registerCompetitionsRefreshJob };
