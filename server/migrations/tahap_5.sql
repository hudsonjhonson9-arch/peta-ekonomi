-- Tahap 5: sambungkan kembali bukti dukung yang sudah terunggah tapi tidak
-- pernah tertaut ke Kertas Kerja.
--
-- Gejalanya: dokumen ada di arsip (bapperida_dokumen) tapi baris
-- kertas_kerja_periode-nya masih doc_id IS NULL, jadi output-nya tampil belum
-- terisi padahal buktinya sudah ada. Penyebabnya tautan dibuat lewat permintaan
-- terpisah setelah upload selesai, dan kalau permintaan itu gagal tidak ada
-- kolom yang menyimpan asal-usul dokumen.
--
-- Pencocokan memakai judul persis, bukan LIKE. Dialog unggah Kertas Kerja
-- selalu menamai dokumen "<nama output> <em-dash> <label periode>" (lihat
-- judulDokumenPeriode di server/tautan-periode.js), jadi pencocokan persis
-- cukup untuk menemukan kembali dokumen yang kehilangan tautan — dan tidak
-- pernah perlu menebak dokumen mana yang benar.
--
-- Dokumen yang cocok tetapi sudah dipakai periode lain tidak disentuh.
--
-- Idempoten: hanya menyentuh baris dengan doc_id IS NULL, jadi berkas ini
-- aman dijalankan ulang setiap kali server start.

-- Mempercepat pencocokan judul pada tabel yang besar.
CREATE INDEX IF NOT EXISTS bapperida_dokumen_judul_idx ON bapperida_dokumen (judul);

WITH jodoh AS (
  -- Satu periode hanya boleh memilih satu dokumen. Tanpa DISTINCT ON ini,
  -- satu baris bisa terkena dua UPDATE sekaligus dan PostgreSQL mengabaikannya
  -- secara diam-diam.
  SELECT DISTINCT ON (p.id)
         p.id                       AS periode_id,
         d.id                       AS doc_id,
         COALESCE(p.uploaded_by, d.uploader_id) AS uploaded_by,
         COALESCE(p.uploaded_at, d.tanggal)    AS uploaded_at
    FROM kertas_kerja_periode p
    JOIN kertas_kerja k      ON k.id = p.kertas_kerja_id
    JOIN bapperida_dokumen d ON d.judul = k.nama || ' ' || '—' || ' ' || p.periode_label
   WHERE p.doc_id IS NULL
   ORDER BY p.id, d.id
),
bebas AS (
  -- Buang kandidat dokumen yang sudah jadi bukti periode lain.
  SELECT j.*
    FROM jodoh j
   WHERE NOT EXISTS (SELECT 1 FROM kertas_kerja_periode x WHERE x.doc_id = j.doc_id)
),
final AS (
  -- Satu dokumen hanya boleh jadi bukti satu periode. Kalau judulnya kebetulan
  -- sama untuk dua periode, yang tertua yang dipilih supaya hasilnya stabil,
  -- dan periode yang lain bisa ditautkan ulang lewat tombol "Hubungkan".
  SELECT DISTINCT ON (b.doc_id)
         b.periode_id, b.doc_id, b.uploaded_by, b.uploaded_at
    FROM bebas b
    JOIN kertas_kerja_periode p2 ON p2.id = b.periode_id
   ORDER BY b.doc_id, p2.tahun, p2.periode
)
UPDATE kertas_kerja_periode p
   SET doc_id      = f.doc_id,
       uploaded_by = f.uploaded_by,
       uploaded_at = f.uploaded_at
  FROM final f
 WHERE p.id = f.periode_id;