# IRISolve Backend

Node + TypeScript + Express + Postgres.

## Menjalankan
1. `npm install`
2. Salin `.env.example` jadi `.env`, ganti `JWT_SECRET` dengan string acak panjang
3. Database: `docker compose up -d` (atau pakai Neon/Supabase, isi `DATABASE_URL` di `.env`)
4. `npm run db:init` (buat tabel) lalu `npm run db:seed` (akun contoh)
5. `npm run dev` -> http://localhost:3000

Akun contoh (password dev: `iris12345`, atau isi `SEED_PASSWORD`): `gm`, `koor.programming`, `koor.mekanik`, `koor.electrical`, `koor.adfin`, `koor.desbrand`, `aslam` (staff)

## Endpoint
| Method | Path | Akses |
|---|---|---|
| POST | /api/auth/login | publik |
| GET | /api/auth/me | login |
| GET | /api/tasks (?view=mine, ?division=X khusus GM) | login, dibatasi role |
| POST | /api/import (multipart: `file` .xlsx/.csv, + `division` untuk CSV dari GM) | koordinator (divisinya sendiri), GM (semua) |
| GET | /api/import/latest | login |

## Impor data
Tidak ada data yang ditulis di kode. Semua tugas berasal dari file yang diunggah lewat tombol **Impor ulang** di Timeline.
- **.xlsx**: tiap tab yang namanya sama dengan divisi (Programming, Mekanik, Electrical, AdFin, DesBrand) diimpor sekaligus. Tab lain diabaikan.
- **.csv**: satu tab. Koordinator otomatis ke divisinya, GM memilih divisi.
- Kolom dikenali dari nama header: `Tugas`, `PIC`, `Start`, `Deadline`, `Progress` (atau `Status`), opsional `Brief`, `Requester`, `File / Link`. Baris judul di atas header, urutan kolom, kolom tambahan di kanan, dan baris contoh (EXAMPLE / tanpa nomor) diabaikan.
- Tanggal `dd/mm/yyyy`. Progress boleh angka (`60%`) atau teks (`Belum`, `Sedang dikerjakan`, `Selesai`, `Selesai revisi`, `Revisi`).
- Impor ulang file yang sama tidak membuat data dobel. Tugas yang sudah tidak ada di file ikut dihapus.

Tes cepat: `sample/tracker-programming.csv`
