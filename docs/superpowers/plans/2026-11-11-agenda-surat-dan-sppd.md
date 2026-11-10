# Agenda Surat & Register SPPD Digital Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengimplementasikan modul Buku Agenda Surat (Masuk & Keluar) dan Register SPPD (Dalam & Luar Daerah) di backend `peta-ekonomi` dan mengintegrasikannya ke menu Arsip aplikasi `absensi_refactored_v6` serta aplikasi penuh `peta-ekonomi`, kemudian mem-push seluruh hasil kerja ke GitHub.

**Architecture:** 
1. Database PostgreSQL di `peta-ekonomi` menyimpan 4 tabel baru (`agenda_surat_masuk`, `agenda_disposisi`, `agenda_surat_keluar`, `agenda_sppd`) via migrasi `tahap_26.sql`.
2. REST API di `peta-ekonomi/server/agenda-routes.js` menyediakan endpoint atomik CRUD, auto-booking nomor surat, lembar disposisi, dan kalkulasi SPPD.
3. Proxy di `absensi_refactored_v6/server/arsip.js` meneruskan request `/api/arsip/p/api/agenda/*` menggunakan sesi NIP SSO.
4. UI Native Absensi di `absensi_refactored_v6` menambahkan tile "Agenda Persuratan" dan "Register SPPD" pada `#panel-arsip`.
5. Komponen React di `peta-ekonomi/src/components/agenda/` menyajikan antarmuka lengkap di web portal Arsip Digital.

**Tech Stack:** Node.js, Express, PostgreSQL, Vanilla JS/CSS (Absensi), React, Vite (Peta Ekonomi).

**Spec:** [`d:\Code\peta-ekonomi\docs\SPEC-agenda-surat-dan-sppd.md`](file:///d:/Code/peta-ekonomi/docs/SPEC-agenda-surat-dan-sppd.md)

---

## Global Constraints
- Target repositories: `d:\Code\peta-ekonomi` dan `d:\Code\absensi_refactored_v6`.
- Absensi mirroring rule: semua perubahan pada `js/`, `css/`, `index.html`, `service-worker.js` WAJIB disinkronkan ke direktori `www/`.
- Styling rule: Anti-Slop (20 Golden Rules), `tabular-nums` untuk nomor surat, tanggal, dan nominal Rupiah, WCAG AA contrast.
- Zero breakages: seluruh 691 test di `absensi_refactored_v6` dan build `vite` di kedua repo harus tetap pass 100%.

---

## Tasks

### Task 1: Database Migration `tahap_26.sql` di `peta-ekonomi`
- [ ] Buat file `server/migrations/tahap_26.sql` dengan 4 tabel: `agenda_surat_masuk`, `agenda_disposisi`, `agenda_surat_keluar`, dan `agenda_sppd` sesuai spec.
- [ ] Daftarkan migrasi di `server/index.js` dengan `.then(() => jalankanMigration('tahap_26', ['agenda_surat_masuk', 'agenda_disposisi', 'agenda_surat_keluar', 'agenda_sppd']))`.
- [ ] Buat unit test database runner atau verifikasi SQL syntax.

### Task 2: Backend API Routes `server/agenda-routes.js` di `peta-ekonomi`
- [ ] Buat modul `server/agenda-routes.js` yang mengimplementasikan:
  - Surat Masuk: GET list (search & filter), POST buat surat masuk, PUT edit, DELETE, POST disposisi.
  - Surat Keluar: GET list, GET preview-nomor, POST booking nomor atomik (`FOR UPDATE` di pks_tahun atau nomor urut), PUT update, DELETE.
  - SPPD: GET list, POST buat penugasan, PUT update, POST LHP, POST SPJ.
- [ ] Terapkan aturan kebijakan hak akses di `server/agenda-routes.js` (`tambahAturan(...)`).
- [ ] Daftarkan di `server/index.js` dengan `daftarkanRuteAgenda(app, pool, queryDB)`.
- [ ] Buat unit test `server/agenda-routes.uji.mjs` untuk menguji generator nomor surat, format penomoran, dan validasi input.

### Task 3: Konfigurasi Proxy di `absensi_refactored_v6`
- [ ] Buka `server/arsip.js` dan pastikan prefix `/api/agenda` masuk dalam jalur proxy yang diteruskan ke `PETA_API_URL`.
- [ ] Buat / sesuaikan automated test di `tests/` untuk memastikan proxy `/api/arsip/p/api/agenda/*` dapat dipanggil dengan token SSO yang valid.

### Task 4: UI Native Menu Arsip di `absensi_refactored_v6`
- [ ] Tambahkan 2 tile baru di `index.html` dan `www/index.html` pada `#arsipHome`:
  - `agenda`: "Agenda Persuratan" (icon `fa-envelope-open-text`)
  - `sppd`: "Register SPPD" (icon `fa-plane-departure` / `fa-car-side`)
- [ ] Tambahkan markup kontainer `#arsipAgenda` dan `#arsipSppd` beserta sub-tab navigation di `index.html` dan `www/index.html`.
- [ ] Buat `js/arsip-agenda.js` dan `js/arsip-sppd.js` (dan copy ke `www/js/`) untuk fetching data dan rendering tabel responsif dengan empty state, loading skeleton, dan tabular-nums.
- [ ] Hubungkan router back navigation di `js/arsip-ui.js` dan `js/arsip.js`.

### Task 5: Antarmuka Portal di `peta-ekonomi`
- [ ] Tambahkan halaman/komponen React `src/components/agenda/AgendaSuratPage.jsx` dan `src/components/agenda/AgendaSppdPage.jsx`.
- [ ] Daftarkan rute di `src/App.jsx` atau navigasi sidebar utama.
- [ ] Pastikan `npm run build` sukses tanpa error.

### Task 6: Verifikasi Penuh, Git Commit, dan Push
- [ ] Jalankan `npm test` dan `npm run build` di `absensi_refactored_v6`.
- [ ] Jalankan `npm run build` di `peta-ekonomi`.
- [ ] Commit dan push semua perubahan di `absensi_refactored_v6` ke GitHub `origin/main`.
- [ ] Commit dan push semua perubahan di `peta-ekonomi` ke GitHub `origin/main`.
