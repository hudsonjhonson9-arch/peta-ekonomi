# Spec & Rancangan — Fitur Arsip (Item 1–5)

Proyek: ARSIP DIGITAL BAPPERIDA (`peta-ekonomi`)
Cakupan: (1) simpan uploader/deskripsi/tag, (2) catatan review, (3) pencarian isi dokumen, (4) nomor & tanggal dokumen, (5) versi dokumen.

---

## 0. Temuan awal (kondisi kode saat ini)

Hal-hal ini menentukan rancangan dan sebagian harus dibereskan lebih dulu.

| # | Temuan | Dampak |
|---|--------|--------|
| A | `POST /api/docs` hanya menyimpan `judul, kategori, tipe, ukuran, url, bidang, files, pages`. `uploader`, `desc`, `tags` tidak disimpan. `GET /api/docs` mengisi `uploader='—'`, `desc=''`. | Item 1 |
| B | Field **Tahun Dokumen** di form upload dikirim ke GAS tetapi **dibuang server**. `year` di `GET` = tahun `tanggal` (= tanggal upload). | Item 4 |
| C | Frontend membuat `id: Date.now()` lokal; id asli baru dibuat server di dalam GAS dan **tidak dikembalikan**. | Item 3, 5 (butuh `doc_id`) |
| D | `handleApprove/Reject` hanya mengirim `{status}`. Notifikasi ke pengunggah di server butuh `user_id` yang tidak pernah dikirim → **notifikasi tidak pernah terkirim**. Kotak "catatan review" tidak dikirim ke mana pun. `reviewedBy` selalu `'—'`. | Item 2 |
| E | Form Edit: field berlabel "Sektor" memakai key `kategori`, tetapi di DB kolom `kategori` = **Jenis** (`kategori AS type`, `tipe AS sector`). Edit sektor menulis ke kolom jenis, dan sebaliknya. | Bug lama; perbaiki saat menyentuh `PUT /api/docs/:id` (Item 1/4) |
| F | Server tidak punya autentikasi/sesi. Nama & id user dikirim klien dan dipercaya. | Catatan risiko (bagian 7) |
| G | Migrasi skema dilakukan lewat `ALTER TABLE IF NOT EXISTS` di `server/index.js`. Kolom `pages` dan tabel `notifications` dipakai tetapi tidak punya migrasi. | Bagian 1 |

Konvensi penamaan yang dipertahankan: kolom DB tetap bahasa Indonesia (`judul`, `kategori`, `tipe`); API mengalias ke `title`, `type` (=kategori), `sector` (=tipe). **Jangan mengganti nama kolom lama.**

---

## 1. Fondasi bersama (kerjakan pertama)

### 1.1 Migrasi skema
Tambahkan blok migrasi di `server/index.js` (pola sama dengan `bidang`/`files`). Semua idempoten.

```sql
-- Item 1
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS uploader_name TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS uploader_id   TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS deskripsi     TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS tags          TEXT;      -- JSON array string, huruf kecil

-- Item 4
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS nomor_dokumen   TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS tanggal_dokumen DATE;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS tahun           INT;

-- Item 2 (kolom ringkas status terakhir)
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS reviewed_by  TEXT;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ;
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS review_note  TEXT;

-- Item 5
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS versi INT NOT NULL DEFAULT 1;

-- Migrasi tertunda (temuan G)
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS pages INT DEFAULT 0;
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
  type TEXT DEFAULT 'info', doc_id INT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
);
```
> Cek dulu tipe `id` di `bapperida_dokumen` dan `user_list.id` (di kode `user_list.id` berupa string 10 digit → `TEXT`). Sesuaikan tipe `doc_id` di tabel baru dengan tipe `bapperida_dokumen.id`.

Tabel baru (dijelaskan di item masing-masing): `doc_history` (Item 2), `doc_content` (Item 3), `doc_versions` (Item 5).

### 1.2 GAS mengembalikan `docId`
Di `Code.gs`, aksi `finalize`, `direct`, dan `registerFolder` sudah memanggil `POST /api/docs`, tetapi hasilnya dibuang. Ubah supaya:
- membaca `apiData = JSON.parse(apiRes.getContentText())`,
- menyertakan `docId: apiData.doc && apiData.doc.id` pada respons.

