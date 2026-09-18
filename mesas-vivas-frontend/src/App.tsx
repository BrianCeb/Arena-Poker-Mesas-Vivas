import { useEffect, useState, useCallback } from "react";
import { api, setToken, setRefreshToken, setStoredUser, getStoredUser } from "./api";
import { socket } from "./socket";
import AdminPanel from "./AdminPanel";
import RegisterForm from "./RegisterForm";
import TournamentsView from "./TournamentsView";
import ProfileView from "./ProfileView";

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
  status: "ANOTADO" | "SENTADO";
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
  const [showAuth, setShowAuth] = useState<"login" | "register" | null>(null);
  const [publicTab, setPublicTab] = useState<"mesas" | "torneos">("mesas");
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [tables, setTables] = useState<Table[]>([]);
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  const [showProfile, setShowProfile] = useState(false);

  function handleGoHome() {
    setShowProfile(false);
    setPublicTab("mesas");
  }

  const loadTables = useCallback(async () => {
    try {
      const data = await api.getTables();
      setTables(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadMyEntries = useCallback(async () => {
    if (!loggedIn) {
      setMyEntries([]);
      return;
    }
    try {
      const data = await api.getMyEntries();
      setMyEntries(data);
    } catch (err) {
      // Si era un 401 por token vencido, api.ts ya intentó renovarlo solo
      // antes de llegar acá — si igual falló, el listener de
      // "auth:expired" se encarga de cerrar la sesión. Acá solo dejamos
      // la lista vacía para no mostrar datos viejos.
      setMyEntries([]);
    }
  }, [loggedIn]);

  useEffect(() => {
    // Las mesas son públicas, así que se cargan siempre, con o sin sesión.
    loadTables();
    loadMyEntries();
    const handleChange = () => {
      loadTables();
      loadMyEntries();
    };
    socket.on("tables:changed", handleChange);
    return () => {
      socket.off("tables:changed", handleChange);
    };
  }, [loadTables, loadMyEntries]);

  useEffect(() => {
    // Lo dispara api.ts cuando un 401 no se pudo resolver renovando el
    // access token (el refresh token también venció o fue revocado) —
    // ahí ya no queda otra que mandar al usuario de nuevo al login.
    function handleAuthExpired() {
      setCurrentUser(null);
      setLoggedIn(false);
      setMyEntries([]);
      showToast("Tu sesión venció. Iniciá sesión de nuevo.");
    }
    window.addEventListener("auth:expired", handleAuthExpired);
    return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      const result = await api.login(email, password);
      setToken(result.accessToken);
      setRefreshToken(result.refreshToken);
      setStoredUser(result.user);
      setCurrentUser(result.user);
      setLoggedIn(true);
      setShowAuth(null);
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setLoginError(err.message);
    }
  }

  async function handleLogout() {
    // Best-effort: si falla (por ejemplo, ya no hay conexión), igual
    // limpiamos la sesión local — no tiene sentido dejar al usuario
    // atrapado en la app por un error de red al desloguearse.
    try {
      await api.logout();
    } catch {
      // no-op
    }
    setToken(null);
    setRefreshToken(null);
    setStoredUser(null);
    setCurrentUser(null);
    setLoggedIn(false);
    setMyEntries([]);
  }

  async function handleJoin(tableId: string) {
    if (!loggedIn) {
      setShowAuth("login");
      return;
    }
    try {
      await api.joinTable(tableId);
      showToast("Te anotaste correctamente.");
      loadTables();
      loadMyEntries();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleLeave(tableId: string) {
    try {
      await api.leaveList(tableId);
      showToast("Te retiraste de la lista.");
      loadTables();
      loadMyEntries();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  const isStaff = loggedIn && currentUser?.roles?.length > 0;

  // ── Staff: entra directo al panel admin, sin vista de jugador ──
  if (isStaff) {
    return (
      <>
        <header>
          <div className="brand" onClick={handleGoHome}>
            <img className="brand-logo" src="/arena-poker-logo.png" alt="Arena Poker" />
            <span className="brand-sub">Panel Admin</span>
          </div>
          <div className="header-right">
            <button
              className="theme-toggle-btn"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button className="logout-btn" onClick={() => setShowProfile(true)}>Mi perfil</button>
            <button className="logout-btn" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </header>
        {showProfile ? (
          <ProfileView
            onClose={() => setShowProfile(false)}
            onPasswordChanged={async () => {
              await handleLogout();
              setShowProfile(false);
              showToast("Contraseña actualizada. Iniciá sesión de nuevo.");
            }}
          />
        ) : (
          <AdminPanel />
        )}
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  // ── Overlay de login / registro (se puede cerrar y seguir mirando) ──
  if (showAuth === "register") {
    return (
      <div className="login-screen">
        <RegisterForm
          onBackToLogin={() => setShowAuth("login")}
          onClose={() => setShowAuth(null)}
        />
      </div>
    );
  }

  if (showAuth === "login") {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={handleLogin}>
          <button type="button" className="auth-close-btn" onClick={() => setShowAuth(null)}>✕</button>
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
          <button
            type="button"
            className="link-button"
            onClick={() => setShowAuth("register")}
          >
            ¿No tenés cuenta? Registrate
          </button>
        </form>
      </div>
    );
  }

  // ── Vista pública / jugador ──
  return (
    <>
      <header>
        <div className="brand" onClick={handleGoHome}>
          <img className="brand-logo" src="/arena-poker-logo.png" alt="Arena Poker" />
          <span className="brand-sub"></span>
        </div>
        <div className="header-right">
          <button
            className="theme-toggle-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {loggedIn ? (
            <>
              <button className="logout-btn" onClick={() => setShowProfile(true)}>Mi perfil</button>
              <button className="logout-btn" onClick={handleLogout}>Cerrar sesión</button>
            </>
          ) : (
            <button className="login-btn-header" onClick={() => setShowAuth("login")}>
              Iniciar sesión
            </button>
          )}
        </div>
      </header>

      <div className="view-switch public-tabs">
        <button
          className={publicTab === "mesas" ? "active" : ""}
          onClick={() => setPublicTab("mesas")}
        >
          Mesas Vivas
        </button>
        <button
          className={publicTab === "torneos" ? "active" : ""}
          onClick={() => setPublicTab("torneos")}
        >
          Torneos
        </button>
      </div>

      {showProfile ? (
        <ProfileView
          onClose={() => setShowProfile(false)}
          onPasswordChanged={async () => {
            await handleLogout();
            setShowProfile(false);
            showToast("Contraseña actualizada. Iniciá sesión de nuevo.");
          }}
        />
      ) : publicTab === "torneos" ? (
        <TournamentsView />
      ) : (
        <main>
          {loggedIn && (
            <>
              <div className="section-title">Tus inscripciones</div>
              {myEntries.length > 0 ? (
                <div className="my-entries">
                  {myEntries.map((entry) => (
                    <div className="my-entry" key={entry.id}>
                      <div className="my-entry-title">
                        {entry.table.name} — ${entry.table.smallBlind} / ${entry.table.bigBlind}
                      </div>
                      <div className="my-entry-detail">
                        {entry.status === "SENTADO" ? "Sentado en esta mesa" : "Anotado, en espera"}
                      </div>
                      {entry.status === "SENTADO" ? (
                        <div className="my-entry-seated-note">
                          Estás jugando en esta mesa. Para dejarla, avisale al personal del casino.
                        </div>
                      ) : (
                        <button className="btn-leave" onClick={() => handleLeave(entry.tableId)}>
                          Retirarme de la lista
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No estás anotado en ninguna mesa.</div>
              )}
            </>
          )}

          <div className="section-title">Mesas</div>
          {tables.map((t) => {
            const status = tableStatusInfo(t);
            const pct = Math.round((t.seated / t.capacity) * 100);
            const myEntryHere = myEntries.find((e) => e.tableId === t.id);
            const canJoin = t.status === "ABIERTA" && !myEntryHere;
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
                  disabled={!canJoin && !myEntryHere && loggedIn}
                  onClick={() => handleJoin(t.id)}
                >
                  {!loggedIn
                    ? "Iniciar sesión para anotarse"
                    : myEntryHere
                      ? myEntryHere.status === "SENTADO"
                        ? "Ya estás sentado acá"
                        : "Ya estás anotado acá"
                      : t.status !== "ABIERTA"
                        ? "Mesa cerrada"
                        : "Anotarse en lista"}
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