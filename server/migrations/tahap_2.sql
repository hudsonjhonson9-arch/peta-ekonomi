-- Tahap 2: Pohon Program/Kegiatan/Sub Kegiatan + Kertas Kerja (Output)
--
-- Pohon PKS dibuat sendiri di arsip-digital (bukan tabel SIMAPO) agar fitur ini
-- mandiri. Dimensi tahun mengikuti pola bank_data_*_nilai: tahun ada di tiap
-- level pohon, sehingga RKPD 2025 dan RKPD 2027 dapat berdiri berdampingan.
--
-- Catatan desain:
-- - Rantai FK memakai ON DELETE RESTRICT, bukan CASCADE. kertas_kerja_periode
--   menyimpan progres dan doc_id; cascade akan menghapus riwayat tahun tanpa
--   jejak. Dengan RESTRICT, hapus sub kegiatan yang sudah punya output ditolak.
-- - Tidak ada kolom status di kertas_kerja_periode. Status diturunkan saat query
--   dari bapperida_dokumen.status + deadline, jadi tidak pernah out-of-sync.
-- - doc_id mengikuti tipe bapperida_dokumen.id (INT), sama seperti doc_versions.

-- ── Master daftar tahun ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pks_tahun (
  id     SERIAL PRIMARY KEY,
  tahun  INTEGER UNIQUE NOT NULL
);

-- ── Program ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pks_program (
  id          SERIAL PRIMARY KEY,
  kode        VARCHAR(20) NOT NULL,
  nama        TEXT        NOT NULL,
  urutan      INTEGER     NOT NULL DEFAULT 0,
  tahun       INTEGER     NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kode, tahun)
);

-- ── Kegiatan ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pks_kegiatan (
  id          SERIAL PRIMARY KEY,
  program_id  INTEGER     NOT NULL REFERENCES pks_program(id) ON DELETE RESTRICT,
  kode        VARCHAR(30) NOT NULL,
  nama        TEXT        NOT NULL,
  urutan      INTEGER     NOT NULL DEFAULT 0,
  tahun       INTEGER     NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kode, tahun)
);
CREATE INDEX IF NOT EXISTS pks_kegiatan_program_idx ON pks_kegiatan (program_id, urutan);

-- ── Sub Kegiatan ──────────────────────────────────────────────────────────
-- indikator & target berasal dari kolom "Indikator" pada kertas kerja RKPD.
CREATE TABLE IF NOT EXISTS pks_subkegiatan (
  id           SERIAL PRIMARY KEY,
  kegiatan_id  INTEGER     NOT NULL REFERENCES pks_kegiatan(id) ON DELETE RESTRICT,
  kode         VARCHAR(40) NOT NULL,
  nama         TEXT        NOT NULL,
  urutan       INTEGER     NOT NULL DEFAULT 0,
  tahun        INTEGER     NOT NULL,
  indikator    TEXT,
  target       TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kode, tahun)
);
CREATE INDEX IF NOT EXISTS pks_subkegiatan_kegiatan_idx ON pks_subkegiatan (kegiatan_id, urutan);

-- ── Kertas Kerja (output per sub kegiatan) ─────────────────────────────────
-- Satu baris = satu nama dokumen yang harus dilaporkan.
-- frekuensi   : Bulanan | Triwulan | Semesteran | Tahunan | Lainnya.
--                Frekuensi hanya menentukan penamaan periode dan aturan
--                deadline, BUKAN jumlah periodenya.
-- target_per_tahun : JUMLAH periode dalam setahun (keputusan final: target yang
--                menentukan, jadi target 12 = 12 periode wajib / 12 dokumen).
--                Diturunkan ke deadline_rule oleh rencanaPeriode() di
--                server/index.js. Nilai di luar 1..24 dipotong ke 24.
-- bulan_wajib : '*' = semua periode wajib, atau daftar '1,3,5,7,9,11'
-- deadline_rule : lihat DEADLINE_PRESET di src/data.js dan hitungDeadline()
--                di server/index.js. Nilai 'Lainnya' memakai 'year_end'.
CREATE TABLE IF NOT EXISTS kertas_kerja (
  id               SERIAL PRIMARY KEY,
  subkegiatan_id   INTEGER     NOT NULL REFERENCES pks_subkegiatan(id) ON DELETE RESTRICT,
  nama             TEXT        NOT NULL,
  indikator        TEXT,
  frekuensi        TEXT        NOT NULL DEFAULT 'Tahunan',
  target_per_tahun INTEGER     NOT NULL DEFAULT 1,
  bulan_wajib      TEXT        NOT NULL DEFAULT '*',
  deadline_rule    TEXT        NOT NULL DEFAULT 'year_end',
  pic_id           TEXT,
  keterangan       TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subkegiatan_id, nama)
);
CREATE INDEX IF NOT EXISTS kertas_kerja_subkegiatan_idx ON kertas_kerja (subkegiatan_id);

-- ── Periode per tahun ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kertas_kerja_periode (
  id              SERIAL PRIMARY KEY,
  kertas_kerja_id INTEGER     NOT NULL REFERENCES kertas_kerja(id) ON DELETE CASCADE,
  tahun           INTEGER     NOT NULL,
  periode         INTEGER     NOT NULL,
  periode_label   TEXT        NOT NULL,
  deadline        DATE        NOT NULL,
  is_wajib        BOOLEAN     NOT NULL DEFAULT TRUE,
  doc_id          INTEGER     REFERENCES bapperida_dokumen(id) ON DELETE SET NULL,
  uploaded_by     TEXT,
  uploaded_at     TIMESTAMPTZ,
  catatan         TEXT,
  UNIQUE (kertas_kerja_id, tahun, periode)
);
CREATE INDEX IF NOT EXISTS kkp_tahun_idx    ON kertas_kerja_periode (tahun, deadline);
CREATE INDEX IF NOT EXISTS kkp_doc_idx      ON kertas_kerja_periode (doc_id) WHERE doc_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS kkp_wajib_idx    ON kertas_kerja_periode (kertas_kerja_id) WHERE is_wajib;