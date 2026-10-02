import { useEffect, useRef, useState } from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FIRST_YEAR = 1970;
const LAST_YEAR = 2055;

function YearMenu({ year, onPick }) {
  const [open, setOpen] = useState(false);
  const list = useRef(null);
  const years = [];
  const start = Math.min(FIRST_YEAR, year);
  const end = Math.max(LAST_YEAR, year);
  for (let item = start; item <= end; item += 1) years.push(item);

  useEffect(() => {
    if (!open || !list.current) return;
    const current = list.current.querySelector("[aria-selected='true']");
    current?.scrollIntoView({ block: "center" });
  }, [open]);

  return (
    <div className="year-menu">
      <button type="button" className="year-face" aria-expanded={open} aria-label="Year" onClick={() => setOpen((value) => !value)}>
        {year}
      </button>
      {open && (
        <ul className="year-list" ref={list} role="listbox" aria-label="Year">
          {years.map((item) => (
            <li key={item}>
              <button
                type="button"
                role="option"
                aria-selected={item === year}
                className={item === year ? "on" : ""}
                onClick={() => {
                  onPick(item);
                  setOpen(false);
                }}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MonthJump({ cursor, onChange }) {
  const [open, setOpen] = useState(false);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const label = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(cursor);

  if (!open) {
    return (
      <button type="button" className="month-title" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <div className="month-pick">
      <select
        aria-label="Month"
        value={month}
        onChange={(event) => onChange(new Date(year, Number(event.target.value), 1))}
      >
        {MONTHS.map((name, index) => (
          <option key={name} value={index}>{name}</option>
        ))}
      </select>
      <YearMenu year={year} onPick={(next) => onChange(new Date(next, month, 1))} />
      <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Done</button>
    </div>
  );
}
