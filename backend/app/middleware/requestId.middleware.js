const crypto = require('crypto');
const requestContext = require('../utils/requestContext.util.js');

// Assigns a per-request correlation id (`req.id`, read by morgan's :id token)
// and runs the rest of the request inside an AsyncLocalStorage context
// carrying that id, so every downstream logger call - controllers, services,
// integrations, database - tags itself with it automatically.
function assignRequestId(req, res, next) {
  req.id = crypto.randomUUID();
  requestContext.run(req.id, next);
}

module.exports = assignRequestId;
