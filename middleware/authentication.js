const jwt = require("jsonwebtoken");
const { UnauthenticatedError } = require("../errors");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const authenticateUser = async (req, res, next) => {
  // First check if user is authenticated via session
  if (req.isAuthenticated() && req.user) {
    // Session authentication passed, continue to next middleware
    return next();
  }

  // If not authenticated by session, check JWT token
  const authHeader = req.headers.authorization;
  const tokenFromCookie = req.signedCookies?.token;

  let token;
  if (authHeader && authHeader.startsWith("Bearer")) {
    token = authHeader.split(" ")[1];
  } else if (tokenFromCookie) {
    token = tokenFromCookie;
  }

  if (!token) {
    throw new UnauthenticatedError(
      "Authentication invalid - no token provided"
    );
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data from database using googleId
    const user = await prisma.user.findUnique({
      where: { googleId: payload.userId },
      select: {
        googleId: true,
        name: true,
        email: true,
        profileImg: true,
      },
    });

    if (!user) {
      throw new UnauthenticatedError("User not found");
    }

    // Attach complete user object to request
    req.user = user;
    next();
  } catch (error) {
    throw new UnauthenticatedError(
      "Authentication invalid - token verification failed"
    );
  }
};

module.exports = authenticateUser;
