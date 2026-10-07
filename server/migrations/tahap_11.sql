-- tahap_11: kelompok_belanja pada draft_rincian — input manual per baris
-- (pola SIPD-RI: "pengelompokan belanja" sebagai header grup tampilan).
-- ALTER-only, tanpa fallback seperti tahap_10: kegagalan harus terlihat di log.
ALTER TABLE draft_rincian ADD COLUMN IF NOT EXISTS kelompok_belanja TEXT;
