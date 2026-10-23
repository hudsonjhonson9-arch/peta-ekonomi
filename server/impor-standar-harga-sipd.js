// Impor bawaan standar harga SIPD (SSH/SBU) saat server boot.
//
// Data sumber: file xlsx export SIPD yang diletakkan di db/ dengan pola nama
//   standar_harga_sipd_<jenis>_<tahun>.xlsx   (contoh: standar_harga_sipd_ssh_2027.xlsx)
// Tahun sengaja dibaca dari NAMA FILE, bukan dari isi sheet — export SIPD
// tidak punya kolom tahun, dan tahun yang dipakai adalah tahun kerja aplikasi.
//
// Semantika sama dengan upload lewat menu Standar Harga: MERGE per
// (tahun, jenis, ID STANDAR HARGA) — baris baru disisipkan, ID sudah ada
// harganya diperbarui, baris lama yang tidak ada di file TIDAK dihapus.
// ON CONFLICT menarget index unik tahap_13, jadi idempoten: boot berikutnya
// menghasilkan isi tabel yang sama (aman dijalankan berulang).
//
// Parsing memakai validasiUpload() dari standar-harga.js — jalur yang sama
// dengan endpoint /api/standar-harga/upload, sehingga baris yang lolos di
// sini persis baris yang lolos saat upload manual. Header sheet dipetakan
// oleh validasiUpload sendiri (kunci header mentah diterima), jadi modul ini
// tidak menduplikasi HEADER_MAP.

import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { validasiUpload } from './standar-harga.js';

// Kolom & kunci merge — sengaja identik dengan endpoint upload di index.js.
// Ubah di satu tempat = ubah juga di tempat lain (komentar di endpoint).
const KOLOM = [
  'tahun', 'jenis', 'kode_kelompok', 'uraian_kelompok', 'id_standar_harga',
  'kode_barang', 'uraian_barang', 'spesifikasi', 'satuan', 'harga_satuan',
  'kode_rekening',
];
const UPDATE_KOLOM = KOLOM.slice(2);
const KUNCI = ['tahun', 'jenis', 'id_standar_harga'];

// "standar_harga_sipd_ssh_2027.xlsx" → {jenis:'SSH', tahun:2027}; lain → null.
export function namaKeTahunJenis(nama) {
  const m = /^standar_harga_sipd_(ssh|sbu)_(\d{4})\.xlsx$/i.exec(String(nama).trim());
  if (!m) return null;
  return { jenis: m[1].toUpperCase(), tahun: Number(m[2]) };
}

// Sheet pertama → array objek dengan kunci header mentah (baris 0 = header).
// Pola ini sama dengan bacaFile() di SbuSshAdmin.jsx.
export function barisDariWorkbook(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
  if (aoa.length < 2) return [];
  const kepala = aoa[0];
  return aoa.slice(1).map(r => {
    const o = {};
    kepala.forEach((h, i) => { if (h !== '' && h != null) o[h] = r[i]; });
    return o;
  });
}

// Satu file → merge ke tabel standar_harga. Mengembalikan {baris, masuk}
// supaya boot log bisa memperlihatkan baris yang gugur (harusnya 0).
export async function imporFile(pool, file, { tahun, jenis }) {
  const wb = XLSX.read(await fs.readFile(file), { type: 'buffer' });
  const rows = barisDariWorkbook(wb);
  const v = validasiUpload(tahun, jenis, rows);
  if (!v.ok) throw new Error(`${path.basename(file)}: ${v.error}`);
  for (let i = 0; i < v.items.length; i += 200) {
    const chunk = v.items.slice(i, i + 200);
    const ph = [], vals = [];
    chunk.forEach((it, j) => {
      const mulai = j * KOLOM.length;
      ph.push(`(${KOLOM.map((_, k) => `$${mulai + k + 1}`).join(',')})`);
      vals.push(tahun, jenis, ...KOLOM.slice(2).map((c) => it[c] ?? null));
    });
    await pool.query(
      `INSERT INTO standar_harga (${KOLOM.join(', ')}) VALUES ${ph.join(',')}
       ON CONFLICT (${KUNCI.join(', ')}) DO UPDATE SET
       ${UPDATE_KOLOM.map((c) => `${c} = EXCLUDED.${c}`).join(', ')},
       updated_at = now()`,
      vals
    );
  }
  return { baris: rows.length, masuk: v.items.length };
}

// Dipanggil dari rantai boot setelah tahap_13 (index unik) — lihat index.js.
// File yang tidak ada / gagal dicatat di log dan TIDAK menggagalkan boot:
// data lama tetap dipakai, impor ulang bisa terjadi di boot berikutnya.
export async function imporStandarHargaSipd(pool, dir) {
  let daftar;
  try {
    daftar = (await fs.readdir(dir)).filter((n) => namaKeTahunJenis(n)).sort();
  } catch (_) {
    console.error(`Impor standar harga SIPD: folder ${dir} tidak bisa dibaca`);
    return;
  }
  for (const nama of daftar) {
    const { tahun, jenis } = namaKeTahunJenis(nama);
    try {
      const { baris, masuk } = await imporFile(pool, path.join(dir, nama), { tahun, jenis });
      const catat = baris === masuk
        ? `${masuk} baris`
        : `${masuk}/${baris} baris (sisa gugur: tanpa uraian/harga tidak valid)`;
      console.log(`Impor standar harga SIPD: ${nama} → ${jenis} ${tahun} merge ${catat}`);
    } catch (e) {
      console.error(`Impor standar harga SIPD GAGAL (${nama}): ${e.message}`);
    }
  }
}
