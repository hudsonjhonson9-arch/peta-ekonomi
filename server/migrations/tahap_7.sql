-- standar_harga: SSH/SBU dari SIPD (replace per tahun+jenis)
CREATE TABLE IF NOT EXISTS standar_harga (
  id BIGSERIAL PRIMARY KEY,
  tahun INT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('SSH','SBU')),
  kode_kelompok TEXT,
  uraian_kelompok TEXT,
  id_standar_harga TEXT,
  kode_barang TEXT,
  uraian_barang TEXT NOT NULL,
  spesifikasi TEXT,
  satuan TEXT,
  harga_satuan NUMERIC(15,2) NOT NULL CHECK (harga_satuan >= 0),
  kode_rekening TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS standar_harga_cari ON standar_harga (tahun, jenis, lower(uraian_barang));
ALTER TABLE pks_subkegiatan ADD COLUMN IF NOT EXISTS pagu NUMERIC(15,2);
ALTER TABLE pks_subkegiatan ADD COLUMN IF NOT EXISTS kode_rekening TEXT[];
