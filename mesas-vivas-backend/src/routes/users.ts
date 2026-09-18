import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// Campos que se pueden devolver del propio perfil — deliberadamente NO
// incluye passwordHash, failedLoginAttempts ni lockedUntil, que son
// datos internos de seguridad, no del perfil del jugador.
const PROFILE_SELECT = {
  id: true,
  documentType: true,
  documentNumber: true,
  firstName: true,
  lastName: true,
  sex: true,
  email: true,
  phone: true,
  nickname: true,
  birthDate: true,
  status: true,
  createdAt: true,
} as const;

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: PROFILE_SELECT,
    });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Solo teléfono y nick son editables acá — el resto de los datos
// (documento, nombre, fecha de nacimiento, email) son identidad legal
// del jugador y no se cambian con un simple PATCH de perfil.
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { phone, nickname } = req.body;
    const data: { phone?: string | null; nickname?: string | null } = {};
    if (phone !== undefined) data.phone = typeof phone === "string" ? phone.trim() || null : null;
    if (nickname !== undefined) data.nickname = typeof nickname === "string" ? nickname.trim() || null : null;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: PROFILE_SELECT,
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

router.get(
  "/search",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR", "OPERADOR"),
  async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      if (q.length < 2) {
        return res.json([]);
      }

      const users = await prisma.user.findMany({
        where: {
          status: "ACTIVA",
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { documentNumber: { contains: q } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, documentNumber: true },
        take: 8,
      });

      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
);

export default router;