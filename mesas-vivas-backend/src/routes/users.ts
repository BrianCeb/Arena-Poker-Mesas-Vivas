import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

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
