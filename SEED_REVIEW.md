# Review Seed RKPD 2025

Berkas seed: `db/seed_rkpd_2025.sql`
Sumber data: tabel RKPD 2025 yang dikirim pengguna.
Status: **siap diimpor, tetapi 3 kata perlu konfirmasi dan 14 sub kegiatan perlu keputusan target.**

---

## 1. Isi seed

| Level | Jumlah |
|---|---|
| Program | 4 |
| Kegiatan | 13 |
| Sub Kegiatan | 36 |
| Output (baris `kertas_kerja`) | 90 |
| Periode (jika semua di-generate) | 426 |

Kolom keuangan (Anggaran / Realisasi / Selisih / Capaian) **tidak** di-seed, sesuai
keputusan bahwa arsip digital tidak menyimpan angka keuangan.

`kertas_kerja_periode` sengaja **kosong**. Periode baru dibuat Admin lewat tombol
*Generate Periode* pada halaman Kertas Kerja, supaya angka 426 periode bisa
diperiksa per output sebelum ditautkan ke dokumen.

---

## 2. Keputusan yang dipakai pada seed

**Target menentukan jumlah periode.** `target_per_tahun` = jumlah periode =
jumlah dokumen yang harus dilaporkan. Frekuensi hanya menentukan nama periode
dan aturan deadline.

| Target | Frekuensi | `deadline_rule` |
|---|---|---|
| 12 | Bulanan | `next_month:10` |
| 4 | Triwulan | `quarter_end:10` |
| 2 | Semesteran | `semiannual_end:10` |
| 1 | Tahunan | `year_end` |
| selain itu | Lainnya | `year_end` |

Distribusi turunan untuk 36 sub kegiatan:
Tahunan 25, Lainnya 5, Bulanan 3, Semesteran 2, Triwulan 1.

`bulan_wajib = '*'` untuk semua output, jadi seluruh periode wajib diisi.

### Catatan penting soal header tabel sumber

Pada tabel aslinya, kolom berlabel **Output** berisi **jumlah** (mis. `12 Laporan`),
sedangkan kolom berlabel **Target** berisi **rincian nama dokumen/barang**.
Dua header itu tertukar posisi. Seed membaca menurut makna sebenarnya: angka =
`target` (untuk `pks_subkegiatan.target` dan `kertas_kerja.target_per_tahun`),
daftar = nama output (`kertas_kerja.nama`).

---

## 3. Normalisasi yang dilakukan pada teks

Tiga perbaikan ejaan yang jelas salah ketik dan tidak mengubah makna:

| Kode | Semula | Jadi |
|---|---|---|
| `5.05.02.2.04.01` | `1 Dokuman` | `1 Dokumen` |
| `5.01.01.2.08.02` | `Laporan Internet Bandwith 50 Mbps` | `... Bandwidth ...` |
| `5.01.01.2.07.0005` | `Meja Ping Pong 91 unit)` | `Meja Ping Pong (1 unit)` |

`5,05` dinormalkan menjadi `5.05`. Kode bertingkat tidak dikarang: celah kode
seperti `.03` pada `5.01.01.2.09.01`/`.02` **dibiarkan** apa adanya.

---

## 4. Perlu konfirmasi Anda (3 kata)

Kata-kata ini tidak bisa diperbaiki tanpa menebak, jadi teksnya dipakai apa adanya.
Tolong perjelas makna aslinya:

| Kode | Output | Kemungkinan bacaan |
|---|---|---|
| `5.01.01.2.06.0009` | `Laporan Rakor sedaratan Sumba (Sumba Timur, SBD, ST)` | `sedaratan` ? |
| `5.01.03.2.01.08` | `Laporan Kegiatan Taman Pawodda` | `Pawodda` — nama ENTITY / nama tempat? |
| `5.01.03.2.02.02`, `5.01.03.2.02.03` | `Laporan DAK Bikor Ekonomi`, `Evaluasi RPJMD Bikor Ekonomi` | `Bikor` — istilah daerah? |

