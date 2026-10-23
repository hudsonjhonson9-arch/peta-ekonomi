import * as XLSX from "xlsx";
// Rumus total baris dipakai bersama dengan server (DraftRincian & endpoint
// draft-rincian) supaya angka Total di Excel = total di aplikasi. Modul ini
// murni object-in/object-out, tanpa dependensi server — aman dipakai klien.
import { jumlahItem } from "../../server/draft-rincian.js";

// ── Ekspor Screening RKA ke Excel ───────────────────────────────────────────
// Satu sheet "Screening RKA", satu baris per Sub Kegiatan, dengan grouping
// Excel (outline) tiga tingkat supaya sheet bisa dilipat-expand seperti
// accordion:
//   level 1 → baris Program (ringkas, selalu tampil walau anak dilipat)
//   level 2 → baris Kegiatan
//   level 3 → baris Sub Kegiatan
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

// Baris Program/Kegiatan diringkas jadi satu baris ringkas: teks kode+nama
// duduk di kolom Kode & Nama (bukan di kolom Level yang sempit), kolom lain
// dikosongkan supaya sheet tetap terbaca rapi saat dilipat. Kolom Pagu
// tetap terisi sebagai ringkasan pagu grup.
const barisRingkas = (indentasi, kode, nama, pagu) => [
  indentasi,               // Level (spasi indentasi saja)
  kode ?? "",              // Kode
  nama ?? "",              // Nama
  "", "",                  // Indikator, Target
  angka(pagu),             // Pagu (ringkas grup)
  "", "", "", "",          // Realisasi, Status, Total Rencana, Selisih
  // Kolom rincian belanja sengaja kosong di baris ringkas — rincian milik
  // sub kegiatan induknya, dicetak terpisah di barisnya sendiri.
  "", "", "", "", "", "", "", "", "",
];

