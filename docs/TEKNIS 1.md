# ARSIP DIGITAL BAPPERIDA — Dokumentasi Teknis

**Pusat Dokumen Digital Perencanaan Bidang Ekonomi**
BAPPERIDA Kabupaten Sumba Barat

---

## Arsitektur

```
┌─────────────────────────────────────────────────┐
│  Browser (React 18 + Vite 5)                    │
│  Port 5173 (dev)                                │
├──────────────┬──────────────────────────────────┤
│  /api/*      │  proxy → Express                  │
└──────────────┴──────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│  Express 5 (server/index.js) — Port 3000        │
│  Auth, CRUD, Audit, Static files (prod)         │
├──────────────┬──────────────────────────────────┤
│  PostgreSQL  │  Google Apps Script (GAS)         │
└──────────────┴──────────────────────────────────┘
        │                              │
        ▼                              ▼
┌──────────────┐              ┌───────────────────┐
│ Database:    │              │  Google Drive     │
│ peta_ekonomi │              │  Folder Upload    │
└──────────────┘              └───────────────────┘
```

**Alur Upload Dokumen:**
```
Browser → GAS Web App → Google Drive (file tersimpan)
       → POST /api/docs → PostgreSQL (metadata tersimpan)
```

---

## Tech Stack

| Layer    | Teknologi              | Versi  |
|----------|------------------------|--------|
| Frontend | React + Vite           | 18 / 5 |
| Backend  | Express.js             | 5      |
| Database | PostgreSQL (via pg)    | 8      |
| Auth     | bcryptjs (hash)        | 2      |
| State    | TanStack React Query   | 5      |
| Styling  | Inline CSS             | —      |
| Storage  | Google Drive (via GAS) | —      |
| Deploy   | Docker + Coolify       | —      |

---

## Struktur Folder

```
peta-ekonomi/
├── server/
│   ├── index.js          # Express API server
│   └── setup_db.js       # Inisialisasi DB & seed data
├── src/
│   ├── App.jsx           # Root component, routing & state
│   ├── main.jsx          # Entry point React
│   ├── hooks.js          # Custom hooks (useDocs, useUsers, etc.)
│   ├── data.js           # Konstanta: SECTORS, DOC_TYPES, YEARS
│   └── components/
│       ├── LoginPage.jsx       # Form login NIP + password
│       ├── Sidebar.jsx         # Navigasi samping
│       ├── Dashboard.jsx       # Statistik & grafik ringkasan
│       ├── DocPages.jsx        # Daftar & detail dokumen
│       ├── UploadForm.jsx      # Form upload dokumen
│       ├── Pages.jsx           # Pencarian, Portal Publik, Pengguna, Audit, Kategori
│       └── ui.jsx              # Komponen reusable: Icon, Badge, Toast
├── google-apps-script/
│   └── Code.gs           # GAS: upload ke Drive & simpan metadata
├── database_setup.sql    # Schema DB: user_credentials, audit_logs
├── Dockerfile            # Multi-stage build untuk produksi
├── vite.config.js        # Vite config + proxy ke Express
├── .env.example          # Template environment variable
└── package.json
```

---

## Database

### Tabel Utama

| Tabel | Deskripsi |
|-------|-----------|
| `user_list` | Data pegawai (NIP, nama, bidang, status) |
| `user_credentials` | Password hash + role + last_login |
| `bapperida_dokumen` | Metadata dokumen (judul, kategori, tipe, tanggal, url) |
| `bapperida_kategori_dokumen` | Daftar kategori/tipe dokumen |
| `audit_logs` | Log aktivitas sistem |

### Relasi

```
user_list.NIP ←──→ user_credentials.nip
```

### Schema SQL (dari `database_setup.sql`)

```sql
CREATE TABLE user_credentials (
    nip             VARCHAR(100) PRIMARY KEY,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id          SERIAL PRIMARY KEY,
    user_name   VARCHAR(100)  NOT NULL,
    action      VARCHAR(100)  NOT NULL,
    doc_title   VARCHAR(300),
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bapperida_kategori_dokumen (
    id          SERIAL PRIMARY KEY,
    nama        VARCHAR(100) UNIQUE NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);
```

### Seed Data

- **Kategori Dokumen:** RPJMD, Renstra, Renja, RKA, Kajian Ekonomi, Laporan Evaluasi, Data Statistik, Notulen Rapat, dll.
- **Password default:** `Bidangekonomi2026` (bcrypt hash, salt rounds: 10)
- **User credentials** di-insert via `setup_db.js` untuk NIP yang sudah ada di `user_list`.

---

## API Endpoints

Base URL: `/api`

### Auth

| Method | Endpoint          | Deskripsi                | Body                                    |
|--------|-------------------|--------------------------|-----------------------------------------|
| POST   | `/api/auth/login` | Login dengan NIP+password | `{ "nip": "...", "password": "..." }`  |

**Response login:**
```json
{
  "message": "Login berhasil",
  "user": {
    "id": "123",
    "name": "Agustina Malo",
    "nip": "1982...",
    "role": "Admin",
    "unit": "Bidang Ekonomi dan SDA",
    "status": "Aktif"
  }
}
```

### Documents

