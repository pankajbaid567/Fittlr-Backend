const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Updates machine usage metrics and checks if service is needed
 * This can be called after bookings are completed
 */
const updateMachineUsage = async (machineId, usageMinutes, transaction) => {
  // Use provided transaction or create a new prisma client
  const tx = transaction || prisma;

  // Get current machine data
  const machine = await tx.machine.findUnique({
    where: { id: parseInt(machineId) },
    include: { service: true },
  });

  if (!machine) {
    console.error(`Machine with ID ${machineId} not found`);
    return null;
  }

  // Increment usage count
  await tx.machine.update({
    where: { id: parseInt(machineId) },
    data: { No_Of_Uses: { increment: 1 } },
  });

  // If no service record exists, create one with default values
  if (!machine.service) {
    await tx.service.create({
      data: {
        machineId: parseInt(machineId),
        serviceDate: new Date(),
        serviceIntervalHours: 100, // Default interval of 100 hours
        totalUsageHours: usageMinutes / 60, // Convert minutes to hours
        notes: "Initial service record created automatically",
      },
    });
    
    // No need to check for service since we just created the record
    return {
      machineId: machine.id,
      name: machine.name,
      needsService: false,
      updatedUsage: usageMinutes / 60
    };
  }

  // Calculate new total usage hours
  const usageHours = usageMinutes / 60;
  const updatedTotalUsage = machine.service.totalUsageHours + usageHours;

  // Check if machine needs service based on usage
  const needsService = updatedTotalUsage >= machine.service.serviceIntervalHours;

  // Update service record with new usage hours
  await tx.service.update({
    where: { machineId: parseInt(machineId) },
    data: { totalUsageHours: updatedTotalUsage },
  });

  // If machine needs service, update its status
  if (needsService && !machine.needService) {
    await tx.machine.update({
      where: { id: parseInt(machineId) },
      data: {
        needService: true,
        status: "inactive",
      },
    });

    // Create service ticket automatically
    await tx.tickets.create({
      data: {
        userId: "system", // You might want to use an admin user ID instead
        title: `Service Required: ${machine.name}`,
        description: `Machine "${machine.name}" requires service after reaching usage threshold of ${machine.service.serviceIntervalHours} hours. Current usage: ${updatedTotalUsage.toFixed(2)} hours.`,
        status: "open",
        ticketType: "service",
        machineId: machine.id,
      },
    });
  }

  return {
    machineId: machine.id,
    name: machine.name,
    needsService: needsService,
    updatedUsage: updatedTotalUsage
  };
};

/**
 * Checks if any machines are approaching their service interval
 * Can be used to generate warnings or plan maintenance
 */
const checkMachinesForUpcomingService = async (gymId) => {
  const machines = await prisma.machine.findMany({
    where: {
      gymId: parseInt(gymId),
      needService: false,
      status: "active",
    },
    include: { service: true },
  });

  const upcomingServiceNeeded = [];

  for (const machine of machines) {
    if (machine.service) {
      // Calculate percentage of service interval used
      const percentageUsed = (machine.service.totalUsageHours / machine.service.serviceIntervalHours) * 100;
      
      // If 80% or more of the service interval is used, flag for upcoming service
      if (percentageUsed >= 80) {
        upcomingServiceNeeded.push({
          machineId: machine.id,
          name: machine.name,
          percentageUsed: Math.round(percentageUsed),
          estimatedHoursRemaining: machine.service.serviceIntervalHours - machine.service.totalUsageHours,
        });
      }
    }
  }

  return upcomingServiceNeeded;
};

module.exports = {
  updateMachineUsage,
  checkMachinesForUpcomingService,

