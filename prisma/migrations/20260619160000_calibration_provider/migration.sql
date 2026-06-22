-- AlterTable
ALTER TABLE "CalibrationFrame" ADD COLUMN     "provider" "StorageProvider" NOT NULL DEFAULT 'SUPABASE',
ALTER COLUMN "sizeBytes" DROP NOT NULL;
