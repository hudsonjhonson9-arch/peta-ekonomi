-- ============================================================================
-- Tahap 17: Kolom Indikator Data Lengkap (Satu Data) pada bank_dataset
-- ============================================================================
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS urusan_id BIGINT REFERENCES sd_urusan(id) ON DELETE SET NULL;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS bidang_urusan_id BIGINT REFERENCES sd_bidang_urusan(id) ON DELETE SET NULL;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS topik_id BIGINT REFERENCES sd_topik(id) ON DELETE SET NULL;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS sub_topik_id BIGINT REFERENCES sd_sub_topik(id) ON DELETE SET NULL;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS satuan_id BIGINT REFERENCES sd_satuan(id) ON DELETE SET NULL;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS keywords JSONB DEFAULT '[]'::jsonb;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS kode_sds TEXT;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS kode_indikator TEXT;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS sumber_referensi TEXT;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS prioritas TEXT DEFAULT 'non_prioritas';
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS klasifikasi_risiko TEXT DEFAULT 'terbuka';
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS klasifikasi_penyajian TEXT;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS frekuensi_pemutakhiran TEXT DEFAULT 'Tahunan';
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS jadwal_pemutakhiran DATE;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS jadwal_pemutakhiran_akhir DATE;
