-- CreateEnum
CREATE TYPE "StradleMode" AS ENUM ('NO', 'OPCIONAL', 'OBLIGATORIO');

-- AlterTable
ALTER TABLE "casino_tables" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "stradle_amount" DECIMAL(65,30),
ADD COLUMN     "stradle_mode" "StradleMode" NOT NULL DEFAULT 'NO';

-- Dos mesas activas no pueden tener el mismo nombre, pero sí se puede
-- reusar un nombre después de dar de baja la mesa anterior.
CREATE UNIQUE INDEX "casino_tables_name_active_unique" ON "casino_tables" ("name") WHERE "deleted_at" IS NULL;
