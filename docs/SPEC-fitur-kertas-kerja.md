# Spesifikasi Fitur Kertas Kerja (Output per Sub Kegiatan)

Status: diimplementasikan · Terakhir diperbarui: fase 4 selesai, `npm run build` hijau

---

## 1. Tujuan

Menyediakan halaman **Kertas Kerja** yang memuat rencana output dokumen per
Sub Kegiatan, sehingga setiap OPD bisa melihat berapa dokumen yang sudah
terunggah, kapan tenggatnya, dan mana yang lewat.

Pohon dokumen mengikuti struktur Perkada: **Program → Kegiatan → Sub Kegiatan →
Output (Kertas Kerja) → Periode**.

## 2. Batasan yang disepakati

| Baudangan | Status |
|---|---|
| Folder `/config/workspace/absensi` | **Dilarang disentuh.** Tidak ada perubahan di sana. |
| Schema `"SIMAPO"` | Tidak dipakai. Pohon sendiri memakai tabel `pks_*`. |
| Auth server | Tidak ada. Aplikasi ini tidak punya sesi sama sekali. |
| Role | Hanya `Admin`, `Reviewer`, `Staf` (sudah ada sebelumnya). |

## 3. Peran

| Aksi | Staf | Reviewer | Admin |
|---|---|---|---|
| Lihat pohon Kertas Kerja | ya | ya | ya |
| Unggah dokumen ke periode | ya | ya | ya |
| Tambah / ubah / hapus Output (Kertas Kerja) | — | — | ya |
| Generate periode satu tahun | — | — | ya |
| Sinkronkan periode wajib | — | — | ya |
| Ubah deadline / status periode | — | — | ya |
| CRUD Program / Kegiatan / Sub Kegiatan | — | — | ya |

> Gate di atas hanya di sisi klien (`canManageOutput()` di `src/data.js`).
> Server tidak memverifikasi role apa pun karena tidak punya mekanisme auth.
> Kalau nanti autentikasi ditambahkan, gate ini wajib diperketat di server.

## 4. Model data

Enam tabel baru, dibuat oleh `server/migrations/tahap_2.sql` yang dibaca
otomatis saat server start.

```
pks_tahun (tahun PK)
  └─ pks_program (tahun, kode, nama, urutan)
       └─ pks_kegiatan (program_id, kode, nama, urutan)
            └─ pks_subkegiatan (kegiatan_id, kode, nama, urutan, indikator, target)
                 └─ kertas_kerja (subkegiatan_id, nama, indikator, frekuensi,
                                  target_per_tahun, bulan_wajib, deadline_rule, …)
                      └─ kertas_kerja_periode (kertas_kerja_id, tahun, periode,
                                              periode_label, deadline, is_wajib, doc_id)
```

Catatan desain:

- `doc_id` → `bapperida_dokumen(id) ON DELETE SET NULL`. Menghapus dokumen di
  arsip tidak merusak riwayat periode; periodenya jadi kosong lagi.
- `ON DELETE RESTRICT` di sepanjang rantai program → kegiatan → sub kegiatan →
  kertas kerja, jadi penghapusan harus dari yang paling bawah. Server membalas
  `409` dengan pesan yang menjelaskan.
- `urutan` diisi otomatis oleh server. Pengurutan memakai angka, bukan teks,
  supaya kode `5.10` muncul setelah `5.09`.
- `status` **tidak** disimpan di tabel periode. Status diturunkan dari
  `deadline` + `bapperida_dokumen.status` supaya tidak pernah melenceng dari
  hasil review.

## 5. Aturan inti: Target menentukan jumlah periode

**`target_per_tahun` = jumlah dokumen yang harus ada dalam setahun, dan itu
juga jumlah periodenya.**

| Target | Frekuensi otomatis | Periode | Contoh label |
|---|---|---|---|
| 12 | Bulanan | 12 | Januari 2025 … Desember 2025 |
| 4 | Triwulan | 4 | Triwulan I 2025 … IV 2025 |
| 2 | Semesteran | 2 | Semester I 2025, Semester II 2025 |
| 1 | Tahunan | 1 | Tahun 2025 |
| 5, 6, 7, … | Lainnya | = target | Periode 1 2025 … Periode N 2025 |

Jadi dokumen bertarget 12 berarti ada satu dokumen setiap bulan — bukan satu
dokumen dengan deadline bulanan. Ini yang membuat hitungan progres masuk akal:
`progres = periode wajib yang sudah punya dokumen / total periode wajib`.

Batas atas 24 periode per output. Nilai di luar itu dipotong ke 24.

## 6. Periode wajib

Kolom `bulan_wajib`:

- `*` (default) → semua periode wajib.
- `1,3,5,7,9,11` → hanya nomor periode tersebut yang wajib (1 = Januari/Bulan I).

Nomor periode mengikuti labelnya: Bulanan mulai dari 1 = Januari, Triwulan
1 = TW I. Nilai di luar rentang dibuang diam-diam.

Progres **hanya** menghitung periode wajib, jadi periode opsional tidak
menggeser angka progres.

## 7. Deadline

Aturan disimpan sebagai string di `deadline_rule`, dihitung di server
(`hitungDeadline`) supaya tahun kabis dan panjang bulan ditangani benar.

| Frekuensi | Pilihan |
|---|---|
| Bulanan | tanggal 5 / 10 / 15 / 20 / 25 / hari terakhir bulan berikutnya |
| Triwulan | 5 / 10 hari setelah akhir kuartal |
| Semesteran | 5 / 10 hari setelah akhir semester |
| Tahunan & Lainnya | 31 Desember tahun itu, atau 31 Januari tahun berikutnya |

