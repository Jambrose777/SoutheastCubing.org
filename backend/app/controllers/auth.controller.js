const crypto = require('crypto');
const { config } = require('../config/config.js');
const authService = require('../services/auth.service.js');
const sessionsDb = require('../database/sessions.database.js');
const { getCurrentRoles } = require('../helpers/roles.helper.js');
const devImpersonation = require('../helpers/devImpersonation.helper.js');
const { resolvePersonPicture } = require('../helpers/personPicture.helper.js');
const { getPendingItems } = require('../helpers/pendingItems.helper.js');

const logger = require('../utils/logger.util.js');

// Cookies used only to carry state across the brief redirect round-trip to
// WCA and back - separate from the long-lived session cookie itself.
const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_RETURN_TO_COOKIE = 'oauth_return_to';
const OAUTH_COOKIE_PATH = '/auth/wca';
const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes - the OAuth round-trip is quick

// Separate state cookie for the dob step-up flow, so it can never be
// confused with (or clobber) an in-flight plain sign-in round-trip.
const DOB_STEP_UP_STATE_COOKIE = 'oauth_dob_state';

// Dev-only "login as" preset, The picked preset can't be applied until
// a real session exists (it's applied to that session's id), so it has
// to survive the trip out to WCA's consent screen.
const DEV_IMPERSONATE_COOKIE = 'dev_impersonate_role';

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

  // Dev-only role-picker preset - silently ignored whenever the
  // feature is disabled or the preset key isn't recognized.
  if (devImpersonation.isEnabled() && devImpersonation.isValidPreset(req.query.impersonate)) {
    res.cookie(DEV_IMPERSONATE_COOKIE, req.query.impersonate, shortLivedCookieOptions());
  }

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

// Redirects the browser into WCA's own OAuth consent screen requesting the
// dob step-up scope (public email dob). Requires an existing session.
function beginDobStepUp(req, res) {
  if (!authService.isOAuthConfigured()) {
    res.status(503).json({ message: 'WCA sign-in is not configured.' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ message: 'Sign-in required.' });
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(DOB_STEP_UP_STATE_COOKIE, state, shortLivedCookieOptions());
  res.redirect(authService.buildAuthorizeUrl({ state, scope: authService.DOB_STEP_UP_SCOPE }));
}

// WCA OAuth apps are registered with a single fixed redirect URI, so the dob
// step-up flow's authorize request comes back to this same /auth/wca/callback.
// Whichever flow's own state cookie is actually present on the request is the
// one that was in flight - that's what decides which completion path below runs.
async function handleDobStepUpCallback(req, res, cookieState) {
  const myInfoUrl = new URL('/dashboard/my-info', config.FRONTEND_URL);

  if (req.query.error) {
    logger.info(`Dob step-up denied on the consent screen: ${req.query.error}`);
    myInfoUrl.searchParams.set('authError', 'denied');
    res.redirect(myInfoUrl.toString());
    return;
  }

  if (!req.user) {
    logger.warn('Dob step-up callback reached with no active session.');
    myInfoUrl.searchParams.set('authError', 'failed');
    res.redirect(myInfoUrl.toString());
    return;
  }

  if (!req.query.code || !req.query.state || req.query.state !== cookieState) {
    logger.warn('Dob step-up callback missing/mismatched code or state.');
    myInfoUrl.searchParams.set('authError', 'failed');
    res.redirect(myInfoUrl.toString());
    return;
  }

  try {
    await authService.completeDobStepUp({ code: req.query.code, peopleId: req.user.people_id });
    myInfoUrl.searchParams.set('dobGranted', '1');
    res.redirect(myInfoUrl.toString());
  } catch (err) {
    logger.error('Dob step-up callback failed to complete: ', err);
    myInfoUrl.searchParams.set('authError', 'failed');
    res.redirect(myInfoUrl.toString());
  }
}

// Handles WCA's redirect back after the consent screen - a deny, a state
// mismatch, and a genuine success are each routed back to the frontend at
// `returnTo`, differing only in whether an authError flag is appended.
// Dispatches to the dob step-up's own completion path first, since both
// flows land here (see handleDobStepUpCallback above).
async function handleCallback(req, res) {
  const dobStepUpState = req.cookies?.[DOB_STEP_UP_STATE_COOKIE];
  if (dobStepUpState) {
    res.clearCookie(DOB_STEP_UP_STATE_COOKIE, { path: OAUTH_COOKIE_PATH });
    await handleDobStepUpCallback(req, res, dobStepUpState);
    return;
  }

  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
  const returnTo = authService.sanitizeReturnPath(req.cookies?.[OAUTH_RETURN_TO_COOKIE]);
  const impersonatePreset = req.cookies?.[DEV_IMPERSONATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_COOKIE_PATH });
  res.clearCookie(OAUTH_RETURN_TO_COOKIE, { path: OAUTH_COOKIE_PATH });
  res.clearCookie(DEV_IMPERSONATE_COOKIE, { path: OAUTH_COOKIE_PATH });

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
    const { rawToken, sessionId } = await authService.completeSignIn({
      code: req.query.code,
      ipAddress: req.ip,
    });

    // Applied only after the real session actually exists. Checks enabled and valid
    devImpersonation.setImpersonation(sessionId, impersonatePreset);

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

// Dev-only role-impersonation runtime config check.
function getDevImpersonationConfig(req, res) {
  res.json({
    enabled: devImpersonation.isEnabled(),
    presets: devImpersonation.isEnabled() ? Object.keys(devImpersonation.PRESETS) : [],
  });
}

// Returns the currently signed-in user (from req.user, set by
// session.middleware.js), or 401 if there isn't one. Also resolves their
// current Admin/Board access (roles.helper.js's shared role-check helper) so
// the frontend can gate nav links without a second round-trip. As well as
// any open notification-badge "pending items" (pendingItems.helper.js)
async function getCurrentUser(req, res) {
  if (!req.user) {
    res.status(401).json({ message: 'Not signed in.' });
    return;
  }
  const [{ isAdmin, isBoard }, pendingItems] = await Promise.all([
    getCurrentRoles(req.user.people_id, req.user.sessionId),
    getPendingItems(req.user),
  ]);

  // Only spread in impersonatedRole when it's actually set - never send the
  // key at all (not even as a null value) outside local dev, so a
  // production response's shape carries no trace of this feature ever
  // existing. Object spread with a falsy condition contributes no keys at
  // all, unlike setting the field to `null` explicitly.
  const impersonatedRolePresetKey = devImpersonation.getImpersonationPresetKey(req.user.sessionId);

  res.json({
    name: req.user.name,
    ...resolvePersonPicture(req.user),
    wcaId: req.user.wca_id,
    roles: { isAdmin, isBoard },
    ...(impersonatedRolePresetKey ? { impersonatedRole: impersonatedRolePresetKey } : {}),
    pendingItems,
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

module.exports = {
  beginSignIn,
  handleCallback,
  beginDobStepUp,
  getDevImpersonationConfig,
  getCurrentUser,
  signOut,
};
