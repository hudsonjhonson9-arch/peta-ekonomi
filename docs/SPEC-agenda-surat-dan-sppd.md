# Spesifikasi Teknis & Rencana Implementasi: Agenda Surat & Register SPPD Digital
**Sistem:** ARSIP DIGITAL BAPPERIDA (`peta-ekonomi`)  
**Instansi:** BAPPERIDA Kabupaten Sumba Barat  
**Tujuan:** Menggantikan buku fisik/manual tata usaha persuratan dan buku register perjalanan dinas menjadi sistem digital terpusat, tertib arsip, dan siap audit.

---

## 1. Latar Belakang & Ruang Lingkup

Selama ini administrasi persuratan dan perjalanan dinas di BAPPERIDA masih menggunakan buku agenda fisik:
1. **Buku Agenda Surat Masuk & Surat Keluar:** Rentan hilang/rusak, pencatatan disposisi tercecer, nomor surat dinas keluar sering tertumpuk/ganda (*booking manual*), dan pencarian arsip fisik memakan waktu.
2. **Buku Register SPPD Dalam Daerah:** Pencatatan penugasan monitoring/lapangan antar kecamatan/desa yang tidak terintegrasi dengan kode rekening belanja sub kegiatan anggaran.
3. **Buku Register SPPD Luar Daerah:** Pertanggungjawaban (SPJ) tiket, boarding pass, hotel, dan Laporan Hasil Perjalanan Dinas (LHP) sering lambat dikumpulkan karena tidak adanya *monitoring dashboard* status realisasi perjalanan dinas luar daerah.

Fitur baru ini menambahkan 4 pilar buku register digital ke dalam aplikasi **Arsip Digital (`peta-ekonomi`)**:
- 📘 **Buku Agenda Surat Masuk** (Pencatatan, File Scan PDF, & Lembar Disposisi Digital)
- 📙 **Buku Agenda Surat Keluar** (Penomoran/Booking Otomatis, Konseptor, & Berkas Final)
- 📗 **Buku Register SPPD Dalam Daerah** (SPT/SPPD Kecamatan & Desa, Laporan Hasil, & Biaya Lumpsum/BBM)
- 📕 **Buku Register SPPD Luar Daerah** (SPT/SPPD Provinsi & Pusat, SBM Luar Daerah, Tiket/Hotel At Cost, & Bukti SPJ)

---

## 2. Rincian Fitur & Alur Bisnis

### 2.1. Buku Agenda Surat Masuk
* **Nomor Agenda Otomatis:** Dihitung berurutan per tahun anggaran (format: `0001/SM/2026`).
* **Metadata Surat:**
  - Tanggal Penerimaan (waktu terima di loket/tata usaha)
  - Nomor & Tanggal Surat Asli dari Pengirim
  - Pengirim / Asal Surat (OPD, Kementerian, Lembaga, Swasta, Desa, Masyarakat)
  - Perihal / Ringkasan Isi Surat
  - Sifat Surat: `Biasa`, `Penting`, `Segera`, `Sangat Segera`, `Rahasia`
  - Kode Klasifikasi Arsip (misal: `005` Undangan, `050` Perencanaan, `900` Keuangan)
  - Jumlah Lampiran & File PDF Surat Masuk
* **Lembar Disposisi Digital:**
  - Pengisi: Kepala Badan / Sekretaris Badan.
  - Arahan Checklist: *Tindak lanjuti*, *Hadiri / Wakili*, *Pelajari / Telaah*, *Koordinasikan*, *Siapkan Bahan / Draf*, *Arsipkan*.
  - Diteruskan Kepada (Multi-pilihan): Kabid Ekonomi & SDA, Kabid PPM, Kabid IPW, Kasubag Umum & Kepegawaian, Pejabat Fungsional / Staf.
  - Catatan Instruksi Khusus & Batas Waktu Tindak Lanjut (*Deadline*).
  - Status Alur: `Diterima` $\rightarrow$ `Didisposisikan` $\rightarrow$ `Sedang Ditindaklanjuti` $\rightarrow$ `Selesai`.
* **Cetak:** Cetak Lembar Disposisi format resmi Pemda (A5 / A4) langsung siap cetak atau ekspor PDF.

---

