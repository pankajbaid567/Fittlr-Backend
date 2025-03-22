const { StatusCodes } = require("http-status-codes");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { BadRequestError, NotFoundError } = require("../../errors");

/**
 * Create a new booking with proper machine usage and service tracking
 */
const createNewBooking = async (req, res) => {
  const { userId, gymId, startTime, endTime, machines } = req.body;

  if (!userId || !gymId || !startTime || !endTime) {
    throw new BadRequestError("Please provide all required fields");
  }

  // Check if the gym exists
  const gym = await prisma.gym.findUnique({
    where: { id: parseInt(gymId) },
  });

  if (!gym) {
    throw new NotFoundError(`No gym found with id ${gymId}`);
  }

  // Validate booking times
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    throw new BadRequestError("End time must be after start time");
  }

  // Check for booking conflicts
  const conflictingBookings = await prisma.gymBooking.findMany({
    where: {
      userId,
      status: { in: ["confirmed", "pending"] },
      OR: [
        { startTime: { lte: start }, endTime: { gt: start } },
        { startTime: { lt: end }, endTime: { gte: end } },
        { startTime: { gte: start }, endTime: { lte: end } },
      ],
    },
  });

  if (conflictingBookings.length > 0) {
    throw new BadRequestError("You already have a booking during this time");
  }

  // Create booking with transaction to ensure data consistency
  const booking = await prisma.$transaction(async (tx) => {
    // Create the gym booking
    const gymBooking = await tx.gymBooking.create({
      data: {
        userId,
        gymId: parseInt(gymId),
        startTime: start,
        endTime: end,
        status: "confirmed",
      },
    });

    // Check machine availability and service status before booking
    if (machines && machines.length > 0) {
      for (const machine of machines) {
        const machineId = parseInt(machine.machineId);

        // Check if machine exists and is available
        const machineInfo = await tx.machine.findUnique({
          where: { id: machineId },
          include: { service: true },
        });

        if (!machineInfo) {
          throw new NotFoundError(`Machine with id ${machineId} not found`);
        }

        // Check machine status before booking
        if (machineInfo.needService || machineInfo.status !== "active") {
          throw new BadRequestError(
            `Machine ${machineInfo.name} is currently unavailable (${machineInfo.status})`
          );
        }

        // Check if machine will need service soon
        if (machineInfo.service) {
          const remainingUntilService =
            machineInfo.service.serviceIntervalHours -
            machineInfo.service.totalUsageHours;

          // If machine is close to needing service (less than 5 hours remaining)
          if (remainingUntilService < 5) {
            // We can still let them book but flag a warning
            console.log(
              `Warning: Machine ${machineInfo.name} will need service soon`
            );
          }
        }

        // Create machine booking
        await tx.machineBooking.create({
          data: {
            bookingId: gymBooking.id,
            machineId: machineId,
            duration:
              machine.duration || Math.floor((end - start) / (1000 * 60)), // Convert to minutes
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

  // Return the created booking with details
  const bookingWithDetails = await prisma.gymBooking.findUnique({
    where: { id: booking.id },
    include: {
      gym: { select: { name: true, location: true, imageUrl: true } },
      machineBookings: {
        include: {
          machine: {
            select: { name: true, description: true, imageUrl: true },
          },
        },
      },
    },
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    booking: bookingWithDetails,
  });
};

module.exports = {
  createNewBooking,
};
