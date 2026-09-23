const teamMembershipsDb = require('../database/teamMemberships.database.js');
const { ADMIN_TEAM_ID, BOARD_TEAM_ID } = require('./fixedTeams.helper.js');

// Computes every team id `peopleId` currently (actively) belongs to, plus
// the Admin/Board convenience flags every later role check is built on -
// the single shared "does this user currently hold role X" helper every
// protected route reuses.
async function getCurrentRoles(peopleId) {
  if (!peopleId) {
    return { teamIds: [], isAdmin: false, isBoard: false };
  }
  const teamIds = await teamMembershipsDb.getActiveTeamIdsForPerson(peopleId);
  const isAdmin = teamIds.includes(ADMIN_TEAM_ID);
  const isBoard = teamIds.includes(BOARD_TEAM_ID);
  return { teamIds, isAdmin, isBoard };
}

// True if `user` (req.user, set by session.middleware.js's attachSession)
// currently holds any of `roles` (role keys from getCurrentRoles, e.g.
// 'isBoard'/'isAdmin').
async function hasAnyRole(user, roles) {
  if (!user) return false;
  const currentRoles = await getCurrentRoles(user.people_id);
  return roles.some((role) => currentRoles[role]);
}

// True if `user` currently holds Admin access specifically - the stricter
// gate used for hard-delete actions.
async function isAdmin(user) {
  return hasAnyRole(user, ['isAdmin']);
}

module.exports = { getCurrentRoles, hasAnyRole, isAdmin };