Frontend memakai `docId` sebagai `id` dokumen (menggantikan `Date.now()`), sehingga langkah lanjutan (unggah teks, versi) memakai id asli.
Untuk `group: true` (file dalam folder), `POST /api/docs` tidak dipanggil per file, jadi `docId` hanya dikembalikan oleh `registerFolder`.

### 1.3 Payload upload diperluas
Frontend → GAS (`direct`, `finalize`, `registerFolder`) menambah field:
`desc, tags, uploaderId, nomorDokumen, tanggalDokumen, tahun`.
GAS meneruskan apa adanya ke `POST /api/docs` (nama field API: `desc, tags, uploader_id, nomor_dokumen, tanggal_dokumen, tahun`).

### 1.4 Urutan pengerjaan yang disarankan
`1.1 migrasi` → `1.2 docId` → **Item 1 + 4** (satu PR, menyentuh form & POST yang sama) → **Item 2** → **Item 5** → **Item 3** (butuh `docId` dan paling besar).

---

## 2. Item 1 — Simpan uploader, deskripsi, tag

### Tujuan
Data yang sudah diisi di form upload tampil di daftar/detail dan bisa dicari.

### Model data
Kolom di `bapperida_dokumen`: `uploader_name`, `uploader_id`, `deskripsi`, `tags` (string JSON, mis. `["rpjmd","2025"]`, disimpan huruf kecil & di-trim).

### API
- `POST /api/docs`: menerima `uploader`, `uploader_id`, `desc`, `tags` (array atau string koma) → simpan. Normalisasi tag: split koma, trim, lowercase, hilangkan duplikat, maks. 10 tag × 30 karakter.
- `GET /api/docs`: kembalikan `uploader = COALESCE(uploader_name,'—')`, `desc = COALESCE(deskripsi,'')`, `tags = parsed array` (fallback lama: `[type]`).
- `PUT /api/docs/:id`: izinkan ubah `desc` dan `tags` (selain field yang sudah ada). **Perbaiki temuan E**: pemetaan `kategori`↔`type` dan `tipe`↔`sector` harus konsisten antara form edit dan SQL (ganti key form edit menjadi `type`/`sector`, server memetakan ke kolom `kategori`/`tipe`).

### Backfill data lama (sekali jalan, aman diulang)
```sql
UPDATE bapperida_dokumen d
SET uploader_name = a.user_name
FROM (
  SELECT DISTINCT ON (doc_title) doc_title, user_name
  FROM audit_logs WHERE action = 'Upload dokumen' ORDER BY doc_title, id ASC
) a
WHERE d.uploader_name IS NULL AND d.judul = a.doc_title;
```
Dokumen yang tidak cocok tetap `NULL` → tampil "—".

### Frontend
- `handleUpload`: kirim `desc`, `tags`, `uploaderId: user.id` ke GAS; pakai `docId` dari respons.
- `DocDetail`: deskripsi, tag, "Diunggah oleh" sudah dirender; kini terisi. Tambah field `desc` & `tags` di modal Edit.
- Pencarian (`Pencarian`, `DocList`): sudah memeriksa `tags`/`desc`/`uploader`; setelah data terisi otomatis berfungsi.
- Multi-file (banyak file per form): tiap file satu dokumen dengan judul `"{judul} — {namaFile}"`; `desc`/`tags` disalin ke tiap dokumen.

### Kriteria selesai
- Upload dengan deskripsi+tag → detail menampilkan keduanya setelah refresh.
- "Diunggah oleh" menampilkan nama pengunggah, bukan "—" (untuk dokumen baru dan sebagian besar dokumen lama).
- Mengedit sektor tidak lagi mengubah jenis dokumen.

---

## 3. Item 4 — Nomor dokumen & tanggal dokumen

### Tujuan
Membedakan **tanggal upload** dari **tanggal terbit dokumen**, dan menyimpan nomor surat/SK.

