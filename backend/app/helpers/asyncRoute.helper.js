const logger = require('../utils/logger.util.js');

// Wraps an async (or sync) route handler so a thrown/rejected error still
// gets a generic 500 instead of an unhandled rejection.
function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((e) => {
      logger.error(`${req.method} ${req.path} `, e);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Internal server error' });
      }
    });
  };
}

module.exports = { asyncRoute };
