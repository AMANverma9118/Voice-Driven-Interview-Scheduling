import { createContext, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api";

const SettingsContext = createContext({ settings: null, refresh: () => {} });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);

  function refresh() {
    return api("/api/settings").then(setSettings).catch(() => {});
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.style.setProperty("--paper", settings.paper);
    root.style.setProperty("--ink", settings.ink);
    root.style.setProperty("--brick", settings.brick);
    root.style.setProperty("--rail", settings.rail);
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, refresh, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

export function Brand({ to = "/" }) {
  const { settings } = useSettings();
  const name = settings?.companyName || "Interview Desk";
  return (
    <Link className="brand" to={to}>
      {settings?.logo ? <img className="brand-logo" src={settings.logo} alt="" /> : <span className="brand-kicker">Scheduling</span>}
      <span className="brand-name">{name}</span>
    </Link>
  );
}
