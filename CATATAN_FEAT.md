REKOMENDASI FITUR ARSIP DIGITAL

Berdasarkan analisa kode (terbaru: linkage periode–dokumen diperbaiki, transaksi tunggal, migration tahap_5, validasi idDokumenValid):

## 1. Quick Wins (Low Effort, High Impact)

1.1 Export Kertas Kerja CSV (ringkasan + detail periode) → read-only, endpoint + tombol
1.2 Ringkasan lebih detail (Selesai/Menunggu/Ditolak/%)
1.3 Badge "Perlu ditautkan" (orphan)
1.4 Validasi nama Output unik per subkegiatan
1.5 Deep-link buka pohon dari notifikasi

## 2. Penting (Medium)

2.1 Repair tautan massal (one-click) – reuse tahap_5 logic
2.2 Audit trail deadline/link/unlink (kertas_kerja_periode_history)
2.3 Bulk generate sinkron lintas output
2.4 Quick View dokumen dari baris periode
2.5 Auto-reminder H-3/H-1 (cron ringan, hindari duplikasi multi-instance)

## 3. Nice-to-have (Advanced)

3.1 Ganti dokumen tanpa unlink (replace)
3.2 PIC View "Tugas Saya"
3.3 Revisi Diminta saat Ditolak
3.4 Lock periode setelah Diarsipkan
3.5 KPI Heatmap bulanan/triwulan

PRIORITAS #1: 1.1 Export CSV + 2.2 Audit Trail
CATATAN: pakai judulDokumenPeriode (server/tautan-periode.js) untuk konsistensi; export/read-only aman; aksi tulis wajib cek role; migration idempoten.

REQ BANK DATA (baru):
- Pada IKU tidak ada Aspek
- Masing-masing Data Sektoral, IKU, IKK tambahkan Satuannya
- Untuk Aspek pengisiannya menggunakan dropdown custom dengan search
- Opsi Aspek saat ini: Daya Saing Daerah, Pelayanan Umum, Geografi dan Demografi, Kesejahteraan Masyarakat

## REQ SCREENING RKA (V1)

- Menu "Screening RKA" di grup Perencanaan (icon filter), terlihat semua role: daftar tahun → pohon Program → Kegiatan → Sub Kegiatan (accordion).
- Sub kegiatan: input pagu + editor chips kode rekening — Admin saja (canManageOutput); non-admin lihat saja. Chips kosong = semua rekening.
- Tabel standar harga (SSH/SBU) per sub: filter otomatis pakai chips rekening tersimpan (rekening=chips.join(','), kosong = semua + notice "Belum ada rekening — menampilkan semua data"), search box debounce 300ms, maks 500 baris.
- Upload Excel (.xlsx/.xls) client-side (paket xlsx): header dipetakan lewat HEADER_MAP di src/uploadStandarHarga.js (WAJIB sinkron dengan server/standar-harga.js), preview 5 baris + jumlah baris, tombol "Ganti data (replace)" + confirm → POST /api/standar-harga/upload = replace-all per (tahun, jenis); Admin saja.
- Kolom tabel: Uraian, Spesifikasi, Satuan, Harga (rupiah), Kode Rekening.
  (Catatan 2026-10-07: tabel standar harga + upload di detail sub DIHAPUS — lihat section "INPUT RINCIAN ala SIPD".)

## REQ SCREENING RKA — FASE 2 (draft rincian)

- Tabel "Rencana Belanja" (draft_rincian) per sub kegiatan, antara chips rekening dan tabel standar harga: semua staf CRUD (kebijakan LOGIN), kolom Uraian, Spesifikasi, Volume×Satuan, Harga, Rekening, Total (Math.round(volume*harga)), aksi Cocokkan/Edit/Hapus; empty state "Belum ada rencana belanja" + "+ Tambah baris".
- Cocokkan: dari baris otomatis masuk mode edit dulu (panel ada di form); key form = init.id ?? "baru" — form baru juga bisa cocok. Panel top-5 SSH: rekening = kode baris bila diisi (filter server), kosong → tanpa filter server + filter lokal pakai chips; klik kandidat → isi standar_harga_id + harga_standar (+harga_satuan bila kosong/0), "Tanpa standar" → null. Tanpa fuzzy/hierarki/PPN.
  (Catatan 2026-10-07: tombol Cocokkan + PanelCocok diganti dropdown search uraian — lihat section "INPUT RINCIAN ala SIPD".)
- Ringkasan "Rencana vs Pagu" di atas DraftRincian (query react-query sama → dedup): pagu, total rencana (Σ jumlahItem dihitung server), sisa, %, badge Aman <90% / Mendekati 90–100% / Melebihi >100%; pagu kosong → total saja + "Pagu belum diisi".
- API /api/draft-rincian: GET (→ {items, total}) + POST + PUT + DELETE, semua LOGIN; param id/subkegiatan_id dipaksa integer >0 (idAman) → 404 bila tak valid/tidak ada; urutan = MAX+1 saat insert.

