const crypto = require('crypto');
const db = require('./pool.js');

const logger = require('../utils/logger.util.js');

// Every currently-active (end_date IS NULL) team id a person belongs to.
async function getActiveTeamIdsForPerson(peopleId) {
  const { rows } = await db.pool.query(
    'SELECT team_id FROM team_memberships WHERE people_id = $1 AND end_date IS NULL',
    [peopleId],
  );
  return rows.map((row) => row.team_id);
}

// Every currently-active membership row across a given set of teams (e.g.
// the six fixed Officer teams), keyed by person. Includes color so a Board
// member's officer row can supply the color that wins for display over
// their own Board row's color.
async function getActiveMembershipsForTeams(teamIds) {
  const { rows } = await db.pool.query(
    'SELECT team_id, people_id, color FROM team_memberships WHERE team_id = ANY($1) AND end_date IS NULL',
    [teamIds],
  );
  return rows;
}

// Lists every membership row for a team (active and past), joined with the
// member's display info and their active-leader status. Ordered active
// before ended; within active, leaders before ordinary members then
// alphabetically; within ended (past members), most-recently-ended first.
async function listMembershipsForTeam(teamId) {
  const { rows } = await db.pool.query(
    `SELECT tm.id, tm.team_id, tm.people_id, tm.start_date, tm.end_date, tm.special_role, tm.color,
            p.name, p.picture_url, p.wca_id, p.has_managed_photo,
            p.thumbnail_crop_x, p.thumbnail_crop_y, p.thumbnail_crop_w, p.thumbnail_crop_h,
            (tl.id IS NOT NULL) AS is_active_leader
     FROM team_memberships tm
     JOIN people p ON p.id = tm.people_id
     LEFT JOIN team_leaders tl ON tl.team_id = tm.team_id AND tl.people_id = tm.people_id AND tl.end_date IS NULL
     WHERE tm.team_id = $1
     ORDER BY tm.end_date IS NOT NULL, is_active_leader DESC, tm.end_date DESC, p.name`,
    [teamId],
  );
  return rows;
}

// Lists every membership row for a person (active and past), joined with
// the team's name/hidden/archived_at. Ordered active first, then most-recently-
// ended first among past rows.
async function listMembershipsForPerson(peopleId) {
  const { rows } = await db.pool.query(
    `SELECT tm.id, tm.team_id, tm.start_date, tm.end_date, tm.special_role, tm.color,
            t.name AS team_name, t.hidden AS team_hidden, t.archived_at AS team_archived_at
     FROM team_memberships tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.people_id = $1
     ORDER BY tm.end_date IS NOT NULL, tm.end_date DESC, t.name`,
    [peopleId],
  );
  return rows;
}

// Finds a single membership row by its ID. Returns null if not found.
async function findMembershipById(membershipId) {
  const { rows } = await db.pool.query('SELECT * FROM team_memberships WHERE id = $1', [
    membershipId,
  ]);
  return rows[0] ?? null;
}

// True if `peopleId` currently has an active (non-removed) membership row on
// `teamId`.
async function hasActiveMembership(teamId, peopleId) {
  const { rows } = await db.pool.query(
    'SELECT 1 FROM team_memberships WHERE team_id = $1 AND people_id = $2 AND end_date IS NULL',
    [teamId, peopleId],
  );
  return rows.length > 0;
}

// Finds an existing membership row for the same team/person whose date
// range overlaps [startDate, endDate] - a null end_date (either side) means
// "still ongoing," so it overlaps anything from its start date onward.
// `excludeMembershipId` skips the row itself when checking an in-place edit
// against every *other* row, rather than against its own pre-edit values.
async function findOverlappingMembership(
  teamId,
  peopleId,
  startDate,
  endDate,
  { excludeMembershipId } = {},
) {
  const { rows } = await db.pool.query(
    `SELECT id FROM team_memberships
     WHERE team_id = $1
       AND people_id = $2
       AND ($5::text IS NULL OR id != $5)
       AND start_date <= COALESCE($4::date, DATE 'infinity')
       AND $3::date <= COALESCE(end_date, DATE 'infinity')
     LIMIT 1`,
    [teamId, peopleId, startDate, endDate ?? null, excludeMembershipId ?? null],
  );
  return rows[0] ?? null;
}

