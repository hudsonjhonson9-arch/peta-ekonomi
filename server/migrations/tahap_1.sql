CREATE TABLE IF NOT EXISTS doc_shares (
  id            SERIAL PRIMARY KEY,
  doc_id        INT NOT NULL,
  token         TEXT NOT NULL UNIQUE,
  verif_code    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_doc_shares_token ON doc_shares(token);
CREATE INDEX IF NOT EXISTS idx_doc_shares_verif ON doc_shares(verif_code);