## REQ SCREENING RKA — PERUBAHAN ANGGARAN

- Tombol "Inisiasi Perubahan" (Admin saja, header Screening RKA): inisiasi perubahan anggaran pada tahun aktif, opsional catatan. Setiap inisiasi memsnapshot pagu + total rencana tiap sub kegiatan (tabel screening_perubahan + screening_perubahan_item, migration tahap_9).
- Setelah inisiasi, di detail sub kegiatan muncul kolom: Sebelum perubahan (snapshot inisiasi terakhir), Sesudah perubahan (nilai live total rencana), Selisih (+/−, merah/hijau). Riwayat inisiasi tampil ringkas di header (maks 3 + jumlah/terakhir).
- Kolom Realisasi selalu tampil per sub kegiatan (diisi Admin via PUT /api/pks/subkegiatan/:id → kolom pks_subkegiatan.realisasi); non-admin lihat saja.
- API: POST /api/screening/perubahan (ADMIN), GET /api/screening/perubahan?tahun= (LOGIN) → {riwayat, item}.

## REQ SCREENING RKA — ALUR VALIDASI (pola SIPD-RI, scope "inti saja" 2026-10-06)

- Status sub kegiatan: Draft → Menunggu → Disetujui/Ditolak (migration tahap_10: pks_subkegiatan.status_validasi DEFAULT 'draft' + catatan_validasi + status_oleh + status_at). Badge status tampil di baris sub kegiatan + blok "Validasi" di detail sub.
- API: POST /api/screening/ajukan (LOGIN) = Draft/Ditolak → Menunggu (catatan lama dibersihkan, pelaku+waktu dicatat); POST /api/screening/validasi (ADMIN) = status ∈ disetujui|ditolak|draft. Ditolak wajib catatan; Disetujui dipaksa server: pagu terisi >0 DAN total rencana (Σ ROUND(volume*harga_satuan) dihitung ulang di server) ≤ pagu, selain itu 400. Transisi tak sah → 409. Helper murni di server/screening.js (ajukanDari/validasiStatus/cekSetujui) + uji server/screening.uji.mjs.
- Aksi di blok Validasi: staf/Admin saat Draft/Ditolak → "Ajukan ke Admin"; non-admin saat Menunggu → teks "Menunggu validasi Admin…"; Admin saat Menunggu → "Setujui" (dinonaktifkan + alasan bila pagu belum diisi / total melebihi pagu) + "Tolak" (input catatan inline, Enter = konfirmasi); Admin saat Disetujui/Ditolak → "Kembalikan ke Draft" (buka kunci).
- Kunci: selama status menunggu/disetujui, server menolak 409 perubahan pagu & kode_rekening (PUT /api/pks/subkegiatan/:id) dan seluruh CRUD /api/draft-rincian; FE menonaktifkan input/tombol + notice "Terkunci". Realisasi TIDAK ikut dikunci (angka aktual sepanjang tahun). Admin membuka lewat "Kembalikan ke Draft".
- Warning selisih harga vs standar (AMBANG_SELISIH = 10%): badge merah "+12,5%" di kolom Harga baris rincian, warning live di form baris, dan chip "n baris selisih >10% dari standar" di ringkasan Rencana vs Pagu. Peringatan saja — TIDAK memblokir persetujuan (blokir hanya pagu vs total).
- Bugfix ikut-terpasang: SELECT /api/pks/tree sebelumnya tidak ikut memilih kolom realisasi (nilai Realisasi tidak pernah tampil ulang setelah refetch) — sekarang ikut dipilih bersama 4 kolom status baru.

## REQ SCREENING RKA — INPUT RINCIAN ala SIPD (2026-10-07)

- Tabel Standar Harga (baca + upload Excel) DIHAPUS dari detail sub kegiatan — mengikuti pola SIPD-RI (Juknis Bappeda Pekalongan): di SIPD tombol "Standar Harga" hanya pintu memilih komponen untuk baris rincian, bukan konten permanen. Upload/ganti data Excel hanya di menu admin "Standar Harga" (SbuSshAdmin.jsx), server tetap memagari POST /api/standar-harga/upload dengan ADMIN. Import xlsx/parseRows di ScreeningRKA ikut dihapus.
- Uraian baris kini lewat dropdown search (komponen PilihUraian di FormBaris): dua query paralel GET /api/standar-harga (SSH + SBU, react-query), debounce 300ms dari input uraian, filter lokal pakai chips rekening sub kegiatan bila kode_rekening baris kosong (bila terisi → kirim rekening ke server, exact), tampil maks 8 + "n lainnya — persempit pencarian". Pilih item → isi uraian, spesifikasi, satuan, kode_rekening, standar_harga_id, harga_standar (+ harga_satuan bila masih kosong/0); opsi "Tanpa standar harga" → null; mengetik tanpa memilih tetap jadi uraian manual. Badge SSH/SBU per opsi. Tombol "Cocokkan" di form & baris dihapus.
- Kelompok belanja (keputusan user 2026-10-07: input manual per baris, bukan turunan kode rekening): kolom baru `draft_rincian.kelompok_belanja` (migration tahap_11, ALTER-only tanpa fallback). Form baris punya field "Kelompok belanja"; tabel Rencana Belanja dirender bergrup — header per kelompok (urut kemunculan pertama) + subtotal grup, kelompok kosong tampil tanpa header. Server: validasiItem menerima kelompok_belanja (trim, opsional → null) dan POST/PUT /api/draft-rincian ikut menyimpan (INSERT 13 param / UPDATE $10).
  (Catatan 2026-10-07: field "Kelompok belanja" kini punya saran otomatis & field "Kode rekening" jadi pilihan dari daftar — lihat section "KODE REKENING & KELOMPOK DARI DAFTAR".)
