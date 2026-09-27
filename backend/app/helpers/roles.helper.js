const teamMembershipsDb = require('../database/teamMemberships.database.js');
const delegatesDb = require('../database/delegates.database.js');
const devImpersonation = require('./devImpersonation.helper.js');
const { ADMIN_TEAM_ID, BOARD_TEAM_ID } = require('./fixedTeams.helper.js');

// Delegate Type ordering that a person can display/sort as.
const RANK_DISPLAY_ORDER = ['regional', 'senior', 'delegate', 'junior', 'trainee'];

// Of every rank `ranks` currently holds concurrently open, returns the
// single highest one per RANK_DISPLAY_ORDER.
function highestDisplayRank(ranks) {
  return RANK_DISPLAY_ORDER.find((rank) => ranks.includes(rank)) ?? null;
}

// Computes every team id `peopleId` currently (actively) belongs to, a person's
// highest delegate rank, plus the Admin/Board convenience flags every later role
// check is built on - the single shared "does this user currently hold role X" helper every
// protected route reuses.
async function getCurrentRoles(peopleId, sessionId) {
  if (!peopleId) {
    return {
      teamIds: [],
      delegateRank: null,
      isAdmin: false,
      isBoard: false,
      isRegionalDelegate: false,
    };
  }

  // If this session picked a role preset, report that directly and 
  // never touch team_memberships/delegates at all.
  const impersonated = devImpersonation.getImpersonation(sessionId);
  if (impersonated) return impersonated;

  const teamIds = await teamMembershipsDb.getActiveTeamIdsForPerson(peopleId);
  const isAdmin = teamIds.includes(ADMIN_TEAM_ID);
  const isBoard = teamIds.includes(BOARD_TEAM_ID);
  const openRanks = await delegatesDb.getOpenRanksForPerson(peopleId);
  const delegateRank = highestDisplayRank(openRanks);
  const isRegionalDelegate = delegateRank === 'regional';
  return { teamIds, delegateRank, isAdmin, isBoard, isRegionalDelegate };
}

// True if `user` (req.user, set by session.middleware.js's attachSession)
// currently holds any of `roles` (role keys from getCurrentRoles, e.g.
// 'isBoard'/'isAdmin').
async function hasAnyRole(user, roles) {
  if (!user) return false;
  const currentRoles = await getCurrentRoles(user.people_id, user.sessionId);
  return roles.some((role) => currentRoles[role]);
}

// True if `user` currently holds Admin access specifically - the stricter
// gate used for hard-delete actions.
async function isAdmin(user) {
  return hasAnyRole(user, ['isAdmin']);
}

module.exports = { getCurrentRoles, hasAnyRole, isAdmin };
