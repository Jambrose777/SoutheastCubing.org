const schedule = require('node-schedule');

const logger = require('../utils/logger.util.js');

const { syncDelegatesFromWca } = require('../services/delegateSync.service.js');

// Schedules a recurring nightly Delegate roster sync against WCA.
// Offset to 1 AM UTC.
function registerDelegateSyncJob() {
  schedule.scheduleJob('0 1 * * *', () => {
    logger.info('Running Delegate roster sync on scheduled update.');
    syncDelegatesFromWca()
      .then((summary) => {
        if (summary.errors.length) {
          logger.error(`Delegate roster sync completed with errors: ${JSON.stringify(summary)}`);
          return;
        }
        logger.info(`Delegate roster sync completed successfully: ${JSON.stringify(summary)}`);
      })
      .catch((e) => logger.error('Error running Delegate roster sync on scheduled update: ', e));
  });
}

module.exports = { registerDelegateSyncJob };