- Label "Catatan" pada form baris diganti "Keterangan" (istilah SIPD: subheader per baris) — tanpa migrasi, kolom `catatan` tetap.
- Verifikasi: node --check bersih; 33 uji lulus (6 draft-rincian + asersi kelompok_belanja, 10 screening, 6 standar-harga, 11 tautan-periode; server/index.uji.mjs sengaja dilewati karena memulai server); npm run build sukses.

## REQ SCREENING RKA — KODE REKENING & KELOMPOK DARI DAFTAR (2026-10-07)

- Riset SIPD-RI (Juknis Bappeda Pekalongan langkah 6): urutan input rincian = 1 jenis belanja → 2 **Pilih Rekening/Akun (dari daftar)** → 3 Masukan pengelompokan belanja (Sebagai Header, teks bebas mis. "Belanja ATK") → 4 jenis standar harga → 5 Pilih Komponen (**daftar tersaring oleh rekening** — tiap komponen punya "rekening penyusun") → 6 Keterangan (Subheader) → 7 Koefisien → Simpan. Cetak RKA mengelompokkan per kode rekening/header.
- Field "Kode rekening" di FormBaris kini pemilihan dari daftar (CariPilih), bukan ketik manual: opsi = chips `pks_subkegiatan.kode_rekening` ∪ distinct `standar_harga.kode_rekening` tahun berjalan (gabungan SSH+SBU, dedupe + urut abjad). Tiap kode dari standar_harga menampilkan & bisa dicari lewat **uraian kelompok barang** (`standar_harga.uraian_kelompok`, maks 2 uraian + "+n lainnya" — kebutuhan user: cari rekening lewat uraian, bukan hanya angka). Memilih kode langsung menyaring kandidat uraian (filter exact PilihUraian yang sudah ada); ketik manual tetap diterima utk kode di luar daftar. Empty-state PilihUraian kini menyebut rekening saat daftar kosong karena filter rekening ("Tidak ada SSH/SBU untuk rekening …").
- Field "Kelompok belanja" tetap teks bebas ala SIPD (keputusan user: header ketik manual), kini dengan saran otomatis lewat CariPilih: opsi = kelompok yang sudah pernah dipakai di sub kegiatan ini (distinct `draft_rincian.kelompok_belanja`, dihitung DraftRincian → prop `saranKelompok`); ketik baru tetap diterima.
- Endpoint baru: `GET /api/standar-harga/rekening?tahun=` (LOGIN, aturan eksplisit di kebijakan.js) → `[{kode, uraian:[uraian_kelompok …]}]` (kode distinct btrim + agregasi uraian kelompok barang per kode lewat DISTINCT kode|uraian di SQL → digrup di server; tanpa filter jenis, hanya baris berkode). Hook `useKodeRekening(tahun)` (react-query, tanpa polling — data jarang berubah).
- CariPilih (ui.jsx) menerima pesan empty-state opsional `kosongDaftar`/`kosongCari` — default tetap bahasa lama ("Belum ada pengguna." dsb), pemakaian PIC tidak berubah.
- Layout header Screening RKA ikut dirapikan: select tahun sebelumnya mengambang di tengah baris (space-between dengan 3 anak); kini judul + subtitle "Program → Kegiatan → Sub Kegiatan · pagu & kode rekening" di kiri, label "Tahun" + select (mis. 2027) + tombol "Inisiasi Perubahan" digabung satu grup di kanan.
- Verifikasi: node --check bersih; 33 uji lulus (draft-rincian/screening/standar-harga/tautan-periode; index.uji.mjs dilewati); npm run build sukses.

## MENU ADMIN STANDAR HARGA

- Satu menu "Standar Harga" di grup Administrasi (adminOnly) → SbuSshAdmin.jsx, dengan pemilih jenis SSH/SBU di dalam halaman (ganti jenis = reset preview + pencarian).
- Lazy load: tahun default null → tanpa request sampai user pilih tahun.
- Penginputan = upload Excel client-side (parseRows) → POST /api/standar-harga/upload (replace-all per tahun+jenis) — sumber data satu: tabel standar_harga (dipakai pencocokan draft rincian Screening RKA).
- Daftar data + search debounce 300ms (maks 500 baris).
