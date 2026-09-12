# ARSIP DIGITAL BAPPERIDA
**Pusat Dokumen Digital Perencanaan Bidang Ekonomi**
BAPPERIDA Kabupaten Sumba Barat

---

## Tentang Aplikasi

Aplikasi manajemen dokumen digital untuk Bidang Ekonomi dan SDA BAPPERIDA Kabupaten Sumba Barat. Mengelola dokumen perencanaan seperti RPJMD, Renstra, Renja, RKA, Kajian Ekonomi, dan lainnya dengan alur persetujuan bertingkat.

### Fitur

| Fitur | Deskripsi |
|-------|-----------|
| **Dashboard** | Statistik ringkasan, grafik per jenis & sektor, dokumen terbaru |
| **Dokumen** | Daftar dokumen dengan filter (jenis, sektor, tahun, status) |
| **Detail Dokumen** | Metadata, pratinjau, riwayat status, aksi approve/tolak |
| **Upload** | Upload file → Google Drive, otomatis status "Menunggu Review" |
| **Pencarian** | Pencarian teks bebas di seluruh repositori |
| **Portal Publik** | Tampilan dokumen yang boleh diakses publik tanpa login |
| **Manajemen Pengguna** | CRUD pengguna (Admin only) |
| **Manajemen Kategori** | Kelola jenis/tipe dokumen (Admin only) |
| **Audit Trail** | Log semua aktivitas sistem |

### Alur Persetujuan

```
Staf Upload → Menunggu Review → Kabid Review → Menunggu Persetujuan → Kepala Setujui → Diarsipkan
                                                                      ↘ Ditolak
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| Backend | Express 5 |
| Database | PostgreSQL (via `pg` driver) |
| Auth | bcryptjs (password hashing) |
| State | TanStack React Query 5 |
| Storage | Google Drive (via Google Apps Script) |
| Deploy | Docker + Coolify |

---

## Cara Menjalankan di Lokal

### Prasyarat
- **Node.js** 18+ → https://nodejs.org
- **PostgreSQL** (atau akses ke database remote)
- **npm**

### Langkah-langkah

```bash
# 1. Clone/Masuk ke folder
cd peta-ekonomi

# 2. Install dependensi
npm install

# 3. Copy konfigurasi environment
cp .env.example .env
# Edit .env: isi DATABASE_URL dan VITE_GAS_WEBAPP_URL

# 4. Setup database (sekali)
node server/setup_db.js

# 5. Jalankan (Vite + Express concurrently)
npm run dev
```

Akses di **http://localhost:5173**

---

## Akun Demo

Password: **admin123**

| Nama | Role | NIP |
|------|------|-----|
| Agustina Malo | Admin | 198301012010012008 |
| Kabid Ekonomi | Reviewer | 197506152005011005 |
| Yohanes Rangga | Staf | 199002122011011003 |
| Maria Lende | Staf | 198712232009022002 |
| Dominikus Tamu | Staf | 199108152012011004 |

> Klik nama akun di halaman login untuk isi otomatis.

---

## Scripts

| Script | Deskripsi |
|--------|-----------|
| `npm run dev` | Jalankan Vite + Express (development) |
| `npm run build` | Build React ke `dist/` |
| `npm run server` | Jalankan Express saja (production) |
| `npm run preview` | Preview hasil build |

---

## Struktur Folder

```
peta-ekonomi/
├── server/
│   ├── index.js          # Express API (auth, CRUD, audit, static)
│   └── setup_db.js       # Init DB + seed data
├── src/
│   ├── main.jsx          # Entry React
│   ├── App.jsx           # Root component & state
│   ├── hooks.js          # React Query hooks
│   ├── data.js           # Konstanta (sektor, tipe, status, warna)
│   └── components/
│       ├── LoginPage.jsx
│       ├── Sidebar.jsx
│       ├── Dashboard.jsx
│       ├── DocPages.jsx  # DocList + DocDetail
│       ├── UploadForm.jsx
│       ├── Pages.jsx     # Pencarian, Portal, Pengguna, Kategori, Audit
│       └── ui.jsx        # Icon, Badge, Toast reusable
├── google-apps-script/
│   └── Code.gs           # GAS: upload ke Google Drive
├── public/
│   └── icon.svg
├── docs/
│   ├── TEKNIS.md         # Dokumentasi teknis lengkap
│   └── PANDUAN.md        # Panduan penggunaan aplikasi
├── database_setup.sql    # Schema SQL lengkap
├── Dockerfile            # Multi-stage build
├── vite.config.js
├── .env.example
└── package.json
```

---

## API Endpoints

Base: `/api`

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/auth/login` | — | Login |
| GET | `/api/docs` | — | Semua dokumen |
| POST | `/api/docs` | Key | Upload dokumen |
| GET | `/api/users` | — | Semua user |
| POST | `/api/users` | — | Tambah user |
| PUT | `/api/users/:id` | — | Update user |
| DELETE | `/api/users/:id` | — | Hapus user |
| GET | `/api/logs` | — | 100 log terbaru |
| POST | `/api/logs` | — | Tambah log |
| GET | `/api/kategori-dokumen` | — | Semua kategori |
| POST | `/api/kategori-dokumen` | — | Tambah kategori |
| PUT | `/api/kategori-dokumen/:id` | — | Update kategori |
| DELETE | `/api/kategori-dokumen/:id` | — | Hapus kategori |
| GET | `/api/health` | — | Cek koneksi DB |

Detail selengkapnya: [docs/TEKNIS.md](docs/TEKNIS.md)

---

## Deployment (Docker)

```bash
docker build -t peta-ekonomi .
docker run -p 3000:3000 --env-file .env peta-ekonomi
```

---

## Lisensi

Hak milik BAPPERIDA Kabupaten Sumba Barat.
