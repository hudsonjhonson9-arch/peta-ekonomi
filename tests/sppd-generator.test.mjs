import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import {
  bangunTagsSPT,
  bangunTagsSPPD,
  bangunHtmlSPT,
  bangunHtmlSPPD,
  splitDasar,
  TTD_DEFAULT,
  PARAF_DEFAULT
} from '../src/utils/sppdDocxGenerator.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const readDocXml = (file) => {
  const buf = fs.readFileSync(path.join(ROOT, file));
  const zip = new PizZip(buf);
  return zip.file('word/document.xml').asText();
};

test('templates 2026: memiliki prolog XML dan tag wajib', () => {
  const sptXml = readDocXml('public/templates/spt_template.docx');
  assert.ok(sptXml.startsWith('<?xml') || sptXml.includes('<w:document'), 'spt_template harus memiliki prolog XML');
  assert.ok(sptXml.includes('{#dasarRows}'), 'spt_template memuat {#dasarRows}');
  assert.ok(sptXml.includes('{#pelaksana}'), 'spt_template memuat {#pelaksana}');
  assert.ok(sptXml.includes('{KepadaLabel}'), 'spt_template memuat {KepadaLabel}');
  assert.ok(sptXml.includes('{Paraf1}'), 'spt_template memuat {Paraf1}');
  assert.ok(sptXml.includes('{Paraf2}'), 'spt_template memuat {Paraf2}');
  assert.ok(sptXml.includes('{Paraf3}'), 'spt_template memuat {Paraf3}');

  const sppdXml = readDocXml('public/templates/sppd_template.docx');
  assert.ok(sppdXml.startsWith('<?xml') || sppdXml.includes('<w:document'), 'sppd_template harus memiliki prolog XML');
  assert.ok(sppdXml.includes('{NomorSPPD}'), 'sppd_template memuat {NomorSPPD}');
  assert.ok(sppdXml.includes('{SekretarisNama}'), 'sppd_template memuat {SekretarisNama}');
  assert.ok(sppdXml.includes('{BidangNama}'), 'sppd_template memuat {BidangNama}');
  assert.ok(sppdXml.includes('{PPTKJabatan}'), 'sppd_template memuat {PPTKJabatan}');
  assert.ok(sppdXml.includes('{Paraf1}'), 'sppd_template memuat {Paraf1}');
  assert.ok(sppdXml.includes('{Paraf2}'), 'sppd_template memuat {Paraf2}');
  assert.ok(sppdXml.includes('{Paraf3}'), 'sppd_template memuat {Paraf3}');
});

test('splitDasar: memecah string dasar multi-baris menjadi array {No, Teks}', () => {
  const text = `DPA Bapperida Kabupaten Sumba Barat TA 2026
Nota Dinas Sekretaris Daerah Nomor 001/2026
Surat Undangan Bappeda Provinsi NTT`;
  const res = splitDasar(text);
  assert.equal(res.length, 3);
  assert.deepEqual(res[0], { No: 1, Teks: 'DPA Bapperida Kabupaten Sumba Barat TA 2026' });
  assert.deepEqual(res[1], { No: 2, Teks: 'Nota Dinas Sekretaris Daerah Nomor 001/2026' });
  assert.deepEqual(res[2], { No: 3, Teks: 'Surat Undangan Bappeda Provinsi NTT' });
});

test('bangunTagsSPT: menghasilkan dasarRows dan pelaksana multi-personil (KepadaLabel hanya baris 1)', () => {
  const mockItem = {
    nomor_spt: '001/SPT/BAPPERIDA/2026',
    dasar_hukum: 'Dasar baris 1\nDasar baris 2',
    maksud_perjalanan: 'Konsultasi Perencanaan Anggaran',
    tempat_berangkat: 'Waikabubak',
    tempat_tujuan: 'Kupang',
    tanggal_spt: '2026-11-20',
    pelaksana_nama: 'Budi Santoso',
    pelaksana_nip: '19850101 201001 1 001',
    pelaksana_pangkat: 'Pembina / IV a',
    pelaksana_jabatan: 'Kepala Bidang PPE',
    pengikut: [
      {
        nama: 'Siti Aminah',
        nip: '19900202 201502 2 002',
        pangkat: 'Penata / III c',
        jabatan: 'Perencana Ahli Muda'
      }
    ],
    penandatangan: {
      status: 'Definitif',
      jabatan: 'Kepala BAPPERIDA',
      nama: 'CHARLES HERMANA WERU,S.Sos',
      pangkat: 'Pembina Utama Muda – IV/c',
      nip: '19721102 200112 1 001'
    },
    paraf: ['Sekretaris BAPPERIDA', 'Kepala Bidang PPE', 'Kasubbag Umum & Kepegawaian']
  };

  const tags = bangunTagsSPT(mockItem);
  assert.equal(tags.Nomor, '001/SPT/BAPPERIDA/2026');
  assert.equal(tags.dasarRows.length, 2);
  assert.equal(tags.dasarRows[0].Teks, 'Dasar baris 1');

  assert.equal(tags.pelaksana.length, 2);
  assert.equal(tags.pelaksana[0].Nama, 'Budi Santoso');
  assert.equal(tags.pelaksana[0].KepadaLabel, 'Kepada');
  assert.equal(tags.pelaksana[0].TitikLabel, ':');

  assert.equal(tags.pelaksana[1].Nama, 'Siti Aminah');
  assert.equal(tags.pelaksana[1].KepadaLabel, '');
  assert.equal(tags.pelaksana[1].TitikLabel, '');

  assert.equal(tags.KepalaNama, 'CHARLES HERMANA WERU,S.Sos');
  assert.equal(tags.Paraf1, 'Sekretaris BAPPERIDA');
  assert.equal(tags.Paraf2, 'Kepala Bidang PPE');
  assert.equal(tags.Paraf3, 'Kasubbag Umum & Kepegawaian');
});

