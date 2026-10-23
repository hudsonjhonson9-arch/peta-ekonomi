import * as XLSX from "xlsx";
// Rumus total baris dipakai bersama dengan server (DraftRincian & endpoint
// draft-rincian) supaya angka Total di Excel = total di aplikasi. Modul ini
// murni object-in/object-out, tanpa dependensi server — aman dipakai klien.
import { jumlahItem } from "../../server/draft-rincian.js";

// ── Ekspor Screening RKA ke Excel ───────────────────────────────────────────
// Workbook berisi empat jenis sheet:
//   1. sheet "Rekap" — ringkasan pagu per sub kegiatan (SUMIFS dari sheet
//      Rincian + % terhadap total),  2. sheet "Rekap Rekening" — pivot kode
//      rekening x sub kegiatan,  3. sheet "Rincian" — baris datar tiap item
//      (koefisien x harga, PPN = 0) — ketiganya ala RKA_2027_BKAD_Rekap;
//   4. sheet ringkas "Screening RKA" dengan grouping Excel (outline) supaya
//      bisa dilipat-expand seperti accordion:
//        level 1 → baris Program (ringkas, selalu tampil walau anak dilipat)
//        level 2 → baris Kegiatan
//        level 3 → baris Sub Kegiatan
//        level 4 → baris rincian belanja (header kelompok + per item)
//   5. satu sheet DETAIL per sub kegiatan — tab "<kode> <nama>" (maks 31
//      karakter) berisi baris sub + seluruh rincian belanjanya, tiap
//      kelompok bisa dilipat sendiri (kelompok level 2, item level 3);
//      bisa dibuka/cetak per sub tanpa menggulir sheet panjang.
//
// ── SATU BLOK KOLOM untuk baris pohon dan baris rincian ────────────────────
// Baris pohon mengisi kolom 0–10; baris rincian mengisi kolom 1–8 pada blok
// YANG SAMA (kolom kembar: "Kode / Rekening", "Nama / Uraian", dst.).
// Desain ini wajib: versi lama menaruh rincian di kolom K–S (jauh ke kanan),
// padahal blok ringkas A–J selebar ±194 karakter (~1.350 px) — di layar
// laptop baris rincian tampak KOSONG TOTAL sampai menggulir jauh ke kanan,
// sehingga dikira tidak ikut tercetak. Dengan gabung, uraian–volume–harga
// rincian langsung terlihat di layar pertama.
//
// ── WARNA BARIS per tingkat ────────────────────────────────────────────────
// Program (navy), Kegiatan (biru sedang), Sub Kegiatan (biru muda), header
// kelompok rincian (abu), baris item putih — hierarki terbaca sekilas.
// Ditambah dua polesan pada selnya:
//   • uang  → format Rp Indonesia numFmt 164 "[$Rp-421]#,##0" (negatif merah)
//             untuk semua sel rupiah (pagu/harga/realisasi/total/rencana/
//             selisih);
//   • wrap  → wrapText + vertical top untuk teks panjang: nama & indikator
//             baris Program/Kegiatan/Sub, uraian & spesifikasi rincian —
//             teks panjang turun baris sendiri, baris ikut memanjang (auto
//             height) sehingga rapi, tidak terpotong.
// Sel total juga memakai RUMUS Excel (ROUND/SUM/jumlah sel anak) alih-alih
// angka mati — nilai cache tetap ikut tertulis supaya pratinjau tanpa
// kalkulasi menampilkan angka yang sama.
// SheetJS community TIDAK menulis cell.s (fill/font) saat write — sudah
// diverifikasi: fills.xml tetap default. Karena itu gaya dipasang dengan
// patch manual: tulis ulang xl/styles.xml (numFmt+font+fill+xfs milik kita)
// dan tambahkan atribut s="n" pada tiap sel di xl/worksheets/sheet1.xml,
// lalu zip ulang semua entry (semua STORE/tanpa kompresi, jadi aman ditulis
// ulang tanpa zlib — penting: modul ini juga berjalan di browser).
//
// Tingkat diset mulai dari 1 (bukan 0) karena SheetJS mengabaikan
// `level: 0` pada baris pertama data — sudah diverifikasi di XML mentah
// (outlineLevel="1"/"2" tertulis, tapi baris ber-level 0 hilang).
// Cukup `!rows[i].level` saja untuk menulis outlineLevel. Tombol lipat [-]/[+]
// muncul otomatis begitu outlineLevel ada.
//
// `!outline = { above: true }` WAJIB: tanpanya Excel memakai default
// summaryBelow=1 (baris ringkas DI BAWAH anak), padahal baris Program/
// Kegiatan/Sub di file ini ada DI ATAS anaknya — akibatnya tombol lipat
// meleset satu grup ([-] Program jadi melipat blok program sebelumnya).
// Dengan summaryBelow="0" baris ringkas di atas anak, lipat-expand seperti
// accordion yang benar. (Key-nya `above`, BUKAN `summaryBelow` — itulah
// sebelumnya dikira tidak ditulis writer xlsx.)

// Sel numerik asli (bukan string) supaya bisa dijumlah/difilter di Excel;
// kosong bila null supaya tidak menampilkan 0 palsu.
const angka = n => (n == null || n === "" || !Number.isFinite(Number(n))
  ? "" : Number(n));

