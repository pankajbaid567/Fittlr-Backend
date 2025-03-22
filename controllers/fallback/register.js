const { StatusCodes } = require("http-status-codes");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { BadRequestError, NotFoundError } = require("../../errors");
const jwt = require("jsonwebtoken");
const { hashPassword } = require("../../services/password_auth");
const {
  setTokenCookie,
  clearTokenCookie,
} = require("../../utils/cookie.utils");

const register = async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    throw new BadRequestError("Please provide name, email and password");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    throw new BadRequestError("User already exists with this email");
  }

  // Hash the password before storing
  const hashedPassword = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      googleId: Math.floor(100000 + Math.random() * 900000).toString(),
      email,
      password: hashedPassword,
      name,
    },
  });

  const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });

  setTokenCookie(res, token);

  res.status(StatusCodes.CREATED).json({ success: true, token, user: newUser });
};

module.exports = register;
