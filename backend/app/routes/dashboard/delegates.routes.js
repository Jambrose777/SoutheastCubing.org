const express = require("express");

const delegatesController = require("../../controllers/delegates.controller.js");
const { requireAnyRole, requireAdmin } = require("../../middleware/roles.middleware.js");
const { asyncRoute } = require("../../helpers/asyncRoute.helper.js");

const router = express.Router();
const requireRegionalDelegateOrAdminOrBoard = requireAnyRole(
  "isRegionalDelegate",
  "isAdmin",
  "isBoard",
);
const requireRegionalDelegateOrAdmin = requireAnyRole("isRegionalDelegate", "isAdmin");

/**
 * @openapi
 * /dashboard/delegates/sync:
 *   post:
 *     summary: Manually triggers the same nightly WCA Delegate roster sync, on demand.
 *     tags: [Delegates]
 *     responses:
 *       200:
 *         description: Sync completed - a structured summary of what changed (promotions, demotions, rank/state changes, Regional/Senior stints).
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Regional Delegate/Admin/Board.
 *       502:
 *         description: Sync failed (e.g. WCA returned no Southeast Delegates) - see the response body's errors array.
 */
router.post(
  '/dashboard/delegates/sync',
  requireRegionalDelegateOrAdminOrBoard,
  asyncRoute(delegatesController.syncDelegates),
);

/**
 * @openapi
 * /dashboard/delegates:
 *   get:
 *     summary: Manage Delegates dashboard's own full-roster listing (every Delegate's current standing, plus every rank/state history row, current and past).
 *     tags: [Delegates]
 *     responses:
 *       200:
 *         description: '{ current: [...], history: [...] }'
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Regional Delegate/Admin/Board.
 */
router.get(
  '/dashboard/delegates',
  requireRegionalDelegateOrAdminOrBoard,
  asyncRoute(delegatesController.listForDashboard),
);

/**
 * @openapi
 * /dashboard/delegate-rank-history:
 *   post:
 *     summary: Backfills a past rank stint (Regional Delegate/Admin only) - creates the person/delegate row too if needed. End date is required.
 *     tags: [Delegates]
 *     responses:
 *       201:
 *         description: The newly-created rank history row.
 *       400:
 *         description: Missing/invalid field.
 *       403:
 *         description: Not Regional Delegate/Admin.
 */
router.post(
  '/dashboard/delegate-rank-history',
  requireRegionalDelegateOrAdmin,
  asyncRoute(delegatesController.createRankRow),
);

/**
 * @openapi
 * /dashboard/delegate-rank-history/{id}:
 *   put:
 *     summary: Corrects a rank history row's dates (and, once closed, its rank) - Regional Delegate/Admin only. A currently-open row can only have its start date changed.
 *     tags: [Delegates]
 *   delete:
 *     summary: Permanently deletes a rank history row - Admin only, irreversible.
 *     tags: [Delegates]
 */
router.put(
  '/dashboard/delegate-rank-history/:id',
  requireRegionalDelegateOrAdmin,
  asyncRoute(delegatesController.updateRankRow),
);

router.delete(
  '/dashboard/delegate-rank-history/:id',
  requireAdmin,
  asyncRoute(delegatesController.hardDeleteRankRow),
);

/**
 * @openapi
 * /dashboard/delegate-state-history:
 *   post:
 *     summary: Backfills a past state stint (Regional Delegate/Admin only) - creates the person/delegate row too if needed. End date is required.
 *     tags: [Delegates]
 */
router.post(
  '/dashboard/delegate-state-history',
  requireRegionalDelegateOrAdmin,
  asyncRoute(delegatesController.createStateRow),
);

/**
 * @openapi
 * /dashboard/delegate-state-history/{id}:
 *   put:
 *     summary: Corrects a state history row's dates (and, once closed, its state) - Regional Delegate/Admin only. A currently-open row can only have its start date changed.
 *     tags: [Delegates]
 *   delete:
 *     summary: Permanently deletes a state history row - Admin only, irreversible.
 *     tags: [Delegates]
 */
router.put(
  '/dashboard/delegate-state-history/:id',
  requireRegionalDelegateOrAdmin,
  asyncRoute(delegatesController.updateStateRow),
);

router.delete(
  '/dashboard/delegate-state-history/:id',
  requireAdmin,
  asyncRoute(delegatesController.hardDeleteStateRow),
);

module.exports = router;
