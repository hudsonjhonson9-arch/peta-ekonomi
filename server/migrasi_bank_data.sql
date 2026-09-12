-- Migration: Bank Data (Indikator Ekonomi)
-- Jalanin ini di database peta_ekonomi via psql atau Coolify

-- Tabel indikator
CREATE TABLE IF NOT EXISTS indikator (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  satuan VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabel nilai per tahun (row-based)
CREATE TABLE IF NOT EXISTS nilai_indikator (
  id SERIAL PRIMARY KEY,
  indikator_id INTEGER NOT NULL REFERENCES indikator(id) ON DELETE CASCADE,
  tahun INTEGER NOT NULL,
  nilai DECIMAL(20,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(indikator_id, tahun)
);

-- Tabel indikator yang tampil di dashboard
CREATE TABLE IF NOT EXISTS indikator_tampil (
  id SERIAL PRIMARY KEY,
  indikator_id INTEGER NOT NULL REFERENCES indikator(id) ON DELETE CASCADE UNIQUE,
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed data contoh
INSERT INTO indikator (nama, satuan) VALUES
  ('Prosentase PAD terhadap APBD', '%'),
  ('PDRB Per Kapita', 'Ribu Rp'),
  ('Nilai PDRB', 'Miliar Rp'),
  ('Indeks Ketahanan Pangan', 'Indeks'),
  ('Tingkat Kemiskinan', '%'),
  ('Tingkat Pengangguran Terbuka', '%')
ON CONFLICT DO NOTHING;

INSERT INTO nilai_indikator (indikator_id, tahun, nilai) VALUES
  (1, 2021, 7.94), (1, 2022, 9.16), (1, 2023, 10.04), (1, 2024, 9.53), (1, 2025, 12.31),
  (2, 2021, 12500), (2, 2022, 13200), (2, 2023, 14100), (2, 2024, 14800), (2, 2025, 15600),
  (3, 2021, 4850), (3, 2022, 5120), (3, 2023, 5480), (3, 2024, 5790), (3, 2025, 6200),
  (4, 2021, 72.5), (4, 2022, 74.1), (4, 2023, 75.8), (4, 2024, 77.2), (4, 2025, 79.0),
  (5, 2021, 12.8), (5, 2022, 12.1), (5, 2023, 11.5), (5, 2024, 10.9), (5, 2025, 10.2),
  (6, 2021, 4.2), (6, 2022, 4.5), (6, 2023, 4.1), (6, 2024, 3.8), (6, 2025, 3.5)
ON CONFLICT DO NOTHING;

INSERT INTO indikator_tampil (indikator_id, urutan) VALUES (1, 1)
ON CONFLICT DO NOTHING;
