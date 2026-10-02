import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { homeFor } from "../home";
import { useAuth } from "../auth";
import Recaptcha from "../components/Recaptcha";
import { Brand } from "../settings";

const TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

function useSiteKey() {
  const [siteKey, setSiteKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/auth/config")
      .then((data) => setSiteKey(data.recaptchaSiteKey || ""))
      .catch((err) => setError(err.message));
  }, []);

  return { siteKey, error };
}

function Gate({ children }) {
  return (
    <div className="gate">
      <aside className="rail">
        <Brand to="/login" />
        <p className="rail-foot">Admins run the desk. Candidates take the spoken interview.</p>
      </aside>
      <main>{children}</main>
    </div>
  );
}

function CaptchaNote({ siteKey }) {
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
  const { signIn } = useAuth();
  const { siteKey, error: configError } = useSiteKey();
  const captcha = useRef(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <Gate>
      <p className="kicker">Sign in</p>
      <h1>Your desk</h1>
      <p className="lede">Roles and interviews on this account are not visible to anyone else.</p>
      <div className="gate-switch">
        <Link to="/login" className="is-active">Sign in</Link>
        <Link to="/register">Create an account</Link>
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
  const navigate = useNavigate();
  const { siteKey, error: configError } = useSiteKey();
  const captcha = useRef(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.target);
    if (form.get("password") !== form.get("confirm")) {
      setError("Those passwords do not match");
      setBusy(false);
      return;
    }
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          captchaToken: token,
        }),
      });
      if (data.verificationUrl) {
        const path = data.verificationUrl.replace(window.location.origin, "") || data.verificationUrl;
        navigate(path.startsWith("/") ? path : `/verify?token=${new URL(data.verificationUrl).searchParams.get("token")}`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
      captcha.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Gate>
      <p className="kicker">Create an account</p>
      <h1>A desk of your own</h1>
      <p className="lede">Create the account, confirm the email, and the desk opens.</p>
      <div className="gate-switch">
        <Link to="/login">Sign in</Link>
        <Link to="/register" className="is-active">Create an account</Link>
      </div>
      {(error || configError) && <div className="banner" role="alert">{error || configError}</div>}
      {result ? (
        <div className="flash">
          <p>{result.message}</p>
          <p>Open the link in that email. Once it confirms, you are taken into the desk.</p>
        </div>
      ) : (
        <form className="gate-form" onSubmit={onSubmit}>
          <label>Name<input name="name" required autoComplete="name" /></label>
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label>Confirm password<input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
          <Recaptcha ref={captcha} siteKey={siteKey} onToken={setToken} />
          <CaptchaNote siteKey={siteKey} />
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
          </div>
        </form>
      )}
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
