// Kebijakan hak akses per route.
//
// Format: daftar aturan berurutan; aturan pertama yang cocok menang. Semua pola
// di-anchor penuh (^...$) supaya tidak ada prefix yang bocor, misalnya /api/docs
// tidak boleh ikut cocok untuk /api/docs/bulk.
//
//NAZIV level:
//   PUBLIK  tanpa login
//   LOGIN   staf, reviewer, admin
//   REVIEW  reviewer dan admin
//   ADMIN   admin saja
//
// Route yang tidak terdaftar tetap butuh LOGIN, bukan dibuka bebas. Jadi route
// baru default-nya tertutup dan harus memilih levelnya di sini dengan sadar.

export const PUBLIK = 'publik';
export const LOGIN = 'login';
export const REVIEW = 'review';
export const ADMIN = 'admin';

// Modul yang seluruh perubahan datanya hak aksesnya admin.
const MODUL_ADMIN = ['/api/kategori-dokumen', '/api/sektor', '/api/indikator', '/api/nilai'];

const t = (m, lvl, pola) => ({ m, lvl, pola: new RegExp(`^${pola}$`) });
const semua = (lvl, pola) => ({ m: null, lvl, pola: new RegExp(`^${pola}$`) });

const ATURAN = [
  // ── Publik ──────────────────────────────────────────────────────────────
  t('GET', PUBLIK, '/api/health'),
  t('POST', PUBLIK, '/api/auth/login'),
  t('GET', PUBLIK, '/api/publik'),
  t('GET', PUBLIK, '/api/publik/verify'),
  // Upload dokumen butuh login. Integrator server-to-server dengan
  // UPLOAD_API_KEY boleh tanpa session; pengecekannya di luar tabel ini
  // karena bergantung pada env, lihat izinkanLewatiUpload di server/index.js.
  t('POST', LOGIN, '/api/docs'),

  // ── Admin: harus mendahului aturan umum /api/docs/:id ──────────────────
  t('POST', ADMIN, '/api/docs/bulk'),
  t('DELETE', ADMIN, '/api/docs/[^/]+'),
  t('PATCH', ADMIN, '/api/docs/[^/]+/publik'),
  semua(ADMIN, '/api/docs/[^/]+/shares(/[^/]+)*'),
  t('GET', ADMIN, '/api/logs'),

  // ── Reviewer + admin: tindakan review dan pembuatan versi ──────────────
  t('PATCH', REVIEW, '/api/docs/[^/]+/status'),
  t('PUT', REVIEW, '/api/docs/[^/]+'),
  t('POST', REVIEW, '/api/docs/[^/]+/content'),
  t('POST', REVIEW, '/api/docs/[^/]+/versions'),
  t('POST', REVIEW, '/api/docs/[^/]+/versions/[^/]+/restore'),
  t('POST', REVIEW, '/api/notifications'),

  // ── Admin: struktur PKS dan output ──────────────────────────────────────
  t('POST', ADMIN, '/api/pks/[^/]+'),
  t('PUT', ADMIN, '/api/pks/[^/]+/[^/]+'),
  t('DELETE', ADMIN, '/api/pks/[^/]+/[^/]+'),
  t('POST', ADMIN, '/api/kertas-kerja'),
  // Wajib ditulis eksplisit: pola di tabel di-anchor penuh, jadi
  // /api/kertas-kerja/bulk tidak akan cocok dengan /api/kertas-kerja dan
  // jatuh ke default LOGIN. Padahal membuat output adalah hak admin.
  t('POST', ADMIN, '/api/kertas-kerja/bulk'),
  t('POST', ADMIN, '/api/kertas-kerja/pengingat'),
  t('PUT', ADMIN, '/api/kertas-kerja/[^/]+'),
  t('DELETE', ADMIN, '/api/kertas-kerja/[^/]+'),
  t('POST', ADMIN, '/api/kertas-kerja/[^/]+/generate'),
  t('POST', ADMIN, '/api/kertas-kerja/[^/]+/sinkron-wajib'),

  // ── Staf: mengisi periode Kertas Kerja ──────────────────────────────────
  // Mengunggah bukti dukung dan mencari dokumen yang sudah ada bukan
  // perubahan struktur, jadi levelnya LOGIN — sama seperti PATCH periode di
  // bawahnya yang tidak terdaftar dan jatuh ke default LOGIN.
  //
  // Menautkan dokumen yang sudah dipakai periode lain tetap ditolak server
  // dengan 409, jadi membuka endpoint ini tidak menciptakan tautan ganda.
  t('POST', LOGIN, '/api/kertas-kerja/periode/[^/]+/tautan'),
  t('GET',  LOGIN, '/api/kertas-kerja/periode/[^/]+/kandidat'),
  t('GET',  LOGIN, '/api/kertas-kerja/jatim'),

  // ── Admin: pengguna dan bank data ───────────────────────────────────────
  // '(/x)*' dipakai supaya sub-path di semua tingkat ikut tertutup:
  // /api/users, /api/users/4, /api/bankdata/opd, /api/bankdata/iku/5.
  semua(ADMIN, '/api/users(/[^/]+)*'),

  // Baca bank data boleh untuk semua user yang sudah login. Halaman ini memang
  // punya tampilan read-only untuk non-admin (BankDataReadOnly di App.jsx),
  // jadi menutup bacanya jadi admin membuat halaman tersebut tidak pernah
  // berisi apa-apa — dan sebelum aturan ini ada, bacanya jatuh ke default LOGIN
  // dan justru bisa dipakai. Tulis tetap admin.
  //
  // Methodenya ditulis satu per satu, bukan pakai semua(), karena default-nya
  // LOGIN: pola umum tanpa PENULISAN eksplisit akan membuka POST/PUT/DELETE.
  t('GET', LOGIN, '/api/bankdata(/[^/]+)*'),
  t('POST', ADMIN, '/api/bankdata(/[^/]+)*'),
  t('PUT', ADMIN, '/api/bankdata(/[^/]+)*'),
  t('PATCH', ADMIN, '/api/bankdata(/[^/]+)*'),
  t('DELETE', ADMIN, '/api/bankdata(/[^/]+)*'),
  t('GET', LOGIN, '/api/standar-harga'),
  t('POST', ADMIN, '/api/standar-harga/upload'),

  // ── Admin: seluruh metode tulis pada modul master data ─────────────────
  ...MODUL_ADMIN.flatMap(awalan => [
    t('POST', ADMIN, `${awalan}(/[^/]+)*`),
    t('PUT', ADMIN, `${awalan}/[^/]+`),
    t('DELETE', ADMIN, `${awalan}/[^/]+`),
  ]),
];

export function kebutuhan(method, path) {
  // Express memakai non-strict routing secara bawaan, jadi /api/users/ dan
  // /api/users ditangani handler yang sama. Pola di tabel harus meniru itu,
  // kalau tidak garis miring akhir menjadi celah melewati aturan admin.
  const p = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  for (const a of ATURAN) {
    if (a.m && a.m !== method) continue;
    if (a.pola.test(p)) return a.lvl;
  }
  return LOGIN;
}