const crypto = require('crypto');

// Number of random bytes in a raw session token before hex-encoding -
// 256 bits, comfortably unguessable.
const SESSION_TOKEN_BYTES = 32;

// Generates a new opaque session token - this is the value stored in the
// cookie and handed to the browser; only its hash is ever persisted server-side.
function generateSessionToken() {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

// Hashes a raw session token for storage/lookup in the `sessions` table -
// so a leaked database snapshot doesn't itself hand out valid session
// credentials, the same reasoning applied to it as a password hash.
function hashSessionToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

module.exports = { generateSessionToken, hashSessionToken };
