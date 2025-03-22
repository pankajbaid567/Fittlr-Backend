const { StatusCodes } = require("http-status-codes");
const googleFitService = require("../../services/googleFit.service");
const passport = require("passport");
const {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} = require("../../errors");
const fallback_concent = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "You must be logged in to request fitness permissions",
    });
  }

  passport.authenticate("google", {
    scope: [
      "https://www.googleapis.com/auth/fitness.activity.read",
      "https://www.googleapis.com/auth/fitness.location.read",
      "https://www.googleapis.com/auth/fitness.activity.write",
    ],
    accessType: "offline",
    prompt: "consent",
    includeGrantedScopes: true,
    hostedDomain: "any",
  })(req, res);
};
module.exports = { fallback_concent };
