const { UnauthenticatedError } = require("../errors");

const isAdminOrContentCreator = async (req, res, next) => {
  if (!req.user || !(req.user.isAdmin || req.user.isContent_creator)) {
    throw new UnauthenticatedError(
      "Access denied. Admin or Content Creator privileges required"
    );
  }
  next();
};

module.exports = isAdminOrContentCreator;