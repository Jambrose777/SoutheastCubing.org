const crypto = require('crypto');
const db = require('../pool.js');

const logger = require('../../utils/logger.util.js');

// Looks up a single `delegates` row by people_id. Returns null if this
// person has never been tracked as a Delegate.
async function findDelegateByPeopleId(peopleId) {
  const { rows } = await db.pool.query('SELECT * FROM delegates WHERE people_id = $1', [peopleId]);
  return rows[0] ?? null;
}

// Looks up a single `delegates` row by the underlying person's wca_id.
async function findDelegateByWcaId(wcaId) {
  const { rows } = await db.pool.query(
    `SELECT d.*
     FROM delegates d
     JOIN people p ON p.id = d.people_id
     WHERE p.wca_id = $1`,
    [wcaId],
  );
  return rows[0] ?? null;
}

// Creates a `delegates` row for `peopleId` if one doesn't already exist.
// Idempotent - ON CONFLICT DO NOTHING, then re-selects, so a concurrent
// insert race just resolves to the same row.
async function upsertDelegate(peopleId, actorId = null) {
  return db.withRetry(async (client) => {
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO delegates (id, people_id, created_by, updated_by) VALUES ($1, $2, $3, $3)
       ON CONFLICT (people_id) DO NOTHING`,
      [id, peopleId, actorId],
    );
    const { rows } = await client.query('SELECT * FROM delegates WHERE people_id = $1', [peopleId]);
    logger.debug(`Upserted delegates row for people_id ${peopleId}.`);
    return rows[0];
  });
}

// Every `delegates` row at once, each tagged with its person's wca_id.
async function listAllDelegatesWithWcaId() {
  const { rows } = await db.pool.query(
    `SELECT d.*, p.wca_id
     FROM delegates d
     JOIN people p ON p.id = d.people_id`,
  );
  return rows;
}

// Every `delegates` row at once, joined with its person's public-facing
// fields (name/wca_id/picture+crop).
async function listAllDelegatesWithPeople() {
  const { rows } = await db.pool.query(
    `SELECT d.id, d.bio, d.competitions_delegated_count,
            p.id AS people_id, p.name, p.wca_id, p.picture_url, p.has_managed_photo,
            p.thumbnail_crop_x, p.thumbnail_crop_y, p.thumbnail_crop_w, p.thumbnail_crop_h
     FROM delegates d
     JOIN people p ON p.id = d.people_id`,
  );
  return rows;
}

// Every rank row (open and closed) across every delegate at once, joined
// with its person's public-facing fields (name/wca_id/picture+crop).
async function listAllRankRowsWithPeople() {
  const { rows } = await db.pool.query(
    `SELECT drh.*, p.id AS people_id, p.name, p.wca_id, p.picture_url, p.has_managed_photo,
            p.thumbnail_crop_x, p.thumbnail_crop_y, p.thumbnail_crop_w, p.thumbnail_crop_h,
            d.competitions_delegated_count
     FROM delegate_rank_history drh
     JOIN people p ON p.id = drh.delegate_id
     JOIN delegates d ON d.people_id = p.id`,
  );
  return rows;
}

// Every state row (open and closed) across every delegate at once.
async function listAllStateRowsWithPeople() {
  const { rows } = await db.pool.query(
    `SELECT dsh.*, p.id AS people_id, p.name, p.wca_id, p.picture_url, p.has_managed_photo,
            p.thumbnail_crop_x, p.thumbnail_crop_y, p.thumbnail_crop_w, p.thumbnail_crop_h,
            d.competitions_delegated_count
     FROM delegate_state_history dsh
     JOIN people p ON p.id = dsh.delegate_id
     JOIN delegates d ON d.people_id = p.id`,
  );
  return rows;
}

// Every currently-open rank row across every delegate at once, each tagged
// with its person's wca_id.
async function listAllOpenRankRows() {
  const { rows } = await db.pool.query(
    `SELECT drh.*, p.wca_id
     FROM delegate_rank_history drh
     JOIN people p ON p.id = drh.delegate_id
     WHERE drh.end_date IS NULL`,
  );
  return rows;
}

// Opens a new rank row - a promotion. `startDate` is a 'YYYY-MM-DD' string.
async function openRankRow(peopleId, rank, startDate, actorId = null, endDate = null) {
  const id = crypto.randomUUID();
  const { rows } = await db.pool.query(
    `INSERT INTO delegate_rank_history (id, delegate_id, rank, start_date, end_date, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING *`,
    [id, peopleId, rank, startDate, endDate, actorId],
  );
  logger.debug(`Opened ${rank} rank row (id ${id}) for people_id ${peopleId}.`);
  return rows[0];
}

// Looks up a single rank-history row by id.
async function findRankRowById(id) {
  const { rows } = await db.pool.query('SELECT * FROM delegate_rank_history WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Edits a rank-history row's rank/start_date/end_date - a plain UPDATE by id.
async function updateRankRow(id, { rank, startDate, endDate, actorId = null }) {
  const { rows } = await db.pool.query(
    `UPDATE delegate_rank_history
     SET rank = $2, start_date = $3, end_date = $4, updated_by = $5, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, rank, startDate, endDate, actorId],
  );
  logger.debug(`Updated rank row (id ${id}).`);
  return rows[0] ?? null;
}

// Permanently deletes a rank-history row, irreversible.
async function hardDeleteRankRow(id) {
  await db.pool.query('DELETE FROM delegate_rank_history WHERE id = $1', [id]);
  logger.debug(`Deleted rank row (id ${id}).`);
}

// Closes an open rank row - a promotion/demotion. `endDate` is a 'YYYY-MM-DD' string
// (or a Date). Only closes it if it's still actually open (end_date IS NULL), so a
// caller can't accidentally stomp an already-closed historical row.
async function closeRankRow(rankRowId, endDate, actorId = null) {
  const { rows } = await db.pool.query(
    `UPDATE delegate_rank_history
     SET end_date = $2, updated_by = $3, updated_at = now()
     WHERE id = $1 AND end_date IS NULL
     RETURNING *`,
    [rankRowId, endDate, actorId],
  );
  logger.debug(`Closed rank row (id ${rankRowId}).`);
  return rows[0] ?? null;
}

// Every currently-open state row across every delegate at once, each tagged
// with its person's wca_id.
async function listAllOpenStateRows() {
  const { rows } = await db.pool.query(
    `SELECT dsh.*, p.wca_id
     FROM delegate_state_history dsh
     JOIN people p ON p.id = dsh.delegate_id
     WHERE dsh.end_date IS NULL`,
  );
  return rows;
}

// Reports whether any currently-active Delegate lacks a Discord user ID.
async function hasCurrentDelegatesMissingDiscordUserId() {
  const { rows } = await db.pool.query(
    `SELECT 1
     FROM delegates d
     WHERE d.discord_user_id IS NULL
       AND EXISTS (
         SELECT 1 FROM delegate_rank_history drh
         WHERE drh.delegate_id = d.people_id AND drh.end_date IS NULL
       )
       AND EXISTS (
         SELECT 1 FROM delegate_state_history dsh
         WHERE dsh.delegate_id = d.people_id AND dsh.end_date IS NULL
       )
     LIMIT 1`,
  );
  return rows.length > 0;
}

// Opens a new SE state row - moving into the Southeast, or moving from one
// SE state to another. `startDate` is a 'YYYY-MM-DD' string (or a Date).
async function openStateRow(peopleId, state, startDate, actorId = null, endDate = null) {
  const id = crypto.randomUUID();
  const { rows } = await db.pool.query(
    `INSERT INTO delegate_state_history (id, delegate_id, state, start_date, end_date, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING *`,
    [id, peopleId, state, startDate, endDate, actorId],
  );
  logger.debug(`Opened ${state} state row (id ${id}) for people_id ${peopleId}.`);
  return rows[0];
}

// Looks up a single state-history row by id.
async function findStateRowById(id) {
  const { rows } = await db.pool.query('SELECT * FROM delegate_state_history WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Edits a state-history row's state/start_date/end_date.
async function updateStateRow(id, { state, startDate, endDate, actorId = null }) {
  const { rows } = await db.pool.query(
    `UPDATE delegate_state_history
     SET state = $2, start_date = $3, end_date = $4, updated_by = $5, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, state, startDate, endDate, actorId],
  );
  logger.debug(`Updated state row (id ${id}).`);
  return rows[0] ?? null;
}

// Permanently deletes a state-history row - Admin-only, irreversible.
async function hardDeleteStateRow(id) {
  await db.pool.query('DELETE FROM delegate_state_history WHERE id = $1', [id]);
  logger.debug(`Deleted state row (id ${id}).`);
}

// Closes the open SE state row. `endDate` is a 'YYYY-MM-DD' string (or a
// Date). Only closes it if it's still actually open.
async function closeStateRow(stateRowId, endDate, actorId = null) {
  const { rows } = await db.pool.query(
    `UPDATE delegate_state_history
     SET end_date = $2, updated_by = $3, updated_at = now()
     WHERE id = $1 AND end_date IS NULL
     RETURNING *`,
    [stateRowId, endDate, actorId],
  );
  logger.debug(`Closed state row (id ${stateRowId}).`);
  return rows[0] ?? null;
}

// Refreshes competitions_delegated_count directly from the sync payload's
// total_delegated field - no separate per-delegate WCA call.
async function updateCompetitionsDelegatedCount(delegateId, count, actorId = null) {
  const { rows } = await db.pool.query(
    `UPDATE delegates
     SET competitions_delegated_count = $2, updated_by = $3, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [delegateId, count, actorId],
  );
  logger.debug(`Updated competitions_delegated_count for delegate_id ${delegateId} to ${count}.`);
  return rows[0] ?? null;
}

// Every rank row (open and closed) for one person, most-recently-started
// first.
async function listRankRowsForDelegate(peopleId) {
  const { rows } = await db.pool.query(
    'SELECT * FROM delegate_rank_history WHERE delegate_id = $1 ORDER BY start_date DESC',
    [peopleId],
  );
  return rows;
}

// Every state row (open and closed) for one person, most-recently-started
// first.
async function listStateRowsForDelegate(peopleId) {
  const { rows } = await db.pool.query(
    'SELECT * FROM delegate_state_history WHERE delegate_id = $1 ORDER BY start_date DESC',
    [peopleId],
  );
  return rows;
}

// Sets a delegate's own bio.
async function updateBio(delegateId, bio, actorId = null) {
  const { rows } = await db.pool.query(
    `UPDATE delegates
     SET bio = $2, updated_by = $3, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [delegateId, bio, actorId],
  );
  logger.debug(`Updated bio for delegate_id ${delegateId}.`);
  return rows[0] ?? null;
}

// Sets a Delegate's Discord user ID on their behalf.
async function updateDiscordUserId(delegateId, discordUserId, actorId = null) {
  const { rows } = await db.pool.query(
    `UPDATE delegates
     SET discord_user_id = $2, updated_by = $3, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [delegateId, discordUserId, actorId],
  );
  logger.debug(`Updated Discord user ID for delegate_id ${delegateId}.`);
  return rows[0] ?? null;
}

// Every currently-open rank a person holds (via their delegates row), as
// plain rank strings - the shared role-derivation helper's raw input for
// resolving `delegateRank` (see roles.helper.js's getCurrentRoles). Returns
// an empty array for someone who isn't (or never has been) a Delegate.
// Deriving the single highest rank for display/authorization from this list
// is the caller's job, not this database layer's - it doesn't require a
// `delegates` row to exist at all up front.
async function getOpenRanksForPerson(peopleId) {
  const { rows } = await db.pool.query(
    'SELECT rank FROM delegate_rank_history WHERE delegate_id = $1 AND end_date IS NULL',
    [peopleId],
  );
  return rows.map((row) => row.rank);
}

// Returns the subset of `peopleIds` currently holding an open Delegate rank.
async function findOpenDelegatePeopleIds(peopleIds) {
  if (!peopleIds.length) return [];
  const { rows } = await db.pool.query(
    'SELECT DISTINCT delegate_id FROM delegate_rank_history WHERE delegate_id = ANY($1) AND end_date IS NULL',
    [peopleIds],
  );
  return rows.map((row) => row.delegate_id);
}

module.exports = {
  findDelegateByPeopleId,
  findDelegateByWcaId,
  upsertDelegate,
  listAllDelegatesWithWcaId,
  listAllDelegatesWithPeople,
  listAllRankRowsWithPeople,
  listAllStateRowsWithPeople,
  listAllOpenRankRows,
  findOpenDelegatePeopleIds,
  openRankRow,
  closeRankRow,
  findRankRowById,
  updateRankRow,
  hardDeleteRankRow,
  listAllOpenStateRows,
  openStateRow,
  closeStateRow,
  findStateRowById,
  hasCurrentDelegatesMissingDiscordUserId,
  updateStateRow,
  hardDeleteStateRow,
  updateCompetitionsDelegatedCount,
  getOpenRanksForPerson,
  listRankRowsForDelegate,
  listStateRowsForDelegate,
  updateBio,
  updateDiscordUserId,
};
