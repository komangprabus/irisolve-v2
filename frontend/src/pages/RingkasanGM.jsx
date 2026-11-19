import { daysLate, fmtDate, isActive, isIncomplete } from "../utils";

export default function RingkasanGM({ tasks, today }) {
  const active = tasks.filter(isActive);
  const late = active.filter((t) => daysLate(t, today) > 0).length;
  const divisions = [...new Set(tasks.map((t) => t.divisi))];
  const perDiv = divisions
    .map((d) => ({ d, n: active.filter((t) => t.divisi === d).length }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...perDiv.map((x) => x.n));
  const incomplete = tasks.filter(isIncomplete).length;
  const noPic = tasks.filter((t) => t.pic.length === 0).length;

  return (
    <>
      <h1>Ringkasan General Manager</h1>
      <p className="muted">Angka diambil dari halaman lain, jadi selalu sama · per {fmtDate(today)}</p>

      <div className="cards four">
        <div className="card"><span className="muted">Tugas aktif</span><b>{active.length}</b><small className="muted">dari {tasks.length} tugas di {divisions.length} divisi</small></div>
        <div className="card warnbox"><span className="muted">Lewat deadline</span><b className="amber">{late}</b><small className="muted">dari {active.length} tugas aktif</small></div>
        <div className="card"><span className="muted">Konflik aktif</span><b>–</b><small className="muted">tersedia di Sprint 2</small></div>
        <div className="card"><span className="muted">Anggota beban tinggi</span><b>–</b><small className="muted">menunggu batas yang disepakati IRIS</small></div>
      </div>

      <div className="twocol">
        <div className="panel">
          <h3>Tugas aktif per divisi</h3>
          {perDiv.map(({ d, n }) => (
            <div className="hbar" key={d}>
              <span className="hlabel">{d}</span>
              <span className="hfill" style={{ width: `${(n / max) * 70}%` }} />
              <b>{n}</b>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Perlu perhatian</h3>
          {late > 0 && <p><b>{late} tugas aktif lewat deadline.</b> Kemungkinan status di sheet belum diperbarui.</p>}
          {incomplete > 0 && <p><b>{incomplete} tugas</b> tanggalnya tidak lengkap.</p>}
          {noPic > 0 && <p><b>{noPic} baris</b> tanpa PIC.</p>}
          {late + incomplete + noPic === 0 && <p>Tidak ada yang perlu diperhatikan.</p>}
        </div>
      </div>
    </>
  );
}
