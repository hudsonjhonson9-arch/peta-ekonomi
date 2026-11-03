-- ============================================================================
-- Tahap 16: Master Data Satu Data, Standar Pelayanan Minimal (SPM),
--           Kelola Konten Portal, dan Monitoring & Sistem
-- ============================================================================

-- 1. Perluas bank_data_opd untuk Master OPD lengkap
ALTER TABLE bank_data_opd ADD COLUMN IF NOT EXISTS kode_opd TEXT;
ALTER TABLE bank_data_opd ADD COLUMN IF NOT EXISTS singkatan TEXT;
ALTER TABLE bank_data_opd ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE bank_data_opd ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Master Urusan Pemerintahan (Permendagri 90/2019)
CREATE TABLE IF NOT EXISTS sd_urusan (
  id           BIGSERIAL PRIMARY KEY,
  kode_urusan  TEXT UNIQUE NOT NULL,
  nama_urusan  TEXT NOT NULL,
  keterangan   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Master Bidang Urusan Pemerintahan
CREATE TABLE IF NOT EXISTS sd_bidang_urusan (
  id           BIGSERIAL PRIMARY KEY,
  urusan_id    BIGINT NOT NULL REFERENCES sd_urusan(id) ON DELETE CASCADE,
  kode_bidang  TEXT UNIQUE NOT NULL,
  nama_bidang  TEXT NOT NULL,
  keterangan   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sd_bidang_urusan_urusan ON sd_bidang_urusan(urusan_id);

-- 4. Hak Akses Urusan per OPD
CREATE TABLE IF NOT EXISTS sd_hak_akses_urusan (
  id                BIGSERIAL PRIMARY KEY,
  opd_id            BIGINT NOT NULL REFERENCES bank_data_opd(id) ON DELETE CASCADE,
  urusan_id         BIGINT NOT NULL REFERENCES sd_urusan(id) ON DELETE CASCADE,
  bidang_urusan_id  BIGINT REFERENCES sd_bidang_urusan(id) ON DELETE CASCADE,
  keterangan        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_hak_akses_urusan
  ON sd_hak_akses_urusan (opd_id, urusan_id, COALESCE(bidang_urusan_id, 0));

-- 5. Master Topik & Sub Topik
CREATE TABLE IF NOT EXISTS sd_topik (
  id          BIGSERIAL PRIMARY KEY,
  nama_topik  TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  ikon        TEXT DEFAULT 'layers',
  deskripsi   TEXT,
  urutan      INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sd_sub_topik (
  id              BIGSERIAL PRIMARY KEY,
  topik_id        BIGINT NOT NULL REFERENCES sd_topik(id) ON DELETE CASCADE,
  nama_sub_topik  TEXT NOT NULL,
  slug            TEXT NOT NULL,
  deskripsi       TEXT,
  urutan          INTEGER NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topik_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_sd_sub_topik_topik ON sd_sub_topik(topik_id);

-- 6. Master Satuan
CREATE TABLE IF NOT EXISTS sd_satuan (
  id           BIGSERIAL PRIMARY KEY,
  nama_satuan  TEXT UNIQUE NOT NULL,
  simbol       TEXT,
  keterangan   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Daftar Data (Target Jumlah Data menurut SK per OPD & Tahun)
CREATE TABLE IF NOT EXISTS sd_daftar_data (
  id                BIGSERIAL PRIMARY KEY,
  opd_id            BIGINT NOT NULL REFERENCES bank_data_opd(id) ON DELETE CASCADE,
  tahun             INTEGER NOT NULL DEFAULT 2025,
  jumlah_target_sk  INTEGER NOT NULL DEFAULT 0,
  nomor_sk          TEXT,
  keterangan        TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opd_id, tahun)
);

-- 8. Template Field & Grup Field Siap Pakai
CREATE TABLE IF NOT EXISTS sd_template_field (
  id             BIGSERIAL PRIMARY KEY,
  kode           TEXT UNIQUE NOT NULL,
  nama_template  TEXT NOT NULL,
  tipe_preset    TEXT NOT NULL DEFAULT 'grup' CHECK (tipe_preset IN ('field', 'grup')),
  deskripsi      TEXT,
  fields_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Master Wilayah (Provinsi, Kabupaten/Kota, Kecamatan, Desa/Kelurahan)
CREATE TABLE IF NOT EXISTS sd_wilayah (
  id               BIGSERIAL PRIMARY KEY,
  kode_wilayah     TEXT UNIQUE NOT NULL,
  nama_wilayah     TEXT NOT NULL,
  tingkat          TEXT NOT NULL DEFAULT 'Kecamatan'
                   CHECK (tingkat IN ('Provinsi', 'Kabupaten/Kota', 'Kecamatan', 'Desa/Kelurahan')),
  induk_kode       TEXT,
  luas_km2         NUMERIC(12,2),
  jumlah_penduduk  INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sd_wilayah_tingkat ON sd_wilayah(tingkat, kode_wilayah);

-- 10. Perluas bank_dataset agar mendukung taksonomi Satu Data & Gerbang Pemutakhiran
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS urusan_id BIGINT REFERENCES sd_urusan(id) ON DELETE SET NULL;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS bidang_urusan_id BIGINT REFERENCES sd_bidang_urusan(id) ON DELETE SET NULL;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS topik_id BIGINT REFERENCES sd_topik(id) ON DELETE SET NULL;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS sub_topik_id BIGINT REFERENCES sd_sub_topik(id) ON DELETE SET NULL;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS id_metadata TEXT;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS kode_sds TEXT;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS jadwal_mulai DATE;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS jadwal_akhir DATE;
ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS reopen_until DATE;

-- 11. Permintaan Reopen (Buka Kembali Gerbang Pemutakhiran)
CREATE TABLE IF NOT EXISTS sd_reopen_request (
  id               BIGSERIAL PRIMARY KEY,
  dataset_id       BIGINT NOT NULL REFERENCES bank_dataset(id) ON DELETE CASCADE,
  opd_id           BIGINT NOT NULL REFERENCES bank_data_opd(id) ON DELETE CASCADE,
  periode_tahun    INTEGER NOT NULL,
  alasan           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'menunggu'
                   CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
  batas_waktu      DATE,
  catatan_admin    TEXT,
  diajukan_oleh    TEXT,
  diputuskan_oleh  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sd_reopen_status ON sd_reopen_request(status, created_at DESC);

-- 12. Modul SPM (Standar Pelayanan Minimal)
CREATE TABLE IF NOT EXISTS sd_spm_urusan (
  id          BIGSERIAL PRIMARY KEY,
  kode        TEXT UNIQUE NOT NULL,
  nama        TEXT NOT NULL,
  ikon        TEXT DEFAULT 'checkCircle',
  warna       TEXT DEFAULT '#2563EB',
  urutan      INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sd_spm_layanan (
  id               BIGSERIAL PRIMARY KEY,
  spm_urusan_id    BIGINT NOT NULL REFERENCES sd_spm_urusan(id) ON DELETE CASCADE,
  kode_layanan     TEXT,
  nama_layanan     TEXT NOT NULL,
  satuan           TEXT DEFAULT '%',
  target_nasional  NUMERIC(6,2) DEFAULT 100.00,
  urutan           INTEGER NOT NULL DEFAULT 1,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (spm_urusan_id, nama_layanan)
);
CREATE INDEX IF NOT EXISTS idx_sd_spm_layanan_urusan ON sd_spm_layanan(spm_urusan_id, urutan);

CREATE TABLE IF NOT EXISTS sd_spm_capaian (
  id                 BIGSERIAL PRIMARY KEY,
  layanan_id         BIGINT NOT NULL REFERENCES sd_spm_layanan(id) ON DELETE CASCADE,
  tahun              INTEGER NOT NULL,
  wilayah_kode       TEXT NOT NULL DEFAULT '53.12',
  nama_wilayah       TEXT NOT NULL DEFAULT 'Kab. Sumba Barat',
  target             NUMERIC(14,2) DEFAULT 100,
  realisasi          NUMERIC(14,2) DEFAULT 0,
  capaian_persen     NUMERIC(6,2) NOT NULL DEFAULT 0,
  penerima_layanan   INTEGER DEFAULT 0,
  anggaran           NUMERIC(18,2) DEFAULT 0,
  keterangan         TEXT,
  updated_by         TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (layanan_id, tahun, wilayah_kode)
);
CREATE INDEX IF NOT EXISTS idx_sd_spm_capaian_tahun ON sd_spm_capaian(tahun, wilayah_kode);

CREATE TABLE IF NOT EXISTS sd_spm_dokumen (
  id             BIGSERIAL PRIMARY KEY,
  judul          TEXT NOT NULL,
  kategori       TEXT NOT NULL DEFAULT 'Laporan SPM',
  tahun          INTEGER NOT NULL DEFAULT 2025,
  nomor_dokumen  TEXT,
  file_url       TEXT,
  deskripsi      TEXT,
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Modul Kelola Konten Portal Satu Data
CREATE TABLE IF NOT EXISTS sd_konten_berita (
  id              BIGSERIAL PRIMARY KEY,
  judul           TEXT NOT NULL,
  kategori        TEXT NOT NULL DEFAULT 'Satu Data',
  ringkasan       TEXT,
  isi             TEXT NOT NULL,
  gambar_url      TEXT,
  penulis         TEXT,
  status          TEXT NOT NULL DEFAULT 'terbit' CHECK (status IN ('draft', 'terbit')),
  tanggal_terbit  DATE NOT NULL DEFAULT CURRENT_DATE,
  views           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sd_konten_publikasi (
  id             BIGSERIAL PRIMARY KEY,
  judul          TEXT NOT NULL,
  jenis          TEXT NOT NULL DEFAULT 'Publikasi Kajian'
                 CHECK (jenis IN ('Publikasi Kajian', 'Produk Hukum', 'SK Tim Satu Data', 'Infografis')),
  tahun          INTEGER NOT NULL DEFAULT 2025,
  nomor          TEXT,
  instansi       TEXT DEFAULT 'BAPPERIDA Kab. Sumba Barat',
  file_url       TEXT,
  deskripsi      TEXT,
  tampil_publik  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sd_konten_tautan (
  id          BIGSERIAL PRIMARY KEY,
  judul       TEXT NOT NULL,
  tipe        TEXT NOT NULL DEFAULT 'portal_eksternal'
              CHECK (tipe IN ('video', 'portal_eksternal', 'banner')),
  url         TEXT NOT NULL,
  instansi    TEXT,
  deskripsi   TEXT,
  urutan      INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sd_changelog (
  id             BIGSERIAL PRIMARY KEY,
  versi          TEXT UNIQUE NOT NULL,
  judul          TEXT NOT NULL,
  tipe_rilis     TEXT NOT NULL DEFAULT 'minor' CHECK (tipe_rilis IN ('major', 'minor', 'patch')),
  ringkasan      TEXT,
  perubahan      JSONB NOT NULL DEFAULT '[]'::jsonb,
  status         TEXT NOT NULL DEFAULT 'released' CHECK (status IN ('draft', 'released')),
  tanggal_rilis  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Modul Monitoring & Sistem (Q&A, FAQ, Data Pengunjung, Query Tersimpan, API Token)
CREATE TABLE IF NOT EXISTS sd_qna (
  id              BIGSERIAL PRIMARY KEY,
  nama            TEXT NOT NULL,
  email           TEXT NOT NULL,
  instansi        TEXT,
  pertanyaan      TEXT NOT NULL,
  jawaban         TEXT,
  status          TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu', 'dijawab')),
  dijawab_oleh    TEXT,
  tampil_publik   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sd_faq (
  id          BIGSERIAL PRIMARY KEY,
  pertanyaan  TEXT UNIQUE NOT NULL,
  jawaban     TEXT NOT NULL,
  urutan      INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sd_visitor_log (
  id          BIGSERIAL PRIMARY KEY,
  nama        TEXT NOT NULL,
  email       TEXT,
  telepon     TEXT,
  instansi    TEXT,
  keperluan   TEXT NOT NULL,
  dataset_id  BIGINT REFERENCES bank_dataset(id) ON DELETE SET NULL,
  aksi        TEXT DEFAULT 'unduh_dataset',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sd_saved_query (
  id          BIGSERIAL PRIMARY KEY,
  nama_query  TEXT NOT NULL,
  deskripsi   TEXT,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sd_api_token (
  id           BIGSERIAL PRIMARY KEY,
  nama_token   TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash   TEXT UNIQUE NOT NULL,
  abilities    TEXT NOT NULL DEFAULT 'read:dataset,read:spm',
  expires_at   DATE,
  last_used_at TIMESTAMPTZ,
  created_by   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SEED DATA REFERENSI STANDAR (IDEMPOTEN — ON CONFLICT DO NOTHING)
-- ============================================================================

-- Seed 8 Urusan Pemerintahan (Permendagri 90/2019)
INSERT INTO sd_urusan (kode_urusan, nama_urusan, keterangan) VALUES
  ('1', 'Urusan Pemerintahan Wajib yang Berkaitan dengan Pelayanan Dasar', 'Pelayanan dasar wajib kabupaten/kota'),
  ('2', 'Urusan Pemerintahan Wajib yang Tidak Berkaitan dengan Pelayanan Dasar', 'Urusan wajib non-pelayanan dasar'),
  ('3', 'Urusan Pemerintahan Pilihan', 'Urusan pilihan sesuai potensi daerah'),
  ('4', 'Unsur Pendukung Urusan Pemerintahan', 'Sekretariat Daerah dan Sekretariat DPRD'),
  ('5', 'Unsur Penunjang Urusan Pemerintahan', 'Perencanaan, Keuangan, Kepegawaian, Litbang'),
  ('6', 'Unsur Pengawasan Urusan Pemerintahan', 'Inspektorat Daerah'),
  ('7', 'Unsur Kewilayahan', 'Kecamatan dan Kelurahan'),
  ('8', 'Unsur Pemerintahan Umum', 'Kesatuan Bangsa dan Politik')
ON CONFLICT (kode_urusan) DO NOTHING;

-- Seed Bidang Urusan Pemerintahan
DO $$
DECLARE
  u1 BIGINT; u2 BIGINT; u3 BIGINT; u4 BIGINT; u5 BIGINT; u6 BIGINT; u7 BIGINT; u8 BIGINT;
BEGIN
  SELECT id INTO u1 FROM sd_urusan WHERE kode_urusan = '1';
  SELECT id INTO u2 FROM sd_urusan WHERE kode_urusan = '2';
  SELECT id INTO u3 FROM sd_urusan WHERE kode_urusan = '3';
  SELECT id INTO u4 FROM sd_urusan WHERE kode_urusan = '4';
  SELECT id INTO u5 FROM sd_urusan WHERE kode_urusan = '5';
  SELECT id INTO u6 FROM sd_urusan WHERE kode_urusan = '6';
  SELECT id INTO u7 FROM sd_urusan WHERE kode_urusan = '7';
  SELECT id INTO u8 FROM sd_urusan WHERE kode_urusan = '8';

  IF u1 IS NOT NULL THEN
    INSERT INTO sd_bidang_urusan (urusan_id, kode_bidang, nama_bidang) VALUES
      (u1, '1.01', 'Pendidikan'),
      (u1, '1.02', 'Kesehatan'),
      (u1, '1.03', 'Pekerjaan Umum dan Penataan Ruang'),
      (u1, '1.04', 'Perumahan dan Kawasan Permukiman'),
      (u1, '1.05', 'Ketenteraman dan Ketertiban Umum serta Pelindungan Masyarakat'),
      (u1, '1.06', 'Sosial')
    ON CONFLICT (kode_bidang) DO NOTHING;
  END IF;

  IF u2 IS NOT NULL THEN
    INSERT INTO sd_bidang_urusan (urusan_id, kode_bidang, nama_bidang) VALUES
      (u2, '2.07', 'Tenaga Kerja'),
      (u2, '2.08', 'Pemberdayaan Perempuan dan Pelindungan Anak'),
      (u2, '2.09', 'Pangan'),
      (u2, '2.10', 'Pertanahan'),
      (u2, '2.11', 'Lingkungan Hidup'),
      (u2, '2.12', 'Administrasi Kependudukan dan Pencatatan Sipil'),
      (u2, '2.13', 'Pemberdayaan Masyarakat dan Desa'),
      (u2, '2.14', 'Pengendalian Penduduk dan Keluarga Berencana'),
      (u2, '2.15', 'Perhubungan'),
      (u2, '2.16', 'Komunikasi dan Informatika'),
      (u2, '2.17', 'Koperasi, Usaha Kecil, dan Menengah'),
      (u2, '2.18', 'Penanaman Modal'),
      (u2, '2.19', 'Kepemudaan dan Olahraga'),
      (u2, '2.20', 'Statistik'),
      (u2, '2.21', 'Persandian'),
      (u2, '2.22', 'Kebudayaan'),
      (u2, '2.23', 'Perpustakaan'),
      (u2, '2.24', 'Kearsipan')
    ON CONFLICT (kode_bidang) DO NOTHING;
  END IF;

  IF u3 IS NOT NULL THEN
    INSERT INTO sd_bidang_urusan (urusan_id, kode_bidang, nama_bidang) VALUES
      (u3, '3.25', 'Kelautan dan Perikanan'),
      (u3, '3.26', 'Pariwisata'),
      (u3, '3.27', 'Pertanian'),
      (u3, '3.28', 'Kehutanan'),
      (u3, '3.29', 'Energi dan Sumber Daya Mineral'),
      (u3, '3.30', 'Perdagangan'),
      (u3, '3.31', 'Perindustrian'),
      (u3, '3.32', 'Transmigrasi')
    ON CONFLICT (kode_bidang) DO NOTHING;
  END IF;

  IF u4 IS NOT NULL THEN
    INSERT INTO sd_bidang_urusan (urusan_id, kode_bidang, nama_bidang) VALUES
      (u4, '4.01', 'Sekretariat Daerah'),
      (u4, '4.02', 'Sekretariat DPRD')
    ON CONFLICT (kode_bidang) DO NOTHING;
  END IF;

  IF u5 IS NOT NULL THEN
    INSERT INTO sd_bidang_urusan (urusan_id, kode_bidang, nama_bidang) VALUES
      (u5, '5.01', 'Perencanaan'),
      (u5, '5.02', 'Keuangan'),
      (u5, '5.03', 'Kepegawaian'),
      (u5, '5.04', 'Pendidikan dan Pelatihan'),
      (u5, '5.05', 'Penelitian dan Pengembangan'),
      (u5, '5.06', 'Penghubung'),
      (u5, '5.07', 'Pengelolaan Perbatasan')
    ON CONFLICT (kode_bidang) DO NOTHING;
  END IF;

  IF u6 IS NOT NULL THEN
    INSERT INTO sd_bidang_urusan (urusan_id, kode_bidang, nama_bidang) VALUES
      (u6, '6.01', 'Inspektorat Daerah')
    ON CONFLICT (kode_bidang) DO NOTHING;
  END IF;

  IF u7 IS NOT NULL THEN
    INSERT INTO sd_bidang_urusan (urusan_id, kode_bidang, nama_bidang) VALUES
      (u7, '7.01', 'Kecamatan')
    ON CONFLICT (kode_bidang) DO NOTHING;
  END IF;

  IF u8 IS NOT NULL THEN
    INSERT INTO sd_bidang_urusan (urusan_id, kode_bidang, nama_bidang) VALUES
      (u8, '8.01', 'Kesatuan Bangsa dan Politik')
    ON CONFLICT (kode_bidang) DO NOTHING;
  END IF;
END $$;

-- Seed 11 Topik & Sub Topik Satu Data
INSERT INTO sd_topik (nama_topik, slug, ikon, deskripsi, urutan) VALUES
  ('Kependudukan', 'kependudukan', 'users', 'Data penduduk, demografi, dan administrasi kependudukan.', 1),
  ('Kesehatan', 'kesehatan', 'checkCircle', 'Data kesehatan masyarakat, fasilitas, dan layanan kesehatan.', 2),
  ('Pendidikan', 'pendidikan', 'file', 'Data pendidikan, sekolah, peserta didik, dan tenaga pendidik.', 3),
  ('Sosial', 'sosial', 'users', 'Data kesejahteraan sosial, kemiskinan, dan perlindungan masyarakat.', 4),
  ('Ekonomi dan Ketenagakerjaan', 'ekonomi-dan-ketenagakerjaan', 'chart', 'Data kegiatan ekonomi, UMKM, perdagangan, dan tenaga kerja.', 5),
  ('Pertanian dan Pangan', 'pertanian', 'layers', 'Data tanaman pangan, hortikultura, perkebunan, dan peternakan.', 6),
  ('Kelautan dan Perikanan', 'kelautan-dan-perikanan', 'world', 'Data perikanan tangkap, budidaya, dan sumber daya pesisir.', 7),
  ('Infrastruktur dan Kewilayahan', 'infrastruktur', 'building', 'Data jalan, jembatan, air minum, sanitasi, dan permukiman.', 8),
  ('Lingkungan Hidup dan Kebencanaan', 'lingkungan-hidup', 'world', 'Data kualitas lingkungan, persampahan, dan penanggulangan bencana.', 9),
  ('Pemerintahan dan Keuangan', 'pemerintahan', 'building', 'Data penyelenggaraan pemerintahan, perencanaan, dan keuangan daerah.', 10),
  ('Pariwisata dan Kebudayaan', 'pariwisata-dan-kebudayaan', 'tag', 'Data destinasi wisata, ekonomi kreatif, dan warisan budaya.', 11)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  tk RECORD;
BEGIN
  FOR tk IN SELECT id, slug FROM sd_topik LOOP
    IF tk.slug = 'kependudukan' THEN
      INSERT INTO sd_sub_topik (topik_id, nama_sub_topik, slug, deskripsi, urutan) VALUES
        (tk.id, 'Demografi', 'demografi', 'Jumlah, pertumbuhan, dan komposisi penduduk.', 1),
        (tk.id, 'Administrasi Kependudukan', 'administrasi-kependudukan', 'Pencatatan sipil dan kepemilikan dokumen.', 2),
        (tk.id, 'Keluarga Berencana', 'keluarga-berencana', 'Data KB dan pengendalian penduduk.', 3)
      ON CONFLICT (topik_id, slug) DO NOTHING;
    ELSIF tk.slug = 'kesehatan' THEN
      INSERT INTO sd_sub_topik (topik_id, nama_sub_topik, slug, deskripsi, urutan) VALUES
        (tk.id, 'Pelayanan Kesehatan', 'pelayanan-kesehatan', 'Fasilitas, tenaga, dan layanan kesehatan.', 1),
        (tk.id, 'Kesehatan Ibu dan Anak', 'kesehatan-ibu-dan-anak', 'Kesehatan ibu hamil, bayi, dan balita.', 2),
        (tk.id, 'Gizi dan Stunting', 'gizi-dan-stunting', 'Status gizi dan percepatan penurunan stunting.', 3)
      ON CONFLICT (topik_id, slug) DO NOTHING;
    ELSIF tk.slug = 'pendidikan' THEN
      INSERT INTO sd_sub_topik (topik_id, nama_sub_topik, slug, deskripsi, urutan) VALUES
        (tk.id, 'Pendidikan Dasar & PAUD', 'pendidikan-dasar', 'PAUD, SD, SMP, dan pendidikan kesetaraan.', 1),
        (tk.id, 'Peserta Didik & APK/APM', 'peserta-didik', 'Data siswa, angka partisipasi, dan kelulusan.', 2),
        (tk.id, 'Sarana Pendidikan', 'sarana-pendidikan', 'Sekolah, ruang kelas, dan fasilitas belajar.', 3)
      ON CONFLICT (topik_id, slug) DO NOTHING;
    ELSIF tk.slug = 'sosial' THEN
      INSERT INTO sd_sub_topik (topik_id, nama_sub_topik, slug, deskripsi, urutan) VALUES
        (tk.id, 'Kemiskinan', 'kemiskinan', 'Data kemiskinan ekstrem dan desil kesejahteraan.', 1),
        (tk.id, 'Perlindungan Sosial', 'perlindungan-sosial', 'Bantuan sosial dan jaminan sosial.', 2)
      ON CONFLICT (topik_id, slug) DO NOTHING;
    ELSIF tk.slug = 'ekonomi-dan-ketenagakerjaan' THEN
      INSERT INTO sd_sub_topik (topik_id, nama_sub_topik, slug, deskripsi, urutan) VALUES
        (tk.id, 'UMKM & Koperasi', 'umkm-koperasi', 'Data koperasi dan pelaku usaha mikro/kecil.', 1),
        (tk.id, 'Perdagangan & PDRB', 'perdagangan', 'Pasar, inflasi, PDRB, dan distribusi.', 2),
        (tk.id, 'Ketenagakerjaan', 'ketenagakerjaan', 'Angkatan kerja dan tingkat pengangguran.', 3)
      ON CONFLICT (topik_id, slug) DO NOTHING;
    ELSIF tk.slug = 'pertanian' THEN
      INSERT INTO sd_sub_topik (topik_id, nama_sub_topik, slug, deskripsi, urutan) VALUES
        (tk.id, 'Tanaman Pangan & Hortikultura', 'tanaman-pangan', 'Produksi padi, jagung, umbi, sayur, dan buah.', 1),
        (tk.id, 'Perkebunan & Peternakan', 'peternakan', 'Komoditas perkebunan dan populasi ternak.', 2)
      ON CONFLICT (topik_id, slug) DO NOTHING;
    ELSIF tk.slug = 'infrastruktur' THEN
      INSERT INTO sd_sub_topik (topik_id, nama_sub_topik, slug, deskripsi, urutan) VALUES
        (tk.id, 'Jalan dan Jembatan', 'jalan-dan-jembatan', 'Kemantapan jalan dan jembatan kabupaten.', 1),
        (tk.id, 'Air Minum dan Sanitasi', 'air-minum-dan-sanitasi', 'Akses air minum layak dan sanitasi.', 2),
        (tk.id, 'Perumahan Layak Huni', 'perumahan', 'Rumah layak huni dan kawasan permukiman.', 3)
      ON CONFLICT (topik_id, slug) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Seed Satuan Standar
INSERT INTO sd_satuan (nama_satuan, simbol, keterangan) VALUES
  ('Persen', '%', 'Persentase (0-100)'),
  ('Orang', 'Org', 'Satuan individu manusia'),
  ('Jiwa', 'Jiwa', 'Satuan jumlah penduduk'),
  ('Kepala Keluarga', 'KK', 'Satuan keluarga'),
  ('Rumah Tangga', 'RT', 'Satuan rumah tangga'),
  ('Unit', 'Unit', 'Satuan barang/sarana'),
  ('Buah', 'Bh', 'Satuan benda'),
  ('Paket', 'Pkt', 'Satuan paket pekerjaan/layanan'),
  ('Dokumen', 'Dok', 'Satuan naskah/dokumen'),
  ('Kegiatan', 'Keg', 'Satuan kegiatan'),
  ('Lembaga', 'Lbg', 'Satuan organisasi/institusi'),
  ('Desa', 'Desa', 'Satuan wilayah desa'),
  ('Kelurahan', 'Kel', 'Satuan wilayah kelurahan'),
  ('Kecamatan', 'Kec', 'Satuan wilayah kecamatan'),
  ('Sekolah', 'Skl', 'Satuan satuan pendidikan'),
  ('Rupiah', 'Rp', 'Mata uang Rupiah'),
  ('Juta Rupiah', 'Jt Rp', 'Nilai dalam jutaan Rupiah'),
  ('Miliar Rupiah', 'M Rp', 'Nilai dalam miliaran Rupiah'),
  ('Ton', 'Ton', 'Satuan berat (1.000 kg)'),
  ('Kilogram', 'kg', 'Satuan berat dasar'),
  ('Kuintal', 'kw', 'Satuan berat (100 kg)'),
  ('Liter', 'L', 'Satuan volume cairan'),
  ('Hektare', 'ha', 'Satuan luas lahan'),
  ('Kilometer', 'km', 'Satuan panjang jalan/jarak'),
  ('Meter', 'm', 'Satuan panjang dasar'),
  ('Kilometer Persegi', 'km²', 'Satuan luas wilayah'),
  ('Ekor', 'Ekor', 'Satuan populasi ternak'),
  ('Hari', 'Hari', 'Satuan durasi hari'),
  ('Bulan', 'Bln', 'Satuan durasi bulan'),
  ('Tahun', 'Thn', 'Satuan durasi tahun'),
  ('Kasus', 'Kasus', 'Satuan kejadian/insiden'),
  ('Indeks', 'Indeks', 'Skor indeks komposit'),
  ('Rasio', 'Rasio', 'Perbandingan antar nilai'),
  ('Poin', 'Poin', 'Satuan nilai skor')
ON CONFLICT (nama_satuan) DO NOTHING;

-- Seed Template Field & Grup Field Siap Pakai
INSERT INTO sd_template_field (kode, nama_template, tipe_preset, deskripsi, fields_json) VALUES
  ('grup_tahunan_tunggal', 'Nilai Tunggal Tahunan', 'grup', 'Template standar indikator tahunan dengan satu kolom Nilai utama.',
   '[{"nama_field":"nilai","label":"Nilai","tipe_data":"desimal","wajib":true,"tampil_grafik":true},{"nama_field":"keterangan","label":"Keterangan","tipe_data":"teks","wajib":false,"tampil_grafik":false}]'::jsonb),
  ('grup_target_realisasi', 'Target & Realisasi Tahunan', 'grup', 'Membandingkan target perencanaan dengan realisasi/capaian aktual.',
   '[{"nama_field":"target","label":"Target","tipe_data":"desimal","wajib":true,"tampil_grafik":true},{"nama_field":"realisasi","label":"Realisasi","tipe_data":"desimal","wajib":true,"tampil_grafik":true},{"nama_field":"capaian_persen","label":"Capaian (%)","tipe_data":"desimal","wajib":false,"tampil_grafik":true}]'::jsonb),
  ('grup_jenis_kelamin', ' Terpilah Menurut Jenis Kelamin (L/P)', 'grup', 'Data kependudukan/sosial terpilah Laki-laki, Perempuan, dan Jumlah.',
   '[{"nama_field":"jumlah_laki_laki","label":"Laki-laki","tipe_data":"angka","wajib":true,"tampil_grafik":true},{"nama_field":"jumlah_perempuan","label":"Perempuan","tipe_data":"angka","wajib":true,"tampil_grafik":true},{"nama_field":"jumlah_total","label":"Total","tipe_data":"angka","wajib":true,"tampil_grafik":true}]'::jsonb),
  ('grup_kondisi_sarana', 'Kondisi Sarana / Infrastruktur (Baik/Rusak)', 'grup', 'Data fasilitas/jalan terpilah menurut kondisi Baik, Rusak Ringan, dan Rusak Berat.',
   '[{"nama_field":"kondisi_baik","label":"Kondisi Baik","tipe_data":"angka","wajib":true,"tampil_grafik":true},{"nama_field":"rusak_ringan","label":"Rusak Ringan","tipe_data":"angka","wajib":true,"tampil_grafik":true},{"nama_field":"rusak_berat","label":"Rusak Berat","tipe_data":"angka","wajib":true,"tampil_grafik":true}]'::jsonb),
  ('grup_pertanian_produksi', 'Luas Panen, Produktivitas & Produksi', 'grup', 'Template standar komoditas pertanian/perkebunan.',
   '[{"nama_field":"luas_panen_ha","label":"Luas Panen (Ha)","tipe_data":"desimal","wajib":true,"tampil_grafik":true},{"nama_field":"produktivitas_kw_ha","label":"Produktivitas (Kw/Ha)","tipe_data":"desimal","wajib":false,"tampil_grafik":false},{"nama_field":"produksi_ton","label":"Produksi (Ton)","tipe_data":"desimal","wajib":true,"tampil_grafik":true}]'::jsonb),
  ('field_nilai_desimal', 'Nilai (Desimal)', 'field', 'Kolom nilai numerik desimal tunggal.',
   '[{"nama_field":"nilai","label":"Nilai","tipe_data":"desimal","wajib":true,"tampil_grafik":true}]'::jsonb),
  ('field_jumlah_bulat', 'Jumlah (Angka Bulat)', 'field', 'Kolom jumlah bilangan bulat.',
   '[{"nama_field":"jumlah","label":"Jumlah","tipe_data":"angka","wajib":true,"tampil_grafik":true}]'::jsonb),
  ('field_persentase', 'Persentase (%)', 'field', 'Kolom persentase 0–100%.',
   '[{"nama_field":"persentase","label":"Persentase (%)","tipe_data":"desimal","wajib":true,"tampil_grafik":true}]'::jsonb)
ON CONFLICT (kode) DO NOTHING;

-- Seed Wilayah Kabupaten Sumba Barat (Kode Kemendagri 53.12)
INSERT INTO sd_wilayah (kode_wilayah, nama_wilayah, tingkat, induk_kode, luas_km2, jumlah_penduduk) VALUES
  ('53', 'Provinsi Nusa Tenggara Timur', 'Provinsi', NULL, 47931.54, 5569929),
  ('53.12', 'Kabupaten Sumba Barat', 'Kabupaten/Kota', '53', 757.36, 152490),
  ('53.12.01', 'Kecamatan Loli', 'Kecamatan', '53.12', 132.48, 41250),
  ('53.12.02', 'Kecamatan Wanokaka', 'Kecamatan', '53.12', 130.15, 17840),
  ('53.12.03', 'Kecamatan Lamboya', 'Kecamatan', '53.12', 173.79, 22610),
  ('53.12.04', 'Kecamatan Kota Waikabubak', 'Kecamatan', '53.12', 64.59, 36920),
  ('53.12.05', 'Kecamatan Laboya Barat', 'Kecamatan', '53.12', 151.14, 10290),
  ('53.12.06', 'Kecamatan Tana Righu', 'Kecamatan', '53.12', 105.21, 23580),
  ('53.12.04.1001', 'Kelurahan Kampung Sawah', 'Desa/Kelurahan', '53.12.04', 4.12, 6210),
  ('53.12.04.1002', 'Kelurahan Komerda', 'Desa/Kelurahan', '53.12.04', 5.40, 5890),
  ('53.12.04.1003', 'Kelurahan Wailiang', 'Desa/Kelurahan', '53.12.04', 4.85, 6420),
  ('53.12.01.1001', 'Kelurahan Sobawawi', 'Desa/Kelurahan', '53.12.01', 9.10, 5140)
ON CONFLICT (kode_wilayah) DO NOTHING;

-- Seed 6 Urusan Wajib & 29 Jenis Layanan SPM (Permendagri 59/2021)
INSERT INTO sd_spm_urusan (kode, nama, ikon, warna, urutan) VALUES
  ('1.01', 'Pendidikan', 'file', '#2563EB', 1),
  ('1.02', 'Kesehatan', 'checkCircle', '#16A34A', 2),
  ('1.03', 'Pekerjaan Umum dan Penataan Ruang', 'building', '#D97706', 3),
  ('1.04', 'Perumahan Rakyat dan Kawasan Permukiman', 'home', '#7C3AED', 4),
  ('1.05', 'Ketenteraman, Ketertiban Umum, dan Pelindungan Masyarakat', 'shield', '#DC2626', 5),
  ('1.06', 'Sosial', 'users', '#0E7490', 6)
ON CONFLICT (kode) DO NOTHING;

DO $$
DECLARE
  u_pend BIGINT; u_kes BIGINT; u_pu BIGINT; u_perum BIGINT; u_trantib BIGINT; u_sos BIGINT;
  l_paud BIGINT; l_sd BIGINT; l_bumil BIGINT; l_balita BIGINT; l_air BIGINT; l_rumah BIGINT; l_bencana BIGINT; l_disab BIGINT;
BEGIN
  SELECT id INTO u_pend FROM sd_spm_urusan WHERE kode = '1.01';
  SELECT id INTO u_kes FROM sd_spm_urusan WHERE kode = '1.02';
  SELECT id INTO u_pu FROM sd_spm_urusan WHERE kode = '1.03';
  SELECT id INTO u_perum FROM sd_spm_urusan WHERE kode = '1.04';
  SELECT id INTO u_trantib FROM sd_spm_urusan WHERE kode = '1.05';
  SELECT id INTO u_sos FROM sd_spm_urusan WHERE kode = '1.06';

  IF u_pend IS NOT NULL THEN
    INSERT INTO sd_spm_layanan (spm_urusan_id, kode_layanan, nama_layanan, urutan) VALUES
      (u_pend, '1.01.01', 'Pendidikan Anak Usia Dini (PAUD)', 1),
      (u_pend, '1.01.02', 'Pendidikan Dasar (SD/SMP)', 2),
      (u_pend, '1.01.03', 'Pendidikan Kesetaraan', 3)
    ON CONFLICT (spm_urusan_id, nama_layanan) DO NOTHING;
  END IF;

  IF u_kes IS NOT NULL THEN
    INSERT INTO sd_spm_layanan (spm_urusan_id, kode_layanan, nama_layanan, urutan) VALUES
      (u_kes, '1.02.01', 'Pelayanan Kesehatan Ibu Hamil', 1),
      (u_kes, '1.02.02', 'Pelayanan Kesehatan Ibu Bersalin', 2),
      (u_kes, '1.02.03', 'Pelayanan Kesehatan Bayi Baru Lahir', 3),
      (u_kes, '1.02.04', 'Pelayanan Kesehatan Balita', 4),
      (u_kes, '1.02.05', 'Pelayanan Kesehatan pada Usia Pendidikan Dasar', 5),
      (u_kes, '1.02.06', 'Pelayanan Kesehatan pada Usia Produktif', 6),
      (u_kes, '1.02.07', 'Pelayanan Kesehatan pada Usia Lanjut', 7),
      (u_kes, '1.02.08', 'Pelayanan Kesehatan Penderita Hipertensi', 8),
      (u_kes, '1.02.09', 'Pelayanan Kesehatan Penderita Diabetes Melitus', 9),
      (u_kes, '1.02.10', 'Pelayanan Kesehatan Orang dengan Gangguan Jiwa Berat', 10),
      (u_kes, '1.02.11', 'Pelayanan Kesehatan Orang Terduga Tuberkulosis', 11),
      (u_kes, '1.02.12', 'Pelayanan Kesehatan Orang dengan Risiko Terinfeksi HIV', 12)
    ON CONFLICT (spm_urusan_id, nama_layanan) DO NOTHING;
  END IF;

  IF u_pu IS NOT NULL THEN
    INSERT INTO sd_spm_layanan (spm_urusan_id, kode_layanan, nama_layanan, urutan) VALUES
      (u_pu, '1.03.01', 'Pemenuhan Kebutuhan Pokok Air Minum Sehari-hari', 1),
      (u_pu, '1.03.02', 'Penyediaan Pelayanan Pengolahan Air Limbah Domestik', 2)
    ON CONFLICT (spm_urusan_id, nama_layanan) DO NOTHING;
  END IF;

  IF u_perum IS NOT NULL THEN
    INSERT INTO sd_spm_layanan (spm_urusan_id, kode_layanan, nama_layanan, urutan) VALUES
      (u_perum, '1.04.01', 'Penyediaan dan Rehabilitasi Rumah yang Layak Huni bagi Korban Bencana Kabupaten/Kota', 1),
      (u_perum, '1.04.02', 'Fasilitasi Penyediaan Rumah yang Layak Huni bagi Masyarakat yang Terkena Relokasi Program Pemda', 2)
    ON CONFLICT (spm_urusan_id, nama_layanan) DO NOTHING;
  END IF;

  IF u_trantib IS NOT NULL THEN
    INSERT INTO sd_spm_layanan (spm_urusan_id, kode_layanan, nama_layanan, urutan) VALUES
      (u_trantib, '1.05.01', 'Pelayanan Ketenteraman dan Ketertiban Umum', 1),
      (u_trantib, '1.05.02', 'Pelayanan Informasi Rawan Bencana', 2),
      (u_trantib, '1.05.03', 'Pelayanan Pencegahan dan Kesiapsiagaan terhadap Bencana', 3),
      (u_trantib, '1.05.04', 'Pelayanan Penyelamatan dan Evakuasi Korban Bencana', 4),
      (u_trantib, '1.05.05', 'Pelayanan Penyelamatan dan Evakuasi Korban Kebakaran', 5)
    ON CONFLICT (spm_urusan_id, nama_layanan) DO NOTHING;
  END IF;

  IF u_sos IS NOT NULL THEN
    INSERT INTO sd_spm_layanan (spm_urusan_id, kode_layanan, nama_layanan, urutan) VALUES
      (u_sos, '1.06.01', 'Rehabilitasi Sosial Dasar Penyandang Disabilitas Terlantar di Luar Panti', 1),
      (u_sos, '1.06.02', 'Rehabilitasi Sosial Dasar Anak Terlantar di Luar Panti', 2),
      (u_sos, '1.06.03', 'Rehabilitasi Sosial Dasar Lanjut Usia Terlantar di Luar Panti', 3),
      (u_sos, '1.06.04', 'Rehabilitasi Sosial Dasar Tuna Sosial Khususnya Gelandangan dan Pengemis di Luar Panti', 4),
      (u_sos, '1.06.05', 'Perlindungan dan Jaminan Sosial pada Saat dan Setelah Tanggap Darurat Bencana bagi Korban Bencana', 5)
    ON CONFLICT (spm_urusan_id, nama_layanan) DO NOTHING;
  END IF;

  -- Seed sampel capaian SPM per Kecamatan di Kab. Sumba Barat jika belum ada
  SELECT id INTO l_sd FROM sd_spm_layanan WHERE kode_layanan = '1.01.02' LIMIT 1;
  SELECT id INTO l_bumil FROM sd_spm_layanan WHERE kode_layanan = '1.02.01' LIMIT 1;
  SELECT id INTO l_air FROM sd_spm_layanan WHERE kode_layanan = '1.03.01' LIMIT 1;
  SELECT id INTO l_rumah FROM sd_spm_layanan WHERE kode_layanan = '1.04.01' LIMIT 1;
  SELECT id INTO l_bencana FROM sd_spm_layanan WHERE kode_layanan = '1.05.01' LIMIT 1;
  SELECT id INTO l_disab FROM sd_spm_layanan WHERE kode_layanan = '1.06.01' LIMIT 1;

  IF l_sd IS NOT NULL THEN
    INSERT INTO sd_spm_capaian (layanan_id, tahun, wilayah_kode, nama_wilayah, target, realisasi, capaian_persen, penerima_layanan, anggaran) VALUES
      (l_sd, 2025, '53.12', 'Kabupaten Sumba Barat', 100, 92.40, 92.40, 28450, 14500000000),
      (l_sd, 2025, '53.12.15', 'Kecamatan Kota Waikabubak', 100, 96.80, 96.80, 7200, 3800000000),
      (l_sd, 2025, '53.12.10', 'Kecamatan Loli', 100, 94.10, 94.10, 7850, 3500000000),
      (l_sd, 2025, '53.12.11', 'Kecamatan Wanokaka', 100, 89.50, 89.50, 3420, 2100000000),
      (l_sd, 2025, '53.12.12', 'Kecamatan Lamboya', 100, 88.20, 88.20, 4180, 2300000000),
      (l_sd, 2025, '53.12.04', 'Kecamatan Tana Righu', 100, 91.00, 91.00, 4100, 1900000000),
      (l_sd, 2025, '53.12.18', 'Kecamatan Laboya Barat', 100, 78.60, 78.60, 1700, 900000000)
    ON CONFLICT (layanan_id, tahun, wilayah_kode) DO UPDATE
      SET nama_wilayah = EXCLUDED.nama_wilayah,
          realisasi = EXCLUDED.realisasi,
          capaian_persen = EXCLUDED.capaian_persen;
  END IF;

  IF l_bumil IS NOT NULL THEN
    INSERT INTO sd_spm_capaian (layanan_id, tahun, wilayah_kode, nama_wilayah, target, realisasi, capaian_persen, penerima_layanan, anggaran) VALUES
      (l_bumil, 2025, '53.12', 'Kabupaten Sumba Barat', 100, 88.75, 88.75, 3420, 4200000000),
      (l_bumil, 2025, '53.12.15', 'Kecamatan Kota Waikabubak', 100, 95.20, 95.20, 890, 1100000000),
      (l_bumil, 2025, '53.12.10', 'Kecamatan Loli', 100, 91.40, 91.40, 920, 950000000),
      (l_bumil, 2025, '53.12.11', 'Kecamatan Wanokaka', 100, 85.10, 85.10, 410, 620000000),
      (l_bumil, 2025, '53.12.12', 'Kecamatan Lamboya', 100, 84.30, 84.30, 520, 680000000),
      (l_bumil, 2025, '53.12.04', 'Kecamatan Tana Righu', 100, 86.00, 86.00, 460, 540000000),
      (l_bumil, 2025, '53.12.18', 'Kecamatan Laboya Barat', 100, 74.50, 74.50, 220, 310000000)
    ON CONFLICT (layanan_id, tahun, wilayah_kode) DO UPDATE
      SET nama_wilayah = EXCLUDED.nama_wilayah,
          realisasi = EXCLUDED.realisasi,
          capaian_persen = EXCLUDED.capaian_persen;
  END IF;

  IF l_air IS NOT NULL THEN
    INSERT INTO sd_spm_capaian (layanan_id, tahun, wilayah_kode, nama_wilayah, target, realisasi, capaian_persen, penerima_layanan, anggaran) VALUES
      (l_air, 2025, '53.12', 'Kabupaten Sumba Barat', 100, 79.40, 79.40, 24100, 8900000000),
      (l_air, 2025, '53.12.15', 'Kecamatan Kota Waikabubak', 100, 91.00, 91.00, 7800, 2400000000),
      (l_air, 2025, '53.12.10', 'Kecamatan Loli', 100, 83.50, 83.50, 6400, 1950000000),
      (l_air, 2025, '53.12.11', 'Kecamatan Wanokaka', 100, 76.20, 76.20, 2900, 1350000000),
      (l_air, 2025, '53.12.12', 'Kecamatan Lamboya', 100, 74.80, 74.80, 3200, 1400000000),
      (l_air, 2025, '53.12.04', 'Kecamatan Tana Righu', 100, 72.10, 72.10, 2500, 1100000000),
      (l_air, 2025, '53.12.18', 'Kecamatan Laboya Barat', 100, 58.90, 58.90, 1300, 700000000)
    ON CONFLICT (layanan_id, tahun, wilayah_kode) DO UPDATE
      SET nama_wilayah = EXCLUDED.nama_wilayah,
          realisasi = EXCLUDED.realisasi,
          capaian_persen = EXCLUDED.capaian_persen;
  END IF;

  DELETE FROM sd_spm_capaian WHERE wilayah_kode IN ('53.12.01', '53.12.02', '53.12.03', '53.12.05', '53.12.06');

  IF l_rumah IS NOT NULL THEN
    INSERT INTO sd_spm_capaian (layanan_id, tahun, wilayah_kode, nama_wilayah, target, realisasi, capaian_persen, penerima_layanan, anggaran) VALUES
      (l_rumah, 2025, '53.12', 'Kabupaten Sumba Barat', 100, 84.20, 84.20, 315, 5600000000)
    ON CONFLICT (layanan_id, tahun, wilayah_kode) DO NOTHING;
  END IF;

  IF l_bencana IS NOT NULL THEN
    INSERT INTO sd_spm_capaian (layanan_id, tahun, wilayah_kode, nama_wilayah, target, realisasi, capaian_persen, penerima_layanan, anggaran) VALUES
      (l_bencana, 2025, '53.12', 'Kabupaten Sumba Barat', 100, 90.50, 90.50, 152490, 2300000000)
    ON CONFLICT (layanan_id, tahun, wilayah_kode) DO NOTHING;
  END IF;

  IF l_disab IS NOT NULL THEN
    INSERT INTO sd_spm_capaian (layanan_id, tahun, wilayah_kode, nama_wilayah, target, realisasi, capaian_persen, penerima_layanan, anggaran) VALUES
      (l_disab, 2025, '53.12', 'Kabupaten Sumba Barat', 100, 86.30, 86.30, 680, 1850000000)
    ON CONFLICT (layanan_id, tahun, wilayah_kode) DO NOTHING;
  END IF;
END $$;

-- Seed FAQ Satu Data
INSERT INTO sd_faq (pertanyaan, jawaban, urutan, is_active) VALUES
  ('Apa itu Portal Satu Data & Bank Data BAPPERIDA?', 'Portal Satu Data BAPPERIDA Kabupaten Sumba Barat adalah katalog pusat data sektoral, indikator kinerja utama (IKU/IKK), dan capaian Standar Pelayanan Minimal (SPM) lintas Perangkat Daerah yang telah diverifikasi oleh Walidata.', 1, TRUE),
  ('Bagaimana cara mengunduh dataset sektoral dalam format Excel?', 'Buka halaman Portal Publik atau Bank Data, pilih dataset berstatus Disetujui, lalu klik tombol Unduh Excel (.xlsx) untuk mengunduh tabel lengkap beserta metadatanya.', 2, TRUE),
  ('Bagaimana jika gerbang pemutakhiran data OPD sudah tertutup?', 'Operator OPD dapat membuka detail dataset terkait lalu menekan tombol Ajukan Buka Gerbang (Permintaan Reopen) disertai alasan pengajuan untuk disetujui oleh Admin/Walidata.', 3, TRUE),
  ('Bagaimana cara mengajukan permintaan data yang belum tersedia di katalog?', 'Gunakan formulir Tanya Data (Q&A) pada Portal Publik atau menu Monitoring untuk mengirimkan permohonan data sektoral kepada tim Walidata dan BAPPERIDA.', 4, TRUE)
ON CONFLICT (pertanyaan) DO NOTHING;

-- Seed Changelog Awal
INSERT INTO sd_changelog (versi, judul, tipe_rilis, ringkasan, perubahan, status, tanggal_rilis) VALUES
  ('v2.5.0', 'Integrasi Penuh Satu Data Kab/Kota, Modul SPM, Master Data & Monitoring', 'major',
   'Penambahan ekosistem lengkap Satu Data Daerah mencakup 11 Master Data, Standar Pelayanan Minimal (SPM) per Kecamatan, Kelola Konten Portal, serta Monitoring & Query Builder.',
   '["Penambahan 11 sub-modul Master Data Satu Data (OPD, Urusan, Bidang Urusan, Hak Akses Urusan, Topik, Sub Topik, Satuan, Daftar Data SK, Template Field, Wilayah, Permintaan Reopen)","Penambahan Modul Standar Pelayanan Minimal (SPM) 6 Urusan Wajib & Peta Capaian Kecamatan","Penambahan Modul Kelola Konten (Berita, Publikasi/Produk Hukum/SK Tim, Video & Portal Eksternal, Changelog)","Penambahan Modul Monitoring (Pertanyaan Q&A & FAQ, Buku Tamu Pengunjung, Query Builder Lintas Indikator, Health Check & API Token)"]'::jsonb,
   'released', CURRENT_DATE)
ON CONFLICT (versi) DO NOTHING;

-- Seed Konten Awal (Hanya jika tabel masih kosong)
INSERT INTO sd_konten_berita (judul, kategori, ringkasan, isi, penulis, status, tanggal_terbit)
SELECT 'Peluncuran Integrasi Satu Data & Monitoring SPM Kabupaten Sumba Barat', 'Satu Data',
       'BAPPERIDA Kabupaten Sumba Barat mengintegrasikan katalog Dataset Sektoral, Standar Pelayanan Minimal (SPM) per Kecamatan, dan Arsip Perencanaan Daerah.',
       'Dalam rangka mendukung penyelenggaraan Satu Data Indonesia tingkat Kabupaten Sumba Barat, BAPPERIDA telah memperbarui portal data terpadu yang mencakup pengelolaan Master Data Urusan Pemerintahan, verifikasi dataset sektoral oleh Walidata, serta pemantauan capaian 6 Urusan Wajib Standar Pelayanan Minimal (SPM) hingga tingkat Kecamatan.',
       'Tim Walidata BAPPERIDA', 'terbit', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM sd_konten_berita LIMIT 1);

INSERT INTO sd_konten_publikasi (judul, jenis, tahun, nomor, instansi, deskripsi, tampil_publik)
SELECT 'Peraturan Bupati tentang Penyelenggaraan Satu Data Daerah Kabupaten Sumba Barat', 'Produk Hukum',
       2025, 'Perbup No. 12 Tahun 2025', 'Bagian Hukum & BAPPERIDA',
       'Pedoman tata kelola, standar metadata, dan alur verifikasi data sektoral antar Produsen Data (OPD) dan Walidata Daerah.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM sd_konten_publikasi WHERE jenis = 'Produk Hukum' LIMIT 1);

INSERT INTO sd_konten_publikasi (judul, jenis, tahun, nomor, instansi, deskripsi, tampil_publik)
SELECT 'Keputusan Bupati tentang Pembentukan Forum Satu Data & Daftar Data Daerah Tahun 2025', 'SK Tim Satu Data',
       2025, 'SK Bupati No. 188.45/85/HK/2025', 'BAPPERIDA Kab. Sumba Barat',
       'Penetapan Pembina Data, Walidata, Walidata Pendukung, dan Produsen Data beserta target pengumpulan Daftar Data Sektoral OPD.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM sd_konten_publikasi WHERE jenis = 'SK Tim Satu Data' LIMIT 1);

INSERT INTO sd_konten_publikasi (judul, jenis, tahun, nomor, instansi, deskripsi, tampil_publik)
SELECT 'Profil & Kajian Indikator Makro Sosial Ekonomi Kabupaten Sumba Barat', 'Publikasi Kajian',
       2025, 'Publikasi-01/BAPPERIDA/2025', 'BAPPERIDA Kab. Sumba Barat',
       'Ringkasan eksekutif perkembangan indikator makro ekonomi, kemiskinan, stunting, dan infrastruktur dasar Kabupaten Sumba Barat.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM sd_konten_publikasi WHERE jenis = 'Publikasi Kajian' LIMIT 1);

INSERT INTO sd_konten_tautan (judul, tipe, url, instansi, deskripsi, urutan, is_active)
SELECT 'Portal Satu Data Indonesia (SDI)', 'portal_eksternal', 'https://data.go.id', 'Kementerian PPN/Bappenas', 'Portal resmi Satu Data Indonesia tingkat nasional.', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM sd_konten_tautan WHERE url = 'https://data.go.id' LIMIT 1);

INSERT INTO sd_konten_tautan (judul, tipe, url, instansi, deskripsi, urutan, is_active)
SELECT 'BPS Kabupaten Sumba Barat', 'portal_eksternal', 'https://sumbabaratkab.bps.go.id', 'Badan Pusat Statistik', 'Publikasi statistik resmi dan indikator makro BPS Kabupaten Sumba Barat.', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM sd_konten_tautan WHERE url = 'https://sumbabaratkab.bps.go.id' LIMIT 1);

INSERT INTO sd_spm_dokumen (judul, kategori, tahun, nomor_dokumen, deskripsi, created_by)
SELECT 'Laporan Penyelenggaraan Standar Pelayanan Minimal (SPM) Kab. Sumba Barat', 'Laporan SPM',
       2025, 'LAP-SPM/01/2025', 'Laporan capaian 6 Urusan Wajib Pelayanan Dasar dan 29 Jenis Layanan SPM Kabupaten Sumba Barat.', 'Admin BAPPERIDA'
WHERE NOT EXISTS (SELECT 1 FROM sd_spm_dokumen LIMIT 1);

-- ──────────────────────────────────────────────────────────────────────────
-- 19. Dynamic Role & Permission Management (sd_roles) — Modelled on Satu Data
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sd_roles (
  id             BIGSERIAL PRIMARY KEY,
  nama           TEXT UNIQUE NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  deskripsi      TEXT,
  base_level     TEXT NOT NULL DEFAULT 'Staf', -- 'Admin' | 'Reviewer' | 'Operator Bank Data' | 'Staf'
  opd_scoped     BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked      BOOLEAN NOT NULL DEFAULT FALSE,
  warna_bg       TEXT DEFAULT '#EFF6FF',
  warna_text     TEXT DEFAULT '#2563EB',
  allowed_menus  JSONB NOT NULL DEFAULT '[]'::jsonb,
  permissions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sd_roles (nama, slug, deskripsi, base_level, opd_scoped, is_locked, warna_bg, warna_text, allowed_menus, permissions)
VALUES
  (
    'Admin',
    'admin',
    'Superadmin BAPPERIDA dengan akses penuh ke seluruh fitur Arsip Digital, Perencanaan, Master Satu Data, SPM, Kelola Konten, Monitoring, Pengguna, dan Kelola Role.',
    'Admin',
    FALSE,
    TRUE,
    '#EDE9FE',
    '#7C3AED',
    '["dashboard","dokumen","upload","pencarian","publik","kertas-kerja","screening","bankdata","spm","pengguna","kelola-role","master-satudata","kelola-konten","monitoring","kategori-dokumen","sektor","standar-harga","audit","panduan"]'::jsonb,
    '["*"]'::jsonb
  ),
  (
    'Walidata',
    'walidata',
    'Walidata Daerah / Koordinator Satu Data yang berwenang mengelola Master Satu Data, memverifikasi Dataset Sektoral, menyetujui Reopen, mengelola Konten Portal, SPM, dan Monitoring.',
    'Admin',
    FALSE,
    FALSE,
    '#FEF3C7',
    '#D97706',
    '["dashboard","dokumen","pencarian","publik","bankdata","spm","master-satudata","kelola-konten","monitoring","panduan"]'::jsonb,
    '["dashboard.read","dokumen.read","bankdata.read","bankdata.create","bankdata.update","bankdata.delete","bankdata.import","bankdata.export","bankdata.verify","spm.read","spm.create","spm.update","spm.delete","spm.import","spm.export","master_opd.read","master_opd.create","master_opd.update","master_urusan.read","master_urusan.create","master_urusan.update","master_topik.read","master_topik.create","master_topik.update","master_satuan.read","master_satuan.create","master_satuan.update","master_sk.read","master_sk.create","master_sk.update","master_template.read","master_template.create","master_template.update","master_wilayah.read","master_wilayah.create","master_wilayah.update","reopen.read","reopen.verify","konten.read","konten.create","konten.update","konten.delete","monitoring.read","monitoring.update","monitoring.export"]'::jsonb
  ),
  (
    'Reviewer',
    'reviewer',
    'Kepala Bidang / Kasubbag Perencanaan yang berwenang me-review dokumen arsip, memverifikasi pengajuan dataset sektoral, dan memantau capaian perencanaan.',
    'Reviewer',
    FALSE,
    FALSE,
    '#EFF6FF',
    '#2563EB',
    '["dashboard","dokumen","upload","pencarian","publik","kertas-kerja","screening","bankdata","spm","panduan"]'::jsonb,
    '["dashboard.read","dokumen.read","dokumen.create","dokumen.update","dokumen.verify","kertas_kerja.read","kertas_kerja.update","screening.read","screening.verify","bankdata.read","bankdata.verify","bankdata.export","spm.read","spm.export","reopen.read","reopen.verify"]'::jsonb
  ),
  (
    'Operator Bank Data',
    'operator-bank-data',
    'Operator Perangkat Daerah (OPD) yang berwenang mengelola IKU, IKK, dan Dataset Sektoral khusus untuk OPD tempatnya bertugas.',
    'Operator Bank Data',
    TRUE,
    FALSE,
    '#ECFEFF',
    '#0E7490',
    '["bankdata"]'::jsonb,
    '["bankdata.read","bankdata.create","bankdata.update","bankdata.delete","bankdata.import","bankdata.export","reopen.read","reopen.create"]'::jsonb
  ),
  (
    'Produsen Data',
    'produsen-data',
    'Produsen Data Perangkat Daerah (OPD) yang berwenang mengisi Dataset Sektoral, mengajukan Reopen, dan melihat Capaian SPM sesuai cakupan OPD.',
    'Operator Bank Data',
    TRUE,
    FALSE,
    '#FCE7F3',
    '#BE185D',
    '["dashboard","bankdata","spm","publik","panduan"]'::jsonb,
    '["dashboard.read","bankdata.read","bankdata.create","bankdata.update","bankdata.import","bankdata.export","spm.read","spm.export","reopen.read","reopen.create"]'::jsonb
  ),
  (
    'Staf',
    'staf',
    'Staf Perencanaan BAPPERIDA yang berwenang mengunggah dokumen arsip, mengisi Kertas Kerja, menyusun rencana Screening RKA, serta melihat Bank Data dan SPM.',
    'Staf',
    FALSE,
    FALSE,
    '#F0FDF4',
    '#16A34A',
    '["dashboard","dokumen","upload","pencarian","publik","kertas-kerja","screening","bankdata","spm","panduan"]'::jsonb,
    '["dashboard.read","dokumen.read","dokumen.create","kertas_kerja.read","kertas_kerja.create","kertas_kerja.update","screening.read","screening.create","screening.update","bankdata.read","bankdata.export","spm.read","spm.export"]'::jsonb
  )
ON CONFLICT (nama) DO NOTHING;
