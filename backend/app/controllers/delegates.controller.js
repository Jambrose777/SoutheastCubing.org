const logger = require('../utils/logger.util.js');
const { respondWithServiceError } = require('../helpers/httpError.helper.js');

const { syncDelegatesFromWca } = require('../services/delegateSync.service.js');
const delegatesService = require('../services/delegates.service.js');

// GET /delegates - public Delegate roster page listing.
async function listPublicDelegates(req, res) {
  try {
    const delegates = await delegatesService.listDelegatesForPublicPage();
    res.json(delegates);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to list delegates');
  }
}

// Manually triggers the same WCA sync as the nightly job, outside its
// schedule - mirrors update-competitions' manual-refresh button, but
// returns a structured summary of what actually changed (promotions,
// demotions, rank/state changes, Regional/Senior stints, errors) rather
// than a plain pass-through of the raw payload, per this story's own
// decision (see delegates.md's "Manual refresh button"). Gated to Regional
// Delegate/Admin/Board (see the route) - Board is included here even though
// it can't manage Delegates directly, per this story's own scope decision.
async function syncDelegates(req, res) {
  logger.info(`Manual Delegate roster sync triggered by people_id ${req.user.people_id}.`);
  const summary = await syncDelegatesFromWca();
  if (summary.errors.length) {
    logger.error(`Manual Delegate roster sync completed with errors: ${JSON.stringify(summary)}`);
    res.status(502).json(summary);
    return;
  }
  logger.info(`Manual Delegate roster sync completed successfully: ${JSON.stringify(summary)}`);
  res.status(200).json(summary);
}

module.exports = { listPublicDelegates, syncDelegates };
