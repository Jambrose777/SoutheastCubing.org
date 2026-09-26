// Storage abstraction for managed photos (people.picture_url once
// has_managed_photo is true). This file's implementation is
// local-filesystem-backed serving reads via a plain Express static route.
const fs = require('fs/promises');
const path = require('path');

const logger = require('../utils/logger.util.js');

// Every managed photo lives here, keyed by a caller-supplied key.
const PHOTOS_DIR = path.join(__dirname, '../../uploads/photos');

// The path prefix app.js serves PHOTOS_DIR under.
const PHOTOS_URL_PREFIX = '/photos';

// The origin resolveUrl() below builds full URLs against.
const PHOTOS_BASE_URL = 'http://localhost:8080';

// Writes `buffer` to storage under `key`, creating the storage directory on
// first use. Overwrites any existing object at the same key.
async function store(key, buffer) {
  await fs.mkdir(PHOTOS_DIR, { recursive: true });
  await fs.writeFile(path.join(PHOTOS_DIR, key), buffer);
  logger.debug(`Stored photo (key ${key}).`);
}

// Deletes the object at `key`, if it exists.
async function deleteObject(key) {
  try {
    await fs.unlink(path.join(PHOTOS_DIR, key));
    logger.debug(`Deleted photo (key ${key}).`);
  } catch (err) {
    // Ignore no such file error.
    if (err.code === 'ENOENT') return;
    throw err;
  }
}

// Resolves a stored key to an absolute URL the frontend can load the photo
// from, regardless of what origin the frontend itself is served from.
function resolveUrl(key) {
  return `${PHOTOS_BASE_URL}${PHOTOS_URL_PREFIX}/${key}`;
}

module.exports = { PHOTOS_DIR, PHOTOS_URL_PREFIX, store, delete: deleteObject, resolveUrl };