| Method | Endpoint     | Deskripsi           |
|--------|--------------|---------------------|
| GET    | `/api/docs`  | Ambil semua dokumen |
| POST   | `/api/docs`  | Upload dokumen baru |

**POST /api/docs body:**
```json
{
  "title": "Judul Dokumen",
  "type": "Kajian Ekonomi",
  "sector": "Pertanian & Pangan",
  "uploader": "Nama User",
  "url": "https://drive.google.com/...",
  "ukuran": "2.5 MB"
}
```

### Users

| Method | Endpoint          | Deskripsi             | Role    |
|--------|-------------------|-----------------------|---------|
| GET    | `/api/users`      | Ambil semua user      | Admin   |
| POST   | `/api/users`      | Tambah user baru      | Admin   |
| PUT    | `/api/users/:id`  | Update user           | Admin   |
| DELETE | `/api/users/:id`  | Hapus user            | Admin   |

### Audit Logs

| Method | Endpoint     | Deskripsi                |
|--------|--------------|--------------------------|
| GET    | `/api/logs`  | Ambil 100 log terbaru    |
| POST   | `/api/logs`  | Tambah log baru           |

### Kategori Dokumen

| Method | Endpoint                  | Deskripsi              |
|--------|---------------------------|------------------------|
| GET    | `/api/kategori-dokumen`   | Ambil semua kategori   |
| POST   | `/api/kategori-dokumen`   | Tambah kategori        |
| PUT    | `/api/kategori-dokumen/:id` | Update kategori      |
| DELETE | `/api/kategori-dokumen/:id` | Hapus kategori      |

### Health Check

| Method | Endpoint        | Deskripsi                  |
|--------|-----------------|----------------------------|
| GET    | `/api/health`   | Cek koneksi database       |

---

## Roles & Permissions

| Role     | Akses                                                       |
|----------|-------------------------------------------------------------|
| Admin    | Semua fitur + Manajemen Pengguna + Audit Trail + Kategori   |
| Reviewer | Dashboard, Dokumen, Upload, Pencarian, Portal Publik        |
| Staf     | Dashboard, Dokumen, Upload, Pencarian, Portal Publik        |

### Alur Persetujuan Dokumen

```
Staf Upload → Menunggu Review → Kabid Review → Menunggu Persetujuan
                                                  │
                                                  ├── Kepala Setujui → Diarsipkan
                                                  └── Ditolak
```

---

## Konfigurasi Environment

Buat file `.env` dari `.env.example`:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/peta_ekonomi
VITE_GAS_WEBAPP_URL=https://script.google.com/macros/s/xxx/exec
UPLOAD_API_KEY=
```

| Variable              | Deskripsi                                      | Required |
|-----------------------|------------------------------------------------|----------|
| `PORT`                | Port Express server                            | Opsional |
| `DATABASE_URL`        | Koneksi PostgreSQL                             | Ya       |
| `VITE_GAS_WEBAPP_URL` | URL Google Apps Script Web App                 | Ya       |
| `UPLOAD_API_KEY`      | API key untuk proteksi endpoint upload dari GAS | Opsional |

---

## Development

```bash
# Install dependensi
npm install

# Jalankan dev server (Vite + Express secara paralel)
npm run dev

# Akses aplikasi
http://localhost:5173
```

### Scripts

| Script           | Deskripsi                                    |
|------------------|----------------------------------------------|
| `npm run dev`    | Jalankan Vite + Express secara concurrent     |
| `npm run build`  | Build production ke folder `dist/`            |
| `npm run server` | Jalankan Express saja (production mode)       |
| `npm run preview`| Preview hasil build Vite                      |

---

## Deployment (Docker)

```bash
# Build image
docker build -t peta-ekonomi .

# Jalankan
docker run -p 3000:3000 --env-file .env peta-ekonomi
```

Dockerfile menggunakan multi-stage build:
1. **Builder stage:** Install dependensi + `npm run build` (Vite)
2. **Production stage:** Copy `dist/` + `server/`, install production deps, jalankan Express

Dalam mode produksi, Express menyajikan file statis dari `dist/` dan fallback ke `index.html` untuk SPA routing.

---

## Google Apps Script (GAS)

Fungsi GAS (`google-apps-script/Code.gs`):

1. **`doPost(e)`** — Menerima base64 file dari frontend, upload ke Google Drive, kirim metadata ke Express API.
2. **`doGet()`** — Health check.
3. **`doOptions()`** — CORS preflight.

### Deploy GAS:
1. Buka https://script.google.com → New project
2. Paste isi `Code.gs`
3. Deploy → New deployment → Web app
4. Execute as: Me, Access: Anyone
5. Copy URL → isikan ke `VITE_GAS_WEBAPP_URL` di `.env`

### Folder Drive
File di-upload ke folder: `https://drive.google.com/drive/folders/1yJXskcIfVjH-X7HWQh0b-BgnmTimkNQs`

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Login gagal "NIP atau password salah" | Jalankan `node server/setup_db.js` untuk seed user credentials |
| Upload gagal | Pastikan `VITE_GAS_WEBAPP_URL` benar di `.env` |
| Database connection error | Cek `DATABASE_URL` di `.env`, pastikan PostgreSQL running |
| Port sudah terpakai | Ganti `PORT` di `.env` atau gunakan `PORT=3001` |
