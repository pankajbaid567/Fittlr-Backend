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

  async getUserTokens(userId) {
    console.log(`Getting fitness tokens for user ID: ${userId}`);

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

    // If token is expired, refresh it
    if (tokens.expiry_date < Math.floor(Date.now() / 1000)) {
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

  async getStepCount(userId, startTime, endTime) {
    console.log(`Requesting step count data for user: ${userId}`);
    console.log(
      `Date range: ${new Date(startTime).toISOString()} to ${new Date(
        endTime
      ).toISOString()}`
    );

    const auth = await this.getUserTokens(userId);

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

  async getCaloriesBurned(userId, startTime, endTime) {
    console.log(`Requesting calories burned data for user: ${userId}`);
    console.log(
      `Date range: ${new Date(startTime).toISOString()} to ${new Date(
        endTime
      ).toISOString()}`
    );

    const auth = await this.getUserTokens(userId);

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

  async getDistanceWalked(userId, startTime, endTime) {
    console.log(`Requesting distance walked data for user: ${userId}`);
    console.log(
      `Date range: ${new Date(startTime).toISOString()} to ${new Date(
        endTime
      ).toISOString()}`
    );

    const auth = await this.getUserTokens(userId);

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

  async getFitnessSummary(userId, days = 7) {
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000; // Last 'n' days

    const [steps, calories, distance] = await Promise.all([
      this.getStepCount(userId, startTime, endTime),
      this.getCaloriesBurned(userId, startTime, endTime),
      this.getDistanceWalked(userId, startTime, endTime),
    ]);

    // Process and format the data without storing it
    return {
      steps: this.processStepData(steps),
      calories: this.processCalorieData(calories),
      distance: this.processDistanceData(distance),
    };
  }

  processStepData(data) {
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
    return result;
  }

  processCalorieData(data) {
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
    return result;
  }

  processDistanceData(data) {
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

        // Convert meters to kilometers
        result.push({
          date: startDate.toISOString().split("T")[0],
          distance: parseFloat((distance / 1000).toFixed(2)),
        });
      });
    }
    return result;
  }
}

module.exports = new GoogleFitService();