---

## 5. Perlu keputusan Anda: satuan bukan dokumen

Aturan "1 periode = 1 dokumen" tidak berlaku kalau target-nya barang/jumlah.
Delapan sub kegiatan berikut **tidak boleh** di-generate 1 periode per dokumen:

| Kode | Target | Jumlah rincian | Catatan |
|---|---|---|---|
| `5.01.01.2.02.0001` | 34 Orang/ Bulan | 1 | Bukan dokumen |
| `5.01.01.2.06.01` | 1 Paket | 1 | Barang |
| `5.01.01.2.06.02` | 1 Paket | 5 | Barang |
| `5.01.01.2.06.05` | 1 Paket | 5 | Barang |
| `5.01.01.2.07.0005` | 2 Unit | 3 | Barang (kursi/meja) |
| `5.01.01.2.09.01` | 9 Unit | 1 | Barang |
| `5.01.01.2.09.09` | 1 Unit | 1 | Bangunan |
| `5.01.02.2.01.06` | 30 Usulan | 1 | Bukan dokumen |

Untuk yang ini, `target_per_tahun` sebaiknya diubah Admin menjadi `1` (satu
periode = satu dokumen rekap), bukan 34/30/9/2.

---

## 6. Selisih antara angka target dan jumlah rincian

### 6a. Angka resmi lebih besar dari jumlah rincian (6 sub kegiatan)

| Kode | Target | Rincian | Selisih | Catatan |
|---|---|---|---|---|
| `5.01.01.2.01.006` | 12 Laporan | 10 | 2 | 10 output × 12 = 120 periode |
| `5.01.01.2.01.007` | 12 Laporan | 5 | 7 | 5 output × 12 = 60 periode |
| `5.01.01.2.02.0007` | 12 Laporan | 3 | 9 | 3 output × 12 = 36 periode |
| `5.01.01.2.06.0009` | 20 Laporan | 3 | 17 | 3 output × 20 = 60 periode |
| `5.01.02.2.01.01` | 3 Dokumen | 1 | 2 | Rinciannya sudah berisi "2 Dokumen" |
| `5.01.02.2.01.07` | 4 Dokumen | 1 | 3 | Rinciannya sudah berisi "2 dokumen" |

Karena `target` = jumlah periode, `5.01.01.2.01.006` jadi 120 periode. Six sub
kegiatan ini paling perlu diperiksa lebih dulu.

### 6b. Jumlah rincian lebih besar dari angka target (17 sub kegiatan)

| Kode | Target | Rincian | Selisih |
|---|---|---|---|
| `5.01.01.2.06.02` | 1 Paket | 5 | 4 |
| `5.01.01.2.06.05` | 1 Paket | 5 | 4 |
| `5.01.01.2.06.10` | 1 Dokumen | 4 | 3 |
| `5.01.01.2.07.0005` | 2 Unit | 3 | 1 |
| `5.01.01.2.08.02` | 1 Laporan | 2 | 1 |
| `5.01.01.2.08.04` | 1 Laporan | 2 | 1 |
| `5.01.02.2.03.03` | 2 Laporan | 3 | 1 |
| `5.01.03.2.01.02` | 1 Laporan | 2 | 1 |
| `5.01.03.2.01.06` | 1 Laporan | 2 | 1 |
| `5.01.03.2.01.07` | 1 Laporan | 3 | 2 |
| `5.01.03.2.01.08` | 1 Laporan | 3 | 2 |
| `5.01.03.2.02.02` | 1 Laporan | 3 | 2 |
| `5.01.03.2.02.03` | 1 Laporan | 4 | 3 |
| `5.01.03.2.03.02` | 1 Laporan | 3 | 2 |
| `5.01.03.2.03.03` | 1 Laporan | 3 | 2 |
| `5.01.03.2.03.04` | 1 Laporan | 4 | 3 |
| `5.01.03.2.03.0006` | 1 Laporan | 3 | 2 |

