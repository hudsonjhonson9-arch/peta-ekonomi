import { useState, useContext, useMemo, useEffect } from "react";
import { Icon, Select } from "./ui.jsx";
import useResponsive from "../useResponsive.js";
import { ThemeContext } from "../App.jsx";
import { isOpdBapperidaFrontend } from "../data.js";

// ── Pilihan Pratinjau Wewenang (Custom Dropdown untuk Admin) ──────────────
const ROLE_PREVIEW_OPTIONS = [
  { value: "Semua", label: "Semua Modul (Administrator)" },
  { value: "Reviewer", label: "Reviewer / Kabid (BAPPERIDA)" },
  { value: "Staf", label: "Staf Perencana (BAPPERIDA)" },
  { value: "Walidata", label: "Walidata Daerah" },
  { value: "Produsen Data", label: "Produsen Data (OPD Luar)" },
];

// ── Tab Kategori Utama (ui-ux-pro-max: Clean Segmented Control) ───────────
const ALL_TABS = [
  { id: "arsip", title: "Arsip Digital", icon: "archive", bapperidaOnly: true },
  { id: "satudata", title: "Satu Data", icon: "chart" },
  { id: "umum", title: "Umum & Akun", icon: "users" },
];

// ── Daftar Seksi Panduan Lengkap dengan Pembatasan Wewenang Peran ────────
const SECTIONS = [
  // ── 1. Arsip Digital & Perencanaan (Khusus Internal BAPPERIDA) ──────────
  { id: "dashboard", title: "Dashboard Arsip", icon: "home", tab: "arsip", bapperidaOnly: true },
  { id: "dokumen", title: "Pustaka Dokumen", icon: "archive", tab: "arsip", bapperidaOnly: true },
  { id: "detail", title: "Detail & Persetujuan", icon: "eye", tab: "arsip", bapperidaOnly: true },
  { id: "upload", title: "Upload Dokumen", icon: "upload", tab: "arsip", bapperidaOnly: true },
  { id: "kertas_kerja", title: "Kertas Kerja & Cascading", icon: "layers", tab: "arsip", bapperidaOnly: true },
  { id: "screening", title: "Screening RKA & SSH", icon: "filter", tab: "arsip", bapperidaOnly: true },
  { id: "kategori", title: "Kategori Dokumen", icon: "tag", tab: "arsip", bapperidaOnly: true, adminOnly: true },
  { id: "sektor", title: "Sektor Pembangunan", icon: "layers", tab: "arsip", bapperidaOnly: true, adminOnly: true },
  { id: "audit", title: "Audit Trail", icon: "history", tab: "arsip", bapperidaOnly: true, adminOnly: true },

  // ── 2. Satu Data Indonesia ──────────────────────────────────────────────
  { id: "satudata_dashboard", title: "Dashboard Satu Data", icon: "chart", tab: "satudata" },
  { id: "satudata_dataset", title: "Dataset Sektoral", icon: "database", tab: "satudata" },
  { id: "satudata_kinerja", title: "Indikator Kinerja", icon: "layers", tab: "satudata" },
  { id: "satudata_verifikasi", title: "Verifikasi Dataset (Verval)", icon: "checkCircle", tab: "satudata", walidataOnly: true },
  { id: "spm", title: "Capaian SPM", icon: "shield", tab: "satudata" },
  { id: "master_satudata", title: "Master Satu Data", icon: "building", tab: "satudata", adminOnly: true },
  { id: "kelola_konten", title: "Kelola Konten & Publikasi", icon: "file", tab: "satudata", adminOnly: true },
  { id: "monitoring", title: "Monitoring & SDPDN", icon: "server", tab: "satudata", adminOnly: true },
  { id: "publik", title: "Portal Publik Satu Data", icon: "world", tab: "satudata" },

  // ── 3. Umum & Akun ──────────────────────────────────────────────────────
  { id: "login", title: "Login & Autentikasi", icon: "users", tab: "umum" },
  { id: "pencarian", title: "Pencarian Dokumen", icon: "search", tab: "umum", bapperidaOnly: true },
  { id: "pengguna", title: "Manajemen Pengguna", icon: "users", tab: "umum", adminOnly: true },
  { id: "trouble", title: "Troubleshooting", icon: "x", tab: "umum" },
];

