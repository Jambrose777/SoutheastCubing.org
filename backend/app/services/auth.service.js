const { config } = require('../config/config.js');
const wcaIntegration = require('../integrations/wca.integration.js');
const peopleDb = require('../database/people.database.js');
const usersDb = require('../database/users.database.js');
const sessionsDb = require('../database/sessions.database.js');
const { generateSessionToken } = require('../helpers/session.helper.js');

const logger = require('../utils/logger.util.js');

const WCA_AUTHORIZE_URL = 'https://www.worldcubeassociation.org/oauth/authorize';

// Only scope requested at sign-in - incremental scopes (dob, manage_competitions)
// are separate, feature-specific token requests made on demand by whichever
// feature needs them.
const SIGN_IN_SCOPE = 'public email';

// True once every env var the WCA sign-in flow needs is present - callers
// respond 503 rather than attempting the flow with a partially-configured
// OAuth app.
function isOAuthConfigured() {
  return !!(
    config.WCA_OAUTH_CLIENT_ID &&
    config.WCA_OAUTH_CLIENT_SECRET &&
    config.WCA_OAUTH_REDIRECT_URI &&
    config.FRONTEND_URL
  );
}

// Only a same-origin relative path is ever safe to redirect back to - guards
// against an open-redirect via a crafted returnTo query param.
function sanitizeReturnPath(returnTo) {
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/';
  }
  return returnTo;
}

// Builds the URL to redirect the browser to for WCA's own consent screen.
function buildAuthorizeUrl({ state }) {
  const params = new URLSearchParams({
    client_id: config.WCA_OAUTH_CLIENT_ID,
    redirect_uri: config.WCA_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: SIGN_IN_SCOPE,
    state,
  });
  return `${WCA_AUTHORIZE_URL}?${params.toString()}`;
}

// Completes the OAuth handshake for a successful (non-denied) callback.
async function completeSignIn({ code, ipAddress }) {
  // Exchange the authorization code for an access token.
  const accessToken = await wcaIntegration.exchangeAuthorizationCodeForToken({
    code,
    clientId: config.WCA_OAUTH_CLIENT_ID,
    clientSecret: config.WCA_OAUTH_CLIENT_SECRET,
    redirectUri: config.WCA_OAUTH_REDIRECT_URI,
  });

  // Fetch the user's WCA profile using the access token.
  const profile = await wcaIntegration.fetchWcaProfile(accessToken);

  // Upsert the local person record based on the WCA profile.
  const person = await peopleDb.upsertPersonFromWcaProfile({
    wcaId: profile.wca_id ?? null,
    wcaUserId: String(profile.id),
    name: profile.name,
    pictureUrl: profile.avatar?.url ?? null,
  });

  // Upsert the local user record associated with the person.
  const user = await usersDb.upsertUserForPerson({
    peopleId: person.id,
    email: profile.email ?? null,
  });

  // Create a new first-party session for the user.
  const rawToken = generateSessionToken();
  await sessionsDb.createSession({ rawToken, userId: user.id, ipAddress });

  logger.info(`Completed WCA sign-in for people_id ${person.id}.`);
  return { rawToken, person, user };
}

// Cookie options shared by both setting the cookie (on sign-in) and clearing
// it (on sign-out), so they can't drift out of sync with each other.
function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: config.SESSION_COOKIE_DOMAIN || undefined,
    path: '/',
  };
}

module.exports = {
  SESSION_COOKIE_NAME: 'se_session',
  SESSION_TTL_MS: sessionsDb.SESSION_TTL_MS,
  isOAuthConfigured,
  sanitizeReturnPath,
  buildAuthorizeUrl,
  completeSignIn,
  sessionCookieOptions,
};
