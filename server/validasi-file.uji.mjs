// Uji validasi tipe file metadata arsip. Jalankan: node server/validasi-file.uji.mjs

import assert from 'node:assert/strict';
import {
  EKSTENSI_AMAN, ekstensiNama, labelDariEkstensi, urlDriveValid,
  validasiMetadataDokumen, validasiLabelFileTipe,
} from './validasi-file.js';

let lulus = 0;
const uji = (nama, fn) => {
  try { fn(); lulus++; console.log(`  ok  ${nama}`); }
  catch (e) { console.error(`  GAGAL  ${nama}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('ekstensiNama');

uji('mengambil ekstensi huruf besar-kecil seragam', () => {
  assert.equal(ekstensiNama('Laporan.PDF'), 'pdf');
  assert.equal(ekstensiNama('foto.jpg'), 'jpg');
  assert.equal(ekstensiNama(' arsip.tar '), 'tar');
});

uji('null untuk nama tanpa ekstensi atau bukan string', () => {
  for (const v of ['laporan', '', '  ', 'file.', null, undefined, 42, {}])
    assert.equal(ekstensiNama(v), null, `harus null: ${JSON.stringify(v)}`);
});

console.log('labelDariEkstensi');

uji('memetakan ekstensi ke label fileType UploadForm', () => {
  assert.equal(labelDariEkstensi('pdf'), 'PDF');
  assert.equal(labelDariEkstensi('docx'), 'Word');
  assert.equal(labelDariEkstensi('doc'), 'Word');
  assert.equal(labelDariEkstensi('xlsx'), 'Excel');
  assert.equal(labelDariEkstensi('pptx'), 'PowerPoint');
  assert.equal(labelDariEkstensi('jpg'), 'Lainnya');
  assert.equal(labelDariEkstensi('png'), 'Lainnya');
  assert.equal(labelDariEkstensi('csv'), 'Lainnya');
});

uji('null untuk ekstensi di luar allowlist', () => {
  for (const v of ['html', 'htm', 'js', 'php', 'exe', 'svg', 'sh', null])
    assert.equal(labelDariEkstensi(v), null, `harus null: ${v}`);
});

console.log('urlDriveValid');

uji('menerima tautan Drive dan Docs resmi', () => {
  assert.equal(urlDriveValid('https://drive.google.com/file/d/abc123/view?usp=drivesdk'), true);
  assert.equal(urlDriveValid('https://drive.google.com/drive/folders/xyz789'), true);
  assert.equal(urlDriveValid('https://drive.google.com/open?id=abc123'), true);
  assert.equal(urlDriveValid('https://docs.google.com/document/d/abc123/edit'), true);
});

uji('menolak URL berbahaya atau bukan Drive', () => {
  const jahat = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://evil.example.com/file/d/abc/view',
    'https://drive.google.com.evil.example/id',
    'file:///etc/passwd',
    'http://localhost:8080/x',
    'bukan-url',
    42, null, undefined, {},
  ];
  for (const v of jahat) assert.equal(urlDriveValid(v), false, `harus false: ${JSON.stringify(v)}`);
});

console.log('validasiMetadataDokumen');

uji('menerima metadata sah', () => {
  assert.equal(validasiMetadataDokumen({
    url: 'https://drive.google.com/file/d/abc/view',
    fileType: 'PDF',
  }), null);
  assert.equal(validasiMetadataDokumen({
    url: 'https://drive.google.com/drive/folders/abc',
    fileType: 'Lainnya',
    files: [
      { name: 'foto.jpg', url: 'https://drive.google.com/file/d/a/view' },
      { name: 'data.xlsx', url: 'https://drive.google.com/file/d/b/view' },
    ],
  }), null);
  assert.equal(validasiMetadataDokumen({ url: '', fileType: '' }), null);
  assert.equal(validasiMetadataDokumen({}), null);
});

uji('menolak url bukan Google Drive', () => {
  const m = validasiMetadataDokumen({ url: 'https://evil.example.com/laporan.pdf' });
  assert.ok(m && m.includes('Google Drive'), m);
});

uji('menolak fileType di luar label yang sah', () => {
  for (const v of ['Dokumen Jahat', 'PDF; DROP', 123, {}, 'pdf']) {
    const m = validasiMetadataDokumen({ url: 'https://drive.google.com/file/d/a/view', fileType: v });
    assert.ok(m && m.includes('fileType'), `harus ditolak: ${JSON.stringify(v)} → ${m}`);
  }
});

uji('menolak ekstensi file di luar allowlist', () => {
  for (const name of ['halaman.html', 'skrip.js', 'program.php', 'tool.exe', 'ikon.svg', 'tanpa-ekstensi']) {
    const m = validasiMetadataDokumen({ files: [{ name, url: 'https://drive.google.com/file/d/a/view' }] });
    assert.ok(m, `harus ditolak: ${name}`);
    assert.ok(m.includes('tidak diizinkan') || m.includes('ekstensi'), m);
  }
});

uji('menolak files[] dengan url bukan Drive', () => {
  const m = validasiMetadataDokumen({ files: [{ name: 'laporan.pdf', url: 'https://evil.example.com/x' }] });
  assert.ok(m && m.includes('Google Drive'), m);
});

uji('menolak fileType yang tidak cocok ekstensi file', () => {
  const m = validasiMetadataDokumen({
    fileType: 'Excel',
    files: [{ name: 'laporan.pdf', url: 'https://drive.google.com/file/d/a/view' }],
  });
  assert.ok(m && m.includes('tidak cocok'), m);
});

uji('fileType kosong boleh — label nanti diisi klien mana pun', () => {
  assert.equal(validasiMetadataDokumen({
    files: [{ name: 'laporan.pdf', url: 'https://drive.google.com/file/d/a/view' }],
  }), null);
});

uji('menolak files bukan array', () => {
  const m = validasiMetadataDokumen({ files: 'laporan.pdf' });
  assert.ok(m && m.includes('array'), m);
});

console.log('validasiLabelFileTipe (edit dokumen)');

uji('menerima label sah dan kosong', () => {
  for (const v of ['PDF', 'Word', 'Excel', 'PowerPoint', 'Lainnya', '', null, undefined])
    assert.equal(validasiLabelFileTipe(v), null, `harus lolos: ${JSON.stringify(v)}`);
});

uji('menolak label di luar daftar', () => {
  for (const v of ['Gambar', 'HTML', 'Word ', 42, {}]) {
    const m = validasiLabelFileTipe(v);
    assert.ok(m, `harus ditolak: ${JSON.stringify(v)}`);
  }
});

console.log('EKSTENSI_AMAN');

uji('allowlist tidak memuat tipe yang bisa menampilkan skrip', () => {
  for (const e of ['html', 'htm', 'js', 'mjs', 'php', 'svg', 'xhtml', 'exe', 'sh', 'bat', 'scr', 'vbs', 'jar', 'wsf'])
    assert.equal(EKSTENSI_AMAN.has(e), false, `tidak boleh ada: ${e}`);
});

console.log(`\n${lulus} uji lulus`);
