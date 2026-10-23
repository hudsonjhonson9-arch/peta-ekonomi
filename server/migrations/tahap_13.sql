-- Tahap 13: ID STANDAR HARGA jadi kunci unik baris standar_harga.
--
-- Sebelum unik, isi dibereskan dulu supaya index tidak pernah gagal. Tanpa
-- langkah 3, baris id_standar_harga NULL akan ikut dianggap sama oleh unique
-- index (dua NULL boleh, tapi banyak baris NULL membuat ON CONFLICT yang
-- menarget kolom gabungan ini tidak bekerja andal) dan unggahan berikutnya
-- bisa menimpa baris yang salah — justru yang ingin dihindari.
--
--  1) id_standar_harga di-trim; string kosong → NULL.
--  2) baris kembar (ID sama, tahun+jenis sama) dipadatkan: baris pertama
--     dipertahankan, sisanya dihapus. Tanpa ini CREATE UNIQUE INDEX gagal
--     total dan index tidak pernah terbentuk.
--  3) baris tanpa ID diberi ID sintetis 'lokal:<md5 isi>:<id pk>'.
--     md5() dihitung dari ISI baris, bukan urutan insert: baris identik
--     mendapat md5 sama (lalu dipisahkan oleh id pk), baris beda isi
--     mendapat md5 berbeda — tidak pernah saling menimpa. md5() bawaan
--     PostgreSQL, tanpa ekstensi pgcrypto.
--  4) index unik BIASA (tahun, jenis, id_standar_harga) — endpoint upload
--     memakai ON CONFLICT yang menarget kolom ini, jadi merge per ID andal.
--
-- File ini idempoten: trim/dedup hanya menyentuh baris yang masih dobel,
-- pembuatan ID hanya baris yang belum ber-ID, index pakai IF NOT EXISTS.

BEGIN;

-- 2) Dedup: satu (tahun, jenis, id_standar_harga) hanya boleh satu baris.
DELETE FROM standar_harga a USING standar_harga b
 WHERE a.id > b.id
   AND a.tahun = b.tahun
   AND a.jenis = b.jenis
   AND a.id_standar_harga IS NOT NULL
   AND a.id_standar_harga = b.id_standar_harga;

UPDATE standar_harga
   SET id_standar_harga = NULLIF(trim(id_standar_harga), '')
 WHERE id_standar_harga IS NOT NULL
   AND id_standar_harga <> trim(id_standar_harga);

UPDATE standar_harga
   SET id_standar_harga = 'lokal:' || md5(
           coalesce(uraian_barang,'')    || '|' ||
           coalesce(spesifikasi,'')      || '|' ||
           coalesce(satuan,'')           || '|' ||
           coalesce(harga_satuan::text,'') || '|' ||
           coalesce(kode_rekening,'')    || '|' ||
           coalesce(kode_barang,'')      || '|' ||
           coalesce(kode_kelompok,'')
         ) || ':' || id::text
 WHERE id_standar_harga IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS standar_harga_id_unik
  ON standar_harga (tahun, jenis, id_standar_harga);

COMMIT;
