-- CreateTable
CREATE TABLE "User" (
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "profileImg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("googleId")
);

-- CreateTable
CREATE TABLE "FitnessToken" (
    "id" SERIAL NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "token_type" TEXT NOT NULL,
    "expiry_date" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FitnessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessToken_userId_key" ON "FitnessToken"("userId");

-- AddForeignKey
ALTER TABLE "FitnessToken" ADD CONSTRAINT "FitnessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("googleId") ON DELETE RESTRICT ON UPDATE CASCADE;