test('bangunTagsSPPD: menghasilkan PPTKJabatan dan 3 paraf', () => {
  const mockItem = {
    nomor_sppd: '001/SPPD/BAPPERIDA/2026',
    pelaksana_nama: 'Budi Santoso',
    pelaksana_nip: '19850101 201001 1 001',
    pelaksana_pangkat: 'Pembina / IV a',
    pelaksana_jabatan: 'Kepala Bidang PPE',
    maksud_perjalanan: 'Konsultasi Perencanaan Anggaran',
    tempat_berangkat: 'Waikabubak',
    tempat_tujuan: 'Kupang',
    tingkat_biaya: 'Tingkat C',
    alat_angkutan: 'Pesawat Udara (Ekonomi)',
    tanggal_berangkat: '2026-11-20',
    tanggal_kembali: '2026-11-23',
    lama_hari: 4,
    instansi: 'BAPPERIDA Kabupaten Sumba Barat',
    subkegiatan_nama: 'Penyusunan RKPD Kabupaten Sumba Barat',
    penandatangan: {
      status: 'Plt.',
      jabatan: 'Kepala BAPPERIDA',
      nama: 'IMANUEL MOSES KALEGOTAN, ST.,M.Si',
      pangkat: 'Pembina Tk. I - IV/b',
      nip: '19800315 200501 1 011'
    },
    paraf: ['Sekretaris BAPPERIDA', 'Kepala Bidang PPE', 'Kasubbag Umum']
  };

  const tags = bangunTagsSPPD(mockItem);
  assert.equal(tags.NomorSPPD, '001/SPPD/BAPPERIDA/2026');
  assert.equal(tags.Nama, 'Budi Santoso');
  assert.equal(tags.KepalaNama, 'IMANUEL MOSES KALEGOTAN, ST.,M.Si');
  assert.match(tags.JabatanTtd, /PLT/i);
  assert.equal(tags.Paraf1, 'Sekretaris BAPPERIDA');
  assert.equal(tags.Paraf2, 'Kepala Bidang PPE');
  assert.equal(tags.Paraf3, 'Kasubbag Umum');
});

test('Docxtemplater: template SPT dan SPPD sukses dirender tanpa tag tak terdefinisi', () => {
  const sptBuf = fs.readFileSync(path.join(ROOT, 'public/templates/spt_template.docx'));
  const sptZip = new PizZip(sptBuf);
  const sptDoc = new Docxtemplater(sptZip, { delimiters: { start: '{', end: '}' }, paragraphLoop: true, linebreaks: true });
  const mockSpt = {
    nomor_spt: '001/SPT/2026',
    dasar_hukum: 'Dasar 1\nDasar 2',
    maksud_perjalanan: 'Rakor Perencanaan',
    tempat_berangkat: 'Waikabubak',
    tempat_tujuan: 'Tambolaka',
    pelaksana_nama: 'Alex',
    pelaksana_nip: '19800101',
    pelaksana_pangkat: 'IV/a',
    pelaksana_jabatan: 'Kabid',
    pengikut: [{ nama: 'Dedi', nip: '19900101', pangkat: 'III/b', jabatan: 'Staf' }],
    penandatangan: { status: 'Definitif', nama: 'Kaban', pangkat: 'IV/c', nip: '19700101', jabatan: 'Kepala BAPPERIDA' },
    paraf: ['Sekretaris', 'Kabid', 'Kasubbag']
  };
  sptDoc.render(bangunTagsSPT(mockSpt));
  const sptOut = sptDoc.getZip().generate({ type: 'nodebuffer' });
  assert.ok(sptOut.length > 50000, 'SPT docx rendered binary size > 50KB');

  const sppdBuf = fs.readFileSync(path.join(ROOT, 'public/templates/sppd_template.docx'));
  const sppdZip = new PizZip(sppdBuf);
  const sppdDoc = new Docxtemplater(sppdZip, { delimiters: { start: '{', end: '}' }, paragraphLoop: true, linebreaks: true });
  sppdDoc.render(bangunTagsSPPD(mockSpt, mockSpt.pengikut[0]));
  const sppdOut = sppdDoc.getZip().generate({ type: 'nodebuffer' });
  assert.ok(sppdOut.length > 50000, 'SPPD docx rendered binary size > 50KB');
});

