-- Tahap 6: Perubahan Bank Data
-- - Tambah kolom satuan untuk IKU, IKK, Data Sektoral (indikator)
-- - Aspek tetap untuk Data Sektoral & IKK; IKU tidak menggunakan aspek (sesuai permintaan)

DO $$
BEGIN
  -- IKU: tambah satuan
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'bank_data_iku'
      AND column_name = 'satuan'
  ) THEN
    ALTER TABLE bank_data_iku ADD COLUMN satuan TEXT;
  END IF;

  -- IKK: tambah satuan
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'bank_data_ikk'
      AND column_name = 'satuan'
  ) THEN
    ALTER TABLE bank_data_ikk ADD COLUMN satuan TEXT;
  END IF;

  -- Data Sektoral indikator: tambah satuan
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'bank_data_sektoral_indikator'
      AND column_name = 'satuan'
  ) THEN
    ALTER TABLE bank_data_sektoral_indikator ADD COLUMN satuan TEXT;
  END IF;
END $$;