-- draft_rincian: rencana belanja per sub kegiatan (LOGIN CRUD)
CREATE TABLE IF NOT EXISTS draft_rincian (
  id BIGSERIAL PRIMARY KEY,
  subkegiatan_id BIGINT NOT NULL REFERENCES pks_subkegiatan(id) ON DELETE CASCADE,
  urutan INT NOT NULL DEFAULT 0,
  uraian TEXT NOT NULL,
  spesifikasi TEXT,
  satuan TEXT NOT NULL,
  volume NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (volume > 0),
  harga_satuan NUMERIC(15,2) NOT NULL CHECK (harga_satuan >= 0),
  kode_rekening TEXT,
  standar_harga_id BIGINT REFERENCES standar_harga(id) ON DELETE SET NULL,
  harga_standar NUMERIC(15,2),           -- snapshot saat dicocokkan
  catatan TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS draft_rincian_sub_idx ON draft_rincian (subkegiatan_id, urutan);
