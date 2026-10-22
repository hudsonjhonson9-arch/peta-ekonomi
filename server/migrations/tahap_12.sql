-- Volume boleh 0 (permintaan user 2026-10-22): longgarkan CHECK tahap_8
-- (volume > 0 → volume >= 0). Nama constraint mengikuti nama bawaan
-- PostgreSQL untuk CHECK inline: <tabel>_<kolom>_check.
ALTER TABLE draft_rincian DROP CONSTRAINT IF EXISTS draft_rincian_volume_check;
ALTER TABLE draft_rincian ADD CONSTRAINT draft_rincian_volume_check CHECK (volume >= 0);
