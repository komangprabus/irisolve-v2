// IRISOLVE-9: Import tracker divisi dari CSV atau XLSX.
// Kolom dikenali dari NAMA header (urutan dan kolom tambahan tidak masalah).
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import type { Pool } from "pg";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tasks (
  id              BIGSERIAL PRIMARY KEY,
  division        TEXT    NOT NULL,
  source_row      INT     NOT NULL,          -- nomor baris di sheet ("baris 18")
  name            TEXT    NOT NULL,
  pics            TEXT[]  NOT NULL DEFAULT '{}',
  start_date      DATE,
  deadline        DATE,
  progress        INT CHECK (progress BETWEEN 0 AND 100),
  status          TEXT    NOT NULL DEFAULT 'Belum',
  data_incomplete BOOLEAN NOT NULL DEFAULT FALSE,
  brief           TEXT,
  requester       TEXT,
  link            TEXT,
  content_hash    TEXT    NOT NULL,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (division, source_row)               -- kunci idempotensi
);

CREATE TABLE IF NOT EXISTS import_runs (
  id          BIGSERIAL PRIMARY KEY,
  division    TEXT NOT NULL,
  filename    TEXT,
  succeeded   INT NOT NULL,
  failed      INT NOT NULL,
  inserted    INT NOT NULL,
  updated     INT NOT NULL,
  unchanged   INT NOT NULL,
  incomplete  INT NOT NULL,
  errors      JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- migrasi untuk database yang sudah ada (aman dijalankan berulang)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Belum';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS brief TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requester TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE import_runs ADD COLUMN IF NOT EXISTS skipped INT NOT NULL DEFAULT 0;
ALTER TABLE import_runs ADD COLUMN IF NOT EXISTS removed INT NOT NULL DEFAULT 0;`;

export const DIVISIONS = ["Programming", "Mekanik", "Electrical", "AdFin", "DesBrand"];

// ---------- Parsing helpers ----------

const pad = (n: number) => String(n).padStart(2, "0");

/** dd/mm/yyyy (atau yyyy-mm-dd) -> "yyyy-mm-dd". Kosong -> null. Salah -> undefined. */
export function parseDate(raw: string): string | null | undefined {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s) ?? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return undefined;
  const iso = m[0].includes("-");
  const [d, mo, y] = iso ? [Number(m[3]), Number(m[2]), Number(m[1])] : [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // tolak tanggal yang tidak ada, mis. 31/02/2026
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined;
  return dt.toISOString().slice(0, 10);
}

/** "50%", "50", "50,5%" -> 0..100. Kosong -> null. Salah -> undefined. */
export function parseProgress(raw: string): number | null | undefined {
  const s = (raw ?? "").trim().replace("%", "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return Math.round(n);
}

export const STATUSES = ["Belum", "Sedang dikerjakan", "Selesai", "Revisi"] as const;
export type Status = (typeof STATUSES)[number];
const PROGRESS_OF: Record<Status, number> = { "Belum": 0, "Sedang dikerjakan": 50, "Selesai": 100, "Revisi": 50 };
export const statusFromProgress = (p: number | null): Status =>
  p !== null && p >= 100 ? "Selesai" : p !== null && p > 0 ? "Sedang dikerjakan" : "Belum";

/** Kolom Progress/Status boleh angka ("60%") atau teks ("Selesai", "Revisi"). Salah -> undefined. */
export function parseStatus(raw: string): { status: Status; progress: number | null } | undefined {
  const s = (raw ?? "").trim();
  if (!s) return { status: "Belum", progress: null };
  const low = s.toLowerCase().replace(/\s+/g, " ");
  const text = low === "selesai revisi" ? "Selesai" : STATUSES.find((x) => x.toLowerCase() === low);
  if (text) return { status: text, progress: PROGRESS_OF[text] };
  const n = parseProgress(s);
  if (n === undefined || n === null) return undefined;
  return { status: statusFromProgress(n), progress: n };
}

const splitPics = (raw: string) => raw.split(/[,;&\n]/).map((p) => p.trim()).filter(Boolean);

export class ImportFormatError extends Error {}

export interface RowError { row: number; reason: string }
export interface ParsedTask {
  sourceRow: number; name: string; pics: string[];
  start: string | null; deadline: string | null;
  progress: number | null; status: Status; incomplete: boolean;
  brief: string | null; requester: string | null; link: string | null;
}

// Nama header yang dikenali per kolom (huruf besar/kecil dan spasi tidak berpengaruh)
const ALIAS: Record<string, string[]> = {
  no: ["no", "nomor"], tugas: ["tugas", "nama tugas", "task"],
  brief: ["brief", "keterangan", "deskripsi"], requester: ["requester", "peminta", "pemohon"],
  pic: ["pic", "penanggung jawab"], start: ["start", "mulai", "tanggal mulai"],
  deadline: ["deadline", "tenggat", "due date"], progress: ["progress", "status"],
  link: ["file", "link"],
};
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function mapColumns(header: string[]) {
  const col: Record<string, number> = {};
  const used = new Set<number>();
  for (const key of Object.keys(ALIAS)) {
    const i = header.findIndex((h, idx) =>
      !used.has(idx) && ALIAS[key].some((a) => h === a || /^[ \/(]/.test(h.slice(a.length)) && h.startsWith(a)));
    if (i >= 0) { col[key] = i; used.add(i); }
  }
  return col;
}

/** Inti parser: baris-baris mentah (dari CSV atau XLSX) -> tugas + error. */
export function parseTrackerRows(data: string[][]) {
  // 1. Cari baris header (di mana pun posisinya); baris di atasnya (judul, catatan) dilewati
  let headerIdx = -1, col: Record<string, number> = {};
  for (let i = 0; i < Math.min(data.length, 60); i++) {
    const c = mapColumns(data[i].map(norm));
    if (c.tugas !== undefined && c.start !== undefined && c.deadline !== undefined) { headerIdx = i; col = c; break; }
  }
  if (headerIdx === -1) throw new ImportFormatError("Baris header tidak ditemukan (butuh kolom Tugas, PIC, Start, Deadline, Progress)");
  const missing = ["tugas", "pic", "start", "deadline", "progress"].filter((k) => col[k] === undefined);
  if (missing.length) throw new ImportFormatError(`Kolom tidak ada: ${missing.join(", ")}`);

  const tasks: ParsedTask[] = [];
  const errors: RowError[] = [];
  let skipped = 0;

  data.slice(headerIdx + 1).forEach((r, i) => {
    const row = headerIdx + 2 + i; // nomor baris asli di sheet (1-based)
    const get = (k: string) => (col[k] === undefined ? "" : String(r[col[k]] ?? "").trim());
    // baris kosong di semua kolom yang dibaca (nomor urut saja tidak dihitung): abaikan
    if (Object.keys(col).every((k) => k === "no" || !get(k))) return;

    const name = get("tugas");
    // baris contoh/template: bertuliskan EXAMPLE/CONTOH, atau tanpa nomor, PIC, dan progress
    const template = /^(example|contoh)\b/i.test(get("no")) || /^contoh\b/i.test(name) ||
      (col.no !== undefined && !get("no") && !get("pic") && !get("progress"));
    if (template) { skipped++; return; }

    if (!name) return void errors.push({ row, reason: "Nama tugas kosong" });
    const start = parseDate(get("start"));
    const deadline = parseDate(get("deadline"));
    const parsed = parseStatus(get("progress"));
    if (start === undefined) return void errors.push({ row, reason: `Format Start salah: "${get("start")}" (harus dd/mm/yyyy)` });
    if (deadline === undefined) return void errors.push({ row, reason: `Format Deadline salah: "${get("deadline")}" (harus dd/mm/yyyy)` });
    if (parsed === undefined) return void errors.push({ row, reason: `Progress/status tidak valid: "${get("progress")}" (isi angka 0-100 atau Belum / Sedang dikerjakan / Selesai / Revisi)` });
    if (start && deadline && deadline < start) return void errors.push({ row, reason: "Deadline lebih awal dari Start" });

    tasks.push({
      sourceRow: row, name, pics: splitPics(get("pic")),
      start, deadline, progress: parsed.progress, status: parsed.status,
      incomplete: !start || !deadline,   // satu tanggal atau tanpa tanggal
      brief: get("brief").slice(0, 4000) || null,
      requester: get("requester").slice(0, 200) || null,
      link: get("link").slice(0, 2000) || null,
    });
  });
  return { tasks, errors, skipped };
}

export function parseTrackerCsv(csvText: string) {
  const { data } = Papa.parse<string[]>(csvText.replace(/^\uFEFF/, ""), { skipEmptyLines: false });
  return parseTrackerRows(data);
}

// ---------- XLSX ----------

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  if (typeof v === "object") {
    const o = v as any;
    if (Array.isArray(o.richText)) return o.richText.map((x: any) => x.text).join("");
    if ("result" in o) return cellText(o.result);                       // sel berumus
    if ("text" in o) {                                                   // hyperlink
      const t = typeof o.text === "string" ? o.text : cellText(o.text);
      return o.hyperlink && o.hyperlink !== t ? `${t} ${o.hyperlink}` : t;
    }
    return "";
  }
  return String(v);
}

function sheetRows(ws: ExcelJS.Worksheet): string[][] {
  const maxC = Math.min(ws.columnCount, 40);
  const rows: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    rows.push(Array.from({ length: maxC }, (_, c) => cellText(row.getCell(c + 1).value)));
  }
  return rows;
}

// ---------- Import (idempoten) ----------

export async function importDivision(
  pool: Pool, division: string, parsed: ReturnType<typeof parseTrackerRows>, filename?: string,
) {
  const { tasks, errors, skipped } = parsed;
  let inserted = 0, updated = 0, unchanged = 0, removed = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const t of tasks) {
      const hash = createHash("sha1")
        .update(JSON.stringify([t.name, t.pics, t.start, t.deadline, t.progress, t.status, t.brief, t.requester, t.link]))
        .digest("hex");
      const res = await client.query(
        `INSERT INTO tasks (division, source_row, name, pics, start_date, deadline, progress, status, data_incomplete, brief, requester, link, content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (division, source_row) DO UPDATE SET
           name=EXCLUDED.name, pics=EXCLUDED.pics, start_date=EXCLUDED.start_date,
           deadline=EXCLUDED.deadline, progress=EXCLUDED.progress, status=EXCLUDED.status,
           brief=EXCLUDED.brief, requester=EXCLUDED.requester, link=EXCLUDED.link,
           data_incomplete=EXCLUDED.data_incomplete, content_hash=EXCLUDED.content_hash, imported_at=now()
         WHERE tasks.content_hash <> EXCLUDED.content_hash
         RETURNING (xmax = 0) AS inserted`,
        [division, t.sourceRow, t.name, t.pics, t.start, t.deadline, t.progress, t.status, t.incomplete, t.brief, t.requester, t.link, hash],
      );
      if (res.rowCount === 0) unchanged++;
      else if (res.rows[0].inserted) inserted++;
      else updated++;
    }
    // Baris yang sudah tidak ada di sheet dibuang. Baris yang error tetap dipertahankan
    // (masih ada di sheet), dan file tanpa tugas valid tidak pernah menghapus apa pun.
    if (tasks.length > 0) {
      const keep = [...tasks.map((t) => t.sourceRow), ...errors.map((e) => e.row)];
      const del = await client.query(
        "DELETE FROM tasks WHERE division = $1 AND NOT (source_row = ANY($2::int[]))", [division, keep]);
      removed = del.rowCount ?? 0;
    }
    const report = {
      division, skipped,
      succeeded: tasks.length, failed: errors.length,
      inserted, updated, unchanged, removed,
      incomplete: tasks.filter((t) => t.incomplete).length,
      errors,
    };
    await client.query(
      `INSERT INTO import_runs (division, filename, succeeded, failed, inserted, updated, unchanged, removed, skipped, incomplete, errors)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [division, filename ?? null, report.succeeded, report.failed, inserted, updated, unchanged, removed, skipped, report.incomplete, JSON.stringify(errors)],
    );
    await client.query("COMMIT");
    return report;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}


export const importCsvText = (pool: Pool, division: string, csvText: string, filename?: string) =>
  importDivision(pool, division, parseTrackerCsv(csvText), filename);

/** XLSX: tiap tab yang namanya sama dengan nama divisi diimpor ke divisi itu. Tab lain diabaikan. */
export async function importWorkbook(pool: Pool, buffer: Buffer, filename: string, divisions: string[]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const results: any[] = [];
  for (const division of divisions) {
    const ws = wb.worksheets.find((w) => norm(w.name) === norm(division));
    if (!ws) { results.push({ division, error: `Tab "${division}" tidak ditemukan di file` }); continue; }
    try {
      results.push(await importDivision(pool, division, parseTrackerRows(sheetRows(ws)), filename));
    } catch (e) {
      if (e instanceof ImportFormatError) results.push({ division, error: e.message });
      else throw e;
    }
  }
  return results;
}
