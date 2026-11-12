# Multi-Photo SPT/SPPD 2026, Document Preview & Pengaturan Wewenang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelaraskan sistem SPT & SPPD di `peta-ekonomi` dengan standar format 2026 dari aplikasi absen (`absensi_refactored_v6`), menambahkan Live Interactive Document Preview (SPT & SPPD per personil), serta menyediakan panel Pengaturan Wewenang (Penandatangan Definitif/Plt/Plh, Sekretaris, PPTK, KTU, dan 3 Paraf Hierarki) terintegrasi ke database.

**Architecture:**
- **Templates & Generator:** Menggunakan template Word resmi 2026 (`spt_template.docx` & `sppd_template.docx`) yang sudah menyertakan XML prolog (`0bfeb39`) dan tag dinamis (`{#dasarRows}`, `{#pelaksana}`, `KepadaLabel`, `TitikLabel`, `PPTKJabatan`, `Paraf1..3`). Generator `sppdDocxGenerator.js` memproduksi DOCX satuan, PDF, serta paket ZIP lengkap.
- **Interactive Preview:** Modal visual di `AgendaSppdPage.jsx` merender layout surat fisik A4 (Kop Garuda / BAPPERIDA Sumba Barat, tabel dasar & pelaksana, tanda tangan & paraf) dengan tab penampil SPT vs SPPD per personil, disertai tombol aksi cetak langsung, unduh DOCX, PDF, dan ZIP.
- **Pengaturan Wewenang:** Tabel database `agenda_pengaturan_wewenang` dengan REST API (`GET/POST /api/agenda/wewenang`), modal form pengaturan terintegrasi pemilih master pegawai di frontend, serta pendaftaran modul ke `METADATA_PERMISSIONS`.

**Tech Stack:** React 18, Vite, Express, PostgreSQL (`pg`), Docxtemplater, PizZip, JSZip/PizZip (untuk bundel ZIP).

**Spec:** Persyaratan dari user pada tangkapan layar sesi (`/config/workspace/arsip-digital pull lalu sistem sppd dan tugas dibuat sperti di absen bisa? dan tambahkan pengaturan wewenang agenda dan sppd`) serta referensi implementasi dari `D:\Code\absensi_refactored_v6`.

## Global Constraints

- Template DOCX wajib menyertakan XML prolog (`<?xml ...?><w:document ...><w:body>`) agar dapat dibuka di Microsoft Word tanpa error.
- Multi-pelaksana pada SPT wajib format baris-1 dengan `KepadaLabel: 'Kepada'` & `TitikLabel: ':'`, sedangkan baris ke-2 dst label kosong agar tidak terjadi pengulangan label di baris tabel.
- 3 paraf hierarki jabatan wajib terisi (Paraf 1: Sekretaris, Paraf 2: Kabid Terkait, Paraf 3: Kasubbag/KTU).
- Menjaga backward-compatibility pada data SPPD yang sudah ada (kolom `penandatangan` & `paraf` JSONB opsional, mewarisi default wewenang jika null).
- Desain antarmuka UI wajib mematuhi 20 Anti-Slop Golden UI/UX Rules (clean typography, no arbitrary badges, tabular-nums untuk nomor & tanggal).

---

### Task 1: Sinkronisasi Template 2026 & Pembaruan Generator SPT/SPPD

**Files:**
- Copy: `D:\Code\absensi_refactored_v6\public\spt_template.docx` → `public/templates/spt_template.docx`
- Copy: `D:\Code\absensi_refactored_v6\public\sppd_template.docx` → `public/templates/sppd_template.docx`
- Modify: `src/utils/sppdDocxGenerator.js`
- Test: `tests/sppd-generator.test.mjs`

