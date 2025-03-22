const express = require('express');
const router = express.Router();
const {
  toggleLike,
  getLikes,
  checkLikeStatus
} = require('../../controllers/community/likeController');
const authenticateUser = require('../../middleware/authentication');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Toggle like status on a post
router.post('/post/:postId', toggleLike);

// Get all users who liked a post
router.get('/post/:postId', getLikes);

// Check if current user liked a post
router.get('/status/post/:postId', checkLikeStatus);

module.exports = router;