-- ============================================================
-- MIGRASI — Bank Data Hierarki (Bidang → OPD → IKU → IKK → Detail)
-- Jalankan sekali di PostgreSQL. Aman dijalankan ulang (IF NOT EXISTS).
-- ============================================================

-- OPD per Bidang (bidang diambil dari master bidang_list BAPPERIDA)
CREATE TABLE IF NOT EXISTS bank_data_opd (
    id          BIGSERIAL PRIMARY KEY,
    bidang_id   BIGINT NOT NULL REFERENCES bidang_list(id) ON DELETE CASCADE,
    nama        TEXT   NOT NULL,
    urutan      INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- IKU (Indikator Kinerja Utama) per OPD
CREATE TABLE IF NOT EXISTS bank_data_iku (
    id          BIGSERIAL PRIMARY KEY,
    opd_id      BIGINT NOT NULL REFERENCES bank_data_opd(id) ON DELETE CASCADE,
    nama        TEXT   NOT NULL,
    urutan      INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- IKK (Indikator Kinerja Kunci) per IKU
CREATE TABLE IF NOT EXISTS bank_data_ikk (
    id          BIGSERIAL PRIMARY KEY,
    iku_id      BIGINT NOT NULL REFERENCES bank_data_iku(id) ON DELETE CASCADE,
    nama        TEXT   NOT NULL,
    urutan      INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Detail indikator per IKK: indikator, data, sumber_data, aspek, tahun
CREATE TABLE IF NOT EXISTS bank_data_detail (
    id          BIGSERIAL PRIMARY KEY,
    ikk_id      BIGINT NOT NULL REFERENCES bank_data_ikk(id) ON DELETE CASCADE,
    indikator   TEXT   NOT NULL,
    data        TEXT,
    sumber_data TEXT,
    aspek       TEXT,
    tahun       INTEGER,
    urutan      INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);