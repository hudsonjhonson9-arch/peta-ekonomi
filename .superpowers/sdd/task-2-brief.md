# Task 2 Brief: GAS — `createFolder`, `folderId`, `group`, `registerFolder`

**Goal:** Add Google Apps Script support for multi-file upload → one folder: create the folder, upload each file into it (skipping per-file DB insert when `group`), then register the whole folder as one document.

**File to modify:** `google-apps-script/Code.gs` (folder is `google-apps-script`, not `google-app-script`)

**Working directory:** `D:\Code\peta-ekonomi`

## Current Code Context (verbatim, exact line numbers)

### Constants (lines 21-23):
```js
var DRIVE_FOLDER_ID = '1yJXskcIfVjH-X7HWQh0b-BgnmTimkNQs';
var API_BASE_URL    = 'https://arsipdigital.mindcloud.my.id';
var API_KEY         = '';
```

### `initiate` metadata (lines 47-52):
```js
      var driveApiUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
      var metadata = {
        name: params.filename,
        parents: [DRIVE_FOLDER_ID],
        mimeType: params.mimeType
      };
```

### `chunk` block ENDS at line 119 (the `}` closing `if (action === 'chunk')`).

### `finalize` block (lines 124-168): the whole `if (action === 'finalize') { ... }`.

Inside it:
```js
      var file = DriveApp.getFileById(params.fileId);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      var fileUrl  = file.getUrl();
      var bytes    = file.getSize();
      var sizeLabel = bytes > 1048576
        ? (bytes / 1048576).toFixed(1) + ' MB'
        : (bytes / 1024).toFixed(0) + ' KB';

      var apiPayload = { ... };          // lines 138-147
      var apiOpts = { ... };             // lines 149-158
      UrlFetchApp.fetch(API_BASE_URL + '/api/docs', apiOpts);   // line 160

      return res(200, { message, fileUrl, fileId, size });      // lines 162-167
```

### Direct mode (lines 173-219), after "MODE DIRECT" comment:
```js
    if (!params.file || !params.title || !params.filename) {
      return res(400, { error: 'Parameter file, title, dan filename wajib diisi' });
    }

    var decoded  = Utilities.base64Decode(params.file);
    var blob     = Utilities.newBlob(decoded, params.mimeType || 'application/octet-stream', params.filename);
    var folder   = DriveApp.getFolderById(DRIVE_FOLDER_ID);       // line 179
    var file     = folder.createFile(blob);                        // line 180

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileUrl  = file.getUrl();
    var bytes    = blob.getBytes().length;
    var sizeLabel = bytes > 1048576
      ? (bytes / 1048576).toFixed(1) + ' MB'
      : (bytes / 1024).toFixed(0) + ' KB';

    var apiPayload = { ... };          // lines 190-199
    var apiOpts = { ... };             // lines 201-210
    UrlFetchApp.fetch(API_BASE_URL + '/api/docs', apiOpts);       // line 212

    return res(200, { message, fileUrl, fileId, size });          // lines 214-219
```

## Exact Changes

### Step 1: Add `createFolder` action
Insert a new block AFTER the `chunk` block closes (after line 119), BEFORE `if (action === 'finalize')`:

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

### Step 2: `initiate` — target parent folder optional
Change the `metadata` object (lines 48-52) so `parents` uses the requested folder if present:

```js
      var metadata = {
        name: params.filename,
        parents: params.folderId ? [params.folderId] : [DRIVE_FOLDER_ID],
        mimeType: params.mimeType
      };
```

### Step 3: `direct` — folder optional + skip DB insert when `group`
(a) Change lines 179-180:
```js
    var folder   = params.folderId ? DriveApp.getFolderById(params.folderId) : DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var file     = folder.createFile(blob);
```

(b) Wrap the DB POST in `if (!params.group) { ... }`. Wrap from `var apiPayload = {` (line 190) through `UrlFetchApp.fetch(API_BASE_URL + '/api/docs', apiOpts);` (line 212). The `return res(200, ...)` at lines 214-219 stays OUTSIDE the wrap. Resulting shape:

```js
    if (!params.group) {
      var apiPayload = {
        title:    params.title,
        type:     params.type    || '',
        sector:   params.sector  || '',
        year:     params.year    || '',
        url:      fileUrl,
        ukuran:   sizeLabel,
        uploader: params.uploader || 'System',
        bidang:   params.bidang  || ''
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
    }

    return res(200, {
      message: 'Dokumen berhasil diunggah',
      fileUrl: fileUrl,
      fileId:  file.getId(),
      size:    sizeLabel
    });
```

### Step 4: `finalize` — skip DB insert when `group`
Wrap the same way (lines 138-160 inside the finalize block) with `if (!params.group) { ... }`. `file.setSharing` (line 130), `sizeLabel` calc (lines 134-136), and the `return res(200, ...)` (lines 162-167) stay OUTSIDE. Result:

```js
      var file = DriveApp.getFileById(params.fileId);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      var fileUrl  = file.getUrl();
      var bytes    = file.getSize();
      var sizeLabel = bytes > 1048576
        ? (bytes / 1048576).toFixed(1) + ' MB'
        : (bytes / 1024).toFixed(0) + ' KB';

      if (!params.group) {
        var apiPayload = {
          title:    params.title,
          type:     params.type    || '',
          sector:   params.sector  || '',
          year:     params.year    || '',
          url:      fileUrl,
          ukuran:   sizeLabel,
          uploader: params.uploader || 'System',
          bidang:   params.bidang  || ''
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
      }

      return res(200, {
        message: 'Dokumen berhasil diunggah dan disimpan ke PostgreSQL',
        fileUrl: fileUrl,
        fileId:  params.fileId,
        size:    sizeLabel
      });
```

### Step 5: Add `registerFolder` action
Insert AFTER the `finalize` block closes (after line 168), BEFORE the "MODE DIRECT" comment block (line 170):

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

### Step 6: Syntax sanity check
You cannot run GAS locally. Do a careful visual check of balanced braces and that no existing action block was damaged. (GAS is deployed manually by the human — this task only edits the source file.)

### Step 7: Commit
```bash
git add google-apps-script/Code.gs
git commit -m "feat: GAS createFolder & registerFolder, dukung folderId + group"
```

## Constraints
- Do NOT change `doGet`, `doOptions`, constants, comment blocks, or the `chunk` action.
- Do NOT add dependencies. Keep the same code style (ES5-ish, `var`, 2-space indent, Indonesian comments).
- Advanced Drive Service is already enabled; `DriveApp.getFolderById(folderId).createFolder(name)` and `folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)` are the intended primitives.
- The 1-file / drive-link flows must stay byte-identical in behavior (guarded by `!params.group`).