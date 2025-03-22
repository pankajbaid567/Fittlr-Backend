const express = require('express');
const {
  sendChallenge,
  getReceivedChallenges,
  getSentChallenges,
  getChallenge,
  updateChallengeStatus,
  deleteChallenge,
  getFollowing
} = require('../controllers/challenges/challengeController');

const router = express.Router();
const authenticateUser = require('../middleware/authentication');

router.use(authenticateUser);

router.post('/send/:receiverId', sendChallenge);
router.get('/received', getReceivedChallenges);
router.get('/sent', getSentChallenges);
router.get('/following', getFollowing); // Move this before /:id
router.get('/:id', getChallenge);
router.patch('/:id/status', updateChallengeStatus);
router.delete('/:id', deleteChallenge);

module.exports = router;