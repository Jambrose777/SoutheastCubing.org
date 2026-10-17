const photosService = require('../services/people/photos.service.js');
const { respondWithServiceError } = require('../helpers/httpError.helper.js');

// PUT /dashboard/my-info/photo/sync - sets the signed-in user's own sync
// toggle. Enabling re-mirrors from WCA if their avatar has actually changed;
// disabling just freezes the current managed photo/crop in place.
async function setSyncEnabled(req, res) {
  try {
    await photosService.setSyncEnabled(req.user.people_id, !!req.body?.enabled);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update photo sync');
  }
}

// POST /dashboard/my-info/photo/upload - replaces the signed-in user's own
// managed photo with an uploaded file.
async function uploadPhoto(req, res) {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded.' });
      return;
    }
    await photosService.uploadPhoto(req.user.people_id, req.file.buffer);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to upload photo');
  }
}

// PUT /dashboard/my-info/photo/crop - updates the signed-in user's own
// managed photo's thumbnail crop.
async function updateCrop(req, res) {
  try {
    const { cropX, cropY, cropW, cropH } = req.body;
    await photosService.updateThumbnailCrop(req.user.people_id, { cropX, cropY, cropW, cropH });
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update thumbnail crop');
  }
}

// PUT /dashboard/manage-users/:peopleId/photo/sync - Admin/Board sets another
// person's sync toggle on their behalf (Manage Users' own edit sheet).
async function setSyncEnabledForPerson(req, res) {
  try {
    await photosService.setSyncEnabled(req.params.peopleId, !!req.body?.enabled);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update photo sync');
  }
}

// POST /dashboard/manage-users/:peopleId/photo/upload - Admin/Board uploads a
// photo on another person's behalf.
async function uploadPhotoForPerson(req, res) {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded.' });
      return;
    }
    await photosService.uploadPhoto(req.params.peopleId, req.file.buffer);
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to upload photo');
  }
}

// PUT /dashboard/manage-users/:peopleId/photo/crop - Admin/Board updates
// another person's managed photo's thumbnail crop.
async function updateCropForPerson(req, res) {
  try {
    const { cropX, cropY, cropW, cropH } = req.body;
    await photosService.updateThumbnailCrop(req.params.peopleId, { cropX, cropY, cropW, cropH });
    res.json({ status: 'success' });
  } catch (err) {
    respondWithServiceError(res, err, 'Failed to update thumbnail crop');
  }
}

module.exports = {
  setSyncEnabled,
  uploadPhoto,
  updateCrop,
  setSyncEnabledForPerson,
  uploadPhotoForPerson,
  updateCropForPerson,
};
