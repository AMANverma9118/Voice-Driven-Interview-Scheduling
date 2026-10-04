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
    const companySignIn = path.startsWith("/api/join");
    if (response.status === 401 && !path.startsWith("/api/auth") && !companySignIn) {
      localStorage.removeItem("desk_token");
      const company = sessionStorage.getItem("desk_company");
      const dest = company ? `/join/${company}?in=1` : "/login";
      if (window.location.pathname !== dest.split("?")[0]) window.location.assign(dest);
    }
    throw error;
  }
  return data;
}