- [ ] **Step 1: Salin template 2026 terverifikasi** dari `absensi_refactored_v6` ke `peta-ekonomi/public/templates/` dan pastikan file lengkap (size ~76KB & ~78KB).
- [ ] **Step 2: Tulis unit test gagal** `tests/sppd-generator.test.mjs` untuk menguji:
  - Ekstraksi tag template memuat `dasarRows`, `pelaksana`, `PPTKJabatan`, `Paraf1`, `Paraf2`, `Paraf3`.
  - Fungsi `bangunTagsSPT` menghasilkan array `dasarRows` dari string multi-baris dan `pelaksana` dengan `KepadaLabel` baris pertama saja.
  - Fungsi `bangunTagsSPPD` memetakan jabatan PPTK dan 3 paraf.
- [ ] **Step 3: Update `sppdDocxGenerator.js`**:
  - Implementasikan `splitDasar(s)` untuk memecah teks dasar menjadi `{ No, Teks }`.
  - Format pelaksana multi-personil dengan `KepadaLabel`, `TitikLabel`, `No`, `Nama`, `PangkatGol`, `NIP`, `Jabatan`.
  - Integrasikan generator paket ZIP (`unduhBundleSppdZip(it)`) yang merender 1 file `SPT_<nomor>.docx` + `SPPD_<nama>.docx` untuk setiap personil yang ditugaskan.
- [ ] **Step 4: Jalankan test** `node --test tests/sppd-generator.test.mjs` dan pastikan PASS.
- [ ] **Step 5: Commit:** `feat(sppd): sinkronkan template 2026 absen dan generator multi-personil zip`

---

### Task 2: Backend API & Database Pengaturan Wewenang

**Files:**
- Modify: `server/agenda-routes.js`
- Modify: `server/satudata-routes.js`
- Test: `tests/agenda-wewenang-api.test.mjs`

