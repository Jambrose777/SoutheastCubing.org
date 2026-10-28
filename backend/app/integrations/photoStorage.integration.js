// Storage abstraction for managed photos (people.picture once
// has_managed_photo is true) - selects between the local-filesystem and
// S3-backed implementations based on config.
const { config } = require('../config/config.js');

const filesystemImpl = require('./photoStorageFilesystem.integration.js');
const s3Impl = require('./photoStorageS3.integration.js');

// True once every S3 config var is present - local dev never sets these, so
// it always stays on the filesystem implementation.
const isS3Configured = !!(
  config.PHOTOS_S3_BUCKET &&
  config.PHOTOS_S3_REGION &&
  config.PHOTOS_S3_ACCESS_KEY_ID &&
  config.PHOTOS_S3_SECRET_ACCESS_KEY &&
  config.PHOTOS_BASE_URL
);

const activeImpl = isS3Configured ? s3Impl : filesystemImpl;

module.exports = {
  // Filesystem-specific - only meaningful when the filesystem implementation
  // is active; app.js only reads these under its own NODE_ENV !== production
  // guard, where that's always the case.
  PHOTOS_DIR: filesystemImpl.PHOTOS_DIR,
  PHOTOS_URL_PREFIX: filesystemImpl.PHOTOS_URL_PREFIX,
  isS3Configured,
  store: activeImpl.store,
  delete: activeImpl.delete,
  resolveUrl: activeImpl.resolveUrl,
};
