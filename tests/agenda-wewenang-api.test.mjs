import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WEWENANG, daftarkanRuteAgenda } from '../server/agenda-routes.js';

test('DEFAULT_WEWENANG: memiliki konfigurasi lengkap kepala, sekretaris, bidang, ktu, dan 3 paraf', () => {
  assert.ok(DEFAULT_WEWENANG, 'DEFAULT_WEWENANG harus diekspor');
  assert.equal(DEFAULT_WEWENANG.kepala.status, 'Definitif');
  assert.ok(DEFAULT_WEWENANG.kepala.nama, 'Kepala memiliki nama');
  assert.ok(DEFAULT_WEWENANG.kepala.nip, 'Kepala memiliki NIP');
  assert.ok(DEFAULT_WEWENANG.sekretaris.nama, 'Sekretaris memiliki nama');
  assert.ok(DEFAULT_WEWENANG.bidang.nama, 'Bidang memiliki nama');
  assert.equal(DEFAULT_WEWENANG.paraf.length, 3, 'Memiliki 3 paraf hierarki');
});

test('daftarkanRuteAgenda: mendaftarkan GET dan POST /api/agenda/wewenang', async () => {
  const routes = {};
  const mockApp = {
    get: (path, handler) => { routes[`GET ${path}`] = handler; },
    post: (path, handler) => { routes[`POST ${path}`] = handler; },
    put: (path, handler) => { routes[`PUT ${path}`] = handler; },
    delete: () => {}
  };

  let dbStore = {};
  const mockQueryDB = async (sql, params) => {
    if (sql.includes('SELECT value FROM agenda_pengaturan_wewenang')) {
      if (dbStore.sppd_wewenang) {
        return { rows: [{ value: dbStore.sppd_wewenang }] };
      }
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO agenda_pengaturan_wewenang')) {
      const parsed = JSON.parse(params[0]);
      dbStore.sppd_wewenang = parsed;
      return { rows: [{ value: parsed }] };
    }
    return { rows: [] };
  };

  daftarkanRuteAgenda(mockApp, null, mockQueryDB);

  assert.ok(routes['GET /api/agenda/wewenang'], 'Rute GET /api/agenda/wewenang terdaftar');
  assert.ok(routes['POST /api/agenda/wewenang'], 'Rute POST /api/agenda/wewenang terdaftar');

  // Test GET default
  let resJson = null;
  const mockResGet = {
    json: (data) => { resJson = data; }
  };
  await routes['GET /api/agenda/wewenang']({}, mockResGet);
  assert.equal(resJson.success, true);
  assert.equal(resJson.data.kepala.nama, DEFAULT_WEWENANG.kepala.nama);

  // Test POST update
  const updatedPayload = {
    kepala: {
      status: 'Plt.',
      nama: 'PEJABAT BARU, S.STP',
      nip: '19850101 201001 1 002'
    }
  };
  let postJson = null;
  const mockResPost = {
    json: (data) => { postJson = data; },
    status: () => mockResPost
  };
  await routes['POST /api/agenda/wewenang']({ body: updatedPayload }, mockResPost);
  assert.equal(postJson.success, true);
  assert.equal(postJson.data.kepala.status, 'Plt.');
  assert.equal(postJson.data.kepala.nama, 'PEJABAT BARU, S.STP');

  // Test GET setelah update
  await routes['GET /api/agenda/wewenang']({}, mockResGet);
  assert.equal(resJson.data.kepala.nama, 'PEJABAT BARU, S.STP');
});
