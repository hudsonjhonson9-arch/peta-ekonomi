import assert from 'node:assert/strict';
import { pembatasLaju } from './rate-limit.js';

// Import route modules agar aturan hak akses didaftarkan ke kebijakan
import './akun-routes.js';
import './portal-routes.js';
import './portal-konten-routes.js';
import './dataset-lanjutan-routes.js';
import './admin-lanjutan-routes.js';
import './pengaturan-situs-routes.js';

console.log('--- TEST PEMBATAS LAJU (RATE LIMITING) ---');
{
  let statusResult = 200;
  let jsonResult = null;
  const mockRes = {
    setHeader: () => {},
    status: (code) => {
      statusResult = code;
      return {
        json: (data) => { jsonResult = data; },
      };
    },
  };

  let nextCalled = false;
  const mockReq = {
    originalUrl: '/api/publik/test',
    headers: { 'x-forwarded-for': '192.168.1.100' },
  };

  pembatasLaju(mockReq, mockRes, () => { nextCalled = true; });
  assert.equal(nextCalled, true, 'Request pertama harus diteruskan');
  assert.equal(statusResult, 200, 'Status harus 200');
  console.log('  ok  pembatas laju menerima request normal');
}

console.log('--- TEST ATURAN HAK AKSES KEBIJAKAN ---');
import { kebutuhan, PUBLIK, LOGIN, ADMIN, BANKDATA, REVIEW } from './kebijakan.js';
{
  assert.equal(kebutuhan('POST', '/api/akun/lupa-password/cek'), PUBLIK, 'Lupa password cek harus publik');
  assert.equal(kebutuhan('POST', '/api/akun/lupa-password/reset'), PUBLIK, 'Lupa password reset harus publik');
  assert.equal(kebutuhan('GET', '/api/akun/profil'), LOGIN, 'Profil harus butuh login');
  assert.equal(kebutuhan('POST', '/api/akun/ganti-password'), LOGIN, 'Ganti password harus butuh login');

  assert.equal(kebutuhan('GET', '/api/portal/ringkasan'), PUBLIK, 'Portal ringkasan harus publik');
  assert.equal(kebutuhan('GET', '/api/portal/dataset'), PUBLIK, 'Portal dataset harus publik');
  assert.equal(kebutuhan('GET', '/api/portal/dataset/1'), PUBLIK, 'Portal dataset detail harus publik');
  assert.equal(kebutuhan('GET', '/api/portal/jelajah/urusan'), PUBLIK, 'Portal jelajah urusan harus publik');
  assert.equal(kebutuhan('GET', '/api/portal/visualisasi'), PUBLIK, 'Portal visualisasi harus publik');
  assert.equal(kebutuhan('GET', '/api/portal/captcha'), PUBLIK, 'Portal captcha harus publik');
  assert.equal(kebutuhan('GET', '/feed/berita.xml'), PUBLIK, 'RSS feed berita harus publik');
  assert.equal(kebutuhan('GET', '/sitemap.xml'), PUBLIK, 'Sitemap harus publik');
  assert.equal(kebutuhan('GET', '/manifest.webmanifest'), PUBLIK, 'Manifest PWA harus publik');

  assert.equal(kebutuhan('POST', '/api/bankdata/dataset/1/siklus'), BANKDATA, 'Buat siklus harus hak bankdata');
  assert.equal(kebutuhan('POST', '/api/bankdata/siklus/1/verifikasi'), REVIEW, 'Verifikasi siklus harus hak reviewer/admin');
  assert.equal(kebutuhan('PUT', '/api/admin/pengaturan/draft'), ADMIN, 'Pengaturan draft harus hak admin');
  assert.equal(kebutuhan('POST', '/api/admin/pengaturan/terbitkan'), ADMIN, 'Pengaturan terbitkan harus hak admin');

  console.log('  ok  seluruh aturan hak akses rute baru terverifikasi');
}

console.log('\nSEMUA UJI FITUR GAP SATUDATA BERHASIL DIVERIFIKASI!');
