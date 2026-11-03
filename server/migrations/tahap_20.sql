-- Tahap 20: SEO, Metadata Publik, dan Captcha
CREATE TABLE IF NOT EXISTS sd_captcha_session (
  id          BIGSERIAL PRIMARY KEY,
  token       TEXT NOT NULL UNIQUE,
  jawaban     TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_captcha_token ON sd_captcha_session(token);

-- Tambah kolom kontak dan deskripsi pada bank_data_opd bila belum ada
ALTER TABLE bank_data_opd ADD COLUMN IF NOT EXISTS kontak_nama TEXT;
ALTER TABLE bank_data_opd ADD COLUMN IF NOT EXISTS kontak_email TEXT;
ALTER TABLE bank_data_opd ADD COLUMN IF NOT EXISTS kontak_telepon TEXT;
ALTER TABLE bank_data_opd ADD COLUMN IF NOT EXISTS alamat TEXT;
