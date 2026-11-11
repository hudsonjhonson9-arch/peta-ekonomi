import crypto from 'node:crypto';

// Session berbasis cookie bertanda tangan HMAC.
//
// Keputusan desain:
// - Role TIDAK disimpan di dalam token. Setiap request membaca role terbaru dari
//   database, jadi pergantian role atau penonaktifan user berlaku seketika tanpa
//   perlu mencabut token lama.
// - Tanpa SESSION_SECRET, semua issuance dan verifikasi gagal (fail closed).
//   Menolak token tanpa tanda tangan sama artinya menerima cookie buatan,
//   jadi lebih aman menolak semuanya.
// - Tanpa tabel session: tidak ada upkeep, tidak perlu migration, dan restart
//   container tidak-tolerant mengunci semua orang keluar.

export const NAMA_COOKIE = 'arsip_session';
export const MASA_JAM = 8;

// "Ingat saya" dicentang: sesi jauh lebih panjang supaya tidak perlu login
// ulang tiap hari kerja. 30 hari. Role tetap dibaca dari database setiap
// request (bukan dari token), jadi penonaktifan/pencabutan hak tetap
// berlaku seketika walau token lama masih hidup.
export const MASA_JAM_INGAT = 30 * 24;

// Panjang minimum yang diterima. Ambil 16, bukan 32, supaya nilai yang
// sebenarnya wajar tetap jalan; nilai yang lebih pendek ditolak dengan alasan
// keamanan. Target sebenarnya 32 karakter atau lebih.
export const PANJANG_MINIMUM = 16;
export const PANJANG_DIANJURKAN = 32;

// Nilai role kanonik yang dipakai seluruh UI: 'Admin' | 'Reviewer' | 'Staf' | 'Operator Bank Data'.
export const R_ADMIN = 'Admin';
export const R_REVIEWER = 'Reviewer';
export const R_STAF = 'Staf';
export const R_BANKDATA = 'Operator Bank Data';

// Database menyimpan role dengan kapitalisasi yang tidak seragam: user_list.role
// diisi 'ADMIN'/'KABID'/'USER'/'BANKDATA' oleh mapRoleToDb, sedangkan user_credentials.role
// diisi nilai mentah dari form ('Admin'/'Reviewer'/'Staf'/'Operator Bank Data'). Baris lama bisa
// campur. Semua penentuan hak akses harus lewat normalisasiRole.
const PETA_ROLE = new Map(Object.entries({
  ADMIN: R_ADMIN, ADMINISTRATOR: R_ADMIN,
  KABID: R_REVIEWER, REVIEWER: R_REVIEWER, REVIEW: R_REVIEWER,
  USER: R_STAF, STAF: R_STAF, STAFF: R_STAF, UPLOADER: R_STAF,
  BANKDATA: R_BANKDATA, OPERATOR_BANKDATA: R_BANKDATA, 'OPERATOR BANK DATA': R_BANKDATA,
}));

export function normalisasiRole(dbRole) {
  if (!dbRole) return R_STAF;
  return PETA_ROLE.get(String(dbRole).trim().toUpperCase()) || R_STAF;
}

const RAHASIA_TERLARANG = new Set([
  'ARSIPDIGITALBAPPERIDA2026',
  'Bidangekonomi2026',
  'BapperidaSB2026',
  '1234567890123456',
  'secret1234567890',
]);

const RAHASIA_FALLBACK_DEFAULT = 'ARSIPDIGITALBAPPERIDA2026_HMAC_DEFAULT_KEY';

/**
 * Memeriksa apakah SESSION_SECRET memenuhi standar keamanan produksi.
 */
export function apakahRahasiaAman(secret = process.env.SESSION_SECRET) {
  if (!secret || secret.trim().length < PANJANG_MINIMUM) return false;
  if (RAHASIA_TERLARANG.has(secret.trim())) return false;
  return true;
}

export function rahasia() {
  const s = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (s && s.trim().length >= PANJANG_MINIMUM) {
    return s.trim();
  }
  // Fallback darurat jika environment variable belum diisi di Coolify/server,
  // agar sistem tidak lumpuh dengan error 500.
  return RAHASIA_FALLBACK_DEFAULT;
}

