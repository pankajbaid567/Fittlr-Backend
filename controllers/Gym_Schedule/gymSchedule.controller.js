const { StatusCodes } = require("http-status-codes");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} = require("../../errors");

// Create a new gym booking with optional machine bookings
const createGymBooking = async (req, res) => {
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

  // Check for booking conflicts (overlapping bookings)
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

  // Create gym booking transaction to ensure all operations succeed or fail together
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

    // If machines are provided, create machine bookings
    if (machines && machines.length > 0) {
      // Check if all machines exist and are available
      for (const machine of machines) {
        const machineExists = await tx.machine.findUnique({
          where: { id: parseInt(machine.machineId) },
        });

        if (!machineExists) {
          throw new NotFoundError(
            `Machine with id ${machine.machineId} not found`
          );
        }

        if (machineExists.needService) {
          throw new BadRequestError(
            `Machine ${machineExists.name} is currently under maintenance`
          );
        }

        // Create machine booking
        await tx.machineBooking.create({
          data: {
            bookingId: gymBooking.id,
            machineId: parseInt(machine.machineId),
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

  // Return the created booking
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
    booking: bookingWithDetails,
  });
};

// Get all bookings for a user
const getUserBookings = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.query;

  // Build filter conditions
  const where = { userId };
  if (status) {
    where.status = status;
  }

  const bookings = await prisma.gymBooking.findMany({
    where,
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
    orderBy: { startTime: "desc" },
  });

  res.status(StatusCodes.OK).json({ bookings, count: bookings.length });
};

// Get details of a specific booking
const getBookingDetails = async (req, res) => {
  const { bookingId } = req.params;

  const booking = await prisma.gymBooking.findUnique({
    where: { id: parseInt(bookingId) },
    include: {
      gym: true,
      user: { select: { name: true, email: true, profileImg: true } },
      machineBookings: {
        include: {
          machine: true,
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError(`No booking found with id ${bookingId}`);
  }

  res.status(StatusCodes.OK).json({ booking });
};

// Update a booking status to cancelled
const cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  const { userId } = req.body;

  const booking = await prisma.gymBooking.findUnique({
    where: { id: parseInt(bookingId) },
  });

  if (!booking) {
    throw new NotFoundError(`No booking found with id ${bookingId}`);
  }

  if (booking.userId !== userId) {
    throw new UnauthenticatedError(
      "You are not authorized to cancel this booking"
    );
  }

  if (booking.status === "completed") {
    throw new BadRequestError("Cannot cancel a completed booking");
  }

  // Update booking status
  await prisma.$transaction(async (tx) => {
    await tx.gymBooking.update({
      where: { id: parseInt(bookingId) },
      data: { status: "cancelled" },
    });

    // Decrement current users count for the gym
    await tx.gym.update({
      where: { id: booking.gymId },
      data: { currnt_users: { decrement: 1 } },
    });
  });

  res
    .status(StatusCodes.OK)
    .json({ message: "Booking cancelled successfully" });
};

// Mark a booking as completed and update machine usage metrics
const completeBooking = async (req, res) => {
  const { bookingId } = req.params;

  const booking = await prisma.gymBooking.findUnique({
    where: { id: parseInt(bookingId) },
    include: {
      machineBookings: true,
      gym: true,
      user: true,
    },
  });

  if (!booking) {
    throw new NotFoundError(`No booking found with id ${bookingId}`);
  }

  if (booking.status !== "confirmed") {
    throw new BadRequestError(`Booking is already ${booking.status}`);
  }

  // Use transaction to ensure all updates are atomic
  await prisma.$transaction(async (tx) => {
    // Update each machine's usage metrics
    for (const machineBooking of booking.machineBookings) {
      // Increment machine usage counter
      await tx.machine.update({
        where: { id: machineBooking.machineId },
        data: { No_Of_Uses: { increment: 1 } },
      });

      // Convert duration from minutes to hours for service tracking
      const usageHours = machineBooking.duration / 60;

      // Update service record for the machine
      const serviceRecord = await tx.service.findUnique({
        where: { machineId: machineBooking.machineId },
      });

      if (serviceRecord) {
        // Update total usage hours
        const updatedTotalUsage = serviceRecord.totalUsageHours + usageHours;

        // Check if machine needs service based on usage
        const needsService =
          updatedTotalUsage >= serviceRecord.serviceIntervalHours;

        // Update service record
        await tx.service.update({
          where: { id: serviceRecord.id },
          data: { totalUsageHours: updatedTotalUsage },
        });

        // Get machine details for ticket creation
        const machine = await tx.machine.findUnique({
          where: { id: machineBooking.machineId },
        });

        // If service is needed and machine was previously active
        if (needsService && machine.status === "active") {
          // Update machine service status
          await tx.machine.update({
            where: { id: machineBooking.machineId },
            data: {
              needService: true,
              status: "inactive",
            },
          });

          // Create automatic service ticket
          await tx.tickets.create({
            data: {
              userId: booking.userId, // Assign to the user who detected the issue
              title: `Service Required: ${machine.name}`,
              description: `Machine "${
                machine.name
              }" requires service after reaching usage threshold of ${
                serviceRecord.serviceIntervalHours
              } hours. Current usage: ${updatedTotalUsage.toFixed(2)} hours.`,
              status: "open",
              ticketType: "service",
              machineId: machine.id,
            },
          });
        }
      }
    }

    // Mark booking as completed
    await tx.gymBooking.update({
      where: { id: parseInt(bookingId) },
      data: { status: "completed" },
    });

    // Decrement current users count for the gym
    await tx.gym.update({
      where: { id: booking.gymId },
      data: { currnt_users: { decrement: 1 } },
    });
  });

  res
    .status(StatusCodes.OK)
    .json({ message: "Booking completed successfully" });
};

// Check machine availability for a specific time slot
const checkMachineAvailability = async (req, res) => {
  const { gymId, startTime, endTime } = req.query;

  if (!gymId || !startTime || !endTime) {
    throw new BadRequestError("Please provide gym ID, start time and end time");
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (start >= end) {
    throw new BadRequestError("End time must be after start time");
  }

  // Get all machines in the gym
  const gymMachines = await prisma.machine.findMany({
    where: {
      gymId: parseInt(gymId),
      needService: false, // Only get machines that don't need service
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

  // Get all machine IDs that are booked during the requested time
  const bookedMachineIds = new Set();
  overlappingBookings.forEach((booking) => {
    booking.machineBookings.forEach((machineBooking) => {
      bookedMachineIds.add(machineBooking.machineId);
    });
  });

  // Filter available machines
  const availableMachines = gymMachines.filter(
    (machine) => !bookedMachineIds.has(machine.id)
  );

  res.status(StatusCodes.OK).json({
    availableMachines,
    count: availableMachines.length,
  });
};

// Add a machine to an existing booking
const addMachineToBooking = async (req, res) => {
  const { bookingId } = req.params;
  const { machineId, duration } = req.body;

  if (!machineId || !duration) {
    throw new BadRequestError("Please provide machine ID and duration");
  }

  const booking = await prisma.gymBooking.findUnique({
    where: { id: parseInt(bookingId) },
    include: {
      machineBookings: true,
    },
  });

  if (!booking) {
    throw new NotFoundError(`No booking found with id ${bookingId}`);
  }

  if (booking.status !== "confirmed") {
    throw new BadRequestError(
      `Cannot add machine to a ${booking.status} booking`
    );
  }

  // Check if the machine exists and is available
  const machine = await prisma.machine.findUnique({
    where: { id: parseInt(machineId) },
  });

  if (!machine) {
    throw new NotFoundError(`Machine with id ${machineId} not found`);
  }

  if (machine.needService) {
    throw new BadRequestError(
      `Machine ${machine.name} is currently under maintenance`
    );
  }

  // Check if machine is already booked during this time
  const machineAlreadyBooked = await prisma.machineBooking.findFirst({
    where: {
      machineId: parseInt(machineId),
      booking: {
        status: { in: ["confirmed", "pending"] },
        OR: [
          {
            startTime: { lte: booking.startTime },
            endTime: { gt: booking.startTime },
          },
          {
            startTime: { lt: booking.endTime },
            endTime: { gte: booking.endTime },
          },
          {
            startTime: { gte: booking.startTime },
            endTime: { lte: booking.endTime },
          },
        ],
      },
    },
  });

  if (machineAlreadyBooked) {
    throw new BadRequestError(
      `Machine ${machine.name} is already booked during this time`
    );
  }

  // Check if the machine is already in this booking
  const machineInBooking = booking.machineBookings.find(
    (mb) => mb.machineId === parseInt(machineId)
  );

  if (machineInBooking) {
    throw new BadRequestError(
      `Machine ${machine.name} is already added to this booking`
    );
  }

  // Add machine to booking
  const machineBooking = await prisma.machineBooking.create({
    data: {
      bookingId: parseInt(bookingId),
      machineId: parseInt(machineId),
      duration: parseInt(duration),
    },
    include: {
      machine: true,
    },
  });

  res.status(StatusCodes.OK).json({
    machineBooking,
    message: `Machine ${machine.name} added to booking successfully`,
  });
};

// Remove a machine from an existing booking
const removeMachineFromBooking = async (req, res) => {
  const { bookingId, machineBookingId } = req.params;

  const booking = await prisma.gymBooking.findUnique({
    where: { id: parseInt(bookingId) },
  });

  if (!booking) {
    throw new NotFoundError(`No booking found with id ${bookingId}`);
  }

  if (booking.status !== "confirmed") {
    throw new BadRequestError(`Cannot modify a ${booking.status} booking`);
  }

  const machineBooking = await prisma.machineBooking.findFirst({
    where: {
      id: parseInt(machineBookingId),
      bookingId: parseInt(bookingId),
    },
    include: {
      machine: true,
    },
  });

  if (!machineBooking) {
    throw new NotFoundError(`Machine booking not found in this booking`);
  }

  // Remove machine booking
  await prisma.machineBooking.delete({
    where: { id: parseInt(machineBookingId) },
  });

  res.status(StatusCodes.OK).json({
    message: `Machine ${machineBooking.machine.name} removed from booking successfully`,
  });
};

module.exports = {
  createGymBooking,
  getUserBookings,
  getBookingDetails,
  cancelBooking,
  completeBooking,
  checkMachineAvailability,
  addMachineToBooking,
  removeMachineFromBooking,
};
