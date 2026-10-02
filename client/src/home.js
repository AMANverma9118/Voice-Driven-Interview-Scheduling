export function homeFor(user) {
  return user?.role === "admin" ? "/overview" : "/profile";
}
