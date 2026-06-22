-- CreateEnum
CREATE TYPE "CaptureType" AS ENUM ('DSO', 'PLANETARY');

-- AlterTable
ALTER TABLE "ImagingProject" ADD COLUMN     "captureType" "CaptureType" NOT NULL DEFAULT 'DSO';

-- AlterTable
ALTER TABLE "ImagingSession" ADD COLUMN     "captureSoftware" TEXT,
ADD COLUMN     "videoFormat" TEXT,
ADD COLUMN     "fps" DOUBLE PRECISION,
ADD COLUMN     "exposureMs" DOUBLE PRECISION,
ADD COLUMN     "totalFrames" INTEGER,
ADD COLUMN     "stackedPct" INTEGER,
ADD COLUMN     "roi" TEXT;
