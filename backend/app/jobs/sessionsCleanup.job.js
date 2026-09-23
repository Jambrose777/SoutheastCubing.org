const schedule = require('node-schedule');

const logger = require('../utils/logger.util.js');

const sessionsDb = require('../database/sessions.database.js');

// Schedules a recurring daily purge of already-expired session rows at
// midnight UTC.
function registerSessionsCleanupJob() {
  schedule.scheduleJob('0 0 * * *', () => {
    sessionsDb
      .deleteExpiredSessions()
      .then((count) => logger.info(`Purged ${count} expired session(s) on scheduled cleanup.`))
      .catch((e) => logger.error('Error purging expired sessions on scheduled cleanup: ', e));
  });
}

module.exports = { registerSessionsCleanupJob };