Contoh terverifikasi: Bulanan `next_month:10` → Januari 2025 ber-deadline
`2025-02-10`, Desember 2025 → `2026-01-10`. `next_month:last` Februari 2024 →
`2024-02-29` (tahun kabis). `next_month:31` di Februari 2024 → diklem ke
`2024-02-29`.

Default: Bulanan `next_month:10`, Triwulan `quarter_end:10`, Semesteran
`semiannual_end:10`, Tahunan `year_end`.

## 8. Status periode

Diturunkan di klien (`statusPeriode()` di `src/data.js`), tidak disimpan.

| Status | Kapan |
|---|---|
| Belum ada | `doc_id` kosong, deadline masih ≥ 4 hari |
| Jatuh tempo | `doc_id` kosong, deadline ≤ 3 hari ke depan |
| Terlambat | `doc_id` kosong, deadline sudah lewat |
| Menunggu review | ada dokumen, statusnya belum `Diarsipkan` |
| Ditolak | ada dokumen, statusnya `Ditolak` |
| Diarsipkan | ada dokumen, statusnya `Diarsipkan` |
| Tidak berlaku | `is_wajib = false` |

## 9. Alur upload

Upload memakai alur GAS → Google Drive yang sudah ada. Tidak ada handling byte
file di server arsip-digital — server hanya menerima metadata dan menyimpan URL.

1. Di baris periode, user klik ikon upload dan memilih satu file.
2. Aplikasi pindah ke halaman Upload dengan judul dan tahun sudah terisi.
3. Setelah GAS menyimpan, dokumen masuk ke `bapperida_dokumen`.
4. Aplikasi `PATCH /api/kertas-kerja/periode/:id` dengan `doc_id` asli dari
   GAS (`result.docId`), lalu invalidate cache pohon.
5. User dikembalikan ke halaman Kertas Kerja.

Catatan: upload multi-file membuat folder Drive dengan id lokal (`Date.now()`),
bukan id baris database, jadi **tidak bisa** ditautkan ke satu periode. Folder
tetap bisa diunggah, hanya tautan periodenya tidak dibuat otomatis.

Dokumen tidak dihapus dari arsip saat periode dilepas — hanya tautannya
dibuang (`doc_id = NULL`).

## 10. Ringkasan

`GET /api/pks/ringkasan/:tahun` mengembalikan jumlah output, sub kegiatan,
periode wajib, yang terisi, yang terlambat, dan yang jatuh tempo ≤ 3 hari.
Catatan implementasi: `COUNT()` di Postgres dikembalikan driver `pg` sebagai
**string**, jadi semua angka dirangkai dengan `Number()` di `Ringkasan()`.

`GET /api/pks/deadline-terdekat` mencantumkan periode wajib yang kosong dan deadline-nya
dalam 14 hari ke depan, untuk badge notifikasi.

## 11. Endpoint

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/pks/tahun` | daftar tahun + tahun Default |
| GET | `/api/pks/tree?tahun=` | pohon lengkap + output + periode (satu request) |
| GET | `/api/pks/ringkasan/:tahun` | angka kelengkapan |
| GET | `/api/pks/deadline-terdekat` | periode kosong ≤ 14 hari |
| GET | `/api/pks/:level` | daftar satu level |
| POST | `/api/pks/:level` | tambah node |
| PUT | `/api/pks/:level/:id` | ubah node |
| DELETE | `/api/pks/:level/:id` | hapus node |
| GET | `/api/kertas-kerja` | daftar output (opsional `?subkegiatan_id=`) |
| POST | `/api/kertas-kerja` | tambah output |
| PUT | `/api/kertas-kerja/:id` | ubah output |
| DELETE | `/api/kertas-kerja/:id` | hapus output + periodenya |
| POST | `/api/kertas-kerja/:id/generate` | buat periode satu tahun (idempoten) |
| POST | `/api/kertas-kerja/:id/sinkron-wajib` | hitung ulang `is_wajib` |
| PATCH | `/api/kertas-kerja/periode/:id` | tautkan / lepas dokumen, ubah deadline |

`generate` memakai `ON CONFLICT (kertas_kerja_id, tahun, periode) DO NOTHING`,
jadi aman dipanggil berulang kali. `sinkron-wajib` hanya menyentuh periode yang
belum terisi dokumen — progres yang sudah ada tidak ditimpa.

## 12. Validasi tanggal dari driver pg

Kolom `DATE` di Postgres dikembalikan `pg` sebagai objek `Date`, bukan string
ISO. Form `<input type="date">` dan perhitungan `sisaHari()` butuh string
`YYYY-MM-DD`. Semua route baru karena itu mem-format tanggal di SQL dengan
`TO_CHAR(deadline, 'YYYY-MM-DD')`, mengikuti konvensi yang sudah dipakai route
dokumen yang ada.

## 13. Yang belum dikerjakan

- `db/seed_rkpd_2025.sql` dan `SEED_REVIEW.md` — menunggu tabel RKPD 2025
  asli. Struktur, indikator, dan nama output resmi tidak boleh dikarang.
- Autentikasi server. Gate role sekarang murni klien.
- Upload multi-file ke satu periode (butuh penyimpanan id baris, bukan id lokal).
- Pengingat deadline via email/WhatsApp. Saat ini baru tampil di dalam aplikasi.
