# PETA EKONOMI
**Pusat Dokumen Digital Perencanaan Bidang Ekonomi**  
BAPPERIDA Kabupaten Sumba Barat

---

## Cara Menjalankan di Lokal

### Prasyarat
- **Node.js** versi 18 atau lebih baru → https://nodejs.org
- **npm** (sudah termasuk bersama Node.js)

### Langkah-langkah

```bash
# 1. Masuk ke folder project
cd peta-ekonomi

# 2. Install dependensi (hanya perlu sekali)
npm install

# 3. Jalankan aplikasi (mode development)
npm run dev
```

Setelah menjalankan `npm run dev`, buka browser dan akses:
```
http://localhost:5173
```

---

## Akun Demo

Semua akun menggunakan password: **admin123**

| Nama             | Role     | Email                                         |
|------------------|----------|-----------------------------------------------|
| Agustina Malo    | Admin    | agustina@bapperida.sumbabarat.go.id           |
| Kabid Ekonomi    | Reviewer | kabid.ekonomi@bapperida.sumbabarat.go.id      |
| Yohanes Rangga   | Staf     | yohanes@bapperida.sumbabarat.go.id            |
| Maria Lende      | Staf     | maria@bapperida.sumbabarat.go.id              |
| Dominikus Tamu   | Staf     | dominikus@bapperida.sumbabarat.go.id          |

> Klik nama akun di halaman login untuk mengisi otomatis.

---

## Fitur Aplikasi

- **Dashboard** — statistik ringkasan, grafik per jenis & sektor, dokumen terbaru
- **Dokumen** — daftar semua dokumen dengan filter bertingkat (jenis, sektor, tahun, status)
- **Detail Dokumen** — metadata lengkap, riwayat status, aksi approve/tolak (Reviewer/Admin)
- **Upload Dokumen** — form upload dengan validasi, otomatis masuk status "Menunggu Review"
- **Pencarian** — pencarian bebas di seluruh isi repositori
- **Portal Publik** — tampilan dokumen yang boleh diakses publik
- **Manajemen Pengguna** — khusus Admin
- **Audit Trail** — log semua aktivitas sistem, update real-time

---

## Alur Persetujuan

```
Staf Upload → Menunggu Review → Kabid Review → Menunggu Persetujuan → Kepala Setujui → Diarsipkan
                                                                    ↘ Ditolak
```

---

## Struktur Folder

```
peta-ekonomi/
├── public/
│   └── icon.svg
├── src/
│   ├── components/
│   │   ├── ui.jsx            # Icon, Badge, Toast
│   │   ├── LoginPage.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Dashboard.jsx
│   │   ├── DocPages.jsx      # DocList + DocDetail
│   │   ├── UploadForm.jsx
│   │   └── Pages.jsx         # Pencarian, PortalPublik, Pengguna, Audit
│   ├── data.js               # Data konstanta & data dummy
│   ├── App.jsx               # Root component & state management
│   └── main.jsx              # Entry point React
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## Build untuk Produksi

```bash
npm run build
```

Hasil build tersimpan di folder `dist/` dan siap di-deploy ke server / hosting statis.

---

## Tech Stack

| Layer     | Teknologi               |
|-----------|-------------------------|
| Frontend  | React 18 + Vite 5       |
| Styling   | Inline CSS (no library) |
| State     | React useState (lokal)  |
| Data      | Data dummy in-memory    |

> **Catatan:** Versi ini menggunakan data dummy in-memory. Untuk produksi,
> hubungkan ke backend Supabase + n8n sesuai arsitektur yang telah dirancang.
