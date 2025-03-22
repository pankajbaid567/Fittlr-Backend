const { google } = require("googleapis");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

class GoogleFitService {
  constructor() {
    this.fitness = google.fitness("v1");
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback"
    );
  }

  async getUserTokens(userId, forceRefresh = true) {
    console.log(
      `Getting fitness tokens for user ID: ${userId} with forceRefresh: ${forceRefresh}`
    );

    const tokens = await prisma.fitnessToken.findUnique({
      where: { userId },
    });

    if (!tokens) {
      console.log(`No fitness tokens found for user ID: ${userId}`);
      throw new Error("No fitness tokens found for this user");
    }

    console.log(
      `Fitness tokens found for user ID: ${userId}, expiry: ${new Date(
        tokens.expiry_date * 1000
      )}`
    );

    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date * 1000,
    });

    // Force refresh token for maximum freshness if requested
    if (forceRefresh) {
      console.log(
        `Forcing token refresh for user ID: ${userId} to ensure fresh data`
      );
      try {
        const { credentials } = await this.oauth2Client.refreshAccessToken();
        console.log(`Token forcibly refreshed for user ID: ${userId}`);

        // Update tokens in database
        await prisma.fitnessToken.update({
          where: { userId },
          data: {
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token || tokens.refresh_token,
            expiry_date: Math.floor(credentials.expiry_date / 1000),
          },
        });
        console.log(`Updated token in database for user ID: ${userId}`);
      } catch (refreshError) {
        console.error(`Error forcing token refresh: ${refreshError.message}`);
        console.log(`Continuing with existing token`);
        // Continue with existing token if refresh fails
      }
    }
    // If not forcing refresh, still refresh if expired
    else if (tokens.expiry_date < Math.floor(Date.now() / 1000)) {
      console.log(`Token expired for user ID: ${userId}, refreshing...`);

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      console.log(`Token refreshed successfully for user ID: ${userId}`);

      // Update tokens in database
      await prisma.fitnessToken.update({
        where: { userId },
        data: {
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || tokens.refresh_token,
          expiry_date: Math.floor(credentials.expiry_date / 1000),
        },
      });

      console.log(`Updated token in database for user ID: ${userId}`);
    }

    return this.oauth2Client;
  }

  async getStepCount(userId, startTime, endTime, useForceRefresh = false) {
    console.log(
      `Requesting step count data for user: ${userId} with forceRefresh: ${useForceRefresh}`
    );
    console.log(
      `Date range: ${new Date(startTime).toISOString()} to ${new Date(
        endTime
      ).toISOString()}`
    );

    const auth = await this.getUserTokens(userId, useForceRefresh);

    const response = await this.fitness.users.dataset.aggregate({
      auth,
      userId: "me",
      requestBody: {
        aggregateBy: [
          {
            dataTypeName: "com.google.step_count.delta",
            dataSourceId:
              "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
          },
        ],
        bucketByTime: { durationMillis: 86400000 }, // Daily buckets
        startTimeMillis: startTime,
        endTimeMillis: endTime,
      },
    });

    console.log(`Successfully fetched step count data from Google Fit API`);

    return response.data;
  }

  async getCaloriesBurned(userId, startTime, endTime, useForceRefresh = false) {
    console.log(`Requesting calories burned data for user: ${userId}`);
    console.log(
      `Date range: ${new Date(startTime).toISOString()} to ${new Date(
        endTime
      ).toISOString()}`
    );

    const auth = await this.getUserTokens(userId, useForceRefresh);

    const response = await this.fitness.users.dataset.aggregate({
      auth,
      userId: "me",
      requestBody: {
        aggregateBy: [
          {
            dataTypeName: "com.google.calories.expended",
            dataSourceId:
              "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended",
          },
        ],
        bucketByTime: { durationMillis: 86400000 }, // Daily buckets
        startTimeMillis: startTime,
        endTimeMillis: endTime,
      },
    });

    console.log(
      `Successfully fetched calories burned data from Google Fit API`
    );

    return response.data;
  }

  async getDistanceWalked(userId, startTime, endTime, useForceRefresh = false) {
    console.log(`Requesting distance walked data for user: ${userId}`);
    console.log(
      `Date range: ${new Date(startTime).toISOString()} to ${new Date(
        endTime
      ).toISOString()}`
    );

    const auth = await this.getUserTokens(userId, useForceRefresh);

    const response = await this.fitness.users.dataset.aggregate({
      auth,
      userId: "me",
      requestBody: {
        aggregateBy: [
          {
            dataTypeName: "com.google.distance.delta",
            dataSourceId:
              "derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta",
          },
        ],
        bucketByTime: { durationMillis: 86400000 }, // Daily buckets
        startTimeMillis: startTime,
        endTimeMillis: endTime,
      },
    });

    console.log(
      `Successfully fetched distance walked data from Google Fit API`
    );

    return response.data;
  }

  async getFitnessSummary(userId, days = 7, includeToday = true) {
    // Calculate time range using Indian timezone (UTC+5:30)
    const indianOffset = 5.5 * 60 * 60 * 1000; // 5 hours and 30 minutes in milliseconds

    // Get current time in Indian timezone
    const now = new Date();
    const indianTime = new Date(
      now.getTime() + (indianOffset - now.getTimezoneOffset() * 60000)
    );
    console.log(`Current Indian time: ${indianTime.toISOString()}`);

    // Use current Indian time for end time
    const endTime = indianTime.getTime();

    // Create start date in Indian timezone (days ago at midnight IST)
    const startDate = new Date(indianTime);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    const startTime = startDate.getTime();

    console.log(`Fetching fitness data in INDIAN TIMEZONE with FORCED REFRESH`);
    console.log(
      `Indian date range: ${new Date(startTime).toISOString()} to ${new Date(
        endTime
      ).toISOString()}`
    );

    try {
      // Always force token refresh for maximum data freshness
      const auth = await this.getUserTokens(userId, true);
      console.log(`Using freshly refreshed token for data fetch`);

      // First get historical data with fresh token
      const [steps, calories, distance] = await Promise.all([
        this.getStepCount(userId, startTime, endTime, true),
        this.getCaloriesBurned(userId, startTime, endTime, true),
        this.getDistanceWalked(userId, startTime, endTime, true),
      ]);

      // Process historical data
      const processedData = {
        steps: this.processStepData(steps),
        calories: this.processCalorieData(calories),
        distance: this.processDistanceData(distance),
        lastUpdated: indianTime.toISOString(),
        timeZone: "Asia/Kolkata",
      };

      // Always get today's data separately for maximum freshness
      try {
        // Set today's start to midnight in Indian timezone
        const todayStart = new Date(indianTime);
        todayStart.setHours(0, 0, 0, 0);

        console.log(
          `Fetching TODAY'S data separately with maximum freshness (IST)`
        );
        console.log(
          `Today's Indian time range: ${todayStart.toISOString()} to ${indianTime.toISOString()}`
        );

        // Use point-by-point data for today with freshly refreshed token
        const todayData = await this.getTodaysDetailedData(
          userId,
          todayStart.getTime(),
          now.getTime(),
          true
        );

        // Merge today's detailed data with historical data
        this.mergeLatestData(processedData, todayData);

        console.log(
          `Successfully merged today's fresh data with historical data (IST)`
        );
      } catch (todayError) {
        console.error(
          `Error fetching today's detailed data: ${todayError.message}`
        );
        // Continue with regular data even if today's detailed fetch fails
      }

      return processedData;
    } catch (error) {
      console.error(`Error fetching fitness data: ${error.message}`);
      throw error;
    }
  }

  async getTodaysDetailedData(
    userId,
    startTime,
    endTime,
    useForceRefresh = true
  ) {
    console.log(
      `Fetching detailed real-time data for today with forceRefresh: ${useForceRefresh}`
    );
    const auth = await this.getUserTokens(userId, useForceRefresh);

    // Use a more fine-grained approach for today's data
    // First get steps
    const stepsResponse = await this.fitness.users.dataSources.datasets.get({
      auth,
      userId: "me",
      dataSourceId:
        "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
      datasetId: `${startTime * 1000000}-${endTime * 1000000}`,
    });

    // Get calories
    const caloriesResponse = await this.fitness.users.dataSources.datasets.get({
      auth,
      userId: "me",
      dataSourceId:
        "derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended",
      datasetId: `${startTime * 1000000}-${endTime * 1000000}`,
    });

    // Get distance
    const distanceResponse = await this.fitness.users.dataSources.datasets.get({
      auth,
      userId: "me",
      dataSourceId:
        "derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta",
      datasetId: `${startTime * 1000000}-${endTime * 1000000}`,
    });

    console.log(`Successfully fetched detailed data for today`);

    // Process the detailed data for today
    return {
      steps: this.processTodayStepData(stepsResponse.data),
      calories: this.processTodayCalorieData(caloriesResponse.data),
      distance: this.processTodayDistanceData(distanceResponse.data),
    };
  }

  processTodayStepData(data) {
    let totalSteps = 0;

    if (data.point && data.point.length) {
      data.point.forEach((point) => {
        if (point.value && point.value.length) {
          totalSteps += point.value[0].intVal || 0;
        }
      });
    }

    // Use Indian timezone for date
    const indianOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const indianTime = new Date(
      now.getTime() + (indianOffset - now.getTimezoneOffset() * 60000)
    );

    return {
      date: indianTime.toISOString().split("T")[0],
      steps: totalSteps,
    };
  }

  processTodayCalorieData(data) {
    let totalCalories = 0;

    if (data.point && data.point.length) {
      data.point.forEach((point) => {
        if (point.value && point.value.length) {
          totalCalories += point.value[0].fpVal || 0;
        }
      });
    }

    // Use Indian timezone for date
    const indianOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const indianTime = new Date(
      now.getTime() + (indianOffset - now.getTimezoneOffset() * 60000)
    );

    return {
      date: indianTime.toISOString().split("T")[0],
      calories: Math.round(totalCalories),
    };
  }

  processTodayDistanceData(data) {
    let totalDistance = 0;

    if (data.point && data.point.length) {
      data.point.forEach((point) => {
        if (point.value && point.value.length) {
          totalDistance += point.value[0].fpVal || 0;
        }
      });
    }

    // Use Indian timezone for date
    const indianOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const indianTime = new Date(
      now.getTime() + (indianOffset - now.getTimezoneOffset() * 60000)
    );

    return {
      date: indianTime.toISOString().split("T")[0],
      distance: parseFloat((totalDistance / 1000).toFixed(2)),
    };
  }

  mergeLatestData(processedData, todayData) {
    const today = new Date().toISOString().split("T")[0];

    // Helper function to update or add today's data
    const updateOrAddTodayData = (dataArray, todayValue) => {
      const todayIndex = dataArray.findIndex((item) => item.date === today);

      if (todayIndex >= 0) {
        // Update existing entry for today
        dataArray[todayIndex] = todayValue;
      } else {
        // Add new entry for today
        dataArray.push(todayValue);
      }
    };

    // Update steps
    if (todayData.steps && todayData.steps.steps > 0) {
      updateOrAddTodayData(processedData.steps, todayData.steps);
    }

    // Update calories
    if (todayData.calories && todayData.calories.calories > 0) {
      updateOrAddTodayData(processedData.calories, todayData.calories);
    }

    // Update distance
    if (todayData.distance && todayData.distance.distance > 0) {
      updateOrAddTodayData(processedData.distance, todayData.distance);
    }

    // Add metadata
    processedData.realTimeDataIncluded = true;
    processedData.realTimeUpdatedAt = new Date().toISOString();
  }

  // Ensure all dates in the range have data points (even zeros)
  processStepData(data) {
    // First process the data from Google Fit
    const result = [];
    if (data.bucket && data.bucket.length) {
      data.bucket.forEach((bucket) => {
        const startDate = new Date(parseInt(bucket.startTimeMillis));
        let steps = 0;

        if (bucket.dataset && bucket.dataset.length) {
          bucket.dataset.forEach((dataset) => {
            if (dataset.point && dataset.point.length) {
              dataset.point.forEach((point) => {
                if (point.value && point.value.length) {
                  steps += point.value[0].intVal || 0;
                }
              });
            }
          });
        }

        result.push({
          date: startDate.toISOString().split("T")[0],
          steps,
        });
      });
    }

    // Now fill in any gaps in the date range
    if (result.length > 0) {
      // Sort by date
      result.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Create a complete date range from first to last date
      const firstDate = new Date(result[0].date);
      const lastDate = new Date(result[result.length - 1].date);

      // Create a map of existing data points
      const dataMap = new Map();
      result.forEach((item) => dataMap.set(item.date, item.steps));

      // Create a new array with complete date range
      const completeResult = [];
      const currentDate = new Date(firstDate);

      // Iterate through every day in the range
      while (currentDate <= lastDate) {
        const dateString = currentDate.toISOString().split("T")[0];

        // Use existing data or zero
        completeResult.push({
          date: dateString,
          steps: dataMap.has(dateString) ? dataMap.get(dateString) : 0,
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(
        `Filled in date gaps. Original: ${result.length} days, Complete: ${completeResult.length} days`
      );
      return completeResult;
    }

    return result;
  }

  // Update processCalorieData with the same gap-filling logic
  processCalorieData(data) {
    // First process data from Google Fit (same as before)
    const result = [];
    if (data.bucket && data.bucket.length) {
      data.bucket.forEach((bucket) => {
        const startDate = new Date(parseInt(bucket.startTimeMillis));
        let calories = 0;

        if (bucket.dataset && bucket.dataset.length) {
          bucket.dataset.forEach((dataset) => {
            if (dataset.point && dataset.point.length) {
              dataset.point.forEach((point) => {
                if (point.value && point.value.length) {
                  calories += point.value[0].fpVal || 0;
                }
              });
            }
          });
        }

        result.push({
          date: startDate.toISOString().split("T")[0],
          calories: Math.round(calories),
        });
      });
    }

    // Now fill in gaps
    if (result.length > 0) {
      result.sort((a, b) => new Date(a.date) - new Date(b.date));

      const firstDate = new Date(result[0].date);
      const lastDate = new Date(result[result.length - 1].date);

      const dataMap = new Map();
      result.forEach((item) => dataMap.set(item.date, item.calories));

      const completeResult = [];
      const currentDate = new Date(firstDate);

      while (currentDate <= lastDate) {
        const dateString = currentDate.toISOString().split("T")[0];

        completeResult.push({
          date: dateString,
          calories: dataMap.has(dateString) ? dataMap.get(dateString) : 0,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return completeResult;
    }

    return result;
  }

  // Update processDistanceData with the same gap-filling logic
  processDistanceData(data) {
    // First process data from Google Fit (same as before)
    const result = [];
    if (data.bucket && data.bucket.length) {
      data.bucket.forEach((bucket) => {
        const startDate = new Date(parseInt(bucket.startTimeMillis));
        let distance = 0;

        if (bucket.dataset && bucket.dataset.length) {
          bucket.dataset.forEach((dataset) => {
            if (dataset.point && dataset.point.length) {
              dataset.point.forEach((point) => {
                if (point.value && point.value.length) {
                  distance += point.value[0].fpVal || 0;
                }
              });
            }
          });
        }

        result.push({
          date: startDate.toISOString().split("T")[0],
          distance: parseFloat((distance / 1000).toFixed(2)),
        });
      });
    }

    // Now fill in gaps
    if (result.length > 0) {
      result.sort((a, b) => new Date(a.date) - new Date(b.date));

      const firstDate = new Date(result[0].date);
      const lastDate = new Date(result[result.length - 1].date);

      const dataMap = new Map();
      result.forEach((item) => dataMap.set(item.date, item.distance));

      const completeResult = [];
      const currentDate = new Date(firstDate);

      while (currentDate <= lastDate) {
        const dateString = currentDate.toISOString().split("T")[0];

        completeResult.push({
          date: dateString,
          distance: dataMap.has(dateString) ? dataMap.get(dateString) : 0,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return completeResult;
    }

    return result;
  }

  async getLastSevenDaysData(userId) {
    console.log(`Getting guaranteed 7-day data for user ID: ${userId}`);

    // Force token refresh for maximum freshness
    await this.getUserTokens(userId, true);

    // Calculate the Indian date range for the last 7 days
    const indianOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const indianTime = new Date(
      now.getTime() + (indianOffset - now.getTimezoneOffset() * 60000)
    );

    // End time is current time
    const endTime = indianTime.getTime();

    // Start time is 7 days ago from now
    const startDate = new Date(indianTime);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    const startTime = startDate.getTime();

    console.log(
      `Fetching 7-day fitness data in IST: ${startDate.toISOString()} to ${indianTime.toISOString()}`
    );

    try {
      // Create a template of all 7 days that must be in the result
      const sevenDayTemplate = this.createDateTemplate(startDate, indianTime);
      console.log(
        `Created 7-day template with dates: ${sevenDayTemplate
          .map((d) => d.date)
          .join(", ")}`
      );

      // Fetch data from Google Fit
      const [steps, calories, distance] = await Promise.all([
        this.getStepCount(userId, startTime, endTime, true),
        this.getCaloriesBurned(userId, startTime, endTime, true),
        this.getDistanceWalked(userId, startTime, endTime, true),
      ]);

      // Process data with the template to ensure we have entries for all 7 days
      const processedSteps = this.processDataWithTemplate(
        steps,
        sevenDayTemplate,
        "steps"
      );
      const processedCalories = this.processDataWithTemplate(
        calories,
        sevenDayTemplate,
        "calories"
      );
      const processedDistance = this.processDataWithTemplate(
        distance,
        sevenDayTemplate,
        "distance"
      );

      // Log any days that had to be filled with zero values
      const filledDays = processedSteps
        .filter((day) => !day.hasData)
        .map((day) => day.date);
      if (filledDays.length > 0) {
        console.log(
          `Had to fill in data for days with no Google Fit data: ${filledDays.join(
            ", "
          )}`
        );
      }

      return {
        steps: processedSteps,
        calories: processedCalories,
        distance: processedDistance,
        lastUpdated: indianTime.toISOString(),
        timeZone: "Asia/Kolkata",
      };
    } catch (error) {
      console.error(`Error fetching 7-day fitness data: ${error.message}`);
      throw error;
    }
  }

  // Create a template with all days in the date range
  createDateTemplate(startDate, endDate) {
    const template = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      template.push({
        date: currentDate.toISOString().split("T")[0],
        hasData: false, // Will be set to true if we find actual data
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return template;
  }

  // Process data with template to ensure all days are included
  processDataWithTemplate(data, template, valueKey) {
    // Map to store actual values from Google Fit
    const dataMap = new Map();

    // Process the Google Fit data
    if (data.bucket && data.bucket.length) {
      data.bucket.forEach((bucket) => {
        const date = new Date(parseInt(bucket.startTimeMillis))
          .toISOString()
          .split("T")[0];
        let value = 0;

        if (bucket.dataset && bucket.dataset.length) {
          bucket.dataset.forEach((dataset) => {
            if (dataset.point && dataset.point.length) {
              dataset.point.forEach((point) => {
                if (point.value && point.value.length) {
                  if (valueKey === "steps") {
                    value += point.value[0].intVal || 0;
                  } else {
                    value += point.value[0].fpVal || 0;
                  }
                }
              });
            }
          });
        }

        if (valueKey === "distance") {
          value = parseFloat((value / 1000).toFixed(2)); // Convert to km
        } else if (valueKey === "calories") {
          value = Math.round(value); // Round calories
        }

        dataMap.set(date, value);
      });
    }

    // Create the final result by merging template with actual data
    return template.map((day) => {
      const hasData = dataMap.has(day.date);
      return {
        date: day.date,
        [valueKey]: hasData ? dataMap.get(day.date) : 0,
        hasData, // For debugging, can be removed in production
      };
    });
  }

  async getExactSevenDaysData(userId) {
    console.log(
      `==== FETCHING EXACTLY 7 DAYS DATA WITH GUARANTEED CONTINUITY ====`
    );

    // Force token refresh
    await this.getUserTokens(userId, true);

    // Get Indian time (UTC+5:30)
    const indianOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const indianTime = new Date(
      now.getTime() + (indianOffset - now.getTimezoneOffset() * 60000)
    );

    // Create a 7-day array starting from today (in IST) and going back 6 days
    const sevenDays = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(indianTime);
      day.setDate(day.getDate() - i);
      sevenDays.push(day.toISOString().split("T")[0]);
    }

    console.log(`Creating exact 7-day template: ${sevenDays.join(", ")}`);

    // Calculate time range - make it slightly wider to ensure we get all data
    const endTime = indianTime.getTime() + 24 * 60 * 60 * 1000; // Add a day to include everything
    const startDate = new Date(indianTime);
    startDate.setDate(startDate.getDate() - 7); // Go back 7 days
    startDate.setHours(0, 0, 0, 0);
    const startTime = startDate.getTime();

    console.log(
      `Fetching data from ${new Date(startTime).toISOString()} to ${new Date(
        endTime
      ).toISOString()}`
    );

    try {
      // Get data from Google Fit API
      const [stepsData, caloriesData, distanceData] = await Promise.all([
        this.getStepCount(userId, startTime, endTime, true),
        this.getCaloriesBurned(userId, startTime, endTime, true),
        this.getDistanceWalked(userId, startTime, endTime, true),
      ]);

      // Extract data from Google Fit responses into maps
      const stepsMap = this.extractDataToMap(stepsData, "steps");
      const caloriesMap = this.extractDataToMap(caloriesData, "calories");
      const distanceMap = this.extractDataToMap(distanceData, "distance");

      // Fill the 7-day templates with actual data or zeros
      const steps = sevenDays.map((date) => ({
        date,
        steps: stepsMap.has(date) ? stepsMap.get(date) : 0,
      }));

      const calories = sevenDays.map((date) => ({
        date,
        calories: caloriesMap.has(date) ? caloriesMap.get(date) : 0,
      }));

      const distance = sevenDays.map((date) => ({
        date,
        distance: distanceMap.has(date) ? distanceMap.get(date) : 0,
      }));

      // Verify we have exactly 7 days
      console.log(`VERIFICATION: Steps data has ${steps.length} days`);
      console.log(`VERIFICATION: Calories data has ${calories.length} days`);
      console.log(`VERIFICATION: Distance data has ${distance.length} days`);

      // Log all dates for debugging
      console.log(`Step days: ${steps.map((d) => d.date).join(", ")}`);

      return {
        steps,
        calories,
        distance,
        lastUpdated: indianTime.toISOString(),
        timeZone: "Asia/Kolkata",
        isForced7DayData: true,
      };
    } catch (error) {
      console.error(`Error in getExactSevenDaysData: ${error.message}`);
      throw error;
    }
  }

  // Extract data from Google Fit response to a map for easy lookup
  extractDataToMap(data, valueKey) {
    const dataMap = new Map();

    if (data && data.bucket && data.bucket.length) {
      data.bucket.forEach((bucket) => {
        const date = new Date(parseInt(bucket.startTimeMillis))
          .toISOString()
          .split("T")[0];
        let value = 0;

        if (bucket.dataset && bucket.dataset.length) {
          bucket.dataset.forEach((dataset) => {
            if (dataset.point && dataset.point.length) {
              dataset.point.forEach((point) => {
                if (point.value && point.value.length) {
                  if (valueKey === "steps") {
                    value += point.value[0].intVal || 0;
                  } else {
                    value += point.value[0].fpVal || 0;
                  }
                }
              });
            }
          });
        }

        if (valueKey === "distance") {
          value = parseFloat((value / 1000).toFixed(2)); // Convert to km
        } else if (valueKey === "calories") {
          value = Math.round(value); // Round calories
        }

        dataMap.set(date, value);
        console.log(`Found data for ${date}: ${valueKey}=${value}`);
      });
    }

    return dataMap;
  }
}

module.exports = new GoogleFitService();