### Model data
- `nomor_dokumen TEXT` (opsional), `tanggal_dokumen DATE` (opsional), `tahun INT`.
- `tanggal` (NOW saat upload) **tidak diubah** dan tetap berarti "tanggal upload".
- Aturan `tahun`: jika `tanggal_dokumen` diisi → `tahun = EXTRACT(YEAR)`; jika tidak → nilai dropdown "Tahun Dokumen" dari form; jika kosong → tahun upload.
- Kolom bantu pencarian nomor: indeks fungsional pada `lower(regexp_replace(nomor_dokumen,'[^a-z0-9]','','gi'))` supaya "800/12/BAPPERIDA/2025" ketemu dengan input "800 12 bapperida 2025".

### API
- `POST /api/docs`: terima `nomor_dokumen`, `tanggal_dokumen`, `tahun`. Validasi tanggal (`YYYY-MM-DD`, tidak lebih dari 1 tahun ke depan).
- `GET /api/docs`: tambah `nomorDokumen`, `tanggalDokumen` (`YYYY-MM-DD`), dan ubah `year` menjadi `COALESCE(tahun, EXTRACT(YEAR FROM tanggal_dokumen), EXTRACT(YEAR FROM tanggal))::text`.
- `GET /api/docs/check-nomor?nomor=...&exclude=ID`: kembalikan dokumen yang sudah memakai nomor tersebut. Dipakai untuk **peringatan lunak** (bukan unique constraint, karena satu nomor boleh dipakai beberapa lampiran).
- `PUT /api/docs/:id`: izinkan ubah ketiga field.

### Frontend
- **UploadForm**: tambah input "Nomor Dokumen" dan "Tanggal Dokumen" (`<input type="date">`). Bila tanggal diisi, dropdown Tahun mengikuti dan dikunci. Saat blur di kolom nomor, panggil `check-nomor`; jika ada duplikat tampilkan peringatan kuning "Nomor ini sudah dipakai oleh: …" (tidak memblokir).
- **DocList**: baris meta menampilkan nomor bila ada; opsi urut baru "Tanggal dokumen (terbaru)". Filter Tahun memakai `year` baru (tahun dokumen).
- **DocDetail**: metadata "Nomor Dokumen", "Tanggal Dokumen"; "Tanggal Upload" tetap.
- **Pencarian**: cocokkan `nomorDokumen` (dinormalisasi).
- **Modal Edit**: tiga field baru.

### Kriteria selesai
- Dokumen dengan `tanggal_dokumen` 2023 yang diupload 2026 muncul saat filter tahun 2023.
- Pencarian nomor tanpa tanda baca menemukan dokumen.
- Nomor duplikat memunculkan peringatan tetapi tetap bisa disimpan.

---

## 4. Item 2 — Catatan review & riwayat status

### Tujuan
Reviewer menulis alasan saat menyetujui/menolak; pengunggah menerima notifikasi berisi alasan; linimasa status berasal dari data nyata.

### Model data
Tabel baru `doc_history`:
```sql
CREATE TABLE IF NOT EXISTS doc_history (
  id          SERIAL PRIMARY KEY,
  doc_id      INT  NOT NULL,           -- samakan tipe dengan bapperida_dokumen.id
  action      TEXT NOT NULL,           -- 'upload' | 'approve' | 'reject' | 'resubmit' | 'version'
  from_status TEXT,
  to_status   TEXT,
  actor_id    TEXT,
  actor_name  TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS doc_history_doc_idx ON doc_history (doc_id, created_at);
```
Kolom ringkas di dokumen (`reviewed_by`, `reviewed_at`, `review_note`) menyimpan hasil review terakhir supaya daftar tidak perlu join.

Baris `upload` di `doc_history` dibuat otomatis oleh `POST /api/docs`. Untuk dokumen lama tanpa riwayat: backfill satu baris `upload` dari `created_at` + `uploader_name`.

### Aturan transisi status (divalidasi server)
| Dari | Ke | Siapa | Catatan |
|------|----|-------|---------|
| Menunggu Review / Menunggu Persetujuan | Diarsipkan | Reviewer, Admin | catatan opsional |
| Menunggu Review / Menunggu Persetujuan | Ditolak | Reviewer, Admin | **catatan wajib** (min. 5 karakter) |
| Ditolak | Menunggu Review | Pengunggah, Admin (`resubmit`) | catatan opsional |
| Diarsipkan | (tidak berubah) | — | perubahan lewat versi baru (Item 5) |

