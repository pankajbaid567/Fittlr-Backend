const { UnauthenticatedError } = require("../errors");

const isAdmin = async (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    throw new UnauthenticatedError("Access denied. Admin privileges required");
  }
  next();
};

module.exports = isAdmin;