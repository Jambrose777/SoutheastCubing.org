const morgan = require('morgan');

// Request logger, using the same timestamped/leveled format as the rest of
// the backend's logging. Logs both the request id (assigned by
// requestId.middleware.js, and auto-tagged onto every business-event log via
// utils/logger.util.js) and the caller's IP, so a business-event log
// elsewhere can be traced back to its caller by id without needing to
// repeat the IP itself.
morgan.token('id', (req) => req.id);

module.exports = morgan(
  '[:date[iso]] [INFO] id-:id ip-:remote-addr :method :url :status :response-time ms',
);
