-- Tahap 18: Keamanan & Akun (Reset Password, Profil, dan Log Keamanan)
CREATE TABLE IF NOT EXISTS sd_password_reset_token (
  id          BIGSERIAL PRIMARY KEY,
  nip         TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_pwd_reset_nip ON sd_password_reset_token(nip);
CREATE INDEX IF NOT EXISTS idx_sd_pwd_reset_token ON sd_password_reset_token(token);

-- Log upaya login / audit keamanan
CREATE TABLE IF NOT EXISTS sd_auth_log (
  id          BIGSERIAL PRIMARY KEY,
  nip         TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  status      TEXT NOT NULL, -- 'sukses', 'gagal', 'reset_password'
  pesan       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_auth_log_created ON sd_auth_log(created_at DESC);
