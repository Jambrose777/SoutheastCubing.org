const myInfoService = require('../services/myInfo.service.js');

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

module.exports = { getMyInfo };
