import { useEffect, useState } from "react";
import MonthJump from "./MonthJump";

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

function parseLocal(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toLocalInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function hourLabel(hour) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric" }).format(date);
}

const HOURS = Array.from({ length: 12 }, (_, index) => index + 8);
const MINUTES = [0, 15, 30, 45];

export default function TimeField({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const current = parseLocal(value);
  const [cursor, setCursor] = useState(() => new Date(current.getFullYear(), current.getMonth(), 1));
  const [day, setDay] = useState(current);
  const [hour, setHour] = useState(current.getHours());
  const [minute, setMinute] = useState(current.getMinutes());

  function openModal() {
    const next = parseLocal(value);
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    setDay(next);
    setHour(next.getHours());
    setMinute(MINUTES.includes(next.getMinutes()) ? next.getMinutes() : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function useTime() {
    const next = new Date(day);
    next.setHours(Number(hour), Number(minute), 0, 0);
    onChange(toLocalInput(next));
    setOpen(false);
  }

  const shown = value
    ? new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(parseLocal(value))
    : "Choose a date and time";
  const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(cursor);
  const todayKey = dayKey(new Date());
  const chosenKey = dayKey(day);
  const minutes = MINUTES.includes(minute) ? MINUTES : [minute, ...MINUTES].sort((left, right) => left - right);

  return (
    <>
      <button type="button" className="time-bar" onClick={openModal}>
        <span>{shown}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="1.5" />
          <path d="M8 3.5v3M16 3.5v3M4 10h16" />
        </svg>
      </button>
      <input type="hidden" name="new-time" value={value} required />
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={label || "Choose a time"} onClick={(event) => event.stopPropagation()}>
            <div className="month-bar">
              <button type="button" className="btn ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Previous</button>
              <MonthJump cursor={cursor} onChange={setCursor} />
              <button type="button" className="btn ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next</button>
            </div>
            <div className="month-grid picker-grid" role="grid" aria-label={monthName}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
                <div className="dow" key={name}>{name}</div>
              ))}
              {monthCells(cursor).map((date) => {
                const key = dayKey(date);
                const outside = date.getMonth() !== cursor.getMonth();
                return (
                  <button
                    type="button"
                    className={`day-cell${outside ? " outside" : ""}${key === todayKey ? " today" : ""}${key === chosenKey ? " chosen" : ""}`}
                    key={key}
                    onClick={() => setDay(date)}
                  >
                    <span className="day-num">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
            <div className="pick-time">
              <label>
                Hour
                <select value={hour} onChange={(event) => setHour(Number(event.target.value))}>
                  {HOURS.map((item) => <option key={item} value={item}>{hourLabel(item)}</option>)}
                </select>
              </label>
              <label>
                Minute
                <select value={minute} onChange={(event) => setMinute(Number(event.target.value))}>
                  {minutes.map((item) => <option key={item} value={item}>{String(item).padStart(2, "0")}</option>)}
                </select>
              </label>
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={useTime}>Use this time</button>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
