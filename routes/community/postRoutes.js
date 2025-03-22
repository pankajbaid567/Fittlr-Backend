const express = require('express');
const router = express.Router();
const {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost
} = require('../../controllers/community/postController');
const authenticateUser = require('../../middleware/authentication');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Post routes
router.route('/')
  .post(createPost)  // Create a new post
  .get(getPosts);    // Get all posts with pagination

router.route('/:id')
  .get(getPost)      // Get a single post by ID
  .patch(updatePost) // Update a post
  .delete(deletePost); // Delete a post

module.exports = router;