### 2.2. Buku Agenda Surat Keluar
* **Generator & Booking Nomor Surat Otomatis:**
  - Format standar Tata Naskah Dinas Pemda:  
    $$\text{[Kode Klasifikasi]} / \text{[No. Urut]} / \text{BAPPERIDA} / \text{[Bulan Romawi]} / \text{[Tahun]}$$
    *Contoh:* `050/0142/BAPPERIDA/XI/2026`
  - Mencegah nomor surat ganda atau terlewat saat ada beberapa bidang yang meminta nomor surat di hari yang sama.
* **Metadata Surat Keluar:**
  - Tanggal Surat
  - Tujuan Surat (Nama Jabatan & Instansi Penerima)
  - Perihal Surat
  - Bidang Pengonsep (Ekonomi & SDA / PPM / IPW / Sekretariat)
  - Pejabat Penandatangan (Kepala Badan / Sekretaris / Plt)
  - File Draf (Word/PDF) & File Final yang sudah ditandatangani/cap basah/elektronik.
  - Tautan Referensi: Dapat dihubungkan ke Surat Masuk (bila surat keluar merupakan jawaban/tindak lanjut atas surat masuk tertentu).
* **Status Surat Keluar:** `Draf` $\rightarrow$ `Paraf Bidang` $\rightarrow$ `Ditandatangani` $\rightarrow$ `Terkirim / Ekspedisi`.

---

### 2.3. Buku Register SPPD Dalam Daerah
* **Fokus:** Perjalanan dinas staf/pejabat ke wilayah kecamatan, desa, puskesmas, atau lokasi proyek lapangan di lingkup Kabupaten Sumba Barat.
* **Metadata & Registrasi:**
  - Nomor Register Urut SPPD Dalam Daerah (reset per tahun)
  - Nomor SPT (Surat Perintah Tugas) & Nomor SPPD
  - Tanggal SPT & SPPD
  - Pejabat Pemberi Perintah (PA / KPA / Kepala Badan)
  - Pelaksana Utama (Nama, NIP, Golongan, Jabatan)
  - Pengikut / Rombongan (Daftar nama & NIP pegawai yang ikut)
  - Maksud Perjalanan Dinas (mis. *"Monitoring Lapangan Evaluasi Ketahanan Pangan Kecamatan Wanokaka"*)
  - Tempat Berangkat: Kantor Bapperida Waikabubak
  - Tempat Tujuan: Kecamatan tujuan (Loli / Wanokaka / Lamboya / Tanarighu / Laboya Barat / Kota) & Desa
  - Waktu: Tanggal Berangkat, Tanggal Kembali, Lama Hari Perjalanan
  - Alat Angkutan: Kendaraan Dinas Roda 4 / Roda 2 / Angkutan Umum
* **Pembebanan Anggaran (Terintegrasi):**
  - Sub Kegiatan: Dropdown pilihan subkegiatan dari database Bapperida (`pks_subkegiatan`)
  - Kode Rekening: Belanja Perjalanan Dinas Dalam Daerah (`5.1.02.04.01.0001`)
  - Rincian Biaya: Uang Harian / Uang Saku & Biaya Transport / BBM
* **Dokumen & Status:**
  - Upload berkas SPT & SPPD
  - Upload Laporan Hasil Perjalanan Dinas (LHP) & Foto Dokumentasi Lapangan
  - Status: `Pengajuan` $\rightarrow$ `Disetujui` $\rightarrow$ `Sedang Berjalan` $\rightarrow$ `Laporan Masuk` $\rightarrow$ `Selesai (SPJ Lengkap)`.

---

### 2.4. Buku Register SPPD Luar Daerah
* **Fokus:** Perjalanan dinas luar pulau/provinsi (Kupang, Denpasar, Surabaya, Jakarta, Kementerian PPN/Bappenas, Kemendagri, dll).
* **Metadata Khusus Luar Daerah:**
  - Nomor Register SPPD Luar Daerah & Nomor SPT
  - Dasar Penugasan: Surat Undangan dari Kementerian/Provinsi (bisa langsung pilih dari daftar Surat Masuk!)
  - Pelaksana & Golongan (menentukan plafon hotel & uang harian SBM)
  - Kota & Provinsi Tujuan
  - Maksud Perjalanan Dinas
  - Rute: Asal - Transit - Tujuan - Kembali (mis. *Waikabubak - Tambolaka - Denpasar - Jakarta PP*)
  - Moda Transportasi: Pesawat Udara, Kapal Laut, Mobil Rental/Taksi
  - Tanggal Berangkat, Tanggal Pulang, Jumlah Hari Dinas
