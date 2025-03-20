const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { NotFoundError, BadRequestError } = require("../errors");

/**
 * Retrieves fitness tokens for a user
 */
const getFitnessTokensForUser = async (googleId) => {
  const fitnessTokens = await prisma.fitnessToken.findUnique({
    where: { userId: googleId },
  });

  if (!fitnessTokens) {
    throw new NotFoundError("No fitness tokens found for this user");
  }

  return fitnessTokens;
};

/**
 * Updates fitness tokens for a user
 */
const updateFitnessTokensForUser = async (googleId, tokenData) => {
  const { access_token, refresh_token, scope, token_type, expiry_date } =
    tokenData;

  if (!access_token || !refresh_token) {
    throw new BadRequestError("Please provide valid token information");
  }

  const updatedTokens = await prisma.fitnessToken.upsert({
    where: { userId: googleId },
    update: {
      access_token,
      refresh_token,
      scope: scope || "fitness",
      token_type: token_type || "Bearer",
      expiry_date: expiry_date || Math.floor(Date.now() / 1000) + 3600,
    },
    create: {
      userId: googleId,
      access_token,
      refresh_token,
      scope: scope || "fitness",
      token_type: token_type || "Bearer",
      expiry_date: expiry_date || Math.floor(Date.now() / 1000) + 3600,
    },
  });

  return updatedTokens;
};

module.exports = {
  getFitnessTokensForUser,
  updateFitnessTokensForUser,
};
