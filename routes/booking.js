const express = require("express");
const router = express.Router();
const {
  getAvailability,
  createBooking,
} = require("../controllers/Gym_Schedule/bookingFlow.controller");
const { getBookingSummary } = require("../controllers/Gym_Schedule/bookingsummry");

router.get("/availability", getAvailability);

// POST: Create booking with all selected options
// Required body parameters: userId, gymId, startTime, duration, selectedMachines (optional)
router.post("/create", createBooking);
router.get("/booksummary", getBookingSummary);




module.exports = router;