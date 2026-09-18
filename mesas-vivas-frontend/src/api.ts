const API_URL = "http://localhost:3000";

function getToken(): string | null {
  return localStorage.getItem("accessToken");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("accessToken", token);
  else localStorage.removeItem("accessToken");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refreshToken");
}

export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem("refreshToken", token);
  else localStorage.removeItem("refreshToken");
}

export function setStoredUser(user: any | null) {
  if (user) localStorage.setItem("user", JSON.stringify(user));
  else localStorage.removeItem("user");
}

export function getStoredUser(): any | null {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

// Evita que dos pedidos que reciben 401 al mismo tiempo disparen dos
// refresh simultáneos — el segundo espera el resultado del primero.
let refreshInFlight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    setToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

function clearSession() {
  setToken(null);
  setRefreshToken(null);
  setStoredUser(null);
}

// Rutas que jamás deberían disparar un intento de refresh (evita loops:
// si /auth/refresh mismo devuelve 401, no tiene sentido reintentar).
const NO_REFRESH_PATHS = ["/auth/refresh", "/auth/login"];

async function request(path: string, options: RequestInit = {}, isRetry = false): Promise<any> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, cache: "no-store" });

  if (res.status === 401 && !isRetry && !NO_REFRESH_PATHS.includes(path)) {
    if (!refreshInFlight) {
      refreshInFlight = doRefresh().finally(() => {
        refreshInFlight = null;
      });
    }
    const newToken = await refreshInFlight;
    if (newToken) {
      return request(path, options, true);
    }
    clearSession();
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.error || "Error inesperado");
  }
  return data;
}

// Para pedidos con archivos (multipart/form-data) — no le ponemos
// Content-Type a mano, el navegador lo arma solo con el "boundary" correcto.
async function uploadRequest(path: string, method: string, formData: FormData) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { method, headers, body: formData, cache: "no-store" });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(data?.error || "Error inesperado");
  }
  return data;
}

export interface RegisterInput {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  sex: string;
  email: string;
  confirmEmail: string;
  phone?: string;
  nickname?: string;
  password: string;
  confirmPassword: string;
  birthDate: string;
  acceptedTerms: boolean;
}

export interface TableInput {
  name?: string;
  gameType?: string;
  smallBlind?: number;
  bigBlind?: number;
  minBuyIn?: number | null;
  maxBuyIn?: number | null;
  capacity?: number;
  minPlayersToStart?: number;
  stradleMode?: string;
  stradleAmount?: number | null;
  notes?: string;
}

export interface ProfileUpdateInput {
  phone?: string | null;
  nickname?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface GuestInput {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
}

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminUser {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  sex: string;
  email: string;
  emailVerifiedAt: string | null;
  phone: string | null;
  nickname: string | null;
  birthDate: string;
  status: "PENDIENTE" | "ACTIVA" | "BLOQUEADA" | "DESHABILITADA";
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
}

export interface AdminUserHistoryEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState: any;
  newState: any;
  createdAt: string;
  actor: { firstName: string; lastName: string } | null;
}

export const api = {
  login: (email: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (data: RegisterInput) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () =>
    request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    }),

  // ── Perfil ──
  getProfile: () => request("/users/me"),
  updateProfile: (data: ProfileUpdateInput) =>
    request("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  changePassword: (data: ChangePasswordInput) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTables: () => request("/tables"),
  getMyEntries: () => request("/waiting-list/me"),
  joinTable: (tableId: string) =>
    request(`/waiting-list/tables/${tableId}/join`, { method: "POST" }),
  leaveList: (tableId: string) =>
    request(`/waiting-list/tables/${tableId}/leave`, { method: "POST" }),
  getTournaments: () => request("/tournaments"),
  getTournament: (id: string) => request(`/tournaments/${id}`),

  // ── Admin ──
  updateTableStatus: (tableId: string, status: string) =>
    request(`/tables/${tableId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  createTable: (data: TableInput) =>
    request("/tables", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTable: (tableId: string, data: TableInput) =>
    request(`/tables/${tableId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteTable: (tableId: string) =>
    request(`/tables/${tableId}`, { method: "DELETE" }),
  getTableEntries: (tableId: string) => request(`/waiting-list/tables/${tableId}/entries`),
  seatFromWaiting: (entryId: string) =>
    request(`/waiting-list/${entryId}/seat`, { method: "PATCH" }),
  removeEntry: (entryId: string, reason?: string, cashOutAmount?: number) =>
    request(`/waiting-list/${entryId}`, {
      method: "DELETE",
      body: JSON.stringify({ reason, cashOutAmount }),
    }),
  searchUsers: (q: string) => request(`/users/search?q=${encodeURIComponent(q)}`),
  seatWalkin: (tableId: string, userId: string) =>
    request(`/waiting-list/tables/${tableId}/seat-walkin`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  seatWalkinGuest: (tableId: string, guest: GuestInput) =>
    request(`/waiting-list/tables/${tableId}/seat-walkin-guest`, {
      method: "POST",
      body: JSON.stringify(guest),
    }),

  // ── Admin: torneos ──
  getTournamentsAdmin: () => request("/tournaments/admin"),
  createTournamentAdmin: (formData: FormData) => uploadRequest("/tournaments", "POST", formData),
  updateTournamentAdmin: (id: string, formData: FormData) =>
    uploadRequest(`/tournaments/${id}`, "PATCH", formData),
  updateTournamentStatus: (id: string, status: string) =>
    request(`/tournaments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  duplicateTournament: (id: string) =>
    request(`/tournaments/${id}/duplicate`, { method: "POST" }),
  deleteTournament: (id: string) => request(`/tournaments/${id}`, { method: "DELETE" }),

  // ── Admin: auditoría ──
  getAuditLogs: (params: AuditLogFilters = {}) => {
    const qs = new URLSearchParams();
    if (params.entityType) qs.set("entityType", params.entityType);
    if (params.action) qs.set("action", params.action);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    const query = qs.toString();
    return request(`/audit-logs${query ? `?${query}` : ""}`);
  },

  // ── Admin: gestión de usuarios ──
  searchUsersAdmin: (q: string): Promise<AdminUser[]> =>
    request(`/users/admin?q=${encodeURIComponent(q)}`),
  getUserAdmin: (id: string): Promise<{ user: AdminUser; history: AdminUserHistoryEntry[] }> =>
    request(`/users/admin/${id}`),
  updateUserStatus: (id: string, status: string): Promise<AdminUser> =>
    request(`/users/admin/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};