-- Cek hasil install fitur Kertas Kerja.
-- Jalankan SEBELUM dan SESUDAH migration.

\echo '--- 1. Schema aktif dan apakah bapperida_dokumen terlihat ---'
SELECT current_schema() AS schema_aktif,
       current_database() AS database,
       (SELECT count(*)::int FROM information_schema.tables
         WHERE table_schema = current_schema()
           AND table_name = 'bapperida_dokumen') AS ada_bapperida_dokumen;

-- Kalau ada_bapperida_dokumen = 0, migration tahap_2 akan GAGAL total,
-- karena kertas_kerja_periode memakai FK ke tabel itu.

\echo '--- 2. Tabel Kertas Kerja (harus 6) ---'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = current_schema()
  AND table_name IN ('pks_tahun','pks_program','pks_kegiatan',
                     'pks_subkegiatan','kertas_kerja','kertas_kerja_periode')
ORDER BY table_name;

\echo '--- 3. Isi seed ---'
SELECT (SELECT count(*) FROM pks_program  WHERE tahun = 2025) AS program,
       (SELECT count(*) FROM pks_kegiatan WHERE tahun = 2025) AS kegiatan,
       (SELECT count(*) FROM pks_subkegiatan WHERE tahun = 2025) AS sub_kegiatan,
       (SELECT count(*) FROM kertas_kerja k
          JOIN pks_subkegiatan s ON s.id = k.subkegiatan_id
         WHERE s.tahun = 2025) AS output,
       (SELECT count(*) FROM kertas_kerja_periode WHERE tahun = 2025) AS periode;

-- Target program 4 / kegiatan 13 / sub 36 / output 90 / periode 0.
-- Periode sengaja 0: dibuat dari tombol Generate Periode di halaman Kertas Kerja.

\echo '--- 4. Sub kegiatan tanpa output (idealnya kosong) ---'
SELECT s.kode, s.nama
FROM pks_subkegiatan s
LEFT JOIN kertas_kerja k ON k.subkegiatan_id = s.id
WHERE s.tahun = 2025 AND k.id IS NULL;

\echo '--- 5. Output dengan target yang perlu ditinjau (lihat SEED_REVIEW.md) ---'
SELECT s.kode AS sub_kegiatan,
       s.target AS target_resmi,
       count(k.id) AS jumlah_output,
       sum(k.target_per_tahun) AS total_periode
FROM pks_subkegiatan s
LEFT JOIN kertas_kerja k ON k.subkegiatan_id = s.id
WHERE s.tahun = 2025
GROUP BY s.kode, s.target
HAVING sum(k.target_per_tahun) > 12
ORDER BY total_periode DESC;
