const { StatusCodes } = require("http-status-codes");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { BadRequestError, NotFoundError } = require("../../errors");

/**
 * GET: Fetch all availability data in one request
 * This endpoint returns dates, time slots, and machines available for booking
 */
const getAvailability = async (req, res) => {
  const { gymId, date, startTime, duration } = req.body;

  if (!gymId) {
    throw new BadRequestError("Gym ID is required");
  }

  try {
    // Check if gym exists
    const gym = await prisma.gym.findUnique({
      where: { id: parseInt(gymId) },
      include: { openingHours: true },
    });

    if (!gym) {
      throw new NotFoundError(`No gym found with id ${gymId}`);
    }

    // Calculate traffic indicators
    const capacityPercentage = (gym.currnt_users / gym.MaxCapacity) * 100;
    const trafficStatus = getTrafficStatus(capacityPercentage);

    // Initialize response object with traffic indicators
    const response = {
      success: true,
      gymDetails: {
        id: gym.id,
        name: gym.name,
        location: gym.location,
        imageUrl: gym.imageUrl,
        maxCapacity: gym.MaxCapacity,
        currentUsers: gym.currnt_users,
        capacityPercentage: Math.round(capacityPercentage),
        trafficStatus: trafficStatus,
        trafficIndicator: getTrafficIndicator(trafficStatus),
      },
    };

    // STEP 1: Get available dates if no date is provided
    if (!date) {
      const currentDate = new Date();
      const availableDates = [];

      // Check next 30 days for availability
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date();
        checkDate.setDate(currentDate.getDate() + i);

        // Get day of week (0-6, Sunday-Saturday)
        const dayOfWeek = checkDate.getDay();

        // Check if gym is open on this day
        const openingHour = gym.openingHours.find(
          (oh) => oh.dayOfWeek === dayOfWeek
        );

        if (openingHour) {
          // Predict traffic based on day of week
          const predictedTraffic = predictTrafficForDay(dayOfWeek);

          // If gym is open, add to available dates
          availableDates.push({
            date: checkDate.toISOString().split("T")[0], // Format as YYYY-MM-DD
            dayOfWeek,
            openTime: openingHour.openTime,
            closeTime: openingHour.closeTime,
            predictedTraffic: predictedTraffic,
            trafficIndicator: getTrafficIndicator(predictedTraffic),
          });
        }
      }

      response.availableDates = availableDates;
      return res.status(StatusCodes.OK).json(response);
    }

    // STEP 2: Get available time slots for the selected date
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();

    // Find opening hours for this day
    const openingHour = gym.openingHours.find(
      (oh) => oh.dayOfWeek === dayOfWeek
    );

    if (!openingHour) {
      throw new BadRequestError(`Gym is closed on ${date}`);
    }

    // Parse opening and closing times
    const [openHour, openMinute] = openingHour.openTime.split(":").map(Number);
    const [closeHour, closeMinute] = openingHour.closeTime
      .split(":")
      .map(Number);

    // Add opening hours and traffic prediction to response
    const dayTraffic = predictTrafficForDay(dayOfWeek);
    response.selectedDate = {
      date: date,
      dayOfWeek,
      openTime: openingHour.openTime,
      closeTime: openingHour.closeTime,
      predictedTraffic: dayTraffic,
      trafficIndicator: getTrafficIndicator(dayTraffic),
    };

    // If no start time is provided, return available time slots
    if (!startTime) {
      const timeSlots = [];
      const startDateTime = new Date(selectedDate);
      startDateTime.setHours(openHour, openMinute, 0, 0);

      const endDateTime = new Date(selectedDate);
      endDateTime.setHours(closeHour, closeMinute, 0, 0);

      // Create time slots (1-hour intervals)
      let currentSlotStart = new Date(startDateTime);

      while (currentSlotStart < endDateTime) {
        // Calculate end of this time slot (1 hour later)
        const currentSlotEnd = new Date(currentSlotStart);
        currentSlotEnd.setHours(currentSlotEnd.getHours() + 1);

        // Don't go past closing time
        if (currentSlotEnd > endDateTime) {
          currentSlotEnd.setTime(endDateTime.getTime());
        }

        // If slot is at least 30 minutes, include it
        if (currentSlotEnd - currentSlotStart >= 30 * 60 * 1000) {
          // Check existing bookings for this time slot
          const existingBookings = await prisma.gymBooking.count({
            where: {
              gymId: parseInt(gymId),
              status: { in: ["confirmed", "pending"] },
              startTime: { lte: currentSlotEnd },
              endTime: { gt: currentSlotStart },
            },
          });

          // Check gym capacity and predict traffic
          const availableCapacity = gym.MaxCapacity - existingBookings;
          const slotCapacityPercentage =
            (existingBookings / gym.MaxCapacity) * 100;
          const slotTrafficStatus = getTrafficStatus(slotCapacityPercentage);

          // Consider time of day for traffic prediction
          const hourOfDay = currentSlotStart.getHours();
          const timeBasedTraffic = predictTrafficForTimeOfDay(
            hourOfDay,
            dayOfWeek
          );

          // Combine actual bookings with time-based predictions
          const combinedTrafficStatus = combineTrafficIndicators(
            slotTrafficStatus,
            timeBasedTraffic
          );

          timeSlots.push({
            startTime: currentSlotStart.toISOString(),
            endTime: currentSlotEnd.toISOString(),
            availableCapacity,
            capacityPercentage: Math.round(slotCapacityPercentage),
            isAvailable: availableCapacity > 0,
            trafficStatus: combinedTrafficStatus,
            trafficIndicator: getTrafficIndicator(combinedTrafficStatus),
            // Standard durations that would be available
            possibleDurations: getPossibleDurations(
              currentSlotStart,
              endDateTime
            ),
          });
        }

        // Move to next slot
        currentSlotStart = currentSlotEnd;
      }

      response.timeSlots = timeSlots;
      return res.status(StatusCodes.OK).json(response);
    }

    // STEP 3: If both startTime and duration are provided, get available machines
    if (startTime && duration) {
      const start = new Date(startTime);

      // Calculate end time from duration
      const durationMinutes = parseInt(duration);
      if (isNaN(durationMinutes) || durationMinutes <= 0) {
        throw new BadRequestError(
          "Duration must be a positive number of minutes"
        );
      }

      const end = new Date(start);
      end.setMinutes(start.getMinutes() + durationMinutes);

      // Validate times
      if (start >= end) {
        throw new BadRequestError("End time must be after start time");
      }

      // Get existing bookings for this time slot
      const existingBookings = await prisma.gymBooking.count({
        where: {
          gymId: parseInt(gymId),
          status: { in: ["confirmed", "pending"] },
          startTime: { lte: end },
          endTime: { gt: start },
        },
      });

      // Calculate traffic for the selected time slot
      const slotCapacityPercentage = (existingBookings / gym.MaxCapacity) * 100;
      const slotTrafficStatus = getTrafficStatus(slotCapacityPercentage);

      // Add selected time slot to response with traffic info
      response.selectedTimeSlot = {
        startTime,
        calculatedEndTime: end.toISOString(),
        duration: durationMinutes,
        availableCapacity: gym.MaxCapacity - existingBookings,
        capacityPercentage: Math.round(slotCapacityPercentage),
        trafficStatus: slotTrafficStatus,
        trafficIndicator: getTrafficIndicator(slotTrafficStatus),
      };

      // Get all machines in the gym
      const gymMachines = await prisma.machine.findMany({
        where: {
          gymId: parseInt(gymId),
          status: "active",
          needService: false,
        },
      });

      // Get all bookings that overlap with the requested time slot
      const overlappingBookings = await prisma.gymBooking.findMany({
        where: {
          gymId: parseInt(gymId),
          status: { in: ["confirmed", "pending"] },
          OR: [
            {
              startTime: { lte: start },
              endTime: { gt: start },
            },
            {
              startTime: { lt: end },
              endTime: { gte: end },
            },
            {
              startTime: { gte: start },
              endTime: { lte: end },
            },
          ],
        },
        include: {
          machineBookings: true,
        },
      });

      // Get machine IDs that are already booked
      const bookedMachineIds = new Set();
      overlappingBookings.forEach((booking) => {
        booking.machineBookings.forEach((machineBooking) => {
          bookedMachineIds.add(machineBooking.machineId);
        });
      });

      // Calculate machine availability percentage
      const availableMachinePercentage =
        ((gymMachines.length - bookedMachineIds.size) / gymMachines.length) *
        100;

      // Filter and categorize available machines
      const availableMachines = gymMachines
        .filter((machine) => !bookedMachineIds.has(machine.id))
        .map((machine) => ({
          id: machine.id,
          name: machine.name,
          description: machine.description,
          imageUrl: machine.imageUrl,
          type: categorizeEquipment(machine.name),
          popularity: getEquipmentPopularity(machine.No_Of_Uses),
        }));

      // Group machines by type
      const machinesByType = {};
      availableMachines.forEach((machine) => {
        if (!machinesByType[machine.type]) {
          machinesByType[machine.type] = [];
        }
        machinesByType[machine.type].push(machine);
      });

      response.availableMachines = availableMachines;
      response.machinesByType = machinesByType;
      response.machineAvailability = {
        total: gymMachines.length,
        available: availableMachines.length,
        percentageAvailable: Math.round(availableMachinePercentage),
        availabilityStatus: getAvailabilityStatus(availableMachinePercentage),
      };
    }

    return res.status(StatusCodes.OK).json(response);
  } catch (error) {
    throw error;
  }
};

