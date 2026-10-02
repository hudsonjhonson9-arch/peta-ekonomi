-- Seed struktur PKS/Kertas Kerja tahun 2025
-- Sumber: tabel RKPD 2025 Bapperida (4 program / 13 kegiatan / 36 sub kegiatan / 90 output).

-- PENTING: file ini TIDAK membuat periode. Jumlah periode = target_per_tahun,
-- jadi membuat periode otomatis akan menghasilkan ratusan baris, dan sebagian
-- target di bawah bukan jumlah dokumen (Orang/Unit/Paket/Usulan).
-- Admin harus meninjau SEED_REVIEW.md dulu, lalu membuat periode per output
-- lewat tombol kalender di halaman Kertas Kerja.

BEGIN;

-- ═══ Tahun ═══
INSERT INTO pks_tahun (tahun) VALUES (2025) ON CONFLICT (tahun) DO NOTHING;

-- ── Program (4 baris) ──
INSERT INTO pks_program (kode, nama, urutan, tahun) VALUES
  ('5.01.01', 'Prog. Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', 1, 2025),
  ('5.01.02', 'Prog. Perencanaan Pengendalian dan Evaluasi Pembangunan Daerah', 2, 2025),
  ('5.01.03', 'Prog. Koordinasi dan Sinkronisasi Perencanaan Pembangunan Daerah', 3, 2025),
  ('5.05', 'Prog. Penelitian dan Pengembangan Daerah', 4, 2025)
ON CONFLICT (kode, tahun) DO NOTHING;

-- ── Kegiatan (13 baris) ──
INSERT INTO pks_kegiatan (kode, nama, program_id, urutan, tahun)
SELECT d.kode, d.nama, p.id, d.urutan, d.tahun FROM (VALUES
  ('5.01.01.2.01', 'Keg. Perencanaan, Penganggaran dan Evaluasi Kinerja Perangkat Daerah', '5.01.01', 1, 2025),
  ('5.01.01.2.02', 'Keg. Administrasi Keuangan Perangkat Daerah', '5.01.01', 2, 2025),
  ('5.01.01.2.06', 'Keg. Administrasi Umum Perangkat Daerah', '5.01.01', 3, 2025),
  ('5.01.01.2.07', 'Keg. Pengadaan Barang Milik Daerah Penunjang Urusan Pemerintahan Daerah', '5.01.01', 4, 2025),
  ('5.01.01.2.08', 'Keg. Penyediaan Jasa Penunjang Urusan Pemerintahan Daerah', '5.01.01', 5, 2025),
  ('5.01.01.2.09', 'Keg. Pemeliharaan Barang Milik Daerah Penunjang Urusan Pemerintah Daerah', '5.01.01', 6, 2025),
  ('5.01.02.2.01', 'Keg. Penyusunan Perencanaan dan Pendanaan', '5.01.02', 1, 2025),
  ('5.01.02.2.03', 'Keg. Pengendalian, Evaluasi dan Pelaporan Bidang Perencanaan Pembangunan Daerah', '5.01.02', 2, 2025),
  ('5.01.03.2.01', 'Keg. Koordinasi Perencanaan Bidang Pemerintahan dan Pembangunan Manusia', '5.01.03', 1, 2025),
  ('5.01.03.2.02', 'Keg. Koordinasi Perencanaan Bidang Perekonomian dan SDA (Sumber Daya Alam)', '5.01.03', 2, 2025),
  ('5.01.03.2.03', 'Keg. Koordinasi Perencanaan Bidang Infrastruktur dan Kewilayahan', '5.01.03', 3, 2025),
  ('5.05.02.2.01', 'Keg. Penelitian dan Pengembangan Bidang Penyelenggaraan Pemerintah dan Pengkajian Peraturan', '5.05', 1, 2025),
  ('5.05.02.2.04', 'Keg. Pengembangan Inovasi dan Teknologi', '5.05', 2, 2025)
) AS d(kode, nama, parent_kode, urutan, tahun)
JOIN pks_program p ON p.kode = d.parent_kode AND p.tahun = d.tahun
ON CONFLICT (kode, tahun) DO NOTHING;

