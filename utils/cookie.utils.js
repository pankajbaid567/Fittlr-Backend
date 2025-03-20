/**
 * Sets a JWT token as an HTTP-only cookie
 * @param {Object} res - Express response object
 * @param {string} token - JWT token to be set as cookie
 */
const setTokenCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    signed: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });
};

/**
 * Clears the token cookie
 * @param {Object} res - Express response object
 */
const clearTokenCookie = (res) => {
  res.clearCookie("token");
};

module.exports = {
  setTokenCookie,
  clearTokenCookie,
};
