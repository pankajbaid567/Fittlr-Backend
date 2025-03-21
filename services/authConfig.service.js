const passport = require("./passport.service");

/**
 * Middleware for initiating Google OAuth authentication
 */
const authenticateWithGoogle = (req, res, next) => {
  console.log("Initiating Google OAuth flow with fitness scopes...");
  return passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.location.read",
      "https://www.googleapis.com/auth/fitness.activity.write"
    ],
    accessType: 'offline',
    prompt: 'consent',  // Always show consent screen to ensure refresh token
    includeGrantedScopes: true,
    hostedDomain: 'any'
  })(req, res, next);
};

/**
 * Middleware for handling Google OAuth callback
 */
const handleGoogleCallback = (req, res, next) => {
  console.log("Handling Google OAuth callback...");
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
