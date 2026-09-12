# ARSIP DIGITAL BAPPERIDA — Panduan Pengguna

**Pusat Dokumen Digital Perencanaan Bidang Ekonomi**
BAPPERIDA Kabupaten Sumba Barat

---

## Daftar Isi

1. [Login](#1-login)
2. [Dashboard](#2-dashboard)
3. [Dokumen](#3-dokumen)
4. [Detail & Persetujuan Dokumen](#4-detail--persetujuan-dokumen)
5. [Upload Dokumen](#5-upload-dokumen)
6. [Pencarian](#6-pencarian)
7. [Portal Publik](#7-portal-publik)
8. [Manajemen Pengguna (Admin)](#8-manajemen-pengguna-admin)
9. [Manajemen Kategori Dokumen (Admin)](#9-manajemen-kategori-dokumen-admin)
10. [Audit Trail (Admin)](#10-audit-trail-admin)

---

## 1. Login

Buka aplikasi, masukkan **NIP** dan **Password**.

- **NIP** adalah nomor induk pegawai masing-masing.
- **Password default:** `admin123`
- Klik salah satu nama akun di halaman login untuk mengisi NIP secara otomatis.

Login berhasil → masuk ke halaman **Dashboard**.

### Role Pengguna

| Role | Hak Akses |
|------|-----------|
| **Admin** | Semua fitur, termasuk manajemen pengguna, kategori, dan audit trail |
| **Reviewer** | Dashboard, Dokumen (termasuk approve/tolak), Upload, Pencarian, Portal Publik |
| **Staf** | Dashboard, Dokumen (view only), Upload, Pencarian, Portal Publik |

---

## 2. Dashboard

Halaman utama setelah login. Menampilkan:

- **Total Dokumen** — jumlah seluruh dokumen di repositori
- **Dokumen Perlu Review** — dokumen yang menunggu persetujuan (untuk Reviewer/Admin)
- **Dokumen Diarsipkan** — dokumen yang sudah final
- **Grafik Batang** — distribusi dokumen per jenis dan per sektor ekonomi
- **Dokumen Terbaru** — 5 dokumen terakhir yang diupload

---

## 3. Dokumen

Halaman daftar semua dokumen dengan filter:

1. **Filter Jenis** — RPJMD, Renstra, Renja, RKA, Kajian Ekonomi, dll.
2. **Filter Sektor** — Pertanian & Pangan, Pariwisata, UMKM, Infrastruktur, dll.
3. **Filter Tahun** — pilih tahun dokumen
4. **Filter Status** — Menunggu Review, Menunggu Persetujuan, Diarsipkan, Ditolak

Setiap baris dokumen menampilkan: judul, jenis, sektor, tahun, status, uploader.

Klik **"Detail"** pada dokumen untuk membuka halaman detail.

---

## 4. Detail & Persetujuan Dokumen

Halaman detail menampilkan informasi lengkap dokumen:

- Judul, Jenis, Sektor, Tahun, Ukuran file
- Uploader dan tanggal upload
- Status dokumen (dengan warna indikator)
- Icon/file preview

### Alur Persetujuan

```
Staf Upload → Menunggu Review → Di Review Kabid → Menunggu Persetujuan → Kepala Setujui → Diarsipkan
                                                                          ↘ Ditolak
```

### Aksi berdasarkan Role

| Status | Staf | Reviewer | Admin |
|--------|------|----------|-------|
| Menunggu Review | — | **Setuju / Tolak** | Setuju / Tolak |
| Menunggu Persetujuan | — | — | **Setuju / Tolak** |
| Diarsipkan | — | — | — |
| Ditolak | Upload ulang | — | — |

Tombol aksi muncul di halaman detail jika user memiliki hak untuk melakukan tindakan.

---

## 5. Upload Dokumen

1. Klik menu **Upload** di sidebar
2. Isi formulir:
   - **Judul Dokumen** — nama dokumen (wajib)
   - **Jenis Dokumen** — pilih dari daftar (wajib)
   - **Sektor Ekonomi** — pilih sektor terkait (wajib)
   - **File PDF** — pilih file dari komputer (wajib)
3. Klik **Upload**

Proses upload:
1. File dikirim ke **Google Drive** melalui Google Apps Script
2. Metadata (judul, jenis, sektor, url) disimpan ke **PostgreSQL**
3. Status awal: **Menunggu Review**
4. Aktivitas dicatat ke **Audit Trail**

> File maksimum mengikuti ketentuan Google Drive. Progress bar akan muncul selama proses upload.

---

## 6. Pencarian

Fitur pencarian teks bebas di seluruh judul dokumen.

- Ketik kata kunci → hasil muncul secara real-time
- Hasil menampilkan judul, jenis, sektor, tahun, dan status
- Klik hasil untuk lihat detail

---

## 7. Portal Publik

Halaman khusus untuk menampilkan dokumen yang telah **Diarsipkan** dan ditandai publik.

- Dapat diakses tanpa login
- Tampilan lebih sederhana (tanpa sidebar, tanpa aksi admin)
- Berguna untuk transparansi publik

---

## 8. Manajemen Pengguna (Admin)

Hanya **Admin** yang dapat mengakses halaman ini.

Fitur:
- **Tambah Pengguna** — isi NIP, nama, unit, role (Admin/Reviewer/Staf), password
- **Edit Pengguna** — ubah data dan role
- **Hapus Pengguna** — hapus pengguna dari sistem

> Role menentukan menu dan tombol apa yang muncul untuk pengguna tersebut.

---

## 9. Manajemen Kategori Dokumen (Admin)

Hanya **Admin** yang dapat mengelola kategori/jenis dokumen.

Kategori default: RPJMD, Renstra, Renja, RKA, Kajian Ekonomi, Laporan Evaluasi, Data Statistik, Notulen Rapat, dan lainnya.

Fitur:
- **Tambah Kategori** — nama kategori baru
- **Edit Kategori** — ubah nama kategori
- **Hapus Kategori** — hapus kategori (pastikan tidak ada dokumen yang menggunakannya)

---

## 10. Audit Trail (Admin)

Mencatat semua aktivitas pengguna di sistem.

Setiap entry menampilkan:
- **User** — siapa yang melakukan aksi
- **Aksi** — Upload, Approve, Tolak, Unduh, Review
- **Dokumen** — judul dokumen terkait
- **Waktu** — tanggal dan jam

Audit trail diurutkan dari yang terbaru. Cocok untuk keperluan monitoring dan akuntabilitas.

---

## Tips & Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Lupa password | Hubungi Admin untuk reset |
| Upload gagal | Periksa koneksi internet, pastikan file tidak rusak |
| Dokumen tidak muncul | Cek filter (mungkin kena filter jenis/sektor/tahun) |
| Tidak bisa approve | Pastikan role Anda adalah Reviewer atau Admin |
| Halaman kosong | Refresh browser atau logout lalu login ulang |
