const photoStorage = require('../integrations/photoStorage.integration.js');

// Resolves a `people` row's picture into what the frontend actually needs: 
// a loadable URL plus its crop.
function resolvePersonPicture(row) {
  const pictureUrl =
    row.has_managed_photo && row.picture_url
      ? photoStorage.resolveUrl(row.picture_url)
      : row.picture_url ?? null;
  return {
    pictureUrl,
    thumbnailCropX: row.thumbnail_crop_x ?? null,
    thumbnailCropY: row.thumbnail_crop_y ?? null,
    thumbnailCropW: row.thumbnail_crop_w ?? null,
    thumbnailCropH: row.thumbnail_crop_h ?? null,
  };
}

module.exports = { resolvePersonPicture };
