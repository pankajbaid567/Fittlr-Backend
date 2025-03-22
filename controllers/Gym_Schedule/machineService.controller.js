const { StatusCodes } = require("http-status-codes");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const {
  BadRequestError,
  UnauthenticatedError,
  NotFoundError,
} = require("../../errors");

// Get machines that need servicing
const getMachinesToService = async (req, res) => {
  const { gymId } = req.query;

  try {
    const where = { needService: true };
    if (gymId) {
      where.gymId = parseInt(gymId);
    }

    const machines = await prisma.machine.findMany({
      where,
      include: {
        gym: {
          select: {
            name: true,
            location: true,
          },
        },
        service: true,
      },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count: machines.length,
      machines,
    });
  } catch (error) {
    throw error;
  }
};

// Mark a machine as serviced
const serviceMachine = async (req, res) => {
  const { machineId } = req.params;
  const { notes, ticketId } = req.body;

  if (!machineId) {
    throw new BadRequestError("Machine ID is required");
  }

  try {
    const machine = await prisma.machine.findUnique({
      where: { id: parseInt(machineId) },
      include: { service: true },
    });

    if (!machine) {
      throw new NotFoundError(`No machine found with id ${machineId}`);
    }

    // Update machine service records with transaction
    await prisma.$transaction(async (tx) => {
      // Update machine service status and set as active again
      await tx.machine.update({
        where: { id: parseInt(machineId) },
        data: {
          needService: false,
          status: "active",
        },
      });

      if (machine.service) {
        // Reset usage hours and update service date
        await tx.service.update({
          where: { machineId: parseInt(machineId) },
          data: {
            totalUsageHours: 0,
            serviceDate: new Date(),
            notes: notes || machine.service.notes,
          },
        });
      } else {
        // Create new service record if none exists
        await tx.service.create({
          data: {
            machineId: parseInt(machineId),
            serviceDate: new Date(),
            serviceIntervalHours: 100, // Default interval
            totalUsageHours: 0,
            notes: notes || "Initial service",
          },
        });
      }

      // Close any open service tickets for this machine
      if (ticketId) {
        // Close specific ticket if ticketId is provided
        await tx.tickets.update({
          where: { id: parseInt(ticketId) },
          data: { status: "closed" },
        });
      } else {
        // Close all open service tickets for this machine
        await tx.tickets.updateMany({
          where: {
            machineId: parseInt(machineId),
            status: "open",
            ticketType: "service",
          },
          data: { status: "closed" },
        });
      }
    });

    const updatedMachine = await prisma.machine.findUnique({
      where: { id: parseInt(machineId) },
      include: {
        service: true,
        gym: {
          select: { name: true },
        },
      },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Machine ${updatedMachine.name} serviced successfully and is now active`,
      machine: updatedMachine,
    });
  } catch (error) {
    throw error;
  }
};

// Update service interval for a machine
const updateServiceInterval = async (req, res) => {
  const { machineId } = req.params;
  const { serviceIntervalHours } = req.body;

  if (!machineId || !serviceIntervalHours) {
    throw new BadRequestError("Machine ID and service interval are required");
  }

  try {
    const machine = await prisma.machine.findUnique({
      where: { id: parseInt(machineId) },
      include: { service: true },
    });

    if (!machine) {
      throw new NotFoundError(`No machine found with id ${machineId}`);
    }

    if (!machine.service) {
      // Create service record if it doesn't exist
      await prisma.service.create({
        data: {
          machineId: parseInt(machineId),
          serviceDate: new Date(),
          serviceIntervalHours: parseFloat(serviceIntervalHours),
          totalUsageHours: 0,
        },
      });
    } else {
      // Update existing service record
      await prisma.service.update({
        where: { machineId: parseInt(machineId) },
        data: { serviceIntervalHours: parseFloat(serviceIntervalHours) },
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Service interval updated for machine ${machine.name}`,
    });
  } catch (error) {
    throw error;
  }
};

// Get machine usage statistics
const getMachineUsageStats = async (req, res) => {
  const { gymId } = req.query;

  try {
    const where = {};
    if (gymId) {
      where.gymId = parseInt(gymId);
    }

    const machines = await prisma.machine.findMany({
      where,
      include: {
        service: true,
        gym: {
          select: { name: true },
        },
      },
      orderBy: { No_Of_Uses: "desc" },
    });

    // Calculate usage statistics
    const stats = machines.map((machine) => ({
      id: machine.id,
      name: machine.name,
      gymName: machine.gym.name,
      totalUses: machine.No_Of_Uses,
      needsService: machine.needService,
      lastServiceDate: machine.service?.serviceDate,
      usageHoursSinceService: machine.service?.totalUsageHours || 0,
      serviceIntervalHours: machine.service?.serviceIntervalHours || 0,
      usagePercentage: machine.service
        ? Math.min(
            100,
            Math.round(
              (machine.service.totalUsageHours /
                machine.service.serviceIntervalHours) *
                100
            )
          )
        : 0,
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      count: stats.length,
      stats,
    });
  } catch (error) {
    throw error;
  }
};

// Get service tickets for machines
const getServiceTickets = async (req, res) => {
  const { status, gymId } = req.query;

  try {
    // Build query conditions
    const where = { ticketType: "service" };

    if (status) {
      where.status = status;
    }

    if (gymId) {
      where.machine = {
        gymId: parseInt(gymId),
      };
    }

    // Get service tickets with related information
    const tickets = await prisma.tickets.findMany({
      where,
      include: {
        machine: {
          include: {
            gym: {
              select: { name: true, location: true },
            },
            service: true,
          },
        },
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count: tickets.length,
      tickets,
    });
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getMachinesToService,
  serviceMachine,
  updateServiceInterval,
  getMachineUsageStats,
  getServiceTickets,
};
