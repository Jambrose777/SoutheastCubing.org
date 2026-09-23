const { hasAnyRole } = require('../helpers/roles.helper.js');

const logger = require('../utils/logger.util.js');

// Factory for every role-gated route - 401 if not signed in at all, 403 if
// signed in but holding none of `roles`.
function requireAnyRole(...roles) {
  return async function (req, res, next) {
    if (!req.user) {
      res.status(401).json({ message: 'Sign-in required.' });
      return;
    }
    try {
      if (!(await hasAnyRole(req.user, roles))) {
        logger.debug(
          `Denied access (people_id ${req.user.people_id}) - requires one of [${roles.join(', ')}].`,
        );
        res.status(403).json({ message: 'Insufficient access.' });
        return;
      }
      next();
    } catch (err) {
      logger.error('Failed to resolve access: ', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}

// Stricter gate for hard-delete actions.
const requireAdmin = requireAnyRole('isAdmin');

module.exports = { requireAnyRole, requireAdmin };