Peran diperiksa di server dengan mencari `user_credentials.role` milik `actor_id` (bukan dari body). Ini belum autentikasi sungguhan (lihat bagian 7), tetapi mencegah salah klik lintas peran.

### API
- `PATCH /api/docs/:id/status` body: `{ status, note, actor_id, actor_name }`. Dalam satu transaksi: validasi transisi → update `status`, `reviewed_*`, `review_note` → insert `doc_history` → buat notifikasi.
  - Notifikasi ke **`bapperida_dokumen.uploader_id`** (dari DB, bukan dari klien). Isi: `"{judul}" ditolak: {note}` / `disetujui`.
- `GET /api/docs/:id/history` → daftar riwayat urut naik.
- `GET /api/docs` menambahkan `reviewedBy` (dari `reviewed_by`, fallback `'—'`) dan `reviewNote`.

### Frontend
- `handleApprove(doc, note)` / `handleReject(doc, note)` mengirim catatan, `actor_id`, `actor_name`.
- `DocDetail`: tombol **Tolak** menampilkan galat inline bila catatan kosong; setelah reject/approve, catatan dikosongkan.
- **Linimasa "Riwayat Status"** dibangun dari `GET /api/docs/:id/history` (aksi, nama, tanggal, catatan) menggantikan `steps` yang diturunkan dari `reviewedBy`.
- Banner di `DocDetail` untuk dokumen `Ditolak`: tampilkan `reviewNote` dan tombol **Ajukan Ulang** (untuk pengunggah/Admin).
- Notifikasi (`NotificationDropdown`) klik → membuka dokumen (sudah ada `doc_id`).

### Kriteria selesai
- Menolak tanpa catatan ditolak (UI dan server).
- Pengunggah menerima notifikasi berisi alasan penolakan.
- Riwayat menampilkan urutan: Diunggah → Ditolak (alasan) → Diajukan ulang → Diarsipkan, lengkap dengan nama dan waktu.

---

## 5. Item 5 — Versi dokumen

### Tujuan
Revisi dokumen tidak menimpa yang lama; semua versi bisa dilihat dan dipulihkan.

### Keputusan desain
- **Baris `bapperida_dokumen` selalu = versi aktif.** Daftar, pencarian, dan portal publik tidak berubah bentuk.
- Versi lama disimpan di `doc_versions`. Kolom `versi` di dokumen = nomor versi aktif.
- Versi baru **mereset status ke "Menunggu Review"** dan **`publik = false`** sampai disetujui lagi (mencegah revisi yang belum direview tampil ke publik).
- **Tahap 1 hanya untuk dokumen satu file.** Dokumen folder (banyak file) menampilkan tombol nonaktif dengan keterangan; ditangani di tahap lanjutan.
- "Pulihkan versi" = membuat versi **baru** yang menyalin file versi lama (riwayat tetap linear, tidak ada rewind).

### Model data
```sql
CREATE TABLE IF NOT EXISTS doc_versions (
  id           SERIAL PRIMARY KEY,
  doc_id       INT  NOT NULL,
  version_no   INT  NOT NULL,
  url          TEXT NOT NULL,
  ukuran       TEXT,
  pages        INT DEFAULT 0,
  uploader_id  TEXT,
  uploader_name TEXT,
  note         TEXT,                    -- catatan revisi
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doc_id, version_no)
);
```
Versi aktif tidak duplikat di tabel ini sampai digantikan: saat versi baru masuk, **snapshot file aktif dimasukkan ke `doc_versions`**, lalu baris dokumen diperbarui. Untuk dokumen yang belum pernah punya versi, snapshot itu menjadi v1.

