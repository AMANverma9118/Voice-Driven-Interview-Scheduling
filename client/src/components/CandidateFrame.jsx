import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Brand } from "../settings";

function when(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function CandidateFrame({ onSignOut, children }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const slot = useRef(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let stop = false;
    async function load() {
      const data = await api("/api/me/notices");
      if (stop) return;
      setUnread(data.unread || 0);
      setItems(Array.isArray(data.items) ? data.items : []);
    }
    load().catch(() => {});
    const timer = window.setInterval(() => {
      load().catch(() => {});
    }, 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    function outside(event) {
      if (!slot.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="app">
      <aside className="rail">
        <Brand to="/profile" />
        <nav>
          <NavLink to="/profile">Details</NavLink>
          <NavLink to="/interview">Interview</NavLink>
          <NavLink to="/record">Record</NavLink>
          <NavLink to="/messages">Messages</NavLink>
        </nav>
        <div className="rail-user">
          <p>{user?.name}</p>
          <p>{user?.email}</p>
          <button type="button" className="signout" onClick={onSignOut || signOut}>Sign out</button>
        </div>
      </aside>
      <main>
        <div className="bell-slot" ref={slot}>
          <button
            type="button"
            className="bell"
            aria-label={unread ? `${unread} new notices` : "Notices"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.2 9.2a5.8 5.8 0 0 1 11.6 0c0 4.2 1.3 5.8 1.8 6.4H4.4c.5-.6 1.8-2.2 1.8-6.4Z" />
              <path d="M10 18.2a2 2 0 0 0 4 0" />
            </svg>
            {unread > 0 ? <span className="bell-count">{unread}</span> : null}
          </button>
          {open && (
            <div className="bell-panel" role="menu">
              <p className="bell-label">Notices</p>
              {items.length ? items.map((item) => (
                <NavLink className="bell-item" to="/messages" key={item.id} role="menuitem">
                  <p>{item.body}</p>
                  <time dateTime={item.created_at}>{when(item.created_at)}</time>
                </NavLink>
              )) : <p className="bell-empty">No new notices.</p>}
            </div>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
