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

export const api = {
  login: (email: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getTables: () => request("/tables"),
  getMyEntry: () => request("/waiting-list/me"),
  joinTable: (tableId: string) =>
    request(`/waiting-list/tables/${tableId}/join`, { method: "POST" }),
  leaveList: () => request("/waiting-list/leave", { method: "POST" }),

  // ── Admin ──
  updateTableStatus: (tableId: string, status: string) =>
    request(`/tables/${tableId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
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
};
