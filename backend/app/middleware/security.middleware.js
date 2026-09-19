const helmet = require('helmet');
const cors = require('cors');

// Configures trust proxy, helmet, and the CORS allowlist on `app`.
function applySecurity(app, config) {
  // Trust only loopback (the nginx reverse proxy sits on the same host) so
  // req.ip resolves X-Forwarded-For from that hop - trusting 'true' would let
  // any client spoof their own IP via that header.
  app.set('trust proxy', 'loopback');

  app.use(helmet());

  // Scope CORS to an explicit allowlist (prod domain(s) + local dev server) instead of
  // allowing any origin, so unrelated sites can't make cross-origin requests to the API.
  // `credentials: true` lets the browser attach/read the session cookie on 
  // cross-subdomain requests from an allowlisted origin.
  app.use(cors({ origin: config.CORS_ORIGIN.split(','), credentials: true }));
}

module.exports = { applySecurity };
