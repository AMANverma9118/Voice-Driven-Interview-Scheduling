import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("desk_token");
    if (!token) {
      setReady(true);
      return;
    }
    api("/api/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("desk_token"))
      .finally(() => setReady(true));
  }, []);

  function signIn(token, nextUser) {
    localStorage.setItem("desk_token", token);
    setUser(nextUser);
  }

  function signOut() {
    localStorage.removeItem("desk_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
