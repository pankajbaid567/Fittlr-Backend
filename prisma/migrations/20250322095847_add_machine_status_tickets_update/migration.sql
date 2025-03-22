-- Add machine status field
ALTER TABLE "Machine" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- Add new fields to tickets model
ALTER TABLE "tickets" ADD COLUMN "ticketType" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "tickets" ADD COLUMN "machineId" INTEGER;

-- Add foreign key relationship for tickets to machines
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
