// Shared log4js logger, used across the backend instead of each file
// independently requiring log4js and configuring its own logger instance.
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'debug';

module.exports = logger;
