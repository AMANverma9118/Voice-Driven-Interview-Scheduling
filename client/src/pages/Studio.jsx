import { useRef, useState } from "react";
import { api } from "../api";
import { useSettings } from "../settings";

export default function Studio() {
  const { settings, setSettings } = useSettings();
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  if (!settings) return <p className="loading">Loading the studio…</p>;

  function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const logo = String(reader.result || "");
      if (logo.length > 1_500_000) {
        setError("That image is too large. Use one under about 1 MB.");
        return;
      }
      setSettings({ ...settings, logo });
      setError("");
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.target);
    try {
      const saved = await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          companyName: form.get("companyName"),
          logo: settings.logo,
          paper: form.get("paper"),
          ink: form.get("ink"),
          brick: form.get("brick"),
          rail: form.get("rail"),
        }),
      });
      setSettings(saved);
      setFlash("The desk look is saved. Candidates hear this name.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sheet studio" onSubmit={onSubmit}>
      {error && <div className="banner" role="alert">{error}</div>}
      {flash && <div className="flash" role="status">{flash}</div>}
      <div className="fields">
        <div className="span-2">
          <label>
            Name candidates hear
            <input name="companyName" defaultValue={settings.companyName} required />
          </label>
        </div>
        <div className="span-2">
          <span className="field-label">Logo</span>
          <div className="logo-row">
            {settings.logo ? <img className="logo-preview" src={settings.logo} alt="" /> : <span className="quiet">No logo yet</span>}
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} />
            {settings.logo && (
              <button type="button" className="btn ghost" onClick={() => setSettings({ ...settings, logo: "" })}>Remove</button>
            )}
          </div>
        </div>
        <label>Page<input type="color" name="paper" defaultValue={settings.paper} /></label>
        <label>Type<input type="color" name="ink" defaultValue={settings.ink} /></label>
        <label>Accent<input type="color" name="brick" defaultValue={settings.brick} /></label>
        <label>Sidebar<input type="color" name="rail" defaultValue={settings.rail} /></label>
      </div>
      <div className="actions">
        <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save look"}</button>
      </div>
    </form>
  );
}
