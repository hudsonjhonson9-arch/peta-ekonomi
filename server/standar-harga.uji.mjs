// Uji helper standar-harga. Jalankan: node server/standar-harga.uji.mjs

import assert from 'node:assert/strict';
import { HEADER_MAP, validasiUpload, filterDaftar } from './standar-harga.js';

let lulus = 0;
const uji = (nama, fn) => {
  try { fn(); lulus++; console.log(`  ok  ${nama}`); }
  catch (e) { console.error(`  GAGAL  ${nama}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('HEADER_MAP');

// 1. Header kotor dari sheet: spasi di pinggir + "(...)" di tengah.
uji('HEADER_MAP mengenali header kotor', () => {
  assert.equal(HEADER_MAP['URAIAN BARANG'], 'uraian_barang');
  const r = validasiUpload(2026, 'SSH', [{
    ' Uraian Barang (wajib) ': 'Pipa PVC 50mm',
    'Harga (Rp)': '15000',
  }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.items[0].uraian_barang, 'Pipa PVC 50mm');
  assert.equal(r.items[0].harga_satuan, 15000);
});

console.log('validasiUpload');

// 2. Baris valid lolos dengan seluruh field terpetakan + tahun/jenis ikut.
uji('baris valid lolos semua field', () => {
  const r = validasiUpload(2026, 'SSH', [{
    'KODE KELOMPOK BARANG': '01.01.01',
    'URAIAN KELOMPOK BARANG': 'Bahan Bangunan',
    'ID STANDAR HARGA': 'SH-001',
    'KODE BARANG': 'BRG-1',
    'URAIAN BARANG': 'Semen PCC 40kg',
    'SPESIFIKASI': 'SNI',
    'SATUAN': 'sak',
    'HARGA SATUAN': '65000',
    'KODE REKENING': '5.2.02.01',
  }]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.items, [{
    tahun: 2026, jenis: 'SSH',
    kode_kelompok: '01.01.01', uraian_kelompok: 'Bahan Bangunan',
    id_standar_harga: 'SH-001', kode_barang: 'BRG-1',
    uraian_barang: 'Semen PCC 40kg', spesifikasi: 'SNI', satuan: 'sak',
    harga_satuan: 65000, kode_rekening: '5.2.02.01',
  }]);

  // Bentuk flat: key sudah berupa nama kolom target (klien memetakan sheet
  // sendiri) → dipakai langsung; tahun/jenis tetap dari argumen body.
  const flat = validasiUpload(2026, 'SSH', [{
    tahun: 2026, jenis: 'SSH',
    uraian_barang: 'Cat Tembok', harga_satuan: '150.000',
    satuan: 'ember', kode_rekening: '5.2.02.01', kode_barang: 'B009',
  }]);
  assert.equal(flat.ok, true, JSON.stringify(flat));
  assert.equal(flat.items[0].uraian_barang, 'Cat Tembok');
  assert.equal(flat.items[0].harga_satuan, 150000, 'harga teks dikoerce juga di bentuk flat');
  assert.equal(flat.items[0].tahun, 2026, 'tahun diambil dari body, bukan baris');
  assert.equal(flat.items[0].spesifikasi, null, 'kolom absen → null (siap INSERT)');
});

// 3. Format ribuan Indonesia: titik = ribuan, koma = desimal (jalur teks).
uji('harga teks Indonesia: "1.500.500,00" → 1500500', () => {
  const r = validasiUpload(2026, 'SSH', [
    { 'URAIAN BARANG': 'Kabel NYM 3x2.5', 'HARGA SATUAN': '1.500.500,00' },
  ]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.items[0].harga_satuan, 1500500);

  // Aturan literal: tanpa koma sekalipun, titik di teks tetap pemisah ribuan.
  const r2 = validasiUpload(2026, 'SSH', [
    { 'URAIAN BARANG': 'Semen', 'HARGA SATUAN': 'Rp 65.000' },
    { 'URAIAN BARANG': 'Pipa', 'HARGA SATUAN': '65.000' },
  ]);
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(r2.items[0].harga_satuan, 65000, '"Rp 65.000" → 65000');
  assert.equal(r2.items[1].harga_satuan, 65000, '"65.000" → 65000');
});

// 4. Baris tanpa uraian (atau harga gugur) dilewati; semua gugur → error.
uji('uraian kosong di-skip; semua gugur → ok:false', () => {
  const sebagian = validasiUpload(2026, 'SSH', [
    { 'URAIAN BARANG': '', 'HARGA SATUAN': '1000' },
    { 'HARGA SATUAN': '2000' },
    { 'URAIAN BARANG': 'Harga Rusak', 'HARGA SATUAN': 'tidak berharga' },
    { 'URAIAN BARANG': 'Harga Negatif', 'HARGA SATUAN': '-5' },
    { 'URAIAN BARANG': 'Kabel NYM', 'HARGA SATUAN': '3000' },
  ]);
  assert.equal(sebagian.ok, true, JSON.stringify(sebagian));
  assert.equal(sebagian.items.length, 1, JSON.stringify(sebagian.items));
  assert.equal(sebagian.items[0].uraian_barang, 'Kabel NYM');

  const gugur = validasiUpload(2026, 'SSH', [
    { 'URAIAN BARANG': '', 'HARGA SATUAN': '1000' },
    { 'URAIAN BARANG': 'Juga Gugur', 'HARGA SATUAN': 'nol rupiah' },
  ]);
  assert.equal(gugur.ok, false);
  assert.equal(typeof gugur.error, 'string');
});

// 5. Jenis di luar ['SSH','SBU'] ditolak sebelum memproses baris.
uji('jenis tak dikenal / tahun kosong → ok:false', () => {
  const r = validasiUpload(2026, 'LAIN', [{ 'URAIAN BARANG': 'X', 'HARGA SATUAN': '1' }]);
  assert.equal(r.ok, false);
  assert.equal(typeof r.error, 'string');
  // Tahun kosong harus ditolak, bukan jatuh ke Number('') === 0.
  assert.equal(validasiUpload('', 'SSH', [{ 'URAIAN BARANG': 'X', 'HARGA SATUAN': '1' }]).ok, false);
  assert.equal(validasiUpload('  ', 'SSH', [{ 'URAIAN BARANG': 'X', 'HARGA SATUAN': '1' }]).ok, false);
  assert.equal(validasiUpload(null, 'SSH', [{ 'URAIAN BARANG': 'X', 'HARGA SATUAN': '1' }]).ok, false);
});

console.log('filterDaftar');

// 6. q substring case-insensitive di 3 field; rekening exact; q kosong = semua.
uji('q + rekening menyaring benar; q kosong = semua', () => {
  const daftar = [
    { uraian_barang: 'Semen PCC', spesifikasi: '40kg', kode_barang: 'B001', kode_rekening: '5.2.02.01' },
    { uraian_barang: 'Kabel NYM', spesifikasi: '3x2.5', kode_barang: 'B002', kode_rekening: '5.2.02.02' },
    { uraian_barang: 'Pipa PVC', spesifikasi: '3 inci', kode_barang: 'B003', kode_rekening: '5.2.02.01' },
  ];
  assert.equal(filterDaftar(daftar, { q: 'semen' }).length, 1);
  assert.equal(filterDaftar(daftar, { q: 'NYM', rekening: '5.2.02.02' })[0].uraian_barang, 'Kabel NYM');
  assert.equal(filterDaftar(daftar, { q: '40kg' }).length, 1, 'cocok di spesifikasi');
  assert.equal(filterDaftar(daftar, { q: 'b003' }).length, 1, 'cocok di kode_barang');
  assert.equal(filterDaftar(daftar, { q: '', rekening: '5.2.02.01' }).length, 2, 'rekening exact');
  assert.equal(filterDaftar(daftar, { q: '', rekening: null }).length, 3, 'q kosong = semua');
  // Multi-rekening: Task 5 mengirim chips.join(',') beserta spasi.
  assert.equal(filterDaftar(daftar, { q: '', rekening: '5.2.02.02, 5.2.02.01' }).length, 3, 'multi-kode dipisah koma');
  assert.equal(filterDaftar(daftar, { q: 'semen', rekening: '5.2.02.02,9.9.9.9' }).length, 0, 'kode di luar set tetap gugur');
});

console.log(`${lulus} uji lulus`);
