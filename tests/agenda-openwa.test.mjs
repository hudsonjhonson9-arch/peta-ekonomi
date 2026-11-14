import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDisposisiText,
  buildSuratKeluarText,
  buildSuratMasukText,
  openwaSender,
  parseMediaFromUrl,
} from '../server/openwa.js';
import { daftarkanRuteAgenda } from '../server/agenda-routes.js';

test('parseMediaFromUrl: Data URL diurai jadi base64 + mime + filename, URL https tetap url', () => {
  const img = parseMediaFromUrl('data:image/jpeg;base64,abc123==', 'surat');
  assert.deepEqual(img, { base64: 'abc123==', mime: 'image/jpeg', filename: 'surat.jpeg' });

  const pdf = parseMediaFromUrl('data:application/pdf;base64,JVBERi0=', 'lampiran.pdf');
  assert.deepEqual(pdf, { base64: 'JVBERi0=', mime: 'application/pdf', filename: 'lampiran.pdf' });

  const link = parseMediaFromUrl('https://drive.google.com/file/d/123/view', 'x');
  assert.deepEqual(link, { url: 'https://drive.google.com/file/d/123/view' });

  assert.equal(parseMediaFromUrl(''), null);
});

test('builder teks agenda surat masuk, disposisi, dan surat keluar', () => {
  const sm = buildSuratMasukText({
    nomor_agenda: '0001/SM/2026',
    nomor_surat_asli: '005/123',
    tanggal_surat: '2026-11-14',
    tanggal_terima: '2026-11-14',
    asal_surat: 'Setda',
    sifat: 'Penting',
    perihal: 'Undangan Rapat',
    created_by: 'TU',
  });
  assert.match(sm, /SURAT MASUK BARU/);
  assert.match(sm, /0001\/SM\/2026/);
  assert.match(sm, /Undangan Rapat/);

  const disp = buildDisposisiText({
    surat: { nomor_agenda: '0001/SM/2026', nomor_surat_asli: '005/123', asal_surat: 'Setda', perihal: 'Undangan Rapat' },
    disposisi: {
      pemberi_disposisi: 'Kepala BAPPERIDA',
      tanggal_disposisi: '2026-11-14',
      diteruskan_kepada: ['Sekretaris', 'Kabid PPEP'],
      arahan: ['Tindak Lanjuti'],
      catatan_instruksi: 'Hadiri tepat waktu',
      status_tindaklanjut: 'Didisposisikan',
    },
  });
  assert.match(disp, /DISPOSISI SURAT MASUK/);
  assert.match(disp, /Sekretaris, Kabid PPEP/);
  assert.match(disp, /Hadiri tepat waktu/);

  const sk = buildSuratKeluarText({
    nomor_surat: 'BAPPERIDA.011.7/53.12/0001/XI/2026',
    nomor_agenda: '0001/SK/2026',
    tanggal_surat: '2026-11-14',
    tujuan_surat: 'Bupati',
    bidang_pengonsep: 'PPEP',
    penandatangan: 'Kepala Badan',
    status: 'Draf',
    perihal: 'Laporan RKPD',
  });
  assert.match(sk, /SURAT KELUAR BARU/);
  assert.match(sk, /Laporan RKPD/);
});

test('openwaSender: resolve session + kirim document & text', async () => {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/api/sessions')) {
      calls.push({ url: u });
      return { ok: true, json: async () => [{ id: 'sid-1', name: 'notifbapperida' }] };
    }
    calls.push({ url: u, body: JSON.parse(opts.body) });
    return { ok: true, json: async () => ({ messageId: 'm1' }) };
  };
  try {
    const send = openwaSender({ url: 'https://openwa.test', apiKey: 'k', session: 'notifbapperida', chatId: 'grup@g.us' });
    await send({ text: 'tes', media: { base64: 'JVBERi0=', mime: 'application/pdf', filename: 'a.pdf' } });
    assert.equal(calls[1].url, 'https://openwa.test/api/sessions/sid-1/messages/send-document');
    assert.equal(calls[1].body.caption, 'tes');
    assert.equal(calls[1].body.filename, 'a.pdf');
  } finally {
    globalThis.fetch = real;
  }
});

test('daftarkanRuteAgenda: surat-masuk dan disposisi baru memicu sendWA beserta lampiran Data URL', async () => {
  const routes = {};
  const waSent = [];
  const app = {
    get: () => {},
    post: (p, h) => { routes[`POST ${p}`] = h; },
    put: () => {},
    delete: () => {},
  };
  const queryDB = async (sql) => {
    if (sql.includes('COUNT(*)::int')) return [{ n: 0 }];
    if (sql.includes('INSERT INTO agenda_surat_masuk')) {
      return [{
        id: 10,
        nomor_agenda: '0001/SM/2026',
        nomor_surat_asli: '005/99',
        tanggal_surat: '2026-11-14',
        tanggal_terima: '2026-11-14',
        asal_surat: 'Dinas Kominfo',
        perihal: 'Rapat SPBE',
        sifat: 'Penting',
        file_url: 'data:application/pdf;base64,JVBERi0=',
        file_name: 'undangan.pdf',
        created_by: 'TU',
      }];
    }
    if (sql.includes('INSERT INTO agenda_disposisi')) {
      return [{
        id: 21,
        surat_masuk_id: 10,
        tanggal_disposisi: '2026-11-14',
        pemberi_disposisi: 'Kepala BAPPERIDA',
        arahan: ['Tindak Lanjuti'],
        catatan_instruksi: 'Siapkan bahan',
        diteruskan_kepada: ['Sekretaris'],
        status_tindaklanjut: 'Didisposisikan',
      }];
    }
    if (sql.includes('FROM agenda_surat_masuk WHERE id =')) {
      return [{
        nomor_agenda: '0001/SM/2026',
        nomor_surat_asli: '005/99',
        asal_surat: 'Dinas Kominfo',
        perihal: 'Rapat SPBE',
        file_url: 'data:application/pdf;base64,JVBERi0=',
        file_name: 'undangan.pdf',
      }];
    }
    return [];
  };
  const pool = { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) };

  daftarkanRuteAgenda(app, pool, queryDB, { sendWA: async m => waSent.push(m) });

  const makeRes = () => ({ statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });

  await routes['POST /api/agenda/surat-masuk']({
    body: { nomor_surat_asli: '005/99', asal_surat: 'Dinas Kominfo', perihal: 'Rapat SPBE', file_url: 'data:application/pdf;base64,JVBERi0=', file_name: 'undangan.pdf' },
    session: { user: { nama: 'TU' } },
  }, makeRes());

  await routes['POST /api/agenda/surat-masuk/:id/disposisi']({
    params: { id: '10' },
    body: { diteruskan_kepada: ['Sekretaris'], arahan: ['Tindak Lanjuti'], catatan_instruksi: 'Siapkan bahan' },
  }, makeRes());

  await new Promise(r => setTimeout(r, 10));
  assert.equal(waSent.length, 2);
  assert.match(waSent[0].text, /SURAT MASUK BARU/);
  assert.equal(waSent[0].media.mime, 'application/pdf');
  assert.match(waSent[1].text, /DISPOSISI SURAT MASUK/);
  assert.equal(waSent[1].media.filename, 'undangan.pdf');
});

