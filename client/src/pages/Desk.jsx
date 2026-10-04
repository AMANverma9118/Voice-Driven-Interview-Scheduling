import { Fragment, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Brand } from "../settings";
import Thread from "../components/Thread";
import TimeField from "../components/TimeField";
import MonthJump from "../components/MonthJump";
import Clip from "../components/Clip";
import { openFile } from "../openFile";
import Studio from "./Studio";
import Team from "./Team";

const copy = {
  overview: {
    title: "Overview",
    lede: "Open roles, people on file, and the interviews already on the book.",
  },
  roles: {
    title: "Roles",
    lede: "Each role is what the call sheet reads from when someone picks up.",
  },
  people: {
    title: "People",
    lede: "Details a person saves after they sign in. Add their account on Team.",
  },
  calendar: {
    title: "Calendar",
    lede: "A month of the times candidates chose. Change a time and they get a notice.",
  },
  call: {
    title: "Call sheet",
    lede: "What the candidate said on their interview. These answers are filed by them.",
  },
  studio: {
    title: "Studio",
    lede: "The name candidates hear, the logo, and the colours of this desk.",
  },
  team: {
    title: "Team",
    lede: "Add the candidates for this company. They sign in and fill in their own details.",
  },
};

const personLabel = {
  new: "New",
  screened: "Screened",
  scheduled: "Booked",
  declined: "Not interested",
};

const bookingLabel = {
  scheduled: "Scheduled",
  completed: "Done",
  cancelled: "Cancelled",
};

function todayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function when(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function clock(value) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function dayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function monthCells(cursor) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - lead);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function lpa(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${value} LPA`;
}

function days(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${value} days`;
}

