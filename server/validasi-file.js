// Validasi tipe file untuk metadata arsip.
//
// Byte file tidak pernah melewati server Express (browser → Google Apps Script
// → Drive), jadi yang bisa dicek di sini adalah konsistensi metadata: ekstensi
// nama file harus termasuk allowlist, tautan harus benar-benar Google Drive,
// dan label fileType harus sesuai ekstensi file-nya. Pencocokan isi file
// (magic bytes) dilakukan di google-apps-script/Code.gs saat byte diterima.

export const EKSTENSI_AMAN = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
  'csv', 'txt', 'rtf', 'zip',
  'odt', 'ods', 'odp',
]);

// Label fileType yang dipakai UploadForm.detectFileType dan pilihan edit di
// DocPages. Apa pun di luar ini ditolak supaya kolom file_type tidak bisa
// diisi teks sewenang-wenang.
export const LABEL_TIPE_VALID = ['PDF', 'Word', 'Excel', 'PowerPoint', 'Lainnya'];

export function ekstensiNama(nama) {
  if (typeof nama !== 'string') return null;
  const m = nama.trim().match(/\.([A-Za-z0-9]+)$/);
  return m ? m[1].toLowerCase() : null;
}

export function labelDariEkstensi(ekstensi) {
  if (!ekstensi) return null;
  if (ekstensi === 'pdf') return 'PDF';
  if (ekstensi === 'doc' || ekstensi === 'docx') return 'Word';
  if (ekstensi === 'xls' || ekstensi === 'xlsx') return 'Excel';
  if (ekstensi === 'ppt' || ekstensi === 'pptx') return 'PowerPoint';
  if (EKSTENSI_AMAN.has(ekstensi)) return 'Lainnya';
  return null;
}

// Berkas arsip hanya boleh berasal dari Google Drive. url kosong diizinkan
// karena ada alur yang memang belum punya tautan; apa pun yang terisi tapi
// bukan Drive (data:, javascript:, situs eksternal) ditolak — tautan itu yang
// dirender di preview dan dibuka lewat window.open tanpa penyaringan lain.
export function urlDriveValid(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  let u;
  try { u = new URL(url.trim()); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase();
  return host === 'drive.google.com'
    || host === 'docs.google.com'
    || host.endsWith('.googleusercontent.com');
}

export function validasiLabelFileTipe(fileType) {
  if (fileType == null || fileType === '') return null;
  if (typeof fileType !== 'string' || !LABEL_TIPE_VALID.includes(fileType))
    return `fileType "${String(fileType).slice(0, 40)}" tidak dikenal (harus salah satu: ${LABEL_TIPE_VALID.join(', ')})`;
  return null;
}

// Mengembalikan pesan kesalahan pertama, atau null kalau metadata valid.
export function validasiMetadataDokumen({ url, files, fileType } = {}) {
  if (url != null && url !== '' && !urlDriveValid(url))
    return 'url dokumen harus berupa tautan Google Drive yang valid';

  const salahLabel = validasiLabelFileTipe(fileType);
  if (salahLabel) return salahLabel;

  if (files != null) {
    if (!Array.isArray(files)) return 'files harus berupa array';
    for (const f of files) {
      if (!f || typeof f.name !== 'string' || !f.name.trim())
        return 'setiap file wajib memiliki nama';
      const ekstensi = ekstensiNama(f.name);
      if (!ekstensi || !EKSTENSI_AMAN.has(ekstensi))
        return `Tipe file "${f.name}" tidak diizinkan (ekstensi harus salah satu: ${[...EKSTENSI_AMAN].join(', ')})`;
      if (f.url && !urlDriveValid(f.url))
        return `URL file "${f.name}" harus berupa tautan Google Drive yang valid`;
    }

    // fileType harus mencerminkan isi file pertama, bukan klaim sepihak:
    // ekstensi .pdf yang dilabeli "Excel" (atau sebaliknya) adalah indikasi
    // penyamaran tipe. Tanpa ekstensi (mis. judul tanpa .pdf) tidak bisa
    // dibandingkan, jadi hanya labelnya yang dipastikan sah (di atas).
    if (fileType && files.length) {
      const label = labelDariEkstensi(ekstensiNama(files[0].name));
      if (label && label !== fileType)
        return `fileType "${fileType}" tidak cocok dengan tipe file "${files[0].name}" (seharusnya "${label}")`;
    }
  }

  return null;
}
