// IRISOLVE-10: Login per role (GM, koordinator, staff)
// Dependency sudah ada di package.json (npm install)
import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Pool } from "pg";

export type Role = "gm" | "koordinator" | "staff";
export interface AuthUser {
  id: number; role: Role;
  division: string | null;  // koordinator & staff terikat ke satu divisi
  picName: string | null;   // nama di kolom PIC tracker (untuk "Tugas saya")
}

export const AUTH_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('gm','koordinator','staff')),
  division      TEXT,
  pic_name      TEXT,
  CHECK (role = 'gm' OR division IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci ON users (lower(username));`;

const JWT_SECRET = process.env.JWT_SECRET ?? "";
if (!JWT_SECRET) throw new Error("JWT_SECRET belum di-set di environment");

// Hash palsu: dipakai supaya waktu respons sama baik username ada maupun tidak
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);

// Menu per role (sesuai desain dashboard; "import-csv" = tombol Impor ulang di Timeline)
export const MENU: Record<Role, string[]> = {
  gm:          ["timeline", "tugas-saya", "beban-kerja", "konflik", "what-if", "ringkasan-gm", "import-csv"],
  koordinator: ["timeline", "tugas-saya", "beban-kerja", "konflik", "what-if", "import-csv"],
  staff:       ["timeline", "tugas-saya"],
};

// ---------- Middleware ----------
declare module "express-serve-static-core" { interface Request { user?: AuthUser } }

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
  if (!m) return res.status(401).json({ error: "Belum login" });
  try {
    req.user = jwt.verify(m[1], JWT_SECRET) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "Sesi tidak valid atau sudah habis, silakan login lagi" });
  }
}

export const requireRole = (...roles: Role[]) => (req: Request, res: Response, next: NextFunction) =>
  req.user && roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: "Tidak punya akses ke fitur ini" });

/**
 * Filter data tugas sesuai hak akses. Pakai di SEMUA query tugas, jangan
 * andalkan frontend menyembunyikan data.
 *  - gm          : semua divisi
 *  - koordinator : divisinya saja
 *  - staff       : divisinya saja (timeline) / hanya tugas atas namanya (tugas saya)
 */
export function taskScope(u: AuthUser, view: "division" | "mine" = "division") {
  if (u.role === "gm") return { sql: "TRUE", params: [] as unknown[] };
  if (view === "mine" && u.picName)
    return { sql: "division = $1 AND $2 = ANY(pics)", params: [u.division, u.picName] };
  return { sql: "division = $1", params: [u.division] };
}

// ---------- Routes ----------
export function authRouter(pool: Pool) {
  const r = Router();

  // Batas percobaan gagal per IP: 10 kali / 15 menit (in-memory, cukup untuk satu instance)
  const fails = new Map<string, { n: number; until: number }>();
  r.post("/login", async (req, res) => {
    const ip = req.ip ?? "?";
    const f = fails.get(ip);
    if (f && f.until > Date.now() && f.n >= 10)
      return res.status(429).json({ error: "Terlalu banyak percobaan, coba lagi beberapa menit lagi" });
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || !username || !password)
      return res.status(400).json({ error: "Username dan password wajib diisi" });

    const { rows } = await pool.query(
      "SELECT id, password_hash, role, division, pic_name FROM users WHERE lower(username) = lower($1)",
      [username.trim()],
    );
    const u = rows[0];
    const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH);

    // Pesan sama untuk username salah maupun password salah (tidak membocorkan akun)
    if (!u || !ok) {
      const cur = f && f.until > Date.now() ? f : { n: 0, until: Date.now() + 15 * 60_000 };
      fails.set(ip, { n: cur.n + 1, until: cur.until });
      return res.status(401).json({ error: "Username atau password salah" });
    }
    fails.delete(ip);

    const user: AuthUser = { id: Number(u.id), role: u.role, division: u.division, picName: u.pic_name };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user, menu: MENU[user.role] });
  });

  // Dipanggil frontend saat load untuk tahu role & menu yang boleh tampil
  r.get("/me", authenticate, (req, res) =>
    res.json({ user: req.user, menu: MENU[req.user!.role] }));

  return r;
}

// Util untuk bikin akun (dipakai script seed)
export async function createUser(
  pool: Pool,
  u: { username: string; password: string; role: Role; division?: string; picName?: string },
) {
  const hash = await bcrypt.hash(u.password, 10);
  await pool.query(
    "INSERT INTO users (username, password_hash, role, division, pic_name) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
    [u.username, hash, u.role, u.division ?? null, u.picName ?? null],
  );
}

// ---------- Contoh pemasangan di app ----------
// app.use(express.json());
// app.use("/api/auth", authRouter(pool));
// app.get("/api/tasks", authenticate, async (req, res) => {
//   const s = taskScope(req.user!);
//   const { rows } = await pool.query(`SELECT * FROM tasks WHERE ${s.sql}`, s.params);
//   res.json(rows);
// });
// Import CSV (IRISOLVE-9): hanya koordinator, hanya untuk divisinya sendiri
// app.post("/api/import", authenticate, requireRole("koordinator"), upload.single("file"), (req, res) =>
//   importDivisionCsv(pool, req.user!.division!, req.file!.buffer.toString("utf8"), req.file!.originalname)
//     .then((report) => res.json(report)));
