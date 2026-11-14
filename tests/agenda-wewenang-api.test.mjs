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

test('Custom Nomor SPPD/SPT: cek ketersediaan nomor dan tolak duplikat saat pengambilan/edit nomor', async () => {
  const routes = {};
  const mockApp = {
    get: (path, handler) => { routes[`GET ${path}`] = handler; },
    post: (path, handler) => { routes[`POST ${path}`] = handler; },
    put: (path, handler) => { routes[`PUT ${path}`] = handler; },
    delete: () => {}
  };

  const sppdRecords = [
    {
      id: 1,
      tahun: 2026,
      jenis_sppd: 'LUAR_DAERAH',
      nomor_register: '001/SPPD-LD/2026',
      nomor_spt: '001/SPT/2026',
      nomor_sppd: '001/SPPD-LD/2026',
      pelaksana_nama: 'Achmad Aqil Susanto, S.Kom'
    }
  ];

  const mockQueryDB = async (sql, params = []) => {
    if (sql.includes('CREATE TABLE') || sql.includes('ALTER TABLE')) return [];
    if (sql.includes('FROM agenda_sppd') && (sql.includes('LOWER(TRIM(nomor_register))') || sql.includes('cek_nomor') || sql.includes('nomor_register =') || sql.includes('ILIKE'))) {
      // Check duplicate query
      const num = String(params[0] || '').trim().toLowerCase();
      const excludeId = params[1] ? Number(params[1]) : null;
      return sppdRecords.filter((r) => {
        if (excludeId && r.id === excludeId) return false;
        return (
          String(r.nomor_register || '').trim().toLowerCase() === num ||
          String(r.nomor_spt || '').trim().toLowerCase() === num ||
          String(r.nomor_sppd || '').trim().toLowerCase() === num
        );
      });
    }
    if (sql.includes('SELECT COUNT(*)::int as n FROM agenda_sppd')) {
      return [{ n: sppdRecords.length }];
    }
    if (sql.includes('INSERT INTO agenda_sppd')) {
      const item = {
        id: sppdRecords.length + 1,
        jenis_sppd: params[0],
        tahun: params[1],
        nomor_register: params[2],
        nomor_spt: params[3],
        nomor_sppd: params[4],
        pelaksana_nip: params[7],
        pelaksana_nama: params[8]
      };
      sppdRecords.push(item);
      return [item];
    }
    return [];
  };

  daftarkanRuteAgenda(mockApp, null, mockQueryDB);

  assert.ok(routes['GET /api/agenda/sppd/cek-nomor'], 'Rute GET /api/agenda/sppd/cek-nomor harus terdaftar');

  // 1. Cek nomor yang sudah terpakai -> exists: true
  let cekRes = null;
  await routes['GET /api/agenda/sppd/cek-nomor'](
    { query: { nomor: '001/SPPD-LD/2026' } },
    { json: (d) => { cekRes = d; }, status: function () { return this; } }
  );
  assert.equal(cekRes.ok, true);
  assert.equal(cekRes.exists, true);
  assert.equal(cekRes.conflict.pelaksana_nama, 'Achmad Aqil Susanto, S.Kom');

  // 2. Cek nomor baru yang belum terpakai -> exists: false
  await routes['GET /api/agenda/sppd/cek-nomor'](
    { query: { nomor: '099/SPPD-CUSTOM/2026' } },
    { json: (d) => { cekRes = d; }, status: function () { return this; } }
  );
  assert.equal(cekRes.ok, true);
  assert.equal(cekRes.exists, false);

  // 3. POST dengan nomor custom yang SUDAH ADA harus ditolak (HTTP 409)
  let postStatus = 200;
  let postRes = null;
  await routes['POST /api/agenda/sppd'](
    {
      body: {
        jenis_sppd: 'LUAR_DAERAH',
        tahun: 2026,
        nomor_register: '001/SPPD-LD/2026',
        pelaksana_nip: '19900101',
        pelaksana_nama: 'Pegawai Lain',
        maksud_perjalanan: 'Dinas',
        tempat_tujuan: 'Kupang',
        tanggal_berangkat: '2026-11-15',
        tanggal_kembali: '2026-11-16'
      }
    },
    {
      status: function (s) { postStatus = s; return this; },
      json: (d) => { postRes = d; }
    }
  );
  assert.equal(postStatus, 409);
  assert.equal(postRes.ok, false);
  assert.match(postRes.message, /sudah digunakan|sudah terdaftar|sudah ada/i);

  // 4. POST dengan nomor custom yang BELUM ADA harus berhasil disimpan sesuai nomor custom
  postStatus = 200;
  postRes = null;
  await routes['POST /api/agenda/sppd'](
    {
      body: {
        jenis_sppd: 'LUAR_DAERAH',
        tahun: 2026,
        nomor_register: '099/SPPD-CUSTOM/2026',
        nomor_spt: '099/SPT-CUSTOM/2026',
        nomor_sppd: '099/SPPD-CUSTOM/2026',
        pelaksana_nip: '19900101',
        pelaksana_nama: 'Pegawai Baru',
        maksud_perjalanan: 'Dinas Luar',
        tempat_tujuan: 'Kupang',
        tanggal_berangkat: '2026-11-15',
        tanggal_kembali: '2026-11-16'
      }
    },
    {
      status: function (s) { postStatus = s; return this; },
      json: (d) => { postRes = d; }
    }
  );
  assert.equal(postStatus, 200);
  assert.equal(postRes.ok, true);
  assert.equal(postRes.item.nomor_register, '099/SPPD-CUSTOM/2026');
  assert.equal(postRes.item.nomor_spt, '099/SPT-CUSTOM/2026');
});
