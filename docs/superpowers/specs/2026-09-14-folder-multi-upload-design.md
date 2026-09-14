# Design: Multi-file Upload Menjadi Satu Folder Drive & Satu Dokumen

Tanggal: 2026-09-14

## Ringkasan

Upload **2+ file** dalam satu form sekarang menghasilkan:
- **1 folder** di Google Drive (nama folder = judul dokumen)
- **1 kartu dokumen** di aplikasi, `url` menunjuk ke folder tersebut
- **Daftar file** di dalamnya tampil di halaman detail dokumen

Upload **1 file** tetap seperti sekarang (file langsung di Drive root, 1 dokumen).

## Perilaku Sekarang (baseline)

- Multi-file sudah bisa dipilih di form ("Bisa pilih lebih dari satu file").
- Tiap file di-upload terpisah ke Drive root (`DRIVE_FOLDER_ID`), dan tiap file
  membuat **1 baris DB** sendiri dengan judul `{Judul} — {nama file}`.
- Tidak ada konsep folder apapun.

## Perilaku Baru

### 2+ file dipilih

1. Frontend panggil `gasPost({ action: "createFolder", folderName: form.title })`.
   - GAS membuat folder `form.title` di bawah `DRIVE_FOLDER_ID`.
   - Set sharing `ANYONE_WITH_LINK, VIEW`.
   - Return `{ folderId, folderUrl }`.
2. Tiap file di-upload **ke dalam folder** tersebut (bukan ke root):
   - `initiate` / `direct` menerima parameter opsional `folderId`.
   - Jika `folderId` ada, lokasi target menjadi folder itu, menggantikan `DRIVE_FOLDER_ID`.
   - Saat `group: true`, `direct` dan `finalize` **tidak** melakukan insert DB per-file
     (skip `/api/docs` POST). Cukup return `{ fileId, url, size }`.
3. Setelah semua file selesai, frontend panggil `gasPost({ action: "registerFolder", ... })` **satu kali**:
   - Payload: `title`, `type`, `sector`, `year`, `uploader`, `bidang`, `folderUrl`,
     `files: [{ name, url, size }, ...]`.
   - GAS melakukan **satu insert** ke `/api/docs`:
     - `url` = `folderUrl`
     - `files` = JSON string array `{name, url, size}`
     - `ukuran` = total ukuran semua file
   - Satu entri audit log ("Upload dokumen").
4. Frontend push **satu kartu** ke daftar dokumen dan navigasi ke halaman "Dokumen".

### 1 file dipilih

- Alur lama dipertahankan: upload langsung ke Drive root, insert DB per-file, judul = `form.title` (tanpa suffix). Tidak ada perubahan.

## Perubahan GAS (`google-apps-script/Code.gs`)

- **Action baru `createFolder`**: bikin folder di bawah `DRIVE_FOLDER_ID`, set sharing, return `{folderId, folderUrl}`.
- **Action `initiate`**: `parents` metadata memakai `params.folderId || DRIVE_FOLDER_ID`.
- **Action `direct`**: target folder = `params.folderId ? DriveApp.getFolderById(params.folderId) : folderRoot`. Jika `params.group === true`, skip POST `/api/docs`; tetap return `{fileId, url, size}`.
- **Action `finalize`**: jika `params.group === true`, skip POST `/api/docs`; tetap return `{fileId, fileUrl, size}`.
- **Action baru `registerFolder`**: bangun `files: files.length` dsb, lakukan **satu** POST `/api/docs` dengan payload termasuk `files` (JSON string).

## Perubahan Server (`server/index.js`)

- Auto-migration: `ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS files TEXT`.
- `POST /api/docs`: terima field opsional `files`, simpan sebagai TEXT (JSON string).
- `GET /api/docs`: parse kolom `files` menjadi array (atau `[]`/null) pada response.

## Perubahan Frontend (`src/App.jsx`, `src/components/DocPages.jsx`)

- `handleUpload`: jika `totalFiles > 1` → jalankan alur folder (langkah 1-4 di atas);
  jika 1 file → kode lama.
- `DocDetail`: jika `doc.files` berupa array berisi ≥ 1 → render kartu **"File dalam folder"**:
  nama file + ukuran + tombol/tautan buka file (link per file dari `files[].url`).
- Embed folder: gunakan `https://drive.google.com/embeddedfolderview?id={folderId}#list`.
  Ekstrak `folderId` dari `folderUrl` dengan regex `/folders\/([A-Za-z0-9_-]+)/`.
  File tunggal tetap memakai embed lama (`/file/d/{id}/preview`).
- `DocList`: tampilkan ikon folder + jumlah file bila `doc.files` ada (badge/keterangan kecil).

## Tidak Diubah

- Login, review/status approval path, audit trail, portal publik, tusker/pencarian.
- Endpoint lain di server selain `/api/docs`.
- Alur upload 1 file.

## Error Handling

- Jika `createFolder` gagal → upload dibatalkan, toast error (alur lama `catch` memadai).
- Jika salah satu file gagal di-upload (mis. chunk GAS), seluruh folder upload gagal dan
  dokumen tidak ter-register. Folder kosong/parsial mungkin tersisa di Drive — diterima
  sebagai trade-off ponytail (manual cleanup), tidak dalam scope.

## Testing

- Upload 2+ file kecil (< 30MB, direct) → cek 1 kartu dokumen, detail menampilkan daftar file, folder ada di Drive.
- Upload 2+ file besar (> 30MB, resumable) → alur folder dengan chunk upload.
- Upload 1 file → regresi: tetap perilaku lama.
- Verifikasi DB: satu baris dengan `files` berisi array.