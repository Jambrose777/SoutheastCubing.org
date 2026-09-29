const logger = require('../utils/logger.util.js');
const { respondWithServiceError } = require('../helpers/httpError.helper.js');

const { syncDelegatesFromWca } = require('../services/delegateSync.service.js');
const delegatesService = require('../services/delegates.service.js');
const manageDelegatesService = require('../services/manageDelegates.service.js');

// GET /delegates - public Delegate roster page listing.
async function listPublicDelegates(req, res) {
  try {
    const delegates = await delegatesService.listDelegatesForPublicPage();
    res.json(delegates);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to list delegates');
  }
}

// GET /dashboard/delegates - Manage Delegates dashboard's own full-roster
// listing (current + full history), unlike the public /delegates listing.
async function listForDashboard(req, res) {
  try {
    const data = await delegatesService.listDelegatesForDashboard();
    res.json(data);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to list delegates for the dashboard');
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

// POST /dashboard/delegate-rank-history - backfills a past rank stint.
async function createRankRow(req, res) {
  try {
    const { peopleId, wcaId, rank, startDate, endDate } = req.body ?? {};
    const row = await manageDelegatesService.createRankRow({
      person: { peopleId, wcaId },
      rank,
      startDate,
      endDate,
      actorId: req.user.id,
    });
    res.status(201).json(row);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to create rank history row');
  }
}

// PUT /dashboard/delegate-rank-history/:id - corrects a rank-history row's dates.
async function updateRankRow(req, res) {
  try {
    const { rank, startDate, endDate } = req.body ?? {};
    const row = await manageDelegatesService.updateRankRow(req.params.id, {
      rank,
      startDate,
      endDate,
      actorId: req.user.id,
    });
    res.json(row);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update rank history row');
  }
}

// DELETE /dashboard/delegate-rank-history/:id - Admin-only, irreversible.
async function hardDeleteRankRow(req, res) {
  try {
    await manageDelegatesService.hardDeleteRankRow(req.params.id);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to delete rank history row');
  }
}

// POST /dashboard/delegate-state-history - backfills a past state stint.
async function createStateRow(req, res) {
  try {
    const { peopleId, wcaId, state, startDate, endDate } = req.body ?? {};
    const row = await manageDelegatesService.createStateRow({
      person: { peopleId, wcaId },
      state,
      startDate,
      endDate,
      actorId: req.user.id,
    });
    res.status(201).json(row);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to create state history row');
  }
}

// PUT /dashboard/delegate-state-history/:id - corrects a state-history row's dates.
async function updateStateRow(req, res) {
  try {
    const { state, startDate, endDate } = req.body ?? {};
    const row = await manageDelegatesService.updateStateRow(req.params.id, {
      state,
      startDate,
      endDate,
      actorId: req.user.id,
    });
    res.json(row);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update state history row');
  }
}

// DELETE /dashboard/delegate-state-history/:id - Admin-only, irreversible.
async function hardDeleteStateRow(req, res) {
  try {
    await manageDelegatesService.hardDeleteStateRow(req.params.id);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to delete state history row');
  }
}

module.exports = {
  listPublicDelegates,
  listForDashboard,
  syncDelegates,
  createRankRow,
  updateRankRow,
  hardDeleteRankRow,
  createStateRow,
  updateStateRow,
  hardDeleteStateRow,
};
