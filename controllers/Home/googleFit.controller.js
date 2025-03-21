const { StatusCodes } = require("http-status-codes");
const googleFitService = require("../../services/googleFit.service");
const {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} = require("../../errors");

// Get fitness data summary for the authenticated user
const getFitnessSummary = async (req, res) => {
  try {
    console.log(
      `Fetching fitness summary for user: ${req.user.googleId}, name: ${req.user.name}`
    );
    const { days } = req.query;
    const daysToFetch = parseInt(days) || 7; // Default to 7 days

    // Validate days parameter
    if (isNaN(daysToFetch) || daysToFetch <= 0 || daysToFetch > 30) {
      throw new BadRequestError("Days parameter must be between 1 and 30");
    }

    const fitnessSummary = await googleFitService.getFitnessSummary(
      req.user.googleId,
      daysToFetch
    );

    console.log(
      `Successfully retrieved fitness summary for user: ${req.user.name}, days: ${daysToFetch}`
    );
    console.log(
      `Summary data: Steps: ${fitnessSummary.steps.length} days, Calories: ${fitnessSummary.calories.length} days, Distance: ${fitnessSummary.distance.length} days`
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Fitness data retrieved successfully",
      data: fitnessSummary,
    });
  } catch (error) {
    console.error(
      `Error fetching fitness summary for user ${req.user?.googleId}: ${error.message}`
    );

    if (error.message.includes("No fitness tokens")) {
      throw new NotFoundError(
        "No fitness tokens found for this user. Please authorize Google Fit access first."
      );
    }

    if (error.response && error.response.data) {
      throw new BadRequestError(
        `Google Fit API Error: ${error.response.data.error.message}`
      );
    }

    throw error;
  }
};

// Get just step count data
const getStepCount = async (req, res) => {
  try {
    console.log(
      `Fetching step count for user: ${req.user.googleId}, name: ${req.user.name}`
    );
    const { days } = req.query;
    const daysToFetch = parseInt(days) || 7; // Default to 7 days

    // Validate days parameter
    if (isNaN(daysToFetch) || daysToFetch <= 0 || daysToFetch > 30) {
      throw new BadRequestError("Days parameter must be between 1 and 30");
    }

    const endTime = Date.now();
    const startTime = endTime - daysToFetch * 24 * 60 * 60 * 1000;

    const stepsData = await googleFitService.getStepCount(
      req.user.googleId,
      startTime,
      endTime
    );

    const processedData = googleFitService.processStepData(stepsData);
    console.log(
      `Successfully retrieved step data for user: ${req.user.name}, days: ${daysToFetch}`
    );
    console.log(
      `Step data: ${processedData
        .map((day) => `${day.date}: ${day.steps} steps`)
        .join(", ")}`
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Step count data retrieved successfully",
      data: processedData,
    });
  } catch (error) {
    console.error(
      `Error fetching step count for user ${req.user?.googleId}: ${error.message}`
    );

    if (error.message.includes("No fitness tokens")) {
      throw new NotFoundError(
        "No fitness tokens found for this user. Please authorize Google Fit access first."
      );
    }

    if (error.response && error.response.data) {
      throw new BadRequestError(
        `Google Fit API Error: ${error.response.data.error.message}`
      );
    }

    throw error;
  }
};

// Get just calorie data
const getCaloriesBurned = async (req, res) => {
  try {
    console.log(
      `Fetching calories burned for user: ${req.user.googleId}, name: ${req.user.name}`
    );
    const { days } = req.query;
    const daysToFetch = parseInt(days) || 7; // Default to 7 days

    // Validate days parameter
    if (isNaN(daysToFetch) || daysToFetch <= 0 || daysToFetch > 30) {
      throw new BadRequestError("Days parameter must be between 1 and 30");
    }

    const endTime = Date.now();
    const startTime = endTime - daysToFetch * 24 * 60 * 60 * 1000;

    const caloriesData = await googleFitService.getCaloriesBurned(
      req.user.googleId,
      startTime,
      endTime
    );

    const processedData = googleFitService.processCalorieData(caloriesData);
    console.log(
      `Successfully retrieved calories data for user: ${req.user.name}, days: ${daysToFetch}`
    );
    console.log(
      `Calories data: ${processedData
        .map((day) => `${day.date}: ${day.calories} kcal`)
        .join(", ")}`
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Calories burned data retrieved successfully",
      data: processedData,
    });
  } catch (error) {
    console.error(
      `Error fetching calories for user ${req.user?.googleId}: ${error.message}`
    );

    if (error.message.includes("No fitness tokens")) {
      throw new NotFoundError(
        "No fitness tokens found for this user. Please authorize Google Fit access first."
      );
    }

    if (error.response && error.response.data) {
      throw new BadRequestError(
        `Google Fit API Error: ${error.response.data.error.message}`
      );
    }

    throw error;
  }
};

// Get just distance data
const getDistanceWalked = async (req, res) => {
  try {
    console.log(
      `Fetching distance walked for user: ${req.user.googleId}, name: ${req.user.name}`
    );
    const { days } = req.query;
    const daysToFetch = parseInt(days) || 7; // Default to 7 days

    // Validate days parameter
    if (isNaN(daysToFetch) || daysToFetch <= 0 || daysToFetch > 30) {
      throw new BadRequestError("Days parameter must be between 1 and 30");
    }

    const endTime = Date.now();
    const startTime = endTime - daysToFetch * 24 * 60 * 60 * 1000;

    const distanceData = await googleFitService.getDistanceWalked(
      req.user.googleId,
      startTime,
      endTime
    );

    const processedData = googleFitService.processDistanceData(distanceData);
    console.log(
      `Successfully retrieved distance data for user: ${req.user.name}, days: ${daysToFetch}`
    );
    console.log(
      `Distance data: ${processedData
        .map((day) => `${day.date}: ${day.distance} km`)
        .join(", ")}`
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Distance walked data retrieved successfully",
      data: processedData,
    });
  } catch (error) {
    console.error(
      `Error fetching distance for user ${req.user?.googleId}: ${error.message}`
    );

    if (error.message.includes("No fitness tokens")) {
      throw new NotFoundError(
        "No fitness tokens found for this user. Please authorize Google Fit access first."
      );
    }

    if (error.response && error.response.data) {
      throw new BadRequestError(
        `Google Fit API Error: ${error.response.data.error.message}`
      );
    }

    throw error;
  }
};

module.exports = {
  getFitnessSummary,
  getStepCount,
  getCaloriesBurned,
  getDistanceWalked,
};