-- ── Sub Kegiatan (13 kegiatan → 36 sub) ──
INSERT INTO pks_subkegiatan (kode, kegiatan_id, nama, urutan, tahun, indikator, target)
SELECT d.kode, k.id, d.nama, d.urutan, d.tahun, d.indikator, d.target FROM (VALUES
  ('5.01.01.2.01.006', '5.01.01.2.01', 'Koordinasi dan Penyusunan Laporan Capaian Kinerja dan Ikhtisar Kinerja SKPD', 1, 2025, 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', '12 Laporan'),
  ('5.01.01.2.01.007', '5.01.01.2.01', 'Evaluasi Kinerja Perangkat Daerah', 2, 2025, 'Jumlah Laporan Evaluasi Kinerja Perangkat Daerah', '12 Laporan'),
  ('5.01.01.2.02.0001', '5.01.01.2.02', 'Penyediaan Gaji dan Tunjangan ASN', 1, 2025, 'Jumlah orang yang menerima gaji dan Tunjangan ASN', '34 Orang/ Bulan'),
  ('5.01.01.2.02.0007', '5.01.01.2.02', 'Koordinasi dan Penyusunan Laporan Keuangan Bulanan/Triwulan/Semesteran SKPD', 2, 2025, 'Jumlah Laporan Keuangan Bulanan/Triwulan/Semesteran SKPD dan Laporan Koordinasi Penyusunan Laporan Keuangan Bulanan/Triwulan/Semesteran SKPD', '12 Laporan'),
  ('5.01.01.2.06.01', '5.01.01.2.06', 'Penyediaan Komponen Instalasi Listrik/Penerangan Bangunan Kantor', 1, 2025, 'Jumlah Paket Komponen Instalasi Listrik/Penerangan Bangunan Kantor yang disediakan', '1 Paket'),
  ('5.01.01.2.06.02', '5.01.01.2.06', 'Penyediaan Peralatan dan Perlengkapan Kantor', 2, 2025, 'Jumlah Paket Peralatan dan Perlengkapan Kantor yang disediakan', '1 Paket'),
  ('5.01.01.2.06.05', '5.01.01.2.06', 'Penyediaan Barang Cetakan dan Penggandaan', 3, 2025, 'Jumlah Paket Barang Cetakan dan Pengadaan yang disediakan', '1 Paket'),
  ('5.01.01.2.06.0009', '5.01.01.2.06', 'Penyelenggaraan Rapat Koordinasi dan Konsultasi SKPD', 4, 2025, 'Jumlah Laporan Penyelenggaraan Rapat Koordinasi dan Konsultasi SKPD', '20 Laporan'),
  ('5.01.01.2.06.10', '5.01.01.2.06', 'Penatausahaan Arsip Dinamis Pada SKPD', 5, 2025, 'Jumlah Dokumen Penatausahaan Arsip Dinamis pada SKPD', '1 Dokumen'),
  ('5.01.01.2.07.0005', '5.01.01.2.07', 'Pengadaan Mebel', 1, 2025, 'Jumlah Paket Mebel yang disediakan', '2 Unit'),
  ('5.01.01.2.08.02', '5.01.01.2.08', 'Penyediaan Jasa Komunikasi, Sumber Daya Air dan Listrik', 1, 2025, 'Jumlah Laporan Penyedia Jasa Komunikasi, Sumber Daya Air, dan Listrik yang disediakan', '1 Laporan'),
  ('5.01.01.2.08.03', '5.01.01.2.08', 'Penyediaan Jasa Peralatan dan Perlengkapan Kantor', 2, 2025, 'Jumlah Laporan Penyediaan Jasa Peralatan dan Perlengkapan Kantor yang disediakan', '1 Laporan'),
  ('5.01.01.2.08.04', '5.01.01.2.08', 'Penyediaan Jasa Pelayanan Kantor', 3, 2025, 'Jumlah Laporan Penyediaan Jasa Pelayanan Umum Kantor yang disediakan', '1 Laporan'),
  ('5.01.01.2.09.01', '5.01.01.2.09', 'Penyediaan Jasa Pemeliharaan, Biaya Pemeliharaan dan Pajak Kendaraan Perorangan Dinas atau Kendaraan Jabatan', 1, 2025, 'Jumlah Kendaraan dinas operasional atau lapangan yang dipelihara dan dibayarkan pajak dan perizinannya', '9 Unit'),
  ('5.01.01.2.09.09', '5.01.01.2.09', 'Pemeliharaan/Rehabilitasi Gedung Kantor dan Bangunan Lainnya', 2, 2025, 'Jumlah Gedung Kantor dan Bangunan lainnya yang dipelihara/direhabilitasi', '1 Unit'),
  ('5.01.02.2.01.01', '5.01.02.2.01', 'Analisis Kondisi Daerah Permasalahan dan Isu Strategis Pembangunan Daerah', 1, 2025, 'Jumlah dokumen rancangan awal RPJMD/RKPD (Sesuai kebutuhan Jika RPJMD maka rancangan teknokratik)', '3 Dokumen'),
  ('5.01.02.2.01.02', '5.01.02.2.01', 'Pelaksanaan Konsultasi Publik', 2, 2025, 'Jumlah Berita Acara Konsultasi Publik', '1 Berita Acara'),
  ('5.01.02.2.01.04', '5.01.02.2.01', 'Koordinasi Pelaksanaan Forum Perangkat Daerah/Lintas Perangkat Daerah', 3, 2025, 'Jumlah Berita Acara Forum Perangkat Daerah/Lintas Perangkat Daerah', '1 Berita Acara'),
  ('5.01.02.2.01.05', '5.01.02.2.01', 'Pelaksanaan Musrenbang Kabupaten/Kota', 4, 2025, 'Jumlah Berita Acara Musrenbang Kabupaten/Kota', '1 Berita Acara'),
  ('5.01.02.2.01.06', '5.01.02.2.01', 'Penyiapan Bahan Koordinasi Musrenbang Kecamatan', 5, 2025, 'Jumlah Usulan yang terverifikasi oleh kecamatan', '30 Usulan'),
  ('5.01.02.2.01.07', '5.01.02.2.01', 'Koordinasi Penyusunan dan Penetapan Dokumen Perencanaan Pembangunan Daerah Kabupaten/Kota', 6, 2025, 'Jumlah Dokumen Perencanaan Pembangunan Daerah Kabupaten/Kota yang ditetapkan (RPJPD/RPJMD/RKPD)', '4 Dokumen'),
  ('5.01.02.2.03.03', '5.01.02.2.03', 'Monitoring, Evaluasi dan Penyusunan Laporan Berkala Pelaksanaan Pembangunan Daerah', 1, 2025, 'Jumlah Laporan Hasil Evaluasi Kinerja Pembangunan Daerah', '2 Laporan'),
  ('5.01.03.2.01.02', '5.01.03.2.01', 'Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Pemerintahan', 1, 2025, 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Daerah Bidang Pemerintahan', '1 Laporan'),
  ('5.01.03.2.01.06', '5.01.03.2.01', 'Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Pembangunan Manusia', 2, 2025, 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Pembangunan Manusia', '1 Laporan'),
  ('5.01.03.2.01.07', '5.01.03.2.01', 'Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Daerah Bidang Pembangunan Manusia', 3, 2025, 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Pembangunan Manusia', '1 Laporan'),
  ('5.01.03.2.01.08', '5.01.03.2.01', 'Koordinasi Pelaksanaan Sinergitas dan Harmonisasi Perencanaan Pembangunan Daerah Bidang Pembangunan Manusia', 4, 2025, 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja dengan RKPD dan RPJMD pada Bidang Pembangunan Manusia', '1 Laporan'),
  ('5.01.03.2.02.02', '5.01.03.2.02', 'Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', 1, 2025, 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', '1 Laporan'),
  ('5.01.03.2.02.03', '5.01.03.2.02', 'Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Daerah Bidang Perekonomian', 2, 2025, 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', '1 Laporan'),
  ('5.01.03.2.02.04', '5.01.03.2.02', 'Koordinasi Pelaksanaan Sinergitas dan Harmonisasi Perencanaan Pembangunan Daerah Bidang Perekonomian', 3, 2025, 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja dengan RKPD dan RPJMD pada Bidang Perekonomian', '1 Laporan'),
  ('5.01.03.2.03.02', '5.01.03.2.03', 'Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Infrastruktur', 1, 2025, 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Infrastruktur', '1 Laporan'),
  ('5.01.03.2.03.03', '5.01.03.2.03', 'Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Daerah Bidang Infrastruktur', 2, 2025, 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Infrastruktur', '1 Laporan'),
  ('5.01.03.2.03.04', '5.01.03.2.03', 'Koordinasi Pelaksanaan Sinergitas dan Harmonisasi Perencanaan Pembangunan Daerah Bidang Infrastruktur', 3, 2025, 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja Dengan RKPD/RPJMD pada Bidang Infrastruktur', '1 Laporan'),
  ('5.01.03.2.03.0006', '5.01.03.2.03', 'Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Bidang Kewilayahan', 4, 2025, 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Kewilayahan', '1 Laporan'),
  ('5.05.02.2.01.003', '5.05.02.2.01', 'Fasilitasi dan Evaluasi Penelitian dan Pengembangan Bidang Keuangan, Aset Daerah, Reformasi Birokrasi', 1, 2025, 'Jumlah Laporan Hasil Pelaksanaan Fasilitasi, Pelaksanaan dan Evaluasi Penelitian dan Pengembangan Bidang Keuangan dan Aset Daerah, Reformasi Birokrasi', '1 Laporan'),
  ('5.05.02.2.01.005', '5.05.02.2.01', 'Fasilitasi dan Evaluasi Penelitian dan Pengembangan Bidang Kelembagaan dan Ketatalaksanaan', 2, 2025, 'Jumlah Laporan Hasil Pelaksanaan Fasilitasi, Pelaksanaan dan Evaluasi Penelitian dan Pengembangan Bidang Kelembagaan dan Ketatalaksanaan', '1 Laporan'),
  ('5.05.02.2.04.01', '5.05.02.2.04', 'Penelitian, Pengembangan dan Rekayasa di Bidang Teknologi dan Inovasi', 1, 2025, 'Jumlah Dokumen Hasil Penelitian, Pengembangan dan Rekayasa di Bidang Teknologi dan Inovasi', '1 Dokumen')
) AS d(kode, kegiatan_kode, nama, urutan, tahun, indikator, target)
JOIN pks_kegiatan k ON k.kode = d.kegiatan_kode AND k.tahun = d.tahun
ON CONFLICT (kode, tahun) DO NOTHING;

-- ── Kertas Kerja / Output: SENGAJA TIDAK DI-SEED ───────────────────────
-- Output tidak lagi dibuat dari kolom Output RKPD. Data lama berisi barang
-- dan jasa (Bahan Cetak, Hardisk 500GB), bukan dokumen yang diunggah user.
-- Sekarang output beserta deadline-nya sepenuhnya ditentukan admin lewat UI.
--
-- Admin menambah output per sub kegiatan, lalu mengisi tanggal deadline tiap
-- periode. db/validate-seed.cjs menegakkan file ini tidak membuat output.
-- Output hasil seed lama (90 baris) dihapus lewat migration tahap_3.sql.

COMMIT;

