-- Tahap 22: SPM Lanjutan & Pelacakan Kunjungan Halaman (Page Visits)
CREATE TABLE IF NOT EXISTS sd_page_visits (
  id          BIGSERIAL PRIMARY KEY,
  path        TEXT NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  referrer    TEXT,
  user_id     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_page_visits_path ON sd_page_visits(path);
CREATE INDEX IF NOT EXISTS idx_sd_page_visits_created ON sd_page_visits(created_at DESC);

-- Kolom tambahan pada SPM jika diperlukan
ALTER TABLE sd_spm_capaian ADD COLUMN IF NOT EXISTS target_persen NUMERIC(5,2);
ALTER TABLE sd_spm_capaian ADD COLUMN IF NOT EXISTS realisasi_persen NUMERIC(5,2);
ALTER TABLE sd_spm_capaian ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE sd_spm_capaian ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