// Label status validasi sub kegiatan — samakan dengan STATUS_UI di ScreeningRKA.
const labelStatus = s => ({
  draft: "Draft", menunggu: "Menunggu", disetujui: "Disetujui", ditolak: "Ditolak",
}[s] || "Draft");

// Indeks xf (cellXfs) di GAYA_XML — dipakai sebagai nilai atribut s="n".
// Tiap jenis baris (kunci peta di bawah: 0 item, 1 header, 2 program,
// 3 kegiatan, 4 sub, 5 kelompok) punya varian polos/wrap/uang. Wrap dan uang
// tidak pernah menempel di sel yang sama (kolom teks vs kolom rupiah),
// jadi cukup tiga varian per jenis — lihat KOL_WRAP/KOL_UANG.
const ST = { header: 1, program: 2, kegiatan: 3, sub: 4, kelompok: 5 };
const ST_WRAP = { 0: 6, 1: 1, 2: 7, 3: 8, 4: 9, 5: 10 };
const ST_UANG = { 0: 11, 1: 12, 2: 13, 3: 14, 4: 15, 5: 16 };
// Varian persen (numFmt 10 = 0.00%): baris polos & baris total saja —
// kepala kolom tetap memakai gaya basisnya supaya tidak ada sel putih di
// tengah baris berwarna.
const ST_PCT = { 0: 17, 5: 18 };
// Kolom di-wrap (teks panjang): nama+indikator baris pohon, uraian +
// spesifikasi + keterangan rincian, nama kelompok.
const KOL_WRAP = {
  0: [2, 3, 8],       // item: uraian, spesifikasi, catatan
  1: [],              // header tabel: tidak
  2: [2],             // program: nama
  3: [2],             // kegiatan: nama
  4: [2, 3, 4, 8],    // sub: nama, indikator, target, status
  5: [2],             // kelompok: nama
};
// Kolom berisi rupiah → format Rp numFmt 164.
const KOL_UANG = {
  0: [6, 7],              // item: harga satuan, total
  1: [],
  2: [6],                 // program: pagu (baris ringkas hanya pagu)
  3: [6],                 // kegiatan: pagu
  4: [6, 7, 9, 10],       // sub: pagu, realisasi, rencana, selisih
  5: [7],                 // kelompok: total
};

// Stylesheet milik kita, MENGGANTIKAN styles.xml bawaan SheetJS (yang hanya
// berisi default). Posisi fill & font harus selaras dengan ST di atas.
// Urutan elemen mengikuti CT_Stylesheet: numFmts → fonts → fills → borders →
// cellStyleXfs → cellXfs → cellStyles → dxfs → tableStyles.
// cellXfs (17 entri — urutannya adalah indeks s="n"):
//   0–5   polos : default, header, program, kegiatan, sub, kelompok
//   6–10  wrap  : item, program, kegiatan, sub, kelompok (header tak di-wrap)
//   11–16 uang  : item, header, program, kegiatan, sub, kelompok
// numFmt 164 = "[$Rp-421]#,##0" (rupiah + pemisah ribuan locale ID;
// sisi negatif merah untuk kolom Selisih).
const GAYA_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="[$Rp-421]#,##0;[Red]-[$Rp-421]#,##0"/></numFmts>
<fonts count="4">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><b/><sz val="11"/><color rgb="FF1F4E79"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF9DC3E6"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDEEBF7"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF44546A"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="19">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="2" fillId="5" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="2" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="3" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="4" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="164" fontId="1" fillId="6" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="10" fontId="1" fillId="6" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="0"/>
<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;

// ── Zip STORE minimal (baca + tulis ulang) ─────────────────────────────────
// Tanpa dependensi: keduanya dipakai untuk membongkar hasil tulis SheetJS
// (semua entry method=0) dan menyusunnya kembali dengan patch di dalamnya.

// Tabel CRC32 standar (refleksi 0xEDB88320) — diverifikasi dengan vektor
// uji resmi crc32("123456789") === 0xCBF43926 pada test ekspor.
const TABEL_CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  TABEL_CRC[n] = c >>> 0;
}
const crc32 = b => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = TABEL_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

// Hasil XLSX.write → daftar {nama, data} urut sesuai isi arsip.
function bacaZip(biner) {
  const b = biner instanceof Uint8Array ? biner : new Uint8Array(biner);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // EOCD: tanda tangan 0x06054b50, dicari dari akhir arsip.
  let eocd = -1;
  for (let i = b.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Bukan file xlsx (EOCD tidak ditemukan)");
  const jumlah = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  const hasil = [];
  let p = cdOffset;
  for (let i = 0; i < jumlah; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("Central directory rusak");
    const namaLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const komLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const nama = new TextDecoder().decode(b.subarray(p + 46, p + 46 + namaLen));
    const metode = dv.getUint16(lho + 8, true);
    const ukuran = dv.getUint32(p + 20, true);
    const lnl = dv.getUint16(lho + 26, true);
    const lel = dv.getUint16(lho + 28, true);
    if (metode !== 0) throw new Error(`Entry ${nama} terkompresi — penulisan ulang tidak didukung`);
    hasil.push({ nama, data: b.subarray(lho + 30 + lnl + lel, lho + 30 + lnl + lel + ukuran) });
    p += 46 + namaLen + extraLen + komLen;
  }
  return hasil;
}

// Susun ulang arsip STORE. DOS date tetap 1980-01-01 (0x0021); nama entry
// semua ASCII, jadi flag UTF-8 tidak diperlukan.
function tulisZip(entry) {
  const enc = new TextEncoder();
  const potongan = [], pusat = [];
  let offset = 0;
  for (const { nama, data } of entry) {
    const nb = enc.encode(nama);
    const crc = crc32(data);
    const lh = new Uint8Array(30 + nb.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0x0021, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nb.length, true); lv.setUint16(28, 0, true);
    lh.set(nb, 30);
    potongan.push(lh, data);

    const ch = new Uint8Array(46 + nb.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true); cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true); cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x0021, true); cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, nb.length, true);
    // 30 extraLen, 32 komentarLen, 34 disk, 36 intAttr — nol semua (default 0).
    cv.setUint32(42, offset, true);
    ch.set(nb, 46);
    pusat.push(ch);
    offset += lh.length + data.length;
  }
  const cdSize = pusat.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, pusat.length, true); ev.setUint16(10, pusat.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);

  const semua = [...pusat, eocd];
  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of [...potongan, ...semua]) { out.set(c, pos); pos += c.length; }
  return out;
}

