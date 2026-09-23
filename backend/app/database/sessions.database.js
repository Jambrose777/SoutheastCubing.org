const db = require('./pool.js');
const { hashSessionToken } = require('../helpers/session.helper.js');

const logger = require('../utils/logger.util.js');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Only rewrite expires_at once more than this much time has passed since it
// was last refreshed, so an actively-used session doesn't take a DB write on
// every single request.
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day

// Creates a new session row for `userId`, keyed by the hash of `rawToken`
// (the value actually stored in the cookie).
async function createSession({ rawToken, userId, ipAddress }) {
  const id = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.pool.query(
    'INSERT INTO sessions (id, user_id, ip_address, expires_at) VALUES ($1, $2, $3, $4)',
    [id, userId, ipAddress ?? null, expiresAt],
  );
  logger.debug('Created a new session.');
  return { id, expiresAt };
}

// Looks up a still-valid session by its raw cookie token, sliding its expiry
// forward when it's gotten reasonably close to stale. Returns null for a
// missing/expired session - callers treat that identically to "not signed in".
async function findValidSessionAndTouch(rawToken) {
  const id = hashSessionToken(rawToken);
  const { rows } = await db.pool.query(
    'SELECT id, user_id, expires_at FROM sessions WHERE id = $1 AND expires_at > now()',
    [id],
  );
  const session = rows[0];
  if (!session) return null;

  // Update the session's expiry if it's gotten close to stale.
  const msUntilExpiry = new Date(session.expires_at).getTime() - Date.now();
  if (msUntilExpiry < SESSION_TTL_MS - REFRESH_THRESHOLD_MS) {
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.pool.query('UPDATE sessions SET expires_at = $1 WHERE id = $2', [newExpiresAt, id]);
    logger.debug('Slid a session\'s expiry forward.');
  }

  return session;
}

// Deletes a session row outright (immediate revocation on sign-out), rather
// than only clearing the cookie client-side.
async function deleteSession(rawToken) {
  const id = hashSessionToken(rawToken);
  await db.pool.query('DELETE FROM sessions WHERE id = $1', [id]);
  logger.debug('Deleted a session on sign-out.');
}

// Purges rows for sessions that have already naturally expired.
async function deleteExpiredSessions() {
  const { rowCount } = await db.pool.query('DELETE FROM sessions WHERE expires_at < now()');
  logger.debug(`Purged ${rowCount} expired session(s).`);
  return rowCount;
}

module.exports = {
  SESSION_TTL_MS,
  createSession,
  findValidSessionAndTouch,
  deleteSession,
  deleteExpiredSessions,
};
