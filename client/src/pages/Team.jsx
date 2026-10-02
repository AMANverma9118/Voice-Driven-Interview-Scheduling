import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Team() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  function load() {
    return api("/api/users").then(setPeople).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

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

  return (
    <>
      {error && <div className="banner" role="alert">{error}</div>}
      {flash && <div className="flash" role="status">{flash}</div>}
      <div className="toolbar">
        <button className="btn" type="button" onClick={() => setAdding((open) => !open)}>Add a person</button>
      </div>
      {adding && (
        <form className="sheet" onSubmit={addPerson}>
          <h2>New account</h2>
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
            <button className="btn" type="submit">Save on team</button>
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
                  {person.role === "admin" ? (
                    <button type="button" className="linkish" onClick={() => change(person.id, { role: "candidate" }, `${person.name} is a candidate now.`)}>Make candidate</button>
                  ) : (
                    <button type="button" className="linkish" onClick={() => change(person.id, { role: "admin" }, `${person.name} is an admin now.`)}>Make admin</button>
                  )}
                  {person.id !== user?.id && (
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
