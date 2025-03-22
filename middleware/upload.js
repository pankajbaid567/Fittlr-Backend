// middleware/upload.js

const multer = require("multer");
const { BadRequestError } = require("../errors");

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to allow only images
/**
 * Filters uploaded files based on their MIME type.
 *
 * This middleware function checks if the uploaded file is an image by examining its MIME type.
 * If the file is an image (i.e., its MIME type starts with "image/"), the callback is invoked with
 * `true`, allowing the file to be uploaded. Otherwise, the callback is invoked with an error,
 * preventing the upload and returning a "Only image files are allowed!" error message.
 *
 * @param {Object} req - The Express request object.
 * @param {Object} file - The file object representing the uploaded file.
 * @param {Function} cb - The callback function to be called after the file is filtered.
 * @param {string} file.mimetype - The MIME type of the uploaded file.
 *
 * @callback cb
 * @param {Error|null} error - An error object if the file is not an image, or `null` if it is.
 * @param {boolean} acceptFile - A boolean indicating whether the file should be accepted (`true`) or rejected (`false`).
 */
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new BadRequestError("Only image files are allowed!"), false);
  }
};

// Configure upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (Cloudflare's limit)
  },
});

/**
 * Middleware to handle image uploads.
 *
 * This middleware function uses multer to handle the uploading of image files. It expects two fields:
 * - "Short_image": A single image file.
 * - "Long_image": A single image file.
 *
 * The `upload.fields` method is used to specify the expected fields and their maximum count.
 *
 * @type {Object}
 * @property {Function} uploadImages - The middleware function to handle image uploads.
 */
module.exports = {
  uploadImages: upload.fields([
    { name: "Short_image", maxCount: 1 },
    { name: "Long_image", maxCount: 1 },
  ]),
  // Add new middleware for post images
  uploadPostImage: upload.single("image"),
};
