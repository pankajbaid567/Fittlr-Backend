/**
 * Sets a JWT token in an HTTP-only cookie
 */
const setTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    path: '/'
  };

  res.cookie('token', token, cookieOptions);
};

/**
 * Clears the JWT token cookie
 */
const clearTokenCookie = (res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    path: '/'
  });
};

module.exports = {
  setTokenCookie,
  clearTokenCookie
};
