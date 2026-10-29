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

// Kunci API SENGAJA TIDAK ditulis di berkas ini dan tidak boleh di-commit.
//
// Nilai aslinya pernah bocor ke riwayat git, jadi sekarang hanya ada di Coolify
// (env UPLOAD_API_KEY) dan di Script Properties proyek ini. Kalau kosong, setiap
// POST /api/docs dari GAS ditolak 401 "Sesi berakhir" — GAS tidak punya session
// cookie, jadi satu-satunya cara lolos adalah header X-Upload-Key ini.
//
// Cara pasang: Project Settings > Script Properties > UPLOAD_API_KEY = <nilai
// yang sama dengan UPLOAD_API_KEY di Coolify>.
var API_KEY = '';

/**
 * Kunci API, dibaca dari Script Properties lebih dulu lalu jatuh ke konstanta di
 * atas. Konstanta dibiarkan kosong supaya repo ini tidak pernah menyimpan
 * secret; isinya hanya relevan untuk署 yang masih memakai konfigurensi lama.
 */
function apiKey() {
  try {
    var p = PropertiesService.getScriptProperties().getProperty('UPLOAD_API_KEY');
    if (p) return String(p).trim();
  } catch (e) {
    // Script Properties tidak bisa dibaca: lanjut ke konstanta.
  }
  return String(API_KEY || '').trim();
}

// ── Validasi isi file (magic bytes) ─────────────────────────────────────────
// File melewati GAS ini, bukan server Express, jadi pencocokan isi dengan nama
// file harus di sini: mencegah berkas berbahaya (HTML/JS/eksekutor) yang
// menyamar lewat ekstensi gambar/dokumen. Isi harus benar-benar cocok dengan
// ekstensi yang diklaim — nama .jpg dengan isi PDF (atau sebaliknya) ditolak.
var EKSTENSI_AMAN = {
  pdf: 1, doc: 1, docx: 1, xls: 1, xlsx: 1, ppt: 1, pptx: 1,
  jpg: 1, jpeg: 1, png: 1, gif: 1, webp: 1, bmp: 1,
  csv: 1, txt: 1, rtf: 1, zip: 1, odt: 1, ods: 1, odp: 1
};

function ekstensiNama(nama) {
  var m = String(nama || '').trim().match(/\.([A-Za-z0-9]+)$/);
  return m ? m[1].toLowerCase() : null;
}

function mulaiDengan(bytes, offset, pola) {
  if (!bytes || bytes.length < offset + pola.length) return false;
  for (var i = 0; i < pola.length; i++) {
    if (bytes[offset + i] !== pola[i]) return false;
  }
  return true;
}

