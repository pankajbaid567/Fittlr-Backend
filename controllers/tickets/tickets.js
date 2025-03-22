const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { StatusCodes } = require("http-status-codes");
const { NotFoundError, BadRequestError } = require("../../errors");

const createTicket = async (req, res) => {
  const { userId, title, description, machineId, ticketType } = req.body;

  if (!userId || !title) {
    throw new BadRequestError("User ID and title are required");
  }

  try {
    // Build ticket data
    const ticketData = {
      title,
      description,
      ticketType: ticketType || "user",
      user: {
        connect: {
          googleId: userId,
        },
      },
    };

    // If this is a machine service ticket, connect it to the machine
    if (machineId && ticketType === "service") {
      // Check if machine exists
      const machine = await prisma.machine.findUnique({
        where: { id: parseInt(machineId) },
      });

      if (!machine) {
        throw new NotFoundError(`Machine with id ${machineId} not found`);
      }

      // Connect ticket to machine
      ticketData.machine = {
        connect: {
          id: parseInt(machineId),
        },
      };
    }

    // Create the ticket
    const ticket = await prisma.tickets.create({
      data: ticketData,
    });

    // If this is a service ticket, mark machine as needing service
    if (ticketType === "service" && machineId) {
      await prisma.machine.update({
        where: { id: parseInt(machineId) },
        data: {
          needService: true,
          status: "inactive",
        },
      });
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error(`Error creating ticket: ${error.message}`);
    throw error;
  }
};

const get_user_ticket = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  try {
    const tickets = await prisma.tickets.findMany({
      where: {
        userId: userId,
      },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            status: true,
            needService: true,
          },
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
    console.error(`Error fetching tickets: ${error.message}`);
    throw error;
  }
};

const update_ticket = async (req, res) => {
  const { ticketId } = req.params;
  const { title, description, status } = req.body;

  if (!ticketId) {
    throw new BadRequestError("Ticket ID is required");
  }

  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: parseInt(ticketId) },
      include: { machine: true },
    });

    if (!ticket) {
      throw new NotFoundError(`Ticket with id ${ticketId} not found`);
    }

    // Update ticket
    const updatedTicket = await prisma.tickets.update({
      where: { id: parseInt(ticketId) },
      data: {
        title: title || ticket.title,
        description: description || ticket.description,
        status: status || ticket.status,
      },
    });

    // If this is a service ticket being closed, handle machine status
    if (
      ticket.ticketType === "service" &&
      ticket.machineId &&
      status === "closed" &&
      ticket.status !== "closed"
    ) {
      // Check if there are any other open tickets for this machine
      const openTickets = await prisma.tickets.count({
        where: {
          machineId: ticket.machineId,
          status: "open",
          id: { not: parseInt(ticketId) },
        },
      });

      // If no other open tickets, we can change the machine status
      // But the actual servicing should be done through the machineService controller
      if (openTickets === 0) {
        // Only update needService status so the admin needs to explicitly mark it as serviced
        await prisma.machine.update({
          where: { id: ticket.machineId },
          data: { status: "maintenance" },
        });
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error(`Error updating ticket: ${error.message}`);
    throw error;
  }
};

const delete_ticket = async (req, res) => {
  const { ticketId } = req.params;

  if (!ticketId) {
    throw new BadRequestError("Ticket ID is required");
  }

  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: parseInt(ticketId) },
    });

    if (!ticket) {
      throw new NotFoundError(`Ticket with id ${ticketId} not found`);
    }

    await prisma.tickets.delete({
      where: { id: parseInt(ticketId) },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    console.error(`Error deleting ticket: ${error.message}`);
    throw error;
  }
};

// Get all service tickets - for admin dashboard
const getServiceTickets = async (req, res) => {
  try {
    const tickets = await prisma.tickets.findMany({
      where: {
        ticketType: "service",
      },
      include: {
        machine: {
          include: {
            gym: true,
            service: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
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
    console.error(`Error fetching service tickets: ${error.message}`);
    throw error;
  }
};

module.exports = {
  createTicket,
  get_user_ticket,
  update_ticket,
  delete_ticket,
  getServiceTickets,
};