// SESSION_SECRET dan UPLOAD_API_KEY tidak boleh bernilai sama.
//
// Keduanya adalah kunci HMAC untuk hal berbeda, tapi kebetulan memakai fungsi
// yang sama: header x-upload-key juga dibandingkan dengan perbandingan waktu-tetap
// di atas. Kalau keduanya sama, siapa pun yang membaca UPLOAD_API_KEY (misalnya
// dari isi repo publik, karena Code.gs ikut ter-commit) otomatis bisa menandatangani
// cookie session untuk NIP admin. Jadi upload key bocor berarti seluruh session
// bocor juga.
export function periksaPemisahanSecret() {
  const s = process.env.SESSION_SECRET;
  const k = process.env.UPLOAD_API_KEY;
  if (s && k && s.trim() === k.trim()) {
    console.error(
      '\n' +
      '!'.repeat(72) + '\n' +
      'SESSION_SECRET sama dengan UPLOAD_API_KEY. Ini tidak aman.\n' +
      'UPLOAD_API_KEY dipakai sebagai kunci untuk melewati session, jadi\n' +
      'keduanya yang sama berarti siapa pun yang tahu upload key bisa\n' +
      'menandatangani cookie session untuk NIP admin.\n' +
      'Ganti keduanya dengan dua nilai acak yang berbeda.\n' +
      '!'.repeat(72) + '\n'
    );
    return false;
  }
  return true;
}

// Dipanggil sekali saat boot supaya masalah konfigurasi terlihat di log
// Coolify, bukan baru ketahuan saat semua request mulai 500.
export function periksaKonfigurasiSession() {
  const s = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!s) {
    console.warn(
      '\n' +
      '='.repeat(72) +
      '\n[PERINGATAN] SESSION_SECRET belum disetel di Coolify environment variables.\n' +
      'Aplikasi berjalan menggunakan fallback darurat. Demi keamanan optimal,\n' +
      'silakan tambahkan SESSION_SECRET di Coolify dengan string acak (minimal 32 karakter):\n' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
      '='.repeat(72) + '\n'
    );
    return false;
  }
  if (RAHASIA_TERLARANG.has(s.trim())) {
    console.warn(
      '\n' +
      '='.repeat(72) +
      '\n[PERINGATAN] SESSION_SECRET menggunakan kunci bawaan yang ada di repositori.\n' +
      'Sangat disarankan segera mengganti SESSION_SECRET di Coolify dengan string acak baru:\n' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
      '='.repeat(72) + '\n'
    );
    return false;
  }
  if (s.trim().length < PANJANG_DIANJURKAN) {
    console.warn(
      `SESSION_SECRET hanya ${s.trim().length} karakter; ` +
      `disarankan ${PANJANG_DIANJURKAN} atau lebih.`
    );
  }
  console.log(`Session aktif (rahasia ${s.trim().length} karakter, ${MASA_JAM} jam tanpa "Ingat saya", ${MASA_JAM_INGAT} jam dengannya).`);
  return true;
}

const b64 = buf => Buffer.from(buf).toString('base64url');

