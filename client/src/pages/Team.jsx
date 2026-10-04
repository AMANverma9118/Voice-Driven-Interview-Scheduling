import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Team() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addingCompany, setAddingCompany] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  function load() {
    const tasks = [api("/api/users").then(setPeople)];
    if (user?.platform) tasks.push(api("/api/companies").then(setCompanies));
    return Promise.all(tasks).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [user?.platform]);

  async function change(id, body, message) {
    setError("");
    try {
      await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setFlash(message);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeCompany(id, body, message) {
    setError("");
    try {
      await api(`/api/companies/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setFlash(message);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addPerson(event) {
    event.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(body) });
      setFlash(`${body.name} can sign in and fill in their own details.`);
      event.target.reset();
      setAdding(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addCompany(event) {
    event.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api("/api/companies", { method: "POST", body: JSON.stringify(body) });
      setFlash(`${body.name} can sign in as the admin for ${body.companyName}.`);
      event.target.reset();
      setAddingCompany(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function shareUrl(slug) {
    return `${window.location.origin}/join/${slug}`;
  }

  async function copyLink(slug) {
    const url = shareUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      setFlash("Link copied. Anyone who opens it signs up for that company only.");
    } catch (err) {
      setFlash(url);
    }
  }

  return (
    <>
      {error && <div className="banner" role="alert">{error}</div>}
      {flash && <div className="flash" role="status">{flash}</div>}
      {user?.companySlug && (
        <form className="sheet" onSubmit={(event) => event.preventDefault()}>
          <h2>Candidate link</h2>
          <p className="quiet">Share this on LinkedIn or anywhere else. People who open it sign up for this company, then book their interview. Another company’s link keeps its own people.</p>
          <div className="fields">
            <label className="span-2">
              Link
              <input readOnly value={shareUrl(user.companySlug)} onFocus={(event) => event.target.select()} />
            </label>
          </div>
          <div className="actions">
            <button className="btn" type="button" onClick={() => copyLink(user.companySlug)}>Copy link</button>
          </div>
        </form>
      )}
      {user?.platform && (
        <>
          <div className="toolbar">
            <button className="btn" type="button" onClick={() => setAddingCompany((open) => !open)}>Add a company admin</button>
          </div>
          {addingCompany && (
            <form className="sheet" onSubmit={addCompany}>
              <h2>New company</h2>
              <div className="fields">
                <label className="span-2">
                  Company
                  <input name="companyName" required />
                </label>
                <label>
                  Admin name
                  <input name="name" required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label className="span-2">
                  Password
                  <input name="password" type="password" required minLength={8} />
                </label>
              </div>
              <div className="actions">
                <button className="btn" type="submit">Create the admin</button>
                <button className="btn ghost" type="button" onClick={() => setAddingCompany(false)}>Cancel</button>
              </div>
            </form>
          )}
          {companies.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Company</th><th>Admin</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id}>
                      <td>{company.company}</td>
                      <td>
                        <div className="name">{company.name}</div>
                        <div className="quiet">{company.email}</div>
                      </td>
                      <td className={company.revoked ? "status cancelled" : "status open"}>{company.revoked ? "Revoked" : "Active"}</td>
                      <td className="row-actions">
                        {company.slug && (
                          <button type="button" className="linkish" onClick={() => copyLink(company.slug)}>Copy link</button>
                        )}
                        {company.revoked ? (
                          <button type="button" className="linkish" onClick={() => changeCompany(company.id, { revoked: false }, `${company.name} can sign in again.`)}>Restore</button>
                        ) : (
                          <button type="button" className="linkish" onClick={() => changeCompany(company.id, { revoked: true }, `${company.name} can no longer sign in.`)}>Revoke</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <div className="toolbar">
        <button className="btn" type="button" onClick={() => setAdding((open) => !open)}>Add a candidate</button>
      </div>
      {adding && (
        <form className="sheet" onSubmit={addPerson}>
          <h2>New candidate</h2>
          <div className="fields">
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label className="span-2">
              Password
              <input name="password" type="password" required minLength={8} />
            </label>
          </div>
          <div className="actions">
            <button className="btn" type="submit">Save on the team</button>
            <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Person</th><th>Role</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td>
                  <div className="name">{person.name}</div>
                  <div className="quiet">{person.email}</div>
                </td>
                <td>{person.role === "admin" ? "Admin" : "Candidate"}</td>
                <td className={person.revoked ? "status cancelled" : "status open"}>{person.revoked ? "Revoked" : "Active"}</td>
                <td className="row-actions">
                  {person.id !== user?.id && person.role !== "admin" && (
                    person.revoked ? (
                      <button type="button" className="linkish" onClick={() => change(person.id, { revoked: false }, `${person.name} can sign in again.`)}>Restore</button>
                    ) : (
                      <button type="button" className="linkish" onClick={() => change(person.id, { revoked: true }, `${person.name} can no longer sign in.`)}>Revoke</button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
