import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { homeFor } from "../home";
import { useAuth } from "../auth";
import { Brand } from "../settings";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const TURNS = [
  { day: 3, clock: "11:00 am", said: "Thursday at eleven." },
  { day: 1, clock: "4:00 pm", said: "Tuesday at four." },
  { day: 4, clock: "10:30 am", said: "Friday at half past ten." },
];

export default function Home() {
  const { user } = useAuth();
  const enter = user ? homeFor(user) : "/login";
  const [step, setStep] = useState(0);
  const turn = TURNS[step];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return undefined;
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % TURNS.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="home">
      <header className="home-bar">
        <Brand to="/" />
        <nav>
          {user ? (
            <Link className="btn" to={enter}>Open the desk</Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link className="btn" to="/register">Create an account</Link>
            </>
          )}
        </nav>
      </header>
      <main className="home-main">
        <p className="kicker home-kicker">Voice-driven hiring</p>
        <h1>The desk asks, listens, and books the hour.</h1>
        <p className="lede">A candidate speaks the interview. The recording stays. The time they say is the time that lands on the book.</p>
        <div className="home-actions">
          <Link className="btn" to={user ? enter : "/register"}>{user ? "Open the desk" : "Start an account"}</Link>
          {!user && <Link className="btn ghost" to="/login">Sign in</Link>}
        </div>
        <section className="home-stage" aria-label="A sample of the spoken interview">
          <div className="home-sheet">
            <p className="home-folio">A sample call</p>
            <p className="home-who">Desk</p>
            <p className="home-ask">Which day and time next week?</p>
            <div className="home-heard" key={turn.said}>
              <p className="home-who">They said</p>
              <p className="home-said">{turn.said}</p>
              <div className="home-wave" aria-hidden="true">
                <span /><span /><span /><span /><span />
              </div>
            </div>
          </div>
          <div className="home-book">
            <p className="home-folio">On the book</p>
            <div className="home-week">
              {DAYS.map((name, index) => (
                <div className={index === turn.day ? "home-day on" : "home-day"} key={name}>
                  <span>{name}</span>
                  {index === turn.day && <strong key={turn.clock}>{turn.clock}</strong>}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
