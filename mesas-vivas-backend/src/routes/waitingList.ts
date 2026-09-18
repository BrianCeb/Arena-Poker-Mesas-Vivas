import { Router } from "express";
import {
  joinWaitingList,
  leaveWaitingList,
  getMyEntries,
  getTableEntries,
  seatFromWaitingList,
  removeEntry,
  seatWalkin,
} from "../services/waitingListService";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../lib/errors";

const router = Router();

// ── Jugador (cualquier usuario autenticado) ──

router.post("/tables/:tableId/join", requireAuth, async (req, res) => {
  try {
    const entry = await joinWaitingList(req.params.tableId, req.user!.userId);
    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.post("/tables/:tableId/leave", requireAuth, async (req, res) => {
  try {
    const result = await leaveWaitingList(req.user!.userId, req.params.tableId);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const entries = await getMyEntries(req.user!.userId);
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get(
  "/tables/:tableId/entries",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR", "OPERADOR"),
  async (req, res) => {
    try {
      const result = await getTableEntries(req.params.tableId);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
);

// ── Personal del casino (ADMIN/SUPERVISOR/OPERADOR) ──

router.patch(
  "/:entryId/seat",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR", "OPERADOR"),
  async (req, res) => {
    try {
      const result = await seatFromWaitingList(req.params.entryId, req.user!.userId);
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
);

router.delete(
  "/:entryId",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR"),
  async (req, res) => {
    try {
      const result = await removeEntry(
        req.params.entryId,
        req.user!.userId,
        req.body?.reason,
        req.body?.cashOutAmount
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
);

router.post(
  "/tables/:tableId/seat-walkin",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR", "OPERADOR"),
  async (req, res) => {
    try {
      const { userId } = req.body;
      const entry = await seatWalkin(req.params.tableId, userId, req.user!.userId);
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
);

export default router;