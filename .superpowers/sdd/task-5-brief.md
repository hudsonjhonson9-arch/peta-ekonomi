# Task 5 Brief: App.jsx — alur folder di handleUpload

**Goal:** When `form.fileObjs.length > 1`, upload all files into ONE Drive folder → register ONE document with a `files` array. When exactly 1 file, keep the existing per-file flow byte-for-byte.

**File to modify:** `src/App.jsx` — inside `handleUpload` (function spans lines 172-365).

**Working directory:** `D:\Code\peta-ekonomi`

**Already-shipped dependencies acting on this code:**
- GAS `createFolder` returns `{ folderId, folderUrl }` (or `{ error }`).
- GAS `direct`, `initiate`, `finalize` accept optional `folderId` (create the Drive file INSIDE that folder) and `group` (skip the per-file DB insert).
- GAS `registerFolder` accepts `{ title, type, sector, year, uploader, bidang, folderUrl, files: [{name,url,size}] }` and inserts ONE row; returns `{ url, ukuran, files }` (url = folder echo, ukuran = total bytes) or `{ error }`.
- Server POST `/api/docs` now accepts an optional `files` (JSON-stringified array) column.

## Current Code Context (verbatim, current exact line numbers in the file)

### Lines 222-226 (setup):
```js
    if (!form.fileObjs || !form.fileObjs.length) return showToast("Pilih file terlebih dahulu.");

    try {
      var totalFiles = form.fileObjs.length;
      var allDocs = [];
```

### direct payload (lines 244-255):
```js
          result = await gasPost({
            action:   "direct",
            file:     base64,
            filename: fobj.name,
            mimeType: fobj.type,
            title:    fileTitle,
            type:     form.type,
            sector:   form.sector,
            year:     form.year,
            uploader: user.name,
            bidang:   form.bidang || "",
          });
```

### initiate payload (lines 258-263):
```js
          var initResult = await gasPost({
            action:   "initiate",
            filename: fobj.name,
            mimeType: fobj.type || "application/octet-stream",
            fileSize: fobj.size,
          });
```

### finalize payload (lines 321-330):
```js
          result = await gasPost({
            action:   "finalize",
            fileId:   driveFileId,
            title:    fileTitle,
            type:     form.type,
            sector:   form.sector,
            year:     form.year,
            uploader: user.name,
            bidang:   form.bidang || "",
          });
```

### result check + push (lines 333-352):
```js
        if (result.error) throw new Error(result.error);

        allDocs.push({
          id:         Date.now() + fi,
          title:      fileTitle,
          ...
          url:        result.fileUrl || "",
          publik:     false,
          bidang:     form.bidang || "",
        });
```

### post-loop block (lines 355-361):
```js
      if (allDocs.length > 0) {
        setDocs(function (d) { return allDocs.concat(d); });
        allDocs.forEach(function (doc) { addLog("Upload dokumen", doc); });
        queryClient.invalidateQueries({ queryKey: ['docs'] });
        setPage("dokumen");
        showToast(allDocs.length + " dokumen berhasil diunggah dan dikirim untuk review.");
      }
```

## Exact Changes

### Step 1: Setup alur folder
(a) Insert BEFORE `try {` (current line 224):
```js
    var groupMode = form.fileObjs.length > 1;
    var folderId = null;
    var folderUrl = null;

```
(b) Change `var allDocs = [];` (line 226) to:
```js
      var allDocs = [];
      var groupFiles = [];
```

### Step 2: Buat folder sekali sebelum loop
Insert right after `var groupFiles = [];` (before `for (var fi = 0; ...)`):
```js
      if (groupMode) {
        var folderRes = await gasPost({ action: "createFolder", folderName: form.title });
        if (folderRes.error || !folderRes.folderId) throw new Error(folderRes.error || "Gagal membuat folder Drive");
        folderId = folderRes.folderId;
        folderUrl = folderRes.folderUrl;
      }
```

### Step 3: `direct` — kirim `folderId` + `group`
In the direct gasPost payload, add before the closing `});`:
```js
            folderId: groupMode ? folderId : undefined,
            group:    groupMode,
```

### Step 4: `initiate` — kirim `folderId`
In the initiate gasPost payload, add before the closing `});`:
```js
            folderId: groupMode ? folderId : undefined,
```

### Step 5: `finalize` — kirim `group`
In the finalize gasPost payload, add before the closing `});`:
```js
            group: groupMode,
```

### Step 6: Kumpulkan hasil file saat group
Replace `if (result.error) throw new Error(result.error);` + `allDocs.push({...})` with:
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

### Step 7: Registrasi folder setelah loop
Replace the `if (allDocs.length > 0) { ... }` block with:
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

### Step 8: Verify build
Run: `npm run build` from `D:\Code\peta-ekonomi`
Expected: exit code 0. (The `await` inside the non-async-looking `try` is fine — `handleUpload` is already `async`.)

### Step 9: Commit
```bash
git add src/App.jsx
git commit -m "feat: upload multi-file jadi satu folder Drive + satu dokumen"
```

## Constraints
- The 1-file path must be UNCHANGED in behavior: same GAS payloads (no `folderId`, no `group`), same push to `allDocs`, same toast. The only 1-file delta is the two unused vars (`groupMode=false`, `folderId`/`folderUrl` stay null).
- Do not touch `gasPost`, `DIRECT_THRESHOLD`, `CHUNK_SIZE`, the resumable chunk loop, or anything outside `handleUpload`.
- No new dependencies.