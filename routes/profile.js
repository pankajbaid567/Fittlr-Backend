const express = require("express");
const router = express.Router();
const { getUserProfile } = require("../controllers/Profile/profile");

router.get("/", getUserProfile)

module.exports = router;