-- ============================================================
-- Tahap 0: Migrasi untuk fitur arsip
-- Jalankan: psql -d your_database -f tahap_0.sql
-- ============================================================

-- 1. Kolom baru untuk fitur arsip
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS uploader_id TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS "desc" TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS nomor_dokumen TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS tanggal_dokumen DATE;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS versi INT DEFAULT 1;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS index_status TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS review_note TEXT;

-- 2. Tabel riwayat dokumen (Item 2)
CREATE TABLE IF NOT EXISTS doc_history (
  id          SERIAL PRIMARY KEY,
  doc_id      INT NOT NULL,
  action      TEXT NOT NULL,           -- 'upload' | 'approve' | 'reject' | 'resubmit' | 'version'
  from_status TEXT,
  to_status   TEXT,
  actor_id    TEXT,
  actor_name  TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS doc_history_doc_idx ON doc_history (doc_id, created_at);

-- 3. Tabel versi dokumen (Item 5)
CREATE TABLE IF NOT EXISTS doc_versions (
  id            SERIAL PRIMARY KEY,
  doc_id        INT NOT NULL,
  version_no    INT NOT NULL,
  url           TEXT NOT NULL,
  ukuran        TEXT,
  pages         INT DEFAULT 0,
  uploader_id   TEXT,
  uploader_name TEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doc_id, version_no)
);

-- 4. Tabel konten dokumen untuk full-text search (Item 3)
CREATE TABLE IF NOT EXISTS doc_content (
  id         BIGSERIAL PRIMARY KEY,
  doc_id     INT NOT NULL,
  version_no INT NOT NULL DEFAULT 1,
  page_no    INT NOT NULL,
  content    TEXT NOT NULL,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  UNIQUE (doc_id, version_no, page_no)
);
CREATE INDEX IF NOT EXISTS doc_content_tsv_idx ON doc_content USING GIN (tsv);

-- 5. Tabel notifikasi
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,  -- TEXT because WhatsApp IDs overflow INTEGER
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  doc_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fix for pre-existing INTEGER user_id column with FK constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'user_id' AND data_type = 'integer'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
    ALTER TABLE notifications ALTER COLUMN user_id TYPE TEXT USING user_id::text;
  END IF;
END $$;