Pola `1 Laporan` dengan beberapa rincian muncul konsisten di program 5.01.03
(Bidang Koordinasi). Kemungkinan besar: `1 Laporan` berarti satu laporan
rekap yang memuat seluruh rincian, bukan satu dokumen per rincian. Kalau begitu
`target_per_tahun` untuk baris-baris ini sebaiknya `1` — dan itu memang sudah
nilai seed sekarang, sehingga hanya menghasilkan 1 periode. Tidak ada langkah
lanjutan yang perlu diambil, cukup dicatat agar tidak dianggap selisih error.

---

## 6c. Konflik antara frekuensi di nama output dan target

Nama output kadang memuat frekuensi sendiri yang bertentangan dengan target
sub kegiatan. Karena `target` yang menentukan jumlah periode, nama itu ikut
berubah. Tidak ada yang saya ubah otomatis — perlu keputusan Anda:

| Kode | Nama output | Target sub | Frekuensi hasil rule | Catatan |
|---|---|---|---|---|
| `5.01.01.2.01.007` | `Laporan Evaluasi Kinerja 4 TW` | 12 Laporan | Bulanan (12) | "4 TW" = 4 Triwulan, jadi bentrok dengan 12 periode bulanan |
| `5.01.01.2.02.0007` | `Laporan Keuangan Bulanan/Triwulan/Semesteran dan Tahunan` | 12 Laporan | Bulanan (12) | Satu nama mencakup 4 frekuensi sekaligus |
| `5.01.01.2.01.006` | `DPA Murni`, `DPA Perubahan`, `RKT` | 12 Laporan | Bulanan (12) | Nama dokumen tahunan, tetapi 12 periode bulanan |

Kalau yang dimaksud sebenarnya 4 Triwulan, `target_per_tahun` untuk
`5.01.01.2.01.007` sebaiknya diubah menjadi `4`.

---

## 7. Sub kegiatan dengan jumlah periode besar

Kalau semua di-generate, enam sub kegiatan ini menyumbang 340 dari 426 periode:

| Kode | Periode |
|---|---|
| `5.01.01.2.01.006` | 120 |
| `5.01.01.2.01.007` | 60 |
| `5.01.01.2.06.0009` | 60 |
| `5.01.01.2.02.0007` | 36 |
| `5.01.01.2.02.0001` | 34 |
| `5.01.02.2.01.06` | 30 |

---

## 8. Verifikasi yang sudah dijalankan

`node db/validate-seed.cjs` memeriksa seed secara statis tanpa server database
(tidak ada PostgreSQL di lingkungan ini). Semua lulus:

- kurung dan kutip string seimbang;
- jumlah tupel: 4 program / 13 kegiatan / 36 sub kegiatan / 90 output;
- jumlah kolom tiap tupel sesuai daftar kolom INSERT;
- kode unik di tiap level, dan kode anak mengikuti awalan kode induk;
- tidak ada output yang menunjuk sub kegiatan yang tidak ada;
- setiap program/kegiatan/sub kegiatan punya minimal satu anak;
- indikator dan target terisi, dan target selalu diawali angka;
- `frekuensi` dan `deadline_rule` bernilai yang dikenal server;
- `target_per_tahun` positif; `bulan_wajib` ditulis literal `'*'`.

Yang **belum** bisa dipastikan tanpa PostgreSQL: eksekusi SQL, constraint FK, dan
`UNIQUE (subkegiatan_id, nama)`.

## 9. Urutan langkah setelah review

1. Jalankan `psql -f server/migrations/tahap_2.sql` lalu `psql -f db/seed_rkpd_2025.sql`.
2. Buka halaman **Admin → Struktur Kertas Kerja**, periksa 90 output.
3. Perbaiki `target_per_tahun` untuk sub kegiatan satuan non-dokumen (§5) dan
   yang perlu ditinjau (§6a).
4. Klik **Generate Periode** per output. Hindari langsung *Generate Semua* untuk
   output bervolume besar di §7 sampai target-nya disetujui.
