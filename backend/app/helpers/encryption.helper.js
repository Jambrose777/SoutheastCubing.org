const crypto = require('crypto');

const { config } = require('../config/config.js');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

// Accepts TOKEN_ENCRYPTION_KEY as base64 or hex, as long as it decodes to
// exactly 32 bytes (AES-256's key size).
function loadKey() {
  const raw = config.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set - cannot encrypt/decrypt OAuth tokens.');
  }
  const key = Buffer.from(raw, raw.length === 64 ? 'hex' : 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

// Encrypts `plaintext`, returning a single self-contained string.
function encrypt(plaintext) {
  const key = loadKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

// Reverses encrypt() - throws if `encrypted` was tampered with or produced
// with a different key (GCM's auth tag check fails closed).
function decrypt(encrypted) {
  const key = loadKey();
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted value - expected "iv:authTag:ciphertext".');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

// True once TOKEN_ENCRYPTION_KEY is set - callers check this before
// attempting a manage_competitions grant rather than letting encrypt() throw.
function isEncryptionConfigured() {
  return !!config.TOKEN_ENCRYPTION_KEY;
}

module.exports = { encrypt, decrypt, isEncryptionConfigured };
