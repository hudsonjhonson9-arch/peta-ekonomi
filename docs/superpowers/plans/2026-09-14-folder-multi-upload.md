# Multi-file Upload Menjadi Satu Folder Drive & Satu Dokumen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload 2+ file dalam satu form menghasilkan 1 folder Google Drive + 1 kartu dokumen dengan daftar file di halaman detail.

**Architecture:** Frontend (App.jsx) deteksi `totalFiles > 1` → alur folder: GAS `createFolder` sekali, tiap file di-upload ke folder itu dengan flag `group:true` (skip insert DB per-file), lalu GAS `registerFolder` sekali untuk satu insert ke `/api/docs` dengan kolom `files` (JSON string). Upload 1 file memakai kode lama tanpa perubahan.

**Tech Stack:** React (Vite), Express + pg, Google Apps Script (UrlFetchApp + Advanced Drive Service), PostgreSQL.

## Global Constraints

- Branch **main only**; push ke `origin main` (master sudah dihapus). Commit message sesuai gaya repo (Bahasa Indonesia, lowercase).
- Jangan tambah dependency baru; tidak ada framework test di repo → verifikasi = `node --check` (server), `npm run build` (frontend), tes manual di browser (spec §Testing).
- Alur upload 1 file DAN mode "Link Google Drive" (`form.fileUrl`) TIDAK boleh berubah.
- GAS: Advanced Drive Service sudah aktif; jangan ganti `doGet`/`doOptions`.
- Folder dibuat di bawah `DRIVE_FOLDER_ID`; sharing `ANYONE_WITH_LINK, VIEW`.
- `files` disimpan sebagai byte (number), bukan label.

---

### Task 1: Server — kolom `files` + POST/GET `/api/docs`

**Files:**
- Modify: `server/index.js:30-36` (migration), `server/index.js:102-130` (GET), `server/index.js:132-156` (POST)

**Interfaces:**
- Consumes: — (basis data `bapperida_dokumen` sudah ada)
- Produces: `GET /api/docs` mengembalikan tiap doc dengan `files` bertipe **array** (`[]` jika kosong). `POST /api/docs` menerima field opsional `files` (array) dan menyimpannya sebagai JSON string di kolom `files`.

- [ ] **Step 1: Tambah auto-migration**

Setelah blok migration `bidang` (baris 36), tambah blok baru:

```js
(async () => {
  try {
    await pool.query(`ALTER TABLE bapperida_dokumen ADD COLUMN IF NOT EXISTS files TEXT`);
    console.log('Migration: files column ready');
  } catch (e) { console.error('Migration files error:', e.message); }
})();
```

- [ ] **Step 2: Modifikasi `GET /api/docs`**

Pada SELECT (baris 104-124) tambahkan `files,` di antara `url,` dan `icon_data,`. Lalu ganti baris lokasi response (baris 125):

```js
res.json(docs.map(d => {
  let files = [];
  if (d.files) { try { files = JSON.parse(d.files); } catch (_) { files = []; } }
  return { ...d, files, tags: d.type ? [d.type] : [] };
}));
```

`{ ...d, files, ... }` menimpa string mentah `d.files` dengan array hasil parse.

- [ ] **Step 3: Modifikasi `POST /api/docs`**

Ganti destructuring (baris 139):

```js
const { title, type, sector, uploader, url, ukuran, bidang, files } = req.body;
```

Ganti INSERT (baris 141-145):

```js
const result = await pool.query(
  `INSERT INTO bapperida_dokumen (judul, kategori, tipe, tanggal, ukuran, url, created_at, bidang, files)
   VALUES ($1, $2, $3, NOW(), $4, $5, NOW(), $6, $7) RETURNING *`,
  [title, type, sector, ukuran || '0 MB', url || '', bidang || '', files ? JSON.stringify(files) : null]
);
```

- [ ] **Step 4: Verifikasi sintaks**

Run: `node --check server/index.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat: kolom files untuk multi-file upload (folder Drive)"
```

---

### Task 2: GAS — `createFolder`, `folderId`, `group`, `registerFolder`

**Files:**
- Modify: `google-apps-script/Code.gs` (jangan lupa folder `google-apps-script`, bukan `google-app-script`)

