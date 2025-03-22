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

// Add a debug route to check token status
router.get("/debug-tokens", authenticateUser, async (req, res) => {
  try {
    const tokens = await prisma.fitnessToken.findUnique({
      where: { userId: req.user.googleId },
    });

    res.status(200).json({
      hasTokens: !!tokens,
      tokens: tokens
        ? {
            hasAccessToken: !!tokens.access_token,
            hasRefreshToken: !!tokens.refresh_token,
            accessTokenPreview: tokens.access_token
              ? tokens.access_token.substring(0, 10) + "..."
              : null,
            refreshTokenPreview: tokens.refresh_token
              ? tokens.refresh_token.substring(0, 5) + "..."
              : null,
            expiryDate: tokens.expiry_date
              ? new Date(tokens.expiry_date * 1000).toISOString()
              : null,
            isExpired: tokens.expiry_date
              ? tokens.expiry_date < Math.floor(Date.now() / 1000)
              : null,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
