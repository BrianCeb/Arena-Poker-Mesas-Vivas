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
  USER_STATUS_CHANGED: "Cambió el estado de una cuenta",
};

export function actionLabel(action: string) {
  return ACTION_LABELS[action] || action;
}

// Nombre de la entidad en criollo, para que no se vea "CasinoTable" en
// pantalla. Igual que con las acciones, lo que no está en la lista se
// muestra tal cual en vez de ocultarse.
const ENTITY_TYPE_LABELS: Record<string, string> = {
  WaitingListEntry: "Lista de espera",
  CasinoTable: "Mesa",
  Tournament: "Torneo",
  User: "Usuario",
};

function entityTypeLabel(entityType: string) {
  return ENTITY_TYPE_LABELS[entityType] || entityType;
}

// Traducción de los valores de estado que pueden aparecer en previousState
// / newState, sin importar de qué entidad vengan (mesa, torneo, usuario o
// lista de espera) — los códigos no se pisan entre sí.
const STATUS_VALUE_LABELS: Record<string, string> = {
  // Usuario
  PENDIENTE: "Pendiente de activación",
  ACTIVA: "Activa",
  BLOQUEADA: "Bloqueada",
  DESHABILITADA: "Deshabilitada",
  // Mesa
  CERRADA: "Cerrada",
  ABIERTA: "Abierta",
  SUSPENDIDA: "Suspendida",
  // Lista de espera
  ANOTADO: "Anotado",
  SENTADO: "Sentado",
  RETIRADO: "Retirado",
  CANCELADO_ADMIN: "Cancelado por el casino",
  // Torneo
  PROGRAMADO: "Programado",
  EN_CURSO: "En curso",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

// Nombre en criollo de los campos que suelen aparecer en previousState /
// newState. Lo que no está acá se muestra "humanizado" (separando
// palabras por mayúscula) en vez de en inglés técnico crudo.
const FIELD_LABELS: Record<string, string> = {
  status: "Estado",
  name: "Nombre",
  cashOutAmount: "Monto retirado",
  cancelReason: "Motivo",
  smallBlind: "Ciega chica",
  bigBlind: "Ciega grande",
  minBuyIn: "Buy-in mínimo",
  maxBuyIn: "Buy-in máximo",
  capacity: "Capacidad",
};

function fieldLabel(key: string) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // Fallback: "someFieldName" -> "Some field name"
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isIsoDateString(value: any): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
}

// Traduce un valor de estado suelto (p. ej. para mostrar "Activa → Bloqueada"
// fuera de esta pantalla, como en el historial de Gestión de usuarios).
export function statusValueLabel(value: string) {
  return STATUS_VALUE_LABELS[value] || value;
}

function displayValue(value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string" && STATUS_VALUE_LABELS[value]) return STATUS_VALUE_LABELS[value];
  if (isIsoDateString(value)) return new Date(value).toLocaleString("es-AR");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR");
}

const ENTITY_TYPES = ["WaitingListEntry", "CasinoTable", "Tournament", "User"];
const PAGE_SIZE = 50;

// Arma la lista de cambios en criollo a partir de previousState/newState.
// Cuando existen los dos, muestra "Campo: antes → después". Cuando solo
// existe uno de los dos (alta o baja), muestra los datos de ese estado
// solo. Si ninguno tiene forma de objeto reconocible, cae al JSON crudo
// (mejor mostrar algo raro que ocultar el evento).
function AuditStateDiff({ previousState, newState }: { previousState: any; newState: any }) {
  const prev = previousState && typeof previousState === "object" ? previousState : null;
  const next = newState && typeof newState === "object" ? newState : null;

  if (!prev && !next) return null;

  if (!prev || !next) {
    const only = prev || next;
    const keys = Object.keys(only);
    if (keys.length === 0) return null;
    return (
      <div>
        <strong>{prev ? "Datos al momento del cambio:" : "Datos cargados:"}</strong>
        <div className="admin-audit-diff">
          {keys.map((k) => (
            <div className="admin-audit-diff-row" key={k}>
              <span className="admin-audit-diff-field">{fieldLabel(k)}</span>
              <span>{displayValue(only[k])}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
  if (keys.length === 0) return null;

  return (
    <div>
      <strong>Cambios:</strong>
      <div className="admin-audit-diff">
        {keys.map((k) => (
          <div className="admin-audit-diff-row" key={k}>
            <span className="admin-audit-diff-field">{fieldLabel(k)}</span>
            <span>{displayValue(prev[k])}</span>
            <span className="admin-audit-diff-arrow">→</span>
            <span>{displayValue(next[k])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
            <option key={t} value={t}>{entityTypeLabel(t)}</option>
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
              <div className="admin-audit-entity">{entityTypeLabel(log.entityType)}</div>
            </div>
            {expandedId === log.id && (
              <div className="admin-audit-detail">
                <AuditStateDiff previousState={log.previousState} newState={log.newState} />
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