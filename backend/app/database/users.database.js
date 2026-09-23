const crypto = require('crypto');
const db = require('./pool.js');

const logger = require('../utils/logger.util.js');

// Upserts the `users` row linked to `peopleId` - creates it on a person's
// first-ever login, otherwise refreshes `email`.
async function upsertUserForPerson({ peopleId, email }) {
  const id = crypto.randomUUID();
  const { rows } = await db.pool.query(
    `INSERT INTO users (id, people_id, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (people_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now()
     RETURNING *`,
    [id, peopleId, email ?? null],
  );
  logger.debug(`Upserted users row for people_id ${peopleId}.`);
  return rows[0];
}

// Looks up a user (joined with their linked people row) by user id.
async function findUserWithPeopleById(userId) {
  const { rows } = await db.pool.query(
    `SELECT u.id, u.email, u.dob, p.id AS people_id, p.wca_id, p.wca_user_id, p.name, p.picture_url
     FROM users u
     JOIN people p ON p.id = u.people_id
     WHERE u.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

module.exports = { upsertUserForPerson, findUserWithPeopleById };