### API
- `POST /api/docs/:id/versions` body: `{ url, ukuran, pages, note, uploader, uploader_id }`. Transaksi: snapshot file aktif → `doc_versions` → update `url/ukuran/pages`, `versi = versi+1`, `status='Menunggu Review'`, `publik=false` → `doc_history(action='version')` → notifikasi ke Admin/Reviewer → audit log "Versi baru dokumen".
- `GET /api/docs/:id/versions` → daftar `[{version_no, url, ukuran, pages, uploader_name, note, created_at, active}]`, versi aktif di urutan pertama (diambil dari baris dokumen).
- `POST /api/docs/:id/versions/:no/restore` → sama seperti membuat versi baru dengan `url/ukuran/pages` milik versi `no`, `note = "Pemulihan dari v{no}"`.
- `DELETE /api/docs/:id` mengembalikan **semua** URL (aktif + `doc_versions`) supaya frontend menghapus semua file di Drive; hapus baris `doc_versions` & `doc_history` terkait.

### Alur upload versi
1. Frontend memakai jalur unggah yang sama dengan upload biasa (direct ≤ 30 MB / resumable > 30 MB). **Refaktor**: pisahkan bagian "kirim file ke Drive" dari `handleUpload` menjadi fungsi `uploadFileToDrive(file, {folderId}) → {fileUrl, fileId, size, pages}` agar dipakai ulang.
2. Untuk versi, panggil GAS dengan `group: true` (sudah ada: melewati `POST /api/docs`), sehingga GAS hanya membuat file di Drive.
3. Frontend lalu memanggil `POST /api/docs/:id/versions` dengan hasil unggah.
4. Bila item 3 aktif: ekstrak & kirim teks untuk versi baru (lihat item 3).

### Frontend
- `DocDetail`: tombol **Unggah Versi Baru** (Admin & pengunggah; nonaktif untuk dokumen folder) → modal: pilih file + catatan revisi + progress bar.
- Panel **Riwayat Versi** di sisi kanan: "v3 — aktif", "v2", "v1" dengan tanggal, pengunggah, catatan, tautan **Buka**, dan **Pulihkan** (Admin).
- Badge "v{n}" di kartu dokumen bila `versi > 1`.
- `handleDelete`: loop semua URL versi ke `deleteFile` GAS (sekarang hanya `doc.url`).

### Kriteria selesai
- Upload versi baru → dokumen kembali "Menunggu Review", tidak lagi publik, versi lama tetap bisa dibuka.
- Pulihkan v1 membuat v(n+1) berisi file v1.
- Hapus dokumen membersihkan semua file versi di Drive.

---

## 6. Item 3 — Pencarian isi dokumen (full-text)

### Tujuan
Mencari kata di dalam isi PDF (dan tahap lanjutan: Word/Excel), dengan cuplikan dan nomor halaman.

### Model data
```sql
CREATE TABLE IF NOT EXISTS doc_content (
  id         BIGSERIAL PRIMARY KEY,
  doc_id     INT NOT NULL,
  version_no INT NOT NULL DEFAULT 1,
  page_no    INT NOT NULL,
  content    TEXT NOT NULL,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  UNIQUE (doc_id, version_no, page_no)
);
CREATE INDEX IF NOT EXISTS doc_content_tsv_idx ON doc_content USING GIN (tsv);
ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS index_status TEXT;  -- NULL | 'ok' | 'needs_ocr' | 'unsupported'
```
- Konfigurasi `'simple'` dipilih karena selalu tersedia. Bila `SELECT cfgname FROM pg_ts_config` di database Anda memuat `indonesian`, konfigurasi itu boleh dipakai (stemming Bahasa Indonesia).
- Satu baris per halaman → hasil bisa menunjuk halaman dan `ts_headline` bekerja pada teks per halaman.
- Hanya versi aktif yang dicari (`version_no = bapperida_dokumen.versi`).

### Ekstraksi (sisi klien, tahap 1: PDF)
Aplikasi sudah memuat pdfjs untuk menghitung halaman (`countPdfPages`). Perluas menjadi `extractPdfText(file) → [{page, text}]`:
- Ambil `getTextContent()` per halaman, gabungkan `item.str`.
- **Deteksi PDF scan:** bila rata-rata < 20 karakter/halaman → `index_status='needs_ocr'`, tidak menyimpan teks.
- Batas: dokumen > 500 halaman → indeks 500 halaman pertama dan tandai.
- Jalankan **setelah** unggah sukses (tidak menghambat progress unggah), lalu kirim per batch 40 halaman ke server; tampilkan status kecil "Mengindeks isi dokumen… n/N".

