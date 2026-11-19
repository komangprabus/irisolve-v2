export const DAY = 86400000;
export const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");
export const isActive = (t) => t.status !== "Selesai";
export const isIncomplete = (t) => !t.start || !t.deadline;
// jumlah hari lewat deadline (0 kalau belum lewat / tanpa deadline)
export const daysLate = (t, today) => (t.deadline && t.deadline < today ? Math.round((today - t.deadline) / DAY) : 0);
export const fmtDate = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (d) =>
  d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
// "1 Sep – 15 Nov 2026"
export const fmtRange = (a, b) => `${a.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - ${fmtDate(b)}`;
