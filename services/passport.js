const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

console.log("Google OAuth Configuration:");
console.log(
  `- Client ID length: ${
    process.env.GOOGLE_CLIENT_ID
      ? process.env.GOOGLE_CLIENT_ID.length
      : "not set"
  }`
);
console.log(
  `- Client Secret length: ${
    process.env.GOOGLE_CLIENT_SECRET
      ? process.env.GOOGLE_CLIENT_SECRET.length
      : "not set"
  }`
);
console.log(
  `- Callback URL: ${
    process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback"
  }`
);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback",
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/fitness.activity.read",
      ],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log(
          `OAuth login attempt for: ${profile.displayName} (${profile.id})`
        );

        // Check if user exists in database
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        // If user doesn't exist, create new user
        if (!user) {
          console.log(
            `Creating new user: ${profile.displayName} (${profile.id})`
          );
          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email: profile.emails[0].value,
              name: profile.displayName,
              profileImg: profile.photos[0]?.value || "",
            },
          });
          console.log(`New user created successfully: ${user.name}`);
        } else {
          console.log(
            `Existing user logged in: ${user.name} (${user.googleId})`
          );
        }

        // If Google provided fitness tokens, store them
        if (accessToken && refreshToken) {
          console.log(`Fitness permissions granted for user: ${user.name}`);
          console.log(
            `Access token received: ${accessToken.substring(0, 10)}...`
          );

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

          console.log(`Fitness tokens stored/updated for user: ${user.name}`);
        } else {
          console.log(`No fitness tokens provided for user: ${user.name}`);
        }

        console.log(`OAuth authentication successful for: ${user.name}`);
        return done(null, user);
      } catch (error) {
        console.error(`OAuth authentication error: ${error.message}`);
        return done(error, null);
      }
    }
  )
);

// Serialize user information for session storage
passport.serializeUser((user, done) => {
  console.log(`Serializing user: ${user.name} (${user.googleId})`);
  done(null, user.googleId);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    console.log(`Deserializing user with ID: ${id}`);
    const user = await prisma.user.findUnique({
      where: { googleId: id },
    });
    console.log(`Deserialized user: ${user?.name || "Unknown"}`);
    done(null, user);
  } catch (error) {
    console.error(`Error deserializing user: ${error.message}`);
    done(error, null);
  }
});

module.exports = passport;