### API
- `POST /api/docs/:id/content` body `{ version_no, pages: [{page, text}], status }` → `INSERT ... ON CONFLICT (doc_id,version_no,page_no) DO UPDATE`; set `index_status`. Batas body 50 MB sudah cukup (dipecah per batch).
- `GET /api/search?q=&type=&sector=&bidang=&year=&status=&limit=20&offset=0`:
  - `websearch_to_tsquery('simple', q)` terhadap `doc_content.tsv` **UNION** kecocokan metadata (`judul`, `nomor_dokumen` ternormalisasi, `deskripsi`, `tags`) dengan `ILIKE`.
  - Skor: `ts_rank_cd` isi + bobot tambahan untuk kecocokan judul/nomor.
  - Respons per dokumen: `{ doc, score, hits: [{page, snippet}] }` maks. 3 hit; `snippet` dari `ts_headline('simple', content, query, 'MaxFragments=1,MaxWords=30,MinWords=12,StartSel=<mark>,StopSel=</mark>')`.
  - **Sanitasi**: snippet hanya boleh berisi tag `<mark>`; escape HTML sisanya di server sebelum `ts_headline`, atau render di klien dengan pemisah aman (jangan `dangerouslySetInnerHTML` tanpa filter).
- `GET /api/docs/:id/index-status` (opsional) untuk badge di detail.

### Frontend
- Halaman **Pencarian**: ganti filter klien dengan panggilan `GET /api/search` (debounce 300 ms, batalkan permintaan lama). Hasil menampilkan judul, metadata, dan hingga 3 cuplikan dengan chip "hlm N".
- Toggle "Cari sampai isi dokumen" (aktif secara default) supaya pengguna bisa membatasi ke metadata saja.
- `DocList` tetap memakai pencarian metadata klien (cepat); tambahkan tautan "Cari di isi dokumen" yang berpindah ke halaman Pencarian dengan `q` terisi.
- `DocDetail`: badge status indeks — "Terindeks", "PDF hasil pindai (belum bisa dicari)", "Belum diindeks", dengan tombol **Indeks ulang** untuk Admin.

### Dokumen lama (backfill) — tahap 2
Browser tidak bisa mengunduh file Drive langsung (CORS). Rancangan:
- Tambah aksi GAS `getFile` yang mengembalikan base64 file Drive (batas ≈ 30 MB, sama dengan mode direct).
- Halaman Admin "Indeks Ulang": memproses dokumen `index_status IS NULL` satu per satu (unduh via GAS → ekstrak di browser → kirim ke server), dengan progres dan tombol jeda. File > 30 MB dilewati dan ditandai.

### Tahap lanjutan
- **Word/Excel:** `mammoth` (docx) dan SheetJS (xlsx) di klien; halaman = 1 (atau per sheet).
- **OCR** untuk `needs_ocr`: `tesseract.js` dengan data bahasa `ind` di klien (berat) atau layanan terpisah; jalankan hanya atas permintaan Admin.

### Kriteria selesai
- Kata yang hanya ada di halaman ke-12 sebuah PDF ditemukan, dengan cuplikan dan "hlm 12".
- PDF hasil pindai ditandai "belum bisa dicari" dan tidak membuat error.
- Upload versi baru menggantikan indeks; versi lama tidak muncul di hasil.

---

## 7. Ringkasan API & file yang terdampak

