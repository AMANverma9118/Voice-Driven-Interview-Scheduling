export function apiUrl(path) {
  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}

export async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = localStorage.getItem("desk_token");
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(apiUrl(path), { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "The desk could not complete that");
    error.status = response.status;
    error.data = data;
    if (response.status === 401 && !path.startsWith("/api/auth")) {
      localStorage.removeItem("desk_token");
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    throw error;
  }
  return data;
}
