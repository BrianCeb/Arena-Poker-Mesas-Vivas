import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { socket } from "./socket";

interface Table {
  id: string;
  name: string;
  gameType: string;
  smallBlind: number;
  bigBlind: number;
  capacity: number;
  minPlayersToStart: number;
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

export default function AdminPanel() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seated, setSeated] = useState<Entry[]>([]);
  const [waiting, setWaiting] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [walkinTableId, setWalkinTableId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

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
    // Tiempo real: cuando cambia algo (en cualquier mesa), refrescamos
    // tanto el resumen de mesas como el detalle de la que está seleccionada.
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
      setWalkinTableId(selectedId);
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

  async function handleSeat(entry: Entry) {
    try {
      await api.seatFromWaiting(entry.id);
      showToast(`${entry.user.firstName} ${entry.user.lastName} sentado.`);
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

  async function handleSeatWalkin(user: SearchResult) {
    if (!walkinTableId) return;
    try {
      await api.seatWalkin(walkinTableId, user.id);
      const targetTable = tables.find((t) => t.id === walkinTableId);
      showToast(`${user.firstName} ${user.lastName} sentado en ${targetTable?.name} (presente, sin lista).`);
      setSearchQuery("");
      setSearchResults([]);
      refreshAll();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  const selectedTable = tables.find((t) => t.id === selectedId);

  return (
    <div className="admin-panel">
      <div className="admin-tables-list">
        {tables.map((t) => (
          <div
            key={t.id}
            className={`admin-table-row ${t.id === selectedId ? "selected" : ""}`}
            onClick={() => setSelectedId(t.id)}
          >
            <div>
              <div className="admin-table-name">{t.name}</div>
              <div className="admin-table-sub">${t.smallBlind} / ${t.bigBlind} · {statusLabel(t)}</div>
            </div>
            <div className="admin-table-counts">
              <span>{t.seated}/{t.capacity}</span>
              {t.waiting > 0 && <span className="admin-waiting-count">+{t.waiting} esp.</span>}
            </div>
            <button
              className={`admin-toggle-btn ${t.status === "ABIERTA" ? "danger" : "accent"}`}
              onClick={(e) => { e.stopPropagation(); handleToggleStatus(t); }}
            >
              {t.status === "ABIERTA" ? "Cerrar" : "Abrir"}
            </button>
          </div>
        ))}
      </div>

      {selectedTable && (
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
              <button className="admin-action-btn danger" onClick={() => handleRemove(e)}>Retirar</button>
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
          <select
            className="admin-search-input"
            value={walkinTableId || ""}
            onChange={(e) => setWalkinTableId(e.target.value)}
          >
            {tables.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — ${t.smallBlind}/${t.bigBlind}</option>
            ))}
          </select>
          <input
            className="admin-search-input"
            type="text"
            placeholder="Buscar por nombre, apellido o DNI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchResults.map((u) => (
            <div className="admin-entry-row" key={u.id}>
              <div>
                <div className="admin-entry-name">{u.firstName} {u.lastName}</div>
                <div className="admin-entry-sub">DNI {u.documentNumber}</div>
              </div>
              <button className="admin-action-btn accent" onClick={() => handleSeatWalkin(u)}>
                Sentar en {tables.find((t) => t.id === walkinTableId)?.name}
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
