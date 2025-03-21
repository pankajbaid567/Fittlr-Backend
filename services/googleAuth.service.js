const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const { UnauthenticatedError } = require("../errors");

/**
 * Handles user authentication via Google OAuth
 * Creates or updates user record and tokens
 */
const handleGoogleUser = async (profile, accessToken, refreshToken) => {
  try {
    console.log(`Processing Google user: ${profile.displayName} (${profile.id})`);
    
    // Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    // If user doesn't exist, create new user
    if (!user) {
      console.log(`Creating new user for: ${profile.displayName}`);
      user = await prisma.user.create({
        data: {
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          profileImg: profile.photos[0]?.value || "",
        },
      });
    } else {
      console.log(`Existing user found: ${user.name} (${user.googleId})`);
    }

    // If Google provided tokens, store them regardless of whether they're fitness tokens
    if (accessToken) {
      console.log(`Storing/updating OAuth tokens for user: ${user.name} (${user.googleId})`);
      try {
        await prisma.fitnessToken.upsert({
          where: { userId: user.googleId },
          update: {
            access_token: accessToken,
            refresh_token: refreshToken || undefined, // Only update if provided
            scope: "fitness",
            token_type: "Bearer",
            expiry_date: Math.floor(Date.now() / 1000) + 3600,
          },
          create: {
            userId: user.googleId,
            access_token: accessToken,
            refresh_token: refreshToken || "", // Store empty string if not provided
            scope: "fitness",
            token_type: "Bearer",
            expiry_date: Math.floor(Date.now() / 1000) + 3600,
          },
        });
        console.log(`Successfully stored tokens for user: ${user.name}`);
      } catch (tokenError) {
        console.error(`Failed to store tokens for user ${user.name}:`, tokenError);
        // Continue with the flow - don't throw error here
      }
    } else {
      console.warn(`No access token provided for user: ${user.name}`);
    }

    return user;
  } catch (error) {
    console.error("Google OAuth handling error:", error);
    throw new UnauthenticatedError("Failed to authenticate with Google");
  }
};

/**
 * Generates JWT token for authenticated user
 */
const generateUserToken = (user) => {
  return jwt.sign(
    { userId: user.googleId, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_LIFETIME || "1d" }
  );
};

/**
 * Service layer for Google OAuth related business logic
 * Does not contain database operations
 */

/**
 * Process Google authentication response
 * This delegates actual DB operations to the controller
 */
const processGoogleAuthResponse = async (
  profile,
  accessToken,
  refreshToken,
  userController
) => {
  try {
    // Delegate DB operations to the controller
    const user = await userController.findOrCreateGoogleUser(
      profile,
      accessToken,
      refreshToken
    );
    return user;
  } catch (error) {
    console.error("Google OAuth processing error:", error);
    throw error;
  }
};

module.exports = {
  handleGoogleUser,
  generateUserToken,
  processGoogleAuthResponse,
};
