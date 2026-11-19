import { useState } from "react";
import { importFile } from "../services/api";

const DIVISIONS = ["Programming", "Mekanik", "Electrical", "AdFin", "DesBrand"];

function Result({ r }) {
  if (r.error) return <p className="late"><b>{r.division}:</b> {r.error}</p>;
  return (
    <div className="result">
      <p>
        <b>{r.division}:</b> {r.succeeded} tugas terbaca ({r.inserted} baru, {r.updated} diperbarui, {r.unchanged} tetap
        {r.removed > 0 && `, ${r.removed} dihapus karena sudah tidak ada di file`}).
        {r.failed > 0 && <> <b className="late">{r.failed} baris gagal.</b></>}
        {r.incomplete > 0 && ` ${r.incomplete} tanggalnya tidak lengkap.`}
        {r.skipped > 0 && ` ${r.skipped} baris contoh dilewati.`}
      </p>
      {r.errors.length > 0 && (
        <ul>{r.errors.map((x) => <li key={x.row}>Baris {x.row}: {x.reason}</li>)}</ul>
      )}
    </div>
  );
}

export default function ImportDialog({ role, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [division, setDivision] = useState(DIVISIONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  const isCsv = file && /\.csv$/i.test(file.name);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = await importFile(file, role === "gm" && isCsv ? division : undefined);
      setResults(data.results);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel modal" role="dialog" aria-modal="true" aria-label="Impor data" onClick={(e) => e.stopPropagation()}>
        <h3>Impor data tracker</h3>
        <p className="muted">
          Pilih file <b>.xlsx</b> (semua tab divisi diimpor sekaligus) atau <b>.csv</b> (satu tab). Kolom dikenali dari
          nama header: Tugas, PIC, Start, Deadline, Progress, dan opsional Brief, Requester, File / Link. Urutan kolom,
          baris judul, dan baris contoh tidak masalah. Tugas yang sudah tidak ada di file ikut dihapus.
        </p>
        <form onSubmit={submit} className="importform">
          <input type="file" accept=".csv,.xlsx" onChange={(e) => { setFile(e.target.files[0] ?? null); setResults(null); setError(""); }} />
          {role === "gm" && isCsv && (
            <select className="control" value={division} onChange={(e) => setDivision(e.target.value)} aria-label="Divisi untuk file CSV">
              {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          )}
          <button className="btn primary" disabled={!file || busy}>{busy ? "Mengimpor…" : "Impor"}</button>
        </form>
        {error && <p className="late" role="alert">{error}</p>}
        {results && <div className="report">{results.map((r) => <Result key={r.division} r={r} />)}</div>}
        <div className="modalfoot"><button className="btn" onClick={onClose}>Tutup</button></div>
      </div>
    </div>
  );
}