// ── Konten Panduan Lengkap dengan Screenshot Riil ─────────────────────────
const CONTENT = {
  // ── 1. ARSIP DIGITAL ────────────────────────────────────────────────────
  dashboard: {
    title: "Dashboard Arsip Digital",
    desc: "Halaman utama setelah login untuk modul kearsipan dan perencanaan internal BAPPERIDA Kabupaten Sumba Barat.",
    steps: [
      "4 kartu statistik utama: Total Dokumen, Diarsipkan (Final), Menunggu Review, dan Ditolak.",
      "Grafik batang distribusi dokumen berdasarkan Jenis Dokumen (kiri) dan per Sektor (kanan).",
      "Daftar 5 dokumen terbaru yang diunggah — klik <b>Lihat semua</b> untuk menuju pustaka lengkap.",
      "Notifikasi bel di sudut kanan atas menandai dokumen yang memerlukan telaah atau persetujuan Anda."
    ],
    note: "Khusus Reviewer dan Admin, dokumen yang butuh tindak lanjut akan ditandai dengan badge peringatan status.",
    screenshot: "/screenshots/dashboard.png"
  },
  dokumen: {
    title: "Pustaka Dokumen & Filter",
    desc: "Halaman katalog seluruh berkas dokumen perencanaan daerah dengan filter terpadu.",
    steps: [
      "Gunakan filter <b>Jenis</b> untuk menyaring berdasarkan tipe dokumen (RPJMD, Renstra, Renja, RKA, DPA, LAKIP, dll).",
      "Gunakan filter <b>Sektor</b> untuk menyaring berdasarkan sektor pembangunan (Pertanian, Pariwisata, Infrastruktur, dll).",
      "Gunakan filter <b>Tahun</b> untuk memilih tahun anggaran dokumen (2020 s/d 2027).",
      "Gunakan filter <b>Status</b> untuk menyaring berkas (Menunggu Review, Menunggu Persetujuan, Diarsipkan, Ditolak).",
      "Klik tombol <b>Buka / Detail</b> pada baris dokumen untuk memeriksa berkas dan metadata lengkap."
    ],
    table: {
      header: ["Informasi", "Keterangan"],
      rows: [
        ["Judul", "Nama resmi dokumen perencanaan"],
        ["Jenis", "RPJMD, Renstra, Renja, RKA, DPA, LAKIP, Kajian Ekonomi"],
        ["Sektor", "Pertanian & Pangan, Pariwisata, UMKM, Infrastruktur, dll"],
        ["Status", "Diarsipkan (Hijau), Menunggu Review (Oranye), Ditolak (Merah)"],
        ["Uploader", "Nama staf dan bidang kerja yang mengunggah"],
      ]
    },
    note: "Klik Detail untuk melihat pratinjau universal dan melakukan aksi verifikasi jika Anda memiliki wewenang.",
    screenshot: "/screenshots/dokumen.png"
  },
  detail: {
    title: "Detail & Persetujuan Dokumen",
    desc: "Halaman detail menampilkan isi dokumen secara visual, kelengkapan metadata, dan tombol aksi persetujuan berjenjang.",
    steps: [
      "<b>Pratinjau Universal</b>: Pratinjau langsung isi berkas PDF di dalam peramban tanpa perlu mengunduh berkas.",
      "Informasi metadata dokumen: judul, jenis, sektor, bidang, tahun, nomor registrasi, tanggal, dan ukuran file.",
      "Riwayat Versi (Versioning): mencatat setiap pembaruan berkas (v1, v2, v3) sehingga dokumen lama tetap terlacak.",
      "Riwayat Status: mencatat jejak persetujuan bertingkat dari pengunggahan hingga pengarsipan resmi."
    ],
    table: {
      header: ["Status Dokumen", "Staf Perencana", "Reviewer / Kabid", "Admin / Kepala"],
      rows: [
        ["Menunggu Review", "—", "Setujui / Tolak", "Setujui / Tolak"],
        ["Menunggu Persetujuan", "—", "—", "Setujui Final / Tolak"],
        ["Diarsipkan", "Unduh / Bagikan", "Unduh / Bagikan", "Kelola Versi"],
        ["Ditolak", "Unggah Revisi", "Beri Catatan", "Beri Catatan"],
      ]
    },
    note: "Tombol aksi Setuju dan Tolak hanya akan aktif bagi akun dengan hak akses Reviewer atau Administrator.",
    screenshot: "/screenshots/detail.png"
  },
  upload: {
    title: "Upload Dokumen",
    desc: "Unggah berkas dokumen perencanaan baru ke repositori digital BAPPERIDA Sumba Barat.",
    steps: [
      "Klik menu <b>Upload Dokumen</b> di bilah navigasi atau tombol <b>+</b> pada Pustaka Dokumen.",
      "Isi <b>Judul Dokumen</b> secara lengkap (wajib).",
      "Pilih <b>Jenis Dokumen</b>, <b>Sektor</b>, dan <b>Bidang BAPPERIDA</b> pengampu (wajib).",
      "Pilih <b>Tahun Dokumen</b>, nomor registrasi surat, dan tanggal dokumen.",
      "Pilih metode unggah: <b>File Komputer</b> (PDF, DOCX, XLSX, JPG, PNG) atau <b>Link Google Drive</b>.",
      "Klik tombol <b>Upload & Kirim untuk Review</b> — sistem akan memvalidasi berkas dan mencatat status awal Menunggu Review."
    ],
    note: "Berkas disimpan dengan aman ke Google Drive melalui Google Apps Script resmi BAPPERIDA, dengan validasi format berkas otomatis.",
    screenshot: "/screenshots/upload.png"
  },
  kertas_kerja: {
    title: "Kertas Kerja & Pohon Cascading",
    desc: "Modul penelaahan keterkaitan antara Tujuan, Sasaran, Program, Kegiatan, hingga Subkegiatan perencanaan pembangunan.",
    steps: [
      "Akses menu <b>Kertas Kerja</b> di bilah navigasi Arsip Digital.",
      "<b>Matriks Kertas Kerja</b>: Periksa keselarasan indikator kinerja kuantitatif, satuan, target, dan pagu indikatif belanja.",
      "<b>Pohon Cascading</b>: Visualisasi pohon hierarki dari Sasaran Strategis Daerah → Program Prioritas → Kegiatan Operasional.",
      "Tandai status hasil telaah: <i>Sesuai</i>, <i>Perlu Penyesuaian</i>, atau <i>Belum Selaras</i>."
    ],
    note: "Kertas kerja memastikan setiap alokasi anggaran APBD memiliki cantolan indikator capaian kinerja yang terukur.",
    screenshot: "/screenshots/kertas_kerja.png"
  },
  screening: {
    title: "Screening RKA & Standar Harga (SSH/SBU)",
    desc: "Modul penelaahan kepatuhan rincian belanja RKA OPD terhadap master standar harga satuan daerah Kabupaten Sumba Barat.",
    steps: [
      "Akses menu <b>Screening RKA</b> di bilah navigasi Arsip Digital.",
      "Unggah berkas RKA hasil ekspor SIPD dalam format file Excel atau CSV.",
      "Sistem memadankan uraian rekening belanja dengan master data <b>SSH, SBU, ASB, dan HSPK</b> daerah secara otomatis.",
      "Periksa tabel temuan selisih harga untuk mengetahui komponen biaya yang melebihi batas standar atau belum terdaftar.",
      "Gunakan hasil analisis sebagai dasar penyusunan Berita Acara Asistensi RKA sebelum pengesahan DPA."
    ],
    note: "Master standar harga diperbarui berkala oleh Admin mengacu pada Peraturan Bupati Sumba Barat terbaru.",
    screenshot: "/screenshots/screening.png"
  },
  kategori: {
    title: "Manajemen Kategori Dokumen (Admin)",
    desc: "Pengelolaan jenis/kategori dokumen perencanaan pembangunan yang berlaku di sistem.",
    steps: [
      "Akses menu <b>Jenis Dokumen</b> di bilah navigasi Arsip Digital (khusus Administrator).",
      "Klik tombol <b>Tambah Kategori</b> untuk menambahkan jenis berkas baru.",
      "Gunakan tombol edit (pensil) untuk memperbarui nama kategori dokumen.",
      "Gunakan tombol hapus untuk menghapus kategori yang tidak lagi digunakan."
    ],
    note: "Kategori baku: RPJMD, Renstra, Renja, RKA, DPA, LAKIP, Kajian Ekonomi, Laporan Evaluasi, Data Statistik, Notulen Rapat.",
    screenshot: "/screenshots/kategori.png"
  },
  sektor: {
    title: "Manajemen Sektor Pembangunan (Admin)",
    desc: "Pengelolaan klasifikasi sektor ekonomi dan urusan pembangunan daerah Kabupaten Sumba Barat.",
    steps: [
      "Akses menu <b>Sektor</b> di bilah navigasi Arsip Digital (khusus Administrator).",
      "Menampilkan seluruh sektor pembangunan yang menjadi acuan pengelompokan dokumen dan statistik.",
      "Klik <b>Tambah Sektor</b> untuk mendaftarkan sektor pembangunan baru.",
      "Perbarui nama sektor atau hapus sektor yang sudah tidak aktif."
    ],
    note: "Sektor yang didaftarkan di sini akan menjadi opsi filter pada Pustaka Dokumen dan visualisasi Dashboard Arsip.",
    screenshot: "/screenshots/sektor.png"
  },
  audit: {
    title: "Audit Trail & Rekam Jejak (Admin)",
    desc: "Pencatatan riwayat seluruh aktivitas pengguna secara otomatis untuk monitoring dan akuntabilitas kearsipan.",
    steps: [
      "Akses menu <b>Audit Trail</b> di bilah navigasi Arsip Digital (khusus Administrator).",
      "Setiap rekaman menampilkan: <b>User & NIP</b>, <b>Aksi</b> (Upload, Review, Setuju, Tolak, Unduh), <b>Dokumen Terkait</b>, dan <b>Waktu (Timestamp)</b>.",
      "Gunakan bilah pencarian untuk menyaring audit berdasarkan nama pegawai atau judul berkas tertentu."
    ],
    note: "Audit trail diurutkan dari yang paling baru dan bersifat permanen (tidak dapat diubah) guna menjaga integritas tata kelola digital.",
    screenshot: "/screenshots/audit.png"
  },

  // ── 2. SATU DATA INDONESIA ──────────────────────────────────────────────
  satudata_dashboard: {
    title: "Dashboard Satu Data",
    desc: "Pusat pemantauan ekosistem data pembangunan Kabupaten Sumba Barat. Menampilkan metrik agregat dataset, grafik sebaran urusan, dan status verval.",
    steps: [
      "<b>4 Kartu Statistik Utama</b>: Total Dataset Aktif, Dataset Terverifikasi (Lolos Verval), Menunggu Verifikasi, dan Draf.",
      "<b>Kepatuhan Produsen Data</b>: Rekapitulasi keaktifan pembaruan data berkala dari seluruh OPD di Kabupaten Sumba Barat.",
      "<b>Sebaran per Bidang Urusan</b>: Grafik komposisi dataset pada urusan Pendidikan, Kesehatan, Pertanian, PUPR, Pariwisata, dll.",
      "<b>Daftar Pemutakhiran Terkini</b>: Log pengajuan angka statistik terbaru yang masuk dari operator dinas teknis."
    ],
    note: "Bagi akun OPD teknis (Produsen Data), dashboard ini otomatis memfilter ringkasan khusus data yang diampu instansi bersangkutan.",
    screenshot: "/screenshots/satudata_dashboard.png"
  },
  satudata_dataset: {
    title: "Dataset Sektoral Satu Data",
    desc: "Pengelolaan data statistik sektoral daerah berbasis tabel tabular terstandarisasi mengacu pada prinsip Satu Data Indonesia (SDI).",
    steps: [
      "Akses menu <b>Bank Data → Dataset Satu Data</b> di bilah navigasi.",
      "Klik tombol <b>Tambah Dataset</b> untuk menyusun data baru.",
      "Isi kelengkapan metadata standar SDI: judul dataset, urusan & bidang urusan, topik/sub-topik, produsen data (OPD), periode, dan satuan baku.",
      "<b>Input Data Tabular</b>: Masukkan angka realisasi statistik per tahun/wilayah langsung pada tabel matriks.",
      "<b>Impor Massal Excel</b>: Unduh template Excel yang disediakan, isi data di komputer, lalu unggah kembali untuk pengisian cepat ratusan baris data.",
      "Klik <b>Kirim untuk Verifikasi</b> agar dataset masuk ke antrean penelaahan Walidata Daerah."
    ],
    note: "Pastikan dataset menyertakan definisi operasional dan metodologi perolehan data pada bagian metadata.",
    screenshot: "/screenshots/satudata_dataset.png"
  },
  satudata_kinerja: {
    title: "Indikator Kinerja Makro (IKU, IKD, IKK)",
    desc: "Pengelolaan indikator capaian kinerja strategis pembangunan daerah Kabupaten Sumba Barat secara terukur dan berkelanjutan.",
    steps: [
      "Akses menu <b>Bank Data → Indikator Kinerja</b> di bilah navigasi.",
      "Menyajikan 3 tingkatan indikator pembangunan:",
      "— <b>IKU (Indikator Kinerja Utama)</b>: Indikator makro daerah (Pertumbuhan Ekonomi, IPM, Kemiskinan, Gini Ratio).",
      "— <b>IKD (Indikator Kinerja Daerah)</b>: Indikator tingkat bidang urusan pemerintahan.",
      "— <b>IKK (Indikator Kinerja Kunci)</b>: Indikator operasional OPD sesuai dokumen perencanaan Renstra.",
      "Pantau perbandingan <b>Target vs Realisasi</b>, persentase ketercapaian tahunan, dan grafik tren historis multi-tahun."
    ],
    note: "Indikator kinerja yang ditandai 'Tampil di Dashboard' akan disajikan langsung pada dashboard eksekutif untuk memudahkan pimpinan memantau progres.",
    screenshot: "/screenshots/satudata_kinerja.png"
  },
  satudata_verifikasi: {
    title: "Verifikasi Dataset (Verval Walidata)",
    desc: "Alur penelaahan dan validasi oleh Walidata Daerah (BAPPERIDA / Diskominfo) terhadap data yang diajukan oleh OPD sebelum tayang ke publik.",
    steps: [
      "Akses menu <b>Bank Data → Verifikasi Dataset</b> (khusus Walidata dan Administrator).",
      "Periksa daftar pengajuan dataset yang masuk dari berbagai Produsen Data (OPD).",
      "Tinjau 4 kaidah Satu Data: <i>Standar Data</i>, <i>Metadata Lengkap</i>, <i>Interoperabilitas</i>, dan <i>Kesesuaian Kode Referensi</i>.",
      "<b>Setujui Dataset</b>: Dataset resmi dipublikasikan ke Portal Publik Satu Data dan dapat diakses masyarakat.",
      "<b>Kembalikan / Revisi</b>: Tuliskan catatan perbaikan teknis. Dataset akan berstatus 'Perlu Perbaikan' dan dikembalikan ke operator OPD."
    ],
    note: "Dataset yang belum disetujui Walidata tidak akan muncul pada portal publik demi menjamin validitas informasi yang disajikan ke publik.",
    screenshot: "/screenshots/satudata_verifikasi.png"
  },
  spm: {
    title: "Capaian SPM (Standar Pelayanan Minimal)",
    desc: "Pemantauan pemenuhan hak dasar warga negara pada 6 Urusan Wajib Pelayanan Dasar pemerintah daerah sesuai amanat PP No. 2 Tahun 2018.",
    steps: [
      "Akses menu <b>Capaian SPM</b> di bilah navigasi Satu Data.",
      "Menampilkan 6 urusan wajib pelayanan dasar: <b>Pendidikan</b>, <b>Kesehatan</b>, <b>Pekerjaan Umum</b>, <b>Perumahan Rakyat</b>, <b>Trantibumlinmas</b>, dan <b>Sosial</b>.",
      "Buka tab <b>Dashboard SPM</b> untuk melihat grafik persentase pemenuhan target layanan dasar per triwulan dan tahun berjalan.",
      "Buka tab <b>Capaian per Bidang</b> untuk memeriksa rincian capaian sub-indikator teknis per OPD pengampu.",
      "Buka tab <b>Dokumen Pendukung</b> untuk meninjau dan mengunggah berkas SK Tim Penerapan SPM, Dokumen Anggaran DPA, dan laporan evaluasi berkala."
    ],
    note: "Modul ini mempermudah penyusunan Laporan Penerapan SPM Tahunan yang wajib disampaikan kepada Kemendagri.",
    screenshot: "/screenshots/spm.png"
  },
  master_satudata: {
    title: "Master Satu Data & Konfigurasi Fondasi",
    desc: "Pengaturan fondasi data induk Satu Data Kabupaten Sumba Barat (khusus Administrator SDI).",
    steps: [
      "Akses menu <b>Master Satu Data</b> di bilah navigasi Satu Data.",
      "<b>Pengaturan OPD</b>: Kelola daftar produsen data resmi dan kontak penghubung narahubung dinas.",
      "<b>Urusan & Bidang Urusan</b>: Kodifikasi urusan pemerintahan mengacu standar Permendagri 90/2019.",
      "<b>Hak Akses Urusan</b>: Pemetaan urusan apa saja yang boleh diisi oleh masing-masing akun OPD.",
      "<b>Topik & Satuan Baku</b>: Menjaga konsistensi taksonomi katalog dan pembakuan satuan ukuran statistik.",
      "<b>Daftar Data (SK Bupati)</b>: Inventarisasi dataset prioritas yang telah ditetapkan secara legal.",
      "<b>Permintaan Reopen</b>: Meninjau dan menyetujui permohonan pembukaan kembali data tahun lampau yang telah dikunci."
    ],
    note: "Pengaturan master data yang rapi menjamin keselarasan data lintas dinas dan memudahkan sinkronisasi ke tingkat nasional.",
    screenshot: "/screenshots/master_satudata.png"
  },
  kelola_konten: {
    title: "Kelola Konten & Publikasi Informasi",
    desc: "Pusat penerbitan informasi publik, artikel analisis data, produk hukum statistik, dan riwayat pembaruan sistem.",
    steps: [
      "Akses menu <b>Kelola Konten</b> di bilah navigasi Satu Data (khusus Administrator).",
      "<b>Berita & Artikel</b>: Publikasikan rilis analisis statistik pembangunan ekonomi dan kabar kegiatan satu data daerah.",
      "<b>Publikasi, SK & Hukum</b>: Unggah buku statistik digital (seperti <i>Sumba Barat Dalam Angka</i>, Profil PDRB) dan SK Bupati Satu Data.",
      "<b>Video & Portal Eksternal</b>: Tautkan materi edukasi data dan integrasi portal mitra (Bappenas, BPS).",
      "<b>Changelog Aplikasi</b>: Catat rilis fitur dan perbaikan sistem untuk transparansi pengguna."
    ],
    note: "Konten yang dipublikasikan di sini akan tampil secara elegan pada beranda Portal Publik untuk masyarakat umum.",
    screenshot: "/screenshots/kelola_konten.png"
  },
  monitoring: {
    title: "Monitoring Sistem & Integrasi SDPDN",
    desc: "Pemantauan keandalan sistem, trafik pengunjung, integrasi API nasional SDPDN, dan kueri data tingkat lanjut.",
    steps: [
      "Akses menu <b>Monitoring Sistem</b> di bilah navigasi Satu Data (khusus Administrator).",
      "<b>Token API SDPDN</b>: Kelola kredensial token interoperabilitas dengan sistem Satu Data Pembangunan Daerah Nasional.",
      "<b>Kesehatan & Scheduler</b>: Pantau status operasional server, database PostgreSQL, dan Google Drive storage.",
      "<b>Data Pengunjung & Metrik</b>: Analisis jumlah kunjungan halaman dan dataset yang paling banyak diunduh masyarakat.",
      "<b>Pertanyaan Q&A & FAQ</b>: Respon pertanyaan dan permohonan data dari pengunjung publik.",
      "<b>Query Builder & Ekspor</b>: Alat pembangun kueri fleksibel untuk menarik laporan data sektoral dalam format CSV atau Excel."
    ],
    note: "Gunakan fasilitas Query Builder untuk menarik agregasi data lintas urusan tanpa perlu kueri SQL manual.",
    screenshot: "/screenshots/monitoring.png"
  },
  publik: {
    title: "Portal Publik Satu Data",
    desc: "Etalase keterbukaan data pembangunan Kabupaten Sumba Barat yang dapat diakses oleh masyarakat tanpa perlu login.",
    steps: [
      "Akses menu <b>Portal Publik</b> di bilah navigasi atau tautan publik sistem.",
      "Masyarakat dapat menelusuri katalog dataset sektoral secara terbuka.",
      "Menyajikan grafik interaktif per urusan (Pertanian, Pendidikan, Kesehatan, Pariwisata, Infrastruktur).",
      "Menyajikan peta spasial sebaran indikator per kecamatan di wilayah Kabupaten Sumba Barat.",
      "Tersedia tombol unduh data terbuka dalam format CSV, Excel, dan PDF."
    ],
    note: "Portal publik mendukung kepatuhan Keterbukaan Informasi Publik (KIP) dan pemenuhan kebutuhan data riset daerah.",
    screenshot: "/screenshots/publik.png"
  },

  // ── 3. UMUM & AKUN ──────────────────────────────────────────────────────
  login: {
    title: "Login & Autentikasi Pengguna",
    desc: "Tata cara autentikasi sistem kearsipan dan portal data dengan NIP dan Kata Sandi.",
    steps: [
      "Buka aplikasi melalui peramban web (URL resmi BAPPERIDA).",
      "Masukkan <b>NIP</b> (Nomor Induk Pegawai 18 digit) — atau klik nama akun pada daftar cepat jika tersedia.",
      "Masukkan <b>Password</b> (default: <code>BapperidaSB2026</code>).",
      "Klik tombol <b>Masuk</b>.",
      "Sistem mengenali instansi Anda secara otomatis: akun internal diarahkan ke Dashboard Arsip, akun dinas lain diarahkan ke Satu Data."
    ],
    note: "Ganti kata sandi berkala melalui menu Akun Saya. Jika lupa kata sandi, hubungi Administrator sistem untuk reset.",
    screenshot: "/screenshots/login.png"
  },
  pencarian: {
    title: "Pencarian Dokumen & Berkas",
    desc: "Fitur pencarian teks bebas di seluruh repositori dokumen perencanaan.",
    steps: [
      "Ketik kata kunci (judul dokumen, nomor surat, uploader, atau tag) pada kolom pencarian.",
      "Hasil pencarian muncul secara seketika (real-time).",
      "Hasil pencarian menampilkan judul, jenis, sektor, tahun, bidang, dan status dokumen.",
      "Klik baris hasil untuk langsung membuka rincian dokumen."
    ],
    note: "Pencarian cerdas mencakup seluruh metadata naskah dinas yang tersimpan di sistem.",
    screenshot: "/screenshots/pencarian.png"
  },
  pengguna: {
    title: "Manajemen Pengguna (Admin Only)",
    desc: "Fitur pengelolaan akun pengguna, penetapan peran (role), dan pembatasan cakupan instansi (OPD Scoping).",
    table: {
      header: ["Fitur", "Keterangan"],
      rows: [
        ["Tambah Pengguna", "Isi NIP, nama lengkap, gelar, unit/instansi OPD, peran (role), dan kata sandi awal"],
        ["Edit Pengguna", "Perbarui informasi akun atau ubah peran pengguna"],
        ["Hapus / Kunci Akun", "Menonaktifkan akun pegawai yang mutasi atau purna tugas"],
        ["Role Admin", "Akses penuh seluruh modul Arsip Digital, Satu Data, dan Administrasi"],
        ["Role Reviewer", "Hak menelaah, menyetujui, dan mengembalikan usulan dokumen perencanaan"],
        ["Role Staf", "Unggah berkas, isi kertas kerja, dan kelola dokumen unit kerjanya"],
        ["Role Produsen Data", "Input data sektoral dan indikator khusus instansi OPD terkait"],
      ]
    },
    note: "OPD Scoping membatasi operator dinas lain agar hanya dapat mengelola data milik instansinya sendiri.",
    screenshot: "/screenshots/pengguna.png"
  },
  trouble: {
    title: "Tips & Troubleshooting",
    desc: "Solusi cepat dan praktis untuk mengatasi masalah operasional yang sering ditemui.",
    table: {
      header: ["Gejala Masalah", "Langkah Penyelesaian"],
      rows: [
        ["Lupa password", "Hubungi Administrator BAPPERIDA untuk melakukan reset kata sandi."],
        ["Gagal mengunggah berkas", "Periksa koneksi internet, pastikan format PDF/Office valid dan ukuran berkas wajar."],
        ["Menu perencanaan tidak muncul", "Pengguna dari OPD non-BAPPERIDA dikhususkan untuk modul Satu Data."],
        ["Dokumen tidak ditemukan", "Periksa filter aktif pada Pustaka Dokumen (reset filter jenis, sektor, atau tahun)."],
        ["Dataset belum muncul di portal publik", "Dataset belum melewati tahap verifikasi dan persetujuan oleh Walidata."],
        ["Tampilan halaman blank / macet", "Lakukan hard refresh (Ctrl + F5 pada Windows) atau keluar lalu login kembali."],
      ]
    },
    note: "Jika kendala berlanjut, hubungi Bidang PPEPD & Sekretariat BAPPERIDA Kabupaten Sumba Barat.",
    screenshot: "/screenshots/after_login.png"
  },
};

