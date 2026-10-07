// Uji helper alur validasi Screening RKA. Jalankan: node server/screening.uji.mjs

import assert from 'node:assert/strict';
import { ajukanDari, validasiStatus, cekSetujui, STATUS_SCREENING } from './screening.js';

let lulus = 0;
const uji = (nama, fn) => {
  try { fn(); lulus++; console.log(`  ok  ${nama}`); }
  catch (e) { console.error(`  GAGAL  ${nama}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('ajukanDari');

// 1. draft & ditolak → menunggu (inti alur: revisi boleh diajukan ulang).
uji('draft/ditolak → menunggu', () => {
  assert.deepEqual(ajukanDari('draft'), { ok: true, ke: 'menunggu' });
  assert.deepEqual(ajukanDari('ditolak'), { ok: true, ke: 'menunggu' });
  assert.deepEqual(ajukanDari(null), { ok: true, ke: 'menunggu' }, 'status kosong = draft');
});

// 2. menunggu & disetujui ditolak 409 — tidak bisa melompat/mengulang.
uji('menunggu/disetujui → 409', () => {
  const m = ajukanDari('menunggu');
  assert.equal(m.ok, false); assert.equal(m.http, 409);
  const d = ajukanDari('disetujui');
  assert.equal(d.ok, false); assert.equal(d.http, 409);
});

console.log('validasiStatus');

// 3. Hanya menunggu yang bisa disetujui/ditolak.
uji('disetujui/ditolak hanya dari menunggu', () => {
  assert.deepEqual(validasiStatus('menunggu', 'disetujui', null), { ok: true, ke: 'disetujui' });
  assert.deepEqual(validasiStatus('menunggu', 'ditolak', ' pagu tidak sesuai '),
    { ok: true, ke: 'ditolak' });
  for (const dari of ['draft', 'disetujui', 'ditolak', null]) {
    const r = validasiStatus(dari, 'disetujui', null);
    assert.equal(r.ok, false, `dari=${dari} harus ditolak`);
    assert.equal(r.http, 409, `dari=${dari} → 409`);
  }
});

// 4. Menolak wajib bawa catatan; menyetujui tidak.
uji('ditolak tanpa catatan → 400', () => {
  const r = validasiStatus('menunggu', 'ditolak', '   ');
  assert.equal(r.ok, false); assert.equal(r.http, 400);
  assert.equal(validasiStatus('menunggu', 'ditolak', 'X').ok, true);
});

// 5. Admin bisa kembalikan ke draft dari status mana pun selain draft;
//    dari draft sendiri → 409.
uji('pengembalian ke draft dari menunggu/disetujui/ditolak', () => {
  for (const dari of ['menunggu', 'disetujui', 'ditolak']) {
    assert.deepEqual(validasiStatus(dari, 'draft', null), { ok: true, ke: 'draft' }, dari);
  }
  const r = validasiStatus('draft', 'draft', null);
  assert.equal(r.ok, false); assert.equal(r.http, 409);
});

// 6. Status tujuan tak dikenal → 400.
uji('status tak dikenal → 400', () => {
  const r = validasiStatus('menunggu', 'final', null);
  assert.equal(r.ok, false); assert.equal(r.http, 400);
});

console.log('cekSetujui');

// 7. Pagu wajib terisi > 0 (null/kosong/0 → tolak).
uji('pagu kosong/0 → ditolak 400', () => {
  for (const pagu of [null, undefined, '', 0, -100, 'banyak']) {
    const r = cekSetujui(pagu, 0);
    assert.equal(r.ok, false, `pagu=${pagu} harus ditolak`);
    assert.equal(r.http, 400);
  }
});

// 8. Total rencana ≤ pagu lolos; melebihi → tolak dengan angka di pesan.
uji('total ≤ pagu lolos, melebihi → 400', () => {
  assert.equal(cekSetujui(1000000, 1000000).ok, true, 'tepat sama = lolos');
  assert.equal(cekSetujui(1000000, 999999).ok, true);
  const r = cekSetujui(1000000, 1500000);
  assert.equal(r.ok, false); assert.equal(r.http, 400);
  assert.match(r.error, /melebihi pagu/);
  assert.match(r.error, /1\.500\.000/, 'total ikut disebut');
});

// 9. Total kosong (0) dianggap lolos selama pagu terisi.
uji('tanpa rincian (total 0) → lolos', () => {
  assert.equal(cekSetujui(500000, 0).ok, true);
  assert.equal(cekSetujui(500000, null).ok, true, 'total null = 0');
});

console.log('STATUS_SCREENING');
uji('daftar status lengkap sesuai skema', () => {
  assert.deepEqual([...STATUS_SCREENING].sort(),
    ['disetujui', 'ditolak', 'draft', 'menunggu']);
});

console.log(`${lulus} uji lulus`);