function years(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${value} yrs`;
}

function pageFromPath(pathname) {
  const name = pathname.replace(/^\//, "");
  return copy[name] ? name : "overview";
}

function Field({ label, children, wide }) {
  return (
    <div className={wide ? "span-2" : undefined}>
      <label>
        {label}
        {children}
      </label>
    </div>
  );
}

export default function Desk() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const page = pageFromPath(location.pathname);
  const [data, setData] = useState({ jobs: [], candidates: [], appointments: [], interviews: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [filter, setFilter] = useState("");
  const [editor, setEditor] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  async function loadAll() {
    const [jobs, candidates, appointments, interviews] = await Promise.all([
      api("/api/jobs"),
      api("/api/candidates"),
      api("/api/appointments"),
      api("/api/interviews"),
    ]);
    setData({ jobs, candidates, appointments, interviews });
    setError("");
  }

  useEffect(() => {
    loadAll()
      .catch((err) => setError(err.message))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    setFilter("");
    setEditor(null);
    setPendingDelete(null);
    setFlash("");
    setError("");
  }, [page]);

  function matches(parts) {
    const query = filter.trim().toLowerCase();
    if (!query) return true;
    return parts.join(" ").toLowerCase().includes(query);
  }

  async function submitJson(path, method, body, success) {
    try {
      setError("");
      await api(path, { method, body: JSON.stringify(body) });
      setFlash(success);
      setEditor(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeRecord(kind, id) {
    const paths = { role: `/api/jobs/${id}`, person: `/api/candidates/${id}`, booking: `/api/appointments/${id}` };
    await api(paths[kind], { method: "DELETE" });
    setFlash("Removed.");
    setPendingDelete(null);
    setEditor(null);
    await loadAll();
  }

  function actions(kind, id) {
    if (pendingDelete && pendingDelete.kind === kind && pendingDelete.id === id) {
      return (
        <span className="confirm">
          Remove?{" "}
          <button type="button" className="linkish" onClick={() => removeRecord(kind, id).catch((err) => setError(err.message))}>Yes</button>{" "}
          <button type="button" className="linkish" onClick={() => setPendingDelete(null)}>Keep</button>
        </span>
      );
    }
    return (
      <>
        {kind === "role" && (
          <button type="button" className="linkish" onClick={() => setEditor({ kind, record: findRecord(kind, id) })}>Edit</button>
        )}
        <button type="button" className="linkish" onClick={() => setPendingDelete({ kind, id })}>Remove</button>
      </>
    );
  }

  function findRecord(kind, id) {
    const lists = { role: data.jobs, person: data.candidates, booking: data.appointments };
    return lists[kind].find((item) => item.id === id);
  }

  const info = copy[page];
  const banner = error ? <div className="banner" role="alert">{error}</div> : flash ? <div className="flash" role="status">{flash}</div> : null;

  return (
    <div className="app">
      <aside className="rail">
        <Brand to="/overview" />
        <nav aria-label="Desk">
          <NavLink to="/overview" end>Overview</NavLink>
          <NavLink to="/roles">Roles</NavLink>
          <NavLink to="/people">People</NavLink>
          <NavLink to="/calendar">Calendar</NavLink>
          <NavLink to="/call">Call sheet</NavLink>
          <NavLink to="/studio">Studio</NavLink>
          <NavLink to="/team">Team</NavLink>
        </nav>
        <div className="rail-user">
          <p>{user?.name}</p>
          <p>{user?.email}</p>
          <button type="button" className="signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <main>
        <header className="top">
          <div>
            <p className="kicker">{todayLabel()}</p>
            <h1>{info.title}</h1>
            <p className="lede">{info.lede}</p>
          </div>
        </header>
        {banner}
        {!ready ? <p className="loading">Opening the desk…</p> : (
          <Page
            page={page}
            data={data}
            filter={filter}
            setFilter={setFilter}
            matches={matches}
            editor={editor}
            setEditor={setEditor}
            actions={actions}
            submitJson={submitJson}
            setError={setError}
            setFlash={setFlash}
            loadAll={loadAll}
          />
        )}
      </main>
    </div>
  );
}

function Page(props) {
  if (props.page === "roles") return <Roles {...props} />;
  if (props.page === "people") return <People {...props} />;
  if (props.page === "calendar") return <Calendar {...props} />;
  if (props.page === "call") return <CallSheet {...props} />;
  if (props.page === "studio") return <Studio />;
  if (props.page === "team") return <Team />;
  return <Overview {...props} />;
}

function Overview({ data }) {
  const openRoles = data.jobs.filter((job) => job.status === "open").length;
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thisWeek = data.appointments.filter((item) => {
    const date = new Date(item.date_time);
    return item.status === "scheduled" && date >= now && date <= weekEnd;
  }).length;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const upcoming = data.appointments
    .filter((item) => item.status === "scheduled" && new Date(item.date_time) >= startOfDay)
    .slice(0, 6);

  return (
    <>
      <section className="stats" aria-label="Desk counts">
        <div className="stat"><b>{openRoles}</b><span>Open roles</span></div>
        <div className="stat"><b>{data.candidates.length}</b><span>People on file</span></div>
        <div className="stat"><b>{thisWeek}</b><span>Interviews in the next 7 days</span></div>
      </section>
      <div className="two-col">
        <section>
          <h2 className="section-label">Coming up</h2>
          {upcoming.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Who</th><th>Role</th></tr></thead>
                <tbody>
                  {upcoming.map((item) => (
                    <tr key={item.id}>
                      <td>{when(item.date_time)}</td>
                      <td className="name">{item.candidate_name}</td>
                      <td>{item.job_title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty">Nothing booked yet. A call sheet with a confirmed time will land here.</p>}
        </section>
        <section>
          <h2 className="section-label">Recent call sheets</h2>
          {data.interviews.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Person</th><th>Outcome</th></tr></thead>
                <tbody>
                  {data.interviews.slice(0, 5).map((item) => {
                    const outcome = !item.interested ? "Not interested" : item.confirmed ? "Booked" : "Screened";
                    return (
                      <tr key={item.id}>
                        <td className="name">{item.candidate_name}<div className="quiet">{item.job_title}</div></td>
                        <td>{outcome}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="empty">No calls filed. The call sheet is the shortest way to start.</p>}
        </section>
      </div>
    </>
  );
}

function Roles({ data, filter, setFilter, matches, editor, setEditor, actions, submitJson }) {
  const rows = data.jobs.filter((job) => matches([job.title, job.department, job.location, job.description, job.status]));
  const job = editor?.kind === "role" ? editor.record || {} : null;

  async function onSubmit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    const path = job?.id ? `/api/jobs/${job.id}` : "/api/jobs";
    await submitJson(path, job?.id ? "PUT" : "POST", body, job?.id ? "Role updated." : "Role added.");
  }

  return (
    <>
      <div className="toolbar">
        <button className="btn" type="button" onClick={() => setEditor({ kind: "role", record: null })}>Add a role</button>
        <input className="filter" type="search" placeholder="Filter roles" value={filter} onChange={(event) => setFilter(event.target.value)} />
      </div>
      {job && (
        <form className="sheet" key={job.id || "new"} onSubmit={onSubmit}>
          <h2>{job.id ? "Edit role" : "New role"}</h2>
          <div className="fields">
            <Field label="Title"><input name="title" defaultValue={job.title || ""} required /></Field>
            <Field label="Department"><input name="department" defaultValue={job.department || ""} placeholder="Engineering" /></Field>
            <Field label="Location"><input name="location" defaultValue={job.location || ""} placeholder="Bengaluru / Hybrid" /></Field>
            <Field label="Status">
              <select name="status" defaultValue={job.status || "open"}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="What the work is" wide><textarea name="description" defaultValue={job.description || ""} required /></Field>
            <Field label="What you need" wide><textarea name="requirements" defaultValue={job.requirements || ""} required /></Field>
          </div>
          <div className="actions">
            <button className="btn" type="submit">Save role</button>
            <button className="btn ghost" type="button" onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </form>
      )}
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Role</th><th>Where</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="name">{item.title}</div>
                    <div className="quiet clamp">{item.department || item.description}</div>
                  </td>
                  <td>{item.location || "—"}</td>
                  <td className={`status ${item.status}`}>{item.status === "closed" ? "Closed" : "Open"}</td>
                  <td className="row-actions">{actions("role", item.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty">{data.jobs.length ? "Nothing matches that filter." : "No roles yet. Add the first one before you book anyone against it."}</p>}
    </>
  );
}

function People({ data, filter, setFilter, matches, actions, setError }) {
  const rows = data.candidates.filter((person) => matches([person.name, person.phone, person.email, person.status]));

  return (
    <>
      <div className="toolbar">
        <input className="filter" type="search" placeholder="Filter people" value={filter} onChange={(event) => setFilter(event.target.value)} />
      </div>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Experience</th><th>Notice</th><th>Pay</th><th>Resume</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="name">{item.name}</div>
                    <div className="quiet">{item.phone}{item.email ? ` · ${item.email}` : ""}</div>
                  </td>
                  <td>{years(item.experience_years)}</td>
                  <td>{days(item.notice_period)}</td>
                  <td>{lpa(item.current_ctc)} <span className="quiet">→ {lpa(item.expected_ctc)}</span></td>
                  <td>
                    {item.has_resume ? (
                      <button type="button" className="linkish" onClick={() => openFile(`/api/candidates/${item.id}/resume`).catch((err) => setError(err.message))}>{item.resume_name}</button>
                    ) : "—"}
                  </td>
                  <td className={`status ${item.status}`}>{personLabel[item.status] || item.status}</td>
                  <td className="row-actions">{actions("person", item.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="empty">{data.candidates.length ? "Nothing matches that filter." : "No one has saved their details yet. Add them on Team, then they fill this in after they sign in."}</p>}
    </>
  );
}

function Calendar({ data, actions, setError, setFlash, loadAll }) {
  const [talkId, setTalkId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [pickedId, setPickedId] = useState(null);
  const [nextTime, setNextTime] = useState("");
  const [moving, setMoving] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const rows = data.appointments;
  const byDay = new Map();
  rows.forEach((item) => {
    const key = dayKey(item.date_time);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(item);
  });
  const cells = monthCells(cursor);
  const todayKey = dayKey(new Date());
  const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(cursor);
  const talking = data.appointments.find((item) => item.candidate_id === talkId);
  const editing = data.appointments.find((item) => item.id === editId);
  const picked = rows.find((item) => item.id === pickedId);

  function localInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function shiftMonth(step) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + step, 1));
  }

  async function saveChange(event) {
    event.preventDefault();
    setMoving(true);
    setError("");
    try {
      const saved = await api(`/api/appointments/${editId}`, {
        method: "PUT",
        body: JSON.stringify({ date_time: new Date(nextTime).toISOString() }),
      });
      setEditId(null);
      if (saved.notice === "no-account") {
        setFlash("Time updated. This person has no account, so the notice cannot reach them.");
      } else if (saved.notice === "failed") {
        setFlash("Time updated. The notice could not be delivered.");
      } else {
        setFlash("Time updated. The candidate has a notice in Messages.");
      }
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setMoving(false);
    }
  }

  return (
    <>
      {editing && (
        <section className="sheet">
          <h2>Move {editing.candidate_name}</h2>
          <p>Booked for {when(editing.date_time)}. The new time is sent to their Messages.</p>
          <form onSubmit={saveChange}>
            <label>
              New time
              <TimeField value={nextTime} onChange={setNextTime} label="New time" />
            </label>
            <div className="actions">
              <button className="btn" type="submit" disabled={moving}>{moving ? "Moving…" : "Move and notify"}</button>
              <button className="btn ghost" type="button" onClick={() => setEditId(null)}>Cancel</button>
            </div>
          </form>
        </section>
      )}
      {talking && (
        <section className="sheet">
          <h2>Write to {talking.candidate_name}</h2>
          <p>If {when(talking.date_time)} is not right, say so and suggest another time. They can accept it from their account.</p>
          <Thread path={`/api/messages/${talking.candidate_id}`} canSuggest />
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setTalkId(null)}>Close</button>
          </div>
        </section>
      )}
      <div className="month-bar">
        <button type="button" className="btn ghost" onClick={() => shiftMonth(-1)}>Previous</button>
        <MonthJump cursor={cursor} onChange={setCursor} />
        <div className="month-jump">
          <button type="button" className="btn ghost" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>This month</button>
          <button type="button" className="btn ghost" onClick={() => shiftMonth(1)}>Next</button>
        </div>
      </div>
      <div className="month-scroll">
        <div className="month-grid" role="grid" aria-label={monthName}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
            <div className="dow" key={name} role="columnheader">{name}</div>
          ))}
          {cells.map((date) => {
            const key = dayKey(date);
            const bookings = byDay.get(key) || [];
            const outside = date.getMonth() !== cursor.getMonth();
            return (
              <div
                className={`day-cell${outside ? " outside" : ""}${key === todayKey ? " today" : ""}`}
                key={key}
                role="gridcell"
              >
                <span className="day-num">{date.getDate()}</span>
                {bookings.map((booking) => (
                  <button
                    type="button"
                    className={`slot${pickedId === booking.id ? " on" : ""} ${booking.status}`}
                    key={booking.id}
                    onClick={() => { setPickedId(booking.id); setTalkId(null); }}
                  >
                    <strong>{clock(booking.date_time)}</strong>
                    <span>{booking.candidate_name}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {picked && (
        <section className="sheet picked">
          <h2>{picked.candidate_name}</h2>
          <p>{when(picked.date_time)} · {picked.job_title} · {bookingLabel[picked.status] || picked.status}</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => { setTalkId(null); setEditId(picked.id); setNextTime(localInput(picked.date_time)); }}>Change</button>
            <button type="button" className="btn ghost" onClick={() => { setEditId(null); setTalkId(picked.candidate_id); }}>Write</button>
            {actions("booking", picked.id)}
          </div>
        </section>
      )}
      {!rows.length && <p className="empty">No times yet. They appear on the day a candidate confirms.</p>}
    </>
  );
}

function CallSheet({ data }) {
  const rows = data.interviews || [];
  if (!rows.length) {
    return <p className="empty">Nothing filed yet. A candidate’s answers show up here after they finish the spoken interview.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Person</th><th>Role</th><th>Interest</th><th>Notice</th><th>Pay</th><th>Time</th></tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <Fragment key={item.id}>
              <tr key={item.id}>
                <td className="name">{item.candidate_name || "—"}</td>
                <td>{item.job_title || "—"}</td>
                <td>{item.interested ? "Interested" : "Not now"}</td>
                <td>{days(item.notice_period)}</td>
                <td>{lpa(item.current_ctc)} <span className="quiet">→ {lpa(item.expected_ctc)}</span></td>
                <td>{item.confirmed && item.available_date ? when(item.available_date) : "No time yet"}{item.notes ? <div className="quiet">{item.notes}</div> : null}</td>
              </tr>
              {(item.turns || []).length ? (
                <tr key={`${item.id}-said`}>
                  <td colSpan={6}>
                    {(item.turns || []).map((turn, index) => (
                      <article className="note-line" key={`${item.id}-${index}`}>
                        <p className="note-meta">Desk</p>
                        <p>{turn.prompt}</p>
                        <p className="note-meta">They said</p>
                        <p>{turn.answer || "—"}</p>
                        {turn.has_audio && <Clip path={`/api/interviews/${item.id}/turns/${index}/audio`} />}
                      </article>
                    ))}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
