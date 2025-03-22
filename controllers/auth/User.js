const { StatusCodes } = require("http-status-codes");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const {
  setTokenCookie,
  clearTokenCookie,
} = require("../../utils/cookie.utils");
const {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} = require("../../errors");

// Database operations for Google authentication
const findOrCreateGoogleUser = async (profile, accessToken, refreshToken) => {
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
};

// Generate JWT token for authenticated user
const generateUserToken = (user) => {
  return jwt.sign(
    { userId: user.googleId, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_LIFETIME || "1d" }
  );
};

// Handle Google OAuth callback
const handleGoogleCallback = async (req, res) => {
  console.log(
    `Google OAuth callback received for user: ${req.user.name} (${req.user.googleId})`
  );

  // User is already attached by Passport middleware
  const token = generateUserToken(req.user);
  setTokenCookie(res, token);

  console.log(`JWT token generated for user: ${req.user.name}`);

  // Check if fitness tokens are available and fetch fitness data
  let fitnessData = null;
  try {
    // Get fitness tokens for the user
    const fitnessTokens = await prisma.fitnessToken.findUnique({
      where: { userId: req.user.googleId },
    });

    if (fitnessTokens) {
      console.log(
        `Fitness tokens found, fetching fitness data for user: ${req.user.name}`
      );
      // Import here to avoid circular dependency
      const googleFitService = require("../../services/googleFit.service");
      const days = 7; // Default to last 7 days
      fitnessData = await googleFitService.getFitnessSummary(
        req.user.googleId,
        days
      );
      console.log(
        `Fitness data successfully retrieved for user: ${req.user.name}`
      );
    } else {
      console.log(`No fitness tokens available for user: ${req.user.name}`);
    }
  } catch (error) {
    console.error(`Error fetching fitness data: ${error.message}`);
    // Continue with login response even if fitness data fails
  }

  console.log(`Login successful - returning user data to client`);

  // Return success with token, user info and fitness data (if available)
  res.status(StatusCodes.OK).json({
    success: true,
    token,
    user: {
      googleId: req.user.googleId,
      name: req.user.name,
      email: req.user.email,
      profileImg: req.user.profileImg,
    },
    fitnessData: fitnessData, // Will be null if not available
    hasFitnessAccess: !!fitnessData,
  });
};

// Get current user profile
const getCurrentUser = async (req, res) => {
  console.log(
    `Fetching current user profile for: ${req.user.name} (${req.user.googleId})`
  );

  res.status(StatusCodes.OK).json({
    success: true,
    user: req.user,
  });
};

// Update user profile
const updateUser = async (req, res) => {
  const { name } = req.body;

  if (!name) {
    throw new BadRequestError("Please provide a name");
  }

  const updatedUser = await prisma.user.update({
    where: { googleId: req.user.googleId },
    data: { name },
  });

  res.status(StatusCodes.OK).json({
    success: true,
    user: updatedUser,
  });
};

// Get user's fitness tokens
const getFitnessTokens = async (req, res) => {
  console.log(
    `Checking fitness tokens for user: ${req.user.name} (${req.user.googleId})`
  );

  const fitnessTokens = await prisma.fitnessToken.findUnique({
    where: { userId: req.user.googleId },
  });

  if (!fitnessTokens) {
    console.log(`No fitness tokens found for user: ${req.user.name}`);
    throw new NotFoundError("No fitness tokens found for this user");
  }

  console.log(
    `Fitness tokens found for user: ${req.user.name}, expiry: ${new Date(
      fitnessTokens.expiry_date * 1000
    )}`
  );

  res.status(StatusCodes.OK).json({
    success: true,
    fitnessTokens,
  });
};

// Update fitness tokens
const updateFitnessTokens = async (req, res) => {
  const { access_token, refresh_token, scope, token_type, expiry_date } =
    req.body;

  if (!access_token || !refresh_token) {
    throw new BadRequestError("Please provide valid token information");
  }

  const updatedTokens = await prisma.fitnessToken.upsert({
    where: { userId: req.user.googleId },
    update: {
      access_token,
      refresh_token,
      scope: scope || "fitness",
      token_type: token_type || "Bearer",
      expiry_date: expiry_date || Math.floor(Date.now() / 1000) + 3600,
    },
    create: {
      userId: req.user.googleId,
      access_token,
      refresh_token,
      scope: scope || "fitness",
      token_type: token_type || "Bearer",
      expiry_date: expiry_date || Math.floor(Date.now() / 1000) + 3600,
    },
  });

  res.status(StatusCodes.OK).json({
    success: true,
    fitnessTokens: updatedTokens,
  });
};

// Delete user account
const deleteUser = async (req, res) => {
  // First delete any related records
  await prisma.fitnessToken.deleteMany({
    where: { userId: req.user.googleId },
  });

  // Then delete the user
  await prisma.user.delete({
    where: { googleId: req.user.googleId },
  });

  // Clear session and cookies
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    clearTokenCookie(res);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "User account deleted successfully",
    });
  });
};

// Log out user
const logoutUser = async (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      throw new BadRequestError("Error during logout");
    }

    clearTokenCookie(res);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Logged out successfully",
    });
  });
};

module.exports = {
  findOrCreateGoogleUser,
  generateUserToken,
  handleGoogleCallback,
  getCurrentUser,
  updateUser,
  getFitnessTokens,
  updateFitnessTokens,
  deleteUser,
  logoutUser,
};
