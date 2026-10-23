import * as XLSX from "xlsx";
// Rumus total baris dipakai bersama dengan server (DraftRincian & endpoint
// draft-rincian) supaya angka Total di Excel = total di aplikasi. Modul ini
// murni object-in/object-out, tanpa dependensi server — aman dipakai klien.
import { jumlahItem } from "../../server/draft-rincian.js";

// ── Ekspor Screening RKA ke Excel ───────────────────────────────────────────
// Satu sheet "Screening RKA" dengan grouping Excel (outline) supaya sheet
// bisa dilipat-expand seperti accordion:
//   level 1 → baris Program (ringkas, selalu tampil walau anak dilipat)
//   level 2 → baris Kegiatan
//   level 3 → baris Sub Kegiatan
//   level 4 → baris rincian belanja (header kelompok + per item)
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
// SheetJS community TIDAK menulis cell.s (fill/font) saat write — sudah
// diverifikasi: fills.xml tetap default. Karena itu warna dipasang dengan
// patch manual: tulis ulang xl/styles.xml (font+fill+xfs milik kita) dan
// tambahkan atribut s="n" pada tiap sel di xl/worksheets/sheet1.xml, lalu
// zip ulang semua entry (semua STORE/tanpa kompresi, jadi aman ditulis
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
const ST = { header: 1, program: 2, kegiatan: 3, sub: 4, kelompok: 5 };

// Stylesheet milik kita, MENGGANTIKAN styles.xml bawaan SheetJS (yang hanya
// berisi default). Posisi fill & font harus selaras dengan ST di atas.
// Urutan elemen mengikuti CT_Stylesheet: fonts → fills → borders →
// cellStyleXfs → cellXfs → cellStyles → dxfs → tableStyles.
const GAYA_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
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
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
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

