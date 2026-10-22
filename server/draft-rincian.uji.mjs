// Uji helper draft-rincian. Jalankan: node server/draft-rincian.uji.mjs

import assert from 'node:assert/strict';
import { validasiItem, validasiPatch, jumlahItem } from './draft-rincian.js';

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
    kelompok_belanja: ' Belanja Barang Pakai Habis ',
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
  assert.equal(r.item.kelompok_belanja, 'Belanja Barang Pakai Habis', 'trim kelompok_belanja');
});

// 2. uraian wajib: kosong / whitespace → error.
uji('uraian kosong → error', () => {
  assert.equal(validasiItem({ uraian: '', satuan: 'sak', volume: 1, harga_satuan: 0 }).ok, false);
  assert.equal(validasiItem({ uraian: '   ', satuan: 'sak', volume: 1, harga_satuan: 0 }).ok, false);
  assert.equal(validasiItem({ satuan: 'sak', volume: 1, harga_satuan: 0 }).ok, false);
});

// 3. volume wajib >= 0 (0 boleh; negatif, NaN, hilang → error).
uji('volume 0 lolos; negatif/NaN → error', () => {
  const base = { uraian: 'X', satuan: 'sak', harga_satuan: 1000 };
  assert.equal(validasiItem({ ...base, volume: 0 }).ok, true, 'volume 0 valid');
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
  assert.equal(r.item.kelompok_belanja, null, 'kelompok hilang → null');
  assert.equal(r.item.standar_harga_id, null, 'string kosong tidak jatuh ke 0');
  assert.equal(r.item.harga_standar, null);
});

console.log('jumlahItem');

// 6. Total rupiah: Math.round(volume * harga), cocok dengan preview klien.
uji('jumlahItem(2.5, 1500000) = 3750000', () => {
  assert.equal(jumlahItem(2.5, 1500000), 3750000);
  assert.equal(jumlahItem(1, 999.5), 1000, 'pembulatan .5 ke atas');
});

console.log('validasiPatch (update parsial multi-user)');

// 7. Hanya field yang dikirim masuk patch — field lain tidak disentuh.
uji('patch hanya berisi field yang dikirim', () => {
  const r = validasiPatch({ volume: 0, harga_satuan: '15000' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(Object.keys(r.patch).sort(), ['harga_satuan', 'volume']);
  assert.equal(r.patch.volume, 0, 'volume 0 lolos');
  assert.equal(r.patch.harga_satuan, 15000);
});

// 8. Field yang hadir divalidasi; yang absen tidak divalidasi.
uji('validasi per field: volume negatif gagal, uraian kosong gagal', () => {
  assert.equal(validasiPatch({ volume: -1 }).ok, false);
  assert.equal(validasiPatch({ uraian: '   ' }).ok, false);
  assert.equal(validasiPatch({ satuan: '' }).ok, false);
  // Uraian hilang TIDAK divalidasi (patch volume saja sah walau uraian tidak dikirim)
  assert.equal(validasiPatch({ volume: 3 }).ok, true);
});

// 9. Body tanpa field apa pun → kosong (route membalas 400).
uji('patch kosong → {kosong: true}', () => {
  const r = validasiPatch({});
  assert.equal(r.ok, false);
  assert.equal(r.kosong, true);
  const r2 = validasiPatch(undefined);
  assert.equal(r2.kosong, true);
});

// 10. Field opsi dikirim kosong → null (bersihkan); opsi tak dikirim → tidak ada di patch.
uji('opsi kosong → null; opsi absen tidak muncul', () => {
  const r = validasiPatch({ catatan: '', spesifikasi: ' X ' });
  assert.equal(r.ok, true);
  assert.equal(r.patch.catatan, null, 'kirim "" = bersihkan catatan');
  assert.equal(r.patch.spesifikasi, 'X');
  assert.equal('uraian' in r.patch, false);
});

console.log(`${lulus} uji lulus`);
