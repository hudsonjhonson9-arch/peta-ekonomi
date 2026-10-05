-- Tahap 4: notifikasi deadline Kertas Kerja.
--
-- notifications sebelumnya tidak punya cara untuk menunjuk periode mana yang
-- sudah diberi tahu. Tanpa itu, pengingat deadline akan terkirim ulang setiap
--kali server dijalankan, karena satu-satunya penanda "sudah dikirim" ada di
--memori proses dan hilang saat restart.
--
-- dedupe_key + unique index partial menyelesaikannya: kunci untuk satu
-- pengingat dibangun dari (periode, ambang, penerima), jadi percobaan kedua
-- untuk kunci yang sama ditolak oleh ON CONFLICT DO NOTHING tanpa error dan
-- tanpa perlu cek-select sebelum menulis.

-- Kolom rujukan. ON DELETE CASCADE dipakai karena notifikasi tentang periode
-- yang sudah dihapus hanya jadi sampah; halaman periodenya juga sudah hilang.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kertas_kerja_id INTEGER REFERENCES kertas_kerja(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS periode_id     INTEGER REFERENCES kertas_kerja_periode(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key      TEXT;

-- Partial: NULL tidak pernah diindeks, jadi baris lama (dan notifikasi dari
-- fitur lain yang tidak punya dedupe_key) tidak ikut influencing unique check.
CREATE UNIQUE INDEX IF NOT EXISTS notif_dedupe_idx ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Tanpa ini setiap buka lonceng melakukan full scan untuk 50 baris terbaru.
CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications (user_id, created_at DESC);

-- Pencarian periode yang PIC-nya tertentu dipakai saat menghitung pengingat.
CREATE INDEX IF NOT EXISTS kk_pic_idx ON kertas_kerja (pic_id) WHERE pic_id IS NOT NULL;

-- Samakan identitas notifikasi pada NIP.
--
-- Klien menanyakan notifikasi dengan user_list.id, tapi penulis notifikasi yang
-- sudah ada (persetujuan dokumen, versi baru) menuliskan NIP. Akibatnya hanya
-- notifikasi "Dokumen Baru" yang pernah terlihat di lonceng; sisanya tertulis
-- tapi tidak pernah ditampilkan.
--
-- NIP dipilih sebagai standar sesuai req.pengguna.nip, doc_history.actor_id,
-- dan user_credentials.nip sebagai primary key. Baris lama dimigrasikan supaya
-- riwayat notifikasi yang sudah ada tidak ikut hilang.
--
-- Pencocokan aman: NIP 18 digit, user_list.id 10 digit, jadi tidak mungkin
-- nilai satu ikut tertukar dengan nilai yang lain.
UPDATE notifications n
   SET user_id = u."NIP"
  FROM user_list u
 WHERE u.id::text = n.user_id
   AND u."NIP" IS NOT NULL;