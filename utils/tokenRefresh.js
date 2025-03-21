const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { BadRequestError } = require("../errors");

/**
 * Refreshes a Google OAuth token
 * @param {string} userId - The user's Google ID
 */
const refreshGoogleToken = async (userId) => {
  try {
    const tokenData = await prisma.fitnessToken.findUnique({
      where: { userId },
    });

    if (!tokenData || !tokenData.refresh_token) {
      throw new BadRequestError("No refresh token available");
    }

    const response = await axios.post(
      "https://oauth2.googleapis.com/token",
      null,
      {
        params: {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        },
      }
    );

    // Update token in database
    await prisma.fitnessToken.update({
      where: { userId },
      data: {
        access_token: response.data.access_token,
        // Refresh token doesn't typically change unless revoked
        expiry_date:
          Math.floor(Date.now() / 1000) + (response.data.expires_in || 3600),
      },
    });

    return response.data.access_token;
  } catch (error) {
    console.error(
      "Token refresh error:",
      error.response?.data || error.message
    );
    throw new BadRequestError("Failed to refresh access token");
  }
};

module.exports = { refreshGoogleToken };
