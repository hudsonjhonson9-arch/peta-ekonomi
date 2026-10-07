-- ============================================================
-- Duplikasi data tahun 2026 → 2027 (2026 TETAP ADA)
-- ============================================================
-- Salin seluruh data rencana tahun 2026 menjadi tahun 2027:
-- pohon PKS (program/kegiatan/sub kegiatan), kertas kerja + periode,
-- draft rincian belanja, standar harga SSH/SBU, dan data bank data.
--
-- Sifat: IDEMPOTEN — aman dijalankan berulang (ON CONFLICT / NOT EXISTS),
-- dan ATOMIC — satu transaksi, gagal = tidak ada yang berubah.
--
-- Cara menjalankan:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--        -f db/duplikasi_tahun_2026_ke_2027.sql
--
-- YANG TIDAK disalin (sengaja):
-- - bapperida_dokumen / doc_* / kertas_kerja_periode.doc_id
--   → bukti dokumen adalah evidensi tahun berjalan, tahun baru mulai kosong.
-- - screening_perubahan + screening_perubahan_item
--   → log snapshot perubahan; Admin inisiasi baru untuk 2027 (lihat blok
--     komentar di bagian K bila ternyata mau ikut disalin).
-- - bank_data_*_legacy / migrasi_bank_data lama yang sudah tidak dipakai.
-- ============================================================

BEGIN;

-- ── A. Safety: kolom tahap_11 (idempoten) ─────────────────────────────────
-- Dilakukan di sini supaya skrip ini tetap jalan bila server belum sempat
-- restart (migrasi tahap_11 memakai IF NOT EXISTS juga, jadi tidak bentrok).
ALTER TABLE draft_rincian ADD COLUMN IF NOT EXISTS kelompok_belanja TEXT;

-- ── B. Daftar tahun ───────────────────────────────────────────────────────
INSERT INTO pks_tahun (tahun) VALUES (2027)
ON CONFLICT (tahun) DO NOTHING;

-- ── C. Program ────────────────────────────────────────────────────────────
INSERT INTO pks_program (kode, nama, urutan, tahun, is_active)
SELECT kode, nama, urutan, 2027, is_active
FROM pks_program
WHERE tahun = 2026
ON CONFLICT (kode, tahun) DO NOTHING;

-- Peta id lama (2026) → id baru (2027) untuk program.
DROP TABLE IF EXISTS pg_temp.map_program;
CREATE TEMP TABLE map_program AS
SELECT o.id AS old_id, n.id AS new_id
FROM pks_program o
JOIN pks_program n ON n.kode = o.kode AND n.tahun = 2027
WHERE o.tahun = 2026;

-- ── D. Kegiatan (program_id dipetakan ke program 2027) ────────────────────
INSERT INTO pks_kegiatan (program_id, kode, nama, urutan, tahun, is_active)
SELECT m.new_id, k.kode, k.nama, k.urutan, 2027, k.is_active
FROM pks_kegiatan k
JOIN map_program m ON m.old_id = k.program_id
WHERE k.tahun = 2026
ON CONFLICT (kode, tahun) DO NOTHING;

DROP TABLE IF EXISTS pg_temp.map_kegiatan;
CREATE TEMP TABLE map_kegiatan AS
SELECT o.id AS old_id, n.id AS new_id
FROM pks_kegiatan o
JOIN pks_kegiatan n ON n.kode = o.kode AND n.tahun = 2027
WHERE o.tahun = 2026;

-- ── E. Sub kegiatan ───────────────────────────────────────────────────────
-- pagu & kode_rekening ikut disalin (modal awal tahun baru).
-- realisasi dan alur validasi TIDAK ikut: kolom sengaja tidak disebut,
-- sehingga realisasi = NULL dan status_validasi = DEFAULT 'draft'
-- (catatan_validasi/status_oleh/status_at ikut NULL).
INSERT INTO pks_subkegiatan
  (kegiatan_id, kode, nama, urutan, tahun, indikator, target, is_active,
   pagu, kode_rekening)
SELECT m.new_id, s.kode, s.nama, s.urutan, 2027, s.indikator, s.target, s.is_active,
       s.pagu, s.kode_rekening
FROM pks_subkegiatan s
JOIN map_kegiatan m ON m.old_id = s.kegiatan_id
WHERE s.tahun = 2026
ON CONFLICT (kode, tahun) DO NOTHING;

DROP TABLE IF EXISTS pg_temp.map_sub;
CREATE TEMP TABLE map_sub AS
SELECT o.id AS old_id, n.id AS new_id
FROM pks_subkegiatan o
JOIN pks_subkegiatan n ON n.kode = o.kode AND n.tahun = 2027
WHERE o.tahun = 2026;

