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
