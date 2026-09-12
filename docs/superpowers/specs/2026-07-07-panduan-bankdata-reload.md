# Panduan Pengguna, Fix Reload, Bank Data — Peta Ekonomi

## Masalah
1. **Reload selalu ke dashboard** — state-based routing (`useState`) tidak persist antar reload
2. **Panduan Pengguna hanya file markdown** — tidak accessible dari dalam app
3. **Tidak ada Bank Data** — user tidak bisa menyimpan & menampilkan indikator ekonomi

## Pendekatan
Semua perubahan minimal — ikut pola kode yang ada (inline CSS, state-based routing, no new dependencies).

## Design

### 1. Fix Reload — SessionStorage
- `goPage(p)` → tambah `sessionStorage.setItem("page", p)`
- `useState("dashboard")` → jadi `useState(sessionStorage.getItem("page") || "dashboard")`
- 2 baris di `App.jsx`, zero dependencies

### 2. Panduan Pengguna
- Komponen baru `PanduanPengguna.jsx` di `src/components/`
- Entry di Sidebar NAV array + BottomNav — non-admin, semua role
- Konten dari `docs/PANDUAN.md` ditulis ulang jadi halaman HTML interaktif
- Setiap bagian disertai screenshot asli app (diambil via browser tools)
- Bagian: Dashboard, Dokumen, Upload, Pencarian, Portal Publik, Pengguna & Role, Troubleshooting

### 3. Bank Data

#### Database — 2 tabel baru:

```sql
CREATE TABLE indikator (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  satuan VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nilai_indikator (
  id SERIAL PRIMARY KEY,
  indikator_id INTEGER REFERENCES indikator(id) ON DELETE CASCADE,
  tahun INTEGER NOT NULL,
  nilai DECIMAL(20,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(indikator_id, tahun)
);

CREATE TABLE indikator_tampil (
  id SERIAL PRIMARY KEY,
  indikator_id INTEGER REFERENCES indikator(id) ON DELETE CASCADE UNIQUE,
  urutan INTEGER NOT NULL DEFAULT 0
);
```

#### API Endpoints:

| Method | Endpoint | Keterangan |
|--------|----------|-----------|
| GET | `/api/indikator` | Semua indikator + nilai per-tahun |
| POST | `/api/indikator` | Tambah indikator |
| PUT | `/api/indikator/:id` | Edit indikator |
| DELETE | `/api/indikator/:id` | Hapus indikator + nilai terkait |
| POST | `/api/nilai` | Upsert nilai (indikator_id, tahun, nilai) |
| DELETE | `/api/nilai/:id` | Hapus nilai |
| GET | `/api/indikator/tampil` | Indikator yang dipilih untuk dashboard |
| POST | `/api/indikator/tampil` | Simpan/toggle pilihan (indikator_id) |

#### Komponen:

**BankData.jsx** (halaman manajemen — Admin only):
- Tabel daftar indikator dengan tombol edit/hapus/toggle tampil
- Form tambah indikator (nama + satuan)
- Expand/accordion tiap indikator untuk input nilai per tahun
- Input nilai: tahun (number) + nilai (text/float) + tombol simpan
- Tombol toggle "Tampilkan di Dashboard"

**Dashboard.jsx — modifikasi**:
- Section baru di bawah charts: "Bank Data"
- Tabel: baris = indikator, kolom = tahun, sel = nilai
- Hanya menampilkan indikator yang di-toggle tampil
- Kosongkan jika belum ada yang dipilih

## Dependencies
- Tidak ada dependency baru — pakai React Query (existing) + Express (existing)