### Endpoint baru / berubah
| Endpoint | Item | Perubahan |
|----------|------|-----------|
| `POST /api/docs` | 1, 4 | + `desc, tags, uploader_id, nomor_dokumen, tanggal_dokumen, tahun`; buat baris `doc_history` |
| `GET /api/docs` | 1, 2, 4, 5 | + `uploader, desc, tags, nomorDokumen, tanggalDokumen, year(baru), reviewedBy, reviewNote, versi` |
| `PUT /api/docs/:id` | 1, 4 | + `desc, tags, nomor, tanggal, tahun`; perbaiki pemetaan sektor/jenis |
| `GET /api/docs/check-nomor` | 4 | baru |
| `PATCH /api/docs/:id/status` | 2 | + `note, actor_*`, validasi transisi, riwayat, notifikasi ke pengunggah |
| `GET /api/docs/:id/history` | 2 | baru |
| `POST/GET /api/docs/:id/versions`, `POST …/:no/restore` | 5 | baru |
| `DELETE /api/docs/:id` | 5 | kembalikan semua URL versi |
| `POST /api/docs/:id/content`, `GET /api/search` | 3 | baru |

### File yang disentuh
`server/index.js` (migrasi + endpoint), `google-apps-script/Code.gs` (`docId`, payload, `getFile` tahap 2), `src/App.jsx` (`handleUpload`, `handleApprove/Reject`, `handleDelete`, `handleEdit`), `src/components/UploadForm.jsx` (nomor/tanggal), `src/components/DocPages.jsx` (meta, riwayat, versi, edit), `src/components/Pages.jsx` (`Pencarian`), `src/hooks.js` (hook data baru), `src/components/NotificationDropdown.jsx` (navigasi ke dokumen, bila belum).

---

## 8. Risiko & pertanyaan terbuka

1. **Tidak ada autentikasi server** (temuan F). Seluruh peran dan nama dipercaya dari klien; pemeriksaan peran di Item 2 hanya pengaman ringan. Untuk data resmi, pertimbangkan JWT/sesi sebelum membuka aplikasi ke publik.
2. **Ukuran data indeks.** Teks 300 halaman ≈ 0,5–1 MB per dokumen; 1.000 dokumen ≈ 1 GB termasuk indeks GIN. Periksa kuota database (Supabase) sebelum backfill massal.
3. **Kualitas ekstraksi PDF**: PDF dengan font tanpa Unicode map menghasilkan teks rusak; indikatornya rasio karakter non-alfanumerik tinggi → tandai `needs_ocr`.
4. **`id` dokumen** dari GAS: bila panggilan ke `/api/docs` gagal di dalam GAS (`muteHttpExceptions`), file sudah ada di Drive tetapi tidak ada baris DB. Tambahkan pemeriksaan `apiRes.getResponseCode()` dan kembalikan galat agar frontend tidak menampilkan "berhasil".
5. **Dokumen folder (multi-file)** belum mendukung versi dan indeks isi di tahap 1.

Pertanyaan untuk Anda:
- Apakah versi baru **wajib** kembali ke "Menunggu Review" dan tidak publik (asumsi spec ini), atau ada kasus revisi kecil yang boleh langsung aktif?
- Apakah reviewer boleh menyetujui dokumen yang ia unggah sendiri?
- Batas maksimum halaman/ukuran file yang diindeks (spec ini: 500 halaman)?
- Apakah PostgreSQL Anda punya konfigurasi teks `indonesian` (`SELECT cfgname FROM pg_ts_config;`)?

---

## 9. Rencana tahapan

| Tahap | Isi | Perkiraan |
|-------|-----|-----------|
| 0 | Migrasi (1.1) + `docId` dari GAS (1.2) + pemeriksaan galat GAS | 0,5 hari |
| 1 | Item 1 + Item 4 (form, API, backfill uploader, perbaikan pemetaan edit) | 1–1,5 hari |
| 2 | Item 2 (riwayat, catatan, notifikasi, ajukan ulang) | 1–1,5 hari |
| 3 | Item 5 (refaktor unggah, versi, riwayat versi, hapus semua versi) | 1,5–2 hari |
| 4 | Item 3 tahap 1 (ekstraksi PDF, `doc_content`, `/api/search`, UI Pencarian) | 2 hari |
| 5 | Item 3 tahap 2 (backfill via GAS `getFile`, Word/Excel) | 1–1,5 hari |
| 6 | Item 3 OCR (opsional) | terpisah |

Uji manual per tahap: unggah kecil (< 30 MB), unggah besar (> 30 MB, resumable), unggah multi-file, tampilan mobile & dark mode, hapus dokumen (cek file di Drive terhapus).
