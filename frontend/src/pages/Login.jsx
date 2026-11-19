import { useState } from "react";
import { login } from "../services/api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(await login(username.trim(), password));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page loginwrap">
      <form className="panel loginbox" onSubmit={submit}>
        <span className="brand">IRISolve</span>
        <h1>Masuk</h1>
        <p className="muted">Gunakan akun yang diberikan koordinator atau GM.</p>
        <label>Username
          <input className="control" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label>Password
          <input className="control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="late" role="alert">{error}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Masuk…" : "Masuk"}</button>
      </form>
    </div>
  );
}
