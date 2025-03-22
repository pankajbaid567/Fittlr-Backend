const express = require('express');
const router = express.Router();
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing
} = require('../../controllers/community/followController');
const authenticateUser = require('../../middleware/authentication');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Follow/unfollow routes
router.post('/follow/:userIdToFollow', followUser);
router.delete('/unfollow/:userIdToUnfollow', unfollowUser);

// Get followers/following
router.get('/followers', getFollowers);
router.get('/following', getFollowing);

module.exports = router;