// Indeks kolom huruf A, B, C… → 0, 1, 2… (untuk membaca r="A12").
const kolNomor = kol => {
  let n = 0;
  for (let i = 0; i < kol.length; i++) n = n * 26 + (kol.charCodeAt(i) - 64);
  return n - 1;
};

// Pasang gaya: ganti styles.xml + beri atribut s pada tiap sel SEMUA sheet
// (workbook bisa berisi sheet ringkas + sheet detail per sub kegiatan).
// `daftar` = [{ nama: "xl/worksheets/sheet1.xml", warnaBaris, kolWrap?,
//               kolUang?, kolPct? }, …] — warnaBaris sejajar aoa sheet
// bersangkutan (0 = baris item polos); kolWrap/kolUang/kolPct menimpa
// peta kolom bawaan KOL_WRAP/KOL_UANG untuk sheet yang bentuk kolomnya
// beda (sheet Rekap/Rincian punya posisi kolom uang & persen sendiri).
// Sel rupiah, persen & teks panjang dinaikkan ke varian sesuai kolomnya —
// wrap/uang/pct tidak pernah menempel di sel yang sama (kolom teks vs
// kolom angka), jadi pemilihannya if/else berurutan sudah cukup.
function pasangWarna(biner, daftar) {
  const entri = bacaZip(biner);
  const peta = new Map(daftar.map(d => [d.nama, d]));
  let tertempel = 0;
  for (const e of entri) {
    const d = peta.get(e.nama);
    if (!d) continue;
    const warnaBaris = d.warnaBaris;
    const teks = new TextDecoder().decode(e.data);
    // <c r="A2" ...> → <c r="A2" s="n" ...> (atribut XML bebas urutan, aman
    // disisipkan tepat setelah r=".."). Bagian attr ditangkap apa adanya
    // supaya sel self-closing ("<c .../>") ikut tertambal rapi.
    e.data = new TextEncoder().encode(
      teks.replace(/<c r="([A-Z]+)(\d+)"([^>]*?)(\/?)>/g,
        (m, kol, bris, sisa, tutup) => {
          const basis = warnaBaris[Number(bris) - 1] || 0;
          const ci = kolNomor(kol);
          const wrap = d.kolWrap || KOL_WRAP[basis] || [];
          const uang = d.kolUang || KOL_UANG[basis] || [];
          const pct = d.kolPct || [];
          const st = wrap.includes(ci) ? ST_WRAP[basis]
            : uang.includes(ci) ? ST_UANG[basis]
            : pct.includes(ci) && ST_PCT[basis] != null ? ST_PCT[basis]
            : basis;
          return st ? `<c r="${kol}${bris}"${sisa} s="${st}"${tutup}>` : m;
        })
    );
    tertempel++;
  }
  if (tertempel !== daftar.length)
    throw new Error(`Sheet tidak ditemukan di xlsx: ${daftar.length - tertempel}`);
  const gaya = entri.find(e => e.nama === "xl/styles.xml");
  if (!gaya) throw new Error("styles.xml tidak ditemukan di xlsx");
  gaya.data = new TextEncoder().encode(GAYA_XML);
  return tulisZip(entri);
}

// Satu blok 11 kolom untuk SEMUA jenis baris; nama kepala memakai pola
// "pohon / rincian" supaya jelas isi tiap sisi. Posisi kolom:
//   0 Level          indentasi (NBSP) — baris semua jenis
//   1 Kode/Rekening  kode pohon | kode rekening rincian
//   2 Nama/Uraian    nama pohon | uraian belanja | nama kelompok (header)
//   3 Indikator/Spes indikator pohon | spesifikasi rincian
//   4 Target/Volume  target pohon | volume rincian (angka)
//   5 Satuan         hanya rincian
//   6 Pagu/Harga     pagu (rupiah) | harga satuan (rupiah)
//   7 Realisasi/Total realisasi (rupiah) | total item | total kelompok
//   8 Status/Ket     status validasi | catatan rincian
//   9 Total Rencana  total rencana sub (pohon saja)
//  10 Selisih        rencana − pagu (pohon saja)
const KEPALA = [
  "Level", "Kode / Rekening", "Nama / Uraian", "Indikator / Spesifikasi",
  "Target / Volume", "Satuan", "Pagu / Harga Satuan", "Realisasi / Total",
  "Status / Keterangan", "Total Rencana", "Selisih Rencana − Pagu",
];

