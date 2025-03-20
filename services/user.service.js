const { BadRequestError } = require("../errors");

/**
 * Validates and processes user profile update data
 * Business logic only - no database operations
 */
const processUserProfileUpdate = (userData) => {
  const { name } = userData;

  if (!name || name.trim() === "") {
    throw new BadRequestError("Please provide a valid name");
  }

  // Format or transform data if needed
  return {
    name: name.trim(),
  };
};

/**
 * Prepares account deletion process
 * Business logic only - no database operations
 */
const prepareAccountDeletion = () => {
  // Any business logic before account deletion
  // For example, checking requirements, generating reports, etc.

  return {
    deletionApproved: true,
    deletionTime: new Date(),
  };
};

/**
 * Processes user session and authentication state
 */
const processLogout = (req, res) => {
  return new Promise((resolve, reject) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return reject(new BadRequestError("Error during logout"));
      }
      resolve(true);
    });
  });
};

module.exports = {
  processUserProfileUpdate,
  prepareAccountDeletion,
  processLogout,
};
