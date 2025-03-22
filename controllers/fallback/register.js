const { StatusCodes } = require("http-status-codes");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { BadRequestError, NotFoundError } = require("../../errors");
const jwt = require("jsonwebtoken");
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
    
    const newUser = await prisma.user.create({
        data: {
            googleId: Number(Math.floor(100000 + Math.random() * 900000).toString()),
            email,
            password,
            name,
        },
    });
    
    const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
    
    setTokenCookie(res, token);
    
    res.status(StatusCodes.CREATED).json({ success: true, token });
};

module.exports = register;