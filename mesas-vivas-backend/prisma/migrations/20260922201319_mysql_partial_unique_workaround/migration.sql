-- Reemplazo de los 3 índices únicos parciales de Postgres, para
-- MySQL/MariaDB (que no soporta índices únicos con WHERE).
--
-- Técnica: una columna que vale NULL cuando la fila no está en el
-- estado "activo" que nos importa, con un índice UNIQUE sobre esa
-- columna. MySQL/MariaDB tratan cada NULL como un valor distinto (a
-- diferencia de un único NULL global), así que múltiples filas
-- "inactivas" conviven sin problema — solo las filas "activas" compiten
-- por unicidad, igual que el WHERE parcial de Postgres.
--
-- Los casos 1 y 3 usan una columna GENERATED ALWAYS AS ... STORED
-- (MySQL/MariaDB la recalculan solos). El caso 2 NO puede usar ese
-- mecanismo porque involucra `table_id`, que es una foreign key —
-- MySQL/MariaDB no permiten que una columna generada referencie una
-- columna que tiene una FK. Ahí en cambio usamos un TRIGGER que calcula
-- el mismo valor a mano en cada INSERT/UPDATE — mismo resultado, mismo
-- índice único, solo cambia el mecanismo interno.
--
-- Estas columnas NO están modeladas en schema.prisma (Prisma no tiene
-- soporte de primera clase para columnas generadas ni triggers en
-- MySQL). La app nunca las lee ni las escribe directamente — solo
-- existen para que la base de datos rechace inserts/updates
-- inconsistentes. Si el código intenta crear una fila que violaría
-- alguna de estas, Prisma lo va a reportar como un error de
-- restricción única (P2002), igual que pasaba con los índices
-- parciales de Postgres.

-- ── 1. casino_tables_name_active_unique ──
-- Un nombre de mesa no se puede repetir entre las mesas NO borradas
-- (soft-delete vía deleted_at). Mesas borradas pueden compartir nombre
-- con una mesa nueva sin problema.
ALTER TABLE `casino_tables`
  ADD COLUMN `name_active` VARCHAR(191)
    GENERATED ALWAYS AS (CASE WHEN `deleted_at` IS NULL THEN `name` ELSE NULL END) STORED;

ALTER TABLE `casino_tables`
  ADD UNIQUE INDEX `casino_tables_name_active_unique` (`name_active`);

-- ── 2. waiting_list_entries_active_per_table_unique ──
-- Un mismo documento no puede tener dos inscripciones ACTIVAS
-- (ANOTADO o SENTADO) en la MISMA mesa a la vez. `table_id` es FK,
-- así que esta columna es normal (no generada) y un trigger la
-- calcula en cada INSERT/UPDATE.
ALTER TABLE `waiting_list_entries`
  ADD COLUMN `active_per_table_key` CHAR(64) NULL;

ALTER TABLE `waiting_list_entries`
  ADD UNIQUE INDEX `waiting_list_entries_active_per_table_unique` (`active_per_table_key`);

CREATE TRIGGER `waiting_list_entries_active_per_table_key_ins`
BEFORE INSERT ON `waiting_list_entries`
FOR EACH ROW
SET NEW.`active_per_table_key` = CASE WHEN NEW.`status` IN ('ANOTADO', 'SENTADO')
  THEN SHA2(CONCAT(NEW.`document_type`, ':', NEW.`document_number`, ':', NEW.`table_id`), 256)
  ELSE NULL END;

CREATE TRIGGER `waiting_list_entries_active_per_table_key_upd`
BEFORE UPDATE ON `waiting_list_entries`
FOR EACH ROW
SET NEW.`active_per_table_key` = CASE WHEN NEW.`status` IN ('ANOTADO', 'SENTADO')
  THEN SHA2(CONCAT(NEW.`document_type`, ':', NEW.`document_number`, ':', NEW.`table_id`), 256)
  ELSE NULL END;

-- ── 3. waiting_list_entries_seated_unique ──
-- Un mismo documento no puede estar SENTADO en más de una mesa a la vez
-- (sí puede estar ANOTADO en varias mientras juega en otra — ver nota de
-- "multi-mesa" en el backlog). No involucra ninguna FK, así que acá sí
-- funciona la columna generada.
ALTER TABLE `waiting_list_entries`
  ADD COLUMN `seated_key` CHAR(64)
    GENERATED ALWAYS AS (
      CASE WHEN `status` = 'SENTADO'
        THEN SHA2(CONCAT(`document_type`, ':', `document_number`), 256)
        ELSE NULL
      END
    ) STORED;

ALTER TABLE `waiting_list_entries`
  ADD UNIQUE INDEX `waiting_list_entries_seated_unique` (`seated_key`);