-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reminderDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "reminderHour" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "reminderLastSent" TEXT,
ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;
