-- Tahap 19: Pelacakan Portal Publik (Dataset Views, Berita Views, Riwayat Pencarian)
CREATE TABLE IF NOT EXISTS sd_dataset_stat (
  id          BIGSERIAL PRIMARY KEY,
  dataset_id  BIGINT NOT NULL REFERENCES bank_dataset(id) ON DELETE CASCADE,
  view_count  INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_viewed TIMESTAMPTZ,
  UNIQUE(dataset_id)
);

ALTER TABLE sd_konten_berita ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sd_konten_berita ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slug untuk berita yang belum punya slug
UPDATE sd_konten_berita 
   SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(judul), '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g')) || '-' || id
 WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_konten_berita_slug ON sd_konten_berita(slug);
