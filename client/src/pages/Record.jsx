import { useEffect, useState } from "react";
import { api } from "../api";
import CandidateFrame from "../components/CandidateFrame";
import Clip from "../components/Clip";

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

export default function Record() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/interviews/mine")
      .then(setRows)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <CandidateFrame>
        <p className="kicker">Your interview</p>
        <h1>What you said</h1>
        <p className="lede">Each question, your answer, and the recording of your voice.</p>
        {error && <div className="banner" role="alert">{error}</div>}
        {rows.length ? rows.map((item) => (
          <section className="sheet" key={item.id}>
            <h2>{item.job_title || "Interview"}</h2>
            <p className="quiet">{item.confirmed && item.available_date ? `Booked for ${when(item.available_date)}` : "No time booked yet"}</p>
            {(item.turns || []).length ? item.turns.map((turn, index) => (
              <article className="note-line" key={`${item.id}-${index}`}>
                <p className="note-meta">Desk</p>
                <p>{turn.prompt}</p>
                <p className="note-meta">You</p>
                <p>{turn.answer || "—"}</p>
                {turn.has_audio && <Clip path={`/api/interviews/mine/${item.id}/turns/${index}/audio`} />}
              </article>
            )) : <p>This interview was filed without a recording.</p>}
          </section>
        )) : <p className="empty">Finish the spoken interview and your words will be kept here.</p>}
    </CandidateFrame>
  );
}
