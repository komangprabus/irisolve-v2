import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthError, fetchLatestImport, fetchTasks, logout as apiLogout, restoreSession } from "./services/api";
import Login from "./pages/Login";
import Timeline from "./pages/Timeline";
import TugasSaya from "./pages/TugasSaya";
import RingkasanGM from "./pages/RingkasanGM";
import ImportDialog from "./components/ImportDialog";
import "./pages.css";

const TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "tugas-saya", label: "Tugas saya" },
  { id: "beban-kerja", label: "Beban kerja", badge: "Sprint 2" },
  { id: "konflik", label: "Konflik", badge: "Sprint 2" },
  { id: "what-if", label: "What-if", badge: "Sprint 2–3" },
  { id: "ringkasan-gm", label: "Ringkasan GM" },
];
const PLACEHOLDERS = ["beban-kerja", "konflik", "what-if"];

function Placeholder({ label, badge }) {
  return (
    <>
      <h1>{label}</h1>
      <div className="state">Halaman ini tersedia di {badge || "sprint berikutnya"}.</div>
    </>
  );
}

const roleLabel = (u) =>
  u.role === "gm" ? "General Manager" : u.role === "koordinator" ? `Koordinator ${u.division}` : `${u.picName ?? "Staff"} · ${u.division}`;

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = sedang dicek, null = belum login
  const [tab, setTab] = useState("timeline");
  const [tasks, setTasks] = useState([]);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { restoreSession().then(setSession).catch(() => setSession(null)); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [t, i] = await Promise.all([fetchTasks(), fetchLatestImport().catch(() => [])]);
      setTasks(t);
      setImports(i);
    } catch (e) {
      if (e instanceof AuthError) setSession(null);
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (session) load(); }, [session, load]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  if (session === undefined) return <div className="page"><div className="state">Memuat…</div></div>;
  if (session === null) return <Login onLogin={(s) => { setTab("timeline"); setSession(s); }} />;

  const tabs = TABS.filter((t) => session.menu.includes(t.id));
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];
  const lastImport = imports.length ? new Date(Math.max(...imports.map((i) => i.importedAt))) : null;
  const canImport = session.menu.includes("import-csv");
  const signOut = () => { apiLogout(); setTasks([]); setSession(null); };

  let body;
  if (PLACEHOLDERS.includes(active.id)) body = <Placeholder label={active.label} badge={active.badge} />;
  else if (error)
    body = (
      <div className="state error">
        <p>{error}. Cek apakah backend sudah jalan atau alamat API sudah benar.</p>
        <button className="btn" onClick={load}>Coba lagi</button>
      </div>
    );
  else if (loading) body = <div className="state">Memuat tugas…</div>;
  else if (active.id === "timeline")
    body = <Timeline tasks={tasks} today={today} lastImport={lastImport} onImport={canImport ? () => setShowImport(true) : null} />;
  else if (active.id === "tugas-saya") body = <TugasSaya tasks={tasks} today={today} user={session.user} />;
  else body = <RingkasanGM tasks={tasks} today={today} />;

  return (
    <div className="page">
      <nav className="topnav">
        <span className="brand">IRISolve</span>
        {tabs.map((t) => (
          <button key={t.id} className={`navbtn ${active.id === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.badge && <span className="navbadge">{t.badge}</span>}
          </button>
        ))}
        <span className="who">{roleLabel(session.user)}</span>
        <button className="btn ghost" onClick={signOut}>Keluar</button>
      </nav>
      {body}
      {showImport && <ImportDialog role={session.user.role} onClose={() => setShowImport(false)} onDone={load} />}
    </div>
  );
}
