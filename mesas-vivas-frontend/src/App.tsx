import { useEffect, useState, useCallback } from "react";
import { api, setToken, setStoredUser, getStoredUser } from "./api";
import { socket } from "./socket";
import AdminPanel from "./AdminPanel";

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

interface MyEntry {
  id: string;
  tableId: string;
  table: Table;
}

function tableStatusInfo(t: Table) {
  if (t.status !== "ABIERTA") return { label: "Cerrada", cls: "badge-closed" };
  if (t.seated >= t.capacity) return { label: "Completa", cls: "badge-full" };
  if (t.seated < t.minPlayersToStart) return { label: "Armando mesa", cls: "badge-starting" };
  return { label: "En juego", cls: "badge-open" };
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("accessToken"));
  const [currentUser, setCurrentUser] = useState<any>(getStoredUser());
  const [view, setView] = useState<"jugador" | "admin">("jugador");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tables, setTables] = useState<Table[]>([]);
  const [myEntry, setMyEntry] = useState<MyEntry | null>(null);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const loadData = useCallback(async () => {
    try {
      const [tablesData, entryData] = await Promise.all([
        api.getTables(),
        api.getMyEntry(),
      ]);
      setTables(tablesData);
      setMyEntry(entryData);
    } catch (err) {
      // si el token venció, volvemos al login
      setToken(null);
      setLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    loadData();
    const handleChange = () => {
      console.log("[socket] tables:changed recibido, refrescando...");
      loadData();
    };
    socket.on("tables:changed", handleChange);
    return () => {
      socket.off("tables:changed", handleChange);
    };
  }, [loggedIn, loadData]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const result = await api.login(email, password);
      setToken(result.accessToken);
      setStoredUser(result.user);
      setCurrentUser(result.user);
      setLoggedIn(true);
    } catch (err: any) {
      setLoginError(err.message);
    }
  }

  function handleLogout() {
    setToken(null);
    setStoredUser(null);
    setCurrentUser(null);
    setLoggedIn(false);
    setTables([]);
    setMyEntry(null);
  }

  async function handleJoin(tableId: string) {
    try {
      await api.joinTable(tableId);
      showToast("Te anotaste correctamente.");
      loadData();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleLeave() {
    try {
      await api.leaveList();
      showToast("Te retiraste de la lista.");
      loadData();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  if (!loggedIn) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleLogin}>
          <img className="login-logo" src="/arena-poker-logo.png" alt="Arena Poker" />
          <div className="login-subtitle">Mesas Vivas</div>
          {loginError && <div className="login-error">{loginError}</div>}
          <input
            className="login-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="login-input"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="login-btn" type="submit">Iniciar sesión</button>
        </form>
      </div>
    );
  }

  const isStaff = currentUser?.roles?.length > 0;

  return (
    <>
      <header>
        <div className="brand">
          <img className="brand-logo" src="/arena-poker-logo.png" alt="Arena Poker" />
          <span className="brand-sub">Mesas Vivas</span>
        </div>
        <div className="header-right">
          {isStaff && (
            <div className="view-switch">
              <button
                className={view === "jugador" ? "active" : ""}
                onClick={() => setView("jugador")}
              >
                Jugador
              </button>
              <button
                className={view === "admin" ? "active" : ""}
                onClick={() => setView("admin")}
              >
                Panel Admin
              </button>
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>

      {isStaff && view === "admin" ? (
        <AdminPanel />
      ) : (
        <main>
        <div className="section-title">Tu inscripción</div>
        {myEntry ? (
          <div className="my-entry">
            <div className="my-entry-title">
              {myEntry.table.name} — ${myEntry.table.smallBlind} / ${myEntry.table.bigBlind}
            </div>
            <div className="my-entry-detail">Anotado en esta mesa</div>
            <button className="btn-leave" onClick={handleLeave}>Retirarme de la lista</button>
          </div>
        ) : (
          <div className="empty-state">No estás anotado en ninguna mesa.</div>
        )}

        <div className="section-title">Mesas</div>
        {tables.map((t) => {
          const status = tableStatusInfo(t);
          const pct = Math.round((t.seated / t.capacity) * 100);
          const isJoinedHere = myEntry?.tableId === t.id;
          const canJoin = t.status === "ABIERTA" && !myEntry;
          return (
            <div className="table-card" key={t.id}>
              <div className="table-card-top">
                <div>
                  <div className="table-name">{t.name}</div>
                  <div className="table-game">{t.gameType}</div>
                </div>
                <div className={`badge ${status.cls}`}>{status.label}</div>
              </div>
              <div className="blinds-row">
                <div className="stat">
                  <div className="stat-label">Ciegas</div>
                  <div className="stat-value">${t.smallBlind} / ${t.bigBlind}</div>
                </div>
              </div>
              <div className="occupancy-row">
                <div className="occupancy-bar">
                  <div className="occupancy-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="occupancy-text">{t.seated} / {t.capacity} sentados</div>
              </div>
              {t.waiting > 0 && (
                <div className="waiting-text">{t.waiting} persona{t.waiting === 1 ? "" : "s"} en espera</div>
              )}
              <button
                className="btn-join"
                disabled={!canJoin && !isJoinedHere}
                onClick={() => handleJoin(t.id)}
              >
                {isJoinedHere ? "Ya estás anotado acá" : t.status !== "ABIERTA" ? "Mesa cerrada" : "Anotarse en lista"}
              </button>
            </div>
          );
        })}
        </main>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
