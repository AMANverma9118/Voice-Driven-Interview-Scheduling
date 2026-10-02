import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import CandidateFrame from "../components/CandidateFrame";
import { openFile } from "../openFile";

const empty = {
  name: "",
  phone: "",
  email: "",
  experience_years: "",
  notice_period: "",
  current_ctc: "",
  expected_ctc: "",
};

function valueOf(record, key) {
  const value = record?.[key];
  return value === null || value === undefined ? "" : value;
}

function show(value) {
  if (value === "" || value === null || value === undefined) return "—";
  return String(value);
}

function readResume(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error("The resume must be under 4 MB"));
      return;
    }
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext)) {
      reject(new Error("Upload a PDF or Word resume"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve({ name: file.name, type: file.type, data: result.split(",")[1] || "" });
    };
    reader.onerror = () => reject(new Error("That resume could not be read"));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState(empty);
  const [savedForm, setSavedForm] = useState(empty);
  const [resumeName, setResumeName] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [dropResume, setDropResume] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  function fill(record) {
    const next = {
      name: record?.name || user?.name || "",
      phone: valueOf(record, "phone"),
      email: record?.email || user?.email || "",
      experience_years: valueOf(record, "experience_years"),
      notice_period: valueOf(record, "notice_period"),
      current_ctc: valueOf(record, "current_ctc"),
      expected_ctc: valueOf(record, "expected_ctc"),
    };
    setForm(next);
    setSavedForm(next);
    setResumeName(record?.resume_name || "");
    setResumeFile(null);
    setDropResume(false);
    setSaved(Boolean(record?.phone));
    setEditing(!record?.phone);
  }

  useEffect(() => {
    api("/api/me/profile")
      .then((record) => {
        fill(record);
        setNotice("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setReady(true));
  }, [user]);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function pickResume(event) {
    setError("");
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setResumeFile(await readResume(file));
      setDropResume(false);
    } catch (err) {
      setResumeFile(null);
      setError(err.message);
    }
  }

  function cancelEdit() {
    setForm(savedForm);
    setResumeFile(null);
    setDropResume(false);
    setEditing(false);
    setError("");
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = { ...form };
      if (resumeFile) payload.resume = resumeFile;
      else if (dropResume) payload.resume = null;
      const savedRecord = await api("/api/me/profile", { method: "PUT", body: JSON.stringify(payload) });
      fill(savedRecord);
      setEditing(false);
      setNotice("Saved. The admin can see this on People.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const shownResume = dropResume ? "" : (resumeFile?.name || resumeName);

  return (
    <CandidateFrame>
      <p className="kicker">Your file</p>
      <h1>Tell the desk about you</h1>
      <p className="lede">This is the same file the admin sees under People. A name and a phone number are enough to start.</p>
      {error && <div className="banner" role="alert">{error}</div>}
      {notice && <div className="flash" role="status">{notice}</div>}
      {ready && !editing && (
        <section className="sheet">
          <div className="sheet-head">
            <h2>Your details</h2>
            <button type="button" className="btn" onClick={() => setEditing(true)}>Edit</button>
          </div>
          <dl className="file-facts">
            <div><dt>Name</dt><dd>{show(form.name)}</dd></div>
            <div><dt>Phone</dt><dd>{show(form.phone)}</dd></div>
            <div className="span-2"><dt>Email</dt><dd>{show(form.email)}</dd></div>
            <div><dt>Experience</dt><dd>{form.experience_years === "" ? "—" : `${form.experience_years} years`}</dd></div>
            <div><dt>Notice</dt><dd>{form.notice_period === "" ? "—" : `${form.notice_period} days`}</dd></div>
            <div><dt>Current CTC</dt><dd>{form.current_ctc === "" ? "—" : `${form.current_ctc} LPA`}</dd></div>
            <div><dt>Expected CTC</dt><dd>{form.expected_ctc === "" ? "—" : `${form.expected_ctc} LPA`}</dd></div>
            <div className="span-2">
              <dt>Resume</dt>
              <dd>
                {resumeName ? (
                  <button type="button" className="linkish" onClick={() => openFile("/api/me/resume").catch((err) => setError(err.message))}>{resumeName}</button>
                ) : "None yet"}
              </dd>
            </div>
          </dl>
          {saved && (
            <div className="actions">
              <NavLink className="btn ghost" to="/interview">Start the interview</NavLink>
            </div>
          )}
        </section>
      )}
      {ready && editing && (
        <form className="sheet" onSubmit={onSubmit}>
          <h2>Your details</h2>
          <div className="fields">
            <label>
              Name
              <input name="name" value={form.name} onChange={update} required />
            </label>
            <label>
              Phone
              <input name="phone" value={form.phone} onChange={update} required placeholder="+91 98..." />
            </label>
            <label className="span-2">
              Email
              <input name="email" type="email" value={form.email} onChange={update} />
            </label>
            <label>
              Experience (years)
              <input name="experience_years" type="number" min="0" step="0.5" value={form.experience_years} onChange={update} />
            </label>
            <label>
              Notice (days)
              <input name="notice_period" type="number" min="0" step="1" value={form.notice_period} onChange={update} />
            </label>
            <label>
              Current CTC (LPA)
              <input name="current_ctc" type="number" min="0" step="0.1" value={form.current_ctc} onChange={update} />
            </label>
            <label>
              Expected CTC (LPA)
              <input name="expected_ctc" type="number" min="0" step="0.1" value={form.expected_ctc} onChange={update} />
            </label>
            <label className="span-2">
              Resume
              <input className="file-pick" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={pickResume} />
              <span className="quiet">{shownResume || "PDF or Word, up to 4 MB"}</span>
            </label>
          </div>
          {resumeName && !dropResume && (
            <button type="button" className="linkish" onClick={() => { setDropResume(true); setResumeFile(null); }}>Remove resume</button>
          )}
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save details"}</button>
            {saved && <button className="btn ghost" type="button" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>
      )}
    </CandidateFrame>
  );
}
