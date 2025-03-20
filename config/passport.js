const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback",
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists in database
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        // If user doesn't exist, create new user
        if (!user) {
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email: profile.emails[0].value,
              name: profile.displayName,
              profileImg: profile.photos[0]?.value || "",
            },
          });
        }

        // If Google provided fitness tokens, store them
        if (accessToken && refreshToken) {
          await prisma.fitnessToken.upsert({
            where: { userId: user.googleId },
            update: {
              access_token: accessToken,
              refresh_token: refreshToken,
              scope: "fitness",
              token_type: "Bearer",
              expiry_date: Math.floor(Date.now() / 1000) + 3600,
            },
            create: {
              userId: user.googleId,
              access_token: accessToken,
              refresh_token: refreshToken,
              scope: "fitness",
              token_type: "Bearer",
              expiry_date: Math.floor(Date.now() / 1000) + 3600,
            },
          });
        }

        return done(null, user);
      } catch (error) {
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
    done(error, null);
  }
});

module.exports = passport;
