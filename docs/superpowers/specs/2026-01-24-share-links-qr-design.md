# Design: Tautan Berbagi dengan Masa Berlaku + QR/Kode Verifikasi Dokumen

**Tanggal:** 2026-01-24
**Status:** Disetujui

## Ringkasan

Dua fitur baru untuk dokumen arsip:
1. **Tautan berbagi** — generate link ber masa berlaku untuk share dokumen
2. **QR & kode verifikasi** — QR code + kode unik 8-char untuk verifikasi keaslian dokumen

## Context

- Proyek: peta-ekonomi (Arsip Digital BAPPERIDA)
- Stack: Express.js + PostgreSQL + React
- Mode: lokal dulu (dev), belum production deploy
- Semua user login boleh membuat tautan berbagi

## Database

Tabel baru `doc_shares`:

```sql
CREATE TABLE IF NOT EXISTS doc_shares (
  id            SERIAL PRIMARY KEY,
  doc_id        INT NOT NULL REFERENCES bapperida_dokumen(id),
  token         TEXT NOT NULL UNIQUE,      -- 8-char unik untuk URL
  verif_code    TEXT NOT NULL UNIQUE,      -- 8-char kode verifikasi
  expires_at    TIMESTAMPTZ,              -- NULL = selamanya
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_doc_shares_token ON doc_shares(token);
CREATE INDEX idx_doc_shares_verif ON doc_shares(verif_code);
```

## API Endpoints

### 1. Buat tautan share

```
POST /api/docs/:id/shares
Body: { expiresIn: "24h" }  // "1h" | "24h" | "7d" | "30d" | "custom"
       atau { expiresIn: "custom", customExpiresAt: "2026-02-01T00:00:00Z" }

Response: { share: { id, token, verif_code, expires_at, created_at } }
```

### 2. List tautan aktif

```
GET /api/docs/:id/shares

Response: { shares: [{ id, token, verif_code, expires_at, created_at, is_active }] }
```

### 3. Revoke tautan

```
DELETE /api/docs/:id/shares/:shareId

Response: { ok: true }
```

### 4. Akses dokumen via token (public, no auth)

```
GET /api/publik?token=ABC12345

Response: { doc: { id, judul, kategori, tipe, ... }, download_url: "..." }
Error 404: { error: "Tautan tidak valid atau sudah kedaluwarsa" }
```

### 5. Verifikasi dokumen via kode (public, no auth)

```
GET /api/publik/verify?code=A3K9-M2X7

Response: {
  doc: { id, judul, kategori, tipe, ... },
  verified: true,
  verified_at: "...",
  share: { created_at, expires_at }
}
Error 404: { error: "Kode verifikasi tidak valid" }
```

## Token Generation

- `token`: 8 karakter alphanumeric, di-generate pakai `crypto.randomBytes(4).toString('hex').toUpperCase()` → 8 hex chars
- `verif_code`: format `XXXX-XXXX`, di-generate pakai `crypto.randomBytes(4).toString('hex').toUpperCase()` → split dengan dash

## UI

### Modal Berbagi (di detail dokumen)

Tombol **"Bagikan"** di halaman detail dokumen → buka modal:

1. **Pilih durasi**: tombol group — 1 Jam, 24 Jam, 7 Hari, 30 Hari, Kustom
2. **Tombol "Buat Tautan"** → POST ke server → tampilkan hasil
3. **List tautan aktif**: URL + masa berlaku + tombol Copy/QR/Revoke
4. **QR & Kode Verifikasi**: QR code image + kode 8-char + tombol Copy

QR code di-generate client-side pakai library `qrcode` (npm package).

### Portal Publik — Input Kode Verifikasi

Di halaman Portal Publik (`/#publik`), tambah input field:

```
[ Masukkan kode verifikasi ] [ Verifikasi ]
```

- Klik "Verifikasi" → GET `/api/publik/verify?code=...`
- Valid: tampilkan info dokumen + tombol download
- Invalid/expired: pesan error

## Dependencies Baru

- **Backend**: Tidak ada — pakai `crypto` built-in Node.js
- **Frontend**: `qrcode` (npm) untuk generate QR code client-side

## Scope

- Lokal dulu (dev server)
- Tidak ada cleanup job untuk expired shares (handle saat query)
- Tidak ada email notification saat share dibuat
- QR encode URL tautan + kode verifikasi (bisa keduanya atau dipisah)
