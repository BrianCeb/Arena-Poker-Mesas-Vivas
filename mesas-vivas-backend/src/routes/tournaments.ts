import { Router } from "express";
import {
  listTournaments,
  listTournamentsAdmin,
  getTournament,
  createTournament,
  updateTournament,
  updateTournamentStatus,
  duplicateTournament,
  deleteTournament,
} from "../services/tournamentService";
import { requireAuth, requireRole } from "../middleware/auth";
import { uploadTournamentImages } from "../middleware/upload";
import { AppError } from "../lib/errors";

const router = Router();

// Pública — calendario de torneos, no requiere login.
router.get("/", async (_req, res) => {
  try {
    const tournaments = await listTournaments();
    res.json(tournaments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// OJO: esta ruta tiene que ir ANTES de "/:id", si no Express interpreta
// "admin" como si fuera un id.
router.get("/admin", requireAuth, requireRole("ADMIN", "SUPERVISOR"), async (_req, res) => {
  try {
    const tournaments = await listTournamentsAdmin();
    res.json(tournaments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const tournament = await getTournament(req.params.id);
    res.json(tournament);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.post("/", requireAuth, requireRole("ADMIN"), (req, res) => {
  uploadTournamentImages(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message });
    }
    try {
      const files = req.files as { flyer?: Express.Multer.File[]; structure?: Express.Multer.File[] };
      const tournament = await createTournament(req.body, files, req.user!.userId);
      res.status(201).json(tournament);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  });
});

router.patch("/:id", requireAuth, requireRole("ADMIN"), (req, res) => {
  uploadTournamentImages(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message });
    }
    try {
      const files = req.files as { flyer?: Express.Multer.File[]; structure?: Express.Multer.File[] };
      const tournament = await updateTournament(req.params.id, req.body, files, req.user!.userId);
      res.json(tournament);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  });
});

router.patch("/:id/status", requireAuth, requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  try {
    const { status } = req.body;
    const tournament = await updateTournamentStatus(req.params.id, status, req.user!.userId);
    res.json(tournament);
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.post("/:id/duplicate", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const tournament = await duplicateTournament(req.params.id, req.user!.userId);
    res.status(201).json(tournament);
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
    const result = await deleteTournament(req.params.id, req.user!.userId);
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