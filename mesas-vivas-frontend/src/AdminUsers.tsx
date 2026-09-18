import { useState } from "react";
import { api, AdminUser, AdminUserHistoryEntry } from "./api";
import { actionLabel, statusValueLabel } from "./AdminAuditLog";

interface AdminUsersProps {
  showToast: (message: string, type?: "success" | "error") => void;
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente de activación",
  ACTIVA: "Activa",
  BLOQUEADA: "Bloqueada",
  DESHABILITADA: "Deshabilitada",
};

// Estados a los que se puede mover una cuenta desde el panel admin.
// PENDIENTE no está acá a propósito: una cuenta pendiente se activa
// sola cuando el usuario confirma su email, no manualmente.
const STATUS_TARGETS = ["ACTIVA", "BLOQUEADA", "DESHABILITADA"] as const;

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-AR");
}

export default function AdminUsers({ showToast }: AdminUsersProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [history, setHistory] = useState<AdminUserHistoryEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      showToast("Escribí al menos 2 caracteres para buscar.", "error");
      return;
    }
    setSearching(true);
    try {
      const users = await api.searchUsersAdmin(q);
      setResults(users);
      setSearched(true);
    } catch (err: any) {
      showToast(err.message || "No se pudo buscar usuarios.", "error");
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectUser(id: string) {
    setDetailLoading(true);
    try {
      const { user, history } = await api.getUserAdmin(id);
      setSelectedUser(user);
      setHistory(history);
    } catch (err: any) {
      showToast(err.message || "No se pudo cargar el usuario.", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!selectedUser) return;
    const confirmMsg =
      status === "ACTIVA"
        ? `¿Reactivar la cuenta de ${selectedUser.firstName} ${selectedUser.lastName}?`
        : `¿Cambiar el estado de ${selectedUser.firstName} ${selectedUser.lastName} a "${STATUS_LABELS[status]}"? Esto va a cerrar su sesión.`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(status);
    try {
      const updated = await api.updateUserStatus(selectedUser.id, status);
      setSelectedUser(updated);
      setResults((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      // Refrescamos el historial para mostrar la entrada de auditoría recién creada.
      const { history: newHistory } = await api.getUserAdmin(updated.id);
      setHistory(newHistory);
      showToast("Estado actualizado.", "success");
    } catch (err: any) {
      showToast(err.message || "No se pudo cambiar el estado.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="admin-panel admin-users">
      <h2>Gestión de usuarios</h2>

      <form className="admin-users-search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Buscar por nombre, apellido, documento o email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={searching}>
          {searching ? "Buscando..." : "Buscar"}
        </button>
      </form>

      <div className="admin-users-layout">
        <div className="admin-users-results">
          {searched && results.length === 0 && (
            <p className="admin-users-empty">No se encontraron usuarios.</p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              className={`admin-users-row${selectedUser?.id === u.id ? " selected" : ""}`}
              onClick={() => handleSelectUser(u.id)}
            >
              <div className="admin-users-row-main">
                <strong>
                  {u.lastName}, {u.firstName}
                </strong>
                <span className={`admin-user-status status-${u.status.toLowerCase()}`}>
                  {STATUS_LABELS[u.status] || u.status}
                </span>
              </div>
              <div className="admin-users-row-sub">
                {u.documentType} {u.documentNumber} · {u.email}
              </div>
            </button>
          ))}
        </div>

        <div className="admin-users-detail">
          {detailLoading && <p>Cargando...</p>}

          {!detailLoading && !selectedUser && (
            <p className="admin-users-empty">Elegí un usuario de la lista para ver su detalle.</p>
          )}

          {!detailLoading && selectedUser && (
            <>
              <div className="admin-users-detail-header">
                <h3>
                  {selectedUser.firstName} {selectedUser.lastName}
                  {selectedUser.nickname && (
                    <span className="admin-users-nickname"> "{selectedUser.nickname}"</span>
                  )}
                </h3>
                <span className={`admin-user-status status-${selectedUser.status.toLowerCase()}`}>
                  {STATUS_LABELS[selectedUser.status] || selectedUser.status}
                </span>
              </div>

              <dl className="admin-users-fields">
                <dt>Documento</dt>
                <dd>
                  {selectedUser.documentType} {selectedUser.documentNumber}
                </dd>
                <dt>Sexo</dt>
                <dd>{selectedUser.sex}</dd>
                <dt>Fecha de nacimiento</dt>
                <dd>{formatDate(selectedUser.birthDate)}</dd>
                <dt>Email</dt>
                <dd>
                  {selectedUser.email}{" "}
                  {selectedUser.emailVerifiedAt ? (
                    <span className="admin-users-verified">✓ verificado</span>
                  ) : (
                    <span className="admin-users-unverified">sin verificar</span>
                  )}
                </dd>
                <dt>Teléfono</dt>
                <dd>{selectedUser.phone || "—"}</dd>
                <dt>Cuenta creada</dt>
                <dd>{formatDateTime(selectedUser.createdAt)}</dd>
                <dt>Intentos de login fallidos</dt>
                <dd>{selectedUser.failedLoginAttempts}</dd>
                <dt>Bloqueo temporal hasta</dt>
                <dd>{formatDateTime(selectedUser.lockedUntil)}</dd>
              </dl>

              <div className="admin-users-actions">
                {STATUS_TARGETS.filter((s) => s !== selectedUser.status).map((s) => (
                  <button
                    key={s}
                    className={`admin-action-btn${s === "ACTIVA" ? " accent" : ""}`}
                    disabled={actionLoading !== null}
                    onClick={() => handleStatusChange(s)}
                  >
                    {actionLoading === s ? "Aplicando..." : `Pasar a ${STATUS_LABELS[s]}`}
                  </button>
                ))}
              </div>

              <h4>Historial</h4>
              {history.length === 0 && <p className="admin-users-empty">Sin movimientos registrados.</p>}
              <ul className="admin-users-history">
                {history.map((h) => (
                  <li key={h.id}>
                    <div className="admin-users-history-line">
                      <strong>{actionLabel(h.action)}</strong>
                      <span>{formatDateTime(h.createdAt)}</span>
                    </div>
                    <div className="admin-users-history-sub">
                      {h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "Sistema"}
                      {h.previousState?.status && h.newState?.status && (
                        <>
                          {" "}· {statusValueLabel(h.previousState.status)} →{" "}
                          {statusValueLabel(h.newState.status)}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}