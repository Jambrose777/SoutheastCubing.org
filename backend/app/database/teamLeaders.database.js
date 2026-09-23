const crypto = require('crypto');
const db = require('./pool.js');

const logger = require('../utils/logger.util.js');

// Fixed subset of colors a membership row's `color` can take.
const MEMBERSHIP_COLORS = [
  'black',
  'blue',
  'dark_grey',
  'green',
  'grey',
  'yellow',
  'purple',
  'orange',
  'red',
];

// Gets the currently active leader for a given team. Returns null if no active leader exists.
async function getActiveLeader(teamId) {
  const { rows } = await db.pool.query(
    `SELECT tl.*, p.name, p.picture_url
     FROM team_leaders tl
     JOIN people p ON p.id = tl.people_id
     WHERE tl.team_id = $1 AND tl.end_date IS NULL`,
    [teamId],
  );
  return rows[0] ?? null;
}

// Every past team_leaders stint for a team (including former leaders who've
// since left the team entirely) - backs the "Edit Leadership" sheet.
async function listLeadershipHistoryForTeam(teamId) {
  const { rows } = await db.pool.query(
    `SELECT tl.*, p.name, p.picture_url
     FROM team_leaders tl
     JOIN people p ON p.id = tl.people_id
     WHERE tl.team_id = $1
     ORDER BY tl.start_date DESC`,
    [teamId],
  );
  return rows;
}

// Finds a leadership row by its ID. Returns null if not found.
async function findLeadershipRowById(id) {
  const { rows } = await db.pool.query('SELECT * FROM team_leaders WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Finds an existing leadership row for the same team/person whose date
// range overlaps [startDate, endDate] skips the row itself when checking 
// an in-place edit.
async function findOverlappingLeadershipStint(
  teamId,
  peopleId,
  startDate,
  endDate,
  { excludeLeaderId } = {},
) {
  const { rows } = await db.pool.query(
    `SELECT id FROM team_leaders
     WHERE team_id = $1
       AND people_id = $2
       AND ($5::text IS NULL OR id != $5)
       AND start_date <= COALESCE($4::date, DATE 'infinity')
       AND $3::date <= COALESCE(end_date, DATE 'infinity')
     LIMIT 1`,
    [teamId, peopleId, startDate, endDate ?? null, excludeLeaderId ?? null],
  );
  return rows[0] ?? null;
}

// Whichever color is currently most common among active team leaders
// sitewide (joining each active team_leaders row to that same person's
// active membership row on that team, for its color).
async function mostCommonActiveLeaderColor(queryable = db.pool) {
  const { rows } = await queryable.query(
    `SELECT tm.color, COUNT(*) AS count
     FROM team_leaders tl
     JOIN team_memberships tm ON tm.team_id = tl.team_id AND tm.people_id = tl.people_id AND tm.end_date IS NULL
     WHERE tl.end_date IS NULL AND tm.color IS NOT NULL
     GROUP BY tm.color
     ORDER BY count DESC
     LIMIT 1`,
  );
  return rows[0]?.color ?? null;
}

// Sets `peopleId` as `teamId`'s leader - end-dates the prior active leader
// (if any), inserts a new stint starting today, then auto-fills the new
// leader's membership `color` from mostCommonActiveLeaderColor() above,
// *only* when that membership doesn't already have an explicit color (an
// existing choice is never silently overwritten). Fully automatic, per the
// "Set Leader ... no manual entry required" rule.
async function setLeader({ teamId, peopleId, actorUserId }) {
  return db.withRetry(async (client) => {
    await client.query(
      'UPDATE team_leaders SET end_date = CURRENT_DATE, updated_by = $2, updated_at = now() WHERE team_id = $1 AND end_date IS NULL',
      [teamId, actorUserId],
    );

    const id = crypto.randomUUID();
    const { rows } = await client.query(
      `INSERT INTO team_leaders (id, team_id, people_id, created_by, updated_by) VALUES ($1, $2, $3, $4, $4) RETURNING *`,
      [id, teamId, peopleId, actorUserId],
    );

    const suggestedColor = await mostCommonActiveLeaderColor(client);
    if (suggestedColor) {
      await client.query(
        `UPDATE team_memberships
         SET color = $3, updated_by = $4, updated_at = now()
         WHERE team_id = $1 AND people_id = $2 AND end_date IS NULL AND color IS NULL`,
        [teamId, peopleId, suggestedColor, actorUserId],
      );
    }

    logger.debug(`Set new leader (people_id ${peopleId}) for team (id ${teamId}).`);
    return rows[0];
  });
}

// Ends the active leadership stint (if any), leaving the team at zero
// leaders. Also clears the color on their active membership row.
async function removeLeader(teamId, actorUserId) {
  return db.withRetry(async (client) => {
    const { rows } = await client.query(
      `UPDATE team_leaders
       SET end_date = CURRENT_DATE, updated_by = $2, updated_at = now()
       WHERE team_id = $1 AND end_date IS NULL
       RETURNING *`,
      [teamId, actorUserId],
    );
    const removed = rows[0];
    if (!removed) return null;

    await client.query(
      `UPDATE team_memberships
       SET color = NULL, updated_by = $3, updated_at = now()
       WHERE team_id = $1 AND people_id = $2 AND end_date IS NULL`,
      [teamId, removed.people_id, actorUserId],
    );

    logger.debug(`Removed active leader for team (id ${teamId}), clearing their membership color.`);
    return removed;
  });
}

// Corrects a leadership stint's dates
async function updateLeadershipStint(id, { startDate, endDate, actorUserId }) {
  const { rows } = await db.pool.query(
    `UPDATE team_leaders SET start_date = $2, end_date = $3, updated_by = $4, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, startDate, endDate ?? null, actorUserId],
  );
  logger.debug(`Updated leadership stint (id ${id}).`);
  return rows[0] ?? null;
}

// Permanently removes a leadership row outright - Admin-only, for rectifying
// a genuine data-entry mistake.
async function hardDeleteLeadershipRow(id) {
  await db.pool.query('DELETE FROM team_leaders WHERE id = $1', [id]);
  logger.debug(`Hard-deleted leadership row (id ${id}).`);
}

module.exports = {
  MEMBERSHIP_COLORS,
  getActiveLeader,
  listLeadershipHistoryForTeam,
  findLeadershipRowById,
  findOverlappingLeadershipStint,
  mostCommonActiveLeaderColor,
  setLeader,
  removeLeader,
  updateLeadershipStint,
  hardDeleteLeadershipRow,
};