// Mengembalikan null kalau isi cocok, atau pesan penolakan.
function isiCocokEkstensi(ekstensi, bytes) {
  if (!bytes || !bytes.length) return 'file kosong';
  switch (ekstensi) {
    case 'pdf':
      return mulaiDengan(bytes, 0, [0x25, 0x50, 0x44, 0x46]) ? null : 'isi file bukan PDF';
    case 'jpg':
    case 'jpeg':
      return mulaiDengan(bytes, 0, [0xFF, 0xD8, 0xFF]) ? null : 'isi file bukan JPEG';
    case 'png':
      return mulaiDengan(bytes, 0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) ? null : 'isi file bukan PNG';
    case 'gif':
      return mulaiDengan(bytes, 0, [0x47, 0x49, 0x46, 0x38]) ? null : 'isi file bukan GIF';
    case 'webp':
      return (mulaiDengan(bytes, 0, [0x52, 0x49, 0x46, 0x46]) && mulaiDengan(bytes, 8, [0x57, 0x45, 0x42, 0x50]))
        ? null : 'isi file bukan WebP';
    case 'bmp':
      return mulaiDengan(bytes, 0, [0x42, 0x4D]) ? null : 'isi file bukan BMP';
    case 'doc':
    case 'xls':
    case 'ppt':
      return mulaiDengan(bytes, 0, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
        ? null : 'isi file bukan dokumen Office lama (OLE2)';
    case 'docx':
    case 'xlsx':
    case 'pptx':
    case 'odt':
    case 'ods':
    case 'odp':
    case 'zip':
      return mulaiDengan(bytes, 0, [0x50, 0x4B]) ? null : 'isi file bukan arsip ZIP/Office';
    case 'rtf':
      return mulaiDengan(bytes, 0, [0x7B, 0x5C, 0x72, 0x74, 0x66]) ? null : 'isi file bukan RTF';
    case 'csv':
    case 'txt': {
      if (mulaiDengan(bytes, 0, [0xFF, 0xFE]) || mulaiDengan(bytes, 0, [0xFE, 0xFF])) return null;
      var n = Math.min(bytes.length, 512);
      for (var i = 0; i < n; i++) {
        if (bytes[i] === 0) return 'isi file bukan teks (ada byte NUL)';
      }
      return null;
    }
    default:
      return 'ekstensi .' + ekstensi + ' tidak diizinkan';
  }
}

// Mengembalikan null kalau lolos, atau pesan penolakan (nama file saja,
// tanpa isi — dipakai di tahap initiate yang belum punya byte).
function validasiEkstensi(namaFile) {
  var ext = ekstensiNama(namaFile);
  if (!ext || !EKSTENSI_AMAN[ext])
    return 'Tipe file "' + String(namaFile || '').slice(0, 100) +
      '" tidak diizinkan (ekstensi harus salah satu: ' + Object.keys(EKSTENSI_AMAN).join(', ') + ')';
  return null;
}

// Mengembalikan null kalau lolos, atau pesan penolakan.
function validasiBerkas(namaFile, bytes) {
  var salah = validasiEkstensi(namaFile);
  if (salah) return salah;
  var salahIsi = isiCocokEkstensi(ekstensiNama(namaFile), bytes);
  if (salahIsi) return 'File "' + String(namaFile).slice(0, 100) + '" ditolak: ' + salahIsi;
  return null;
}

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
      // Tahap ini belum menerima byte, tapi ekstensi sudah bisa diperiksa
      // supaya berkas terlarang tidak sempat di-upload sama sekali.
      var salahAwal = validasiEkstensi(params.filename);
      if (salahAwal) return res(400, { error: salahAwal });

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

      // Chunk pertama memuat header (magic bytes) file — cocokkan dengan
      // filename sebelum diteruskan ke Drive. File kecil selalu lewat direct,
      // jadi chunk pertama pasti sudah mengandung signature lengkap.
      if (Number(params.start) === 0) {
        if (!params.filename) {
          return res(400, { error: 'filename wajib dikirim pada chunk pertama' });
        }
        var salahChunk = validasiBerkas(params.filename, chunkBytes);
        if (salahChunk) return res(400, { error: salahChunk });
      }

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
          bidang:   params.bidang  || '',
          pages:    params.pages   || 0,
          desc:     params.desc    || '',
          tags:     params.tags    || '',
          uploader_id: params.uploader_id || '',
          nomor_dokumen: params.nomor_dokumen || '',
          tanggal_dokumen: params.tanggal_dokumen || '',
          fileType: params.fileType || '',
          // Dikirim hanya saat unggah dipicu dari Kertas Kerja. Server
          // menautkan dokumen ke periodenya di transaksi yang sama dengan
          // INSERT, jadi bukti dukung tidak pernah bisa ada di arsip tanpa
          // pemilik. Kosong di halaman Upload biasa.
          kertas_kerja_periode_id: params.kertas_kerja_periode_id || '',
        };

        var apiOpts = {
          method:         'post',
          contentType:    'application/json',
          payload:        JSON.stringify(apiPayload),
          muteHttpExceptions: true
        };

        if (apiKey()) {
          apiOpts.headers = { "X-Upload-Key": apiKey() };
        }

        var apiRes = UrlFetchApp.fetch(API_BASE_URL + '/api/docs', apiOpts);
        var apiCode = apiRes.getResponseCode();
        var apiBody = JSON.parse(apiRes.getContentText());

        if (apiCode < 200 || apiCode >= 300) {
          return res(apiCode, { error: apiBody.error || 'Gagal menyimpan metadata dokumen' });
        }

        return res(200, {
          message: 'Dokumen berhasil diunggah dan disimpan ke PostgreSQL',
          fileUrl: fileUrl,
          fileId:  params.fileId,
          size:    sizeLabel,
          docId:   apiBody.doc ? apiBody.doc.id : null
        });
      }

      return res(200, {
        message: 'Dokumen berhasil diunggah',
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
        files:    files,
        pages:    params.pages   || 0,
        desc:     params.desc    || '',
        tags:     params.tags    || '',
        uploader_id: params.uploader_id || '',
        nomor_dokumen: params.nomor_dokumen || '',
        tanggal_dokumen: params.tanggal_dokumen || '',
        fileType: params.fileType || '',
      };

      var apiOpts = {
        method:         'post',
        contentType:    'application/json',
        payload:        JSON.stringify(apiPayload),
        muteHttpExceptions: true
      };

      if (apiKey()) {
        apiOpts.headers = { "X-Upload-Key": apiKey() };
      }

      var apiRes = UrlFetchApp.fetch(API_BASE_URL + '/api/docs', apiOpts);
      var apiCode = apiRes.getResponseCode();
      var apiBody = JSON.parse(apiRes.getContentText());

      if (apiCode < 200 || apiCode >= 300) {
        return res(apiCode, { error: apiBody.error || 'Gagal menyimpan metadata folder' });
      }

      return res(200, {
        message: 'Folder berhasil didaftarkan',
        url:     apiPayload.url,
        ukuran:  sizeLabel,
        files:   files.length,
        docId:   apiBody.doc ? apiBody.doc.id : null
      });
    }

    // =========================================================================
    // MODE DIRECT (Fallback untuk file kecil < 30 MB)
    // =========================================================================
    if (!params.file || !params.title || !params.filename) {
      return res(400, { error: 'Parameter file, title, dan filename wajib diisi' });
    }

    var decoded  = Utilities.base64Decode(params.file);
    var salahDirect = validasiBerkas(params.filename, decoded);
    if (salahDirect) return res(400, { error: salahDirect });
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
        bidang:   params.bidang  || '',
        pages:    params.pages   || 0,
        desc:     params.desc    || '',
        tags:     params.tags    || '',
        uploader_id: params.uploader_id || '',
        nomor_dokumen: params.nomor_dokumen || '',
        tanggal_dokumen: params.tanggal_dokumen || '',
        fileType: params.fileType || '',
        // Lihat catatan pada payload di handler finalize. Menautkan di server
        // membuat bukti dukung tidak bisa lepas dari periodenya.
        kertas_kerja_periode_id: params.kertas_kerja_periode_id || '',
      };

      var apiOpts = {
        method:         'post',
        contentType:    'application/json',
        payload:        JSON.stringify(apiPayload),
        muteHttpExceptions: true
      };

      if (apiKey()) {
        apiOpts.headers = { "X-Upload-Key": apiKey() };
      }

      var apiRes = UrlFetchApp.fetch(API_BASE_URL + '/api/docs', apiOpts);
      var apiCode = apiRes.getResponseCode();
      var apiBody = JSON.parse(apiRes.getContentText());

      if (apiCode < 200 || apiCode >= 300) {
        return res(apiCode, { error: apiBody.error || 'Gagal menyimpan metadata dokumen' });
      }

      return res(200, {
        message: 'Dokumen berhasil diunggah',
        fileUrl: fileUrl,
        fileId:  file.getId(),
        size:    sizeLabel,
        docId:   apiBody.doc ? apiBody.doc.id : null
      });
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
