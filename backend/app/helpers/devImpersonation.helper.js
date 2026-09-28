const { config } = require('../config/config.js');
const logger = require('../utils/logger.util.js');

// Dev-only "login as" mechanism - lets a developer stand in as a person
// holding any of a fixed set of roles without needing a separate real
// WCA account per role. Kept entirely in this module's own process memory,
// never persisted to DSQL.
const impersonatedRolesBySessionId = new Map();

// A session impersonating a Delegate role has no real `delegates` row to
// write a bio to - this holds what My Info's bio editor shows for that
// session instead, purely in memory, so an edit visibly "sticks" for the
// rest of the session without ever touching the real `delegates` table.
const impersonatedBiosBySessionId = new Map();

// Every preset the role picker offers, and exactly what each one makes
// getCurrentRoles() report.
const PRESETS = {
  none: {
    teamIds: [],
    isAdmin: false,
    isBoard: false,
    delegateRank: null,
    isRegionalDelegate: false,
  },
  admin: {
    teamIds: [],
    isAdmin: true,
    isBoard: false,
    delegateRank: null,
    isRegionalDelegate: false,
  },
  board: {
    teamIds: [],
    isAdmin: false,
    isBoard: true,
    delegateRank: null,
    isRegionalDelegate: false,
  },
  regionalDelegate: {
    teamIds: [],
    isAdmin: false,
    isBoard: false,
    delegateRank: 'regional',
    isRegionalDelegate: true,
  },
};

// The actual security boundary - every function below is a no-op (or
// returns null) whenever this is false. Deliberately requires TWO
// independent conditions, not just the opt-in flag alone: the flag itself
// AND NODE_ENV !== 'production'. This is defense-in-depth, not a
// reintroduction of an opt-out NODE_ENV check - ALLOW_DEV_ROLE_IMPERSONATION
// is still the real gate (never set on the deployed EC2 instance), but
// ANDing a second, differently-sourced condition means a single
// misconfiguration (a leaked/copied .env, a secrets-manager mistake) can't
// enable full Admin impersonation for literally any WCA account-holder on
// its own - both would have to be wrong at once. This can only ever make
// the feature harder to accidentally enable, never easier, since NODE_ENV
// defaults to 'development' (see config.js) rather than something that
// could silently disable it in real local dev.
function isEnabled() {
  return config.ALLOW_DEV_ROLE_IMPERSONATION === 'true' && config.NODE_ENV !== 'production';
}

// True if `presetKey` is one of the offered presets above.
function isValidPreset(presetKey) {
  return Object.prototype.hasOwnProperty.call(PRESETS, presetKey);
}

// Records that `sessionId` should report `presetKey`'s role from now on -
// called exactly once, right after a real WCA sign-in completes and a real
// session is created.
function setImpersonation(sessionId, presetKey) {
  if (!isEnabled() || !isValidPreset(presetKey)) return;
  impersonatedRolesBySessionId.set(sessionId, presetKey);
  // Loud on purpose - this is a no-op in normal local dev use (just
  // routine noise there), but if this line is ever seen in a deployed
  // environment's logs, that's a live security incident, not a curiosity -
  // it means someone just granted themselves an impersonated role for real.
  logger.warn(`Dev role impersonation ENABLED for a session - preset "${presetKey}".`);
}

// The preset key `sessionId` picked, or null if this session
// isn't impersonating anything or the feature is disabled.
function getImpersonationPresetKey(sessionId) {
  if (!isEnabled() || !sessionId) return null;
  return impersonatedRolesBySessionId.get(sessionId) ?? null;
}

// The role object `sessionId` should report, or null if this session isn't
// impersonating anything. This is the actual short-circuit
// roles.helper.js's getCurrentRoles() takes before ever querying
// team_memberships/delegates - logged (at warn, not debug) every time it
// actually fires, same reasoning as setImpersonation's log above: routine
// noise in local dev, a real incident signal anywhere else.
function getImpersonation(sessionId) {
  const presetKey = getImpersonationPresetKey(sessionId);
  if (!presetKey) return null;
  logger.warn(`Dev role impersonation SHORT-CIRCUITED a role check - preset "${presetKey}".`);
  return PRESETS[presetKey];
}

// The bio text My Info should show for an impersonated Delegate session.
function getImpersonatedBio(sessionId) {
  if (!isEnabled() || !sessionId) return '';
  return impersonatedBiosBySessionId.get(sessionId) ?? '';
}

// Records the bio text an impersonated session's My Info edit should show
// from now on - purely in this module's own memory, never written to
// `delegates.bio`.
function setImpersonatedBio(sessionId, bio) {
  if (!isEnabled() || !getImpersonationPresetKey(sessionId)) return;
  impersonatedBiosBySessionId.set(sessionId, bio);
}

module.exports = {
  PRESETS,
  isEnabled,
  isValidPreset,
  setImpersonation,
  getImpersonation,
  getImpersonationPresetKey,
  getImpersonatedBio,
  setImpersonatedBio,
};
