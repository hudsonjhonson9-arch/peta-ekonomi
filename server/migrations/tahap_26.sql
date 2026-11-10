-- ============================================================
-- Tahap 26: Buku Agenda Surat Masuk, Surat Keluar & Register SPPD
-- Sistem: ARSIP DIGITAL BAPPERIDA (peta-ekonomi)
-- ============================================================

-- 1. TABEL AGENDA SURAT MASUK
CREATE TABLE IF NOT EXISTS agenda_surat_masuk (
    id                  SERIAL PRIMARY KEY,
    tahun               INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    nomor_agenda        VARCHAR(50) NOT NULL,
    tanggal_terima      DATE NOT NULL DEFAULT CURRENT_DATE,
    nomor_surat_asli    VARCHAR(150) NOT NULL,
    tanggal_surat       DATE NOT NULL DEFAULT CURRENT_DATE,
    asal_surat          VARCHAR(255) NOT NULL,
    perihal             TEXT NOT NULL,
    sifat               VARCHAR(50) DEFAULT 'Biasa',
    kode_klasifikasi    VARCHAR(50),
    jumlah_lampiran     VARCHAR(50) DEFAULT '—',
    file_url            TEXT,
    file_name           VARCHAR(255),
    status              VARCHAR(50) DEFAULT 'Diterima',
    created_by          VARCHAR(100),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surat_masuk_tahun ON agenda_surat_masuk(tahun);
CREATE INDEX IF NOT EXISTS idx_surat_masuk_no_agenda ON agenda_surat_masuk(nomor_agenda);

-- 2. TABEL LEMBAR DISPOSISI SURAT MASUK
CREATE TABLE IF NOT EXISTS agenda_disposisi (
    id                  SERIAL PRIMARY KEY,
    surat_masuk_id      INT REFERENCES agenda_surat_masuk(id) ON DELETE CASCADE,
    tanggal_disposisi   DATE NOT NULL DEFAULT CURRENT_DATE,
    pemberi_disposisi   VARCHAR(100) NOT NULL,
    arahan              JSONB DEFAULT '[]'::jsonb,
    catatan_instruksi   TEXT,
    diteruskan_kepada   JSONB DEFAULT '[]'::jsonb,
    batas_waktu         DATE,
    status_tindaklanjut VARCHAR(50) DEFAULT 'Didisposisikan',
    laporan_staf        TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disposisi_surat_id ON agenda_disposisi(surat_masuk_id);

-- 3. TABEL AGENDA SURAT KELUAR
CREATE TABLE IF NOT EXISTS agenda_surat_keluar (
    id                  SERIAL PRIMARY KEY,
    tahun               INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    nomor_agenda        VARCHAR(50) NOT NULL,
    nomor_surat         VARCHAR(150) NOT NULL,
    kode_klasifikasi    VARCHAR(50) NOT NULL,
    nomor_urut          INT NOT NULL,
    tanggal_surat       DATE NOT NULL DEFAULT CURRENT_DATE,
    tujuan_surat        VARCHAR(255) NOT NULL,
    perihal             TEXT NOT NULL,
    sifat               VARCHAR(50) DEFAULT 'Biasa',
    bidang_pengonsep    VARCHAR(100) NOT NULL,
    penandatangan       VARCHAR(100) NOT NULL,
    surat_masuk_ref_id  INT REFERENCES agenda_surat_masuk(id) ON DELETE SET NULL,
    file_draft_url      TEXT,
    file_final_url      TEXT,
    status              VARCHAR(50) DEFAULT 'Draf',
    created_by          VARCHAR(100),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surat_keluar_tahun ON agenda_surat_keluar(tahun);
CREATE INDEX IF NOT EXISTS idx_surat_keluar_no ON agenda_surat_keluar(nomor_surat);

-- 4. TABEL BUKU REGISTER SPPD (DALAM & LUAR DAERAH)
CREATE TABLE IF NOT EXISTS agenda_sppd (
    id                  SERIAL PRIMARY KEY,
    jenis_sppd          VARCHAR(20) NOT NULL CHECK (jenis_sppd IN ('DALAM_DAERAH', 'LUAR_DAERAH')),
    tahun               INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    nomor_register      VARCHAR(50) NOT NULL,
    nomor_spt           VARCHAR(100) NOT NULL,
    nomor_sppd          VARCHAR(100) NOT NULL,
    tanggal_spt         DATE NOT NULL DEFAULT CURRENT_DATE,
    pejabat_perintah    VARCHAR(100) NOT NULL,
    
    pelaksana_nip       VARCHAR(50) NOT NULL,
    pelaksana_nama      VARCHAR(150) NOT NULL,
    pelaksana_pangkat   VARCHAR(100),
    pelaksana_jabatan   VARCHAR(150),
    pengikut            JSONB DEFAULT '[]'::jsonb,
    
    maksud_perjalanan   TEXT NOT NULL,
    tempat_berangkat    VARCHAR(100) DEFAULT 'Waikabubak',
    tempat_tujuan       VARCHAR(255) NOT NULL,
    provinsi_tujuan     VARCHAR(100),
    rute_perjalanan     VARCHAR(255),
    alat_angkutan       VARCHAR(100) DEFAULT 'Darat',
    tanggal_berangkat   DATE NOT NULL,
    tanggal_kembali     DATE NOT NULL,
    lama_hari           INT NOT NULL DEFAULT 1,
    
    subkegiatan_id      INT,
    subkegiatan_nama    TEXT,
    kode_rekening       VARCHAR(50),
    
    rincian_biaya       JSONB DEFAULT '{}'::jsonb,
    total_biaya         NUMERIC(15,2) DEFAULT 0,
    
    file_spt_url        TEXT,
    file_sppd_url       TEXT,
    file_lhp_url        TEXT,
    berkas_spj          JSONB DEFAULT '[]'::jsonb,
    
    surat_masuk_ref_id  INT REFERENCES agenda_surat_masuk(id) ON DELETE SET NULL,
    status              VARCHAR(50) DEFAULT 'Pengajuan',
    created_by          VARCHAR(100),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sppd_jenis_tahun ON agenda_sppd(jenis_sppd, tahun);
CREATE INDEX IF NOT EXISTS idx_sppd_nomor_spt ON agenda_sppd(nomor_spt);
