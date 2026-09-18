import { Router } from "express";
import { getAuditLogs } from "../services/auditLogService";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// Solo ADMIN y SUPERVISOR: el log de auditoría es información sensible
// de supervisión, no algo que necesite ver un OPERADOR en su uso diario.
router.get("/", requireAuth, requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  try {
    const page = req.query.page ? Math.max(1, parseInt(req.query.page as string, 10)) : 1;
    const pageSize = req.query.pageSize
      ? Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10)))
      : 50;
    const entityType = (req.query.entityType as string) || undefined;
    const action = (req.query.action as string) || undefined;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    const result = await getAuditLogs({ entityType, action, from, to }, page, pageSize);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;