test('KOP Sekretariat Daerah & BAPPERIDA: mendukung tag dan HTML berlogo Lambang Kabupaten Sumba Barat', () => {
  const itemBapperida = {
    nomor_spt: '001/SPT/2026',
    nomor_sppd: '001/SPPD/2026',
    kop_surat: 'BAPPERIDA',
    pelaksana_nama: 'Achmad Aqil Susanto, S.Kom',
    pelaksana_nip: '200206302025061002',
    maksud_perjalanan: 'Koordinasi Sistem',
    tempat_berangkat: 'Waikabubak',
    tempat_tujuan: 'Kupang'
  };

  const tagsBap = bangunTagsSPT(itemBapperida);
  assert.match(tagsBap.KopInstansi1, /BADAN PERENCANAAN PEMBANGUNAN/i);
  assert.match(tagsBap.KopInstansi2, /RISET DAN INOVASI DAERAH/i);

  const htmlSptBap = bangunHtmlSPT(itemBapperida);
  assert.ok(htmlSptBap.includes('Lambang_Kabupaten_Sumba_Barat.png'), 'HTML SPT wajib memuat logo Lambang Kabupaten Sumba Barat');
  assert.ok(htmlSptBap.includes('BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH'));

  const itemSekda = {
    ...itemBapperida,
    kop_surat: 'SEKDA',
    wewenang: { kop_surat: 'SEKDA' }
  };

  const tagsSekda = bangunTagsSPT(itemSekda);
  assert.equal(tagsSekda.KopInstansi1, 'SEKRETARIAT DAERAH');
  assert.equal(tagsSekda.KopInstansi2, '');

  const htmlSptSekda = bangunHtmlSPT(itemSekda);
  assert.ok(htmlSptSekda.includes('Lambang_Kabupaten_Sumba_Barat.png'), 'HTML SPT Sekda wajib memuat logo');
  assert.ok(htmlSptSekda.includes('SEKRETARIAT DAERAH'), 'HTML SPT Sekda wajib memuat SEKRETARIAT DAERAH');

  const htmlSppdSekda = bangunHtmlSPPD(itemSekda);
  assert.ok(htmlSppdSekda.includes('Lambang_Kabupaten_Sumba_Barat.png'), 'HTML SPPD Sekda wajib memuat logo');
  assert.ok(htmlSppdSekda.includes('SEKRETARIAT DAERAH'), 'HTML SPPD Sekda wajib memuat SEKRETARIAT DAERAH');
  assert.ok(htmlSppdSekda.includes('IV.') && htmlSppdSekda.includes('Tiba<br/>pada<br/>Tanggal'), 'HTML SPPD wajib memiliki bagian Romawi IV sesuai format template');
});

