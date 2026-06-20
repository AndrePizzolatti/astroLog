-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('SUPABASE', 'DRIVE', 'LOCAL');

-- AlterTable
ALTER TABLE "ProjectFile" ADD COLUMN     "provider" "StorageProvider" NOT NULL DEFAULT 'SUPABASE';

-- AlterTable
ALTER TABLE "SessionFile" ADD COLUMN     "provider" "StorageProvider" NOT NULL DEFAULT 'SUPABASE',
ALTER COLUMN "sizeBytes" DROP NOT NULL;
