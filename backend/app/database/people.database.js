const crypto = require('crypto');
const db = require('./pool.js');

// Logger
const logger = require('../utils/logger.util.js');

// Looks up an existing `people` row by wca_id (preferred, when present) or
// wca_user_id (fallback) - matches on whichever identifier a caller has, per
// the upsert-by-wca_id-falling-back-to-wca_user_id rule shared by every
// writer of this table.
async function findPersonByWcaIdentifiers(queryable, { wcaId, wcaUserId }) {
  const { rows } = await queryable.query(
    'SELECT * FROM people WHERE wca_id = $1 OR wca_user_id = $2 LIMIT 1',
    [wcaId ?? null, wcaUserId],
  );
  return rows[0] ?? null;
}

// Upserts a `people` row from a WCA OAuth profile (GET /api/v0/me) - creates
// a new row the first time this wca_user_id is seen, or claims/updates an
// existing row. `picture_url` (and wca_picture_source_url) is left untouched 
// whenever the existing row has picture_synced_with_wca = false, so a manual 
// override is never silently clobbered by a login.
async function upsertPersonFromWcaProfile({ wcaId, wcaUserId, name, pictureUrl }) {
  const attempt = async () =>
    db.withRetry(async (client) => {
      const existing = await findPersonByWcaIdentifiers(client, { wcaId, wcaUserId });

      // If an existing row is found, update it with the new WCA profile data.
      if (existing) {
        const shouldSyncPicture = existing.picture_synced_with_wca;
        const { rows } = await client.query(
          `UPDATE people
           SET wca_id = COALESCE($1, wca_id),
               wca_user_id = $2,
               name = $3,
               picture_url = CASE WHEN $4 THEN $5 ELSE picture_url END,
               wca_picture_source_url = CASE WHEN $4 THEN $5 ELSE wca_picture_source_url END,
               updated_at = now()
           WHERE id = $6
           RETURNING *`,
          [wcaId ?? null, wcaUserId, name, shouldSyncPicture, pictureUrl ?? null, existing.id],
        );
        logger.debug(`Updated existing people row (id ${existing.id}) from a WCA login.`);
        return rows[0];
      }

      const id = crypto.randomUUID();
      const { rows } = await client.query(
        `INSERT INTO people (id, wca_id, wca_user_id, name, picture_url, wca_picture_source_url)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING *`,
        [id, wcaId ?? null, wcaUserId, name, pictureUrl ?? null],
      );
      logger.debug(`Created a new people row (id ${id}) from a WCA login.`);
      return rows[0];
    });

  try {
    return await attempt();
  } catch (err) {
    // Two concurrent logins for a brand-new wca_user_id can both miss the
    // SELECT above and then race the INSERT - a unique_violation here means
    // the other one won, so retrying once now finds (and updates) their row
    // instead of failing the request.
    if (err.code === '23505') {
      logger.warn('people upsert hit a concurrent-insert race, retrying once.');
      return attempt();
    }
    throw err;
  }
}

module.exports = { upsertPersonFromWcaProfile };
