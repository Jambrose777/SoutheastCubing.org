const db = require('./pool.js');
const { FIXED_TEAM_IDS } = require('../helpers/fixedTeams.helper.js');

const logger = require('../utils/logger.util.js');

// Lists every team (fixed and ordinary, including archived/hidden ones)
async function listTeams() {
  const { rows } = await db.pool.query('SELECT * FROM teams ORDER BY name');
  return rows;
}

// Finds a single team by its ID
async function findTeamById(teamId) {
  const { rows } = await db.pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
  return rows[0] ?? null;
}

// Converts a team name into the same readable, underscore-separated id
// format the fixed/migration-seeded teams already use (e.g. 'clubs_team',
// 'board_liaisons') - so a dashboard-created team's id looks identical to
// one seeded by migration. Assumes `name` has at least one letter/number.
function slugifyTeamName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Creates a new team. `actorUserId` is the Board/Admin user performing the
// action (req.user.id), recorded as both created_by and updated_by. Throws
// the raw pg error (code 23505) on an id collision (e.g. a team with an
// identical, or punctuation/case-differing, name already exists).
async function createTeam({ name, description, email, hidden, actorUserId }) {
  const id = slugifyTeamName(name);
  const { rows } = await db.pool.query(
    `INSERT INTO teams (id, name, description, email, hidden, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING *`,
    [id, name, description ?? null, email ?? null, !!hidden, actorUserId],
  );
  logger.debug(`Created a new team (id ${id}).`);
  return rows[0];
}

// Updates a team's name/description/email/hidden flag. `name` and `hidden`
// are silently ignored for a fixed team (Admin/Board/Officers/Board
// Liaisons) - callers are expected to have already rejected changes to
// those for those before reaching here, this is just a last line of
// defense against either ever actually changing on a fixed team.
async function updateTeam(teamId, { name, description, email, hidden, actorUserId }) {
  const { rows } = await db.pool.query(
    `UPDATE teams
     SET name = CASE WHEN id = ANY($2) THEN name ELSE $3 END,
         description = $4,
         email = $5,
         hidden = CASE WHEN id = ANY($2) THEN hidden ELSE $6 END,
         updated_by = $7,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [teamId, FIXED_TEAM_IDS, name, description ?? null, email ?? null, !!hidden, actorUserId],
  );
  logger.debug(`Updated team (id ${teamId}).`);
  return rows[0] ?? null;
}

// Archives an ordinary team - end-dates every currently-active membership
// and leadership row on it in the same transaction, so an archived team
// never retains any "still active" rows. Never called for a fixed team.
async function archiveTeam(teamId, actorUserId) {
  return db.withRetry(async (client) => {
    await client.query(
      'UPDATE team_memberships SET end_date = CURRENT_DATE, updated_by = $2, updated_at = now() WHERE team_id = $1 AND end_date IS NULL',
      [teamId, actorUserId],
    );
    await client.query(
      'UPDATE team_leaders SET end_date = CURRENT_DATE, updated_by = $2, updated_at = now() WHERE team_id = $1 AND end_date IS NULL',
      [teamId, actorUserId],
    );
    const { rows } = await client.query(
      'UPDATE teams SET archived_at = now(), updated_by = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [teamId, actorUserId],
    );
    logger.debug(`Archived team (id ${teamId}), end-dated its active membership/leadership rows.`);
    return rows[0] ?? null;
  });
}

// Unarchives a team - does not retroactively restore any end-dated rows.
async function unarchiveTeam(teamId, actorUserId) {
  const { rows } = await db.pool.query(
    'UPDATE teams SET archived_at = NULL, updated_by = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [teamId, actorUserId],
  );
  logger.debug(`Unarchived team (id ${teamId}).`);
  return rows[0] ?? null;
}

// Permanently removes a team and every membership/leadership row that
// points at it - Admin-only (enforced by roles.middleware.js's
// requireAdmin), for rectifying a genuine data-entry mistake rather than
// recording a real-world departure. Never called for a fixed team.
async function hardDeleteTeam(teamId) {
  return db.withRetry(async (client) => {
    await client.query('DELETE FROM team_leaders WHERE team_id = $1', [teamId]);
    await client.query('DELETE FROM team_memberships WHERE team_id = $1', [teamId]);
    await client.query('DELETE FROM teams WHERE id = $1', [teamId]);
    logger.debug(`Hard-deleted team (id ${teamId}) and its membership/leadership rows.`);
  });
}

module.exports = {
  listTeams,
  findTeamById,
  createTeam,
  updateTeam,
  archiveTeam,
  unarchiveTeam,
  hardDeleteTeam,
};
