import { useEffect, useState, useCallback } from "react";
import { api, TableInput } from "./api";
import { socket } from "./socket";
import AdminTournaments from "./AdminTournaments";
import AdminAuditLog from "./AdminAuditLog";

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

interface EntryUser {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
}

interface Entry {
  id: string;
  user: EntryUser;
  origin: "APP" | "MANUAL_STAFF";
  createdAt: string;
}

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

function TableForm({
  mode,
  initial,
  onCancel,
  onSaved,
  showToast,
}: {
  mode: "create" | "edit";
  initial: TableInput & { id?: string };
  onCancel: () => void;
  onSaved: () => void;
  showToast: (msg: string) => void;
}) {
  const [form, setForm] = useState<TableInput>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof TableInput>(key: K, value: TableInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "create" && (!form.name || !form.gameType || form.smallBlind == null || form.bigBlind == null)) {
      setError("Nombre, tipo de juego y ciegas son obligatorios.");
      return;
    }
    if (form.stradleMode !== "NO" && !form.stradleAmount) {
      setError("Si el stradle es opcional u obligatorio, hace falta indicar el monto.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await api.createTable(form);
        showToast(`Mesa "${form.name}" creada.`);
      } else {
        const { name, ...editableFields } = form;
        await api.updateTable(initial.id!, editableFields);
        showToast(`Mesa "${initial.name}" actualizada.`);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-table-form" onSubmit={handleSubmit}>
      <div className="admin-section-title">{mode === "create" ? "Nueva mesa" : `Editar ${initial.name}`}</div>
      {error && <div className="admin-form-error">{error}</div>}

      <div className="form-row">
        <label>
          Nombre
          <input
            value={form.name || ""}
            onChange={(e) => set("name", e.target.value)}
            disabled={mode === "edit"}
            placeholder="Mesa 5"
          />
        </label>
        <label>
          Tipo de juego
          <input
            value={form.gameType || ""}
            onChange={(e) => set("gameType", e.target.value)}
            placeholder="Texas Hold'em"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Ciega chica
          <input
            type="number"
            value={form.smallBlind ?? ""}
            onChange={(e) => set("smallBlind", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <label>
          Ciega grande
          <input
            type="number"
            value={form.bigBlind ?? ""}
            onChange={(e) => set("bigBlind", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Buy-in mínimo (opcional)
          <input
            type="number"
            value={form.minBuyIn ?? ""}
            onChange={(e) => set("minBuyIn", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <label>
          Buy-in máximo (opcional)
          <input
            type="number"
            value={form.maxBuyIn ?? ""}
            onChange={(e) => set("maxBuyIn", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Capacidad
          <input
            type="number"
            value={form.capacity ?? ""}
            onChange={(e) => set("capacity", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
        <label>
          Mínimo para arrancar
          <input
            type="number"
            value={form.minPlayersToStart ?? ""}
            onChange={(e) => set("minPlayersToStart", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Stradle
          <select value={form.stradleMode} onChange={(e) => set("stradleMode", e.target.value)}>
            <option value="NO">No</option>
            <option value="OPCIONAL">Opcional</option>
            <option value="OBLIGATORIO">Obligatorio</option>
          </select>
        </label>
        {form.stradleMode !== "NO" && (
          <label>
            Monto del stradle
            <input
              type="number"
              value={form.stradleAmount ?? ""}
              onChange={(e) => set("stradleAmount", e.target.value === "" ? undefined : Number(e.target.value))}
            />
          </label>
        )}
      </div>

      {mode === "edit" && (
        <label className="admin-form-full">
          Observaciones
          <input
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
      )}

      <div className="admin-form-actions">
        <button type="submit" className="admin-action-btn accent" disabled={saving}>
          {saving ? "Guardando..." : mode === "create" ? "Crear mesa" : "Guardar cambios"}
        </button>
        <button type="button" className="admin-action-btn" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function AdminPanel() {
  const [adminSection, setAdminSection] = useState<"mesas" | "torneos" | "auditoria">("mesas");

  const [tables, setTables] = useState<Table[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seated, setSeated] = useState<Entry[]>([]);
  const [waiting, setWaiting] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [rowTableChoice, setRowTableChoice] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);

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
      showToast(`${entry.user.firstName} ${entry.user.lastName} sentado.`);
      if (result?.warning) window.alert(result.warning);
      refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleRemove(entry: Entry) {
    try {
      await api.removeEntry(entry.id);
      showToast(`${entry.user.firstName} ${entry.user.lastName} removido.`);
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
      `¿${entry.user.firstName} ${entry.user.lastName} se retira con fichas?`
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
      showToast(`${entry.user.firstName} ${entry.user.lastName} removido.`);
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
          className={adminSection === "auditoria" ? "active" : ""}
          onClick={() => setAdminSection("auditoria")}
        >
          Auditoría
        </button>
      </div>

      {adminSection === "torneos" ? (
        <AdminTournaments />
      ) : adminSection === "auditoria" ? (
        <AdminAuditLog />
      ) : (
        <div className="admin-panel">
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
                    <div className="admin-entry-name">{e.user.firstName} {e.user.lastName}</div>
                    <div className="admin-entry-sub">
                      DNI {e.user.documentNumber} · {e.origin === "MANUAL_STAFF" ? "presente, sin lista" : "vía app"}
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
                    <div className="admin-entry-name">{e.user.firstName} {e.user.lastName}</div>
                    <div className="admin-entry-sub">DNI {e.user.documentNumber}</div>
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
            </div>
          )}

          {toast && <div className="toast">{toast}</div>}
        </div>
      )}
    </>
  );
}