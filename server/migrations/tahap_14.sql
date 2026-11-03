-- Tahap 14: tambah kolom opd_id pada user_credentials untuk akun Operator Bank Data
ALTER TABLE user_credentials
  ADD COLUMN IF NOT EXISTS opd_id BIGINT
  REFERENCES bank_data_opd(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_credentials_opd_id
  ON user_credentials(opd_id);

