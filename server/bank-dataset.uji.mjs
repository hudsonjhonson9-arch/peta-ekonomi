import test from 'node:test';
import assert from 'node:assert/strict';
import { normalisasiRole, R_BANKDATA, R_ADMIN, R_REVIEWER, R_STAF } from './session.js';
import { kebutuhan, PUBLIK, LOGIN, BANKDATA, REVIEW, ADMIN, jalurOperatorDiizinkan } from './kebijakan.js';
import {
  opdTerbatas, opdMilik, bolehEditStatus, bolehVerifikasi,
  validasiMetadataDataset, normalisasiNamaField, validasiDaftarField, validasiSatuBaris,
} from './bank-dataset.js';

test('normalisasiRole memetakan Operator Bank Data', () => {
  assert.equal(normalisasiRole('Operator Bank Data'), R_BANKDATA);
  assert.equal(normalisasiRole('BANKDATA'), R_BANKDATA);
  assert.equal(normalisasiRole('OPERATOR_BANKDATA'), R_BANKDATA);
  assert.equal(normalisasiRole('ADMIN'), R_ADMIN);
  assert.equal(normalisasiRole('KABID'), R_REVIEWER);
  assert.equal(normalisasiRole('USER'), R_STAF);
});

test('kebijakan rute Bank Data dan Portal Publik', () => {
  assert.equal(kebutuhan('GET', '/api/publik/bankdata'), PUBLIK);
  assert.equal(kebutuhan('GET', '/api/publik/bankdata/12'), PUBLIK);
  assert.equal(kebutuhan('GET', '/api/bankdata'), LOGIN);
  assert.equal(kebutuhan('GET', '/api/bankdata/opd'), LOGIN);
  assert.equal(kebutuhan('POST', '/api/bankdata/opd'), ADMIN);
  assert.equal(kebutuhan('PUT', '/api/bankdata/opd/5'), ADMIN);
  assert.equal(kebutuhan('DELETE', '/api/bankdata/opd/5'), ADMIN);
  assert.equal(kebutuhan('POST', '/api/bankdata/tahun'), ADMIN);
  assert.equal(kebutuhan('DELETE', '/api/bankdata/tahun/2'), ADMIN);
  assert.equal(kebutuhan('POST', '/api/bankdata/iku'), BANKDATA);
  assert.equal(kebutuhan('POST', '/api/bankdata/dataset'), BANKDATA);
  assert.equal(kebutuhan('POST', '/api/bankdata/dataset/7/rows/import'), BANKDATA);
  assert.equal(kebutuhan('POST', '/api/bankdata/dataset/7/ajukan'), BANKDATA);
  assert.equal(kebutuhan('GET', '/api/bankdata/dataset/verifikasi'), REVIEW);
  assert.equal(kebutuhan('POST', '/api/bankdata/dataset/7/verifikasi'), REVIEW);
});

test('jalurOperatorDiizinkan mengisolasi Operator Bank Data dari modul arsip', () => {
  assert.equal(jalurOperatorDiizinkan('/api/bankdata'), true);
  assert.equal(jalurOperatorDiizinkan('/api/bankdata/dataset/10'), true);
  assert.equal(jalurOperatorDiizinkan('/api/notifications'), true);
  assert.equal(jalurOperatorDiizinkan('/api/auth/sesi'), true);
  assert.equal(jalurOperatorDiizinkan('/api/docs'), false);
  assert.equal(jalurOperatorDiizinkan('/api/kertas-kerja'), false);
  assert.equal(jalurOperatorDiizinkan('/api/users'), false);
});

test('opdTerbatas dan opdMilik menegakkan 1 Operator = 1 OPD', () => {
  const op = { role: R_BANKDATA, opd_id: 7 };
  const admin = { role: R_ADMIN, opd_id: null };
  assert.equal(opdTerbatas(op), true);
  assert.equal(opdTerbatas(admin), false);
  assert.equal(opdMilik(op, 7), true);
  assert.equal(opdMilik(op, '7'), true);
  assert.equal(opdMilik(op, 8), false);
  assert.equal(opdMilik(admin, 99), true);
});

test('bolehEditStatus dan bolehVerifikasi', () => {
  assert.equal(bolehEditStatus('draft'), true);
  assert.equal(bolehEditStatus('perlu_perbaikan'), true);
  assert.equal(bolehEditStatus('ditolak'), true);
  assert.equal(bolehEditStatus('diajukan'), false);
  assert.equal(bolehEditStatus('disetujui'), false);

  assert.equal(bolehVerifikasi(R_ADMIN), true);
  assert.equal(bolehVerifikasi(R_REVIEWER), true);
  assert.equal(bolehVerifikasi(R_BANKDATA), false);
  assert.equal(bolehVerifikasi(R_STAF), false);
});

test('validasiMetadataDataset dan validasiDaftarField + validasiSatuBaris', () => {
  const vm = validasiMetadataDataset({
    opd_id: 3,
    judul: 'Jumlah Produksi Padi',
    jenis: 'kuantitatif',
    frekuensi: 'tahunan',
    klasifikasi: 'terbuka',
    sumber_data: 'Dinas Pertanian',
    satuan_default: 'Ton',
  });
  assert.equal(vm.ok, true);
  assert.equal(vm.data.opd_id, 3);

  assert.equal(normalisasiNamaField('Luas Panen (Ha)'), 'luas_panen_ha');

  const vf = validasiDaftarField([
    { label: 'Luas Panen', tipe: 'desimal', satuan: 'Ha', wajib: true, tampil_grafik: true },
    { label: 'Produksi Padi', tipe: 'angka', satuan: 'Ton', wajib: true, tampil_grafik: true },
  ]);
  assert.equal(vf.ok, true);
  assert.equal(vf.fields.length, 2);
  assert.equal(vf.fields[0].nama, 'luas_panen');

  const vr = validasiSatuBaris(
    { tahun: '2025', periode: 'Tahunan', wilayah_kode: 'KAB', data: { luas_panen: '1.250,5', produksi_padi: '6500' } },
    vf.fields
  );
  assert.equal(vr.ok, true);
  assert.equal(vr.row.tahun, 2025);
  assert.equal(vr.row.data.luas_panen, 1250.5);
  assert.equal(vr.row.data.produksi_padi, 6500);
});

