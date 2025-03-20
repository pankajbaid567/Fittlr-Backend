const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authentication");
const {
  authenticateWithGoogle,
  handleGoogleCallback,
} = require("../services/authConfig.service");
const {
  handleGoogleCallback: googleCallbackHandler,
  getCurrentUser,
  updateUser,
  getFitnessTokens,
  updateFitnessTokens,
  deleteUser,
  logoutUser,
} = require("../controllers/auth/User");

// Routes without implementation details
router.get("/", authenticateWithGoogle);
router.get("/callback", handleGoogleCallback, googleCallbackHandler);

// Protected routes
router.get("/me", authenticateUser, getCurrentUser);
router.put("/update", authenticateUser, updateUser);
router.get("/fitness-tokens", authenticateUser, getFitnessTokens);
router.put("/fitness-tokens", authenticateUser, updateFitnessTokens);
router.delete("/delete-account", authenticateUser, deleteUser);
router.get("/logout", authenticateUser, logoutUser);

module.exports = router;
