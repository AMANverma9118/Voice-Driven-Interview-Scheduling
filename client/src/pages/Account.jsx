import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { homeFor } from "../home";
import { useAuth } from "../auth";
import Recaptcha from "../components/Recaptcha";
import { Brand } from "../settings";

const TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

export function useSiteKey() {
  const [siteKey, setSiteKey] = useState("");
  const [signupSlug, setSignupSlug] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/auth/config")
      .then((data) => {
        setSiteKey(data.recaptchaSiteKey || "");
        setSignupSlug(data.signupSlug || "");
      })
      .catch((err) => setError(err.message));
  }, []);

  return { siteKey, signupSlug, error };
}

function Gate({ children }) {
  return (
    <div className="gate">
      <aside className="rail">
        <Brand to="/login" />
        <p className="rail-foot">The desk owner creates each company admin. That admin adds the people who take the interview.</p>
      </aside>
      <main>{children}</main>
    </div>
  );
}

export function CaptchaNote({ siteKey }) {
  if (siteKey !== TEST_SITE_KEY) return null;
  return (
    <p className="note">
      The checkbox is Google&apos;s public test widget, so it will say it is for testing.
      Replace the keys in .env with your own reCAPTCHA v2 keys before anyone else uses this.
    </p>
  );
}

export function Login() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { signIn } = useAuth();
  const { siteKey, signupSlug, error: configError } = useSiteKey();
  const captcha = useRef(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const desk = search.get("desk") === "1";
  if (desk) sessionStorage.removeItem("desk_company");
  const company = desk ? "" : sessionStorage.getItem("desk_company");

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.target);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          captchaToken: token,
        }),
      });
      signIn(data.token, data.user);
      navigate(homeFor(data.user));
    } catch (err) {
      setError(err.message);
      captcha.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  if (company) return <Navigate to={`/join/${company}?in=1`} replace />;

  return (
    <Gate>
      <p className="kicker">Sign in</p>
      <h1>Your desk</h1>
      <p className="lede">Sign in to the company desk you belong to.</p>
      <div className="gate-switch">
        <Link to="/login" className="is-active">Sign in</Link>
        {signupSlug && <Link to={`/join/${signupSlug}`}>Sign up</Link>}
      </div>
      {(error || configError) && <div className="banner" role="alert">{error || configError}</div>}
      {error.includes("Verify your email") && (
        <p className="note"><Link to="/verify">Open the verification page</Link></p>
      )}
      <form className="gate-form" onSubmit={onSubmit}>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        <Recaptcha ref={captcha} siteKey={siteKey} onToken={setToken} />
        <CaptchaNote siteKey={siteKey} />
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </div>
      </form>
    </Gate>
  );
}

export function Register() {
  const { signupSlug, error } = useSiteKey();
  if (signupSlug) return <Navigate to={`/join/${signupSlug}`} replace />;
  return (
    <Gate>
      <p className="kicker">Sign up</p>
      <h1>{error ? "Signup is not ready" : "Opening signup…"}</h1>
      <p className="lede">{error || "The form opens on the desk owner’s company."}</p>
      <div className="actions">
        <Link className="btn" to="/login">Sign in</Link>
      </div>
    </Gate>
  );
}

export function Verify() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [params] = useSearchParams();
  const { siteKey } = useSiteKey();
  const captcha = useRef(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tokenInput, setTokenInput] = useState(params.get("token") || "");
  const [captchaToken, setCaptchaToken] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  function enterDesk(data) {
    if (data.token && data.user) {
      signIn(data.token, data.user);
      navigate(homeFor(data.user), { replace: true });
      return;
    }
    setMessage(data.message || "Email verified.");
  }

  useEffect(() => {
    const token = params.get("token");
    if (!token || started.current) return;
    started.current = true;
    setBusy(true);
    api("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) })
      .then(enterDesk)
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  }, [params]);

  async function resend(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.target);
    try {
      const data = await api("/api/auth/resend", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), captchaToken }),
      });
      if (data.verificationUrl) {
        const token = new URL(data.verificationUrl).searchParams.get("token");
        navigate(`/verify?token=${token}`);
        return;
      }
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
      captcha.current?.reset();
    }
  }

  return (
    <Gate>
      <p className="kicker">Verification</p>
      <h1>Confirm the email</h1>
      <p className="lede">
        {busy ? "Confirming your email…" : "The link expires after 24 hours. When it works, the desk opens."}
      </p>
      {message && <div className="flash" role="status">{message}</div>}
      {error && <div className="banner" role="alert">{error}</div>}
      {!params.get("token") && !busy && (
        <form className="gate-form" onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          api("/api/auth/verify", { method: "POST", body: JSON.stringify({ token: tokenInput }) })
            .then(enterDesk)
            .catch((err) => setError(err.message))
            .finally(() => setBusy(false));
        }}>
          <label>Verification token<input value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} required /></label>
          <div className="actions">
            <button className="btn" type="submit">Verify and open desk</button>
          </div>
        </form>
      )}
      {!busy && (
        <form className="gate-form" onSubmit={resend}>
          <h2>Send another link</h2>
          <label>Email<input name="email" type="email" required /></label>
          <Recaptcha ref={captcha} siteKey={siteKey} onToken={setCaptchaToken} />
          <div className="actions">
            <button className="btn ghost" type="submit">Resend</button>
          </div>
        </form>
      )}
    </Gate>
  );
}
