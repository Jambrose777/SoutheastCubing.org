const express = require('express');

const healthController = require('../controllers/health.controller.js');
const emailController = require('../controllers/email.controller.js');
const competitionsController = require('../controllers/competitions.controller.js');
const teamsController = require('../controllers/teams.controller.js');
const delegatesController = require('../controllers/delegates.controller.js');
const photosController = require('../controllers/photos.controller.js');
const { emailLimiter } = require('../middleware/rateLimit.middleware.js');
const { asyncRoute } = require('../helpers/asyncRoute.helper.js');

// Public, unauthenticated routes.
const router = express.Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Check backend and DSQL health.
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: check
 *         schema: { type: string }
 *         description: Comma-separated checks to run (backend,dsql); omitted runs both.
 *     responses:
 *       200:
 *         description: All selected checks are healthy.
 *       400:
 *         description: The check parameter is empty or contains an unsupported check.
 *       503:
 *         description: One or more selected checks are unhealthy.
 */
router.get('/health', asyncRoute(healthController.getInternalHealth));

/**
 * @openapi
 * /health/external:
 *   get:
 *     summary: Check external integration health.
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: check
 *         schema: { type: string }
 *         description: Comma-separated checks to run (wca,contentful,drive,email); omitted runs all.
 *     responses:
 *       200:
 *         description: All selected checks are healthy.
 *       400:
 *         description: The check parameter is empty or contains an unsupported check.
 *       503:
 *         description: One or more selected checks are unhealthy.
 */
router.get('/health/external', asyncRoute(healthController.getExternalHealth));

/**
 * @openapi
 * /email:
 *   post:
 *     summary: Send a contact-form email.
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, subject, text, emailType]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               subject: { type: string }
 *               text: { type: string }
 *               emailType: { type: string, enum: [clubs, pastCompetition, getInvolved, socialMedia, software, general, organizing] }
 *     responses:
 *       200:
 *         description: Email sent successfully.
 *       400:
 *         description: Missing/invalid required field(s).
 *       429:
 *         description: Rate limit exceeded.
 *       500:
 *         description: Internal server error.
 *       503:
 *         description: Email sending is not configured.
 */
router.post('/email', emailLimiter, asyncRoute(emailController.sendEmail));

/**
 * @openapi
 * /competitions:
 *   get:
 *     summary: Get the list of cached upcoming competitions.
 *     tags: [Competitions]
 *     parameters:
 *       - in: header
 *         name: If-None-Match
 *         schema: { type: string }
 *         description: Prior ETag - returns 304 if the underlying data hasn't changed.
 *     responses:
 *       200:
 *         description: Upcoming competitions.
 *       304:
 *         description: Not modified (client's cached copy is still fresh).
 *       503:
 *         description: Competition data is temporarily unavailable.
 */
router.get('/competitions', asyncRoute(competitionsController.getCompetitions));

/**
 * @openapi
 * /teams:
 *   get:
 *     summary: Get the public "Who We Are" team/board listing.
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: Teams with their current members, in display order.
 */
router.get('/teams', asyncRoute(teamsController.listPublicTeams));

/**
 * @openapi
 * /delegates:
 *   get:
 *     summary: Get the public Delegate roster listing.
 *     tags: [Delegates]
 *     responses:
 *       200:
 *         description: Every current Delegate, in display order (Delegate Type, then promotion date, then name).
 */
router.get('/delegates', asyncRoute(delegatesController.listPublicDelegates));

/**
 * @openapi
 * /photos/s3/{key}:
 *   get:
 *     summary: Redirect to a presigned S3 URL for a managed photo.
 *     tags: [Photos]
 *     description: >
 *       Interim route used only while the S3-backed photo storage
 *       implementation is active and no CloudFront behavior is in front of
 *       the bucket yet. This is the URL photoStorage.integration.js's
 *       resolveUrl() returns for S3-stored photos.
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirects to a short-lived presigned S3 GET URL.
 *       500:
 *         description: Failed to generate a presigned URL.
 */
router.get('/photos/s3/:key', asyncRoute(photosController.redirectToS3Photo));

/**
 * @openapi
 * /:
 *   get:
 *     summary: Health check.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: The API is up and running.
 */
router.get(
  '/',
  asyncRoute((req, res) => res.send({ status: 'healthy' })),
);

module.exports = router;
