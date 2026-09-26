const { imageSize } = require('image-size');

const peopleDb = require('../database/people.database.js');
const wcaIntegration = require('../integrations/wca.integration.js');
const photoStorage = require('../integrations/photoStorage.integration.js');
const { httpError } = require('../helpers/httpError.helper.js');

const logger = require('../utils/logger.util.js');

// Eevery place a managed photo is actually shown expects a square thumbnail. 
// Computes a centered best-fit square, the size of the shorter dimension,
// centered along the longer one. Throws if the buffer isn't a
// decodable/recognized image - a broken crop should never be silently stored.
function computeDefaultCrop(buffer) {
  const { width, height } = imageSize(buffer);
  const size = Math.min(width, height);
  return {
    cropX: Math.floor((width - size) / 2),
    cropY: Math.floor((height - size) / 2),
    cropW: size,
    cropH: size,
  };
}

// Builds the storage key a person's managed photo lives under.
function photoKeyFor(peopleId) {
  return `${peopleId}.jpg`;
}

// Downloads `avatarUrl` and stores it under this person's own key. Every
// person's key is fixed (photoKeyFor), so store() overwrites the prior
// object in place. Exported - reused as-is by
// backend/scripts/backfill-people-pictures.js's own one-off mirroring loop.
async function mirrorWcaAvatar(peopleId, avatarUrl) {
  const buffer = await wcaIntegration.fetchAvatarImage(avatarUrl);
  const crop = computeDefaultCrop(buffer);
  const key = photoKeyFor(peopleId);
  await photoStorage.store(key, buffer);
  return { key, crop };
}

// Looks up `wcaId`'s current avatar URL on WCA.
async function resolveCurrentWcaAvatarUrl(wcaId) {
  const wcaPerson = await wcaIntegration.fetchPersonByWcaId(wcaId);
  return wcaPerson?.avatar?.url ?? wcaPerson?.avatar?.thumb_url ?? null;
}

// Promotes `peopleId` into a managed photo - a no-op if they already have
// one, so repeat calls never reset an existing managed photo/crop. Mirrors their current
// WCA avatar into storage, then sets picture_url/wca_picture_source_url/
// has_managed_photo via people.database.js's setManagedPhoto.
async function promoteToManagedPhoto(peopleId) {
  // Check person's data in our database.
  const person = await peopleDb.findPersonById(peopleId);
  if (!person) {
    logger.warn(`promoteToManagedPhoto called for unknown people_id ${peopleId} - skipping.`);
    return null;
  }
  if (person.has_managed_photo) {
    return person;
  }
  if (!person.wca_id) {
    logger.warn(`promoteToManagedPhoto called for people_id ${peopleId} with no wca_id - skipping.`);
    return person;
  }

  // Fetch person and avatar from WCA. 
  const avatarUrl = await resolveCurrentWcaAvatarUrl(person.wca_id);
  if (!avatarUrl) {
    logger.warn(
      `promoteToManagedPhoto found no WCA avatar for people_id ${peopleId} (wca_id ${person.wca_id}) - skipping.`,
    );
    return person;
  }

  // Store their avatar on our system.
  const { key, crop } = await mirrorWcaAvatar(peopleId, avatarUrl);
  const updated = await peopleDb.setManagedPhoto(peopleId, {
    pictureKey: key,
    wcaPictureSourceUrl: avatarUrl,
    pictureSyncedWithWca: true,
    ...crop,
  });
  logger.info(`Promoted people_id ${peopleId} to a managed photo.`);
  return updated;
}

// Re-mirrors a managed photo from WCA - only actually re-downloads/re-stores
// when WCA's avatar URL has genuinely changed since the last mirror, unless
// the current photo isn't from WCA at all. Resets the crop to
// default on an actual mirror. This is also the explicit "Sync with WCA"
// action (re-enabling sync after an upload turned it off).
async function resyncWithWca(peopleId) {
  const person = await peopleDb.findPersonById(peopleId);
  if (!person || !person.has_managed_photo || !person.wca_id) {
    return person ?? null;
  }

  // Fetch person and avatar from WCA.
  const avatarUrl = await resolveCurrentWcaAvatarUrl(person.wca_id);
  const alreadySyncedToThisAvatar =
    person.picture_synced_with_wca && avatarUrl === person.wca_picture_source_url;
  if (!avatarUrl || alreadySyncedToThisAvatar) {
    if (!person.picture_synced_with_wca) {
      return peopleDb.setPictureSyncedWithWca(peopleId, true);
    }
    return person;
  }

  // Store their avatar on our system.
  const { key, crop } = await mirrorWcaAvatar(peopleId, avatarUrl);
  const updated = await peopleDb.setManagedPhoto(peopleId, {
    pictureKey: key,
    wcaPictureSourceUrl: avatarUrl,
    pictureSyncedWithWca: true,
    ...crop,
  });
  logger.info(`Resynced managed photo for people_id ${peopleId} from WCA.`);
  return updated;
}

// Sets the sync toggle directly - `enabled = true` delegates to resyncWithWca().
async function setSyncEnabled(peopleId, enabled) {
  if (enabled) {
    return resyncWithWca(peopleId);
  }
  const person = await peopleDb.findPersonById(peopleId);
  if (!person || !person.has_managed_photo) {
    throw httpError(400, 'This person does not have a managed photo to toggle sync on.');
  }
  return peopleDb.setPictureSyncedWithWca(peopleId, false);
}

// Called after every successful login upsert for a
// person with a managed photo and sync currently on.
async function resyncOnLoginIfNeeded(peopleId) {
  const person = await peopleDb.findPersonById(peopleId);
  if (!person || !person.has_managed_photo || !person.picture_synced_with_wca) {
    return;
  }
  await resyncWithWca(peopleId);
}

// Replaces a managed photo with a manual upload - marks it no longer
// WCA-synced, and resets the crop to default the same way a resync does, 
// since the underlying photo changed.
async function uploadPhoto(peopleId, buffer) {
  const person = await peopleDb.findPersonById(peopleId);
  if (!person || !person.has_managed_photo) {
    throw httpError(400, 'This person does not have a managed photo to upload to.');
  }

  const crop = computeDefaultCrop(buffer);
  const key = photoKeyFor(peopleId);
  await photoStorage.store(key, buffer);
  const updated = await peopleDb.setManagedPhoto(peopleId, {
    pictureKey: key,
    wcaPictureSourceUrl: person.wca_picture_source_url,
    pictureSyncedWithWca: false,
    ...crop,
  });
  logger.info(`Uploaded a new managed photo for people_id ${peopleId}.`);
  return updated;
}

// Updates the thumbnail crop on an already-managed photo.
async function updateThumbnailCrop(peopleId, { cropX, cropY, cropW, cropH }) {
  const person = await peopleDb.findPersonById(peopleId);
  if (!person || !person.has_managed_photo) {
    throw httpError(400, 'This person does not have a managed photo to crop.');
  }
  return peopleDb.updateThumbnailCrop(peopleId, { cropX, cropY, cropW, cropH });
}

module.exports = {
  promoteToManagedPhoto,
  resyncWithWca,
  setSyncEnabled,
  resyncOnLoginIfNeeded,
  uploadPhoto,
  updateThumbnailCrop,
  mirrorWcaAvatar,
  resolveCurrentWcaAvatarUrl,
};
