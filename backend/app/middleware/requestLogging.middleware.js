const morgan = require('morgan');

// Request logger, using the same timestamped/leveled format as the rest of
// the backend's logging. Logs the request id (assigned by
// requestId.middleware.js, and auto-tagged onto every business-event log via
// utils/logger.util.js), the caller's IP, and the signed-in user id (if any,
// from session.middleware.js's req.user) - so a business-event log elsewhere
// can be traced back to its caller/account by id alone, without needing to
// repeat the IP/user on every single log line.
morgan.token('id', (req) => req.id);
// 'anon' (not '-') so the line reads "user-anon" instead of the
// harder-to-read "user--".
morgan.token('user', (req) => req.user?.id ?? 'anon');

module.exports = morgan(
  '[:date[iso]] [INFO] id-:id ip-:remote-addr user-:user :method :url :status :response-time ms',
);