// Baris Program/Kegiatan diringkas jadi satu baris ringkas: teks kode+nama
// duduk di kolom Kode & Nama (bukan di kolom Level yang sempit), kolom lain
// dikosongkan supaya sheet tetap terbaca rapi saat dilipat. Kolom Pagu
// tetap terisi sebagai ringkasan pagu grup; kolom rincian (1–5, 7–8) kosong
// karena rincian milik sub kegiatan induknya.
const barisRingkas = (indentasi, kode, nama, pagu) => [
  indentasi,               // 0 Level (spasi indentasi saja)
  kode ?? "",              // 1 Kode
  nama ?? "",              // 2 Nama
  "", "", "",              // 3 Indikator, 4 Target, 5 Satuan
  angka(pagu),             // 6 Pagu (ringkas grup)
  "", "", "", "",          // 7 Realisasi, 8 Status, 9 Total Rencana, 10 Selisih
];

// Kelompok baris rincian ala SIPD: urut kemunculan pertama nama kelompok.
// Catatan DIPAKAI SEBAGAI KETERANGAN BARIS (bukan pembeda grup seperti di
// DraftRincian) — di laporan Excel, nama kelompok yang sama sebaiknya muncul
// sekali saja, bukan terbelah jadi beberapa header hanya karena catatan
// berbeda. Nama kelompok kosong = baris tanpa header, tampil biasa dan tidak
// digabung (urutannya menempel di tempatnya masing-masing).
function kelompokRincian(items) {
  const grup = [];
  const indeks = new Map();
  (items || []).forEach(it => {
    const nama = (it.kelompok_belanja || "").trim();
    let g;
    if (!nama) {
      g = { nama: "", baris: [], total: 0 };
      grup.push(g);                    // tanpa nama → selalu baris sendiri
    } else {
      g = indeks.get(nama);
      if (!g) {
        g = { nama, baris: [], total: 0 };
        indeks.set(nama, g);
        grup.push(g);                  // urut kemunculan pertama
      }
    }
    g.baris.push(it);
    if (it.volume != null && it.harga_satuan != null)
      g.total += jumlahItem(it.volume, it.harga_satuan);
  });
  return grup;
}

// Baris rincian menempati blok kolom yang sama dengan baris pohon:
// kolom 0 (Level) diisi indentasi, sisanya dari daftar pasang [indeks, nilai]
// — jangan pakai push, karena push menempel setelah kolom terisi dan
// menggeser semuanya.
const barisRincian = (indentasi, kolom) => {
  const baris = Array(KEPALA.length).fill("");
  baris[0] = indentasi;                    // Level (indentasi)
  kolom.forEach(([i, v]) => { baris[i] = v; });
  return baris;
};

// Lebar kolom dipakai semua sheet (ringkas & detail): seluruh blok rincian
// (kolom B–I) muat di layar laptop tanpa gulir ke kanan.
const LEBAR_KOL = [
  { wch: 4 },   // 0 Level
  { wch: 16 },  // 1 Kode / Rekening
  { wch: 42 },  // 2 Nama / Uraian
  { wch: 26 },  // 3 Indikator / Spesifikasi
  { wch: 15 },  // 4 Target / Volume
  { wch: 9 },   // 5 Satuan
  { wch: 17 },  // 6 Pagu / Harga Satuan
  { wch: 17 },  // 7 Realisasi / Total
  { wch: 22 },  // 8 Status / Keterangan
  { wch: 16 },  // 9 Total Rencana
  { wch: 18 },  // 10 Selisih
];