* **Komponen Biaya Rinci SBM (Standar Biaya Masukan):**
  - Uang Harian Luar Daerah (tarif per hari per provinsi tujuan sesuai regulasi)
  - Biaya Tiket Pesawat / Kapal PP (*At Cost*)
  - Biaya Hotel / Penginapan (*At Cost*, dipagari batas maksimal plafon per eselon/golongan)
  - Uang Representasi (khusus Pejabat Eselon II / Kepala Badan)
  - Biaya Transport Bandara / Taksi Resmi PP (*At Cost*)
  - Total Estimasi Biaya vs Total Realisasi Pertanggungjawaban
* **Koleksi Dokumen Pertanggungjawaban (SPJ):**
  - Upload Tiket & Boarding Pass (multi-file)
  - Upload Invoice / Bill Hotel / Penginapan
  - Upload Laporan Hasil Perjalanan Dinas (LHP) & Notulen Konsultasi/Rakor
  - Upload Dokumentasi / Foto Kegiatan
* **Status Workflow:**
  $$\text{Draf} \rightarrow \text{Verifikasi Anggaran} \rightarrow \text{Disetujui KPA} \rightarrow \text{Uang Muka} \rightarrow \text{Pelaksanaan} \rightarrow \text{Verifikasi SPJ} \rightarrow \text{Selesai}$$

---

## 3. Rancangan Skema Database (PostgreSQL)

Skema database dirancang modular dengan relasi bersih dan indeks pencarian cepat:

