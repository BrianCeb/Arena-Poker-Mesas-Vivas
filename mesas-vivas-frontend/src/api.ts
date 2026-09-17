const API_URL = "http://localhost:3000";

function getToken(): string | null {
  return localStorage.getItem("accessToken");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("accessToken", token);
  else localStorage.removeItem("accessToken");
}

export function setStoredUser(user: any | null) {
  if (user) localStorage.setItem("user", JSON.stringify(user));
  else localStorage.removeItem("user");
}

export function getStoredUser(): any | null {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, cache: "no-store" });
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
  getTables: () => request("/tables"),
  getMyEntry: () => request("/waiting-list/me"),
  joinTable: (tableId: string) =>
    request(`/waiting-list/tables/${tableId}/join`, { method: "POST" }),
  leaveList: () => request("/waiting-list/leave", { method: "POST" }),
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
  removeEntry: (entryId: string) =>
    request(`/waiting-list/${entryId}`, { method: "DELETE" }),
  searchUsers: (q: string) => request(`/users/search?q=${encodeURIComponent(q)}`),
  seatWalkin: (tableId: string, userId: string) =>
    request(`/waiting-list/tables/${tableId}/seat-walkin`, {
      method: "POST",
      body: JSON.stringify({ userId }),
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
};