// npm run db:init  -> membuat tabel (aman dijalankan berulang)
import { pool } from "./db";
import { SCHEMA_SQL } from "./iris-import";
import { AUTH_SCHEMA_SQL } from "./iris-auth";

(async () => {
  await pool.query(SCHEMA_SQL);
  await pool.query(AUTH_SCHEMA_SQL);
  console.log("Tabel siap: tasks, import_runs, users");
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
