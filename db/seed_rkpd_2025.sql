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
INSERT INTO pks_kegiatan (kode, program_id, urutan, tahun)
SELECT d.kode, p.id, d.urutan, d.tahun FROM (VALUES
  ('5.01.01.2.01', '5.01.01', 1, 2025),
  ('5.01.01.2.02', '5.01.01', 2, 2025),
  ('5.01.01.2.06', '5.01.01', 3, 2025),
  ('5.01.01.2.07', '5.01.01', 4, 2025),
  ('5.01.01.2.08', '5.01.01', 5, 2025),
  ('5.01.01.2.09', '5.01.01', 6, 2025),
  ('5.01.02.2.01', '5.01.02', 1, 2025),
  ('5.01.02.2.03', '5.01.02', 2, 2025),
  ('5.01.03.2.01', '5.01.03', 1, 2025),
  ('5.01.03.2.02', '5.01.03', 2, 2025),
  ('5.01.03.2.03', '5.01.03', 3, 2025),
  ('5.05.02.2.01', '5.05', 1, 2025),
  ('5.05.02.2.04', '5.05', 2, 2025)
) AS d(kode, parent_kode, urutan, tahun)
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

-- ── Kertas Kerja / Output (90 baris) ──
-- bulan_wajib='*' = semua periode wajib. Deadline mengikuti frekuensi hasil target.
INSERT INTO kertas_kerja
  (subkegiatan_id, nama, indikator, frekuensi, target_per_tahun, bulan_wajib, deadline_rule, keterangan, created_by)
