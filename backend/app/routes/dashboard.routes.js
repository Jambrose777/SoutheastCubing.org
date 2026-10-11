const express = require('express');

const teamsController = require('../controllers/teams.controller.js');
const myInfoController = require('../controllers/myInfo.controller.js');
const photosController = require('../controllers/photos.controller.js');
const peopleController = require('../controllers/people.controller.js');
const delegatesController = require('../controllers/delegates.controller.js');
const competitionsController = require('../controllers/competitions.controller.js');
const {
  requireAnyRole,
  requireAdmin,
  requireCompetitionEditAccess,
} = require('../middleware/roles.middleware.js');
const { requireAuth } = require('../middleware/session.middleware.js');
const { photoUploadMiddleware } = require('../middleware/photoUpload.middleware.js');
const { asyncRoute } = require('../helpers/asyncRoute.helper.js');

// User dashboard endpoints. My Info is auth-only (any signed-in user can see
// their own info); the Manage Teams routes below are gated behind
// Board/Admin access (requireBoardOrAdmin), with hard-delete actions
// additionally requiring Admin specifically (requireAdmin)
const router = express.Router();

// Routes that require Board / Admin access.
const requireBoardOrAdmin = requireAnyRole('isBoard', 'isAdmin');

// Regional Delegate/Admin/Board access.
const requireRegionalDelegateOrAdminOrBoard = requireAnyRole(
  'isRegionalDelegate',
  'isAdmin',
  'isBoard',
);

// Routes that require Regional Delegate/Admin access.
const requireRegionalDelegateOrAdmin = requireAnyRole('isRegionalDelegate', 'isAdmin');

// Routes that require Admin, Board, or any Delegate rank.
const requireDelegateOrAdminOrBoard = requireAnyRole('isDelegate', 'isAdmin', 'isBoard');

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
 * /dashboard/my-info/bio:
 *   put:
 *     summary: Sets the signed-in Delegate's own bio.
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: The refreshed My Info payload.
 *       400:
 *         description: This person is not a Delegate.
 *       401:
 *         description: Not signed in.
 */
router.put('/dashboard/my-info/bio', requireAuth, asyncRoute(myInfoController.updateBio));

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
router.put('/dashboard/my-info/photo/crop', requireAuth, asyncRoute(photosController.updateCrop));

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
 *     summary: Search-as-you-type combobox shared by every "add a person, or add by WCA ID" flow (Manage Teams' Add Member sheet, Manage Delegates' Add/Edit History sheet) - our own people/users data only.
 *     tags: [People]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 */
router.get(
  '/dashboard/people/search',
  requireRegionalDelegateOrAdminOrBoard,
  asyncRoute(peopleController.searchPeople),
);

/**
 * @openapi
 * /dashboard/people/wca-lookup/{wcaId}:
 *   get:
 *     summary: Add-by-WCA-ID fallback - proxies WCA's public GET /api/v0/persons/:wca_id.
 *     tags: [People]
 *     responses:
 *       404:
 *         description: No WCA account with that WCA ID.
 */
router.get(
  '/dashboard/people/wca-lookup/:wcaId',
  requireRegionalDelegateOrAdminOrBoard,
  asyncRoute(peopleController.lookupWcaId),
);

/**
 * @openapi
 * /dashboard/people/resolve:
 *   post:
 *     summary: Resolves a { peopleId } or { wcaId } selection into a display-ready person - used by multi-select comboboxes (e.g. Competition Planner's Delegates/Organizers) that need the resolved person immediately.
 *     tags: [People]
 *     responses:
 *       400:
 *         description: Invalid WCA ID format, or neither peopleId nor wcaId given.
 *       404:
 *         description: Person/WCA ID not found.
 */
router.post(
  '/dashboard/people/resolve',
  requireDelegateOrAdminOrBoard,
  asyncRoute(peopleController.resolvePerson),
);

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

/**
 * @openapi
 * /dashboard/manage-users:
 *   get:
 *     summary: Manage Users dashboard's own full-roster listing - every person, left-joined with their users/delegates/active team membership rows.
 *     tags: [People]
 *     responses:
 *       200:
 *         description: Every person's Manage Users row.
 *       401:
 *         description: Not signed in.
 *       403:
 *         description: Not Board/Admin.
 */
router.get('/dashboard/manage-users', requireBoardOrAdmin, asyncRoute(peopleController.listUsers));

/**
 * @openapi
 * /dashboard/manage-users/{peopleId}/photo/sync:
 *   put:
 *     summary: Admin/Board sets another person's photo sync toggle on their behalf.
 *     tags: [People]
 *     responses:
 *       400:
 *         description: This person doesn't have a managed photo.
 *       403:
 *         description: Not Board/Admin.
 */
router.put(
  '/dashboard/manage-users/:peopleId/photo/sync',
  requireBoardOrAdmin,
  asyncRoute(photosController.setSyncEnabledForPerson),
);

/**
 * @openapi
 * /dashboard/manage-users/{peopleId}/photo/upload:
 *   post:
 *     summary: Admin/Board replaces another person's managed photo with an uploaded file.
 *     tags: [People]
 *     responses:
 *       400:
 *         description: No file uploaded, or this person doesn't have a managed photo.
 *       403:
 *         description: Not Board/Admin.
 */
router.post(
  '/dashboard/manage-users/:peopleId/photo/upload',
  requireBoardOrAdmin,
  photoUploadMiddleware,
  asyncRoute(photosController.uploadPhotoForPerson),
);

/**
 * @openapi
 * /dashboard/manage-users/{peopleId}/photo/crop:
 *   put:
 *     summary: Admin/Board updates another person's managed photo's thumbnail crop.
 *     tags: [People]
 *     responses:
 *       400:
 *         description: This person doesn't have a managed photo.
 *       403:
 *         description: Not Board/Admin.
 */
router.put(
  '/dashboard/manage-users/:peopleId/photo/crop',
  requireBoardOrAdmin,
  asyncRoute(photosController.updateCropForPerson),
);

/**
 * @openapi
 * /dashboard/manage-users/{peopleId}/bio:
 *   put:
 *     summary: Admin/Board sets a Delegate's bio on their behalf.
 *     tags: [People]
 *     responses:
 *       404:
 *         description: This person is not a Delegate.
 *       403:
 *         description: Not Board/Admin.
 */
router.put(
  '/dashboard/manage-users/:peopleId/bio',
  requireBoardOrAdmin,
  asyncRoute(delegatesController.updateBioForPerson),
);

/**
 * @openapi
 * /dashboard/competition-planner/competitions:
 *   get:
 *     summary: Every upcoming competition regardless of status (Potential/Planning/Announced) for the Competition Planner tool.
 *     tags: [Competitions]
 *     responses:
 *       200:
 *         description: Upcoming competitions, each with its derived status, official event ids, unofficial event names and icons, delegates, and organizers.
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

module.exports = router;
