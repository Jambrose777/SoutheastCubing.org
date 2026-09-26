const logger = require('../utils/logger.util.js');

// Creates an HTTP error object with the given status and message - thrown
// by a service layer to signal a specific status/message a controller
// should respond with, rather than falling through to a generic 500.
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Handles a service-thrown error and sends the appropriate HTTP response -
// an httpError()'s own status/message for a client error (< 500), or a
// generic 500 (with the real error logged) for anything else.
function respondWithServiceError(res, err, fallbackMessage) {
  const status = err.status || 500;
  if (status < 500) {
    logger.warn(`${fallbackMessage}: ${err.message}`);
    res.status(status).json({ message: err.message });
    return;
  }
  logger.error(`${fallbackMessage}: `, err);
  res.status(500).json({ message: 'Internal server error' });
}

module.exports = { httpError, respondWithServiceError };
