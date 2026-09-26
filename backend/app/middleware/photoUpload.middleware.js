const multer = require('multer');

// Memory storage - the upload is proxied entirely through the backend
// rather than a direct-to-storage presigned upload, so an arbitrary client
// can never write straight to storage; only the backend's own code path can.
// Limited to image types and 5MB, checked before the file ever reaches
// photoStorage.store.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed.'));
      return;
    }
    cb(null, true);
  },
});

// Ready-to-use route middleware for a single `photo` field upload - wraps
// multer's own errors (bad file type, too large) as a 400 rather than
// letting them fall through to asyncRoute's generic 500, since they reject
// before the controller itself ever runs.
function photoUploadMiddleware(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      res.status(400).json({ message: err.message });
      return;
    }
    next();
  });
}

module.exports = { photoUploadMiddleware };
