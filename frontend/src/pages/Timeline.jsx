import { useMemo, useState } from "react";
import FilterBar from "../components/FilterBar";
import GanttChart from "../components/GanttChart";
import { DAY, fmtDateTime, fmtRange, isIncomplete } from "../utils";

const DEFAULT_FILTERS = { divisi: "Semua", pic: "Semua", statuses: ["Belum", "Sedang dikerjakan", "Revisi"] };

export default function Timeline({ tasks, today, lastImport, onImport }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showList, setShowList] = useState(false);

  const divisiList = useMemo(() => [...new Set(tasks.map((t) => t.divisi))].sort(), [tasks]);
  const picList = useMemo(() => [...new Set(tasks.flatMap((t) => t.pic))].sort(), [tasks]);

  const visible = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (filters.divisi === "Semua" || t.divisi === filters.divisi) &&
          (filters.pic === "Semua" || t.pic.includes(filters.pic)) &&
          filters.statuses.includes(t.status)
      ),
    [tasks, filters]
  );

  const range = useMemo(() => {
    const starts = tasks.map((t) => t.start).filter(Boolean);
    const ends = tasks.map((t) => t.deadline).filter(Boolean);
    return { start: new Date(Math.min(...starts, today)), end: new Date(Math.max(...ends, today) + DAY) };
  }, [tasks, today]);

  const incomplete = tasks.filter(isIncomplete);
  const noDate = incomplete.filter((t) => !t.start && !t.deadline).length;
  const oneDate = incomplete.length - noDate;
  const reset = () => setFilters(DEFAULT_FILTERS);

  return (
    <>
      <div className="titlebar">
        <div className="titleline">
          <h1>Timeline</h1>
          {tasks.length > 0 && <span className="sub">{fmtRange(range.start, new Date(range.end - DAY))}</span>}
        </div>
        <div className="lastimport">
          <span className="muted">{lastImport ? `Terakhir diimpor: ${fmtDateTime(lastImport)}` : "Belum pernah diimpor"}</span>
          {onImport && <button className="btn" onClick={onImport}>Impor ulang</button>}
        </div>
      </div>

      <FilterBar filters={filters} setFilters={setFilters} divisiList={divisiList} picList={picList} onReset={reset} />

      {incomplete.length > 0 && (
        <div className="banner">
          <div>
            <strong>{incomplete.length} tugas datanya tidak lengkap</strong> ({oneDate} hanya punya satu tanggal, {noDate} tanpa
            tanggal). Yang tanpa tanggal tidak bisa digambar di Gantt.
            {showList && (
              <ul>
                {incomplete.map((t) => (
                  <li key={t.id}>{t.divisi} · {t.nama} ({t.pic.join(", ") || "tanpa PIC"})</li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn" onClick={() => setShowList(!showList)}>{showList ? "Tutup daftar" : "Lihat daftar"}</button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="state">
          <p>Tidak ada tugas yang cocok dengan filter ini.</p>
          <button className="btn" onClick={reset}>Reset filter</button>
        </div>
      ) : (
        <>
          <GanttChart tasks={visible} range={range} today={today} />
        </>
      )}
    </>
  );
}
