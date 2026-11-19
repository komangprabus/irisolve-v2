// npm run db:seed  -> bikin akun contoh. Aman dijalankan berulang (akun yang sudah ada tidak ditimpa).
// Password dari SEED_PASSWORD (default iris12345 hanya untuk dev; wajib di-set di production).
import { pool } from "./db";
import { createUser, type Role } from "./iris-auth";

const password = process.env.SEED_PASSWORD ?? "iris12345";
if (process.env.NODE_ENV === "production" && !process.env.SEED_PASSWORD)
  throw new Error("Set SEED_PASSWORD dulu sebelum seed di production");

const DIVISIONS = ["Programming", "Mekanik", "Electrical", "AdFin", "DesBrand"];
const accounts: { username: string; role: Role; division?: string; picName?: string }[] = [
  { username: "gm", role: "gm" },
  ...DIVISIONS.map((d) => ({ username: `koor.${d.toLowerCase()}`, role: "koordinator" as Role, division: d })),
  { username: "aslam", role: "staff", division: "Programming", picName: "Aslam" },
];

(async () => {
  for (const a of accounts) await createUser(pool, { ...a, password });
  console.log(`Akun siap: ${accounts.map((a) => a.username).join(", ")}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
