-- CreateEnum
CREATE TYPE "CalibrationType" AS ENUM ('DARK', 'BIAS', 'MASTER_DARK', 'MASTER_BIAS');

-- CreateTable
CREATE TABLE "CalibrationFrame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "frameType" "CalibrationType" NOT NULL,
    "label" TEXT NOT NULL,
    "exposureSeconds" DOUBLE PRECISION,
    "gain" INTEGER NOT NULL,
    "offset" INTEGER,
    "binning" TEXT,
    "sensorTempC" DOUBLE PRECISION,
    "storagePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "frameCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationFrameUsage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "calibrationFrameId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationFrameUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalibrationFrame_userId_idx" ON "CalibrationFrame"("userId");

-- CreateIndex
CREATE INDEX "CalibrationFrame_cameraId_idx" ON "CalibrationFrame"("cameraId");

-- CreateIndex
CREATE INDEX "CalibrationFrame_frameType_gain_sensorTempC_idx" ON "CalibrationFrame"("frameType", "gain", "sensorTempC");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationFrameUsage_sessionId_calibrationFrameId_key" ON "CalibrationFrameUsage"("sessionId", "calibrationFrameId");

-- AddForeignKey
ALTER TABLE "CalibrationFrame" ADD CONSTRAINT "CalibrationFrame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationFrame" ADD CONSTRAINT "CalibrationFrame_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationFrameUsage" ADD CONSTRAINT "CalibrationFrameUsage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ImagingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationFrameUsage" ADD CONSTRAINT "CalibrationFrameUsage_calibrationFrameId_fkey" FOREIGN KEY ("calibrationFrameId") REFERENCES "CalibrationFrame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
