/**
 * PETA EKONOMI — Google Apps Script
 * Web App untuk upload dokumen ke Google Drive & simpan link ke PostgreSQL.
 *
 * Cara deploy:
 *   1. Buka https://script.google.com → New project
 *   2. Paste kode ini, simpan
 *   3. Deploy → New deployment → Web app
 *   4. Execute as: Me, Access: Anyone
 *   5. Copy URL web app → isikan ke .env GAS_WEBAPP_URL
 *
 * Folder Drive: https://drive.google.com/drive/folders/1yJXskcIfVjH-X7HWQh0b-BgnmTimkNQs
 */

var DRIVE_FOLDER_ID = '1yJXskcIfVjH-X7HWQh0b-BgnmTimkNQs';
var API_BASE_URL    = 'https://peta-ekonomi.mindcloud.my.id'; // Root domain, GAS akan nambah /api/docs
var API_KEY         = ''; // Optional, cocokkan dengan UPLOAD_API_KEY di .env

function doPost(e) {
  var res = function (code, body) {
    return ContentService
      .createTextOutput(JSON.stringify(body))
      .setMimeType(ContentService.MimeType.JSON);
  };

  try {
    var params = JSON.parse(e.postData.contents);

    if (!params.file || !params.title || !params.filename) {
      return res(400, { error: 'Parameter file, title, dan filename wajib diisi' });
    }

    var decoded  = Utilities.base64Decode(params.file);
    var blob     = Utilities.newBlob(decoded, params.mimeType || 'application/octet-stream', params.filename);
    var folder   = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var file     = folder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileUrl  = file.getUrl();
    var bytes    = blob.getBytes().length;
    var sizeLabel = bytes > 1048576
      ? (bytes / 1048576).toFixed(1) + ' MB'
      : (bytes / 1024).toFixed(0) + ' KB';

    var apiPayload = {
      title:    params.title,
      type:     params.type    || '',
      sector:   params.sector  || '',
      year:     params.year    || '',
      url:      fileUrl,
      ukuran:   sizeLabel,
      uploader: params.uploader || 'System'
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

    var apiRes    = UrlFetchApp.fetch(API_BASE_URL + '/api/docs', apiOpts);
    var apiData   = JSON.parse(apiRes.getContentText());

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

function doGet() {
  return ContentService
    .createTextOutput('PETA EKONOMI Uploader — OK')
    .setMimeType(ContentService.MimeType.TEXT);
}