```sql
-- ============================================================
-- 1. TABEL AGENDA SURAT MASUK
-- ============================================================
CREATE TABLE IF NOT EXISTS agenda_surat_masuk (
    id                  SERIAL PRIMARY KEY,
    tahun               INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    nomor_agenda        VARCHAR(50) NOT NULL,              -- mis: 0001/SM/2026
    tanggal_terima      DATE NOT NULL DEFAULT CURRENT_DATE,
    nomor_surat_asli    VARCHAR(150) NOT NULL,
    tanggal_surat       DATE NOT NULL,
    asal_surat          VARCHAR(255) NOT NULL,             -- Nama instansi / pengirim
    perihal             TEXT NOT NULL,
    sifat               VARCHAR(50) DEFAULT 'Biasa',       -- Biasa, Penting, Segera, Rahasia
    kode_klasifikasi    VARCHAR(50),                       -- mis: 005, 050, 900
    jumlah_lampiran     VARCHAR(50) DEFAULT '—',
    file_url            TEXT,                              -- URL PDF Google Drive / storage
    file_name           VARCHAR(255),
    status              VARCHAR(50) DEFAULT 'Diterima',    -- Diterima, Didisposisi, Proses, Selesai
    created_by          VARCHAR(100),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surat_masuk_tahun ON agenda_surat_masuk(tahun);
CREATE INDEX IF NOT EXISTS idx_surat_masuk_no_agenda ON agenda_surat_masuk(nomor_agenda);

-- ============================================================
-- 2. TABEL LEMBAR DISPOSISI SURAT MASUK
-- ============================================================
CREATE TABLE IF NOT EXISTS agenda_disposisi (
    id                  SERIAL PRIMARY KEY,
    surat_masuk_id      INT REFERENCES agenda_surat_masuk(id) ON DELETE CASCADE,
    tanggal_disposisi   DATE NOT NULL DEFAULT CURRENT_DATE,
    pemberi_disposisi   VARCHAR(100) NOT NULL,             -- mis: Kepala Badan / Sekretaris
    arahan              JSONB DEFAULT '[]'::jsonb,         -- ["Tindaklanjuti", "Hadiri/Wakili", ...]
    catatan_instruksi   TEXT,
    diteruskan_kepada   JSONB DEFAULT '[]'::jsonb,         -- ["Kabid Ekonomi", "Kasubag Umum", ...]
    batas_waktu         DATE,
    status_tindaklanjut VARCHAR(50) DEFAULT 'Didisposisikan', -- Didisposisikan, Proses, Selesai
    laporan_staf        TEXT,                              -- Umpan balik staf pelaksana
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABEL AGENDA SURAT KELUAR
-- ============================================================
CREATE TABLE IF NOT EXISTS agenda_surat_keluar (
    id                  SERIAL PRIMARY KEY,
    tahun               INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    nomor_agenda        VARCHAR(50) NOT NULL,              -- mis: 0001/SK/2026
    nomor_surat         VARCHAR(150) NOT NULL UNIQUE,      -- mis: 050/0142/BAPPERIDA/XI/2026
    kode_klasifikasi    VARCHAR(50) NOT NULL,
    nomor_urut          INT NOT NULL,
    tanggal_surat       DATE NOT NULL DEFAULT CURRENT_DATE,
    tujuan_surat        VARCHAR(255) NOT NULL,             -- Nama pejabat/instansi tujuan
    perihal             TEXT NOT NULL,
    sifat               VARCHAR(50) DEFAULT 'Biasa',
    bidang_pengonsep    VARCHAR(100) NOT NULL,             -- Sekretariat, Ekonomi & SDA, PPM, IPW
    penandatangan       VARCHAR(100) NOT NULL,             -- Kepala Badan, Sekretaris, Plt
    surat_masuk_ref_id  INT REFERENCES agenda_surat_masuk(id) ON DELETE SET NULL, -- Tautan balasan
    file_draft_url      TEXT,
    file_final_url      TEXT,
    status              VARCHAR(50) DEFAULT 'Draf',        -- Draf, Ditandatangani, Terkirim
    created_by          VARCHAR(100),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surat_keluar_tahun ON agenda_surat_keluar(tahun);
CREATE INDEX IF NOT EXISTS idx_surat_keluar_no ON agenda_surat_keluar(nomor_surat);

-- ============================================================
-- 4. TABEL BUKU REGISTER SPPD (DALAM & LUAR DAERAH)
-- ============================================================
CREATE TABLE IF NOT EXISTS agenda_sppd (
    id                  SERIAL PRIMARY KEY,
    jenis_sppd          VARCHAR(20) NOT NULL CHECK (jenis_sppd IN ('DALAM_DAERAH', 'LUAR_DAERAH')),
    tahun               INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    nomor_register      VARCHAR(50) NOT NULL,              -- mis: 001/SPPD-DD/2026 atau 001/SPPD-LD/2026
    nomor_spt           VARCHAR(100) NOT NULL,
    nomor_sppd          VARCHAR(100) NOT NULL,
    tanggal_spt         DATE NOT NULL DEFAULT CURRENT_DATE,
    pejabat_perintah    VARCHAR(100) NOT NULL,             -- PA / KPA / Kepala Badan
    
    -- Data Pegawai Utama
    pelaksana_nip       VARCHAR(50) NOT NULL,
    pelaksana_nama      VARCHAR(150) NOT NULL,
    pelaksana_pangkat   VARCHAR(100),
    pelaksana_jabatan   VARCHAR(150),
    pengikut            JSONB DEFAULT '[]'::jsonb,         -- [{"nama": "...", "nip": "...", "jabatan": "..."}]
    
    -- Detail Perjalanan
    maksud_perjalanan   TEXT NOT NULL,
    tempat_berangkat    VARCHAR(100) DEFAULT 'Waikabubak',
    tempat_tujuan       VARCHAR(255) NOT NULL,             -- Kecamatan/Desa (DD) atau Kota/Kementerian (LD)
    provinsi_tujuan     VARCHAR(100),                      -- Khusus Luar Daerah
    rute_perjalanan     VARCHAR(255),                      -- Asal - Transit - Tujuan PP
    alat_angkutan       VARCHAR(100) DEFAULT 'Darat',      -- Kendaraan Dinas, Pesawat, Kapal, dll
    tanggal_berangkat   DATE NOT NULL,
    tanggal_kembali     DATE NOT NULL,
    lama_hari           INT NOT NULL DEFAULT 1,
    
    -- Anggaran & Kode Rekening
    subkegiatan_id      INT,                               -- Relasi ke pks_subkegiatan bila ada
    subkegiatan_nama    TEXT,
    kode_rekening       VARCHAR(50),                       -- 5.1.02.04.01.0001 (DD) / 5.1.02.04.01.0003 (LD)
    
    -- Rincian Biaya & Komponen
    rincian_biaya       JSONB DEFAULT '{}'::jsonb,         -- {uang_harian, tiket, hotel, transport_lokal, representasi}
    total_biaya         NUMERIC(15,2) DEFAULT 0,
    
    -- Berkas Terkait
    file_spt_url        TEXT,
    file_sppd_url       TEXT,
    file_lhp_url        TEXT,                              -- Laporan Hasil Perjalanan
    berkas_spj          JSONB DEFAULT '[]'::jsonb,         -- [{"jenis": "TIKET/HOTEL/FOTO", "url": "..."}]
    
    surat_masuk_ref_id  INT REFERENCES agenda_surat_masuk(id) ON DELETE SET NULL, -- Dasar surat undangan
    status              VARCHAR(50) DEFAULT 'Pengajuan',   -- Pengajuan, Disetujui, Berjalan, Laporan Masuk, Selesai
    created_by          VARCHAR(100),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sppd_jenis_tahun ON agenda_sppd(jenis_sppd, tahun);
CREATE INDEX IF NOT EXISTS idx_sppd_nomor_spt ON agenda_sppd(nomor_spt);
```

