-- Tahap 23: Pengaturan Website (CMS Dinamis, Aset, Riwayat Revisi & Rollback)
CREATE TABLE IF NOT EXISTS site_setting_revisions (
  id              BIGSERIAL PRIMARY KEY,
  status          VARCHAR(16) NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'archived'
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version  INTEGER NOT NULL DEFAULT 1,
  lock_version    INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  created_by      TEXT,
  updated_by      TEXT,
  published_by    TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_setting_status ON site_setting_revisions(status);
CREATE INDEX IF NOT EXISTS idx_site_setting_created ON site_setting_revisions(created_at DESC);

CREATE TABLE IF NOT EXISTS site_assets (
  id              BIGSERIAL PRIMARY KEY,
  disk            VARCHAR(32) NOT NULL DEFAULT 'local',
  path            TEXT NOT NULL,
  original_name   TEXT NOT NULL,
  mime            VARCHAR(64) NOT NULL,
  width           INTEGER,
  height          INTEGER,
  size            BIGINT NOT NULL,
  hash            VARCHAR(64),
  uploaded_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_assets_hash ON site_assets(hash);

-- Masukkan setelan default awal jika belum ada sama sekali
INSERT INTO site_setting_revisions (status, payload, note, created_by, published_by, published_at)
SELECT 'published', '{
  "identitas": {
    "nama_portal": "Portal Satu Data BAPPERIDA Sumba Barat",
    "nama_daerah": "Kabupaten Sumba Barat",
    "instansi": "Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah",
    "deskripsi": "Portal resmi Satu Data Kabupaten Sumba Barat menyajikan data statistik sektoral, indikator kinerja, capaian SPM, dan informasi perencanaan pembangunan daerah yang akurat, mutakhir, terpadu, dan dapat dipertanggungjawabkan.",
    "email": "bapperida@sumbabaratkab.go.id",
    "telepon": "(0387) 21123",
    "alamat": "Jl. Veteran No. 1, Waikabubak, Sumba Barat, Nusa Tenggara Timur",
    "lat": -9.6253,
    "lng": 119.3496,
    "logo_url": "/logos/logo_sumba_barat.png",
    "facebook": "https://facebook.com/bapperidasumbabarat",
    "instagram": "https://instagram.com/bapperidasumbabarat",
    "twitter": "",
    "youtube": ""
  },
  "tema": {
    "preset": "emerald",
    "warna_primer": "#059669",
    "warna_aksen": "#0284C7",
    "font": "Plus Jakarta Sans",
    "mode_gelap": false
  },
  "beranda": {
    "hero_title": "Satu Data Pembangunan Sumba Barat",
    "hero_subtitle": "Akses mudah, transparan, dan terpadu terhadap indikator statistik sektoral dan capaian pembangunan daerah",
    "tampilkan_spm": true,
    "tampilkan_peta": true,
    "tampilkan_berita": true,
    "tampilkan_statistik": true
  }
}'::jsonb, 'Konfigurasi Bawaan Sistem', 'system', 'system', NOW()
WHERE NOT EXISTS (SELECT 1 FROM site_setting_revisions WHERE status = 'published');
