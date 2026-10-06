// Aturan tautan antara satu baris kertas_kerja_periode dan dokumen arsipnya.
//
// Dipisah supaya bisa diuji tanpa database dan, yang lebih penting, supaya
// frontend dan server memakai satu definisi yang sama. Sebelumnya judul dokumen
// dirakit di KertasKerja.jsx sementara pencocokan ulang untuk repairing
// dilakukan lewat SQL di server: begitu salah satu berubah, dokumen "sudah
// terunggah" tapi tidak pernah ketautan dan tidak ada yang bisa menemukan
// kembali.

// Pemisah antara nama output dan label periode. Dipakai persis sama di upload,
// di pencarian dokumen, dan di SQL backfill.
export const PEMBATAS = ' \u2014 '; // " — "

// id baris bapperida_dokumen.
//
// Validator ini harus menolak apa pun yang bukan digit penuh. Id Drive milik
// Google juga alphabet dan hex, dan parseInt("1AbCd...", 10) mengembalikan 1 —
// bukan NaN. Versi lama memakai parseInt, jadi Drive file id yang diawali
// angka silently tertaut ke dokumen yang tidak ada hubungannya.
export function idDokumenValid(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!/^[0-9]+$/.test(s)) return null;
  const n = parseInt(s, 10);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

// Judul dokumen yang dipakai saat mengunggah bukti dukung untuk satu periode.
//
// Klien harus memanggil ini juga. Kalau tidak, pencocokan judul untuk
// repairing akan gagal diam-diam begitu ada output yang namanya berubah.
export function judulDokumenPeriode(namaOutput, labelPeriode) {
  const a = String(namaOutput ?? '').trim();
  const b = String(labelPeriode ?? '').trim();
  if (!a || !b) return null;
  return `${a}${PEMBATAS}${b}`;
}

// Pecah judul kembali menjadi { namaOutput, labelPeriode }.
//
// Pencocokan ini dipakai untuk mencari dokumen yang "kemungkinan besar" milik
// satu periode, jadi judul yang ambigu harus ditolak: tanpa pemisah, atau dengan
// pemisah lebih dari satu, tidak bisa dipastikan periode mana.
export function pecahJudulPeriode(judul) {
  const potong = String(judul ?? '').split(PEMBATAS);
  if (potong.length !== 2) return null;
  const namaOutput = potong[0].trim();
  const labelPeriode = potong[1].trim();
  if (!namaOutput || !labelPeriode) return null;
  return { namaOutput, labelPeriode };
}

// Kunci unik satu tautan: output + tahun + periode. Dipakai supaya satu
// dokumen tidak bisa diam-diam ditautkan ke dua periode berbeda.
export function kunciPeriode({ kertas_kerja_id, tahun, periode }) {
  if (!kertas_kerja_id || !tahun || !periode) return null;
  return `${kertas_kerja_id}:${tahun}:${periode}`;
}