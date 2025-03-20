const passport = require("./passport.service");

/**
 * Middleware for initiating Google OAuth authentication
 */
const authenticateWithGoogle = (req, res, next) => {
  return passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/fitness.activity.read",
    ],
  })(req, res, next);
};

/**
 * Middleware for handling Google OAuth callback
 */
const handleGoogleCallback = (req, res, next) => {
  return passport.authenticate("google", {
    failureRedirect: `${
      process.env.CLIENT_URL || "http://localhost:3000"
    }/login?error=true`,
    session: true,
  })(req, res, next);
};

module.exports = {
  authenticateWithGoogle,
  handleGoogleCallback,
};
