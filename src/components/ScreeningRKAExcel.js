import * as XLSX from "xlsx";

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
// Cukup `!rows[i].level` saja: `!outline` tidak ikut tertulis oleh writer
// xlsx, dan tombol lipat [-]/[+] muncul otomatis begitu outlineLevel ada.

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
];

// Kolom: Level | Kode | Nama | Indikator | Target | Pagu | Realisasi | Status
// | Total Rencana | Selisih (Rencana − Pagu). Uraian lengkap ada di baris
// Sub Kegiatan; baris Program/Kegiatan hanya mengisi kolom Level + Pagu.
const KEPALA = [
  "Level", "Kode", "Nama", "Indikator", "Target",
  "Pagu", "Realisasi", "Status", "Total Rencana", "Selisih Rencana − Pagu",
];

// programs: array pohon hasil kalkulasi ScreeningRKA (sudah memuat
// totalPagu di tiap Program & Kegiatan). rencanaById: {subId: number} total
// rencana belanja per sub kegiatan (dihitung dari endpoint draft-rincian).
export function unduhScreeningExcel({ tahun, programs, rencanaById = {}, namaFile }) {
  const aoa = [KEPALA];
  // `!rows` berbaris sejajar dengan aoa: indeks 0 = kepala (tanpa level),
  // sisanya ikut tingkat grouping-nya masing-masing. level 0 = Program.
  const rows = [{}];
  const tekan = n => "\u00A0".repeat(n * 3); // indentasi visual baris ringkas
  // OFFSET +1: SheetJS mengabaikan `level: 0` pada baris pertama (lihat
  // komentar fungsi), jadi tingkat diset mulai dari 1. Ringkasan grup
  // memakai level terkecil (1) supaya selalu tampil walau anak dilipat.
  const LV_PROGRAM = 1, LV_KEGIATAN = 2, LV_SUB = 3;

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
        ]);
        rows.push({ level: LV_SUB });
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // INI satu-satunya kunci accordion: `!rows[i].level` ditulis sebagai
  // atribut outlineLevel="1"/"2"/"3" di XML sheet. Baris tanpa `level`
  // (kepala kolom) selalu tampil; baris ber-level ikut terlipat saat tombol
  // [-] di grupnya ditekan. `!outline`/`!freeze` tidak ditulis writer xlsx —
  // sengaja tidak dipakai.
  ws["!rows"] = rows;
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
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Screening RKA");

  // Nama file: Screening-RKA-<tahun>.xlsx
  const file = namaFile || `Screening-RKA-${tahun ?? "tahun-ini"}.xlsx`;
  XLSX.writeFile(wb, file, { bookType: "xlsx", cellStyles: true });
}
