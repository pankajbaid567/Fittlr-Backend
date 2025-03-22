const express = require("express");
const router = express.Router();
const login = require("../controllers//fallback/login");
const logout = require("../controllers/fallback/logout");
const register = require("../controllers/fallback/register");

router.post("/login", login);
router.post("/logout", logout);
router.post("/register", register);

module.exports = router;
