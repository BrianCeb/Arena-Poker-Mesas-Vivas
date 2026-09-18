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

// Igual que PROFILE_SELECT pero pensado para que lo vea el personal del
// casino: agrega el estado de verificación de email y los intentos de
// login fallidos/bloqueo temporal (útil para diagnosticar "no puedo
// entrar"), pero sigue sin exponer passwordHash.
const ADMIN_USER_SELECT = {
  id: true,
  documentType: true,
  documentNumber: true,
  firstName: true,
  lastName: true,
  sex: true,
  email: true,
  emailVerifiedAt: true,
  phone: true,
  nickname: true,
  birthDate: true,
  status: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  createdAt: true,
} as const;

const ADMIN_STATUS_TARGETS = ["ACTIVA", "BLOQUEADA", "DESHABILITADA"] as const;

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

// Búsqueda para "sentar walk-in": a propósito solo entre cuentas ACTIVA
// (no tiene sentido ofrecer sentar a alguien con la cuenta bloqueada o
// todavía sin verificar).
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

// ── Gestión de usuarios (panel admin) ───────────────────────────
// A diferencia de /search, acá se busca en TODOS los estados —el
// personal necesita poder encontrar también una cuenta pendiente,
// bloqueada o deshabilitada para gestionarla.

router.get(
  "/admin",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR"),
  async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      if (q.length < 2) {
        return res.json([]);
      }

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { documentNumber: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
        select: ADMIN_USER_SELECT,
        orderBy: { createdAt: "desc" },
        take: 15,
      });

      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
);

router.get(
  "/admin/:id",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR"),
  async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: ADMIN_USER_SELECT,
      });
      if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

      const history = await prisma.auditLog.findMany({
        where: { entityType: "User", entityId: req.params.id },
        include: { actor: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      res.json({ user, history });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
);

router.patch(
  "/admin/:id/status",
  requireAuth,
  requireRole("ADMIN", "SUPERVISOR"),
  async (req, res) => {
    try {
      const { status } = req.body as { status?: string };
      if (!status || !ADMIN_STATUS_TARGETS.includes(status as any)) {
        return res.status(400).json({
          error: `Estado inválido. Tiene que ser una de: ${ADMIN_STATUS_TARGETS.join(", ")}.`,
        });
      }

      if (req.params.id === req.user!.userId) {
        return res.status(400).json({ error: "No podés cambiar el estado de tu propia cuenta." });
      }

      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) return res.status(404).json({ error: "Usuario no encontrado." });

      if (target.status === status) {
        return res.status(400).json({ error: "El usuario ya está en ese estado." });
      }

      const previousStatus = target.status;

      const [updated] = await prisma.$transaction([
        prisma.user.update({
          where: { id: req.params.id },
          data: { status: status as any },
          select: ADMIN_USER_SELECT,
        }),
        // Bloquear/deshabilitar corta la posibilidad de renovar sesión.
        // El access token que ya tenga emitido sigue siendo válido hasta
        // que expire por su cuenta (son de corta duración) — esto no es
        // un corte instantáneo, ver nota en el backlog.
        ...(status !== "ACTIVA"
          ? [
              prisma.refreshToken.updateMany({
                where: { userId: req.params.id, revokedAt: null },
                data: { revokedAt: new Date() },
              }),
            ]
          : []),
        prisma.auditLog.create({
          data: {
            actorId: req.user!.userId,
            action: "USER_STATUS_CHANGED",
            entityType: "User",
            entityId: req.params.id,
            previousState: { status: previousStatus },
            newState: { status },
          },
        }),
      ]);

      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error interno del servidor." });
    }
  }
);

export default router;