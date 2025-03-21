const jwt = require("jsonwebtoken");

// Function to create a JWT for a given user
const createJWT = (user) => {
  // Create token with consistent payload structure
  return jwt.sign(
    {
      userId: user.id, // User ID
      name: user.name, // User's name
      email: user.email, // User's email
    },
    process.env.JWT_SECRET, // Secret key for signing the token
    {
      expiresIn: process.env.JWT_LIFETIME || "7d", // Token expiration time
    }
  );
};

// Export the createJWT function
module.exports = { createJWT };
