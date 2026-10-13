const schedule = require('node-schedule');

const logger = require('../utils/logger.util.js');

const {
  fetchCompetitions,
  runCoordinatedCompetitionRefresh,
} = require('../services/competitions.service.js');
const { sendDueEquipmentReminders } = require('../services/equipmentReminders.service.js');

// Fetches competitions once immediately on boot (if the stored data is
// stale) and schedules a recurring daily refresh at midnight UTC - kept
// together here so any future scheduled/background work (e.g. a nightly
// delegate sync) has the same home instead of being bolted onto a
// controller/service file.
function registerCompetitionsRefreshJob() {
  fetchCompetitions().catch((e) => {
    if (e.status === 409) {
      logger.info(`Skipping startup competition refresh: ${e.message}`);
      return;
    }
    logger.error('Error on fetching competitions on startup: ', e);
  });

  schedule.scheduleJob('0 0 * * *', () => {
    logger.info('Fetching competitions on scheduled update.');
    runCoordinatedCompetitionRefresh()
      .then(async () => {
        try {
          await sendDueEquipmentReminders();
        } catch {
          logger.warn(
            'Equipment reminder processing did not complete; unsent reminders will be retried on a later refresh.',
          );
        }
        logger.info('Successfully fetched competitions on scheduled update.');
      })
      .catch((e) => {
        if (e.status === 409) {
          logger.info(`Skipping scheduled competition refresh: ${e.message}`);
          return;
        }
        logger.error('Error on fetching competitions on scheduled update: ', e);
      });
  });
}

module.exports = { registerCompetitionsRefreshJob };
