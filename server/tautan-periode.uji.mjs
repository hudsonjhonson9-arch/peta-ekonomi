// Uji aturan tautan periode. Jalankan: node server/tautan-periode.uji.mjs
//
// Kasus yang diuji di sini adalah kasus yang sebelumnya damaging: Drive file id
// Google lolos parseInt dan tertaut ke dokumen yang salah.

import assert from 'node:assert/strict';
import {
  idDokumenValid, judulDokumenPeriode, pecahJudulPeriode, kunciPeriode,
} from './tautan-periode.js';

let lulus = 0;
const uji = (nama, fn) => {
  try { fn(); lulus++; console.log(`  ok  ${nama}`); }
  catch (e) { console.error(`  GAGAL  ${nama}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('idDokumenValid');

// Bug inti: parseInt("1AbCdEf", 10) === 1, jadi validator lama menganggap
// Drive file id sebagai id baris dokumen yang sah.
uji('menolak Drive file id yang diawali angka', () => {
  assert.equal(parseInt('1AbCdEfGhIjKl', 10), 1); // inilah yang dulu bocor
  assert.equal(idDokumenValid('1AbCdEfGhIjKl'), null);
});

uji('menolak id non-angka lain', () => {
  for (const v of ['abc', '1.5', '1e4', '-3', '0x1f', '12 34', '', '   ', 'null'])
    assert.equal(idDokumenValid(v), null, `harus null: ${JSON.stringify(v)}`);
});

uji('menolak null, undefined, dan object', () => {
  for (const v of [null, undefined, {}, [], true, NaN])
    assert.equal(idDokumenValid(v), null, `harus null: ${String(v)}`);
});

uji('menerima id baris yang sah', () => {
  assert.equal(idDokumenValid(42), 42);
  assert.equal(idDokumenValid('42'), 42);
  assert.equal(idDokumenValid('  42  '), 42);
  assert.equal(idDokumenValid('00042'), 42);
});

uji('menolak angka yang tidak aman atau bukan positif', () => {
  assert.equal(idDokumenValid(0), null);
  assert.equal(idDokumenValid('9007199254740993'), null);
});

console.log('judulDokumenPeriode');

uji('memakai pemisah em-dash yang sama di upload dan repairing', () => {
  assert.equal(judulDokumenPeriode('Laporan Kinerja', 'Triwulan I'),
    'Laporan Kinerja \u2014 Triwulan I');
});

uji('memangkas spasi berlebih tapi tidak mengubah isi', () => {
  assert.equal(judulDokumenPeriode('  Laporan Kinerja ', ' Triwulan I  '),
    'Laporan Kinerja \u2014 Triwulan I');
});

uji('menolak pasangan yang salah satu kosong', () => {
  assert.equal(judulDokumenPeriode('', 'Triwulan I'), null);
  assert.equal(judulDokumenPeriode('Laporan Kinerja', ''), null);
  assert.equal(judulDokumenPeriode(null, undefined), null);
});

console.log('pecahJudulPeriode');

uji('memulihkan judul yang dirakit sendiri', () => {
  const balik = pecahJudulPeriode(judulDokumenPeriode('Laporan Kinerja', 'Triwulan I'));
  assert.deepEqual(balik, { namaOutput: 'Laporan Kinerja', labelPeriode: 'Triwulan I' });
});

uji('menolak judul ambigu supaya tidak Salah tautan', () => {
  assert.equal(pecahJudulPeriode('Laporan Kinerja'), null);        // tanpa pemisah
  assert.equal(pecahJudulPeriode('A \u2014 B \u2014 C'), null);     // pemisah ganda
  assert.equal(pecahJudulPeriode(' \u2014 Triwulan I'), null);      // nama output kosong
  assert.equal(pecahJudulPeriode('Laporan Kinerja \u2014 '), null); // periode kosong
  assert.equal(pecahJudulPeriode(null), null);
});

console.log('kunciPeriode');

uji('mengunci output + tahun + periode', () => {
  assert.equal(kunciPeriode({ kertas_kerja_id: 7, tahun: 2026, periode: 3 }), '7:2026:3');
  assert.equal(kunciPeriode({ kertas_kerja_id: 7, tahun: 2026 }), null);
  assert.equal(kunciPeriode({}), null);
});

console.log(`\n${lulus} uji lulus.`);