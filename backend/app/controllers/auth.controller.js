const crypto = require('crypto');
const { config } = require('../config/config.js');
const authService = require('../services/auth.service.js');
const sessionsDb = require('../database/sessions.database.js');
const { getCurrentRoles } = require('../helpers/roles.helper.js');

const logger = require('../utils/logger.util.js');

// Cookies used only to carry state across the brief redirect round-trip to
// WCA and back - separate from the long-lived session cookie itself.
const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_RETURN_TO_COOKIE = 'oauth_return_to';
const OAUTH_COOKIE_PATH = '/auth/wca';
const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes - the OAuth round-trip is quick

function shortLivedCookieOptions() {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
  };
}

// Redirects the browser into WCA's own OAuth consent screen. `returnTo`
// (the page/action to land back on after auth) and a CSRF-guarding random
// `state` value are stashed in short-lived cookies rather than trusted
// straight off the eventual callback's query string.
function beginSignIn(req, res) {
  if (!authService.isOAuthConfigured()) {
    res.status(503).json({ message: 'WCA sign-in is not configured.' });
    return;
  }

  const returnTo = authService.sanitizeReturnPath(req.query.returnTo);
  const state = crypto.randomBytes(16).toString('hex');

  res.cookie(OAUTH_STATE_COOKIE, state, shortLivedCookieOptions());
  res.cookie(OAUTH_RETURN_TO_COOKIE, returnTo, shortLivedCookieOptions());
  res.redirect(authService.buildAuthorizeUrl({ state }));
}

// Builds the frontend redirect target once the callback is done - either
// flagging an error for the shared error banner, or flagging a genuine
// success for a lightweight "signed in" toast.
function frontendRedirectUrl(returnTo, { authError, signedIn } = {}) {
  const url = new URL(returnTo, config.FRONTEND_URL);
  if (authError) {
    url.searchParams.set('authError', authError);
  }
  if (signedIn) {
    url.searchParams.set('signedIn', '1');
  }
  return url.toString();
}

// Handles WCA's redirect back after the consent screen - a deny, a state
// mismatch, and a genuine success are each routed back to the frontend at
// `returnTo`, differing only in whether an authError flag is appended.
async function handleCallback(req, res) {
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
  const returnTo = authService.sanitizeReturnPath(req.cookies?.[OAUTH_RETURN_TO_COOKIE]);
  res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_COOKIE_PATH });
  res.clearCookie(OAUTH_RETURN_TO_COOKIE, { path: OAUTH_COOKIE_PATH });

  // A deny on WCA's consent screen redirects back with error=access_denied
  // instead of a code - no local rows/session are created for this case.
  if (req.query.error) {
    logger.info(`WCA sign-in denied on the consent screen: ${req.query.error}`);
    res.redirect(frontendRedirectUrl(returnTo, { authError: 'denied' }));
    return;
  }

  if (!req.query.code || !req.query.state || req.query.state !== cookieState) {
    logger.warn('WCA sign-in callback missing/mismatched code or state.');
    res.redirect(frontendRedirectUrl(returnTo, { authError: 'failed' }));
    return;
  }

  try {
    const { rawToken } = await authService.completeSignIn({
      code: req.query.code,
      ipAddress: req.ip,
    });
    res.cookie(authService.SESSION_COOKIE_NAME, rawToken, {
      ...authService.sessionCookieOptions(),
      maxAge: authService.SESSION_TTL_MS,
    });
    res.redirect(frontendRedirectUrl(returnTo, { signedIn: true }));
  } catch (err) {
    logger.error('WCA sign-in callback failed to complete: ', err);
    res.redirect(frontendRedirectUrl(returnTo, { authError: 'failed' }));
  }
}

// Returns the currently signed-in user (from req.user, set by
// session.middleware.js), or 401 if there isn't one. Also resolves their
// current Admin/Board access (roles.helper.js's shared role-check helper) so
// the frontend can gate nav links (e.g. Manage Teams) without a second
// round-trip.
async function getCurrentUser(req, res) {
  if (!req.user) {
    res.status(401).json({ message: 'Not signed in.' });
    return;
  }
  const { isAdmin, isBoard } = await getCurrentRoles(req.user.people_id);
  res.json({
    name: req.user.name,
    pictureUrl: req.user.picture_url,
    wcaId: req.user.wca_id,
    roles: { isAdmin, isBoard },
  });
}

// Deletes the session's server-side row outright (immediate revocation),
// then clears the cookie - sign-out is a real revocation, not just hiding
// the cookie while a still-valid row lives on.
async function signOut(req, res) {
  const rawToken = req.cookies?.[authService.SESSION_COOKIE_NAME];
  if (rawToken) {
    await sessionsDb.deleteSession(rawToken);
  }
  res.clearCookie(authService.SESSION_COOKIE_NAME, authService.sessionCookieOptions());
  res.json({ status: 'success' });
}

module.exports = { beginSignIn, handleCallback, getCurrentUser, signOut };
