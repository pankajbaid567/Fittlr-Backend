// controllers/auth/logout.js

const { StatusCodes } = require("http-status-codes");

const logout = (req, res) => {
    res.clearCookie('jwtToken');

    res.status(StatusCodes.OK).json({ message: 'Logout successful' });
};

module.exports = logout;