const teamsService = require('../services/teams.service.js');

const logger = require('../utils/logger.util.js');

// Handles service errors and sends appropriate HTTP responses.
function respondWithServiceError(res, err, fallbackMessage) {
  const status = err.status || 500;
  if (status < 500) {
    logger.warn(`${fallbackMessage}: ${err.message}`);
    res.status(status).json({ message: err.message });
    return;
  }
  logger.error(`${fallbackMessage}: `, err);
  res.status(500).json({ message: 'Internal server error' });
}

// GET /dashboard/teams - lists every team, grouped/sorted for the dashboard.
async function listTeams(req, res) {
  try {
    const teams = await teamsService.listTeamsForDashboard();
    res.json(teams);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to list teams');
  }
}

// POST /dashboard/teams - creates a new ordinary team.
async function createTeam(req, res) {
  try {
    const team = await teamsService.createTeam({ ...req.body, actorUserId: req.user.id });
    res.status(201).json(team);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to create team');
  }
}

// PUT /dashboard/teams/:teamId - edits a team's name/description/email/hidden flag.
async function updateTeam(req, res) {
  try {
    const team = await teamsService.updateTeam(req.params.teamId, {
      ...req.body,
      actorUserId: req.user.id,
    });
    res.json(team);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update team');
  }
}

// POST /dashboard/teams/:teamId/archive - archives an ordinary team.
async function archiveTeam(req, res) {
  try {
    const team = await teamsService.archiveTeam(req.params.teamId, req.user.id);
    res.json(team);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to archive team');
  }
}

// POST /dashboard/teams/:teamId/unarchive - unarchives a team.
async function unarchiveTeam(req, res) {
  try {
    const team = await teamsService.unarchiveTeam(req.params.teamId, req.user.id);
    res.json(team);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to unarchive team');
  }
}

// DELETE /dashboard/teams/:teamId - permanently deletes an ordinary team (Admin only).
async function hardDeleteTeam(req, res) {
  try {
    await teamsService.hardDeleteTeam(req.params.teamId);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to delete team');
  }
}

// POST /dashboard/teams/:teamId/members - adds a member by peopleId or wcaId.
async function addMember(req, res) {
  try {
    const { peopleId, wcaId, specialRole, color, startDate, endDate } = req.body ?? {};
    const member = await teamsService.addMember(req.params.teamId, {
      person: { peopleId, wcaId },
      specialRole,
      color,
      startDate,
      endDate,
      actorUserId: req.user.id,
    });
    res.status(201).json(member);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to add member');
  }
}

// PUT /dashboard/team-memberships/:membershipId - edits a membership row's dates/special role/color.
async function updateMembership(req, res) {
  try {
    const member = await teamsService.updateMembership(req.params.membershipId, {
      ...req.body,
      actorUserId: req.user.id,
    });
    res.json(member);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update membership');
  }
}

// POST /dashboard/team-memberships/:membershipId/remove - soft-removes a member (end-dates the row).
async function removeMember(req, res) {
  try {
    const member = await teamsService.removeMember(req.params.membershipId, req.user.id);
    res.json(member);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to remove member');
  }
}

// DELETE /dashboard/team-memberships/:membershipId - permanently deletes a membership row (Admin only).
async function hardDeleteMembership(req, res) {
  try {
    await teamsService.hardDeleteMembership(req.params.membershipId);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to delete membership');
  }
}

// POST /dashboard/teams/:teamId/leader - sets a team's Leader.
async function setLeader(req, res) {
  try {
    const leader = await teamsService.setLeader(req.params.teamId, req.body?.peopleId, req.user.id);
    res.status(201).json(leader);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to set leader');
  }
}

// DELETE /dashboard/teams/:teamId/leader - removes a team's active Leader.
async function removeLeader(req, res) {
  try {
    const removed = await teamsService.removeLeader(req.params.teamId, req.user.id);
    res.json(removed);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to remove leader');
  }
}

// PUT /dashboard/team-leaders/:leaderId - corrects a leadership stint's dates.
async function updateLeadershipStint(req, res) {
  try {
    const stint = await teamsService.updateLeadershipStint(req.params.leaderId, {
      ...req.body,
      actorUserId: req.user.id,
    });
    res.json(stint);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update leadership stint');
  }
}

// DELETE /dashboard/team-leaders/:leaderId - permanently deletes a leadership row (Admin only).
async function hardDeleteLeadershipRow(req, res) {
  try {
    await teamsService.hardDeleteLeadershipRow(req.params.leaderId);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to delete leadership row');
  }
}

// GET /dashboard/people/search - search-as-you-type combobox backing search.
async function searchPeople(req, res) {
  try {
    const results = await teamsService.searchPeople(req.query.q);
    res.json(results);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to search people');
  }
}

// GET /dashboard/people/wca-lookup/:wcaId - "add by WCA ID" fallback lookup.
async function lookupWcaId(req, res) {
  try {
    const person = await teamsService.lookupWcaId(req.params.wcaId);
    if (!person) {
      res.status(404).json({ message: 'WCA ID not found.' });
      return;
    }
    res.json(person);
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to look up WCA ID');
  }
}

module.exports = {
  listTeams,
  createTeam,
  updateTeam,
  archiveTeam,
  unarchiveTeam,
  hardDeleteTeam,
  addMember,
  updateMembership,
  removeMember,
  hardDeleteMembership,
  setLeader,
  removeLeader,
  updateLeadershipStint,
  hardDeleteLeadershipRow,
  searchPeople,
  lookupWcaId,
};
