import { useEffect, useState, useCallback } from "react";
import { api, TableInput } from "./api";
import { socket } from "./socket";
import AdminTournaments from "./AdminTournaments";
import AdminAuditLog from "./AdminAuditLog";
import AdminUsers from "./AdminUsers";
import TableForm from "./TableForm";

interface Table {
  id: string;
  name: string;
  gameType: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number | null;
  maxBuyIn: number | null;
  capacity: number;
  minPlayersToStart: number;
  stradleMode: "NO" | "OPCIONAL" | "OBLIGATORIO";
  stradleAmount: number | null;
  notes: string | null;
  status: "CERRADA" | "ABIERTA" | "SUSPENDIDA";
  seated: number;
  waiting: number;
}

interface Entry {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  documentNumber: string;
  origin: "APP" | "MANUAL_STAFF";
  createdAt: string;
}

const EMPTY_GUEST_FORM = {
  documentType: "DNI",
  documentNumber: "",
  firstName: "",
  lastName: "",
};

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
}

function statusLabel(t: Table) {
  if (t.status === "CERRADA") return "Cerrada";
  if (t.status === "SUSPENDIDA") return "Suspendida";
  if (t.seated >= t.capacity) return "Abierta · completa";
  if (t.seated < t.minPlayersToStart) return "Abierta · armando";
  return "Abierta · en juego";
}

const EMPTY_FORM: TableInput = {
  name: "",
  gameType: "Texas Hold'em",
  smallBlind: undefined,
  bigBlind: undefined,
  minBuyIn: undefined,
  maxBuyIn: undefined,
  capacity: 9,
  minPlayersToStart: 4,
  stradleMode: "NO",
  stradleAmount: undefined,
  notes: "",
};

