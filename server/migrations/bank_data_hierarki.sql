-- ============================================================
-- MIGRASI — Bank Data Hierarki v2
-- Struktur: Bidang → OPD → IKU → IKK  +  Data Sektoral (setara IKU)
-- IKU  indikator : target & capaian per tahun + triwulan (TW1-TW4)
-- IKK  indikator : capaian & realisasi per tahun + triwulan
-- Data Sektoral  : data per tahun + triwulan
-- Tahun diatur admin via tabel bank_data_tahun
-- ============================================================

-- Daftar tahun global (diatur admin)
CREATE TABLE IF NOT EXISTS bank_data_tahun (
    id          SERIAL PRIMARY KEY,
    tahun       INTEGER UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── IKU ───────────────────────────────────────────────────────
-- Indikator IKU
CREATE TABLE IF NOT EXISTS bank_data_iku_indikator (
    id          BIGSERIAL PRIMARY KEY,
    iku_id      BIGINT NOT NULL REFERENCES bank_data_iku(id) ON DELETE CASCADE,
    indikator   TEXT   NOT NULL,
    sumber_data TEXT,
    aspek       TEXT,
    urutan      INTEGER DEFAULT 0
);
-- Nilai per tahun untuk indikator IKU: target & capaian
CREATE TABLE IF NOT EXISTS bank_data_iku_nilai (
    id           BIGSERIAL PRIMARY KEY,
    indikator_id BIGINT NOT NULL REFERENCES bank_data_iku_indikator(id) ON DELETE CASCADE,
    tahun        INTEGER NOT NULL,
    target       TEXT,
    capaian      TEXT,
    UNIQUE (indikator_id, tahun)
);
-- Triwulan (TW1-TW4) per tahun untuk indikator IKU
CREATE TABLE IF NOT EXISTS bank_data_iku_triwulan (
    id           BIGSERIAL PRIMARY KEY,
    indikator_id BIGINT NOT NULL REFERENCES bank_data_iku_indikator(id) ON DELETE CASCADE,
    tahun        INTEGER NOT NULL,
    target_tw1 TEXT, target_tw2 TEXT, target_tw3 TEXT, target_tw4 TEXT,
    capaian_tw1 TEXT, capaian_tw2 TEXT, capaian_tw3 TEXT, capaian_tw4 TEXT,
    UNIQUE (indikator_id, tahun)
);

-- ── IKK (di bawah IKU) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_data_ikk_indikator (
    id          BIGSERIAL PRIMARY KEY,
    ikk_id      BIGINT NOT NULL REFERENCES bank_data_ikk(id) ON DELETE CASCADE,
    indikator   TEXT   NOT NULL,
    sumber_data TEXT,
    aspek       TEXT,
    urutan      INTEGER DEFAULT 0
);
-- Nilai per tahun untuk indikator IKK: capaian & realisasi
CREATE TABLE IF NOT EXISTS bank_data_ikk_nilai (
    id           BIGSERIAL PRIMARY KEY,
    indikator_id BIGINT NOT NULL REFERENCES bank_data_ikk_indikator(id) ON DELETE CASCADE,
    tahun        INTEGER NOT NULL,
    capaian      TEXT,
    realisasi    TEXT,
    UNIQUE (indikator_id, tahun)
);
-- Triwulan (TW1-TW4) per tahun untuk indikator IKK
CREATE TABLE IF NOT EXISTS bank_data_ikk_triwulan (
    id           BIGSERIAL PRIMARY KEY,
    indikator_id BIGINT NOT NULL REFERENCES bank_data_ikk_indikator(id) ON DELETE CASCADE,
    tahun        INTEGER NOT NULL,
    capaian_tw1 TEXT, capaian_tw2 TEXT, capaian_tw3 TEXT, capaian_tw4 TEXT,
    realisasi_tw1 TEXT, realisasi_tw2 TEXT, realisasi_tw3 TEXT, realisasi_tw4 TEXT,
    UNIQUE (indikator_id, tahun)
);

-- ── Data Sektoral (setara IKU, langsung di bawah OPD) ─────────
CREATE TABLE IF NOT EXISTS bank_data_sektoral (
    id          BIGSERIAL PRIMARY KEY,
    opd_id      BIGINT NOT NULL REFERENCES bank_data_opd(id) ON DELETE CASCADE,
    nama        TEXT   NOT NULL,
    urutan      INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bank_data_sektoral_indikator (
    id          BIGSERIAL PRIMARY KEY,
    sektoral_id BIGINT NOT NULL REFERENCES bank_data_sektoral(id) ON DELETE CASCADE,
    indikator   TEXT   NOT NULL,
    sumber_data TEXT,
    aspek       TEXT,
    urutan      INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bank_data_sektoral_nilai (
    id           BIGSERIAL PRIMARY KEY,
    indikator_id BIGINT NOT NULL REFERENCES bank_data_sektoral_indikator(id) ON DELETE CASCADE,
    tahun        INTEGER NOT NULL,
    data         TEXT,
    UNIQUE (indikator_id, tahun)
);
-- Triwulan (TW1-TW4) per tahun untuk indikator sektoral
CREATE TABLE IF NOT EXISTS bank_data_sektoral_triwulan (
    id           BIGSERIAL PRIMARY KEY,
    indikator_id BIGINT NOT NULL REFERENCES bank_data_sektoral_indikator(id) ON DELETE CASCADE,
    tahun        INTEGER NOT NULL,
    data_tw1 TEXT, data_tw2 TEXT, data_tw3 TEXT, data_tw4 TEXT,
    UNIQUE (indikator_id, tahun)
);