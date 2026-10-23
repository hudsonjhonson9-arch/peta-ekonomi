// Uji impor standar harga SIPD saat boot. Jalankan:
//   node server/impor-standar-harga-sipd.uji.mjs
// Memakai file xlsx asli di db/ (ikut ter-commit) + pool palsu yang merekam
// query, jadi tidak butuh database.

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  namaKeTahunJenis, barisDariWorkbook, imporFile, imporStandarHargaSipd,
} from './impor-standar-harga-sipd.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB = path.join(__dirname, '..', 'db');

let lulus = 0;
const uji = (nama, fn) => {
  try { fn(); lulus++; console.log(`  ok  ${nama}`); }
  catch (e) { console.error(`  GAGAL  ${nama}\n    ${e.message}`); process.exitCode = 1; }
};
const ujiAsync = async (nama, fn) => {
  try { await fn(); lulus++; console.log(`  ok  ${nama}`); }
  catch (e) { console.error(`  GAGAL  ${nama}\n    ${e.message}`); process.exitCode = 1; }
};

// Pool palsu: rekam semua query untuk diperiksa.
const poolPalsu = () => {
  const panggilan = [];
  return {
    panggilan,
    query: async (sql, vals) => { panggilan.push({ sql, vals }); return { rows: [] }; },
  };
};

console.log('namaKeTahunJenis');

uji('nama file sah terurai ke jenis+tahun', () => {
  assert.deepEqual(namaKeTahunJenis('standar_harga_sipd_ssh_2027.xlsx'), { jenis: 'SSH', tahun: 2027 });
  assert.deepEqual(namaKeTahunJenis('standar_harga_sipd_sbu_2027.xlsx'), { jenis: 'SBU', tahun: 2027 });
  assert.deepEqual(namaKeTahunJenis('STANDAR_HARGA_SIPD_SSH_2026.XLSX'), { jenis: 'SSH', tahun: 2026 });
});

uji('nama lain diabaikan (bukan kandidat impor)', () => {
  assert.equal(namaKeTahunJenis('seed_rkpd_2025.sql'), null);
  assert.equal(namaKeTahunJenis('standar_harga_sipd_ssh.xlsx'), null);
  assert.equal(namaKeTahunJenis('standar_harga_sipd_ssh_20x7.xlsx'), null);
  assert.equal(namaKeTahunJenis('export_excel_ssh_Kab. Sumba Barat.xlsx'), null);
});

console.log('imporFile (file xlsx asli di db/)');

await ujiAsync('SSH 2027: seluruh baris lolos & di-upsert merge', async () => {
  const p = poolPalsu();
  const h = await imporFile(p, path.join(DB, 'standar_harga_sipd_ssh_2027.xlsx'), { tahun: 2027, jenis: 'SSH' });
  assert.equal(h.baris, 2809, 'baris data pada sheet');
  assert.equal(h.masuk, 2809, 'semua baris lolos validasiUpload');
  assert.equal(p.panggilan.length, Math.ceil(2809 / 200), 'dibagi chunk 200');
  for (const q of p.panggilan) {
    assert.match(q.sql, /ON CONFLICT \(tahun, jenis, id_standar_harga\) DO UPDATE SET/, 'merge, bukan insert buta');
    assert.match(q.sql, /updated_at = now\(\)/, 'updated_at disentuh (ON CONFLICT tidak memicu DEFAULT)');
    assert.equal(q.vals.length % 11, 0, 'tiap baris 11 parameter');
    assert.ok(q.vals.length <= 200 * 11, 'chunk ≤ 200 baris');
  }
  // Tahun/jenis dari parameter file, bukan dari isi sheet.
  assert.equal(p.panggilan[0].vals[0], 2027);
  assert.equal(p.panggilan[0].vals[1], 'SSH');
  // Spot-check baris pertama (Semen 50 Kg, harga 84300, ID 5174020).
  const v = p.panggilan[0].vals;
  assert.equal(v[4], '5174020', 'ID STANDAR HARGA jadi teks');
  assert.equal(v[6], 'Semen 50 Kg');
  assert.equal(Number(v[9]), 84300, 'harga_satuan numerik');
});

await ujiAsync('SBU 2027: seluruh baris lolos & di-upsert merge', async () => {
  const p = poolPalsu();
  const h = await imporFile(p, path.join(DB, 'standar_harga_sipd_sbu_2027.xlsx'), { tahun: 2027, jenis: 'SBU' });
  assert.equal(h.baris, 2044);
  assert.equal(h.masuk, 2044);
  assert.equal(p.panggilan.length, Math.ceil(2044 / 200));
  assert.match(p.panggilan[0].sql, /ON CONFLICT \(tahun, jenis, id_standar_harga\) DO UPDATE SET/);
  assert.equal(p.panggilan[0].vals[1], 'SBU');
});

await ujiAsync('file gagal dibaca → lempar error (ditangkap pemanggil boot)', async () => {
  const p = poolPalsu();
  await assert.rejects(
    () => imporFile(p, path.join(DB, 'tidak-ada.xlsx'), { tahun: 2027, jenis: 'SSH' }),
    /ENOENT/
  );
  assert.equal(p.panggilan.length, 0, 'tidak ada query parsial');
});

console.log('imporStandarHargaSipd (pemindaian folder)');

await ujiAsync('folder berisi campuran file → hanya nama sah yang diproses', async () => {
  const p = poolPalsu();
  const h = await imporStandarHargaSipd(p, DB);
  // db/ berisi 2 file sah (ssh+sbu 2027) plus .sql/.cjs yang diabaikan.
  assert.equal(p.panggilan.length,
    Math.ceil(2809 / 200) + Math.ceil(2044 / 200),
    'kedua file terimpor, file lain diabaikan');
  const jenis = new Set(p.panggilan.map(q => q.vals[1]));
  assert.deepEqual([...jenis].sort(), ['SBU', 'SSH']);
  assert.equal(h, undefined);
});

await ujiAsync('folder tidak ada → tidak melempar (boot aman)', async () => {
  const p = poolPalsu();
  await imporStandarHargaSipd(p, path.join(DB, 'folder-ini-tidak-ada'));
  assert.equal(p.panggilan.length, 0);
});

console.log(`\n${lulus} uji lulus${process.exitCode ? ' (ADA GAGAL)' : ''}`);