// Kolom ringkasan (kiri) — diisi di baris Program/Kegiatan/Sub Kegiatan.
// Kolom rincian belanja (kanan) — hanya diisi di baris rincian milik satu
// Sub Kegiatan, sehingga baris Program/Kegiatan/Sub Kegiatan tetap ringkas.
const KEPALA = [
  "Level", "Kode", "Nama", "Indikator", "Target",
  "Pagu", "Realisasi", "Status", "Total Rencana", "Selisih Rencana − Pagu",
  // Rincian belanja per sub kegiatan:
  "Kelompok", "Rekening", "Uraian", "Spesifikasi",
  "Volume", "Satuan", "Harga Satuan", "Total", "Keterangan",
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

// programs: array pohon hasil kalkulasi ScreeningRKA (sudah memuat
// totalPagu di tiap Program & Kegiatan). rencanaById: {subId: number} total
// rencana belanja per sub kegiatan (dihitung dari endpoint draft-rincian).
// rincianPerSub: opsional, {subId: [item, ...]} — bila diisi, tiap Sub
// Kegiatan dkk. rincian belanjanya ikut tercetak di bawahnya (sebagai anak
// outline tingkat berikutnya), bukan hanya ringkasannya.
export function unduhScreeningExcel({ tahun, programs, rencanaById = {},
  rincianPerSub = null, namaFile }) {
  const aoa = [KEPALA];
  // `!rows` berbaris sejajar dengan aoa: indeks 0 = kepala (tanpa level),
  // sisanya ikut tingkat grouping-nya masing-masing.
  const rows = [{}];
  const tekan = n => "\u00A0".repeat(n * 3); // indentasi visual baris ringkas
  // OFFSET +1: SheetJS mengabaikan `level: 0` pada baris pertama (lihat
  // komentar fungsi), jadi tingkat diset mulai dari 1. Ringkasan grup
  // memakai level terkecil (1) supaya selalu tampil walau anak dilipat.
  const LV_PROGRAM = 1, LV_KEGIATAN = 2, LV_SUB = 3;
  // Rincian duduk satu tingkat di bawah Sub Kegiatan supaya ikut terlipat
  // bersama sub kegiatan induknya.
  const LV_KEPALA_RINCIAN = 4, LV_RINCIAN = 4;

  // Baris rincian: kolom ringkasan (0–9) dibiarkan kosong, kolom rincian
  // (10–18) diisi sesuai posisinya di KEPALA — jangan pakai push, karena
  // push akan menempel setelah kolom ringkasan dan menggeser semuanya.
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

    for (const k of p.kegiatan || []) {
      aoa.push(barisRingkas(tekan(1), k.kode, k.nama, k.totalPagu));
      rows.push({ level: LV_KEGIATAN });

      for (const s of k.subkegiatan || []) {
        const rencana = Number(rencanaById[s.id]);
        const pagu = angka(s.pagu);
        const selisih = Number.isFinite(rencana) && pagu !== ""
          ? rencana - pagu : "";
        aoa.push([
          tekan(2),                       // Level (indentasi)
          s.kode ?? "",                   // Kode
          s.nama ?? "",                   // Nama
          s.indikator ?? "",              // Indikator
          s.target ?? "",                 // Target
          pagu,                           // Pagu (angka)
          angka(s.realisasi),             // Realisasi (angka)
          labelStatus(s.status_validasi), // Status
          angka(rencana),                 // Total Rencana (angka)
          angka(selisih),                 // Selisih (angka; bisa negatif)
          // Kolom rincian kosong — diisi di baris rincian anaknya.
          "", "", "", "", "", "", "", "", "",
        ]);
        rows.push({ level: LV_SUB });

        // ── Rincian belanja sub kegiatan ini (opsional) ─────────────────────
        if (rincianPerSub) {
          for (const g of kelompokRincian(rincianPerSub[s.id])) {
            // Header kelompok: nama + totalnya, kolom rincian lain kosong.
            // Selalu memakai level rincian supaya ikut terlipat bersama
            // sub kegiatan induknya, bukan berdiri sendiri di luar grup.
            if (g.nama) {
              aoa.push(barisRincian(tekan(3), [
                [10, g.nama],                    // Kelompok
                [17, angka(g.total)],            // Total kelompok
              ]));
              rows.push({ level: LV_KEPALA_RINCIAN });
            }
            for (const it of g.baris) {
              aoa.push(barisRincian(tekan(3), [
                [11, it.kode_rekening || ""],    // Rekening
                [12, it.uraian ?? ""],           // Uraian
                [13, it.spesifikasi || ""],      // Spesifikasi
                [14, angka(it.volume)],          // Volume
                [15, it.satuan ?? ""],           // Satuan
                [16, angka(it.harga_satuan)],    // Harga Satuan
                [17, angka(jumlahItem(it.volume, it.harga_satuan))], // Total
                [18, it.catatan || ""],          // Keterangan
              ]));
              rows.push({ level: LV_RINCIAN });
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
  // Kolom: teks nama bisa panjang, biar tidak terpotong.
  ws["!cols"] = [
    { wch: 4 },   // Level
    { wch: 14 },  // Kode
    { wch: 46 },  // Nama
    { wch: 34 },  // Indikator
    { wch: 16 },  // Target
    { wch: 16 },  // Pagu
    { wch: 16 },  // Realisasi
    { wch: 12 },  // Status
    { wch: 16 },  // Total Rencana
    { wch: 20 },  // Selisih
    { wch: 20 },  // Kelompok
    { wch: 14 },  // Rekening
    { wch: 44 },  // Uraian
    { wch: 24 },  // Spesifikasi
    { wch: 10 },  // Volume
    { wch: 10 },  // Satuan
    { wch: 16 },  // Harga Satuan
    { wch: 16 },  // Total
    { wch: 26 },  // Keterangan
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Screening RKA");

  // Nama file: Screening-RKA-<tahun>.xlsx
  const file = namaFile || `Screening-RKA-${tahun ?? "tahun-ini"}.xlsx`;
  XLSX.writeFile(wb, file, { bookType: "xlsx", cellStyles: true });
}