SELECT s.id, d.nama, d.indikator, d.frekuensi, d.target_per_tahun, '*', d.deadline_rule, d.keterangan, 'seed ' || d.tahun::text FROM (VALUES
  ('Renstra', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('Renja', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('Lakip', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('RKA', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('DPA Murni', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('DPA Perubahan', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('LPPD', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('RKT', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('PK', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('Anjab/ABK', 'Jumlah Laporan capaian kinerja dan ikhtisar Realisasi kinerja SKPD dan laporan Hasil Koordinasi penyusunan laporan capaian kinerja dan Ikhtisar Realisasi Kinerja SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.006'),
  ('Laporan Evaluasi Kinerja 4 TW', 'Jumlah Laporan Evaluasi Kinerja Perangkat Daerah', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.007'),
  ('Laporan RFK dan B1 Setiap Bulan', 'Jumlah Laporan Evaluasi Kinerja Perangkat Daerah', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.007'),
  ('Laporan Mendampingi Anggota DPRD', 'Jumlah Laporan Evaluasi Kinerja Perangkat Daerah', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.007'),
  ('Laporan Pendampingan Tamu dari Provinsi/Pemerintah Pusat', 'Jumlah Laporan Evaluasi Kinerja Perangkat Daerah', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.007'),
  ('Laporan dalam Rangka Mendampingi KDH dan Wakil KDH', 'Jumlah Laporan Evaluasi Kinerja Perangkat Daerah', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.01.007'),
  ('34 Orang/Bulan', 'Jumlah orang yang menerima gaji dan Tunjangan ASN', 'Lainnya', 34, 'year_end', 'Target sub kegiatan: 34 Orang/ Bulan', 2025, '5.01.01.2.02.0001'),
  ('Laporan Keuangan Bulanan/Triwulan/Semesteran dan Tahunan', 'Jumlah Laporan Keuangan Bulanan/Triwulan/Semesteran SKPD dan Laporan Koordinasi Penyusunan Laporan Keuangan Bulanan/Triwulan/Semesteran SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.02.0007'),
  ('Laporan Barang', 'Jumlah Laporan Keuangan Bulanan/Triwulan/Semesteran SKPD dan Laporan Koordinasi Penyusunan Laporan Keuangan Bulanan/Triwulan/Semesteran SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.02.0007'),
  ('Laporan RUP', 'Jumlah Laporan Keuangan Bulanan/Triwulan/Semesteran SKPD dan Laporan Koordinasi Penyusunan Laporan Keuangan Bulanan/Triwulan/Semesteran SKPD', 'Bulanan', 12, 'next_month:10', 'Target sub kegiatan: 12 Laporan', 2025, '5.01.01.2.02.0007'),
  ('Laporan Belanja Alat Listrik dan Elektronik', 'Jumlah Paket Komponen Instalasi Listrik/Penerangan Bangunan Kantor yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.01'),
  ('Mesin Potong Rumput (1 unit)', 'Jumlah Paket Peralatan dan Perlengkapan Kantor yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.02'),
  ('Komputer/PC-All In One (1 unit)', 'Jumlah Paket Peralatan dan Perlengkapan Kantor yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.02'),
  ('Laptop/Notebook (1 unit)', 'Jumlah Paket Peralatan dan Perlengkapan Kantor yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.02'),
  ('Printer (2 unit)', 'Jumlah Paket Peralatan dan Perlengkapan Kantor yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.02'),
  ('Hardisk Eksternal 500GB (2 unit)', 'Jumlah Paket Peralatan dan Perlengkapan Kantor yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.02'),
  ('Cetak dan Penggandaan Laporan Keuangan', 'Jumlah Paket Barang Cetakan dan Pengadaan yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.05'),
  ('Laporan Barang', 'Jumlah Paket Barang Cetakan dan Pengadaan yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.05'),
  ('SPJ', 'Jumlah Paket Barang Cetakan dan Pengadaan yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.05'),
  ('Surat Dinas', 'Jumlah Paket Barang Cetakan dan Pengadaan yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.05'),
  ('SK/Regulasi', 'Jumlah Paket Barang Cetakan dan Pengadaan yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Paket', 2025, '5.01.01.2.06.05'),
  ('Laporan Rakor sedaratan Sumba (Sumba Timur, SBD, ST)', 'Jumlah Laporan Penyelenggaraan Rapat Koordinasi dan Konsultasi SKPD', 'Lainnya', 20, 'year_end', 'Target sub kegiatan: 20 Laporan', 2025, '5.01.01.2.06.0009'),
  ('Laporan Rakor dalam Wilayah NTT', 'Jumlah Laporan Penyelenggaraan Rapat Koordinasi dan Konsultasi SKPD', 'Lainnya', 20, 'year_end', 'Target sub kegiatan: 20 Laporan', 2025, '5.01.01.2.06.0009'),
  ('Laporan Rakor Luar Wilayah NTT', 'Jumlah Laporan Penyelenggaraan Rapat Koordinasi dan Konsultasi SKPD', 'Lainnya', 20, 'year_end', 'Target sub kegiatan: 20 Laporan', 2025, '5.01.01.2.06.0009'),
  ('Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor', 'Jumlah Dokumen Penatausahaan Arsip Dinamis pada SKPD', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Dokumen', 2025, '5.01.01.2.06.10'),
  ('Kertas dan Cover', 'Jumlah Dokumen Penatausahaan Arsip Dinamis pada SKPD', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Dokumen', 2025, '5.01.01.2.06.10'),
  ('Bahan Cetak', 'Jumlah Dokumen Penatausahaan Arsip Dinamis pada SKPD', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Dokumen', 2025, '5.01.01.2.06.10'),
  ('Bahan Komputer dan Perabot Kantor', 'Jumlah Dokumen Penatausahaan Arsip Dinamis pada SKPD', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Dokumen', 2025, '5.01.01.2.06.10'),
  ('Kursi Rapat (10 buah)', 'Jumlah Paket Mebel yang disediakan', 'Semesteran', 2, 'semiannual_end:10', 'Target sub kegiatan: 2 Unit', 2025, '5.01.01.2.07.0005'),
  ('Meja Biro biasa (2 buah)', 'Jumlah Paket Mebel yang disediakan', 'Semesteran', 2, 'semiannual_end:10', 'Target sub kegiatan: 2 Unit', 2025, '5.01.01.2.07.0005'),
  ('Meja Ping Pong (1 unit)', 'Jumlah Paket Mebel yang disediakan', 'Semesteran', 2, 'semiannual_end:10', 'Target sub kegiatan: 2 Unit', 2025, '5.01.01.2.07.0005'),
  ('Laporan Belanja Pembayaran Rekening Listrik Kantor', 'Jumlah Laporan Penyedia Jasa Komunikasi, Sumber Daya Air, dan Listrik yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.01.2.08.02'),
  ('Laporan Internet Bandwidth 50 Mbps', 'Jumlah Laporan Penyedia Jasa Komunikasi, Sumber Daya Air, dan Listrik yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.01.2.08.02'),
  ('Laporan Pemeliharaan (Biaya Service Laptop dan Printer)', 'Jumlah Laporan Penyediaan Jasa Peralatan dan Perlengkapan Kantor yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.01.2.08.03'),
  ('Laporan Pengadaan Peralatan Kebersihan Kantor', 'Jumlah Laporan Penyediaan Jasa Pelayanan Umum Kantor yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.01.2.08.04'),
  ('Laporan Makan Minum Harian Pegawai', 'Jumlah Laporan Penyediaan Jasa Pelayanan Umum Kantor yang disediakan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.01.2.08.04'),
  ('Laporan Pajak Kendaraan Dinas Roda 4 (3 Unit) dan Roda 2 (12 Unit)', 'Jumlah Kendaraan dinas operasional atau lapangan yang dipelihara dan dibayarkan pajak dan perizinannya', 'Lainnya', 9, 'year_end', 'Target sub kegiatan: 9 Unit', 2025, '5.01.01.2.09.01'),
  ('Pemeliharaan 1 unit gedung/kantor', 'Jumlah Gedung Kantor dan Bangunan lainnya yang dipelihara/direhabilitasi', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Unit', 2025, '5.01.01.2.09.09'),
  ('2 Dokumen (RPJMD 2025-2029 dan Renstra PD 2025-2029)', 'Jumlah dokumen rancangan awal RPJMD/RKPD (Sesuai kebutuhan Jika RPJMD maka rancangan teknokratik)', 'Lainnya', 3, 'year_end', 'Target sub kegiatan: 3 Dokumen', 2025, '5.01.02.2.01.01'),
  ('1 Berita Acara Kegiatan Konsultasi Publik RPJMD', 'Jumlah Berita Acara Konsultasi Publik', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Berita Acara', 2025, '5.01.02.2.01.02'),
  ('1 Berita Acara Pelaksanaan Forum Perangkat Daerah', 'Jumlah Berita Acara Forum Perangkat Daerah/Lintas Perangkat Daerah', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Berita Acara', 2025, '5.01.02.2.01.04'),
  ('1 Berita Acara Pelaksanaan Musrenbang Kabupaten', 'Jumlah Berita Acara Musrenbang Kabupaten/Kota', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Berita Acara', 2025, '5.01.02.2.01.05'),
  ('30 Usulan prioritas dari 6 kecamatan sesuai program prioritas daerah', 'Jumlah Usulan yang terverifikasi oleh kecamatan', 'Lainnya', 30, 'year_end', 'Target sub kegiatan: 30 Usulan', 2025, '5.01.02.2.01.06'),
  ('2 Dokumen RKPD (Murni dan Perubahan)', 'Jumlah Dokumen Perencanaan Pembangunan Daerah Kabupaten/Kota yang ditetapkan (RPJPD/RPJMD/RKPD)', 'Triwulan', 4, 'quarter_end:10', 'Target sub kegiatan: 4 Dokumen', 2025, '5.01.02.2.01.07'),
  ('Evaluasi RKPD', 'Jumlah Laporan Hasil Evaluasi Kinerja Pembangunan Daerah', 'Semesteran', 2, 'semiannual_end:10', 'Target sub kegiatan: 2 Laporan', 2025, '5.01.02.2.03.03'),
  ('Aplikasi SIPD', 'Jumlah Laporan Hasil Evaluasi Kinerja Pembangunan Daerah', 'Semesteran', 2, 'semiannual_end:10', 'Target sub kegiatan: 2 Laporan', 2025, '5.01.02.2.03.03'),
  ('Laporan DAK', 'Jumlah Laporan Hasil Evaluasi Kinerja Pembangunan Daerah', 'Semesteran', 2, 'semiannual_end:10', 'Target sub kegiatan: 2 Laporan', 2025, '5.01.02.2.03.03'),
  ('Laporan Kegiatan Evaluasi Realisasi Indikator SPM Bidang Koordinasi Pemerintahan dan Sosial Budaya', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Daerah Bidang Pemerintahan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.02'),
  ('Laporan Kegiatan Penyusunan Dokumen RPJMD 2025-2029 Bidang Koordinasi Pemerintahan dan Sosial Budaya', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Daerah Bidang Pemerintahan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.02'),
  ('Laporan Kegiatan Penyusunan RKPD Bidang Pemerintahan dan Sosial Budaya', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Pembangunan Manusia', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.06'),
  ('Laporan Kegiatan Penyusunan Usulan DAK Bidang Pemerintahan dan Sosial Budaya', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Pembangunan Manusia', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.06'),
  ('Laporan Kegiatan Survey Kelayakan Bidang Pemerintahan dan Sosial Budaya', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Pembangunan Manusia', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.07'),
  ('Laporan Kegiatan Database Pendidikan dan Kesehatan', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Pembangunan Manusia', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.07'),
  ('Laporan Kegiatan Koordinasi Penyelenggaraan Kabupaten/Kota Sehat', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Pembangunan Manusia', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.07'),
  ('Laporan Kegiatan Taman Pawodda', 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja dengan RKPD dan RPJMD pada Bidang Pembangunan Manusia', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.08'),
  ('Laporan Kegiatan Kelompok Kerja Penurunan Stunting, ATM dan Integrasi Layanan Primer', 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja dengan RKPD dan RPJMD pada Bidang Pembangunan Manusia', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.08'),
  ('Laporan Kegiatan Rapat Koordinasi Bidang Pendidikan dan Kesehatan', 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja dengan RKPD dan RPJMD pada Bidang Pembangunan Manusia', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.01.08'),
  ('Laporan Kegiatan Rakor Bidang Ekonomi', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.02.02'),
  ('Desk RPJMD', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.02.02'),
  ('Laporan DAK Bikor Ekonomi', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.02.02'),
  ('Laporan Kegiatan Tim Koordinasi Sepakat Regsosek', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.02.03'),
  ('Laporan Survey Kelayakan Musrenbang', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.02.03'),
  ('Evaluasi RPJMD Bikor Ekonomi', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.02.03'),
  ('Rakor Dekon TP', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Perekonomian', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.02.03'),
  ('Laporan Kegiatan Tim Koordinasi Penanggulangan Kemiskinan', 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja dengan RKPD dan RPJMD pada Bidang Perekonomian', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.02.04'),
  ('Laporan Kegiatan Desk RKPD', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.02'),
  ('Desk Renja', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.02'),
  ('Desk Evaluasi Renstra Bidang Infrastruktur dan Potensi Wilayah', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.02'),
  ('Laporan Kegiatan Koordinasi Energi Baru Terbarukan', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.03'),
  ('Laporan Kegiatan Monitoring dan Evaluasi Proyek Infrastruktur', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.03'),
  ('Laporan Kegiatan Koordinasi Kerjasama dan Kebijakan Bidang Infrastruktur', 'Jumlah Laporan Hasil Pelaksanaan Monitoring dan Evaluasi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.03'),
  ('Laporan Kegiatan Pokja AMPL', 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja Dengan RKPD/RPJMD pada Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.04'),
  ('Laporan Kegiatan Desk DAK Bidang Infrastruktur', 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja Dengan RKPD/RPJMD pada Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.04'),
  ('Laporan Survey Kelayakan Usulan DAK Infrastruktur', 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja Dengan RKPD/RPJMD pada Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.04'),
  ('Laporan Kegiatan Pemutakhiran Dokumen SSK', 'Jumlah Laporan Hasil Sinkronisasi Renstra/Renja Dengan RKPD/RPJMD pada Bidang Infrastruktur', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.04'),
  ('Laporan Kegiatan Musrenbang Desa', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Kewilayahan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.0006'),
  ('Laporan Kegiatan Asistensi Renja Kecamatan', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Kewilayahan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.0006'),
  ('Laporan Koordinasi RPJMD', 'Jumlah Laporan Hasil Asistensi Penyusunan Dokumen Perencanaan Pembangunan Perangkat Daerah Bidang Kewilayahan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.01.03.2.03.0006'),
  ('Laporan Kegiatan IPKD', 'Jumlah Laporan Hasil Pelaksanaan Fasilitasi, Pelaksanaan dan Evaluasi Penelitian dan Pengembangan Bidang Keuangan dan Aset Daerah, Reformasi Birokrasi', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.05.02.2.01.003'),
  ('Laporan Fasilitasi Pelaksanaan dan Evaluasi Penelitian dan Pengembangan Bidang Kelembagaan dan Ketatalaksanaan', 'Jumlah Laporan Hasil Pelaksanaan Fasilitasi, Pelaksanaan dan Evaluasi Penelitian dan Pengembangan Bidang Kelembagaan dan Ketatalaksanaan', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Laporan', 2025, '5.05.02.2.01.005'),
  ('Laporan Kegiatan Inovasi Daerah', 'Jumlah Dokumen Hasil Penelitian, Pengembangan dan Rekayasa di Bidang Teknologi dan Inovasi', 'Tahunan', 1, 'year_end', 'Target sub kegiatan: 1 Dokumen', 2025, '5.05.02.2.04.01')
) AS d(nama, indikator, frekuensi, target_per_tahun, deadline_rule, keterangan, tahun, sub_kode)
JOIN pks_subkegiatan s ON s.kode = d.sub_kode AND s.tahun = d.tahun
ORDER BY s.urutan, s.kode, d.nama
ON CONFLICT (subkegiatan_id, nama) DO NOTHING;

COMMIT;

