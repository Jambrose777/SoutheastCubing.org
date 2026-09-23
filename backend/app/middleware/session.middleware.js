const authService = require('../services/auth.service.js');
const sessionsDb = require('../database/sessions.database.js');
const usersDb = require('../database/users.database.js');

const logger = require('../utils/logger.util.js');

// Reads the session cookie (if any), validates it against the sessions
// table, and attaches the resolved user (joined with their people row) as
// req.user - applied globally so any route can check req.user without
// re-implementing this lookup.
async function attachSession(req, res, next) {
  const rawToken = req.cookies?.[authService.SESSION_COOKIE_NAME];
  
  // A missing session cookie means the user is not signed in. Don't reject
  // the request here, a route requiring authentication will call requireAuth.
  if (!rawToken) {
    next();
    return;
  }

  try {
    const session = await sessionsDb.findValidSessionAndTouch(rawToken);
    if (session) {
      req.user = await usersDb.findUserWithPeopleById(session.user_id);
    }
  } catch (err) {
    // A lookup failure shouldn't take down an otherwise-public request -
    // just proceed signed-out.
    logger.error('Failed to resolve session from cookie: ', err);
  }
  next();
}

// Gate for routes that require a signed-in user - responds 401 rather than
// letting the route run with no req.user.
function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ message: 'Sign-in required.' });
    return;
  }
  next();
}

module.exports = { attachSession, requireAuth };
