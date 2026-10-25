// Uji helper session (token + cookie "Ingat saya").
// Jalankan: node server/session.uji.mjs

import assert from 'node:assert/strict';
import {
  buatToken, pasangCookie, verifikasiTokenDetail,
  MASA_JAM, MASA_JAM_INGAT, NAMA_COOKIE,
} from './session.js';

let lulus = 0;
const uji = (nama, fn) => {
  try { fn(); lulus++; console.log(`  ok  ${nama}`); }
  catch (e) { console.error(`  GAGAL  ${nama}\n    ${e.message}`); process.exitCode = 1; }
};

// Secret uji lolos minimum panjang; sengaja beda dari secret lain.
const SECRET = 'rahasia-uji-session-minimum-32-karakter';
const NIP = '198701012010011001';

console.log('buatToken');

// 1. Default: masa berlaku MASA_JAM (8 jam) — tidak berubah oleh fitur baru.
uji(`token default kedaluwarsa setelah ${MASA_JAM} jam`, () => {
  const t = buatToken(NIP, SECRET);
  const dasar = Math.floor(Date.now() / 1000);
  assert.ok(verifikasiTokenDetail(t, SECRET, dasar + MASA_JAM * 3600 - 60).muatan,
    'masih valid 1 menit sebelum batas');
  const r = verifikasiTokenDetail(t, SECRET, dasar + MASA_JAM * 3600 + 60);
  assert.equal(r.muatan, null, 'harus kedaluwarsa sesudah batas');
  assert.equal(r.alasan, 'token sudah kedaluwarsa');
});

// 2. Ingat saya: masa berlaku MASA_JAM_INGAT (30 hari).
uji(`token "ingat" bertahan ${MASA_JAM_INGAT} jam (30 hari)`, () => {
  const t = buatToken(NIP, SECRET, MASA_JAM_INGAT);
  const dasar = Math.floor(Date.now() / 1000);
  assert.ok(verifikasiTokenDetail(t, SECRET, dasar + 29 * 24 * 3600).muatan,
    'masih valid di hari ke-29');
  assert.equal(verifikasiTokenDetail(t, SECRET, dasar + 31 * 24 * 3600).muatan, null,
    'kedaluwarsa di hari ke-31');
});

// 3. Muatan tetap membawa sub NIP; secret beda → tanda tangan ditolak.
const SECRET_LAIN = SECRET + '-diubah';
uji('muatan sub = NIP dan secret salah ditolak', () => {
  const t = buatToken(NIP, SECRET, MASA_JAM_INGAT);
  const { muatan } = verifikasiTokenDetail(t, SECRET);
  assert.equal(muatan.sub, NIP);
  assert.equal(verifikasiTokenDetail(t, SECRET_LAIN).muatan, null);
});

console.log('pasangCookie');

// 4. Ingat = true → cookie persistent 30 hari.
uji('ingat=true → maxAge 30 hari', () => {
  let panggilan = null;
  const res = { cookie: (nama, val, opsi) => { panggilan = { nama, val, opsi }; } };
  pasangCookie(res, 'token', { secure: true }, true);
  assert.equal(panggilan.nama, NAMA_COOKIE);
  assert.equal(panggilan.opsi.maxAge, MASA_JAM_INGAT * 3600 * 1000);
  assert.equal(panggilan.opsi.httpOnly, true);
  assert.equal(panggilan.opsi.secure, true, 'ikut req.secure');
  assert.equal(panggilan.opsi.path, '/');
});

// 5. Ingat = false / tidak dikirim → cookie session (tanpa maxAge),
//    ikut hilang saat browser ditutup.
uji('tanpa ingat → cookie session (tanpa maxAge)', () => {
  let panggilan = null;
  const res = { cookie: (nama, val, opsi) => { panggilan = { nama, val, opsi }; } };
  pasangCookie(res, 'token', { secure: false });
  assert.equal(panggilan.opsi.maxAge, undefined, 'session cookie: tanpa maxAge');
  assert.equal(panggilan.opsi.secure, false, 'ikut req.secure');
});

console.log(`\n${lulus} uji lulus${process.exitCode ? ' — ADA YANG GAGAL' : ''}`);
