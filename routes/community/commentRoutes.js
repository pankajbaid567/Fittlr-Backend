const express = require('express');
const router = express.Router();
const {
  createComment,
  getComments,
  deleteComment
} = require('../../controllers/community/commentController');
const authenticateUser = require('../../middleware/authentication');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Create a new comment
router.post('/post/:postId', createComment);

// Get comments for a specific post with pagination
router.get('/post/:postId', getComments);

// Delete a comment
router.delete('/:commentId', deleteComment);

module.exports = router;