---

## 4. Rancang Bangun API Backend (Express.js)

Ditempatkan pada modul router baru: `server/agenda-routes.js`

### 4.1. Endpoint Surat Masuk & Disposisi
* `GET /api/agenda/surat-masuk?tahun=&q=&status=&limit=&offset=`  
  Mengambil daftar agenda surat masuk dengan pagination dan filter pencarian.
* `POST /api/agenda/surat-masuk` (Admin / Staf TU)  
  Mencatat surat masuk baru, mengunggah PDF, dan menerbitkan `nomor_agenda` otomatis.
* `PUT /api/agenda/surat-masuk/:id` (Admin / Staf TU)  
  Memperbarui metadata surat masuk.
* `DELETE /api/agenda/surat-masuk/:id` (Admin only)  
  Menghapus catatan surat masuk dan lampirannya.
* `POST /api/agenda/surat-masuk/:id/disposisi` (Pimpinan: Kepala/Sekretaris)  
  Menyimpan atau memperbarui lembar disposisi digital dan otomatis mengirim notifikasi ke bidang tujuan.
* `GET /api/agenda/surat-masuk/:id/disposisi/cetak`  
  Menghasilkan tampilan cetak/PDF lembar disposisi resmi.

### 4.2. Endpoint Surat Keluar & Generator Nomor
* `GET /api/agenda/surat-keluar?tahun=&q=&bidang=&status=`  
  Daftar agenda surat keluar.
* `GET /api/agenda/surat-keluar/preview-nomor?kode=&tahun=`  
  Pratinjau nomor surat resmi berikutnya sebelum disimpan (mencegah bentrok nomor).
* `POST /api/agenda/surat-keluar` (Staf / Admin)  
  Booking nomor surat keluar baru secara atomik (menggunakan transaksi SQL `FOR UPDATE`).
* `PUT /api/agenda/surat-keluar/:id`  
  Update status (mis. upload file yang sudah ditandatangani dan diberi cap).
* `DELETE /api/agenda/surat-keluar/:id` (Admin only)  
  Pembatalan nomor surat keluar dengan pencatatan status "Dibatalkan" (bukan hapus fisik agar urutan nomor tidak hilang).

### 4.3. Endpoint Register SPPD (Dalam & Luar Daerah)
* `GET /api/agenda/sppd?jenis=DALAM_DAERAH|LUAR_DAERAH&tahun=&q=&status=`  
  Daftar register SPPD dengan filter tahun, pencarian nama pegawai / tujuan.
* `POST /api/agenda/sppd`  
  Mendaftarkan SPT & SPPD baru, kalkulasi estimasi SBM otomatis berdasarkan rute/tujuan dan golongan pegawai.
* `PUT /api/agenda/sppd/:id`  
  Update rincian SPT/SPPD.
* `POST /api/agenda/sppd/:id/lhp`  
  Staf mengunggah Laporan Hasil Perjalanan Dinas (LHP) setelah selesai penugasan.
