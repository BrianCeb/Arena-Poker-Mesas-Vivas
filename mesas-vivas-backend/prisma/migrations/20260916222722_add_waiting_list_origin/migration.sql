-- CreateEnum
CREATE TYPE "WaitingListOrigin" AS ENUM ('APP', 'MANUAL_STAFF');

-- AlterTable
ALTER TABLE "waiting_list_entries" ADD COLUMN     "origin" "WaitingListOrigin" NOT NULL DEFAULT 'APP';
