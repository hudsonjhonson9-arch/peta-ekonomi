/**
 * ARSIP DIGITAL BAPPERIDA — Google Apps Script (Resumable Upload Supported)
 * Web App untuk upload dokumen ke Google Drive & simpan link ke PostgreSQL.
 *
 * Mode:
 *   - initiate: buat resumable upload session (file > 30MB)
 *   - finalize: set permission & simpan metadata ke DB
 *   - direct:   upload base64 langsung (file kecil < 30MB)
 *
 * Deploy:
 *   1. Buka https://script.google.com → New project
 *   2. Paste kode ini, simpan
 *   3. Enable Advanced Drive Service (Services → + → Drive API)
 *   4. Run checkDrivePermissions() sekali di editor (register OAuth scope)
 *   5. Deploy → New deployment → Web app → Execute as: Me, Access: Anyone
 *   6. Copy URL web app → isikan ke .env GAS_WEBAPP_URL
 *
 * Folder Drive: https://drive.google.com/drive/folders/1yJXskcIfVjH-X7HWQh0b-BgnmTimkNQs
 */

var DRIVE_FOLDER_ID = '1yJXskcIfVjH-X7HWQh0b-BgnmTimkNQs';
var API_BASE_URL    = 'https://arsipdigital.mindcloud.my.id';
var API_KEY         = '';

function doPost(e) {
  var res = function (code, body) {
    return ContentService
      .createTextOutput(JSON.stringify(body))
      .setMimeType(ContentService.MimeType.JSON);
  };

  try {
    var params;
    try { params = JSON.parse(e.postData.contents); } catch (e2) { params = e.parameter; }
    if (!params) return res(400, { error: 'Request body tidak valid' });

    var action = params.action || 'direct';

    // =========================================================================
    // TAHAP 1: Inisiasi Resumable Upload Session (Client -> GAS -> Drive API)
    // =========================================================================
    if (action === 'initiate') {
      if (!params.filename || !params.mimeType) {
        return res(400, { error: 'filename dan mimeType wajib diisi untuk inisiasi session' });
      }

      var driveApiUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
      var metadata = {
        name: params.filename,
        parents: params.folderId ? [params.folderId] : [DRIVE_FOLDER_ID],
        mimeType: params.mimeType
      };

      var options = {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
          'X-Upload-Content-Type': params.mimeType,
          'X-Upload-Content-Length': String(params.fileSize || 0)
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true
      };

      var apiResponse = UrlFetchApp.fetch(driveApiUrl, options);
      var headers = apiResponse.getHeaders();
      var uploadUrl = headers['Location'] || headers['location'];

      if (!uploadUrl) {
        return res(500, {
          error: 'Gagal mendapatkan Resumable Upload Session URL dari Drive API',
          details: apiResponse.getContentText()
        });
      }

      return res(200, {
        message: 'Resumable session berhasil dibuat',
        uploadUrl: uploadUrl
      });
    }

    // =========================================================================
    // TAHAP 1b: Forward chunk ke Drive API (file > 30MB)
    // =========================================================================
    if (action === 'chunk') {
      if (!params.uploadUrl || !params.chunkBase64 || params.start == null || params.end == null || !params.totalSize) {
        return res(400, { error: 'Parameter uploadUrl, chunkBase64, start, end, totalSize wajib diisi' });
      }

      var chunkBytes = Utilities.base64Decode(params.chunkBase64);
      var chunkOpts = {
        method: 'put',
        contentType: params.mimeType || 'application/octet-stream',
        headers: {
          'Content-Range': 'bytes ' + params.start + '-' + (params.end - 1) + '/' + params.totalSize
        },
        payload: chunkBytes,
        muteHttpExceptions: true
      };

      var chunkResp = UrlFetchApp.fetch(params.uploadUrl, chunkOpts);
      var chunkStatus = chunkResp.getResponseCode();

      if (chunkStatus === 200 || chunkStatus === 201) {
        var fileJson = JSON.parse(chunkResp.getContentText());
        return res(200, { status: chunkStatus, complete: true, fileId: fileJson.id });
      }

      if (chunkStatus === 308) {
        return res(200, { status: chunkStatus, complete: false });
      }

      return res(500, {
        status: chunkStatus,
        error: 'Chunk upload gagal',
        details: chunkResp.getContentText().substring(0, 500)
      });
    }

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

    // =========================================================================
    // HAPUS FILE/FOLDER DARI GOOGLE DRIVE
    // =========================================================================
    if (action === 'deleteFile') {
      if (!params.fileId) {
        return res(400, { error: 'fileId wajib diisi' });
      }

      var id = params.fileId;
      // Extract ID from URL: https://drive.google.com/file/d/{ID}/... or /drive/folders/{ID}
      var m = id.match(/\/d\/([a-zA-Z0-9_-]+)/) || id.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (m) id = m[1];

      try {
        var file = DriveApp.getFileById(id);
        file.setTrashed(true);
        return res(200, { message: 'File berhasil dihapus', fileId: id, type: 'file' });
      } catch (e1) {
        try {
          var folder = DriveApp.getFolderById(id);
          folder.setTrashed(true);
          return res(200, { message: 'Folder berhasil dihapus', fileId: id, type: 'folder' });
        } catch (e2) {
          return res(404, { error: 'File/folder tidak ditemukan di Drive', fileId: id });
        }
      }
    }

    // =========================================================================
    // TAHAP 2: Finalisasi — set permission & simpan metadata ke PostgreSQL
    // =========================================================================
    if (action === 'finalize') {
      if (!params.fileId || !params.title) {
        return res(400, { error: 'fileId dan title wajib diisi pada tahap finalisasi' });
      }

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
    }

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

    // =========================================================================
    // MODE DIRECT (Fallback untuk file kecil < 30 MB)
    // =========================================================================
    if (!params.file || !params.title || !params.filename) {
      return res(400, { error: 'Parameter file, title, dan filename wajib diisi' });
    }

    var decoded  = Utilities.base64Decode(params.file);
    var blob     = Utilities.newBlob(decoded, params.mimeType || 'application/octet-stream', params.filename);
    var folder   = params.folderId ? DriveApp.getFolderById(params.folderId) : DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var file     = folder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileUrl  = file.getUrl();
    var bytes    = blob.getBytes().length;
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
      message: 'Dokumen berhasil diunggah',
      fileUrl: fileUrl,
      fileId:  file.getId(),
      size:    sizeLabel
    });

  } catch (err) {
    return res(500, { error: err.message });
  }
}

function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

function doGet() {
  return ContentService
    .createTextOutput('ARSIP DIGITAL BAPPERIDA Uploader — OK')
    .setMimeType(ContentService.MimeType.TEXT);
}

// Panggil fungsi ini sekali di editor GAS agar izin OAuth Google Drive terdaftar
function checkDrivePermissions() {
  DriveApp.getRootFolder();
}
