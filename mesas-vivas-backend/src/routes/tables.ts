import { Router } from "express";
import { listTables, updateTableStatus, createTable, deleteTable, updateTable } from "../services/tableService";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../lib/errors";

const router = Router();

// Pública: cualquiera puede ver las mesas y su ocupación (la sección de
// torneos también es pública, es consistente con eso). Anotarse a una
// lista sí va a requerir login — eso es Fase 4.
router.get("/", async (_req, res) => {
  try {
    const tables = await listTables();
    res.json(tables);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR"),
  async (req, res) => {
    try {
      const { status, reason } = req.body;
      const result = await updateTableStatus(req.params.id, status, req.user!.userId, reason);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
);

router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const table = await createTable(req.body, req.user!.userId);
    res.status(201).json(table);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.patch("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const table = await updateTable(req.params.id, req.body, req.user!.userId);
    res.json(table);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await deleteTable(req.params.id, req.user!.userId);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;