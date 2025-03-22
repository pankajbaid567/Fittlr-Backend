/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Gym` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Gym_userId_key" ON "Gym"("userId");

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("googleId") ON DELETE SET NULL ON UPDATE CASCADE;
