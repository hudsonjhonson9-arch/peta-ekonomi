// Uji helper draft-rincian. Jalankan: node server/draft-rincian.uji.mjs

import assert from 'node:assert/strict';
import { validasiItem, jumlahItem } from './draft-rincian.js';

let lulus = 0;
const uji = (nama, fn) => {
  try { fn(); lulus++; console.log(`  ok  ${nama}`); }
  catch (e) { console.error(`  GAGAL  ${nama}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('validasiItem');

// 1. Item valid lolos seluruh field + koerce tipe (volume "2" → 2).
uji('item valid lolos semua field dan ter-coerce', () => {
  const r = validasiItem({
    uraian: '  Beli semen  ', spesifikasi: ' PCC 40kg ', satuan: ' sak ',
    volume: '2', harga_satuan: '65000', kode_rekening: ' 5.2.02.01 ',
    standar_harga_id: '17', harga_standar: '65000', catatan: ' urgensi ',
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.item.uraian, 'Beli semen', 'trim uraian');
  assert.equal(r.item.spesifikasi, 'PCC 40kg');
  assert.equal(r.item.satuan, 'sak');
  assert.equal(r.item.volume, 2, 'volume string dikoerce ke number');
  assert.equal(r.item.harga_satuan, 65000);
  assert.equal(r.item.kode_rekening, '5.2.02.01');
  assert.equal(r.item.standar_harga_id, 17, 'id string dikoerce ke integer');
  assert.equal(r.item.harga_standar, 65000);
  assert.equal(r.item.catatan, 'urgensi');
});

// 2. uraian wajib: kosong / whitespace → error.
uji('uraian kosong → error', () => {
  assert.equal(validasiItem({ uraian: '', satuan: 'sak', volume: 1, harga_satuan: 0 }).ok, false);
  assert.equal(validasiItem({ uraian: '   ', satuan: 'sak', volume: 1, harga_satuan: 0 }).ok, false);
  assert.equal(validasiItem({ satuan: 'sak', volume: 1, harga_satuan: 0 }).ok, false);
});

// 3. volume wajib > 0 (0, negatif, NaN).
uji('volume <= 0 → error', () => {
  const base = { uraian: 'X', satuan: 'sak', harga_satuan: 1000 };
  assert.equal(validasiItem({ ...base, volume: 0 }).ok, false);
  assert.equal(validasiItem({ ...base, volume: -5 }).ok, false);
  assert.equal(validasiItem({ ...base, volume: 'banyak' }).ok, false);
  assert.equal(validasiItem({ ...base }).ok, false, 'volume hilang → error');
});

// 4. harga_satuan tidak boleh negatif.
uji('harga negatif → error', () => {
  assert.equal(validasiItem({ uraian: 'X', satuan: 'sak', volume: 1, harga_satuan: -1 }).ok, false);
  assert.equal(validasiItem({ uraian: 'X', satuan: 'sak', volume: 1, harga_satuan: '-1000' }).ok, false);
});

// 5. Field opsional hilang → ok dengan default null.
uji('semua field opsional hilang → ok (defaults)', () => {
  const r = validasiItem({ uraian: 'Langsir material', satuan: 'kali', volume: 3, harga_satuan: 0 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.item.spesifikasi, null);
  assert.equal(r.item.kode_rekening, null);
  assert.equal(r.item.catatan, null);
  assert.equal(r.item.standar_harga_id, null, 'string kosong tidak jatuh ke 0');
  assert.equal(r.item.harga_standar, null);
});

console.log('jumlahItem');

// 6. Total rupiah: Math.round(volume * harga), cocok dengan preview klien.
uji('jumlahItem(2.5, 1500000) = 3750000', () => {
  assert.equal(jumlahItem(2.5, 1500000), 3750000);
  assert.equal(jumlahItem(1, 999.5), 1000, 'pembulatan .5 ke atas');
});

console.log(`${lulus} uji lulus`);