export default function AdminPanel() {
  const [adminSection, setAdminSection] = useState<"mesas" | "torneos" | "auditoria" | "usuarios">("mesas");

  const [tables, setTables] = useState<Table[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seated, setSeated] = useState<Entry[]>([]);
  const [waiting, setWaiting] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [rowTableChoice, setRowTableChoice] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [guestForm, setGuestForm] = useState(EMPTY_GUEST_FORM);
  const [guestTableChoice, setGuestTableChoice] = useState("");
  const [guestSaving, setGuestSaving] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const loadTables = useCallback(async () => {
    const data = await api.getTables();
    setTables(data);
    if (!selectedId && data.length > 0) setSelectedId(data[0].id);
  }, [selectedId]);

  const loadEntries = useCallback(async (tableId: string) => {
    const data = await api.getTableEntries(tableId);
    setSeated(data.seated);
    setWaiting(data.waiting);
  }, []);

  useEffect(() => {
    loadTables();
    const handleChange = () => {
      loadTables();
      if (selectedId) loadEntries(selectedId);
    };
    socket.on("tables:changed", handleChange);
    return () => {
      socket.off("tables:changed", handleChange);
    };
  }, [loadTables, selectedId, loadEntries]);

  useEffect(() => {
    if (selectedId) {
      loadEntries(selectedId);
    }
  }, [selectedId, loadEntries]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const results = await api.searchUsers(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  async function refreshAll() {
    await loadTables();
    if (selectedId) await loadEntries(selectedId);
  }

  async function handleToggleStatus(table: Table) {
    try {
      const newStatus = table.status === "ABIERTA" ? "CERRADA" : "ABIERTA";
      await api.updateTableStatus(table.id, newStatus);
      showToast(`${table.name} ${newStatus === "ABIERTA" ? "abierta" : "cerrada"}.`);
      refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleDelete(table: Table) {
    if (!window.confirm(`¿Dar de baja "${table.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteTable(table.id);
      showToast(`${table.name} dada de baja.`);
      if (selectedId === table.id) setSelectedId(null);
      refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleSeat(entry: Entry) {
    try {
      const result = await api.seatFromWaiting(entry.id);
      showToast(`${entry.firstName} ${entry.lastName} sentado.`);
      if (result?.warning) window.alert(result.warning);
      refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleRemove(entry: Entry) {
    try {
      await api.removeEntry(entry.id);
      showToast(`${entry.firstName} ${entry.lastName} removido.`);
      refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  // Retiro de un jugador SENTADO: a diferencia de "Quitar" de la lista de
  // espera, acá preguntamos si se lleva fichas y, si es así, el monto
  // aproximado, para dejarlo registrado en cashOutAmount/cashOutAt.
  async function handleRemoveSeated(entry: Entry) {
    const withChips = window.confirm(
      `¿${entry.firstName} ${entry.lastName} se retira con fichas?`
    );

    let cashOutAmount: number | undefined;
    if (withChips) {
      const raw = window.prompt("Monto aproximado de cash-out:");
      if (raw === null) return; // canceló el prompt, no hacemos nada
      const parsed = Number(raw);
      if (raw.trim() === "" || isNaN(parsed) || parsed < 0) {
        showToast("Monto inválido. No se realizó el retiro.");
        return;
      }
      cashOutAmount = parsed;
    }

    try {
      await api.removeEntry(entry.id, undefined, cashOutAmount);
      showToast(`${entry.firstName} ${entry.lastName} removido.`);
      refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleSeatWalkin(user: SearchResult, tableId: string) {
    try {
      const result = await api.seatWalkin(tableId, user.id);
      const targetTable = tables.find((t) => t.id === tableId);
      showToast(`${user.firstName} ${user.lastName} sentado en ${targetTable?.name} (presente, sin lista).`);
      if (result?.warning) window.alert(result.warning);
      setSearchQuery("");
      setSearchResults([]);
      refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  function setGuestField(key: keyof typeof EMPTY_GUEST_FORM, value: string) {
    setGuestForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSeatGuest() {
    const tableId = guestTableChoice || selectedId || tables[0]?.id || "";
    if (!tableId) {
      showToast("No hay ninguna mesa disponible.");
      return;
    }
    if (!guestForm.documentNumber.trim() || !guestForm.firstName.trim() || !guestForm.lastName.trim()) {
      showToast("Completá documento, nombre y apellido.");
      return;
    }
    setGuestSaving(true);
    try {
      const result = await api.seatWalkinGuest(tableId, guestForm);
      const targetTable = tables.find((t) => t.id === tableId);
      showToast(`${guestForm.firstName} ${guestForm.lastName} sentado en ${targetTable?.name} (invitado, sin cuenta).`);
      if (result?.warning) window.alert(result.warning);
      setGuestForm(EMPTY_GUEST_FORM);
      setGuestTableChoice("");
      setSearchQuery("");
      setSearchResults([]);
      refreshAll();
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setGuestSaving(false);
    }
  }

  const selectedTable = tables.find((t) => t.id === selectedId);

  return (
    <>
      <div className="view-switch admin-section-switch">
        <button
          className={adminSection === "mesas" ? "active" : ""}
          onClick={() => setAdminSection("mesas")}
        >
          Mesas Vivas
        </button>
        <button
          className={adminSection === "torneos" ? "active" : ""}
          onClick={() => setAdminSection("torneos")}
        >
          Torneos
        </button>
        <button
          className={adminSection === "usuarios" ? "active" : ""}
          onClick={() => setAdminSection("usuarios")}
        >
          Usuarios
        </button>
        <button
          className={adminSection === "auditoria" ? "active" : ""}
          onClick={() => setAdminSection("auditoria")}
        >
          Auditoría
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {adminSection === "torneos" ? (
        <AdminTournaments />
      ) : adminSection === "usuarios" ? (
        <AdminUsers showToast={showToast} />
      ) : adminSection === "auditoria" ? (
        <AdminAuditLog />
      ) : (
        <div className="admin-panel admin-panel-mesas">
          <div className="admin-tables-list">
            <button
              className="admin-action-btn accent admin-new-table-btn"
              onClick={() => setFormMode("create")}
            >
              + Nueva mesa
            </button>

            {tables.map((t) => (
              <div
                key={t.id}
                className={`admin-table-row ${t.id === selectedId ? "selected" : ""}`}
                onClick={() => { setSelectedId(t.id); setFormMode(null); }}
              >
                <div>
                  <div className="admin-table-name">{t.name}</div>
                  <div className="admin-table-sub">${t.smallBlind} / ${t.bigBlind} · {statusLabel(t)}</div>
                </div>
                <div className="admin-table-counts">
                  <span>{t.seated}/{t.capacity}</span>
                  {t.waiting > 0 && <span className="admin-waiting-count">+{t.waiting} esp.</span>}
                </div>
                <div className="admin-row-actions">
                  <button
                    className={`admin-toggle-btn ${t.status === "ABIERTA" ? "danger" : "accent"}`}
                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(t); }}
                  >
                    {t.status === "ABIERTA" ? "Cerrar" : "Abrir"}
                  </button>
                  <button
                    className="admin-toggle-btn"
                    onClick={(e) => { e.stopPropagation(); setSelectedId(t.id); setFormMode("edit"); }}
                  >
                    Editar
                  </button>
                  <button
                    className="admin-toggle-btn danger"
                    onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                  >
                    Baja
                  </button>
                </div>
              </div>
            ))}
          </div>

          {formMode === "create" && (
            <div className="admin-detail">
              <TableForm
                mode="create"
                initial={EMPTY_FORM}
                onCancel={() => setFormMode(null)}
                onSaved={() => { setFormMode(null); refreshAll(); }}
                showToast={showToast}
              />
            </div>
          )}

          {formMode === "edit" && selectedTable && (
            <div className="admin-detail">
              <TableForm
                mode="edit"
                initial={{
                  id: selectedTable.id,
                  name: selectedTable.name,
                  gameType: selectedTable.gameType,
                  smallBlind: selectedTable.smallBlind,
                  bigBlind: selectedTable.bigBlind,
                  minBuyIn: selectedTable.minBuyIn ?? undefined,
                  maxBuyIn: selectedTable.maxBuyIn ?? undefined,
                  capacity: selectedTable.capacity,
                  minPlayersToStart: selectedTable.minPlayersToStart,
                  stradleMode: selectedTable.stradleMode,
                  stradleAmount: selectedTable.stradleAmount ?? undefined,
                  notes: selectedTable.notes ?? "",
                }}
                onCancel={() => setFormMode(null)}
                onSaved={() => { setFormMode(null); refreshAll(); }}
                showToast={showToast}
              />
            </div>
          )}

          {!formMode && selectedTable && (
            <div className="admin-detail">
              <div className="admin-section-title">Sentados — {selectedTable.name}</div>
              {seated.length === 0 && <div className="admin-empty">Nadie sentado todavía.</div>}
              {seated.map((e) => (
                <div className="admin-entry-row" key={e.id}>
                  <div>
                    <div className="admin-entry-name">{e.firstName} {e.lastName}</div>
                    <div className="admin-entry-sub">
                      DNI {e.documentNumber} ·{" "}
                      {!e.userId ? "invitado, sin cuenta" : e.origin === "MANUAL_STAFF" ? "presente, sin lista" : "vía app"}
                    </div>
                  </div>
                  <button className="admin-action-btn danger" onClick={() => handleRemoveSeated(e)}>Retirar</button>
                </div>
              ))}

              <div className="admin-section-title">Lista de espera (app)</div>
              {waiting.length === 0 && <div className="admin-empty">Nadie esperando.</div>}
              {waiting.map((e) => (
                <div className="admin-entry-row" key={e.id}>
                  <div>
                    <div className="admin-entry-name">{e.firstName} {e.lastName}</div>
                    <div className="admin-entry-sub">DNI {e.documentNumber}</div>
                  </div>
                  <div className="admin-entry-actions">
                    <button className="admin-action-btn accent" onClick={() => handleSeat(e)}>Sentar</button>
                    <button className="admin-action-btn danger" onClick={() => handleRemove(e)}>Quitar</button>
                  </div>
                </div>
              ))}

              <div className="admin-section-title">Sentar jugador presente (sin lista)</div>
              <input
                className="admin-search-input"
                type="text"
                placeholder="Buscar por nombre, apellido o DNI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchResults.map((u) => {
                const chosenTableId = rowTableChoice[u.id] ?? selectedId ?? tables[0]?.id ?? "";
                return (
                  <div className="admin-entry-row admin-walkin-row" key={u.id}>
                    <div>
                      <div className="admin-entry-name">{u.firstName} {u.lastName}</div>
                      <div className="admin-entry-sub">DNI {u.documentNumber}</div>
                    </div>
                    <div className="admin-walkin-actions">
                      <select
                        className="admin-walkin-select"
                        value={chosenTableId}
                        onChange={(e) =>
                          setRowTableChoice((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                      >
                        {tables.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <button
                        className="admin-action-btn accent"
                        onClick={() => handleSeatWalkin(u, chosenTableId)}
                      >
                        Sentar
                      </button>
                    </div>
                  </div>
                );
              })}

              {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="admin-guest-form">
                  <div className="admin-empty">No se encontró ninguna cuenta con ese nombre o DNI.</div>
                  <div className="admin-section-title" style={{ marginTop: 4 }}>Cargar como invitado (sin cuenta)</div>
                  <div className="form-row">
                    <label>
                      Tipo de documento
                      <select
                        value={guestForm.documentType}
                        onChange={(e) => setGuestField("documentType", e.target.value)}
                      >
                        <option value="DNI">DNI</option>
                        <option value="LC">LC</option>
                        <option value="LE">LE</option>
                        <option value="PASAPORTE">Pasaporte</option>
                      </select>
                    </label>
                    <label>
                      Número de documento
                      <input
                        value={guestForm.documentNumber}
                        onChange={(e) => setGuestField("documentNumber", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="form-row">
                    <label>
                      Nombre
                      <input
                        value={guestForm.firstName}
                        onChange={(e) => setGuestField("firstName", e.target.value)}
                      />
                    </label>
                    <label>
                      Apellido
                      <input
                        value={guestForm.lastName}
                        onChange={(e) => setGuestField("lastName", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="admin-walkin-actions">
                    <select
                      className="admin-walkin-select"
                      value={guestTableChoice || selectedId || tables[0]?.id || ""}
                      onChange={(e) => setGuestTableChoice(e.target.value)}
                    >
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      className="admin-action-btn accent"
                      onClick={handleSeatGuest}
                      disabled={guestSaving}
                    >
                      {guestSaving ? "Sentando..." : "Sentar invitado"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}