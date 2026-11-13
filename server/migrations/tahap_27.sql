-- ============================================================
-- Tahap 27: Salinan Google Drive untuk lampiran surat masuk
-- Sistem: ARSIP DIGITAL BAPPERIDA (peta-ekonomi)
-- ============================================================
-- Hasil pindai surat kini juga diunggah ke Google Drive (lewat web app
-- Apps Script yang sama dengan modul Dokumen). Kolom ini menyimpan tautan
-- salinannya; berkas utama tetap di file_url seperti sebelumnya.
-- IF NOT EXISTS membuat berkas ini idempoten saat dijalankan ulang.

ALTER TABLE agenda_surat_masuk ADD COLUMN IF NOT EXISTS drive_url TEXT;
