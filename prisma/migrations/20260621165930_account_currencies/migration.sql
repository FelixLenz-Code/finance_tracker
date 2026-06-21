-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "currencies" TEXT[] DEFAULT ARRAY[]::TEXT[];
