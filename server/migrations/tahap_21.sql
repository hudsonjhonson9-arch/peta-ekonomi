-- Tahap 21: Data Sektoral Lanjutan (Siklus Pemutakhiran & Lampiran Pendukung)
CREATE TABLE IF NOT EXISTS sd_pemutakhiran_siklus (
  id            BIGSERIAL PRIMARY KEY,
  dataset_id    BIGINT NOT NULL REFERENCES bank_dataset(id) ON DELETE CASCADE,
  periode_key   TEXT NOT NULL, -- Contoh: '2025', '2026-TW1', '2026-05'
  tipe          TEXT NOT NULL DEFAULT 'pemutakhiran' CHECK (tipe IN ('pemutakhiran', 'koreksi')),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'diajukan', 'disetujui', 'ditolak', 'diperbaiki')),
  catatan       TEXT,
  verified_by   TEXT,
  verified_at   TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ,
  submitted_by  TEXT,
  reopen_status TEXT CHECK (reopen_status IN ('menunggu', 'disetujui', 'ditolak')),
  reopen_alasan TEXT,
  reopen_by     TEXT,
  reopen_sampai TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dataset_id, periode_key, tipe)
);

CREATE INDEX IF NOT EXISTS idx_sd_siklus_dataset ON sd_pemutakhiran_siklus(dataset_id, periode_key);
CREATE INDEX IF NOT EXISTS idx_sd_siklus_status ON sd_pemutakhiran_siklus(status);

-- Lampiran Pendukung Dataset Sektoral
CREATE TABLE IF NOT EXISTS bank_dataset_lampiran (
  id            BIGSERIAL PRIMARY KEY,
  dataset_id    BIGINT NOT NULL REFERENCES bank_dataset(id) ON DELETE CASCADE,
  nama_file     TEXT NOT NULL,
  nama_asli     TEXT NOT NULL,
  url_file      TEXT NOT NULL,
  mime_type     TEXT,
  ukuran_bytes  BIGINT,
  keterangan    TEXT,
  uploaded_by   TEXT,
  periode_key   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_dataset_lampiran ON bank_dataset_lampiran(dataset_id);
