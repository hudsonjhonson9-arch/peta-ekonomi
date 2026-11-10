import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBulanRomawi, formatNomorSuratKeluar, daftarkanRuteAgenda } from './agenda-routes.js';

test('formatBulanRomawi mengubah bulan 1-12 menjadi angka Romawi', () => {
  assert.equal(formatBulanRomawi(1), 'I');
  assert.equal(formatBulanRomawi(2), 'II');
  assert.equal(formatBulanRomawi(6), 'VI');
  assert.equal(formatBulanRomawi(11), 'XI');
  assert.equal(formatBulanRomawi(12), 'XII');
  // Fallbacks
  assert.equal(formatBulanRomawi(0), 'I');
  assert.equal(formatBulanRomawi(13), 'XII');
});

test('formatNomorSuratKeluar menghasilkan format resmi BAPPERIDA', () => {
  const no = formatNomorSuratKeluar('050', 142, 11, 2026);
  assert.equal(no, '050/0142/BAPPERIDA/XI/2026');

  const no2 = formatNomorSuratKeluar('900', 5, 1, 2026);
  assert.equal(no2, '900/0005/BAPPERIDA/I/2026');
});

test('daftarkanRuteAgenda mendaftarkan seluruh endpoint agenda ke Express app', () => {
  const routes = [];
  const fakeApp = {
    get: (path, handler) => routes.push({ method: 'GET', path, handler }),
    post: (path, handler) => routes.push({ method: 'POST', path, handler }),
    put: (path, handler) => routes.push({ method: 'PUT', path, handler }),
    delete: (path, handler) => routes.push({ method: 'DELETE', path, handler })
  };

  daftarkanRuteAgenda(fakeApp, {}, async () => []);

  const paths = routes.map(r => `${r.method} ${r.path}`);
  assert.ok(paths.includes('GET /api/agenda/surat-masuk'), 'harus ada GET /api/agenda/surat-masuk');
  assert.ok(paths.includes('POST /api/agenda/surat-masuk'), 'harus ada POST /api/agenda/surat-masuk');
  assert.ok(paths.includes('POST /api/agenda/surat-masuk/:id/disposisi'), 'harus ada POST disposisi');
  assert.ok(paths.includes('GET /api/agenda/surat-keluar'), 'harus ada GET /api/agenda/surat-keluar');
  assert.ok(paths.includes('GET /api/agenda/surat-keluar/preview-nomor'), 'harus ada preview nomor surat');
  assert.ok(paths.includes('POST /api/agenda/surat-keluar'), 'harus ada booking surat keluar');
  assert.ok(paths.includes('GET /api/agenda/sppd'), 'harus ada GET /api/agenda/sppd');
  assert.ok(paths.includes('POST /api/agenda/sppd'), 'harus ada POST /api/agenda/sppd');
  assert.ok(paths.includes('POST /api/agenda/sppd/:id/lhp'), 'harus ada upload LHP');
  assert.ok(paths.includes('POST /api/agenda/sppd/:id/spj'), 'harus ada upload SPJ');
});
