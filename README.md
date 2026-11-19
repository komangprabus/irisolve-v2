# IRISolve

Dashboard timeline tugas IRIS (Gantt, Tugas saya, Ringkasan GM) dari tracker Google Sheets per divisi.

- `backend/`: Node + TypeScript + Express + Postgres (login per role, impor CSV). Lihat `backend/README.md`.
- `frontend/`: React + Vite. Salin `frontend/.env.example` jadi `frontend/.env.local`; kosongkan `VITE_API_URL` untuk data contoh tanpa backend.

Jalankan: backend dulu (`npm run dev`), lalu `npm install && npm run dev` di `frontend/` (http://localhost:5173), login dengan akun seed.

Data tugas tidak ditulis di kode: login sebagai `gm` atau koordinator, klik **Impor ulang** di Timeline, lalu pilih file tracker (.xlsx atau .csv).
