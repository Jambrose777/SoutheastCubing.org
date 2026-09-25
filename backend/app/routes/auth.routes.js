const express = require('express');

const authController = require('../controllers/auth.controller.js');
const { requireAuth } = require('../middleware/session.middleware.js');
const { asyncRoute } = require('../helpers/asyncRoute.helper.js');

// WCA OAuth sign-in/sign-out and the current-session check - the only
// genuinely public routes here are /wca/login and /wca/callback (they exist
// to *establish* a session); /me and /logout act on whatever session (if
// any) the request already carries. /wca/dob/begin is the My Info dob
// step-up flow's start - it's a step-up on an *existing* session, so it
// requires auth unlike the plain sign-in's own start. WCA OAuth apps only
// support a single registered redirect URI, so the dob step-up flow's own
// authorize request also comes back through /wca/callback rather than a
// separate callback route - handleCallback dispatches between the two flows
// based on which one's state cookie is present.
const router = express.Router();

/**
 * @openapi
 * /auth/wca/login:
 *   get:
 *     summary: Start WCA OAuth sign-in - redirects to WCA's consent screen.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: returnTo
 *         schema: { type: string }
 *         description: Same-origin relative path to land back on after sign-in.
 *     responses:
 *       302:
 *         description: Redirect to WCA's OAuth authorize screen.
 *       503:
 *         description: WCA sign-in is not configured.
 */
router.get('/auth/wca/login', asyncRoute(authController.beginSignIn));

/**
 * @openapi
 * /auth/wca/callback:
 *   get:
 *     summary: WCA OAuth callback - completes either sign-in or the dob step-up flow (whichever was in flight) and redirects back to the frontend.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: error
 *         schema: { type: string }
 *         description: Present instead of code/state when the user denied consent.
 *     responses:
 *       302:
 *         description: Redirect back to the frontend, with ?authError=... on failure/denial, ?signedIn=1 on a completed sign-in, or ?dobGranted=1 on a completed dob step-up.
 */
router.get('/auth/wca/callback', asyncRoute(authController.handleCallback));

/**
 * @openapi
 * /auth/wca/dob/begin:
 *   get:
 *     summary: My Info's dob step-up - redirects to WCA's consent screen requesting the union of the sign-in scope plus dob.
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to WCA's OAuth authorize screen.
 *       401:
 *         description: Not signed in.
 *       503:
 *         description: WCA sign-in is not configured.
 */
router.get('/auth/wca/dob/begin', requireAuth, asyncRoute(authController.beginDobStepUp));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the currently signed-in user.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: The signed-in user's display info.
 *       401:
 *         description: Not signed in.
 */
router.get('/auth/me', asyncRoute(authController.getCurrentUser));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Sign out - deletes the session's server-side row and clears the cookie.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Signed out successfully.
 */
router.post('/auth/logout', asyncRoute(authController.signOut));

module.exports = router;
