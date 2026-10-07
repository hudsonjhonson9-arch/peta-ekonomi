-- Screening RKA: alur validasi sub kegiatan (pola SIPD-RI) —
-- Draft → Menunggu → Disetujui/Ditolak.
--
-- Status disimpan per sub kegiatan: pelaku transisi terakhir (status_oleh),
-- waktunya (status_at), dan catatan validasi (catatan_validasi — wajib saat
-- Ditolak, dibersihkan saat diajukan ulang). Nilai status_validasi:
-- 'draft' | 'menunggu' | 'disetujui' | 'ditolak'.
ALTER TABLE pks_subkegiatan ADD COLUMN IF NOT EXISTS status_validasi VARCHAR(16) NOT NULL DEFAULT 'draft';
ALTER TABLE pks_subkegiatan ADD COLUMN IF NOT EXISTS catatan_validasi TEXT;
ALTER TABLE pks_subkegiatan ADD COLUMN IF NOT EXISTS status_oleh TEXT;
ALTER TABLE pks_subkegiatan ADD COLUMN IF NOT EXISTS status_at TIMESTAMPTZ;
