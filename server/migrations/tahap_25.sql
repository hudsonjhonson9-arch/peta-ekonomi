-- Tahap 25: Dukungan Polaritas Indikator (Maksimasi vs Minimasi)
-- Positif (Maksimasi): Semakin tinggi nilainya semakin baik (misal: APM, IPM, PAD, Produksi Padi, Capaian SPM)
-- Negatif (Minimasi): Semakin kecil nilainya semakin baik (misal: Kemiskinan, Prevalensi Stunting, Pengangguran, Kematian)

ALTER TABLE bank_dataset ADD COLUMN IF NOT EXISTS polaritas VARCHAR(20) DEFAULT 'positif';
ALTER TABLE bank_dataset_field ADD COLUMN IF NOT EXISTS polaritas VARCHAR(20) DEFAULT 'positif';

-- Update dataset indikator bertipe negatif (minimasi)
UPDATE bank_dataset
SET polaritas = 'negatif'
WHERE (
  LOWER(nama) LIKE '%miskin%' OR
  LOWER(nama) LIKE '%kemiskinan%' OR
  LOWER(nama) LIKE '%stunting%' OR
  LOWER(nama) LIKE '%kematian%' OR
  LOWER(nama) LIKE '%pengangguran%' OR
  LOWER(nama) LIKE '%gizi buruk%' OR
  LOWER(nama) LIKE '%putus sekolah%' OR
  LOWER(nama) LIKE '%kriminal%'
) AND (polaritas IS NULL OR polaritas = 'positif');

UPDATE bank_dataset_field
SET polaritas = 'negatif'
WHERE (
  LOWER(label) LIKE '%miskin%' OR
  LOWER(label) LIKE '%kemiskinan%' OR
  LOWER(label) LIKE '%stunting%' OR
  LOWER(label) LIKE '%kematian%' OR
  LOWER(label) LIKE '%pengangguran%'
) AND (polaritas IS NULL OR polaritas = 'positif');