-- ── F. Kertas kerja (output) milik sub kegiatan 2027 ──────────────────────
-- kertas_kerja tidak punya kolom tahun: ikut lewat sub kegiatan baru.
INSERT INTO kertas_kerja
  (subkegiatan_id, nama, indikator, frekuensi, target_per_tahun, bulan_wajib,
   deadline_rule, pic_id, keterangan, is_active, created_by)
SELECT m.new_id, k.nama, k.indikator, k.frekuensi, k.target_per_tahun, k.bulan_wajib,
       k.deadline_rule, k.pic_id, k.keterangan, k.is_active, k.created_by
FROM kertas_kerja k
JOIN map_sub m ON m.old_id = k.subkegiatan_id
ON CONFLICT (subkegiatan_id, nama) DO NOTHING;

DROP TABLE IF EXISTS pg_temp.map_kk;
CREATE TEMP TABLE map_kk AS
SELECT k.id AS old_id, n.id AS new_id
FROM kertas_kerja k
JOIN map_sub m ON m.old_id = k.subkegiatan_id
JOIN kertas_kerja n ON n.subkegiatan_id = m.new_id AND n.nama = k.nama;

-- ── G. Periode kertas kerja tahun 2027 ────────────────────────────────────
-- deadline digeser +1 tahun; doc_id/uploaded_* TIDAK disalin (bukti 2026
-- tetap menempel di 2026). is_wajib custom ikut. Endpoint generate di server
-- juga idempoten, jadi kalau FE nanti memanggil generate tidak akan dobel.
INSERT INTO kertas_kerja_periode
  (kertas_kerja_id, tahun, periode, periode_label, deadline, is_wajib)
SELECT n.new_id, 2027, p.periode, p.periode_label,
       (p.deadline + INTERVAL '1 year')::date, p.is_wajib
FROM kertas_kerja_periode p
JOIN map_kk n ON n.old_id = p.kertas_kerja_id
WHERE p.tahun = 2026
ON CONFLICT (kertas_kerja_id, tahun, periode) DO NOTHING;

-- ── H. Draft rincian belanja sub kegiatan 2027 ────────────────────────────
-- Tidak ada unique constraint, jadi penjaga idempoten: hanya menyalin bila
-- sub kegiatan 2027 masih kosong sama sekali.
INSERT INTO draft_rincian
  (subkegiatan_id, urutan, uraian, spesifikasi, satuan, volume, harga_satuan,
   kode_rekening, standar_harga_id, harga_standar, catatan, kelompok_belanja,
   created_by)
SELECT m.new_id, d.urutan, d.uraian, d.spesifikasi, d.satuan, d.volume, d.harga_satuan,
       d.kode_rekening, d.standar_harga_id, d.harga_standar, d.catatan,
       d.kelompok_belanja, d.created_by
FROM draft_rincian d
JOIN map_sub m ON m.old_id = d.subkegiatan_id
WHERE NOT EXISTS (
  SELECT 1 FROM draft_rincian x WHERE x.subkegiatan_id = m.new_id
);

-- ── I. Standar harga SSH/SBU tahun 2027 ───────────────────────────────────
-- Wajib: dropdown "Uraian" di input rincian query per tahun, kalau kosong
-- tidak ada komponen yang bisa dipilih.
INSERT INTO standar_harga
  (tahun, jenis, kode_kelompok, uraian_kelompok, id_standar_harga, kode_barang,
   uraian_barang, spesifikasi, satuan, harga_satuan, kode_rekening)
SELECT 2027, s.jenis, s.kode_kelompok, s.uraian_kelompok, s.id_standar_harga,
       s.kode_barang, s.uraian_barang, s.spesifikasi, s.satuan, s.harga_satuan,
       s.kode_rekening
FROM standar_harga s
WHERE s.tahun = 2026
  AND NOT EXISTS (
    SELECT 1 FROM standar_harga x
    WHERE x.tahun = 2027
      AND x.jenis = s.jenis
      AND x.uraian_barang = s.uraian_barang
      AND x.kode_barang IS NOT DISTINCT FROM s.kode_barang
      AND x.harga_satuan = s.harga_satuan
  );

-- ── J. Bank data (nilai per tahun) — OPSIONAL ─────────────────────────────
-- Menyalin target/capaian 2026 ke 2027 sebagai modal awal. Kalau tahun baru
-- mau mulai KOSONG, hapus/bungkus seluruh bagian ini dengan komentar.
INSERT INTO bank_data_tahun (tahun) VALUES (2027)
ON CONFLICT (tahun) DO NOTHING;

INSERT INTO bank_data_iku_nilai (iku_id, tahun, target, capaian)
SELECT iku_id, 2027, target, capaian
FROM bank_data_iku_nilai WHERE tahun = 2026
ON CONFLICT (iku_id, tahun) DO NOTHING;

INSERT INTO bank_data_iku_triwulan
  (iku_id, tahun, target_tw1, target_tw2, target_tw3, target_tw4,
   capaian_tw1, capaian_tw2, capaian_tw3, capaian_tw4)
