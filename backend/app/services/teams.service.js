const teamsDb = require('../database/teams.database.js');
const teamMembershipsDb = require('../database/teamMemberships.database.js');
const teamLeadersDb = require('../database/teamLeaders.database.js');
const peopleDb = require('../database/people.database.js');
const wcaIntegration = require('../integrations/wca.integration.js');
const photosService = require('./photos.service.js');
const { httpError } = require('../helpers/httpError.helper.js');
const { resolvePersonPicture } = require('../helpers/personPicture.helper.js');
const {
  ADMIN_TEAM_ID,
  BOARD_TEAM_ID,
  BOARD_LIAISONS_TEAM_ID,
  FIXED_TEAM_IDS,
  OFFICER_TEAM_IDS,
} = require('../helpers/fixedTeams.helper.js');

// Matches WCA's own WCA ID format (e.g. 2010AMBR01).
const WCA_ID_FORMAT = /^\d{4}[A-Z]{4}\d{2}$/;

// A team name must contain at least one letter/number - teams.database.js's
// slugifyTeamName() derives a team's id from its name and needs something
// to work with; this also just keeps a team name from being pure punctuation.
const SLUGGABLE_CHARACTER = /[a-z0-9]/i;

// Validates that a team name is non-empty and contains at least one letter or number.
function assertValidTeamName(name) {
  if (!name || !name.trim()) {
    throw httpError(400, 'Team name is required.');
  }
  if (!SLUGGABLE_CHARACTER.test(name)) {
    throw httpError(400, 'Team name must include at least one letter or number.');
  }
}

// Membership/leadership dates default to today (matching the DB layer's own
// CURRENT_DATE default) - resolved here too so the overlap checks below have
// a concrete date to compare against before the row is actually written.
function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

// Checks if a team is one of the fixed teams (Admin, Board, Board Liaisons, Officers).
function isFixedTeam(teamId) {
  return FIXED_TEAM_IDS.includes(teamId);
}

// Classifies a team into the coarse group sortTeamsForDashboard (below)
// orders/groups by.
const KIND_ORDER = { admin: 0, board: 1, officer: 2, board_liaisons: 3, ordinary: 4 };
function kindOf(team) {
  if (team.id === ADMIN_TEAM_ID) return 'admin';
  if (team.id === BOARD_TEAM_ID) return 'board';
  if (team.id === BOARD_LIAISONS_TEAM_ID) return 'board_liaisons';
  if (OFFICER_TEAM_IDS.includes(team.id)) return 'officer';
  return 'ordinary';
}

// Canonical Manage Teams dashboard order: Admin -> Board -> Officers (in
// their fixed org-chart order  OFFICER_TEAM_IDS) -> Board Liaisons -> ordinary teams
// (alphabetically) -> archived teams trailing at the end (newest-archived
// first).
function sortTeamsForDashboard(teams) {
  return [...teams].sort((a, b) => {
    if (!!a.archived_at !== !!b.archived_at) return a.archived_at ? 1 : -1;
    // Newest-archived first, trailing at the end of the list.
    if (a.archived_at && b.archived_at) {
      return new Date(b.archived_at) - new Date(a.archived_at);
    }
    const kindA = kindOf(a);
    const kindB = kindOf(b);
    const kindDiff = KIND_ORDER[kindA] - KIND_ORDER[kindB];
    if (kindDiff !== 0) return kindDiff;
    if (kindA === 'officer') {
      return OFFICER_TEAM_IDS.indexOf(a.id) - OFFICER_TEAM_IDS.indexOf(b.id);
    }
    return a.name.localeCompare(b.name);
  });
}

// Resolves a joined `people` row's picture in place, keeping this response's
// existing snake_case `picture_url`/`thumbnail_crop_*` fields.
function withResolvedPicture(row) {
  const resolved = resolvePersonPicture(row);
  return {
    ...row,
    picture_url: resolved.pictureUrl,
    thumbnail_crop_x: resolved.thumbnailCropX,
    thumbnail_crop_y: resolved.thumbnailCropY,
    thumbnail_crop_w: resolved.thumbnailCropW,
    thumbnail_crop_h: resolved.thumbnailCropH,
  };
}

