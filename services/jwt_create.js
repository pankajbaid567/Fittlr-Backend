const jwt = require('jsonwebtoken');

// Function to create a JWT for a given user
const createJWT = (user) => {
  // Create token with consistent payload structure
  return jwt.sign(
    {
      userId: user.id,          // User ID
      name: user.name,          // User's name
      email: user.email,        // User's email
      isAdmin: user.isAdmin,    // Boolean flag for admin status
      isContent_creator: user.isContent_creator // Boolean flag for content creator status
    },
    process.env.JWT_SECRET,     // Secret key for signing the token
    {
      expiresIn: process.env.JWT_LIFETIME || '1d', // Token expiration time
    }
  );
};

// Export the createJWT function
module.exports = { createJWT };
