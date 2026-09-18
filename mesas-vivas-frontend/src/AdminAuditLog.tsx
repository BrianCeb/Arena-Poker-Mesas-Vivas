import { useEffect, useState, useCallback } from "react";
import { api } from "./api";

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState: any;
  newState: any;
  createdAt: string;
  actor: { firstName: string; lastName: string } | null;
}

// Traducción de los códigos de acción internos a algo legible. Si aparece
// una acción nueva que no está en esta lista, se muestra el código tal
// cual (mejor eso que ocultar el evento).
const ACTION_LABELS: Record<string, string> = {
  PLAYER_SEATED_FROM_WAITING_LIST: "Sentó jugador desde lista de espera",
  PLAYER_SEATED_WALKIN: "Sentó jugador presente (sin lista)",
  PLAYER_REMOVED_FROM_TABLE: "Retiró jugador de la mesa",
  ENTRY_REMOVED_FROM_WAITING_LIST: "Quitó jugador de la lista de espera",
  PLAYER_AUTO_LEFT_TABLE_ON_RESEAT: "Movimiento automático entre mesas",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR");
}

const ENTITY_TYPES = ["WaitingListEntry", "CasinoTable", "Tournament", "User"];
const PAGE_SIZE = 50;

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number, filterEntityType: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs({
        page: targetPage,
        entityType: filterEntityType || undefined,
      });
      setLogs(data.logs);
      setTotal(data.total);
      setPage(targetPage);
    } catch (err: any) {
      setError(err.message || "No se pudo cargar la auditoría.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1, entityType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="admin-audit-log">
      <div className="admin-section-title">Auditoría</div>

      <div className="admin-audit-filters">
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">Todas las entidades</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {error && <div className="admin-form-error">{error}</div>}
      {loading && <div className="admin-empty">Cargando...</div>}
      {!loading && !error && logs.length === 0 && (
        <div className="admin-empty">No hay eventos registrados.</div>
      )}

      {!error &&
        logs.map((log) => (
          <div className="admin-audit-row" key={log.id}>
            <div
              className="admin-audit-row-main"
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            >
              <div className="admin-audit-date">{formatDate(log.createdAt)}</div>
              <div className="admin-audit-actor">
                {log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "Sistema"}
              </div>
              <div className="admin-audit-action">{actionLabel(log.action)}</div>
              <div className="admin-audit-entity">{log.entityType}</div>
            </div>
            {expandedId === log.id && (
              <div className="admin-audit-detail">
                {log.previousState && (
                  <div>
                    <strong>Estado anterior:</strong>
                    <pre>{JSON.stringify(log.previousState, null, 2)}</pre>
                  </div>
                )}
                {log.newState && (
                  <div>
                    <strong>Estado nuevo:</strong>
                    <pre>{JSON.stringify(log.newState, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

      {!error && total > 0 && (
        <div className="admin-audit-pagination">
          <button
            className="admin-action-btn"
            disabled={page <= 1 || loading}
            onClick={() => load(page - 1, entityType)}
          >
            ← Anterior
          </button>
          <span>Página {page} de {totalPages}</span>
          <button
            className="admin-action-btn"
            disabled={page >= totalPages || loading}
            onClick={() => load(page + 1, entityType)}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}