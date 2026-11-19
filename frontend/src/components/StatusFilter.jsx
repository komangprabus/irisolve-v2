const STATUS = ["Belum", "Sedang dikerjakan", "Selesai", "Revisi"];
const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");

export default function StatusFilter({ value, onChange }) {
  const toggle = (s) =>
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);

  const label =
    value.length === 0 ? "Tidak ada" : value.length === STATUS.length ? "Semua" : value.join(", ");

  return (
    <details className="status-filter">
      <summary className="control">Status: {label}</summary>
      <div className="popover">
        {STATUS.map((s) => (
          <label key={s}>
            <input type="checkbox" checked={value.includes(s)} onChange={() => toggle(s)} />
            <span className={`dot ${slug(s)}`} />
            {s}
          </label>
        ))}
      </div>
    </details>
  );
}