const express = require("express");

const myInfoController = require("../../controllers/myInfo.controller.js");
const photosController = require("../../controllers/photos.controller.js");
const { requireAuth } = require("../../middleware/session.middleware.js");
const { photoUploadMiddleware } = require("../../middleware/photoUpload.middleware.js");
const { asyncRoute } = require("../../helpers/asyncRoute.helper.js");

const router = express.Router();

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

module.exports = router;
