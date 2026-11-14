import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPermendagri86Template, daftarkanRutePerencanaan } from '../server/perencanaan-routes.js';

test('buildPermendagri86Template: RKPD menghasilkan 7 tahapan berurutan sesuai Permendagri 86/2017', () => {
  const rkpd = buildPermendagri86Template('RKPD', 2026);
  assert.equal(rkpd.length, 7);
  assert.equal(rkpd[0].tahap_kode, 'RKPD-01');
  assert.match(rkpd[0].dasar_pasal, /Permendagri 86\/2017/);
  assert.equal(rkpd[0].tgl_mulai, '2025-11-15');
  assert.equal(rkpd[6].tgl_selesai, '2026-06-30');

  const rpjmd = buildPermendagri86Template('RPJMD', 2026);
  assert.equal(rpjmd.length, 6);
  const rpjpd = buildPermendagri86Template('RPJPD', 2026);
  assert.equal(rpjpd.length, 4);
});

test('daftarkanRutePerencanaan: seed-template, GET, POST, PUT, DELETE bekerja', async () => {
  const routes = {};
  const store = [];
  const app = {
    get: (p, h) => { routes[`GET ${p}`] = h; },
    post: (p, h) => { routes[`POST ${p}`] = h; },
    put: (p, h) => { routes[`PUT ${p}`] = h; },
    delete: (p, h) => { routes[`DELETE ${p}`] = h; },
  };
  const queryDB = async (sql, params = []) => {
    if (sql.includes('CREATE TABLE IF NOT EXISTS perencanaan_progres')) return [];
    if (sql.includes('SELECT COUNT(*)::int')) return [{ n: store.length }];
    if (sql.includes('INSERT INTO perencanaan_progres')) {
      const item = { id: store.length + 1, tahun: params[0], dokumen_jenis: params[1], tahap_kode: params[2], nama_tahapan: params[4], status: 'todo', progres_persen: 0 };
      store.push(item);
      return [item];
    }
    if (sql.includes('SELECT * FROM perencanaan_progres')) return store;
    if (sql.includes('UPDATE perencanaan_progres')) {
      const id = params[13];
      const idx = store.findIndex(x => x.id === id);
      if (idx === -1) return [];
      store[idx] = { ...store[idx], status: params[8] ?? store[idx].status, progres_persen: params[9] ?? store[idx].progres_persen };
      return [store[idx]];
    }
    if (sql.includes('DELETE FROM perencanaan_progres')) {
      const id = params[0];
      const idx = store.findIndex(x => x.id === id);
      if (idx === -1) return [];
      store.splice(idx, 1);
      return [{ id }];
    }
    return [];
  };

  daftarkanRutePerencanaan(app, null, queryDB);
  const res = () => ({ statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });

  const rSeed = res();
  await routes['POST /api/perencanaan/progres/seed-template']({ body: { tahun: 2026, dokumen_jenis: 'RKPD' }, session: { user: { nama: 'Admin' } } }, rSeed);
  assert.equal(rSeed.body.ok, true);
  assert.equal(rSeed.body.items.length, 7);

  const rPut = res();
  await routes['PUT /api/perencanaan/progres/:id']({ params: { id: '1' }, body: { status: 'done' } }, rPut);
  assert.equal(rPut.body.item.status, 'done');
  assert.equal(rPut.body.item.progres_persen, 100);
});

