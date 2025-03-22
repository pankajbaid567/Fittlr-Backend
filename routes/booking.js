const express = require("express");
const router = express.Router();
const {
  getAvailability,
  createBooking,
} = require("../controllers/Gym_Schedule/bookingFlow.controller");

// GET: Single endpoint to get all availability information
// Usage:
// - GET /api/booking/availability?gymId=1 (returns available dates)
// - GET /api/booking/availability?gymId=1&date=2023-04-01 (returns time slots)
// - GET /api/booking/availability?gymId=1&date=2023-04-01&startTime=2023-04-01T10:00:00&duration=60 (returns machines)
router.get("/availability", getAvailability);

// POST: Create booking with all selected options
// Required body parameters: userId, gymId, startTime, duration, selectedMachines (optional)
router.post("/create", createBooking);

module.exports = router;
