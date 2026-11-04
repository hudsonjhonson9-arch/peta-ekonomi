// Kebijakan hak akses per route.
//
// Format: daftar aturan berurutan; aturan pertama yang cocok menang. Semua pola
// di-anchor penuh (^...$) supaya tidak ada prefix yang bocor, misalnya /api/docs
// tidak boleh ikut cocok untuk /api/docs/bulk.
//
// NAZIV level:
//   PUBLIK    tanpa login
//   LOGIN     staf, reviewer, admin (dan operator hanya untuk allowlist bankdata)
//   BANKDATA  operator bank data dan admin
//   REVIEW    reviewer dan admin
//   ADMIN     admin saja
//
// Route yang tidak terdaftar tetap butuh LOGIN, bukan dibuka bebas. Jadi route
// baru default-nya tertutup dan harus memilih levelnya di sini dengan sadar.

export const PUBLIK = 'publik';
export const LOGIN = 'login';
export const BANKDATA = 'bankdata';
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
  t('GET', PUBLIK, '/api/publik/bankdata'),
  t('GET', PUBLIK, '/api/publik/bankdata/[^/]+'),
  t('GET', PUBLIK, '/api/publik/spm'),
  t('GET', PUBLIK, '/api/publik/konten'),
  t('POST', PUBLIK, '/api/publik/qna'),
  t('POST', PUBLIK, '/api/publik/visitor'),
  semua(PUBLIK, '/api/v1(/[^/]+)*'),
  semua(PUBLIK, '/api/documentation(/[^/]+)*'),
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
  t('POST', LOGIN, '/api/kertas-kerja/periode/[^/]+/tautan'),
  t('GET',  LOGIN, '/api/kertas-kerja/periode/[^/]+/kandidat'),
  t('GET',  LOGIN, '/api/kertas-kerja/jatim'),

  // ── Admin: pengguna & kelola role ──────────────────────────────────────
  semua(ADMIN, '/api/users(/[^/]+)*'),
  t('GET', LOGIN, '/api/roles'),
  semua(ADMIN, '/api/roles(/[^/]+)*'),

  // ── Bank Data: verifikasi dataset oleh Reviewer + Admin (mendahului aturan BANKDATA)
  t('GET',  REVIEW, '/api/bankdata/dataset/verifikasi'),
  t('POST', REVIEW, '/api/bankdata/dataset/[^/]+/verifikasi'),

  // ── Bank Data: struktur global OPD & Tahun hanya Admin ──────────────────
  t('POST',   ADMIN, '/api/bankdata/opd(/[^/]+)*'),
  t('PUT',    ADMIN, '/api/bankdata/opd(/[^/]+)*'),
  t('DELETE', ADMIN, '/api/bankdata/opd(/[^/]+)*'),
  t('POST',   ADMIN, '/api/bankdata/tahun(/[^/]+)*'),
  t('DELETE', ADMIN, '/api/bankdata/tahun(/[^/]+)*'),

  // ── Bank Data: baca untuk semua yang login, tulis untuk Operator + Admin (BANKDATA)
  t('GET',    LOGIN,    '/api/bankdata(/[^/]+)*'),
  t('POST',   BANKDATA, '/api/bankdata(/[^/]+)*'),
  t('PUT',    BANKDATA, '/api/bankdata(/[^/]+)*'),
  t('PATCH',  BANKDATA, '/api/bankdata(/[^/]+)*'),
  t('DELETE', BANKDATA, '/api/bankdata(/[^/]+)*'),

  // ── Satu Data: Master Data, Reopen, SPM, Kelola Konten, Monitoring ──────
  t('GET',    LOGIN,    '/api/satudata/master/ringkasan'),
  t('POST',   REVIEW,   '/api/satudata/reopen/[^/]+/putuskan'),
  t('POST',   BANKDATA, '/api/satudata/reopen'),
  semua(ADMIN, '/api/satudata/master(/[^/]+)*'),

  t('GET',    LOGIN,    '/api/spm'),
  t('GET',    LOGIN,    '/api/spm/arsip-pilihan'),
  semua(ADMIN, '/api/spm(/[^/]+)*'),

  t('GET',    LOGIN,    '/api/konten'),
  semua(ADMIN, '/api/konten(/[^/]+)*'),

  semua(ADMIN, '/api/monitoring(/[^/]+)*'),

  t('GET',    LOGIN,    '/api/roles'),
  t('GET',    LOGIN,    '/api/roles/permissions/meta'),
  t('GET',    LOGIN,    '/api/roles/[^/]+'),
  semua(ADMIN,          '/api/roles(/[^/]+)*'),

  t('GET', LOGIN, '/api/standar-harga'),
  // Daftar kode rekening distinct untuk dropdown "Kode rekening" (baca saja).
  t('GET', LOGIN, '/api/standar-harga/rekening'),
  t('POST', ADMIN, '/api/standar-harga/upload'),

  // Draft rincian: semua staf boleh susun rencana (keputusan user 2026-10-06)
  t('GET', LOGIN, '/api/draft-rincian'),
  t('POST', LOGIN, '/api/draft-rincian'),
  t('PUT', LOGIN, '/api/draft-rincian/[^/]+'),
  t('DELETE', LOGIN, '/api/draft-rincian/[^/]+'),

  // Screening RKA: inisiasi perubahan anggaran hanya Admin; riwayat dibuka
  // untuk semua staf (realisasi/pagu tetap lewat PUT pks = ADMIN).
  t('GET', LOGIN, '/api/screening/perubahan'),
  t('POST', ADMIN, '/api/screening/perubahan'),
  // Alur validasi sub kegiatan: staf mengajukan (Draft/Ditolak → Menunggu),
  // Admin memvalidasi (Disetujui — pagu & total rencana dicek server —,
  // Ditolak — catatan wajib —, atau kembalikan ke Draft).
  t('POST', LOGIN, '/api/screening/ajukan'),
  t('POST', ADMIN, '/api/screening/validasi'),

  // ── Admin: seluruh metode tulis pada modul master data ─────────────────
  ...MODUL_ADMIN.flatMap(awalan => [
    t('POST', ADMIN, `${awalan}(/[^/]+)*`),
    t('PUT', ADMIN, `${awalan}/[^/]+`),
    t('DELETE', ADMIN, `${awalan}/[^/]+`),
  ]),
];