// True if a single existing membership row for this team/person fully
// contains [startDate, endDate] - i.e. that row's own start is on or before
// startDate AND that row's own end (or still-ongoing) is on or after
// endDate.
async function hasMembershipCovering(teamId, peopleId, startDate, endDate) {
  const { rows } = await db.pool.query(
    `SELECT 1 FROM team_memberships
     WHERE team_id = $1
       AND people_id = $2
       AND start_date <= $3::date
       AND COALESCE(end_date, DATE 'infinity') >= COALESCE($4::date, DATE 'infinity')
     LIMIT 1`,
    [teamId, peopleId, startDate, endDate ?? null],
  );
  return rows.length > 0;
}

// Adds a member to a team - start_date defaults to today (auto-calculated), but
// can be overridden, same as end_date, for a corrected/backfilled date.
async function addMember({
  teamId,
  peopleId,
  specialRole,
  color,
  startDate,
  endDate,
  actorUserId,
}) {
  const id = crypto.randomUUID();
  const { rows } = await db.pool.query(
    `INSERT INTO team_memberships (id, team_id, people_id, start_date, end_date, special_role, color, created_by, updated_by)
     VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6, $7, $8, $8)
     RETURNING *`,
    [
      id,
      teamId,
      peopleId,
      startDate ?? null,
      endDate ?? null,
      specialRole ?? null,
      color ?? null,
      actorUserId ?? null,
    ],
  );
  logger.debug(`Added member (people_id ${peopleId}) to team (id ${teamId}).`);
  return rows[0];
}

// Edits a membership row's dates/special role/color.
async function updateMembership(
  membershipId,
  { startDate, endDate, specialRole, color, actorUserId },
) {
  const { rows } = await db.pool.query(
    `UPDATE team_memberships
     SET start_date = $2, end_date = $3, special_role = $4, color = $5, updated_by = $6, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [membershipId, startDate, endDate ?? null, specialRole ?? null, color ?? null, actorUserId],
  );
  logger.debug(`Updated membership (id ${membershipId}).`);
  return rows[0] ?? null;
}

// Removes a member (soft delete - end-dates the row rather than deleting
// it). Also end-dates any active leadership row for the same team/person,
// since a person can't remain "Leader" of a team they're no longer a member
// of.
async function removeMember(membershipId, actorUserId) {
  return db.withRetry(async (client) => {
    const { rows } = await client.query(
      `UPDATE team_memberships
       SET end_date = CURRENT_DATE, updated_by = $2, updated_at = now()
       WHERE id = $1 AND end_date IS NULL
       RETURNING *`,
      [membershipId, actorUserId],
    );
    const membership = rows[0];
    if (!membership) return null;

    await client.query(
      `UPDATE team_leaders
       SET end_date = CURRENT_DATE, updated_by = $3, updated_at = now()
       WHERE team_id = $1 AND people_id = $2 AND end_date IS NULL`,
      [membership.team_id, membership.people_id, actorUserId],
    );
    logger.debug(
      `Removed member (id ${membershipId}), ending any active leadership stint for the same team/person.`,
    );
    return membership;
  });
}

// Permanently removes a membership row outright - Admin-only, for rectifying
// a genuine data-entry mistake.
async function hardDeleteMembership(membershipId) {
  await db.pool.query('DELETE FROM team_memberships WHERE id = $1', [membershipId]);
  logger.debug(`Hard-deleted membership (id ${membershipId}).`);
}

module.exports = {
  getActiveTeamIdsForPerson,
  getActiveMembershipsForTeams,
  listMembershipsForTeam,
  listMembershipsForPerson,
  findMembershipById,
  hasActiveMembership,
  findOverlappingMembership,
  hasMembershipCovering,
  addMember,
  updateMembership,
  removeMember,
  hardDeleteMembership,
};
