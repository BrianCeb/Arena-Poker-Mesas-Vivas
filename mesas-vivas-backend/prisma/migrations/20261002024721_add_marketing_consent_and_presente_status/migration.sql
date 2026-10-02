ALTER TABLE `users` ADD COLUMN `marketing_consent` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `waiting_list_entries` MODIFY COLUMN `status` ENUM('ANOTADO', 'PRESENTE', 'SENTADO', 'RETIRADO', 'CANCELADO_ADMIN') NOT NULL DEFAULT 'ANOTADO';


-- ATENCIÓN: este archivo es una GUÍA de lo que tiene que contener la
-- migración, no lo copies y pegues directo con este nombre de carpeta.
--
-- Pasos correctos (igual criterio que la migración anterior de los
-- índices únicos parciales — no correr `prisma db push` nunca):
--
--   1. npx prisma migrate dev --name add_marketing_consent_and_presente_status --create-only
--   2. Abrís el migration.sql que temporalmente te generó Prisma en
--      prisma/migrations/<timestamp>_add_marketing_consent_and_presente_status/
--      Va a traer automáticamente:
--        ALTER TABLE `users` ADD COLUMN `marketing_consent` ... ;
--        ALTER TABLE `waiting_list_entries` MODIFY COLUMN `status` ENUM(...) ... ;
--   3. Le agregás AL FINAL de ese mismo archivo el bloque de acá abajo
--      (el que actualiza los triggers).
--   4. npx prisma migrate dev   (aplica la migración ya editada)
--
-- ── Por qué hace falta tocar los triggers a mano ──
-- El trigger que arma `active_per_table_key` (impide una segunda
-- inscripción activa en la misma mesa) hoy solo reconoce 'ANOTADO' y
-- 'SENTADO' como "activo". Si se agrega el estado PRESENTE al enum sin
-- actualizar el trigger, una entrada PRESENTE queda invisible para esa
-- protección — alguien podría terminar con dos inscripciones activas en
-- la misma mesa sin que la base lo rechace. Por eso se recrean los 2
-- triggers con los 3 estados.

DROP TRIGGER `waiting_list_entries_active_per_table_key_ins`;
DROP TRIGGER `waiting_list_entries_active_per_table_key_upd`;

CREATE TRIGGER `waiting_list_entries_active_per_table_key_ins`
BEFORE INSERT ON `waiting_list_entries`
FOR EACH ROW
SET NEW.`active_per_table_key` = CASE WHEN NEW.`status` IN ('ANOTADO', 'PRESENTE', 'SENTADO')
  THEN SHA2(CONCAT(NEW.`document_type`, ':', NEW.`document_number`, ':', NEW.`table_id`), 256)
  ELSE NULL END;

CREATE TRIGGER `waiting_list_entries_active_per_table_key_upd`
BEFORE UPDATE ON `waiting_list_entries`
FOR EACH ROW
SET NEW.`active_per_table_key` = CASE WHEN NEW.`status` IN ('ANOTADO', 'PRESENTE', 'SENTADO')
  THEN SHA2(CONCAT(NEW.`document_type`, ':', NEW.`document_number`, ':', NEW.`table_id`), 256)
  ELSE NULL END;

-- El trigger de `seated_key` (columna generada, solo dispara con
-- status = 'SENTADO') NO se toca — PRESENTE no lo afecta.