const express = require('express');

const teamsController = require('../controllers/teams.controller.js');
const myInfoController = require('../controllers/myInfo.controller.js');
const photosController = require('../controllers/photos.controller.js');
const { requireAnyRole, requireAdmin } = require('../middleware/roles.middleware.js');
const { requireAuth } = require('../middleware/session.middleware.js');
const { photoUploadMiddleware } = require('../middleware/photoUpload.middleware.js');
const { asyncRoute } = require('../helpers/asyncRoute.helper.js');

// User dashboard endpoints. My Info is auth-only (any signed-in user can see
// their own info); the Manage Teams routes below are gated behind
// Board/Admin access (requireBoardOrAdmin), with hard-delete actions
// additionally requiring Admin specifically (requireAdmin)
const router = express.Router();

// Routes that require Board / Admin access
const requireBoardOrAdmin = requireAnyRole('isBoard', 'isAdmin');

/**
 * @openapi
 * /dashboard/my-info:
 *   get:
 *     summary: The signed-in user's own identity/contact fields plus their current/past roles and memberships.
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: The signed-in user's My Info payload.
 *       401:
 *         description: Not signed in.
 */
router.get('/dashboard/my-info', requireAuth, asyncRoute(myInfoController.getMyInfo));

/**
 * @openapi
 * /dashboard/my-info/photo/sync:
 *   put:
 *     summary: Sets the signed-in user's own sync toggle - enabling re-mirrors from WCA if their avatar has actually changed, disabling freezes the current managed photo in place.
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Sync setting updated (and re-mirrored, if enabling and WCA's avatar changed).
 *       400:
 *         description: This person doesn't have a managed photo.
 *       401:
 *         description: Not signed in.
 */
router.put(
  '/dashboard/my-info/photo/sync',
  requireAuth,
  asyncRoute(photosController.setSyncEnabled),
);

/**
 * @openapi
 * /dashboard/my-info/photo/upload:
 *   post:
 *     summary: Replaces the signed-in user's own managed photo with an uploaded file.
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Uploaded.
 *       400:
 *         description: No file uploaded, or this person doesn't have a managed photo.
 *       401:
 *         description: Not signed in.
 */
router.post(
  '/dashboard/my-info/photo/upload',
  requireAuth,
  photoUploadMiddleware,
  asyncRoute(photosController.uploadPhoto),
);

/**
 * @openapi
 * /dashboard/my-info/photo/crop:
 *   put:
 *     summary: Updates the signed-in user's own managed photo's thumbnail crop.
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Updated.
 *       400:
 *         description: This person doesn't have a managed photo.
 *       401:
 *         description: Not signed in.
 */
router.put(
  '/dashboard/my-info/photo/crop',
  requireAuth,
  asyncRoute(photosController.updateCrop),
);

/**
 * @openapi
 * /dashboard/teams:
 *   get:
 *     summary: List every team (fixed and ordinary), grouped/sorted into the Manage Teams canonical order.
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: Every team with its members and (for ordinary teams) active leader.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Board/Admin.
 *   post:
 *     summary: Create a new ordinary team.
 *     tags: [Teams]
 *     responses:
 *       201:
 *         description: The newly-created team.
 */
router.get('/dashboard/teams', requireBoardOrAdmin, asyncRoute(teamsController.listTeams));
router.post('/dashboard/teams', requireBoardOrAdmin, asyncRoute(teamsController.createTeam));

/**
 * @openapi
 * /dashboard/teams/{teamId}:
 *   put:
 *     summary: Edit a team's name/description/email/hidden flag (name is protected for fixed teams; Admin isn't editable at all).
 *     tags: [Teams]
 *   delete:
 *     summary: Permanently delete an ordinary team and its membership/leadership history - Admin only, irreversible.
 *     tags: [Teams]
 */
router.put('/dashboard/teams/:teamId', requireBoardOrAdmin, asyncRoute(teamsController.updateTeam));
router.delete('/dashboard/teams/:teamId', requireAdmin, asyncRoute(teamsController.hardDeleteTeam));

/**
 * @openapi
 * /dashboard/teams/{teamId}/archive:
 *   post:
 *     summary: Archive an ordinary team - end-dates every active membership/leadership row on it.
 *     tags: [Teams]
 */
