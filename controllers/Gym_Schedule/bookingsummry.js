const { StatusCodes } = require("http-status-codes");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} = require("../../errors");

const getBookingSummary = async (req, res) => {
  const { bookingId, userId } = req.body;

  if (!bookingId || !userId) {
    throw new BadRequestError("Booking ID and User ID are required");
  }

  const booking = await prisma.gymBooking.findUnique({
    where: { id: Number(bookingId) },
    include: {
      gym: {
        select: {
          name: true,
          location: true,
          imageUrl: true,
          openingHours: true,
        },
      },
      user: {
        select: {
          name: true,
          email: true,
          profileImg: true,
        },
      },
      machineBookings: {
        include: {
          machine: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError(`No booking found with id ${bookingId}`);
  }

  if (booking.userId !== userId) {
    throw new UnauthenticatedError(
      "You do not have permission to view this booking"
    );
  }

  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);

  const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const durationFormatted = `${
    hours > 0 ? `${hours} hour${hours > 1 ? "s" : ""}` : ""
  }${hours > 0 && minutes > 0 ? " and " : ""}${
    minutes > 0 ? `${minutes} minute${minutes > 1 ? "s" : ""}` : ""
  }`;

  const bookingSummary = {
    id: booking.id,
    status: booking.status,
    date: startTime.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    startTime: startTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    endTime: endTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    duration: durationFormatted,
    durationMinutes,
    createdAt: booking.createdAt,
    gym: {
      id: booking.gym.id,
      name: booking.gym.name,
      location: booking.gym.location,
      imageUrl: booking.gym.imageUrl,
    },
    user: {
      name: booking.user.name,
      email: booking.user.email,
      profileImg: booking.user.profileImg,
    },
    machines: booking.machineBookings.map((mb) => ({
      id: mb.machine.id,
      name: mb.machine.name,
      description: mb.machine.description,
      imageUrl: mb.machine.imageUrl,
      duration: mb.duration,
      durationFormatted: `${
        Math.floor(mb.duration / 60) > 0
          ? `${Math.floor(mb.duration / 60)} hour${
              Math.floor(mb.duration / 60) > 1 ? "s" : ""
            }`
          : ""
      }${
        Math.floor(mb.duration / 60) > 0 && mb.duration % 60 > 0 ? " and " : ""
      }${
        mb.duration % 60 > 0
          ? `${mb.duration % 60} minute${mb.duration % 60 > 1 ? "s" : ""}`
          : ""
      }`,
    })),
  };

  const now = new Date();
  bookingSummary.canCancel = booking.status === "confirmed" && startTime > now;

  const checkInWindow = new Date(startTime);
  checkInWindow.setMinutes(checkInWindow.getMinutes() - 15);
  bookingSummary.canCheckIn =
    booking.status === "confirmed" && now >= checkInWindow && now <= endTime;

  res.status(StatusCodes.OK).json({
    success: true,
    booking: bookingSummary,
  });
};

module.exports = {
  getBookingSummary,
