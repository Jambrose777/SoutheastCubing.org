const express = require("express");

const competitionsController = require("../../controllers/competitions.controller.js");
const {
  requireAnyRole,
  requireCompetitionEditAccess,
} = require("../../middleware/roles.middleware.js");
const { asyncRoute } = require("../../helpers/asyncRoute.helper.js");

const router = express.Router();
const requireRegionalDelegateOrAdminOrBoard = requireAnyRole(
  "isRegionalDelegate",
  "isAdmin",
  "isBoard",
);
const requireDelegateOrAdminOrBoard = requireAnyRole("isDelegate", "isAdmin", "isBoard");

/**
 * @openapi
 * /dashboard/competition-planner/competitions:
 *   get:
 *     summary: Competitions in a date scope regardless of status (Potential/Planning/Announced) for the Competition Planner tool.
 *     tags: [Competitions]
 *     parameters:
 *       - in: query
 *         name: view
 *         required: false
 *         schema:
 *           type: string
 *           enum: [upcoming, past]
 *           default: upcoming
 *     responses:
 *       200:
 *         description: Competitions in the requested date scope, each with its derived status, official event ids, unofficial event names and icons, delegates, and organizers.
 *       400:
 *         description: Invalid view parameter.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Admin/Board/Delegate.
 */
router.get(
  '/dashboard/competition-planner/competitions',
  requireDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.getPlannerCompetitions),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions/refresh:
 *   post:
 *     summary: Refresh upcoming competition data from WCA.
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: Competitions refreshed, with the last successful refresh timestamp.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Admin/Board/Delegate or required WCA access is missing.
 *       409:
 *         description: Another bulk refresh is running or the global cooldown is active.
 */
router.post(
  '/dashboard/competition-planner/competitions/refresh',
  requireDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.refreshPlannerCompetitions),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions/{competitionId}/refresh:
 *   post:
 *     summary: Refresh one WCA-linked Planner competition.
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: The refreshed Planner competition.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not authorized to refresh this competition or WCA access is missing.
 *       404:
 *         description: WCA-linked competition not found.
 */
router.post(
  '/dashboard/competition-planner/competitions/:competitionId/refresh',
  requireDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.refreshPlannerCompetition),
);

/**
 * @openapi
 * /dashboard/competition-planner/unannounced-competitions:
 *   get:
 *     summary: Lists the signed-in user's eligible managed WCA competitions that are not linked in Planner or permanently dismissed.
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: Eligible WCA competitions for Planner banners.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Admin/Board/Delegate.
 */
router.get(
  '/dashboard/competition-planner/unannounced-competitions',
  requireDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.getPlannerUnannouncedCompetitionBanners),
);

/**
 * @openapi
 * /dashboard/competition-planner/wca-link-options:
 *   get:
 *     summary: Lists the signed-in user's eligible managed WCA competitions available for standalone linking.
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: Eligible WCA competition link options.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Admin/Board/Delegate.
 */
router.get(
  '/dashboard/competition-planner/wca-link-options',
  requireDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.getPlannerWcaLinkOptions),
);

/**
 * @openapi
 * /dashboard/competition-planner/unannounced-competitions/{wcaCompetitionId}/dismiss:
 *   post:
 *     summary: Permanently dismisses a WCA competition banner for the signed-in user.
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: Dismissed.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Admin/Board/Delegate.
 */
router.post(
  '/dashboard/competition-planner/unannounced-competitions/:wcaCompetitionId/dismiss',
  requireDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.dismissPlannerUnannouncedCompetition),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions/link-wca:
 *   post:
 *     summary: Links a managed WCA competition to an existing Potential row or creates a linked Planner row.
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: The linked Planner competition.
 *       400:
 *         description: The WCA competition or target Planner row is not eligible to link.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Admin/Board/Delegate or manage_competitions access is missing.
 *       404:
 *         description: Planner competition not found.
 *       409:
 *         description: Planner competition has already been linked.
 */
