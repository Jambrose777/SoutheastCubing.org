// Shared log4js logger, used across the backend instead of each file
// independently requiring log4js and configuring its own logger instance.
const log4js = require('log4js');
const requestContext = require('./requestContext.util.js');

// Drops the category (%c) from the default layout - every call site shares
// this one unnamed logger, so printing its category ("default") on every
// line is just noise.
log4js.configure({
  appenders: {
    out: { type: 'stdout', layout: { type: 'pattern', pattern: '[%d] [%p] %m' } },
  },
  categories: {
    default: { appenders: ['out'], level: 'debug' },
  },
});

const baseLogger = log4js.getLogger();

// Sets the active log level - called once at boot (see app/app.js) with
// config.NODE_ENV, once it's been validated.
function setLevel(level) {
  baseLogger.level = level;
}

// Wraps the raw log4js logger so every call automatically tags itself with
// the current request's correlation id (if any) - set once per request by
// requestId.middleware.js via requestContext.util.js's AsyncLocalStorage, so
// every caller down the stack (controllers, services, integrations,
// database) gets it for free instead of needing req/id passed down manually.
// Falls back to no prefix outside of a request (e.g. the boot-time fetch/
// cron job, which have no caller to correlate against).
const logger = {};
for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) {
  logger[level] = (message, ...args) => {
    const requestId = requestContext.getRequestId();
    const prefixedMessage = requestId ? `id-${requestId} ${message}` : message;
    baseLogger[level](prefixedMessage, ...args);
  };
}
logger.setLevel = setLevel;

module.exports = logger;
