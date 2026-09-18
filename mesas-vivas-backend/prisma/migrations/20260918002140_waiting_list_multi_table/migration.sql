/*
  Warnings:

  - Added the required column `document_number` to the `waiting_list_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `document_type` to the `waiting_list_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name` to the `waiting_list_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `waiting_list_entries` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "waiting_list_entries" DROP CONSTRAINT "waiting_list_entries_user_id_fkey";

-- AlterTable
ALTER TABLE "waiting_list_entries" ADD COLUMN     "cash_out_amount" DECIMAL(65,30),
ADD COLUMN     "cash_out_at" TIMESTAMP(3),
ADD COLUMN     "document_number" TEXT NOT NULL,
ADD COLUMN     "document_type" "DocumentType" NOT NULL,
ADD COLUMN     "first_name" TEXT NOT NULL,
ADD COLUMN     "last_name" TEXT NOT NULL,
ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "waiting_list_entries_document_type_document_number_idx" ON "waiting_list_entries"("document_type", "document_number");

-- AddForeignKey
ALTER TABLE "waiting_list_entries" ADD CONSTRAINT "waiting_list_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
