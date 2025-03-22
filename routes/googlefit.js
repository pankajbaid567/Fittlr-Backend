const express = require("express");
const router = express.Router();

const routers = express.Router();
const {
  getFitnessSummary,
  getStepCount,
  getCaloriesBurned,
  getDistanceWalked,
} = require("../controllers/Home/googleFit.controller");

const {fallback_concent} = require("../controllers/Home/googleFitfallback")




routers.get("/summary", getFitnessSummary);
routers.get("/steps", getStepCount);
routers.get("/calories", getCaloriesBurned);
routers.get("/distance", getDistanceWalked);
router.get('/fallback_concent', fallback_concent);

module.exports = router;
