const myInfoService = require('../services/myInfo.service.js');
const { respondWithServiceError } = require('../helpers/httpError.helper.js');

const logger = require('../utils/logger.util.js');

// GET /dashboard/my-info - the signed-in user's own identity/contact fields
// plus their current/past roles and memberships.
async function getMyInfo(req, res) {
  try {
    const myInfo = await myInfoService.getMyInfo(req.user);
    res.json(myInfo);
  } catch (err) {
    logger.error('Failed to load My Info: ', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /dashboard/my-info/bio - sets the signed-in Delegate's own bio.
// Returns the refreshed My Info payload (same shape as GET) - one
// round trip instead of a bespoke response shape per mutation.
async function updateBio(req, res) {
  try {
    const myInfo = await myInfoService.updateBio(req.user, req.body?.bio ?? '');
    res.json(myInfo);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update Delegate bio');
  }
}

module.exports = { getMyInfo, updateBio };