// Collapses a member's badges into the single display tag the public page shows.
function publicDisplayTag(member) {
  return member.officerRole ?? (member.is_active_leader ? 'Leader' : null) ?? member.special_role;
}

// Lists every team for the public.
async function listTeamsForPublicPage() {
  const teams = await teamsDb.listTeams();
  const sorted = sortTeamsForDashboard(teams).filter((team) => !team.archived_at && !team.hidden);

  // get officer information
  const officerMemberships = await teamMembershipsDb.getActiveMembershipsForTeams(
    OFFICER_TEAM_IDS,
  );
  const officerTeamIdByPeopleId = new Map(
    officerMemberships.map((row) => [row.people_id, row.team_id]),
  );
  const officerColorByPeopleId = new Map(
    officerMemberships.map((row) => [row.people_id, row.color]),
  );
  const officerTeamNameById = new Map(
    teams.filter((team) => OFFICER_TEAM_IDS.includes(team.id)).map((team) => [team.id, team.name]),
  );

  const withMembers = await Promise.all(
    sorted.map(async (team) => {
      let members = (await teamMembershipsDb.listMembershipsForTeam(team.id))
        .filter((member) => !member.end_date)
        .map(withResolvedPicture);

      if (team.id === BOARD_TEAM_ID) {
        members = members.map((member) => ({
          ...member,
          officerRole: officerTeamNameById.get(officerTeamIdByPeopleId.get(member.people_id)) ?? null,
          officerColor: officerColorByPeopleId.get(member.people_id) ?? null,
        }));
        members = sortBoardMembers(members, officerTeamIdByPeopleId);
      }

      members = members.map((member) => ({
        peopleId: member.people_id,
        name: member.name,
        tag: publicDisplayTag(member),
        color: member.officerColor ?? member.color,
        pictureUrl: member.picture_url,
        thumbnailCropX: member.thumbnail_crop_x,
        thumbnailCropY: member.thumbnail_crop_y,
        thumbnailCropW: member.thumbnail_crop_w,
        thumbnailCropH: member.thumbnail_crop_h,
      }));

      return {
        id: team.id,
        name: team.name,
        description: team.description,
        members,
      };
    }),
  );

  return withMembers.filter((team) => team.members.length > 0);
}

// Lists every team (including archived/hidden) with its members and, for
// ordinary teams, its full leadership history (current + past stints) -
// already sorted into the dashboard's canonical display order.
async function listTeamsForDashboard() {
  const teams = await teamsDb.listTeams();
  const sorted = sortTeamsForDashboard(teams);

  // Board member -> their current Officer role (if any) - the Officer role is 
  // auto-calculated.
  const officerMemberships = await teamMembershipsDb.getActiveMembershipsForTeams(
    OFFICER_TEAM_IDS,
  );
  const officerTeamIdByPeopleId = new Map(
    officerMemberships.map((row) => [row.people_id, row.team_id]),
  );
  // The officer row's own color, per person - wins over their Board row's
  // own color for display, since the color is tied to the office (e.g.
  // President's purple), not the person's identity as a Board member.
  const officerColorByPeopleId = new Map(
    officerMemberships.map((row) => [row.people_id, row.color]),
  );
  const officerTeamNameById = new Map(
    teams.filter((team) => OFFICER_TEAM_IDS.includes(team.id)).map((team) => [team.id, team.name]),
  );

  const withMembers = await Promise.all(
    sorted.map(async (team) => {
      const kind = kindOf(team);
      let members = (await teamMembershipsDb.listMembershipsForTeam(team.id)).map(
        withResolvedPicture,
      );
      // Only ordinary teams have a Leader concept.
      const leadershipHistory =
        kind === 'ordinary'
          ? (await teamLeadersDb.listLeadershipHistoryForTeam(team.id)).map(withResolvedPicture)
          : [];

      // add officer role/color to each board member if they have one
      if (team.id === BOARD_TEAM_ID) {
        members = members.map((member) => ({
          ...member,
          officerRole: officerTeamNameById.get(officerTeamIdByPeopleId.get(member.people_id)) ?? null,
          officerColor: officerColorByPeopleId.get(member.people_id) ?? null,
        }));
        members = sortBoardMembers(members, officerTeamIdByPeopleId);
      }

      return {
        id: team.id,
        name: team.name,
        description: team.description,
        email: team.email,
        hidden: team.hidden,
        archivedAt: team.archived_at,
        kind,
        isFixed: isFixedTeam(team.id),
        members,
        leadershipHistory,
      };
    }),
  );

  return withMembers;
}

