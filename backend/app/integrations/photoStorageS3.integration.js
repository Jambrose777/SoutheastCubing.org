// S3-backed implementation of the photo storage interface
// (store/delete/resolveUrl), used in place of
// photoStorageFilesystem.integration.js once PHOTOS_S3_BUCKET/PHOTOS_S3_REGION/
// PHOTOS_S3_ACCESS_KEY_ID/PHOTOS_S3_SECRET_ACCESS_KEY/PHOTOS_BASE_URL are all
// set - see photoStorage.integration.js for the selector.
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const { config } = require('../config/config.js');
const logger = require('../utils/logger.util.js');

// How long a presigned GET URL stays valid for. Generated fresh on every
// redirect rather than cached, so this just needs to outlive one browser
// fetch.
const PRESIGNED_URL_EXPIRES_IN_SECONDS = 300;

const client = new S3Client({
  region: config.PHOTOS_S3_REGION,
  credentials: {
    accessKeyId: config.PHOTOS_S3_ACCESS_KEY_ID,
    secretAccessKey: config.PHOTOS_S3_SECRET_ACCESS_KEY,
  },
});

// Writes `buffer` to the bucket under `key`. Overwrites any existing object
// at the same key, the same way the filesystem implementation does.
async function store(key, buffer) {
  try {
    await client.send(
      new PutObjectCommand({ Bucket: config.PHOTOS_S3_BUCKET, Key: key, Body: buffer }),
    );
    logger.debug(`Stored photo in S3 (bucket ${config.PHOTOS_S3_BUCKET}, key ${key}).`);
  } catch (err) {
    logger.error(
      `Failed to store photo in S3 (bucket ${config.PHOTOS_S3_BUCKET}, key ${key}): `,
      err,
    );
    throw err;
  }
}

// Deletes the object at `key`, if it exists. S3's DeleteObject is already a
// no-op (not an error) when the key doesn't exist, matching the filesystem
// implementation's ENOENT-swallowing behavior with no special-casing needed.
async function deleteObject(key) {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: config.PHOTOS_S3_BUCKET, Key: key }));
    logger.debug(`Deleted photo from S3 (bucket ${config.PHOTOS_S3_BUCKET}, key ${key}).`);
  } catch (err) {
    logger.error(
      `Failed to delete photo from S3 (bucket ${config.PHOTOS_S3_BUCKET}, key ${key}): `,
      err,
    );
    throw err;
  }
}

// Resolves a stored key to this backend's own redirect route URL - kept
// synchronous to match the shared interface.
function resolveUrl(key) {
  return `${config.PHOTOS_BASE_URL}/photos/s3/${key}`;
}

// The actual async presigned-URL lookup, used by photos.controller.js's
// GET /photos/s3/:key handler.
async function generatePresignedGetUrl(key) {
  try {
    const command = new GetObjectCommand({ Bucket: config.PHOTOS_S3_BUCKET, Key: key });
    const url = await getSignedUrl(client, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_IN_SECONDS,
    });
    logger.debug(`Generated a presigned URL for S3 photo (key ${key}).`);
    return url;
  } catch (err) {
    logger.error(`Failed to generate a presigned URL for S3 photo (key ${key}): `, err);
    throw err;
  }
}

module.exports = { store, delete: deleteObject, resolveUrl, generatePresignedGetUrl };
