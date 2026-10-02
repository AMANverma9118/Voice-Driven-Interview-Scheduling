import { useEffect, useState } from "react";
import { api } from "../api";

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

export default function Thread({ path, canSuggest = false }) {
  const [rows, setRows] = useState([]);
  const [body, setBody] = useState("");
  const [proposed, setProposed] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const next = await api(path);
    setRows(next);
  }

  useEffect(() => {
    let stop = false;
    load().catch((err) => {
      if (!stop) setError(err.message);
    });
    const timer = window.setInterval(() => {
      load().catch(() => {});
    }, 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [path]);

  async function send(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = { body };
      if (canSuggest && proposed) payload.proposed_time = new Date(proposed).toISOString();
      await api(path, { method: "POST", body: JSON.stringify(payload) });
      setBody("");
      setProposed("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function accept(id) {
    setError("");
    try {
      await api(`/api/me/messages/${id}/accept`, { method: "POST", body: "{}" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="thread-wrap">
      {error && <div className="banner" role="alert">{error}</div>}
      <div className="thread">
        {rows.length ? rows.map((item) => (
          <article key={item.id} className={item.mine ? "note-line mine" : "note-line"}>
            <p className="note-meta">{item.author_role === "admin" ? "Desk" : "Candidate"} · {when(item.created_at)}</p>
            <p>{item.body}</p>
            {item.proposed_time && <p className="note-time">Suggested time: {when(item.proposed_time)}</p>}
            {!canSuggest && item.proposed_time && item.author_role === "admin" && (
              <button type="button" className="btn" onClick={() => accept(item.id)}>This time works</button>
            )}
          </article>
        )) : <p className="empty">No messages yet.</p>}
      </div>
      <form onSubmit={send}>
        <label>
          Message
          <textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={1000} placeholder="The time is not quite right…" />
        </label>
        {canSuggest && (
          <label>
            Suggest another time
            <input type="datetime-local" value={proposed} onChange={(event) => setProposed(event.target.value)} />
          </label>
        )}
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Send"}</button>
        </div>
      </form>
    </div>
  );
}