**Interfaces:**
- Consumes: payload dari frontend (`folderName`, `folderId`, `group`, `files`)
- Produces: `createFolder` → `{ folderId, folderUrl }`; `registerFolder` → `{ url, ukuran, files: n }`

- [ ] **Step 1: Tambah action `createFolder`** (sisipkan segmen baru tepat sebelum blok `if (action === 'finalize')` di baris 124):

```js
// =========================================================================
// BUAT FOLDER UNTUK MULTI-FILE UPLOAD (dipanggil sekali per form 2+ file)
// =========================================================================
if (action === 'createFolder') {
  if (!params.folderName) {
    return res(400, { error: 'folderName wajib diisi' });
  }

  var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID).createFolder(params.folderName);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return res(200, {
    folderId:  folder.getId(),
    folderUrl: folder.getUrl()
  });
}
```

- [ ] **Step 2: `initiate` — target folder opsional**

Ganti metadata parents (baris 50):

```js
var metadata = {
  name: params.filename,
  parents: params.folderId ? [params.folderId] : [DRIVE_FOLDER_ID],
  mimeType: params.mimeType
};
```

- [ ] **Step 3: `direct` — folder opsional + skip insert saat `group`**

Ganti dua baris (baris 179-180):

```js
var folder   = params.folderId ? DriveApp.getFolderById(params.folderId) : DriveApp.getFolderById(DRIVE_FOLDER_ID);
var file     = folder.createFile(blob);
```

Bungkus blok POST `/api/docs` (baris 190-212) dengan `if (!params.group) { ... }`. Yang dibungkus: dari `var apiPayload = {` sampai `UrlFetchApp.fetch(API_BASE_URL + '/api/docs', apiOpts);`. Response akhir (baris 214-219) tetap di luar.

- [ ] **Step 4: `finalize` — skip insert saat `group`**

Bungkus blok API payload & POST (baris 138-160) dengan `if (!params.group) { ... }` (sama pola dengan Step 3). `file.setSharing`, `sizeLabel`, dan return (baris 162-167) tetap di luar.

- [ ] **Step 5: Tambah action `registerFolder`** (sisipkan setelah blok `finalize` selesai, sebelum "MODE DIRECT" di baris 170):

```js
// =========================================================================
// REGISTER SATU DOKUMEN UNTUK SATU FOLDER (2+ file, dipanggil sekali)
// =========================================================================
if (action === 'registerFolder') {
  if (!params.title || !params.files) {
    return res(400, { error: 'title dan files wajib diisi untuk registerFolder' });
  }

  var files = params.files; // array [{ name, url, size(byte) }]
  var totalBytes = files.reduce(function (s, f) { return s + (f.size || 0); }, 0);
  var sizeLabel = totalBytes > 1048576
    ? (totalBytes / 1048576).toFixed(1) + ' MB'
    : (totalBytes / 1024).toFixed(0) + ' KB';

  var apiPayload = {
    title:    params.title,
    type:     params.type    || '',
    sector:   params.sector  || '',
    year:     params.year    || '',
    url:      params.folderUrl || '',
    ukuran:   sizeLabel,
    uploader: params.uploader || 'System',
    bidang:   params.bidang  || '',
    files:    files
  };

  var apiOpts = {
    method:         'post',
    contentType:    'application/json',
    payload:        JSON.stringify(apiPayload),
    muteHttpExceptions: true
  };

  if (API_KEY) {
    apiOpts.headers = { 'X-Upload-Key': API_KEY };
  }

  UrlFetchApp.fetch(API_BASE_URL + '/api/docs', apiOpts);

  return res(200, {
    message: 'Folder berhasil didaftarkan',
    url:     apiPayload.url,
    ukuran:  sizeLabel,
    files:   files.length
  });
}
```

- [ ] **Step 6: Verifikasi & deploy GAS**

Paste seluruh isi `google-apps-script/Code.gs` ke editor GAS → Deploy → Manage deployments → edit deployment → **New version** → Deploy. Konfirmasi deploy dengan membuka URL web app (harus tampil `ARSIP DIGITAL BAPPERIDA Uploader — OK`).

- [ ] **Step 7: Commit**

```bash
git add google-apps-script/Code.gs
git commit -m "feat: GAS createFolder & registerFolder, dukung folderId + group"
```

---

