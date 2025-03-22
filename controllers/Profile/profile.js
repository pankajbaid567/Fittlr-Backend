const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const GoogleFitService = require("../../services/googleFit.service");
const { StatusCodes } = require("http-status-codes");
const {
  CustomAPIError,
  UnauthenticatedError,
  NotFoundError,
  BadRequestError,
} = require("../../errors");

/**
 * Get user profile with fitness activity summaries
 * @param {Object} req - Request object with googleId in the body
 * @param {Object} res - Response object
 */
const getUserProfile = async (req, res) => {
  const { googleId } = req.body;

  if (!googleId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "GoogleId is required",
    });
  }

  try {
    // Find user by googleId
    const user = await prisma.user.findUnique({
      where: { googleId },
      select: {
        name: true,
        email: true,
        profileImg: true,
        googleId: true,
      },
    });

    if (!user) {
      throw new NotFoundError(`No user found with googleId: ${googleId}`);
    }

    console.log(
      `==== FETCHING PROFILE WITH EXACT 7-DAY DATA for user: ${user.name} ====`
    );
    const startTime = Date.now();

    // Use our new method that explicitly creates a 7-day dataset
    const fitnessData = await GoogleFitService.getExactSevenDaysData(googleId);

    const fetchTime = Date.now() - startTime;
    console.log(`Exact 7-day fitness data fetch completed in ${fetchTime}ms`);

    // Verify we have exactly 7 days for each data type
    if (
      fitnessData.steps.length !== 7 ||
      fitnessData.calories.length !== 7 ||
      fitnessData.distance.length !== 7
    ) {
      console.error(
        `ERROR: Expected exactly 7 days of data but got steps=${fitnessData.steps.length}, calories=${fitnessData.calories.length}, distance=${fitnessData.distance.length}`
      );
    } else {
      console.log(`SUCCESS: Retrieved exactly 7 days of data for all metrics`);
    }

    // Log all dates for final verification
    console.log(
      `Final steps dates: ${fitnessData.steps.map((d) => d.date).join(", ")}`
    );

    // Calculate cumulative totals
    const cumulativeFitness = calculateCumulativeFitness(fitnessData);

    // Add the latest data indicators
    const indianDate = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
    cumulativeFitness.dataTimestamp = indianDate.toISOString();
    cumulativeFitness.timeZone = "Asia/Kolkata";
    cumulativeFitness.isExact7DayData = true;

    // Return combined user profile and fitness data
    res.status(StatusCodes.OK).json({
      success: true,
      user: {
        ...user,
        fitness: {
          ...cumulativeFitness,
          dailyData: fitnessData,
        },
      },
    });
  } catch (error) {
    console.error(`Error fetching user profile: ${error.message}`);

    // Handle specific errors
    if (error.name === "NotFoundError") {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: error.message,
      });
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch user profile",
      error: error.message,
    });
  }
};

/**
 * Check for gaps in date sequence
 * @param {Array} dateArray - Array of objects with date property
 * @returns {Array} - Array of gap objects with start and end dates
 */
const findDateGaps = (dateArray) => {
  if (!dateArray || dateArray.length <= 1) return [];

  // Sort by date
  const sortedDates = [...dateArray].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const gaps = [];

  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i].date);
    const prevDate = new Date(sortedDates[i - 1].date);

    // Check if dates are consecutive
    const expectedNextDate = new Date(prevDate);
    expectedNextDate.setDate(expectedNextDate.getDate() + 1);

    if (currentDate.getTime() !== expectedNextDate.getTime()) {
      gaps.push({
        start: prevDate.toISOString().split("T")[0],
        end: currentDate.toISOString().split("T")[0],
        missingDays: (currentDate - prevDate) / (24 * 60 * 60 * 1000) - 1,
      });
    }
  }

  return gaps;
};

/**
 * Calculate cumulative fitness metrics from daily data
 * @param {Object} fitnessData - Daily fitness data
 * @returns {Object} - Cumulative totals
 */
const calculateCumulativeFitness = (fitnessData) => {
  // Initialize totals
  const totals = {
    totalSteps: 0,
    totalCaloriesBurned: 0,
    totalDistanceKm: 0,
    daysActive: 0,
    averageDailySteps: 0,
  };

  // Calculate total steps
  if (fitnessData.steps && fitnessData.steps.length > 0) {
    totals.totalSteps = fitnessData.steps.reduce(
      (sum, day) => sum + day.steps,
      0
    );
    totals.daysActive = fitnessData.steps.filter(
      (day) => day.steps > 100
    ).length;
  }

  // Calculate total calories
  if (fitnessData.calories && fitnessData.calories.length > 0) {
    totals.totalCaloriesBurned = fitnessData.calories.reduce(
      (sum, day) => sum + day.calories,
      0
    );
  }

  // Calculate total distance
  if (fitnessData.distance && fitnessData.distance.length > 0) {
    totals.totalDistanceKm = parseFloat(
      fitnessData.distance
        .reduce((sum, day) => sum + day.distance, 0)
        .toFixed(2)
    );
  }

  // Calculate average daily steps (only for days with data)
  if (totals.daysActive > 0) {
    totals.averageDailySteps = Math.round(
      totals.totalSteps / totals.daysActive
    );
  }

  return totals;
};

module.exports = {
  getUserProfile,
};