/**
 * POST: Create a booking with the selected options
 * Creates a gym session booking with selected time slot and machines
 */
const createBooking = async (req, res) => {
  const { userId, gymId, startTime, duration, selectedMachines } = req.body;

  if (!userId || !gymId || !startTime || !duration) {
    throw new BadRequestError(
      "User ID, gym ID, start time, and duration are required"
    );
  }

  try {
    // Check if gym exists
    const gym = await prisma.gym.findUnique({
      where: { id: parseInt(gymId) },
    });

    if (!gym) {
      throw new NotFoundError(`No gym found with id ${gymId}`);
    }

    // Parse start time and calculate end time from duration
    const start = new Date(startTime);

    // Duration should be in minutes, calculate end time
    const durationMinutes = parseInt(duration);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      throw new BadRequestError(
        "Duration must be a positive number of minutes"
      );
    }

    const end = new Date(start);
    end.setMinutes(start.getMinutes() + durationMinutes);

    // Check if gym is at capacity
    if (gym.currnt_users >= gym.MaxCapacity) {
      throw new BadRequestError(
        "Gym is at maximum capacity for this time slot"
      );
    }

    // Check if gym is open during the requested time
    const dayOfWeek = start.getDay();
    const openingHour = await prisma.openingHours.findFirst({
      where: {
        gymId: parseInt(gymId),
        dayOfWeek,
      },
    });

    if (!openingHour) {
      throw new BadRequestError("Gym is closed on this day");
    }

    // Parse opening and closing times
    const [openHour, openMinute] = openingHour.openTime.split(":").map(Number);
    const [closeHour, closeMinute] = openingHour.closeTime
      .split(":")
      .map(Number);

    const openTime = new Date(start);
    openTime.setHours(openHour, openMinute, 0, 0);

    const closeTime = new Date(start);
    closeTime.setHours(closeHour, closeMinute, 0, 0);

    if (start < openTime || end > closeTime) {
      throw new BadRequestError(
        `Gym is only open from ${openingHour.openTime} to ${openingHour.closeTime} on this day`
      );
    }

    // Check for existing bookings by this user during this time
    const conflictingBookings = await prisma.gymBooking.findMany({
      where: {
        userId,
        status: { in: ["confirmed", "pending"] },
        OR: [
          {
            startTime: { lte: start },
            endTime: { gt: start },
          },
          {
            startTime: { lt: end },
            endTime: { gte: end },
          },
          {
            startTime: { gte: start },
            endTime: { lte: end },
          },
        ],
      },
    });

    if (conflictingBookings.length > 0) {
      throw new BadRequestError("You already have a booking during this time");
    }

    // Create booking with transaction
    const booking = await prisma.$transaction(async (tx) => {
      // Create gym booking
      const gymBooking = await tx.gymBooking.create({
        data: {
          userId,
          gymId: parseInt(gymId),
          startTime: start,
          endTime: end,
          status: "confirmed",
        },
      });

      // Add machine bookings if provided
      if (selectedMachines && selectedMachines.length > 0) {
        for (const machine of selectedMachines) {
          // Validate machine exists and is available
          const machineExists = await tx.machine.findUnique({
            where: {
              id: parseInt(machine.id),
              status: "active",
              needService: false,
            },
          });

          if (!machineExists) {
            throw new BadRequestError(`Machine ${machine.id} is not available`);
          }

          // Check if machine is already booked during this time
          const machineBooked = await tx.machineBooking.findFirst({
            where: {
              machineId: parseInt(machine.id),
              booking: {
                status: { in: ["confirmed", "pending"] },
                OR: [
                  {
                    startTime: { lte: start },
                    endTime: { gt: start },
                  },
                  {
                    startTime: { lt: end },
                    endTime: { gte: end },
                  },
                  {
                    startTime: { gte: start },
                    endTime: { lte: end },
                  },
                ],
              },
            },
          });

          if (machineBooked) {
            throw new BadRequestError(
              `Machine ${machineExists.name} is already booked`
            );
          }

          // Create machine booking - use the overall session duration for each machine
          await tx.machineBooking.create({
            data: {
              bookingId: gymBooking.id,
              machineId: parseInt(machine.id),
              duration: durationMinutes, // Use the overall session duration
            },
          });
        }
      }

      // Increment current users count for the gym
      await tx.gym.update({
        where: { id: parseInt(gymId) },
        data: { currnt_users: { increment: 1 } },
      });

      return gymBooking;
    });

    // Get complete booking details
    const completeBooking = await prisma.gymBooking.findUnique({
      where: { id: booking.id },
      include: {
        gym: {
          select: {
            name: true,
            location: true,
            imageUrl: true,
          },
        },
        machineBookings: {
          include: {
            machine: {
              select: {
                name: true,
                description: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Booking created successfully",
      booking: completeBooking,
      duration: durationMinutes,
      calculatedEndTime: end.toISOString(), // Include the calculated end time in the response
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Helper function to get possible durations for a time slot
 */
function getPossibleDurations(startTime, endTime) {
  // Calculate maximum possible duration in minutes
  const maxDurationMinutes = Math.floor((endTime - startTime) / (1000 * 60));

  // Standard duration options (in minutes)
  const standardDurations = [30, 60, 90, 120];

  // Filter durations that fit within the time slot
  return standardDurations
    .filter((duration) => duration <= maxDurationMinutes)
    .map((duration) => ({
      duration,
      label: `${duration >= 60 ? Math.floor(duration / 60) + "h" : ""} ${
        duration % 60 > 0 ? (duration % 60) + "min" : ""
      }`.trim(),
    }));
}

/**
 * Helper function to categorize equipment by name
 */
function categorizeEquipment(name) {
  name = name.toLowerCase();

  if (name.includes("bench") || name.includes("press")) {
    return "strength";
  } else if (
    name.includes("treadmill") ||
    name.includes("bike") ||
    name.includes("elliptical")
  ) {
    return "cardio";
  } else if (name.includes("row") || name.includes("pull")) {
    return "back";
  } else if (
    name.includes("leg") ||
    name.includes("squat") ||
    name.includes("extension")
  ) {
    return "legs";
  } else if (name.includes("curl") || name.includes("bicep")) {
    return "arms";
  } else {
    return "other";
  }
}

/**
 * Get traffic status based on capacity percentage
 */
function getTrafficStatus(capacityPercentage) {
  if (capacityPercentage >= 75) {
    return "high";
  } else if (capacityPercentage >= 50) {
    return "medium-high";
  } else if (capacityPercentage >= 25) {
    return "medium";
  } else {
    return "low";
  }
}

/**
 * Get visual indicator for traffic status
 */
function getTrafficIndicator(trafficStatus) {
  switch (trafficStatus) {
    case "high":
      return "🔴"; // Red circle
    case "medium-high":
      return "🟠"; // Orange circle
    case "medium":
      return "🟡"; // Yellow circle
    case "low":
      return "🟢"; // Green circle
    default:
      return "⚪"; // White circle
  }
}

/**
 * Predict traffic based on day of week
 */
function predictTrafficForDay(dayOfWeek) {
  // Common patterns: weekends and Mondays tend to be busier
  switch (dayOfWeek) {
    case 0: // Sunday
      return "high";
    case 1: // Monday
      return "medium-high";
    case 5: // Friday
      return "medium-high";
    case 6: // Saturday
      return "high";
    case 3: // Wednesday - often less busy
      return "low";
    default:
      return "medium";
  }
}

/**
 * Predict traffic based on time of day
 */
function predictTrafficForTimeOfDay(hour, dayOfWeek) {
  // Common gym busy hours: early morning, lunch time, after work
  if (hour >= 6 && hour < 9) {
    return "high"; // Morning rush
  } else if (hour >= 12 && hour < 14) {
    return "medium-high"; // Lunch time
  } else if (hour >= 17 && hour < 20) {
    return "high"; // After work rush
  } else if (hour >= 20 || hour < 6) {
    return "low"; // Late night/early morning
  } else {
    return "medium"; // Mid-day
  }
}

/**
 * Combine actual traffic with predicted traffic
 */
function combineTrafficIndicators(actual, predicted) {
  const trafficLevels = {
    low: 1,
    medium: 2,
    "medium-high": 3,
    high: 4,
  };

  // Weight actual traffic more heavily (70%) than predictions (30%)
  const actualWeight = 0.7;
  const predictedWeight = 0.3;

  const combinedValue =
    trafficLevels[actual] * actualWeight +
    trafficLevels[predicted] * predictedWeight;

  if (combinedValue >= 3.5) {
    return "high";
  } else if (combinedValue >= 2.5) {
    return "medium-high";
  } else if (combinedValue >= 1.5) {
    return "medium";
  } else {
    return "low";
  }
}

/**
 * Get machine availability status
 */
function getAvailabilityStatus(percentageAvailable) {
  if (percentageAvailable >= 75) {
    return "high";
  } else if (percentageAvailable >= 50) {
    return "medium";
  } else if (percentageAvailable >= 25) {
    return "limited";
  } else {
    return "low";
  }
}

/**
 * Get equipment popularity rating based on usage
 */
function getEquipmentPopularity(usageCount) {
  if (usageCount >= 1000) {
    return "very popular";
  } else if (usageCount >= 500) {
    return "popular";
  } else if (usageCount >= 100) {
    return "average";
  } else {
    return "less used";
  }
}

module.exports = {
  getAvailability,
  createBooking,
};
