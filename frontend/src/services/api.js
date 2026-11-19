const BASE = import.meta.env.VITE_API_URL;
export const MOCK = !BASE; // tanpa VITE_API_URL: pakai data contoh, tanpa login

const TOKEN_KEY = "irisolve.token";
const store = {
  get() { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(v) { try { v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* abaikan */ } },
};
export class AuthError extends Error {}

const MOCK_SESSION = {
  user: { role: "gm", division: null, picName: null },
  menu: ["timeline", "tugas-saya", "beban-kerja", "konflik", "what-if", "ringkasan-gm"],
};

const toDate = (s) => (s ? new Date(`${String(s).slice(0, 10)}T00:00:00`) : null);
const pick = (t, ...keys) => {
  for (const k of keys) if (t[k] !== undefined && t[k] !== null && t[k] !== "") return t[k];
  return null;
};
const statusFrom = (p) => (Number(p) >= 100 ? "Selesai" : Number(p) > 0 ? "Sedang dikerjakan" : "Belum");

async function request(path, opts = {}) {
  const token = store.get();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 401 && path !== "/api/auth/login") {
    store.set(null);
    throw new AuthError("Sesi sudah habis, silakan login lagi");
  }
  if (!res.ok) {
    let msg;
    try { msg = (await res.json()).error; } catch { /* bukan JSON */ }
    throw new Error(msg || `Permintaan gagal (kode ${res.status})`);
  }
  return res.json();
}

export async function login(username, password) {
  if (MOCK) return MOCK_SESSION;
  const data = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  store.set(data.token);
  return { user: data.user, menu: data.menu };
}

export async function restoreSession() {
  if (MOCK) return MOCK_SESSION;
  if (!store.get()) return null;
  try { return await request("/api/auth/me"); }
  catch (e) { if (e instanceof AuthError) return null; throw e; }
}

export const logout = () => store.set(null);

const normalize = (t) => {
  const divisi = pick(t, "division", "divisi") ?? "";
  const pic = pick(t, "pics", "pic") ?? [];
  return {
    id: t.id,
    nama: pick(t, "name", "nama") ?? `${divisi} · baris ${t.sourceRow ?? t.id}`,
    divisi,
    pic: Array.isArray(pic) ? pic : [pic],
    start: toDate(pick(t, "start", "start_date")),
    deadline: toDate(t.deadline),
    status: t.status ?? statusFrom(t.progress),
    brief: t.brief ?? null,
    requester: t.requester ?? null,
    link: t.link ?? null,
  };
};

export async function fetchTasks() {
  if (MOCK) {
    const res = await fetch("/mock/tasks.json");
    if (!res.ok) throw new Error(`Data gagal dimuat (kode ${res.status})`);
    return (await res.json()).map(normalize);
  }
  return (await request("/api/tasks")).map(normalize);
}

// Info impor terakhir per divisi -> [{ division, filename, importedAt: Date }]
export async function fetchLatestImport() {
  if (MOCK) return [{ division: "Programming", importedAt: new Date("2026-11-06T14:30:00") }];
  const rows = await request("/api/import/latest");
  return rows.map((r) => ({ ...r, importedAt: new Date(r.importedAt) }));
}

// .xlsx -> semua tab divisi sekaligus; .csv -> satu divisi (GM harus memilih divisi)
export async function importFile(file, division) {
  if (MOCK) throw new Error("Impor hanya tersedia saat terhubung ke backend (isi VITE_API_URL)");
  const body = new FormData();
  body.append("file", file);
  if (division) body.append("division", division);
  return request("/api/import", { method: "POST", body });
}
