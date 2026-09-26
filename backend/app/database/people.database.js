const crypto = require('crypto');
const db = require('./pool.js');

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
// whenever the existing row has picture_synced_with_wca = false (a manual
// override), or has_managed_photo = true (a managed photo is only ever
// touched via photos.service.js's own resync/upload/promotion paths, never
// this plain login upsert - even with sync on, the managed-photo resync is
// its own explicit call, not folded into every login).
async function upsertPersonFromWcaProfile({ wcaId, wcaUserId, name, pictureUrl }) {
  const attempt = async () =>
    db.withRetry(async (client) => {
      const existing = await findPersonByWcaIdentifiers(client, { wcaId, wcaUserId });

      // If an existing row is found, update it with the new WCA profile data.
      if (existing) {
        const shouldSyncPicture = existing.picture_synced_with_wca && !existing.has_managed_photo;
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

// Upserts a `people` row "add by WCA ID" fallback
// (GET /api/v0/persons/:wca_id, proxied via wca.integration.js) - unlike a
// WCA login, that lookup never yields a wca_user_id, so this can only ever
// match/create by wca_id. `picture_url` is likewise skipped whenever the
// existing row has picture_synced_with_wca = false, or has_managed_photo =
// true (see upsertPersonFromWcaProfile's comment above for why).
async function upsertPersonFromWcaIdLookup({ wcaId, name, pictureUrl }) {
  return db.withRetry(async (client) => {
    // Look for an existing person by WCA ID.
    const { rows: existingRows } = await client.query(
      'SELECT * FROM people WHERE wca_id = $1 LIMIT 1',
      [wcaId],
    );
    const existing = existingRows[0];

    if (existing) {
      const shouldSyncPicture = existing.picture_synced_with_wca && !existing.has_managed_photo;
      const { rows } = await client.query(
        `UPDATE people
         SET name = $1,
             picture_url = CASE WHEN $2 THEN $3 ELSE picture_url END,
             wca_picture_source_url = CASE WHEN $2 THEN $3 ELSE wca_picture_source_url END,
             updated_at = now()
         WHERE id = $4
         RETURNING *`,
        [name, shouldSyncPicture, pictureUrl ?? null, existing.id],
      );
      logger.debug(`Updated existing people row (id ${existing.id}) from a Team/Board add.`);
      return rows[0];
    }

    const id = crypto.randomUUID();
    const { rows } = await client.query(
      `INSERT INTO people (id, wca_id, name, picture_url, wca_picture_source_url)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING *`,
      [id, wcaId, name, pictureUrl ?? null],
    );
    logger.debug(`Created a new people row (id ${id}) from a Team/Board add.`);
    return rows[0];
  });
}

// Promotes a person into a managed photo (or updates their existing managed
// photo on a resync/upload) - sets picture_url to the new stored object's
// key, wca_picture_source_url to the WCA avatar URL that was mirrored (null
// for a manual upload, which isn't mirrored from any WCA URL), and
// has_managed_photo to true. Also accepts the crop columns so a resync/
// upload can reset them to a default in the same write.
async function setManagedPhoto(
  peopleId,
  { pictureKey, wcaPictureSourceUrl, pictureSyncedWithWca, cropX, cropY, cropW, cropH },
) {
  const { rows } = await db.pool.query(
    `UPDATE people
     SET picture_url = $2,
         wca_picture_source_url = $3,
         picture_synced_with_wca = $4,
         has_managed_photo = true,
         thumbnail_crop_x = $5,
         thumbnail_crop_y = $6,
         thumbnail_crop_w = $7,
         thumbnail_crop_h = $8,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [peopleId, pictureKey, wcaPictureSourceUrl ?? null, pictureSyncedWithWca, cropX, cropY, cropW, cropH],
  );
  logger.debug(`Set managed photo for people_id ${peopleId}.`);
  return rows[0] ?? null;
}

// Flips only picture_synced_with_wca, leaving picture_url/wca_picture_source_url/
// crop untouched - used when re-enabling sync but there's nothing new to
// actually mirror.
async function setPictureSyncedWithWca(peopleId, pictureSyncedWithWca) {
  const { rows } = await db.pool.query(
    `UPDATE people
     SET picture_synced_with_wca = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [peopleId, pictureSyncedWithWca],
  );
  logger.debug(`Set picture_synced_with_wca=${pictureSyncedWithWca} for people_id ${peopleId}.`);
  return rows[0] ?? null;
}

// Updates only the thumbnail crop columns on an already-managed photo.
async function updateThumbnailCrop(peopleId, { cropX, cropY, cropW, cropH }) {
  const { rows } = await db.pool.query(
    `UPDATE people
     SET thumbnail_crop_x = $2,
         thumbnail_crop_y = $3,
         thumbnail_crop_w = $4,
         thumbnail_crop_h = $5,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [peopleId, cropX, cropY, cropW, cropH],
  );
  logger.debug(`Updated thumbnail crop for people_id ${peopleId}.`);
  return rows[0] ?? null;
}

// Looks up a single `people` row by id
async function findPersonById(peopleId) {
  const { rows } = await db.pool.query('SELECT * FROM people WHERE id = $1', [peopleId]);
  return rows[0] ?? null;
}

// Backs the Add/Edit Member sheet's search-as-you-type combobox - matches
// partial name plus exact wca_id/wca_user_id/people.id/users.email, all
// case-insensitive, capped at `limit` results. Deliberately server-side (not 
// a fetch-all-and-filter) since users.email is sensitive and shouldn't ship 
// to the browser in bulk just to power a search box.
async function searchPeople(searchTerm, { limit = 10 } = {}) {
  const { rows } = await db.pool.query(
    `SELECT p.id, p.name, p.picture_url, p.wca_id, p.wca_user_id, p.has_managed_photo,
            p.thumbnail_crop_x, p.thumbnail_crop_y, p.thumbnail_crop_w, p.thumbnail_crop_h,
            u.email, (u.id IS NOT NULL) AS has_account
     FROM people p
     LEFT JOIN users u ON u.people_id = p.id
     WHERE p.name ILIKE $1
        OR p.wca_id ILIKE $2
        OR p.wca_user_id ILIKE $2
        OR p.id ILIKE $2
        OR u.email ILIKE $2
     ORDER BY p.name
     LIMIT $3`,
    [`%${searchTerm}%`, searchTerm, limit],
  );
  return rows;
}

module.exports = {
  upsertPersonFromWcaProfile,
  upsertPersonFromWcaIdLookup,
  setManagedPhoto,
  setPictureSyncedWithWca,
  updateThumbnailCrop,
  findPersonById,
  searchPeople,
};