test('Romawi I (Berangkat dari) per personil: setiap personil dapat memiliki Pejabat Pengesah (PPTK/Kabid/Kasubbag) masing-masing', () => {
  const mockItem = {
    nomor_sppd: '001/SPPD-DD/2026',
    tempat_berangkat: 'Waikabubak',
    tempat_tujuan: 'Kupang',
    tanggal_berangkat: '2026-11-14',
    tanggal_kembali: '2026-11-16',
    pelaksana_nama: 'Achmad Aqil Susanto, S.Kom',
    pelaksana_nip: '200206302025061002',
    pelaksana_pangkat: 'Penata Muda (III/a)',
    pelaksana_jabatan: 'Pranata Komputer Ahli Pertama',
    wewenang: {
      bidang: {
        jabatan: 'Kepala Bidang PPE',
        nama: 'BERLIAN MAGU WERU,S.Sos',
        nip: '19690619 200903 1 001'
      },
      pelaksana_pptk: {
        jabatan: 'KASUBBAG UMUM DAN KEPEGAWAIAN',
        nama: 'Yohanes Bergmans Pati Makin, SE',
        nip: '19701126 200904 1 001'
      }
    },
    pengikut: [
      {
        nama: 'Agustinus Mada Leko',
        nip: '19810817 201001 1 005',
        pangkat: 'Pengatur (II/c)',
        jabatan: 'Pengadministrasi Umum',
        pptk_jabatan: 'KEPALA BIDANG RISET DAN INOVASI DAERAH',
        pptk_nama: 'Yahya Antosari Story, S.Ip',
        pptk_nip: '19790707 200312 1 006'
      },
      {
        nama: 'Binoni Saubaki, ST',
        nip: '19880412 201503 1 002',
        pangkat: 'Penata (III/c)',
        jabatan: 'Perencana Ahli Muda',
        pptk_jabatan: 'KEPALA BIDANG PPE',
        pptk_nama: 'BERLIAN MAGU WERU,S.Sos',
        pptk_nip: '19690619 200903 1 001',
        tempat_berangkat: 'Waikabubak',
        tempat_tujuan: 'Tambolaka',
        tanggal_berangkat: '2026-11-15'
      }
    ]
  };

  // Personil 1 memakai wewenang.pelaksana_pptk (atau person override)
  const tagsP1 = bangunTagsSPPD(mockItem, null);
  assert.equal(tagsP1.Nama, 'Achmad Aqil Susanto, S.Kom');
  assert.equal(tagsP1.PPTKJabatan, 'KASUBBAG UMUM DAN KEPEGAWAIAN');
  assert.equal(tagsP1.BidangNama, 'Yohanes Bergmans Pati Makin, SE');
  assert.equal(tagsP1.BidangNIP, '19701126 200904 1 001');

  // Personil 2 memakai pptk_* miliknya sendiri
  const tagsP2 = bangunTagsSPPD(mockItem, mockItem.pengikut[0]);
  assert.equal(tagsP2.Nama, 'Agustinus Mada Leko');
  assert.equal(tagsP2.PPTKJabatan, 'KEPALA BIDANG RISET DAN INOVASI DAERAH');
  assert.equal(tagsP2.BidangNama, 'Yahya Antosari Story, S.Ip');
  assert.equal(tagsP2.BidangNIP, '19790707 200312 1 006');

  // Personil 3 memakai pptk_* dan rute/tanggal berangkat spesifik jika diisi
  const tagsP3 = bangunTagsSPPD(mockItem, mockItem.pengikut[1]);
  assert.equal(tagsP3.Nama, 'Binoni Saubaki, ST');
  assert.equal(tagsP3.PPTKJabatan, 'KEPALA BIDANG PPE');
  assert.equal(tagsP3.BidangNama, 'BERLIAN MAGU WERU,S.Sos');
  assert.equal(tagsP3.TempatTujuanBerangkat, 'Tambolaka');
  assert.equal(tagsP3.TanggalBerangkatRomawiI, '15 November 2026');
});

test('Tingkat Biaya per personil & Struktur Baris Tabel Lembar I (Sesuai Template)', () => {
  const mockItem = {
    nomor_sppd: '001/SPPD-LD/2026',
    jenis_sppd: 'LUAR_DAERAH',
    tingkat_biaya: 'Tingkat B',
    pelaksana_nama: 'Achmad Aqil Susanto, S.Kom',
    pelaksana_nip: '200206302025061002',
    pelaksana_pangkat: 'Penata Muda (III/a)',
    pelaksana_jabatan: 'Pranata Komputer Ahli Pertama',
    pelaksana_tingkat_biaya: 'Tingkat B',
    pengikut: [
      {
        nama: 'Elia Safari Kondi',
        nip: '199501012020121001',
        pangkat: 'Pengatur (II/c)',
        jabatan: 'Staf Administrasi',
        tingkat_biaya: 'Tingkat D'
      }
    ]
  };

  const tagsP1 = bangunTagsSPPD(mockItem, null);
  assert.equal(tagsP1.TingkatBiaya, 'Tingkat B');

  const tagsP2 = bangunTagsSPPD(mockItem, mockItem.pengikut[0]);
  assert.equal(tagsP2.TingkatBiaya, 'Tingkat D');

  const htmlP1 = bangunHtmlSPPD(mockItem, null);
  assert.ok(htmlP1.includes('a. Pangkat dan Golongan'), 'HTML harus memuat poin 3.a');
  assert.ok(htmlP1.includes('b. Jabatan / Instansi'), 'HTML harus memuat poin 3.b');
  assert.ok(htmlP1.includes('c. Tingkat Biaya Perjalanan Dinas'), 'HTML harus memuat poin 3.c');
  assert.ok(htmlP1.includes('c. Tingkat B'), 'HTML Personil 1 harus menampilkan Tingkat B');

  const htmlP2 = bangunHtmlSPPD(mockItem, mockItem.pengikut[0]);
  assert.ok(htmlP2.includes('c. Tingkat D'), 'HTML Personil 2 harus menampilkan Tingkat D');
});
