import { useMemo, useState } from "react";
import { daysLate, fmtDate, isActive, isIncomplete, slug } from "../utils";

function Row({ t, who, today }) {
  const late = isActive(t) ? daysLate(t, today) : 0;
  const others = t.pic.filter((p) => p !== who);
  return (
    <tr>
      <td>
        <strong>{t.nama}</strong>
        <div className={`brief ${t.brief ? "" : "empty"}`}>{t.brief ?? "Belum ada keterangan"}</div>
      </td>
      <td>{t.divisi}</td>
      <td>
        {t.deadline ? (
          <>
            {fmtDate(t.deadline)}
            {late > 0 && <span className="late"> · lewat {late} hari</span>}
          </>
        ) : (
          <span className="chip warn">Tanpa tanggal</span>
        )}
      </td>
      <td><span className={`badge ${slug(t.status)}`}>{t.status}</span></td>
      <td>{others.join(", ") || "–"}</td>
    </tr>
  );
}

function Table({ rows, who, today }) {
  return (
    <table className="tbl">
      <thead>
        <tr><th>Tugas</th><th>Divisi</th><th>Deadline</th><th>Status</th><th>PIC lain</th></tr>
      </thead>
      <tbody>{rows.map((t) => <Row key={t.id} t={t} who={who} today={today} />)}</tbody>
    </table>
  );
}

export default function TugasSaya({ tasks, today, user }) {
  const picList = useMemo(() => [...new Set(tasks.flatMap((t) => t.pic))].sort(), [tasks]);
  const [pic, setPic] = useState("");
  // staff hanya melihat dirinya sendiri; GM/koordinator boleh memilih PIC
  const locked = user.role === "staff" && user.picName;
  const who = locked ? user.picName : pic || picList[0] || "";
  const divOf = (p) => [...new Set(tasks.filter((t) => t.pic.includes(p)).map((t) => t.divisi))].join(", ");

  const mine = tasks.filter((t) => t.pic.includes(who));
  const active = mine
    .filter(isActive)
    .sort((a, b) => (a.deadline ? a.deadline.getTime() : Infinity) - (b.deadline ? b.deadline.getTime() : Infinity));
  const done = mine.filter((t) => !isActive(t));

  const late = active.filter((t) => daysLate(t, today) > 0).length;
  const undated = active.filter(isIncomplete).length;

  if (!who) return <div className="state">Belum ada tugas.</div>;

  return (
    <>
      <div className="titlebar">
        <div>
          <h1>Tugas saya</h1>
          <p className="muted">Diurutkan dari deadline terdekat · tugas tanpa tanggal di bawah</p>
        </div>
        {locked ? (
          <span className="control static">PIC: {who} ({divOf(who)})</span>
        ) : (
          <select className="control" value={who} onChange={(e) => setPic(e.target.value)} aria-label="Pilih PIC">
            {picList.map((p) => <option key={p} value={p}>PIC: {p} ({divOf(p)})</option>)}
          </select>
        )}
      </div>

      <div className="cards three">
        <div className="card"><span className="muted">Tugas aktif</span><b>{active.length}</b><small className="muted">dari {mine.length} tugas atas nama {who}</small></div>
        <div className="card"><span className="muted">Lewat deadline</span><b>{late}</b><small className="muted">cek apakah statusnya sudah diperbarui</small></div>
        <div className="card"><span className="muted">Tanpa tanggal</span><b>{undated}</b><small className="muted">minta koordinator melengkapi</small></div>
      </div>

      <div className="tablebox">
        {active.length === 0 ? <div className="state">Tidak ada tugas aktif.</div> : <Table rows={active} who={who} today={today} />}
        <details className="doneblock">
          <summary>Selesai ({done.length})</summary>
          {done.length > 0 && <Table rows={done} who={who} today={today} />}
        </details>
      </div>
    </>
  );
}
