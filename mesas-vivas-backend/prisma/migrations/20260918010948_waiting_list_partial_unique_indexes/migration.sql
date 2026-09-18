-- Un jugador (identificado por documento) no puede tener más de una
-- inscripción activa (ANOTADO o SENTADO) en la MISMA mesa.
CREATE UNIQUE INDEX "waiting_list_entries_active_per_table_unique"
ON "waiting_list_entries" ("document_type", "document_number", "table_id")
WHERE status IN ('ANOTADO', 'SENTADO');

-- Un jugador no puede estar SENTADO en más de una mesa a la vez.
CREATE UNIQUE INDEX "waiting_list_entries_seated_unique"
ON "waiting_list_entries" ("document_type", "document_number")
WHERE status = 'SENTADO';