SELECT iku_id, 2027, target_tw1, target_tw2, target_tw3, target_tw4,
       capaian_tw1, capaian_tw2, capaian_tw3, capaian_tw4
FROM bank_data_iku_triwulan WHERE tahun = 2026
ON CONFLICT (iku_id, tahun) DO NOTHING;

INSERT INTO bank_data_ikk_nilai (ikk_id, tahun, target, capaian)
SELECT ikk_id, 2027, target, capaian
FROM bank_data_ikk_nilai WHERE tahun = 2026
ON CONFLICT (ikk_id, tahun) DO NOTHING;

INSERT INTO bank_data_ikk_triwulan
  (ikk_id, tahun, target_tw1, target_tw2, target_tw3, target_tw4,
   capaian_tw1, capaian_tw2, capaian_tw3, capaian_tw4)
SELECT ikk_id, 2027, target_tw1, target_tw2, target_tw3, target_tw4,
       capaian_tw1, capaian_tw2, capaian_tw3, capaian_tw4
FROM bank_data_ikk_triwulan WHERE tahun = 2026
ON CONFLICT (ikk_id, tahun) DO NOTHING;

INSERT INTO bank_data_sektoral_nilai (indikator_id, tahun, data)
SELECT indikator_id, 2027, data
FROM bank_data_sektoral_nilai WHERE tahun = 2026
ON CONFLICT (indikator_id, tahun) DO NOTHING;

INSERT INTO bank_data_sektoral_triwulan
  (indikator_id, tahun, data_tw1, data_tw2, data_tw3, data_tw4)
SELECT indikator_id, 2027, data_tw1, data_tw2, data_tw3, data_tw4
FROM bank_data_sektoral_triwulan WHERE tahun = 2026
ON CONFLICT (indikator_id, tahun) DO NOTHING;

-- Menu "Indikator Ekonomi" (nilai_indikator masih dipakai route aktif).
-- Dibungkus to_regclass: tabel ini dibuat manual lewat migrasi lama, jadi
-- bisa saja belum ada di database tertentu.
DO $$
BEGIN
  IF to_regclass('public.nilai_indikator') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO nilai_indikator (indikator_id, tahun, nilai)
      SELECT indikator_id, 2027, nilai
      FROM nilai_indikator WHERE tahun = 2026
      ON CONFLICT (indikator_id, tahun) DO NOTHING
    $q$;
  END IF;
END $$;

-- ── K. Screening perubahan — TIDAK disalin (lihat catatan kepala skrip) ───
-- Bila ternyata mau ikut disalin, aktifkan blok ini (snapshot "sebelum"
-- akan menunjuk sub kegiatan 2027 hasil salinan):
--
-- INSERT INTO screening_perubahan (tahun, catatan, created_by)
-- SELECT 2027, catatan, created_by FROM screening_perubahan WHERE tahun = 2026;
-- INSERT INTO screening_perubahan_item
--   (perubahan_id, subkegiatan_id, sebelum_pagu, sebelum_rencana)
-- SELECT np.id, m.new_id, i.sebelum_pagu, i.sebelum_rencana
-- FROM screening_perubahan_item i
-- JOIN screening_perubahan op ON op.id = i.perubahan_id AND op.tahun = 2026
-- JOIN screening_perubahan np ON np.tahun = 2027 AND np.catatan IS NOT DISTINCT FROM op.catatan
-- JOIN map_sub m ON m.old_id = i.subkegiatan_id
-- WHERE NOT EXISTS (
--   SELECT 1 FROM screening_perubahan_item x
--   WHERE x.perubahan_id = np.id AND x.subkegiatan_id = m.new_id
-- );

COMMIT;

-- ============================================================
-- Verifikasi (jalankan terpisah, setelah COMMIT):
-- ============================================================
-- SELECT 'pks_tahun'      t, count(*) FROM pks_tahun      WHERE tahun IN (2026, 2027) GROUP BY 1
-- UNION ALL SELECT 'pks_program',     count(*) FROM pks_program     WHERE tahun IN (2026, 2027) GROUP BY 1
-- UNION ALL SELECT 'pks_kegiatan',    count(*) FROM pks_kegiatan    WHERE tahun IN (2026, 2027) GROUP BY 1
-- UNION ALL SELECT 'pks_subkegiatan', count(*) FROM pks_subkegiatan WHERE tahun IN (2026, 2027) GROUP BY 1
-- UNION ALL SELECT 'kertas_kerja_periode', count(*) FROM kertas_kerja_periode WHERE tahun IN (2026, 2027) GROUP BY 1
-- UNION ALL SELECT 'standar_harga',   count(*) FROM standar_harga   WHERE tahun IN (2026, 2027) GROUP BY 1
-- ORDER BY 1, 2;