### Task 3: ui.jsx — helper `formatBytes`, `extractGDriveFolderId`, embed folder

**Files:**
- Modify: `src/components/ui.jsx`

**Interfaces:**
- Consumes: —
- Produces: `formatBytes(bytes) → label`, `extractGDriveFolderId(url) → id|null`; `GoogleDriveEmbed` render folder list bila URL folder

- [ ] **Step 1: Tambah `formatBytes`** (setelah `isGDriveUrl`, sebelum `GoogleDriveEmbed`):

```jsx
export function formatBytes(bytes) {
  if (!bytes) return "—";
  return bytes > 1048576
    ? (bytes / 1048576).toFixed(1) + ' MB'
    : (bytes / 1024).toFixed(0) + ' KB';
}
```

- [ ] **Step 2: Tambah `extractGDriveFolderId`** (setelah `extractGDriveFileId`, sebelum `isGDriveUrl`):

```jsx
export function extractGDriveFolderId(url) {
  if (!url) return null;
  const m = url.match(/\/folders\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
```

- [ ] **Step 3: `GoogleDriveEmbed` — dukung folder**

Ganti dua baris pertama body (baris 69-71):

```jsx
const folderId = extractGDriveFolderId(url);
const fileId = extractGDriveFileId(url);
if (!folderId && !fileId) return null;
const embedUrl = folderId
  ? `https://drive.google.com/embeddedfolderview?id=${folderId}#list`
  : `https://drive.google.com/file/d/${fileId}/preview`;
```

- [ ] **Step 4: Verifikasi build**

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui.jsx
git commit -m "feat: dukung preview folder Drive (embeddedfolderview) + formatBytes"
```

---

### Task 4: DocPages — daftar file di detail + ikon folder di list

**Files:**
- Modify: `src/components/DocPages.jsx` (import ui helpers, DocDetail, DocList)

**Interfaces:**
- Consumes: `doc.files` (array dari Task 1), `formatBytes` (Task 3)
- Produces: kartu "File dalam Folder" di detail; ikon folder + jumlah file di grid list

- [ ] **Step 1: Update import** (baris 1)

```jsx
import { Badge, Icon, GoogleDriveEmbed, isGDriveUrl, formatBytes } from "./ui.jsx";
```

- [ ] **Step 2: DocDetail — kartu "File dalam Folder"**

Sisipkan di kolom kiri **setelah** Metadata Card (setelah baris 821 `</div>` penutup Metadata Card, sebelum `{/* Approval Panel */}`):

```jsx
          {/* File dalam Folder */}
          {Array.isArray(doc.files) && doc.files.length > 0 && (
            <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="folder" size={16} style={{ color: T.primary }} />
                File dalam Folder
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {doc.files.map(f => (
                  <a
                    key={f.url}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", background: T.bg, borderRadius: T.radius,
                      border: `1px solid ${T.border}`, textDecoration: "none",
                      color: "inherit", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = T.focusRing; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <Icon name="file" size={15} style={{ color: T.primary, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>{formatBytes(f.size)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 3: DocList — ikon + jumlah file (grid "Tanpa Bidang")**

Di dalam `tanpaBidangDocs.map` (baris 313), sebelum `return`, tambah `const isFolder = Array.isArray(d.files) && d.files.length > 0;`.

Ganti ikon (baris 345):

```jsx
<Icon name={isFolder ? "folder" : "file"} size={18} style={{ color: T.primary }} />
```

Ganti baris `{d.type}` (baris 351):

```jsx
<div style={{ fontSize: 11, color: T.textSecondary }}>
  {isFolder ? `${d.files.length} file dalam folder` : d.type}
</div>
```

- [ ] **Step 4: DocList — ikon + jumlah file (grid di dalam bidang)**

Di dalam `folderDocs.map` (baris 447), sebelum `return`, tambah `const isFolder = Array.isArray(d.files) && d.files.length > 0;`.

Ganti ikon (baris 488):

```jsx
<Icon name={isFolder ? "folder" : "file"} size={16} style={{ color: getBidangColor(d.bidang).text }} />
```

Ganti baris meta `{d.sector} · {d.year}` (baris 506-508):

```jsx
<div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>
  {isFolder ? `${d.files.length} file · ${d.sector} · ${d.year}` : `${d.sector} · ${d.year}`}
