const { StatusCodes } = require("http-status-codes");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const {
  BadRequestError,
  NotFoundError,
  UnauthenticatedError,
} = require("../../errors");
const jwt = require("jsonwebtoken");
const { comparePassword } = require("../../services/password_auth");
const {
  setTokenCookie,
  clearTokenCookie,
} = require("../../utils/cookie.utils");

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new NotFoundError("No user found with this email");
  }

  // Use the comparePassword utility function
  const isMatch = await comparePassword(password, user.password);

  if (!isMatch) {
    throw new UnauthenticatedError("Invalid credentials");
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });

  setTokenCookie(res, token);

  res.status(StatusCodes.OK).json({ success: true, token, user });
};

module.exports = login;
