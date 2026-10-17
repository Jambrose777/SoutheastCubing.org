const express = require("express");

const photosController = require("../../controllers/photos.controller.js");
const peopleController = require("../../controllers/people.controller.js");
const delegatesController = require("../../controllers/delegates.controller.js");
const { requireAnyRole } = require("../../middleware/roles.middleware.js");
const { photoUploadMiddleware } = require("../../middleware/photoUpload.middleware.js");
const { asyncRoute } = require("../../helpers/asyncRoute.helper.js");

const router = express.Router();
const requireBoardOrAdmin = requireAnyRole("isBoard", "isAdmin");
const requireRegionalDelegateOrAdminOrBoard = requireAnyRole(
  "isRegionalDelegate",
  "isAdmin",
  "isBoard",
);
const requireDelegateOrAdminOrBoard = requireAnyRole("isDelegate", "isAdmin", "isBoard");

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
 * /dashboard/manage-users/{peopleId}/discord-user-id:
 *   put:
 *     summary: Admin/Board sets a Delegate's Discord user ID on their behalf.
 *     tags: [People]
 *     responses:
 *       400:
 *         description: Invalid Discord user ID.
 *       403:
 *         description: Not Board/Admin.
 *       404:
 *         description: This person is not a Delegate.
 */
router.put(
  '/dashboard/manage-users/:peopleId/discord-user-id',
  requireBoardOrAdmin,
  asyncRoute(delegatesController.updateDiscordUserIdForPerson),
);

module.exports = router;