// Pasang warna: ganti styles.xml + beri atribut s pada tiap sel sesuai
// warnaBaris (sejajar aoa; 0 = tanpa gaya/kolom data putih).
function pasangWarna(biner, warnaBaris) {
  const entri = bacaZip(biner);
  const lembar = entri.find(e => e.nama === "xl/worksheets/sheet1.xml");
  if (!lembar) throw new Error("Sheet1 tidak ditemukan di xlsx");
  const teks = new TextDecoder().decode(lembar.data);
  // <c r="A2" ...> → <c r="A2" s="n" ...> (atribut XML bebas urutan, aman
  // disisipkan tepat setelah r="..").
  lembar.data = new TextEncoder().encode(
    teks.replace(/<c r="([A-Z]+)(\d+)"/g, (m, _kol, baris) => {
      const st = warnaBaris[Number(baris) - 1];
      return st ? `${m} s="${st}"` : m;
    })
  );
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

// Susun berkas xlsx utuh (sudah berwarna + ber-outline), tapi TIDAK
// mengunduhnya — dipakai unduhScreeningExcel() di browser dan test di Node.
export function siapkanScreeningXlsx({ tahun, programs, rencanaById = {},
  rincianPerSub = null }) {
  const aoa = [KEPALA];
  // `!rows` berbaris sejajar dengan aoa: indeks 0 = kepala (tanpa level),
  // sisanya ikut tingkat grouping-nya masing-masing.
  const rows = [{}];
  // `warnaBaris` juga sejajar aoa: indeks xf ST.* sesuai jenis barisnya.
  const warnaBaris = [ST.header];
  const tekan = n => "\u00A0".repeat(n * 3); // indentasi visual baris ringkas
  // OFFSET +1: SheetJS mengabaikan `level: 0` pada baris pertama (lihat
  // komentar fungsi), jadi tingkat diset mulai dari 1. Ringkasan grup
  // memakai level terkecil (1) supaya selalu tampil walau anak dilipat.
  const LV_PROGRAM = 1, LV_KEGIATAN = 2, LV_SUB = 3;
  // Rincian duduk satu tingkat di bawah Sub Kegiatan supaya ikut terlipat
  // bersama sub kegiatan induknya.
  const LV_KEPALA_RINCIAN = 4, LV_RINCIAN = 4;

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

  for (const p of programs || []) {
    // Baris Program — selalu tampil walau seluruh keturunannya dilipat.
    aoa.push(barisRingkas(tekan(0), p.kode, p.nama, p.totalPagu));
    rows.push({ level: LV_PROGRAM });
    warnaBaris.push(ST.program);

    for (const k of p.kegiatan || []) {
      aoa.push(barisRingkas(tekan(1), k.kode, k.nama, k.totalPagu));
      rows.push({ level: LV_KEGIATAN });
      warnaBaris.push(ST.kegiatan);

      for (const s of k.subkegiatan || []) {
        const rencana = Number(rencanaById[s.id]);
        const pagu = angka(s.pagu);
        const selisih = Number.isFinite(rencana) && pagu !== ""
          ? rencana - pagu : "";
        aoa.push([
          tekan(2),                       // 0 Level (indentasi)
          s.kode ?? "",                   // 1 Kode
          s.nama ?? "",                   // 2 Nama
          s.indikator ?? "",              // 3 Indikator
          s.target ?? "",                 // 4 Target
          "",                             // 5 Satuan (pohon tidak punya)
          pagu,                           // 6 Pagu (angka)
          angka(s.realisasi),             // 7 Realisasi (angka)
          labelStatus(s.status_validasi), // 8 Status
          angka(rencana),                 // 9 Total Rencana (angka)
          angka(selisih),                 // 10 Selisih (angka; bisa negatif)
        ]);
        rows.push({ level: LV_SUB });
        warnaBaris.push(ST.sub);

        // ── Rincian belanja sub kegiatan ini (opsional) ─────────────────────
        if (rincianPerSub) {
          for (const g of kelompokRincian(rincianPerSub[s.id])) {
            // Header kelompok: nama di kolom Nama/Uraian, totalnya di kolom
            // Realisasi/Total. Selalu memakai level rincian supaya ikut
            // terlipat bersama sub kegiatan induknya, bukan berdiri sendiri.
            if (g.nama) {
              aoa.push(barisRincian(tekan(3), [
                [2, g.nama],                        // Nama/Uraian = kelompok
                [7, angka(g.total)],                // Realisasi/Total kelompok
              ]));
              rows.push({ level: LV_KEPALA_RINCIAN });
              warnaBaris.push(ST.kelompok);
            }
            for (const it of g.baris) {
              aoa.push(barisRincian(tekan(3), [
                [1, it.kode_rekening || ""],        // Kode/Rekening
                [2, it.uraian ?? ""],               // Nama/Uraian
                [3, it.spesifikasi || ""],          // Indikator/Spesifikasi
                [4, angka(it.volume)],              // Target/Volume
                [5, it.satuan ?? ""],               // Satuan
                [6, angka(it.harga_satuan)],        // Pagu/Harga Satuan
                [7, angka(jumlahItem(it.volume, it.harga_satuan))], // Total
                [8, it.catatan || ""],              // Status/Keterangan
              ]));
              rows.push({ level: LV_RINCIAN });
              warnaBaris.push(0);                   // item: putih, tanpa gaya
            }
          }
        }
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // INI kunci accordion: `!rows[i].level` ditulis sebagai atribut
  // outlineLevel="1"/"2"/"3"/"4" di XML sheet. Baris tanpa `level` (kepala
  // kolom) selalu tampil; baris ber-level ikut terlipat saat tombol [-] di
  // grupnya ditekan.
  ws["!rows"] = rows;
  // Baris ringkas (Program/Kegiatan/Sub) ada DI ATAS anak → beritahu Excel
  // dengan summaryBelow=0; tanpa ini default summaryBelow=1 membuat tombol
  // lipat meleset satu grup (lihat komentar fungsi di atas).
  ws["!outline"] = { above: true };
  // Lebar kolom dijaga ramping supaya seluruh blok rincian (kolom B–I)
  // muat di layar laptop tanpa gulir ke kanan.
  ws["!cols"] = [
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

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Screening RKA");
  // Tulis dulu tanpa gaya (SheetJS community membuang cell.s), lalu pasang
  // warna lewat patch styles.xml + atribut s per sel.
  const polos = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return pasangWarna(polos, warnaBaris);
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