// Nama tab sheet: "<kode> <nama>", maksimal 31 karakter (batas Excel),
// karakter terlarang ( [ ] : * ? / \ ) diganti spasi, duplikat diberi
// akhiran " (2)", " (3)", … supaya book_append_sheet tidak menolak.
function namaSheet(unik, kandidat) {
  let dasar = String(kandidat ?? "")
    .replace(/[[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31)
    .trim() || "Sub Kegiatan";
  let nama = dasar, n = 2;
  while (unik.has(nama)) {
    const akhiran = ` (${n++})`;
    nama = dasar.slice(0, 31 - akhiran.length).trimEnd() + akhiran;
  }
  unik.add(nama);
  return nama;
}

// Rakit satu worksheet: nilai + rumus (dengan nilai cache <v>), outline
// accordion, lebar kolom. Dipakai sheet ringkas & sheet detail per sub.
// ops.opsional: { cols } menimpa lebar bawaan (sheet Rekap/Rincian punya
// jumlah kolom berbeda), { autofilter } menambahkan filter otomatis.
function susunSheet(aoa, rows, rumus, ops = {}) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Terapkan rumus: hanya sel angka finit yang diberi <f> — SheetJS ikut
  // menulis nilai cache <v>, jadi pembaca tanpa kalkulasi (pratinjau) tetap
  // melihat angka yang sama; Excel menghitung ulang saat sel diedit.
  for (const [ref, f] of Object.entries(rumus)) {
    const sel = ws[ref];
    if (sel && Number.isFinite(sel.v)) ws[ref] = { ...sel, f };
  }
  // INI kunci accordion: `!rows[i].level` ditulis sebagai atribut
  // outlineLevel di XML sheet. Baris tanpa `level` (kepala kolom) selalu
  // tampil; baris ber-level ikut terlipat saat tombol [-] ditekan.
  ws["!rows"] = rows;
  // Baris ringkas ada DI ATAS anak → summaryBelow=0 (key `above`, lihat
  // komentar fungsi); tanpanya tombol lipat meleset satu grup.
  ws["!outline"] = { above: true };
  ws["!cols"] = ops.cols || LEBAR_KOL;
  if (ops.autofilter) ws["!autofilter"] = ops.autofilter;
  return ws;
}

// Tulis satu blok "baris sub kegiatan + rincian belanjanya" ke struktur
// sheet (aoa/rows/warnaBaris/rumus pada konteks k). Dipakai dua kali:
// sheet ringkas (level sub 3, rincian 4) dan sheet detail per sub kegiatan
// (level sub 1, kelompok 2, item 3 — tiap kelompok bisa dilipat sendiri).
// Mengembalikan nomor baris sub (Excel, 1-based) untuk rumus agregat induk.
function tulisSub(k, s, rencana, o) {
  const { aoa, rows, warnaBaris, rumus, rincianPerSub } = k;
  const pagu = angka(s.pagu);
  const selisih = Number.isFinite(rencana) && pagu !== ""
    ? rencana - pagu : "";
  aoa.push([
    o.indentasi,                       // 0 Level (indentasi)
    s.kode ?? "",                      // 1 Kode
    s.nama ?? "",                      // 2 Nama
    s.indikator ?? "",                 // 3 Indikator
    s.target ?? "",                    // 4 Target
    "",                                // 5 Satuan (pohon tidak punya)
    pagu,                              // 6 Pagu (angka)
    angka(s.realisasi),                // 7 Realisasi (angka)
    labelStatus(s.status_validasi),    // 8 Status
    angka(rencana),                    // 9 Total Rencana (angka)
    angka(selisih),                    // 10 Selisih (angka; bisa negatif)
  ]);
  rows.push({ level: o.lvSub });
  warnaBaris.push(ST.sub);
  const rSub = aoa.length;

  // ── Rincian belanja sub kegiatan ini (opsional) ─────────────────────────
  const anak = [];            // sel total anak LANGSUNG sub (untuk rumus J)
  let jumlahAnak = 0;         // jumlahnya — harus persis = rencana server
  if (rincianPerSub) {
    for (const g of kelompokRincian(rincianPerSub[s.id])) {
      // Header kelompok: nama di kolom Nama/Uraian, totalnya di kolom
      // Realisasi/Total.
      if (g.nama) {
        aoa.push(barisRincian(o.indentasiRincian, [
          [2, g.nama],                        // Nama/Uraian = kelompok
          [7, angka(g.total)],                // Realisasi/Total kelompok
        ]));
        rows.push({ level: o.lvKepala });
        warnaBaris.push(ST.kelompok);
      }
      for (const it of g.baris) {
        aoa.push(barisRincian(o.indentasiRincian, [
          [1, it.kode_rekening || ""],        // Kode/Rekening
          [2, it.uraian ?? ""],               // Nama/Uraian
          [3, it.spesifikasi || ""],          // Indikator/Spesifikasi
          [4, angka(it.volume)],              // Target/Volume
          [5, it.satuan ?? ""],               // Satuan
          [6, angka(it.harga_satuan)],        // Pagu/Harga Satuan
          [7, angka(jumlahItem(it.volume, it.harga_satuan))], // Total
          [8, it.catatan || ""],              // Status/Keterangan
        ]));
        const r = aoa.length;
        rows.push({ level: o.lvRincian });
        warnaBaris.push(0);                   // item: putih, tanpa gaya
        // Rumus item: Total = ROUND(Volume × Harga Satuan, 0) — rumus yang
        // sama dengan jumlahItem() di server. Volume/harga tidak angka →
        // biarkan nilai mati seperti biasa.
        if (angka(it.volume) !== "" && angka(it.harga_satuan) !== "")
          rumus[`H${r}`] = `ROUND(E${r}*G${r},0)`;
        // Item tanpa nama kelompok = anak langsung sub.
        if (!g.nama) {
          anak.push(`H${r}`);
          const jml = jumlahItem(it.volume, it.harga_satuan);
          if (Number.isFinite(jml)) jumlahAnak += jml; else jumlahAnak = NaN;
        }
      }
      if (g.nama) {
        const rKep = aoa.length - g.baris.length;
        rumus[`H${rKep}`] = `SUM(H${rKep + 1}:H${aoa.length})`;
        anak.push(`H${rKep}`);
        if (Number.isFinite(g.total)) jumlahAnak += g.total;
        else jumlahAnak = NaN;
      }
    }
  }
  // Rumus agregat sub — hanya dipasang bila hasilnya persis sama dengan
  // nilai dari server; kalau beda, nilai server tetap dipakai seperti biasa.
  if (anak.length && Number.isFinite(jumlahAnak) &&
      Number.isFinite(rencana) && jumlahAnak === rencana)
    rumus[`J${rSub}`] = anak.join("+");
  if (Number.isFinite(rencana) && pagu !== "")
    rumus[`K${rSub}`] = `J${rSub}-G${rSub}`;
  return rSub;
}

// ── Tiga sheet ala RKA_2027_BKAD_Rekap ───────────────────────────────────
// Kepala kolom tiap sheet — POSISI KOLOM dipakai rumus SUMIFS di bawah,
// jadi ubah barengan dengan bangunTigaRekap().
const KEPALA_RINCIAN = [
  "No", "Kode Sub Kegiatan", "Sub Kegiatan", "Kode Rekening", "Sub Rincian",
  "Uraian", "Spesifikasi", "Koefisien", "Satuan", "Harga Satuan (Rp)",
  "PPN", "Total (Rp)",
];
const KEPALA_REKAP = [
  "No", "Kode Sub Kegiatan", "Sub Kegiatan", "Kegiatan",
  "Jumlah (Rp)", "% Terhadap Total",
];
const LEBAR_RINCIAN = [
  { wch: 5 }, { wch: 16 }, { wch: 34 }, { wch: 20 }, { wch: 26 }, { wch: 36 },
  { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 17 }, { wch: 7 }, { wch: 17 },
];
const LEBAR_REKAP = [
  { wch: 5 }, { wch: 16 }, { wch: 44 }, { wch: 46 }, { wch: 18 }, { wch: 12 },
];

// Susun tiga sheet rekap: "Rekap" (per sub kegiatan, % terhadap total),
// "Rekap Rekening" (pivot kode rekening x sub kegiatan) dan "Rincian"
// (baris datar koefisien x harga, PPN = 0 karena tidak ada field PPN di
// data). `subs` = daftar sub urut { idx, kode, nama, keg, pagu, jmlRincian };
// `datar` = seluruh baris rincian datar { subIdx, kodeSub, namaSub, it }.
// Semua sel angka total memakai rumus (SUMIFS/ROUND/SUM) DAN nilai cache
// yang dihitung ulang di JS — pratinjau tanpa kalkulasi tetap menampilkan
// angka yang sama dengan Excel. Rumus SUMIFS menyasar sheet Rincian:
// kolom L = Total, B = Kode Sub Kegiatan, D = Kode Rekening.
function bangunTigaRekap(tahun, subs, datar) {
  const akhir = datar.length + 1;          // baris terakhir data di Rincian
  const rng = kol => `Rincian!$${kol}$2:$${kol}$${akhir}`;

  // ── Sheet "Rincian" (dibangun dulu: jadi sumber SUMIFS kedua sheet) ──
  const rAoa = [KEPALA_RINCIAN], rRows = [{}], rWarna = [ST.header], rRumus = {};
  datar.forEach((d, i) => {
    const { it } = d;
    const vol = angka(it.volume), hrg = angka(it.harga_satuan);
    const adaAngka = vol !== "" && hrg !== "";
    rAoa.push([
      i + 1, d.kodeSub, d.namaSub, it.kode_rekening || "",
      it.kelompok_belanja || "", it.uraian ?? "", it.spesifikasi || "",
      vol, it.satuan ?? "", hrg, 0,
      adaAngka ? jumlahItem(it.volume, it.harga_satuan) : "",
    ]);
    rRows.push({});
    rWarna.push(0);
    if (adaAngka) {
      const r = rAoa.length;
      rRumus[`L${r}`] = `ROUND(H${r}*J${r}*(1+K${r}),0)`;
    }
  });

  // Nilai cache SUMIFS: jumlah per sub & per (sub, kode rekening).
  const perSub = subs.map(() => 0);
  const perSel = new Map();
  for (const d of datar) {
    const { it } = d;
    if (angka(it.volume) === "" || angka(it.harga_satuan) === "") continue;
    const t = jumlahItem(it.volume, it.harga_satuan);
    perSub[d.subIdx] += t;
    const kunci = `${d.subIdx}|${it.kode_rekening || ""}`;
    perSel.set(kunci, (perSel.get(kunci) || 0) + t);
  }
  // Sub tanpa rincian tetap menampilkan pagunya; rumus SUMIFS hanya
  // dipasang bila baris rincian sub itu memang ada.
  const nilai = subs.map((s, i) => (s.jmlRincian > 0 ? perSub[i] : angka(s.pagu)));
  const totalNilai = nilai.reduce(
    (a, v) => a + (Number.isFinite(Number(v)) ? Number(v) : 0), 0);

  // ── Sheet "Rekap" ─────────────────────────────────────────────────────
  const kAoa = [
    [`REKAPITULASI RKA BELANJA TAHUN ANGGARAN ${tahun ?? ""}`.trim()],
    ["Sumber: data Screening RKA aplikasi — Jumlah = SUMIFS sheet Rincian, PPN = 0"],
    [],
    KEPALA_REKAP,
  ];
  const kRows = [{}, {}, {}, {}];
  const kWarna = [ST.kelompok, 0, 0, ST.header];
  const kRumus = {};
  const rTotal = 4 + subs.length + 1;       // nomor baris Total (1-based)
  subs.forEach((s, i) => {
    const r = kAoa.length + 1;
    const v = nilai[i];
    const persen = Number.isFinite(Number(v)) && totalNilai
      ? Number(v) / totalNilai : 0;
    kAoa.push([i + 1, s.kode, s.nama, s.keg, angka(v), persen]);
    kRows.push({});
    kWarna.push(0);
    if (s.jmlRincian > 0)
      kRumus[`E${r}`] = `SUMIFS(${rng("L")},${rng("B")},B${r})`;
    kRumus[`F${r}`] = `IF($E$${rTotal}=0,0,E${r}/$E$${rTotal})`;
  });
  kAoa.push(["", "", "", "Total", totalNilai, totalNilai ? 1 : 0]);
  kRows.push({});
  kWarna.push(ST.kelompok);
  if (subs.length) {
    kRumus[`E${rTotal}`] = `SUM(E5:E${rTotal - 1})`;
    kRumus[`F${rTotal}`] = `SUM(F5:F${rTotal - 1})`;
  }

  // ── Sheet "Rekap Rekening" (pivot: baris = kode rekening, kolom = sub) ──
  const daftarRek = [], seenRek = new Set();
  for (const d of datar) {
    const k = d.it.kode_rekening || "";
    if (k && !seenRek.has(k)) { seenRek.add(k); daftarRek.push(k); }
  }
  const oAoa = [
    ["REKAP BELANJA PER KODE REKENING x SUB KEGIATAN"],
    ["Setiap sel = SUMIFS dari sheet Rincian"],
    [],
    ["Kode Rekening", ...subs.map(s => s.kode)],
    ["Sub Kegiatan", ...subs.map(s => s.nama)],
  ];
  const oRows = [{}, {}, {}, {}, {}];
  const oWarna = [ST.kelompok, 0, 0, ST.header, ST.sub];
  const oRumus = {};
  daftarRek.forEach(kode => {
    const r = oAoa.length + 1;
    const baris = [kode];
    subs.forEach((s, ci) => {
      const kol = XLSX.utils.encode_col(ci + 1);
      baris.push(perSel.get(`${s.idx}|${kode}`) || 0);
      oRumus[`${kol}${r}`] =
        `SUMIFS(${rng("L")},${rng("D")},$A${r},${rng("B")},${kol}$4)`;
    });
    oAoa.push(baris);
    oRows.push({});
    oWarna.push(0);
  });
  const rTotalO = oAoa.length + 1;
  oAoa.push(["Total", ...subs.map((s, ci) => daftarRek.reduce(
    (a, kode) => a + (perSel.get(`${s.idx}|${kode}`) || 0), 0))]);
  oRows.push({});
  oWarna.push(ST.kelompok);
  if (daftarRek.length && subs.length)
    subs.forEach((s, ci) => {
      const kol = XLSX.utils.encode_col(ci + 1);
      oRumus[`${kol}${rTotalO}`] = `SUM(${kol}6:${kol}${rTotalO - 1})`;
    });

  return [
    { nama: "Rekap", aoa: kAoa, rows: kRows, warna: kWarna, rumus: kRumus,
      kolUang: [4], kolPct: [5], ops: { cols: LEBAR_REKAP } },
    { nama: "Rekap Rekening", aoa: oAoa, rows: oRows, warna: oWarna,
      rumus: oRumus, kolUang: subs.map((_, i) => i + 1),
      ops: { cols: [{ wch: 22 }, ...subs.map(() => ({ wch: 15 }))] } },
    { nama: "Rincian", aoa: rAoa, rows: rRows, warna: rWarna, rumus: rRumus,
      kolWrap: [2, 5, 6], kolUang: [9, 11],
      ops: { cols: LEBAR_RINCIAN,
        autofilter: rAoa.length > 1 ? { ref: `A1:L${rAoa.length}` } : undefined } },
  ];
}

// Susun berkas xlsx utuh (sudah berwarna + ber-outline + ber-rumus), tapi
// TIDAK mengunduhnya — dipakai unduhScreeningExcel() di browser dan test
// di Node. Struktur workbook:
//   1. sheet "Screening RKA" — ringkas accordion Program → Kegiatan →
//      Sub Kegiatan → rincian;
//   2. satu sheet DETAIL per sub kegiatan (tab: "<kode> <nama>" maks 31
//      karakter) berisi baris sub + seluruh rincian belanjanya — bisa
//      dibuka/cetak per sub tanpa menggulir sheet panjang.
export function siapkanScreeningXlsx({ tahun, programs, rencanaById = {},
  rincianPerSub = null }) {
  const tekan = n => "\u00A0".repeat(n * 3); // indentasi visual baris ringkas
  // OFFSET +1: SheetJS mengabaikan `level: 0` pada baris pertama data
  // (lihat komentar fungsi), jadi tingkat diset mulai dari 1.
  const LV_PROGRAM = 1, LV_KEGIATAN = 2, LV_SUB = 3;
  // Rincian satu tingkat di bawah Sub Kegiatan supaya ikut terlipat
  // bersama sub kegiatan induknya.
  const LV_KEPALA_RINCIAN = 4, LV_RINCIAN = 4;

  // ── Data datar untuk tiga sheet rekap ───────────────────────────────────
  const subs = [], datar = [];
  for (const p of programs || [])
    for (const keg of p.kegiatan || [])
      for (const s of keg.subkegiatan || []) {
        const idx = subs.length;
        const sub = { idx, id: s.id, kode: s.kode ?? "", nama: s.nama ?? "",
          keg: `${keg.kode ?? ""} ${keg.nama ?? ""}`.trim(), pagu: s.pagu,
          jmlRincian: 0 };
        for (const g of kelompokRincian(rincianPerSub?.[s.id]))
          for (const it of g.baris) {
            datar.push({ subIdx: idx, kodeSub: sub.kode, namaSub: sub.nama, it });
            sub.jmlRincian++;
          }
        subs.push(sub);
      }

  // ── Sheet 1: ringkas accordion ──────────────────────────────────────────
  const aoa = [KEPALA];
  // `!rows` & `warnaBaris` berbaris sejajar aoa: indeks 0 = kepala kolom.
  const rows = [{}];
  const warnaBaris = [ST.header];
  const rumus = {};
  const k = { aoa, rows, warnaBaris, rumus, rincianPerSub };

  for (const p of programs || []) {
    // Baris Program — selalu tampil walau seluruh keturunannya dilipat.
    aoa.push(barisRingkas(tekan(0), p.kode, p.nama, p.totalPagu));
    rows.push({ level: LV_PROGRAM });
    warnaBaris.push(ST.program);
    const rProgram = aoa.length;
    const barisKeg = [];

    for (const keg of p.kegiatan || []) {
      aoa.push(barisRingkas(tekan(1), keg.kode, keg.nama, keg.totalPagu));
      rows.push({ level: LV_KEGIATAN });
      warnaBaris.push(ST.kegiatan);
      const rKegiatan = aoa.length;
      const barisSub = [];

      for (const s of keg.subkegiatan || []) {
        barisSub.push(tulisSub(k, s, Number(rencanaById[s.id]), {
          indentasi: tekan(2), indentasiRincian: tekan(3),
          lvSub: LV_SUB, lvKepala: LV_KEPALA_RINCIAN, lvRincian: LV_RINCIAN,
        }));
      }
      // Pagu kegiatan = jumlah pagu sub → rumus bila nilainya cocok persis.
      if (barisSub.length) {
        const jml = barisSub.reduce((a, r) => a + (Number(aoa[r - 1][6]) || 0), 0);
        if (Number.isFinite(keg.totalPagu) && keg.totalPagu === jml)
          rumus[`G${rKegiatan}`] = barisSub.map(r => `G${r}`).join("+");
      }
      barisKeg.push(rKegiatan);
    }
    // Pagu program = jumlah pagu kegiatan → aturan yang sama.
    if (barisKeg.length) {
      const jml = barisKeg.reduce((a, r) => a + (Number(aoa[r - 1][6]) || 0), 0);
      if (Number.isFinite(p.totalPagu) && p.totalPagu === jml)
        rumus[`G${rProgram}`] = barisKeg.map(r => `G${r}`).join("+");
    }
  }

  const wb = XLSX.utils.book_new();
  const daftarWarna = [];
  let noSheet = 0;
  // Urutan file sheetN.xml ikut urutan append (workbook.xml berurut).
  // Hitung otomatis supaya nomor sheet & daftarWarna selalu selaras.
  const tambahSheet = t => {
    noSheet++;
    XLSX.utils.book_append_sheet(
      wb, susunSheet(t.aoa, t.rows, t.rumus, t.ops || {}), t.nama);
    daftarWarna.push({ nama: `xl/worksheets/sheet${noSheet}.xml`,
      warnaBaris: t.warna, kolWrap: t.kolWrap, kolUang: t.kolUang,
      kolPct: t.kolPct });
  };

  // ── Tiga sheet rekap ala RKA_2027_BKAD_Rekap, di depan sheet screening ──
  for (const t of bangunTigaRekap(tahun, subs, datar)) tambahSheet(t);

  tambahSheet({ nama: "Screening RKA", aoa, rows, warna: warnaBaris, rumus });

  // ── Sheet detail: satu tab per sub kegiatan ─────────────────────────────
  const unik = new Set(["Rekap", "Rekap Rekening", "Rincian", "Screening RKA"]);
  for (const p of programs || [])
    for (const keg of p.kegiatan || [])
      for (const s of keg.subkegiatan || []) {
        const dAoa = [KEPALA], dRows = [{}], dWarna = [ST.header];
        const dRumus = {};
        tulisSub({ aoa: dAoa, rows: dRows, warnaBaris: dWarna, rumus: dRumus,
          rincianPerSub },
          s, Number(rencanaById[s.id]), {
            indentasi: tekan(0), indentasiRincian: tekan(1),
            lvSub: 1, lvKepala: 2, lvRincian: 3,
          });
        tambahSheet({ nama: namaSheet(unik, `${s.kode ?? ""} ${s.nama ?? ""}`),
          aoa: dAoa, rows: dRows, warna: dWarna, rumus: dRumus });
      }

  // Tulis dulu tanpa gaya (SheetJS community membuang cell.s; cell.f TULIS
  // — rumus ikut keluar lengkap dengan nilai cache), lalu pasang gaya via
  // patch styles.xml + atribut s per sel di setiap sheet.
  const polos = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return pasangWarna(polos, daftarWarna);
}

// Unduh ke file: Screening-RKA-<tahun>.xlsx. Hanya untuk browser (dipanggil
// dari tombol Ekspor ScreeningRKA); test Node memakai siapkanScreeningXlsx.
export function unduhScreeningExcel({ tahun, namaFile, ...sisanya }) {
  const isi = siapkanScreeningXlsx({ tahun, ...sisanya });
  const file = namaFile || `Screening-RKA-${tahun ?? "tahun-ini"}.xlsx`;
  const blob = new Blob([isi],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
