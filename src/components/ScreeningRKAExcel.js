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

    for (const k of p.kegiatan || []) {
      aoa.push(barisRingkas(tekan(1), k.kode, k.nama, k.totalPagu));
      rows.push({ level: LV_KEGIATAN });

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

  // Nama file: Screening-RKA-<tahun>.xlsx
  const file = namaFile || `Screening-RKA-${tahun ?? "tahun-ini"}.xlsx`;
  XLSX.writeFile(wb, file, { bookType: "xlsx", cellStyles: true });
}