export default function PanduanPengguna({ user }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);

  // Wewenang role & unit kerja
  const isBapperida = isOpdBapperidaFrontend(user);
  const actualRole = user?.role || "Staf";
  const isAdmin = actualRole === "Admin";

  // Mode pratinjau role (khusus Admin agar bisa mengecek tampilan wewenang role lain)
  const [previewRole, setPreviewRole] = useState(isAdmin ? "Semua" : actualRole);

  const activeRole = previewRole === "Semua" ? actualRole : previewRole;
  const isPreviewBapperida = previewRole === "Semua"
    ? isBapperida
    : (previewRole === "Admin" || previewRole === "Reviewer" || previewRole === "Staf" || previewRole === "Walidata");

  // Filter Tab sesuai wewenang
  const allowedTabs = useMemo(() => {
    return ALL_TABS.filter(tab => {
      if (tab.bapperidaOnly && !isPreviewBapperida) return false;
      return true;
    });
  }, [isPreviewBapperida]);

  // Tab utama aktif
  const [activeTab, setActiveTab] = useState(() => {
    return isPreviewBapperida ? "arsip" : "satudata";
  });

  // Pastikan activeTab selalu valid
  useEffect(() => {
    if (!allowedTabs.some(t => t.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || "satudata");
    }
  }, [allowedTabs, activeTab]);

  // Filter Seksi sesuai wewenang role yang sedang aktif
  const allowedSections = useMemo(() => {
    const isActAdmin = previewRole === "Semua" ? isAdmin : previewRole === "Admin";
    const isActWalidata = isActAdmin || activeRole === "Walidata" || activeRole === "Reviewer";

    return SECTIONS.filter(s => {
      // 1. Cek pembatasan instansi BAPPERIDA
      if (s.bapperidaOnly && !isPreviewBapperida) return false;

      // 2. Cek fitur khusus Admin
      if (s.adminOnly && !isActAdmin) return false;

      // 3. Cek fitur khusus Walidata / Reviewer
      if (s.walidataOnly && !isActWalidata) return false;

      return true;
    });
  }, [activeRole, previewRole, isPreviewBapperida, isAdmin]);

  // Seksi untuk tab yang sedang aktif
  const currentSections = useMemo(() => {
    return allowedSections.filter(s => s.tab === activeTab);
  }, [allowedSections, activeTab]);

  // Seksi aktif yang sedang dibuka kontennya
  const [activeId, setActiveId] = useState(() => {
    return currentSections[0]?.id || "dashboard";
  });

  // Pastikan activeId valid saat tab berganti
  useEffect(() => {
    if (!currentSections.some(s => s.id === activeId)) {
      if (currentSections[0]) {
        setActiveId(currentSections[0].id);
      }
    }
  }, [currentSections, activeId]);

  const section = CONTENT[activeId] || CONTENT["dashboard"];

  return (
    <div>
      {/* ── Header Halaman ────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>
              Panduan Pengguna Sistem
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
              Pusat Dokumen Digital Perencanaan Pembangunan & Satu Data — BAPPERIDA Kabupaten Sumba Barat
            </div>
          </div>

          {/* Indikator Wewenang Role / Selector Pratinjau untuk Admin */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            background: T.card,
            padding: isAdmin ? "3px 6px 3px 12px" : "6px 12px",
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            color: T.textSecondary
          }}>
            <Icon name="shield" size={14} style={{ color: T.primary, flexShrink: 0 }} />
            <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>Wewenang Akses:</span>
            {isAdmin ? (
              <Select
                value={previewRole}
                onChange={setPreviewRole}
                options={ROLE_PREVIEW_OPTIONS}
                size="sm"
                searchable={false}
                minWidth={230}
                style={{ maxWidth: 280 }}
              />
            ) : (
              <strong style={{ color: T.text }}>
                {actualRole} {user?.unit ? `(${user.unit})` : ""}
              </strong>
            )}
          </div>
        </div>
      </div>

      {/* ── Segmented Control (ui-ux-pro-max: Clean Tab Navigation) ── */}
      <div style={{
        display: "inline-flex",
        background: T.bg,
        padding: 4,
        borderRadius: 10,
        border: `1px solid ${T.border}`,
        marginBottom: 16,
        gap: 4,
        flexWrap: isMobile ? "wrap" : "nowrap"
      }}>
        {allowedTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                const first = allowedSections.find(s => s.tab === tab.id);
                if (first) setActiveId(first.id);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 16px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                background: isActive ? T.card : "transparent",
                color: isActive ? T.text : T.textSecondary,
                boxShadow: isActive ? T.shadowSm : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Icon name={tab.icon} size={14} style={{ color: isActive ? T.primary : T.textSecondary }} />
              <span>{tab.title}</span>
            </button>
          );
        })}
      </div>

      {/* ── Pill Buttons untuk Seksi di Tab Aktif Sesuai Wewenang ───── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4, flexWrap: "wrap" }}>
        {currentSections.map(s => {
          const isSel = activeId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 99,
                border: `1px solid ${isSel ? T.primary : T.border}`,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: isSel ? 600 : 400,
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: isSel ? T.primary : T.card,
                color: isSel ? "#ffffff" : T.textSecondary,
                transition: "all 0.15s ease",
              }}
            >
              <Icon name={s.icon} size={12} />
              <span>{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* ── Kartu Konten Panduan ──────────────────────────────────── */}
      <div style={{
        background: T.card,
        borderRadius: 12,
        padding: isMobile ? 16 : 24,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadowSm
      }}>
        {/* Judul Seksi */}
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 12 }}>
          {section.title}
        </div>

        {/* Deskripsi */}
        {section.desc && (
          <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
            {section.desc}
          </p>
        )}

        {/* Langkah-langkah */}
        {section.steps && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 8 }}>
              Langkah-langkah:
            </div>
            <ol style={{ paddingLeft: 20, marginBottom: 16 }}>
              {section.steps.map((s, i) => (
                <li
                  key={i}
                  style={{ fontSize: 13, color: T.textSecondary, marginBottom: 8, lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: s }}
                />
              ))}
            </ol>
          </>
        )}

        {/* Tabel Informasi */}
        {section.table && (
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {section.table.header.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        borderBottom: `2px solid ${T.border}`,
                        color: T.textSecondary,
                        fontWeight: 600,
                        background: T.bg
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td
                        key={j}
                        style={{
                          padding: "8px 10px",
                          borderBottom: `1px solid ${T.border}`,
                          color: T.textSecondary
                        }}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Catatan / Info */}
        {section.note && (
          <div style={{
            background: T.markBg,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: T.textSecondary,
            marginBottom: 16,
            display: "flex",
            gap: 8,
            alignItems: "flex-start"
          }}>
            <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 2, color: T.primary }} />
            <span>{section.note}</span>
          </div>
        )}

        {/* Tangkapan Layar (Screenshot) */}
        {section.screenshot && (
          <div style={{
            marginTop: 16,
            borderRadius: 8,
            overflow: "hidden",
            border: `1px solid ${T.border}`
          }}>
            <img
              src={section.screenshot}
              alt={section.title}
              style={{ width: "100%", display: "block" }}
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}