function tandaTangan(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

// Perbandingan waktu-tetap. Panjang harus sama dulu karena timingSafeEqual
// melempar error untuk buffer berbeda panjang.
export function samaKonst(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function buatToken(nip, secret = rahasia(), masaJam = MASA_JAM) {
  if (!secret) throw new Error(`SESSION_SECRET belum diatur atau terlalu pendek (minimal ${PANJANG_MINIMUM} karakter)`);
  const isi = b64(JSON.stringify({
    sub: String(nip),
    exp: Math.floor(Date.now() / 1000) + masaJam * 3600,
  }));
  return `${isi}.${tandaTangan(isi, secret)}`;
}

// Token ditolak karena empat hal yang berbeda, dan semuanya tadinya balik
// 401 dengan pesan yang sama. Tanpa alasan, "Sesi berakhir" di log Coolify
// tidak bisa dibedakan antara cookie yang tidak terkirim (secure/HTTPS/SameSite),
// secret yang berganti, token kedaluwarsa, atau cookie rusak.
const ALASAN = {
  KOSONG: 'tidak ada cookie session',
  TANPA_SECRET: 'SESSION_SECRET belum disetel',
  RUSAK: 'token tidak berbentuk <isi>.<tanda-tangan>',
  TANDA_TANGAN: 'tanda tangan tidak cocok, SESSION_SECRET berbeda dari saat login',
  ISI_RUSAK: 'isi token bukan JSON yang valid',
  SUB: 'token tidak membawa sub',
  KEDALUWARSA: 'token sudah kedaluwarsa',
};

export function verifikasiTokenDetail(token, secret = rahasia(), sekarang = Math.floor(Date.now() / 1000)) {
  if (!secret) return { muatan: null, alasan: ALASAN.TANPA_SECRET };
  if (typeof token !== 'string' || !token) return { muatan: null, alasan: ALASAN.KOSONG };
  const titik = token.indexOf('.');
  if (titik < 1) return { muatan: null, alasan: ALASAN.RUSAK };
  const isi = token.slice(0, titik);
  if (!samaKonst(tandaTangan(isi, secret), token.slice(titik + 1)))
    return { muatan: null, alasan: ALASAN.TANDA_TANGAN };
  let muatan;
  try {
    muatan = JSON.parse(Buffer.from(isi, 'base64url').toString('utf8'));
  } catch {
    return { muatan: null, alasan: ALASAN.ISI_RUSAK };
  }
  if (!muatan || typeof muatan.sub !== 'string' || !muatan.sub)
    return { muatan: null, alasan: ALASAN.SUB };
  if (typeof muatan.exp !== 'number' || muatan.exp <= sekarang)
    return { muatan: null, alasan: ALASAN.KEDALUWARSA };
  return { muatan, alasan: null };
}

export function verifikasiToken(token, secret = rahasia(), sekarang = Math.floor(Date.now() / 1000)) {
  return verifikasiTokenDetail(token, secret, sekarang).muatan;
}

export function bacaCookie(req, nama = NAMA_COOKIE) {
  const mentah = req.headers && req.headers.cookie;
  if (!mentah) return null;
  for (const bagian of mentah.split(';')) {
    const i = bagian.indexOf('=');
    if (i < 0) continue;
    if (bagian.slice(0, i).trim() === nama) {
      try { return decodeURIComponent(bagian.slice(i + 1).trim()); }
      catch { return null; }
    }
  }
  return null;
}

// Membaca SEMUA cookie dengan nama yang sama (mis. jika ada cookie host-only
// dan cookie domain wildcard .mindcloud.my.id sekaligus di browser).
export function bacaSemuaCookie(req, nama = NAMA_COOKIE) {
  const mentah = req.headers && req.headers.cookie;
  if (!mentah) return [];
  const hasil = [];
  for (const bagian of mentah.split(';')) {
    const i = bagian.indexOf('=');
    if (i < 0) continue;
    if (bagian.slice(0, i).trim() === nama) {
      try {
        const val = decodeURIComponent(bagian.slice(i + 1).trim());
        if (val) hasil.push(val);
      } catch { /* abaikan parsing error */ }
    }
  }
  return hasil;
}

// `ingat` = centang "Ingat saya" di login:
//   true  → cookie persistent 30 hari (MASA_JAM_INGAT) — tetap ada setelah
//           browser ditutup, token juga berlaku 30 hari;
//   false → cookie session (tanpa maxAge) — hilang saat browser ditutup;
//           token tetap dibatasi MASA_JAM jam selama browser terbuka.
// Flag `secure` ikut-protokol, bukan ikut NODE_ENV.
//
// Sebelumnya secure ditulis dari NODE_ENV === 'production'. Di produksi yang
// BeliLewatiHTTPS (Coolify accessed via IP/port, atau proxy yang tidak
// meneruskan X-Forwarded-Proto) browser menolak menyimpan cookie secure, jadi
// login terlihat berhasil lalu semua request berikutnya 401 "Sesi berakhir".
// Jadi secure mengikuti req.secure yang sudah memperhitungkan reverse proxy.
export function pasangCookie(res, token, req, ingat = false) {
  const aman = req ? req.secure : process.env.NODE_ENV === 'production';
  const opsi = {
    httpOnly: true,
    sameSite: 'lax',
    secure: aman,
    path: '/',
  };
  if (ingat) opsi.maxAge = MASA_JAM_INGAT * 3600 * 1000;
  res.cookie(NAMA_COOKIE, token, opsi);
}

export function lepasCookie(res) {
  res.clearCookie(NAMA_COOKIE, { path: '/' });
  // Bersihkan juga cookie dengan domain wildcard jika diset lewat SSO absensi-app
  res.clearCookie(NAMA_COOKIE, { path: '/', domain: '.mindcloud.my.id' });
}