// ── Aturan tambahan dari modul ─────────────────────────────────────────────
// Modul rute baru (akun, portal, dataset lanjutan, dst.) mendaftarkan aturannya
// sendiri lewat tambahAturan([...]) saat file modul di-import. Aturan modul
// diperiksa LEBIH DULU daripada ATURAN bawaan supaya pola spesifik modul tidak
// tertelan aturan umum seperti semua(ADMIN, '/api/monitoring(/[^/]+)*').
// Helper `aturan` dan `aturanSemua` sama dengan t() dan semua() di atas.
const ATURAN_MODUL = [];
export const aturan = t;
export const aturanSemua = semua;
export function tambahAturan(daftar = []) {
  ATURAN_MODUL.push(...daftar);
}

export function kebutuhan(method, path) {
  // Express memakai non-strict routing secara bawaan, jadi /api/users/ dan
  // /api/users ditangani handler yang sama. Pola di tabel harus meniru itu,
  // kalau tidak garis miring akhir menjadi celah melewati aturan admin.
  const p = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  for (const a of ATURAN_MODUL) {
    if (a.m && a.m !== method) continue;
    if (a.pola.test(p)) return a.lvl;
  }
  for (const a of ATURAN) {
    if (a.m && a.m !== method) continue;
    if (a.pola.test(p)) return a.lvl;
  }
  return LOGIN;
}

export function jalurOperatorDiizinkan(path) {
  const p = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  if (p === '/api/health' || p.startsWith('/api/auth/')) return true;
  // Akun sendiri (profil, ganti password), portal publik, dan dokumentasi API selalu boleh.
  if (p.startsWith('/api/akun/') || p === '/api/akun' || p.startsWith('/api/portal/')) return true;
  if (p.startsWith('/api/documentation') || p === '/api/documentation') return true;
  if (p.startsWith('/api/v1/') || p === '/api/v1') return true;
  if (p === '/api/notifications' || p.startsWith('/api/notifications/')) return true;
  if (p === '/api/bankdata' || p.startsWith('/api/bankdata/')) return true;
  if (p === '/api/spm' || p.startsWith('/api/spm/')) return true;
  if (p.startsWith('/api/dashboard/produsen')) return true;
  if (p === '/api/satudata/master/ringkasan' || p === '/api/satudata/reopen') return true;
  return false;
}

// Modul operasional perencanaan yang KHUSUS untuk internal BAPPERIDA Sumba Barat.
// Pengguna dari OPD lain di Kabupaten Sumba Barat TIDAK diperkenankan mengakses
// modul Dokumen, Screening RKA, Standar Harga, Draft Rincian, Kertas Kerja, dan PKS.
export function jalurKhususBapperida(path) {
  const p = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  if (p === '/api/docs' || p.startsWith('/api/docs/')) return true;
  if (p === '/api/screening' || p.startsWith('/api/screening/')) return true;
  if (p === '/api/standar-harga' || p.startsWith('/api/standar-harga/')) return true;
  if (p === '/api/draft-rincian' || p.startsWith('/api/draft-rincian/')) return true;
  if (p === '/api/kertas-kerja' || p.startsWith('/api/kertas-kerja/')) return true;
  if (p === '/api/pks' || p.startsWith('/api/pks/')) return true;
  return false;
}
