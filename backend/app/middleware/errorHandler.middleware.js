// Logger
const logger = require('../utils/logger.util.js');

// Catch-all error handler - catches errors from middleware before any route
// runs, which the routes' own try/catch blocks can't see. Responds
// generically instead of Express's default stack-trace page, preserving the
// error's status code if it set one.
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error: ', err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(err.status || err.statusCode || 500).json({ message: 'Internal server error' });
}

module.exports = { errorHandler };
