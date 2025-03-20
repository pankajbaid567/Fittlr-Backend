const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { findOrCreateGoogleUser } = require("../controllers/auth/User");

// Check required environment variables
const googleClientID = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackURL =
  process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback";

// Validate environment variables are set
if (!googleClientID || !googleClientSecret) {
  console.error("ERROR: Missing Google OAuth credentials!");
  console.error(
    "Please make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in your .env file"
  );
  process.exit(1); // Exit with error code
}

// Debug environment variables
console.log("Google OAuth Configuration:");
console.log(
  "- Client ID length:",
  googleClientID ? googleClientID.length : "MISSING"
);
console.log(
  "- Client Secret length:",
  googleClientSecret ? googleClientSecret.length : "MISSING"
);
console.log("- Callback URL:", googleCallbackURL);

// Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: googleClientID,
      clientSecret: googleClientSecret,
      callbackURL: googleCallbackURL,
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Use the controller function for database operations
        const user = await findOrCreateGoogleUser(
          profile,
          accessToken,
          refreshToken
        );
        return done(null, user);
      } catch (error) {
        console.error("Google OAuth strategy error:", error);
        return done(error, null);
      }
    }
  )
);

// Serialize user information for session storage
passport.serializeUser((user, done) => {
  done(null, user.googleId);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { googleId: id },
    });
    done(null, user);
  } catch (error) {
    console.error("User deserialization error:", error);
    done(error, null);
  }
});

module.exports = passport;
