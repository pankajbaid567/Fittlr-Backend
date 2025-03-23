const express = require("express");
const router = express.Router();
const {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
} = require("../../controllers/community/postController");
//const authenticateUser = require("../../middleware/authentication");
const { uploadPostImage } = require("../../middleware/upload");

// Apply authentication middleware to all routes
//router.use(authenticateUser);
// const authenticateUser = require("../../middleware/authentication");
const { uploadPostImage } = require("../../middleware/upload");



// Post routes
router
  .route("/")
  .post(uploadPostImage, createPost) // Add image upload middleware
  .get(getPosts); // Get all posts with pagination

router
  .route("/:id")
  .get(getPost) // Get a single post by ID
  .patch(uploadPostImage, updatePost) // Add image upload middleware
  .delete(deletePost); // Delete a post

module.exports = router;
