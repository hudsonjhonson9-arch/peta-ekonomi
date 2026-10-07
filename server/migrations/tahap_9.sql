-- Screening RKA: perubahan anggaran — inisiasi Admin per tahun.
--
-- Admin menginisiasi perubahan pada tahun tertentu. Saat inisiasi, sistem
-- memsnapshot pagu + total rencana (draft_rincian) tiap sub kegiatan sebagai
-- nilai "sebelum perubahan"; nilai live setelahnya = "sesudah perubahan".
CREATE TABLE IF NOT EXISTS screening_perubahan (
  id BIGSERIAL PRIMARY KEY,
  tahun INT NOT NULL,
  catatan TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS screening_perubahan_tahun_idx ON screening_perubahan (tahun, created_at DESC);

CREATE TABLE IF NOT EXISTS screening_perubahan_item (
  id BIGSERIAL PRIMARY KEY,
  perubahan_id BIGINT NOT NULL REFERENCES screening_perubahan(id) ON DELETE CASCADE,
  subkegiatan_id BIGINT NOT NULL REFERENCES pks_subkegiatan(id) ON DELETE CASCADE,
  sebelum_pagu NUMERIC(15,2),
  sebelum_rencana NUMERIC(15,2) NOT NULL DEFAULT 0,
  UNIQUE (perubahan_id, subkegiatan_id)
);
CREATE INDEX IF NOT EXISTS screening_perubahan_item_sub_idx ON screening_perubahan_item (subkegiatan_id);

-- Realisasi anggaran per sub kegiatan (diisi Admin di Screening RKA).
ALTER TABLE pks_subkegiatan ADD COLUMN IF NOT EXISTS realisasi NUMERIC(15,2);
