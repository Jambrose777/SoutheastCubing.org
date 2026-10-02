const crypto = require('crypto');
const db = require('./pool.js');

const logger = require('../utils/logger.util.js');

// Looks up a person's current manage_competitions OAuth grant, or null if
// they've never granted it (or it was since revoked).
async function findByPeopleId(peopleId) {
  const { rows } = await db.pool.query(`SELECT * FROM wca_oauth_grants WHERE people_id = $1`, [
    peopleId,
  ]);
  return rows[0] ?? null;
}

// Creates or replaces peopleId's grant row.
async function upsertGrant({
  peopleId,
  scopes,
  accessTokenEncrypted,
  refreshTokenEncrypted,
  expiresAt,
}) {
  const id = crypto.randomUUID();
  const { rows } = await db.pool.query(
    `INSERT INTO wca_oauth_grants (id, people_id, scopes, access_token_encrypted, refresh_token_encrypted, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (people_id) DO UPDATE SET
       scopes = EXCLUDED.scopes,
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()
     RETURNING *`,
    [id, peopleId, scopes, accessTokenEncrypted, refreshTokenEncrypted, expiresAt],
  );
  logger.debug(`Upserted wca_oauth_grants row for people_id ${peopleId}.`);
  return rows[0];
}

// Deletes peopleId's grant row outright - the explicit-revoke path.
async function deleteByPeopleId(peopleId) {
  await db.pool.query(`DELETE FROM wca_oauth_grants WHERE people_id = $1`, [peopleId]);
  logger.debug(`Deleted wca_oauth_grants row for people_id ${peopleId}.`);
}

module.exports = { findByPeopleId, upsertGrant, deleteByPeopleId };
