-- Tahap 15: tabel Dataset Sektoral Dinamis (adopsi Satu Data)
CREATE TABLE IF NOT EXISTS bank_dataset (
  id                  BIGSERIAL PRIMARY KEY,
  opd_id              BIGINT NOT NULL REFERENCES bank_data_opd(id) ON DELETE CASCADE,
  nama                TEXT NOT NULL,
  deskripsi           TEXT,
  definisi            TEXT,
  satuan              TEXT,
  sumber_data         TEXT,
  klasifikasi         TEXT NOT NULL DEFAULT 'terbuka'
                      CHECK (klasifikasi IN ('terbuka', 'terbatas', 'tertutup')),
  frekuensi           TEXT NOT NULL DEFAULT 'Tahunan'
                      CHECK (frekuensi IN ('Tahunan', 'Semesteran', 'Triwulan', 'Bulanan', 'Lainnya')),
  tahun_mulai         INTEGER,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'diajukan', 'disetujui', 'perlu_perbaikan', 'ditolak')),
  catatan_verifikasi  TEXT,
  created_by          TEXT,
  submitted_at        TIMESTAMPTZ,
  verified_by         TEXT,
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_dataset_opd_id ON bank_dataset(opd_id);
CREATE INDEX IF NOT EXISTS idx_bank_dataset_status ON bank_dataset(status);

CREATE TABLE IF NOT EXISTS bank_dataset_field (
  id            BIGSERIAL PRIMARY KEY,
  dataset_id    BIGINT NOT NULL REFERENCES bank_dataset(id) ON DELETE CASCADE,
  nama_field    TEXT NOT NULL,
  label         TEXT NOT NULL,
  tipe_data     TEXT NOT NULL DEFAULT 'teks'
                CHECK (tipe_data IN ('teks', 'angka', 'desimal', 'tanggal', 'pilihan')),
  wajib         BOOLEAN NOT NULL DEFAULT FALSE,
  urutan        INTEGER NOT NULL DEFAULT 0,
  pilihan       JSONB DEFAULT '[]'::jsonb,
  tampil_grafik BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (dataset_id, nama_field)
);

CREATE INDEX IF NOT EXISTS idx_bank_dataset_field_dataset ON bank_dataset_field(dataset_id, urutan);

CREATE TABLE IF NOT EXISTS bank_dataset_row (
  id            BIGSERIAL PRIMARY KEY,
  dataset_id    BIGINT NOT NULL REFERENCES bank_dataset(id) ON DELETE CASCADE,
  tahun         INTEGER NOT NULL,
  periode       TEXT,
  wilayah_kode  TEXT,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by    TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_dataset_row_key
  ON bank_dataset_row (dataset_id, tahun, COALESCE(periode, ''), COALESCE(wilayah_kode, ''));

CREATE INDEX IF NOT EXISTS idx_bank_dataset_row_dataset ON bank_dataset_row(dataset_id, tahun);

CREATE TABLE IF NOT EXISTS bank_dataset_log (
  id          BIGSERIAL PRIMARY KEY,
  dataset_id  BIGINT NOT NULL REFERENCES bank_dataset(id) ON DELETE CASCADE,
  aksi        TEXT NOT NULL,
  aktor       TEXT,
  catatan     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_dataset_log_dataset ON bank_dataset_log(dataset_id, created_at DESC);