// Board members are ordered by their current Officer role (in
// OFFICER_TEAM_IDS's fixed org-chart order, non-officers trailing after
// every officer), then alphabetically - ended memberships stay grouped at
// the end.
function sortBoardMembers(members, officerTeamIdByPeopleId) {
  const officerIndex = (peopleId) => {
    const teamId = officerTeamIdByPeopleId.get(peopleId);
    const index = teamId ? OFFICER_TEAM_IDS.indexOf(teamId) : -1;
    return index === -1 ? OFFICER_TEAM_IDS.length : index;
  };

  const active = members.filter((member) => !member.end_date);
  const ended = members.filter((member) => member.end_date);
  active.sort((a, b) => {
    const diff = officerIndex(a.people_id) - officerIndex(b.people_id);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
  return [...active, ...ended];
}

// Creates a new ordinary team.
async function createTeam({ name, description, email, hidden, actorUserId }) {
  assertValidTeamName(name);
  try {
    return await teamsDb.createTeam({ name: name.trim(), description, email, hidden, actorUserId });
  } catch (err) {
    // A team whose name slugifies to an id that's already taken (an exact
    // duplicate name, or one differing only in punctuation/case).
    if (err.code === '23505') {
      throw httpError(409, 'A team with this name already exists.');
    }
    throw err;
  }
}

// Edits a team's name/description/email/hidden flag. Admin is never
// editable at all; a fixed team's name is silently protected at the DB
// layer, but every other field on it (description/email/hidden) stays
// editable.
async function updateTeam(teamId, { name, description, email, hidden, actorUserId }) {
  if (teamId === ADMIN_TEAM_ID) {
    throw httpError(400, 'The Admin row is not editable.');
  }
  const team = await teamsDb.findTeamById(teamId);
  if (!team) throw httpError(404, 'Team not found.');
  if (!isFixedTeam(teamId)) {
    assertValidTeamName(name);
  }
  return teamsDb.updateTeam(teamId, {
    name: name?.trim(),
    description,
    email,
    hidden,
    actorUserId,
  });
}

// Archives an ordinary team - Admin/Board/Officers/Board Liaisons can never
// be archived.
async function archiveTeam(teamId, actorUserId) {
  if (isFixedTeam(teamId)) {
    throw httpError(400, 'This team is fixed and can never be archived.');
  }
  const team = await teamsDb.archiveTeam(teamId, actorUserId);
  if (!team) throw httpError(404, 'Team not found.');
  return team;
}

// Unarchives an ordinary team
async function unarchiveTeam(teamId, actorUserId) {
  if (isFixedTeam(teamId)) {
    throw httpError(400, 'This team is fixed and was never archived.');
  }
  const team = await teamsDb.unarchiveTeam(teamId, actorUserId);
  if (!team) throw httpError(404, 'Team not found.');
  return team;
}

// Permanently deletes a team - Admin-only (enforced by the route's own
// middleware), and never allowed for a fixed team.
async function hardDeleteTeam(teamId) {
  if (isFixedTeam(teamId)) {
    throw httpError(400, 'This team is fixed and can never be deleted.');
  }
  const team = await teamsDb.findTeamById(teamId);
  if (!team) throw httpError(404, 'Team not found.');
  await teamsDb.hardDeleteTeam(teamId);
}

// Resolves `person` (either an existing `{ peopleId }` selection or a
// `{ wcaId }` "add by WCA ID" fallback) down to a concrete `people.id`. The
// wcaId branch re-fetches name/picture from WCA itself rather than trusting
// client-supplied values, so a caller can't persist a name/picture that
// doesn't actually match that WCA ID.
async function resolvePeopleId(person) {
  if (person.peopleId) {
    const existing = await peopleDb.findPersonById(person.peopleId);
    if (!existing) throw httpError(404, 'Person not found.');
    return existing.id;
  }
  if (person.wcaId) {
    if (!WCA_ID_FORMAT.test(person.wcaId)) {
      throw httpError(400, 'Invalid WCA ID format.');
    }
    const wcaPerson = await wcaIntegration.fetchPersonByWcaId(person.wcaId);
    if (!wcaPerson) throw httpError(404, 'WCA ID not found.');
    const upserted = await peopleDb.upsertPersonFromWcaIdLookup({
      wcaId: person.wcaId,
      name: wcaPerson.name,
      pictureUrl: wcaPerson.avatar?.thumb_url ?? null,
    });
    return upserted.id;
  }
  throw httpError(400, 'Must provide either peopleId or wcaId.');
}

// Asserts that a given color is valid according to the membership color constraint.
function assertValidColor(color) {
  if (color != null && !teamLeadersDb.MEMBERSHIP_COLORS.includes(color)) {
    throw httpError(400, `Invalid color "${color}".`);
  }
}

// Adds a member to a team, enforcing buisness rules to block additions.
async function addMember(teamId, { person, specialRole, color, startDate, endDate, actorUserId }) {
  const team = await teamsDb.findTeamById(teamId);
  if (!team) throw httpError(404, 'Team not found.');
  assertValidColor(color);

  const peopleId = await resolvePeopleId(person);

  // First-ever Team/Board membership promotes a person into a managed photo.
  await photosService.promoteToManagedPhoto(peopleId);

  // Enforce Board-specific rule that Board membership rows never carry a special role.
  if (teamId === BOARD_TEAM_ID && specialRole) {
    throw httpError(400, 'Board membership rows never carry a special role.');
  }

  // Covers both a duplicate active row and a genuinely overlapping
  // historical stint - backfilling a since-ended stint that doesn't overlap
  // anything already on record is still fine.
  const overlapping = await teamMembershipsDb.findOverlappingMembership(
    teamId,
    peopleId,
    startDate ?? todayIsoDate(),
    endDate,
  );
  if (overlapping) {
    throw httpError(
      409,
      'This person already has a membership on this team during that date range.',
    );
  }

  // Enforce Board Liaisons-specific rule that a current Board member cannot be added as a liaison.
  if (teamId === BOARD_LIAISONS_TEAM_ID) {
    const isCurrentBoardMember = await teamMembershipsDb.hasActiveMembership(
      BOARD_TEAM_ID,
      peopleId,
    );
    if (isCurrentBoardMember) {
      throw httpError(
        400,
        'A current Board member is already a liaison and never gets a separate Board Liaisons row.',
      );
    }
  }

  return teamMembershipsDb.addMember({
    teamId,
    peopleId,
    specialRole: teamId === BOARD_TEAM_ID ? null : specialRole,
    color,
    startDate,
    endDate,
    actorUserId,
  });
}

// Edits an existing membership row's dates/special role/color.
async function updateMembership(
  membershipId,
  { startDate, endDate, specialRole, color, actorUserId },
) {
  const membership = await teamMembershipsDb.findMembershipById(membershipId);
  if (!membership) throw httpError(404, 'Membership not found.');
  assertValidColor(color);

  // Enforce Board-specific rule that Board membership rows never carry a special role.
  if (membership.team_id === BOARD_TEAM_ID && specialRole) {
    throw httpError(400, 'Board membership rows never carry a special role.');
  }

  // Check for overlapping memberships to prevent duplicate or conflicting entries.
  const overlapping = await teamMembershipsDb.findOverlappingMembership(
    membership.team_id,
    membership.people_id,
    startDate ?? todayIsoDate(),
    endDate,
    { excludeMembershipId: membershipId },
  );
  if (overlapping) {
    throw httpError(
      409,
      'This person already has a membership on this team during that date range.',
    );
  }

  return teamMembershipsDb.updateMembership(membershipId, {
    startDate,
    endDate,
    specialRole: membership.team_id === BOARD_TEAM_ID ? null : specialRole,
    color,
    actorUserId,
  });
}

// Removes a member from a team, marking the membership as removed rather than deleting it.
async function removeMember(membershipId, actorUserId) {
  const membership = await teamMembershipsDb.removeMember(membershipId, actorUserId);
  if (!membership) throw httpError(404, 'Membership not found or already removed.');
  return membership;
}

// Permanently deletes a membership row from the database. Admin-only.
async function hardDeleteMembership(membershipId) {
  const membership = await teamMembershipsDb.findMembershipById(membershipId);
  if (!membership) throw httpError(404, 'Membership not found.');
  await teamMembershipsDb.hardDeleteMembership(membershipId);
}

// Sets `peopleId` as a team's Leader - only ordinary teams have a Leader
// concept, and only a current active member of that team is eligible.
async function setLeader(teamId, peopleId, actorUserId) {
  if (isFixedTeam(teamId)) {
    throw httpError(400, 'Fixed teams have no Leader concept.');
  }
  const isActiveMember = await teamMembershipsDb.hasActiveMembership(teamId, peopleId);
  if (!isActiveMember) {
    throw httpError(400, 'Only a current active member of the team can be made Leader.');
  }
  return teamLeadersDb.setLeader({ teamId, peopleId, actorUserId });
}

// Removes a team's Leader, if one exists. Only ordinary teams have a Leader concept.
async function removeLeader(teamId, actorUserId) {
  if (isFixedTeam(teamId)) {
    throw httpError(400, 'Fixed teams have no Leader concept.');
  }
  const removed = await teamLeadersDb.removeLeader(teamId, actorUserId);
  if (!removed) throw httpError(404, 'No active leader to remove.');
  return removed;
}

// Corrects a leadership stint's dates.
async function updateLeadershipStint(id, { startDate, endDate, actorUserId }) {
  const row = await teamLeadersDb.findLeadershipRowById(id);
  if (!row) throw httpError(404, 'Leadership stint not found.');

  const resolvedStartDate = startDate ?? todayIsoDate();

  // Check for overlapping leadership stints to prevent conflicts.
  const overlapping = await teamLeadersDb.findOverlappingLeadershipStint(
    row.team_id,
    row.people_id,
    resolvedStartDate,
    endDate,
    { excludeLeaderId: id },
  );
  if (overlapping) {
    throw httpError(
      409,
      'This person already has a Leader stint on this team during that date range.',
    );
  }

  // A leadership stint must fall entirely within a single membership stint.
  const coveredByMembership = await teamMembershipsDb.hasMembershipCovering(
    row.team_id,
    row.people_id,
    resolvedStartDate,
    endDate,
  );
  if (!coveredByMembership) {
    throw httpError(
      400,
      "This person doesn't have a single membership stint on this team covering that entire date range.",
    );
  }

  return teamLeadersDb.updateLeadershipStint(id, { startDate, endDate, actorUserId });
}

// Permanently deletes a leadership stint from the database. Admin-only.
async function hardDeleteLeadershipRow(id) {
  const row = await teamLeadersDb.findLeadershipRowById(id);
  if (!row) throw httpError(404, 'Leadership stint not found.');
  await teamLeadersDb.hardDeleteLeadershipRow(id);
}

// Backs the Add/Edit Member sheet's search-as-you-type combobox - our own
// `people`/`users` data only. 
async function searchPeople(searchTerm) {
  if (!searchTerm || !searchTerm.trim()) return [];
  const results = await peopleDb.searchPeople(searchTerm.trim());
  return results.map(withResolvedPicture);
}

// Proxies WCA's public GET /api/v0/persons/:wca_id lookup - the "add by WCA
// ID" fallback for someone not already in `people`. Returns null on a 404
// (a validly-formatted but unknown WCA ID).
async function lookupWcaId(wcaId) {
  if (!WCA_ID_FORMAT.test(wcaId)) {
    throw httpError(400, 'Invalid WCA ID format.');
  }
  const person = await wcaIntegration.fetchPersonByWcaId(wcaId);
  if (!person) return null;
  return {
    wcaId,
    name: person.name,
    pictureUrl: person.avatar?.thumb_url ?? null,
  };
}

module.exports = {
  WCA_ID_FORMAT,
  listTeamsForDashboard,
  listTeamsForPublicPage,
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