</div>
```

- [ ] **Step 5: Verifikasi build**

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/DocPages.jsx
git commit -m "feat: daftar file dalam folder di detail, ikon folder di list"
```

---

### Task 5: App.jsx — alur folder di `handleUpload`

**Files:**
- Modify: `src/App.jsx:222-361`

**Interfaces:**
- Consumes: GAS actions Task 2 (`createFolder`, `direct`/`initiate`/`finalize` + `folderId`/`group`, `registerFolder`)
- Produces: untuk 2+ file → 1 kartu dokumen dengan `files` array; untuk 1 file → kode lama

- [ ] **Step 1: Setup alur folder**

Kode saat ini (baris 222-226):

```js
    if (!form.fileObjs || !form.fileObjs.length) return showToast("Pilih file terlebih dahulu.");

    try {
      var totalFiles = form.fileObjs.length;
      var allDocs = [];
```

(a) Sisipkan **sebelum** `try {`:

```js
    var groupMode = form.fileObjs.length > 1;
    var folderId = null;
    var folderUrl = null;

```

(b) Ganti `var allDocs = [];` menjadi:

```js
      var allDocs = [];
      var groupFiles = [];
```

- [ ] **Step 2: Buat folder sekali sebelum loop**

Sisipkan tepat setelah `var allDocs = [];` (sebelum `for (var fi...)`):

```js
      if (groupMode) {
        var folderRes = await gasPost({ action: "createFolder", folderName: form.title });
        if (folderRes.error || !folderRes.folderId) throw new Error(folderRes.error || "Gagal membuat folder Drive");
        folderId = folderRes.folderId;
        folderUrl = folderRes.folderUrl;
      }
```

- [ ] **Step 3: `direct` — kirim `folderId` + `group`**

Pada payload gasPost direct (baris 244-255), tambah dua baris sebelum penutup `});`:

```js
            folderId: groupMode ? folderId : undefined,
            group:    groupMode,
```

- [ ] **Step 4: `initiate` — kirim `folderId`**

Pada payload gasPost initiate (baris 258-263), tambah sebelum `});`:

```js
            folderId: groupMode ? folderId : undefined,
```

- [ ] **Step 5: `finalize` — kirim `group`**

Pada payload gasPost finalize (baris 321-330), tambah sebelum `});`:

```js
            group: groupMode,
```

- [ ] **Step 6: Kumpulkan hasil file saat group**

Ganti `if (result.error) throw new Error(result.error);` + `allDocs.push(...)` (baris 333-352) sehingga push hanya saat non-group, dan saat group file dimasukkan ke `groupFiles`:

```js
        if (result.error) throw new Error(result.error);

        if (groupMode) {
          groupFiles.push({ name: fobj.name, url: result.fileUrl, size: fobj.size });
          continue;
        }

        allDocs.push({
          id:         Date.now() + fi,
          title:      fileTitle,
          type:       form.type,
          sector:     form.sector,
          year:       form.year,
          status:     "Menunggu Review",
          uploader:   user.name,
          reviewedBy: "—",
          size:       result.size || "—",
          pages:      0,
          uploadDate: new Date().toLocaleDateString("id-ID"),
          desc:       form.desc || "—",
          tags:       form.tags ? form.tags.split(",").map(function (t) { return t.trim(); }).filter(Boolean) : [],
          url:        result.fileUrl || "",
          publik:     false,
          bidang:     form.bidang || "",
        });
```

- [ ] **Step 7: Registrasi folder setelah loop**

Ganti blok `if (allDocs.length > 0) { ... }` (baris 355-361) menjadi:

