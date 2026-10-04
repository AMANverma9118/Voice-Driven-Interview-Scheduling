export function homeFor(user) {
  return user?.role === "admin" ? "/overview" : "/profile";
}

export function signInPath() {
  const company = sessionStorage.getItem("desk_company");
  return company ? `/join/${company}?in=1` : "/login";
}
