-- CreateEnum
CREATE TYPE "ColorType" AS ENUM ('COLOR', 'MONO', 'DSLR');

-- CreateEnum
CREATE TYPE "MountType" AS ENUM ('EQ', 'ALT_AZ', 'DOBSONIAN', 'FORK', 'TRACKING');

-- CreateEnum
CREATE TYPE "AccessoryType" AS ENUM ('REDUCER_FLATTENER', 'BARLOW', 'OAG', 'FILTER_WHEEL', 'FOCUSER', 'ROTATOR', 'DEW_HEATER', 'FILTER_INDIVIDUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'READY_TO_PROCESS', 'PROCESSING', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'FRIENDS', 'PUBLIC');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('LIGHT', 'DARK', 'FLAT', 'BIAS', 'MASTER_DARK', 'MASTER_FLAT', 'MASTER_BIAS');

-- CreateEnum
CREATE TYPE "ProjectFileType" AS ENUM ('STACK', 'MASTER_DARK', 'MASTER_FLAT', 'FINAL_JPEG', 'FINAL_TIFF', 'OTHER');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('METEOR_SHOWER', 'ECLIPSE_SOLAR', 'ECLIPSE_LUNAR', 'ISS_PASS', 'PLANET_OPPOSITION', 'COMET', 'CONJUNCTION', 'APOD');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Telescope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "opticalDesign" TEXT,
    "focalLengthMm" DOUBLE PRECISION NOT NULL,
    "apertureMm" DOUBLE PRECISION NOT NULL,
    "focalRatioOverride" DOUBLE PRECISION,
    "obstruction" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Telescope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camera" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "colorType" "ColorType" NOT NULL DEFAULT 'COLOR',
    "sensorName" TEXT,
    "pixelSizeUm" DOUBLE PRECISION NOT NULL,
    "sensorWidthPx" INTEGER NOT NULL,
    "sensorHeightPx" INTEGER NOT NULL,
    "fullWellCapacity" DOUBLE PRECISION,
    "readNoiseE" DOUBLE PRECISION,
    "qeMax" DOUBLE PRECISION,
    "cooled" BOOLEAN NOT NULL DEFAULT false,
    "weightKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "mountType" "MountType" NOT NULL DEFAULT 'EQ',
    "payloadKg" DOUBLE PRECISION,
    "hasGuidingPort" BOOLEAN NOT NULL DEFAULT true,
    "hasPolarScope" BOOLEAN NOT NULL DEFAULT false,
    "weightKg" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accessory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccessoryType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "focalFactor" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentSetup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "telescopeId" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "mountId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFocalMm" DOUBLE PRECISION,
    "filtersAvailable" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupAccessory" (
    "setupId" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,

    CONSTRAINT "SetupAccessory_pkey" PRIMARY KEY ("setupId","accessoryId")
);

-- CreateTable
CREATE TABLE "ImagingProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setupId" TEXT,
    "name" TEXT NOT NULL,
    "targetObject" TEXT NOT NULL,
    "targetType" TEXT,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "raHours" DOUBLE PRECISION,
    "decDegrees" DOUBLE PRECISION,
    "totalLights" INTEGER NOT NULL DEFAULT 0,
    "totalIntegrationMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "setupId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "temperatureC" DOUBLE PRECISION,
    "humidityPct" INTEGER,
    "seeingArcsec" DOUBLE PRECISION,
    "sqmValue" DOUBLE PRECISION,
    "cloudCoverPct" INTEGER,
    "bortleScale" INTEGER,
    "filterUsed" TEXT,
    "lightsCount" INTEGER NOT NULL DEFAULT 0,
    "exposureSeconds" DOUBLE PRECISION,
    "gain" INTEGER,
    "offset" INTEGER,
    "binning" TEXT,
    "sensorTempC" DOUBLE PRECISION,
    "guidingRmsArcsec" DOUBLE PRECISION,
    "notes" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionFile" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "exifData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileType" "ProjectFileType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "sizeBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL,
    "objectName" TEXT NOT NULL,
    "objectType" TEXT,
    "notes" TEXT,
    "rating" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "AlertType" NOT NULL,
    "advanceHours" INTEGER NOT NULL DEFAULT 24,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Telescope_userId_idx" ON "Telescope"("userId");

-- CreateIndex
CREATE INDEX "Camera_userId_idx" ON "Camera"("userId");

-- CreateIndex
CREATE INDEX "Mount_userId_idx" ON "Mount"("userId");

-- CreateIndex
CREATE INDEX "Accessory_userId_idx" ON "Accessory"("userId");

-- CreateIndex
CREATE INDEX "EquipmentSetup_userId_idx" ON "EquipmentSetup"("userId");

-- CreateIndex
CREATE INDEX "ImagingProject_userId_idx" ON "ImagingProject"("userId");

-- CreateIndex
CREATE INDEX "ImagingProject_status_idx" ON "ImagingProject"("status");

-- CreateIndex
CREATE INDEX "ImagingSession_projectId_idx" ON "ImagingSession"("projectId");

-- CreateIndex
CREATE INDEX "SessionFile_sessionId_idx" ON "SessionFile"("sessionId");

-- CreateIndex
CREATE INDEX "ProjectFile_projectId_idx" ON "ProjectFile"("projectId");

-- CreateIndex
CREATE INDEX "ObservationLog_userId_idx" ON "ObservationLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertSubscription_userId_eventType_key" ON "AlertSubscription"("userId", "eventType");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Telescope" ADD CONSTRAINT "Telescope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mount" ADD CONSTRAINT "Mount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accessory" ADD CONSTRAINT "Accessory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentSetup" ADD CONSTRAINT "EquipmentSetup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentSetup" ADD CONSTRAINT "EquipmentSetup_telescopeId_fkey" FOREIGN KEY ("telescopeId") REFERENCES "Telescope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentSetup" ADD CONSTRAINT "EquipmentSetup_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentSetup" ADD CONSTRAINT "EquipmentSetup_mountId_fkey" FOREIGN KEY ("mountId") REFERENCES "Mount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupAccessory" ADD CONSTRAINT "SetupAccessory_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "EquipmentSetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetupAccessory" ADD CONSTRAINT "SetupAccessory_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingProject" ADD CONSTRAINT "ImagingProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingProject" ADD CONSTRAINT "ImagingProject_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "EquipmentSetup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingSession" ADD CONSTRAINT "ImagingSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImagingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingSession" ADD CONSTRAINT "ImagingSession_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "EquipmentSetup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionFile" ADD CONSTRAINT "SessionFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImagingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ImagingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationLog" ADD CONSTRAINT "ObservationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSubscription" ADD CONSTRAINT "AlertSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

