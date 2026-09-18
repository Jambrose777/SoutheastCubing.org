const morgan = require('morgan');

// Request logger, using the same timestamped/leveled format as the rest of
// the backend's logging.
module.exports = morgan(
  '[:date[iso]] [INFO] ip-:remote-addr :method :url :status :response-time ms',
);
