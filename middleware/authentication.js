const jwt = require("jsonwebtoken");
const { UnauthenticatedError } = require("../errors");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    throw new UnauthenticatedError("Authentication invalid");
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        isContent_creator: true,
        isValidator: true
      }
    });

    if (!user) {
      throw new UnauthenticatedError("User not found");
    }

    // Attach complete user object to request
    req.user = user;
    next();
  } catch (error) {
    throw new UnauthenticatedError("Authentication invalid");
  }
};

module.exports = authenticateUser;