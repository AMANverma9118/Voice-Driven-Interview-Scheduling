import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { useSettings } from "../settings";
import Recaptcha from "../components/Recaptcha";
import { Brand } from "../settings";
import { CaptchaNote, useSiteKey } from "./Account";

export default function Join() {
  const { slug } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const { refresh } = useSettings();
  const { siteKey, error: configError } = useSiteKey();
  const captcha = useRef(null);
  const [company, setCompany] = useState(null);
  const [missing, setMissing] = useState(false);
  const [mode, setMode] = useState("signup");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (slug) sessionStorage.setItem("desk_company", slug);
    if (search.get("in") === "1") setMode("login");
    api(`/api/join/${slug}`)
      .then(setCompany)
      .catch(() => setMissing(true));
  }, [slug, search]);

  async function enter(data) {
    signIn(data.token, data.user);
    await refresh();
    navigate("/interview");
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.target);
    if (mode === "signup" && form.get("password") !== form.get("confirm")) {
      setError("Those passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const path = mode === "signup" ? "register" : "login";
      const data = await api(`/api/join/${slug}/${path}`, {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          phone: form.get("phone"),
          captchaToken: token,
        }),
      });
      await enter(data);
    } catch (err) {
      setError(err.message);
      captcha.current?.reset();
      setToken("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <aside className="rail">
        <Brand to={`/join/${slug}`} />
        <p className="rail-foot">This page is for one company. Signing up here keeps you on this company’s book.</p>
      </aside>
      <main>
        {missing && <h1>That company link is not valid</h1>}
        {!missing && !company && <p className="loading">Opening the company page…</p>}
        {company && (
          <>
            <p className="kicker">{company.name}</p>
            <h1>{mode === "signup" ? "Sign up for the interview" : "Sign in"}</h1>
            <p className="lede">
              {mode === "signup"
                ? `Create your account for ${company.name}, then choose a time. This does not add you to any other company.`
                : `Sign in to the ${company.name} interview.`}
            </p>
            {user?.companySlug === company.slug && (
              <p className="note">You are already signed in for {company.name}. <Link to="/interview">Schedule the interview</Link></p>
            )}
            <div className="gate-switch">
              <button type="button" className={mode === "signup" ? "is-active" : ""} onClick={() => { setMode("signup"); navigate(`/join/${slug}`, { replace: true }); }}>Sign up</button>
              <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); navigate(`/join/${slug}?in=1`, { replace: true }); }}>Sign in</button>
            </div>
            {(error || configError) && <div className="banner" role="alert">{error || configError}</div>}
            <form className="gate-form" onSubmit={onSubmit}>
              {mode === "signup" && <label>Name<input name="name" required autoComplete="name" /></label>}
              <label>Email<input name="email" type="email" required autoComplete="email" /></label>
              {mode === "signup" && <label>Phone<input name="phone" required autoComplete="tel" /></label>}
              <label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>
              {mode === "signup" && <label>Confirm password<input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>}
              <Recaptcha ref={captcha} siteKey={siteKey} onToken={setToken} />
              <CaptchaNote siteKey={siteKey} />
              <div className="actions">
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? "Saving…" : mode === "signup" ? "Create account" : "Sign in"}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
