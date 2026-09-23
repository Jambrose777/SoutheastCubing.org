const express = require('express');

const authController = require('../controllers/auth.controller.js');
const { asyncRoute } = require('../helpers/asyncRoute.helper.js');

// WCA OAuth sign-in/sign-out and the current-session check - the only
// genuinely public routes here are /wca/login and /wca/callback (they exist
// to *establish* a session); /me and /logout act on whatever session (if
// any) the request already carries.
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
 *     summary: WCA OAuth callback - completes sign-in and redirects back to the frontend.
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
 *         description: Redirect back to the frontend, with ?authError=... on failure/denial.
 */
router.get('/auth/wca/callback', asyncRoute(authController.handleCallback));

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
