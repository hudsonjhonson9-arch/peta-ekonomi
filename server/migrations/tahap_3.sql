-- Tahap 3: keluarkan output hasil seed lama.
--
-- Latar belakang: seed RKPD 2025 pernah membuat 90 output dari kolom "Output"
-- pada tabel RKPD. Isinya ternyata barang dan jasa ("Bahan Cetak",
-- "Hardisk 500GB (2 unit)"), bukan dokumen yang diunggah pengguna.
-- Keputusan terbaru: output beserta deadline-nya ditentukan admin lewat UI.
--
-- Seed yang sudah pernah jalan tidak bisa dicabut hanya dengan mengedit
-- db/seed_rkpd_2025.sql, karena barisnya sudah ada di database produksi.
-- Migration inilah yang membersihkannya.
--
-- Penanda yang dipakai: created_by diset 'seed <tahun>' oleh generator seed.
-- Output yang dibuat admin melalui UI tidak memakai pola itu, jadi tidak
-- ikut terhapus. Hapus blok ini akan mencederai data admin bila suatu saat
-- penandanya diubah.
--
-- kertas_kerja_periode memakai ON DELETE CASCADE, jadi periodenya ikut terhapus.
-- Seed tidak pernah membuat periode, sehingga tidak ada progres yang hilang.

DELETE FROM kertas_kerja WHERE created_by LIKE 'seed %';