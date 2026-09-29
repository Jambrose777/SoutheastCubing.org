const photoStorage = require('../integrations/photoStorage.integration.js');

// Resolves a `people` row's picture into what the frontend actually needs:
// a loadable URL plus its crop.
function resolvePersonPicture(row) {
  const pictureUrl =
    row.has_managed_photo && row.picture_url
      ? photoStorage.resolveUrl(row.picture_url)
      : (row.picture_url ?? null);
  return {
    pictureUrl,
    thumbnailCropX: row.thumbnail_crop_x ?? null,
    thumbnailCropY: row.thumbnail_crop_y ?? null,
    thumbnailCropW: row.thumbnail_crop_w ?? null,
    thumbnailCropH: row.thumbnail_crop_h ?? null,
  };
}

// Resolves a joined `people` row's picture in place, keeping this response's
// existing snake_case `picture_url`/`thumbnail_crop_*` fields.
function withResolvedPicture(row) {
  const resolved = resolvePersonPicture(row);
  return {
    ...row,
    picture_url: resolved.pictureUrl,
    thumbnail_crop_x: resolved.thumbnailCropX,
    thumbnail_crop_y: resolved.thumbnailCropY,
    thumbnail_crop_w: resolved.thumbnailCropW,
    thumbnail_crop_h: resolved.thumbnailCropH,
  };
}

module.exports = { resolvePersonPicture, withResolvedPicture };