- [ ] **Step 1: Tulis test API** `tests/agenda-wewenang-api.test.mjs` untuk memeriksa endpoint `GET /api/agenda/wewenang` dan `POST /api/agenda/wewenang`.
- [ ] **Step 2: Tambahkan migrasi DDL idempoten** di `server/agenda-routes.js`:
  ```sql
  CREATE TABLE IF NOT EXISTS agenda_pengaturan_wewenang (
    id SERIAL PRIMARY KEY,
    key VARCHAR(64) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] **Step 3: Buat route `GET /api/agenda/wewenang` & `POST /api/agenda/wewenang`**:
  - Mengembalikan data default penandatangan (Kepala, Sekretaris, PPTK, KTU) dan paraf hierarki.
  - Menerima payload update wewenang dan menyimpannya secara idempoten (upsert `ON CONFLICT (key) DO UPDATE`).
- [ ] **Step 4: Daftarkan modul `agenda_sppd`** ke `METADATA_PERMISSIONS` di `server/satudata-routes.js` agar hak akses wewenang tercatat dalam sistem peran.
- [ ] **Step 5: Jalankan test API** dan verifikasi respons JSON valid.
- [ ] **Step 6: Commit:** `feat(agenda): tambahkan api dan tabel pengaturan wewenang penandatangan sppd`

---

### Task 3: Modal & Antarmuka Pengaturan Wewenang di Frontend

**Files:**
- Create: `src/components/agenda/ModalPengaturanWewenang.jsx`
- Modify: `src/components/agenda/AgendaSppdPage.jsx`
- Modify: `src/components/agenda/AgendaSuratPage.jsx`

- [ ] **Step 1: Buat komponen `ModalPengaturanWewenang.jsx`**:
  - Bagian Penandatangan Utama: Status (Definitif / Plt. / Plh.), Nama Kepala Badan, NIP, Pangkat/Golongan, Jabatan.
  - Dropdown pemilih cepat dari daftar master pegawai (`pegawaiList`) untuk auto-fill nama, NIP, dan pangkat.
  - Bagian Pejabat Terkait: Sekretaris Badan, PPTK / Kabid, KTU.
  - Bagian 3 Paraf Hierarki Jabatan (Paraf 1, 2, 3).
  - Validasi input & tombol simpan yang memanggil `POST /api/agenda/wewenang`.
- [ ] **Step 2: Pasang tombol "Pengaturan Wewenang"** di header `AgendaSppdPage.jsx` dan `AgendaSuratPage.jsx`.
- [ ] **Step 3: Hubungkan data wewenang** ke state halaman sehingga pembuatan SPT/SPPD baru otomatis menggunakan data pejabat yang dikonfigurasi.
- [ ] **Step 4: Verifikasi interaksi modal** dan penyimpanan state.
- [ ] **Step 5: Commit:** `feat(agenda): tambahkan modal dan form antarmuka pengaturan wewenang`

---

### Task 4: Live Interactive Document Preview & Cetak Bundle

**Files:**
- Create: `src/components/agenda/ModalPratinjauDokumen.jsx`
- Modify: `src/components/agenda/AgendaSppdPage.jsx`
- Modify: `src/utils/sppdDocxGenerator.js` (tambahkan generator HTML preview bersih)

- [ ] **Step 1: Buat generator layout HTML dokumen resmi** di `sppdDocxGenerator.js`:
  - `bangunHtmlSPT(it, wewenang)`: Kop Surat Resmi, Garis Ganda, Nomor SPT, Dasar Hukum berbutir, Tabel Pelaksana dengan `Kepada :` rapi, Ditetapkan di & Tanggal, TTD Kepala Badan & Tabel 3 Paraf Hierarki.
  - `bangunHtmlSPPD(it, person, wewenang)`: Lembar SPPD resmi 9 butir ketentuan, Ditetapkan di & Tanggal, TTD Pejabat yang Berwenang Memerintahkan, Blok Pengesahan PPTK, dan 3 Paraf Hierarki.
- [ ] **Step 2: Buat komponen `ModalPratinjauDokumen.jsx`**:
  - Tab Switcher: "Surat Perintah Tugas (SPT)" vs "Surat Perjalanan Dinas (SPPD)".
  - Selector Personil jika terdapat multi-pelaksana (mengubah tampilan preview SPPD per orang).
  - Tampilan visual lembar kertas A4 (`box-shadow`, padding standar surat dinas).
  - Toolbar aksi:
    - Cetak Langsung (buka print dialog browser)
    - Unduh DOCX (dokumen aktif)
    - Unduh PDF (dokumen aktif)
    - Unduh ZIP Lengkap (bundle 1 SPT + seluruh SPPD pelaksana)
- [ ] **Step 3: Hubungkan tombol "Pratinjau & Cetak"** pada baris tabel & kartu entri SPPD di `AgendaSppdPage.jsx`.
- [ ] **Step 4: Uji fungsionalitas preview**:
  - Ganti tab SPT ke SPPD.
  - Ganti personil pada multi-pelaksana.
  - Uji unduh DOCX, PDF, dan ZIP.
- [ ] **Step 5: Commit:** `feat(sppd): tambahkan modal live interactive preview surat tugas dan sppd`

---

### Task 5: Verifikasi Menyeluruh & Build Produksi

**Files:**
- Modify: `package.json` (tambahkan script `test` jika diperlukan)
- All affected files

- [ ] **Step 1: Jalankan seluruh test unit** di `tests/`.
- [ ] **Step 2: Jalankan build Vite produksi**: `npm run build` di `D:\Code\peta-ekonomi` dan pastikan 0 error.
- [ ] **Step 3: Audit UI Anti-Slop**:
  - Pastikan tidak ada tombol atau badge berlebih.
  - Angka, NIP, tanggal menggunakan `tabular-nums` atau `font-mono`.
  - Contrast dan radius sudut konsisten dengan tema SandalWoods / Peta Ekonomi.
- [ ] **Step 4: Commit akhir & laporan ke user**: `chore: finalisasi sistem sppd tugas wewenang dan preview`