```js
      if (groupMode) {
        var reg = await gasPost({
          action:    "registerFolder",
          title:     form.title,
          type:      form.type,
          sector:    form.sector,
          year:      form.year,
          uploader:  user.name,
          bidang:    form.bidang || "",
          folderUrl: folderUrl,
          files:     groupFiles,
        });
        if (reg.error) throw new Error(reg.error);

        var folderDoc = {
          id:         Date.now(),
          title:      form.title,
          type:       form.type,
          sector:     form.sector,
          year:       form.year,
          status:     "Menunggu Review",
          uploader:   user.name,
          reviewedBy: "—",
          size:       reg.ukuran || "—",
          pages:      0,
          uploadDate: new Date().toLocaleDateString("id-ID"),
          desc:       form.desc || "—",
          tags:       form.tags ? form.tags.split(",").map(function (t) { return t.trim(); }).filter(Boolean) : [],
          url:        reg.url || folderUrl,
          publik:     false,
          bidang:     form.bidang || "",
          files:      groupFiles,
        };
        setDocs(function (d) { return [folderDoc].concat(d); });
        addLog("Upload dokumen", folderDoc);
        queryClient.invalidateQueries({ queryKey: ['docs'] });
        setPage("dokumen");
        showToast("Folder " + form.title + " (" + groupFiles.length + " file) berhasil diunggah dan dikirim untuk review.");
        return;
      }

      if (allDocs.length > 0) {
        setDocs(function (d) { return allDocs.concat(d); });
        allDocs.forEach(function (doc) { addLog("Upload dokumen", doc); });
        queryClient.invalidateQueries({ queryKey: ['docs'] });
        setPage("dokumen");
        showToast(allDocs.length + " dokumen berhasil diunggah dan dikirim untuk review.");
      }
```

- [ ] **Step 8: Verifikasi build**

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 9: Commit & push**

```bash
git add src/App.jsx
git commit -m "feat: alur folder untuk multi-file upload (2+ file jadi 1 dokumen)"
git push origin main
```

---

### Task 6: Deploy & uji end-to-end

**Files:** — (deploy manual)

**Interfaces:**
- Consumes: semua task di atas
- Produces: fitur live di https://arsipdigital.mindcloud.my.id/

- [ ] **Step 1: Deploy server** — Coolify project `PETA-EKONOMI`, rebuild/restart aplikasi (server pull commit Task 1). Konfirmasi log: `Migration: files column ready` + `Migration: bidang column ready`.

- [ ] **Step 2: Deploy frontend** — sama, satu redeploy (build dist Task 3-5).

- [ ] **Step 3: Uji 2+ file kecil (< 30 MB)** — login NIP `200206302025061002` / `BapperidaSB2026`, pilih 2 file kecil, upload. Harap: 1 kartu dokumen berjudul sesuai form, detail menampilkan "File dalam Folder" berisi 2 file, folder ada di Drive (https://drive.google.com/drive/folders/1yJXskcIfVjH-X7HWQh0b-BgnmTimkNQs).

- [ ] **Step 4: Uji 1 file** — regresi: upload 1 file kecil → tetap perilaku lama (1 dokumen, judul `form.title`, file di root Drive).

- [ ] **Step 5: Uji 2+ file besar (> 30 MB)** — alur folder dengan resumable (retry chunk bekerja karena `initiate` menerima `folderId`).

- [ ] **Step 6: Verifikasi DB** — cek baris dokumen terbaru di `bapperida_dokumen`: kolom `files` berisi JSON array, `url` menunjuk folder, `ukuran` = total.

---

## Self-Review

- **Spec coverage:** Spec §Perubahan GAS (createFolder, initiate parents, direct folder, direct/finalize group skip, registerFolder) → Task 2 tiap poin satu step. §Perubahan Server (migration, POST accept files, GET parse) → Task 1. §Perubahan Frontend (handleUpload alur folder, DocDetail kartu file, embed folder, DocList ikon folder) → Task 3-5. §Tidak Diubah (alur 1 file, fileUrl mode, endpoint lain) → Task 1 hanya sentuh `/api/docs`; Task 5 guard `groupMode`. §Error Handling (createFolder gagal → batalkan) → Task 5 throw di Step 2 memicu catch lama.
- **Placeholder scan:** tidak ada TBD/TODO; semua step punya kode eksplisit.
- **Type consistency:** `files` = array `[{name, url, size}]` di seluruh rantai (App.jsx → GAS registerFolder → POST /api/docs → GET parse → DocDetail/DocList); `formatBytes(f.size)` dipakai di Task 4, didefinisikan di Task 3. `registerFolder` return `{ url, ukuran, files }` dikonsumsi App.jsx sebagai `reg.url` / `reg.ukuran`. `createFolder` return `{ folderId, folderUrl }` → `folderRes`. Konsisten.
- **Catatan deploy GAS:** Task 2 Step 6 mengharuskan paste manual ke editor GAS karena tidak otomatis dari repo.