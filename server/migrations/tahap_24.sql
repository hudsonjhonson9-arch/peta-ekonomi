-- Tahap 24: Integrasi Dokumen SPM dengan Arsip Digital BAPPERIDA (Google Drive)
ALTER TABLE sd_spm_dokumen ADD COLUMN IF NOT EXISTS dokumen_arsip_id integer REFERENCES bapperida_dokumen(id) ON DELETE SET NULL;
ALTER TABLE sd_spm_dokumen ADD COLUMN IF NOT EXISTS drive_file_id text;

-- Index untuk performa join
CREATE INDEX IF NOT EXISTS idx_sd_spm_dokumen_arsip ON sd_spm_dokumen(dokumen_arsip_id);

