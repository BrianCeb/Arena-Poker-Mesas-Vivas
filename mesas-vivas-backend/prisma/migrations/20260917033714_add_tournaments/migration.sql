-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('PROGRAMADO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "registration_closes_at" TIMESTAMP(3) NOT NULL,
    "buy_in" DECIMAL(65,30) NOT NULL,
    "rake" DECIMAL(65,30) NOT NULL,
    "initial_stack" INTEGER,
    "blinds_interval_minutes" INTEGER,
    "re_entry_enabled" BOOLEAN NOT NULL DEFAULT false,
    "re_entry_closes_at" TIMESTAMP(3),
    "add_on_enabled" BOOLEAN NOT NULL DEFAULT false,
    "add_on_price" DECIMAL(65,30),
    "add_on_rake" DECIMAL(65,30),
    "add_on_chips" INTEGER,
    "add_on_level" INTEGER,
    "guaranteed_pot" DECIMAL(65,30),
    "flyer_image_url" TEXT,
    "structure_image_url" TEXT,
    "notes" TEXT,
    "status" "TournamentStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournaments_starts_at_idx" ON "tournaments"("starts_at");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