router.post(
  '/dashboard/competition-planner/competitions/link-wca',
  requireDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.linkPlannerCompetitionToWca),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions/create-multi-city:
 *   post:
 *     summary: Creates linked Planner rows for the supplied locations of a managed multi-city WCA competition.
 *     tags: [Competitions]
 *     responses:
 *       201:
 *         description: The newly-created multi-city location rows.
 *       400:
 *         description: The WCA competition or location details are invalid.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Admin/Board/Delegate or manage_competitions access is missing.
 *       503:
 *         description: WCA Drive is not configured or available when folder creation or linking was requested.
 */
router.post(
  '/dashboard/competition-planner/competitions/create-multi-city',
  requireDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.createMultiCityPlannerCompetitionFromWca),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions:
 *   post:
 *     summary: Creates a new Planner competition (always Potential) - open to any Admin/Board/Delegate, since creating one makes them its lead Delegate.
 *     tags: [Competitions]
 *     responses:
 *       201:
 *         description: The newly-created competition.
 *       400:
 *         description: Missing/invalid fields.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Admin/Board/Delegate.
 *       503:
 *         description: WCA Drive is not configured or available when folder creation or linking was requested.
 */
router.post(
  '/dashboard/competition-planner/competitions',
  requireDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.createPlannerCompetition),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions/major:
 *   post:
 *     summary: Creates a manual major competition.
 *     tags: [Competitions]
 *     responses:
 *       201:
 *         description: The newly-created major competition.
 *       400:
 *         description: Missing or invalid fields.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Admin/Board/Regional Delegate.
 */
router.post(
  '/dashboard/competition-planner/competitions/major',
  requireRegionalDelegateOrAdminOrBoard,
  asyncRoute(competitionsController.createPlannerMajorCompetition),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions/{competitionId}/wca-drive-folder:
 *   post:
 *     summary: Creates and links a WCA Drive folder for a Planner competition.
 *     tags: [Competitions]
 *     responses:
 *       201:
 *         description: The created folder link.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not authorized to edit this competition.
 *       404:
 *         description: Competition not found.
 *       409:
 *         description: Competition already has a WCA Drive folder.
 *       503:
 *         description: WCA Drive is not configured or available.
 */
router.post(
  '/dashboard/competition-planner/competitions/:competitionId/wca-drive-folder',
  requireDelegateOrAdminOrBoard,
  requireCompetitionEditAccess,
  asyncRoute(competitionsController.createPlannerWcaDriveFolder),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions/{competitionId}:
 *   put:
 *     summary: Edits a Planner competition - Admin/Board/Regional Delegate, or a Delegate already assigned to it, regardless of announced status.
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: The updated competition.
 *       400:
 *         description: Missing/invalid fields.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not authorized to edit this competition.
 *       404:
 *         description: Competition not found.
 *       503:
 *         description: WCA Drive is not configured or available when a folder link was requested.
 *   delete:
 *     summary: Deletes a Planner competition - same access as editing it, and only while Potential/Planning (never once Announced).
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: Deleted.
 *       400:
 *         description: This competition is Announced and can never be deleted.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not authorized to edit this competition.
 *       404:
 *         description: Competition not found.
 */
router.put(
  '/dashboard/competition-planner/competitions/:competitionId',
  requireDelegateOrAdminOrBoard,
  requireCompetitionEditAccess,
  asyncRoute(competitionsController.updatePlannerCompetition),
);

router.delete(
  '/dashboard/competition-planner/competitions/:competitionId',
  requireDelegateOrAdminOrBoard,
  requireCompetitionEditAccess,
  asyncRoute(competitionsController.deletePlannerCompetition),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions/{competitionId}/wca-link:
 *   delete:
 *     summary: Unlinks a Planning competition from WCA without changing its other data.
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: Unlinked.
 *       400:
 *         description: The competition is not Planning.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not authorized to unlink this competition.
 *       404:
 *         description: Competition not found.
 */
router.delete(
  '/dashboard/competition-planner/competitions/:competitionId/wca-link',
  requireCompetitionEditAccess,
  asyncRoute(competitionsController.unlinkPlannerCompetitionFromWca),
);

module.exports = router;