router.post(
  '/dashboard/teams/:teamId/archive',
  requireBoardOrAdmin,
  asyncRoute(teamsController.archiveTeam),
);

/**
 * @openapi
 * /dashboard/teams/{teamId}/unarchive:
 *   post:
 *     summary: Unarchive a team - does not restore any previously end-dated rows.
 *     tags: [Teams]
 */
router.post(
  '/dashboard/teams/:teamId/unarchive',
  requireBoardOrAdmin,
  asyncRoute(teamsController.unarchiveTeam),
);

/**
 * @openapi
 * /dashboard/teams/{teamId}/members:
 *   post:
 *     summary: Add a member to a team, by existing peopleId or by wcaId (add-by-WCA-ID fallback).
 *     tags: [Teams]
 */
router.post(
  '/dashboard/teams/:teamId/members',
  requireBoardOrAdmin,
  asyncRoute(teamsController.addMember),
);

/**
 * @openapi
 * /dashboard/team-memberships/{membershipId}:
 *   put:
 *     summary: Edit a membership row's dates/special role/color.
 *     tags: [Teams]
 *   delete:
 *     summary: Permanently delete a membership row - Admin only, irreversible.
 *     tags: [Teams]
 */
router.put(
  '/dashboard/team-memberships/:membershipId',
  requireBoardOrAdmin,
  asyncRoute(teamsController.updateMembership),
);
router.delete(
  '/dashboard/team-memberships/:membershipId',
  requireAdmin,
  asyncRoute(teamsController.hardDeleteMembership),
);

/**
 * @openapi
 * /dashboard/team-memberships/{membershipId}/remove:
 *   post:
 *     summary: Remove a member (soft delete - end-dates the row, also ending any active leadership stint for the same team/person).
 *     tags: [Teams]
 */
router.post(
  '/dashboard/team-memberships/:membershipId/remove',
  requireBoardOrAdmin,
  asyncRoute(teamsController.removeMember),
);

/**
 * @openapi
 * /dashboard/teams/{teamId}/leader:
 *   post:
 *     summary: Set a team's Leader (end-dates the prior leader, if any, and auto-suggests a color).
 *     tags: [Teams]
 *   delete:
 *     summary: Remove a team's active Leader, leaving it at zero leaders.
 *     tags: [Teams]
 */
router.post(
  '/dashboard/teams/:teamId/leader',
  requireBoardOrAdmin,
  asyncRoute(teamsController.setLeader),
);
router.delete(
  '/dashboard/teams/:teamId/leader',
  requireBoardOrAdmin,
  asyncRoute(teamsController.removeLeader),
);

/**
 * @openapi
 * /dashboard/team-leaders/{leaderId}:
 *   put:
 *     summary: Correct a leadership stint's start/end dates.
 *     tags: [Teams]
 *   delete:
 *     summary: Permanently delete a leadership row - Admin only, irreversible.
 *     tags: [Teams]
 */
router.put(
  '/dashboard/team-leaders/:leaderId',
  requireBoardOrAdmin,
  asyncRoute(teamsController.updateLeadershipStint),
);
router.delete(
  '/dashboard/team-leaders/:leaderId',
  requireAdmin,
  asyncRoute(teamsController.hardDeleteLeadershipRow),
);

/**
 * @openapi
 * /dashboard/people/search:
 *   get:
 *     summary: Search-as-you-type combobox for the Add/Edit Member sheet - our own people/users data only.
 *     tags: [Teams]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 */
router.get(
  '/dashboard/people/search',
  requireBoardOrAdmin,
  asyncRoute(teamsController.searchPeople),
);

/**
 * @openapi
 * /dashboard/people/wca-lookup/{wcaId}:
 *   get:
 *     summary: Add-by-WCA-ID fallback - proxies WCA's public GET /api/v0/persons/:wca_id.
 *     tags: [Teams]
 *     responses:
 *       404:
 *         description: No WCA account with that WCA ID.
 */
router.get(
  '/dashboard/people/wca-lookup/:wcaId',
  requireBoardOrAdmin,
  asyncRoute(teamsController.lookupWcaId),
);

module.exports = router;