* `POST /api/agenda/sppd/:id/spj`  
  Mengunggah bukti kuitansi hotel, tiket pesawat/kapal, boarding pass.
* `PUT /api/agenda/sppd/:id/status` (Verifikator Keuangan / KPA)  
  Mengubah status (Verifikasi Berkas $\rightarrow$ Selesai).
* `GET /api/agenda/sppd/export-excel?jenis=&tahun=`  
  Ekspor rekapitulasi Buku Register SPPD lengkap ke format Excel (`.xlsx`) siap tanda tangan.

---

## 5. Rancang Bangun Antarmuka Pengguna (Frontend React)

Ditempatkan pada folder komponen: `src/components/agenda/`
- `AgendaSuratPage.jsx` (Halaman utama Agenda Surat dengan Sub-tab Surat Masuk & Keluar)
- `ModalSuratMasuk.jsx` & `ModalDisposisi.jsx`
- `ModalSuratKeluar.jsx`
- `AgendaSppdPage.jsx` (Halaman utama Register SPPD dengan Sub-tab Dalam Daerah & Luar Daerah)
- `ModalSppdSpt.jsx` (Form multi-step input penugasan, rute, dan kalkulator biaya)
- `ModalUploadSpj.jsx` (Pengunggahan bukti boarding pass/hotel/LHP)

### 5.1. Prinsip Desain UI/UX (Anti-Slop & Data-Dense)
1. **Navigasi Tab Terpadu:**
   - Grup Menu di Sidebar:
     - 📁 **Tata Usaha & Persuratan**
       - 📥 Agenda Surat Masuk
       - 📤 Agenda Surat Keluar
     - 🚗 **Administrasi Perjalanan Dinas**
       - 📍 SPPD Dalam Daerah
       - ✈️ SPPD Luar Daerah
2. **Data-Dense Table & Tabular Nums:**
   - Kolom nomor agenda, nomor surat dinas, tanggal, dan nilai anggaran rupiah menggunakan font proporsional monospace (`font-mono tabular-nums`).
   - Tombol aksi ringkas berbasis ikon konsisten (Lihat PDF, Disposisi, Cetak, SPJ, Edit).
3. **Filter Cepat & Ringkasan KPI di Atas Tabel:**
   - KPI ringkas di atas tabel: *Total Surat Masuk*, *Menunggu Disposisi*, *Proses Tindak Lanjut*, *Selesai*.
   - Filter cepat berdasarkan rentang tanggal dan status.
4. **Fitur Ekspor Satu Klik:**
   - Tombol **"Ekspor Buku Agenda (Excel)"** untuk kebutuhan arsip tahunan/laporan audit BPK.
   - Tombol **"Cetak Lembar Disposisi"** dan **"Cetak Register"**.

---

## 6. Rencana Tahapan Eksekusi (Implementation Tasks)

| Tahap | Aktivitas | Deliverable |
|:---:|---|---|
| **Tahap 1** | **Migrasi Database** | Script SQL pembuatan tabel `agenda_surat_masuk`, `agenda_disposisi`, `agenda_surat_keluar`, dan `agenda_sppd`. |
| **Tahap 2** | **Backend API Routes** | Modul `server/agenda-routes.js` yang mencakup CRUD atomik, generator penomoran surat, dan kalkulator SBM. |
| **Tahap 3** | **Modul Agenda Surat Masuk & Disposisi** | Antarmuka registrasi surat masuk, PDF viewer, modal lembar disposisi digital, dan cetak lembar disposisi. |
| **Tahap 4** | **Modul Agenda Surat Keluar** | Antarmuka booking nomor surat resmi Bapperida otomatis, upload berkas draft & final. |
| **Tahap 5** | **Modul SPPD Dalam & Luar Daerah** | Antarmuka register SPPD, integrasi subkegiatan anggaran, upload LHP & bukti SPJ tiket/hotel. |
| **Tahap 6** | **Ekspor Excel & Verifikasi Akhir** | Endpoint generator Excel (`exceljs`), pengujian end-to-end, dan pembaruan buku panduan pengguna. |

---

Dokumen rancangan ini siap dijadikan acuan kerja langsung oleh tim *engineer* untuk implementasi modul persuratan dan SPPD digital BAPPERIDA.

