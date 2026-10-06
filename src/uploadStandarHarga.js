// Parsing client-side Excel standar harga (SSH/SBU).
// WAJIB sinkron dengan server/standar-harga.js — HEADER_MAP, normalisasi
// header, dan koerce harga diduplikasi di dua tempat dengan sengaja
// (keputusan plan Task 5: bundel klien tidak mengimpor modul server).
// Ubah pola di sini = ubah juga di server/standar-harga.js, dan sebaliknya.

export const HEADER_MAP = {
  "KODE KELOMPOK BARANG": "kode_kelompok", "KELOMPOK": "kode_kelompok",
  "URAIAN KELOMPOK BARANG": "uraian_kelompok",
  "ID STANDAR HARGA": "id_standar_harga",
  "KODE BARANG": "kode_barang",
  "URAIAN BARANG": "uraian_barang", "NAMA BARANG": "uraian_barang",
  "SPESIFIKASI": "spesifikasi",
  "SATUAN": "satuan", "SATUAN JASA": "satuan",
  "HARGA SATUAN": "harga_satuan", "HARGA": "harga_satuan",
  "KODE REKENING": "kode_rekening",
};

// normalisasi header: trim, uppercase, hapus "(...)", spasi→spasi tunggal
function normalisasiHeader(h) {
  return String(h ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Titik = ribuan, koma = desimal (aturan identik dengan server).
function keHarga(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const s = String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// rows: array objek kunci header mentah (hasil sheet_to_json). Baris tanpa
// uraian_barang ATAU harga gagal dikoerce/<0 dilewati — sama seperti
// validasiUpload di server, supaya jumlah baris preview = jumlah yang benar-
// benar masuk (replace) nanti.
export function parseRows(rows) {
  const items = [];
  for (const row of rows) {
    const item = {};
    for (const [h, v] of Object.entries(row ?? {})) {
      const kolom = HEADER_MAP[normalisasiHeader(h)];
      if (!kolom) continue;
      item[kolom] = typeof v === "string" ? v.trim() : v;
    }
    if (!item.uraian_barang) continue;
    const harga = keHarga(item.harga_satuan);
    if (!Number.isFinite(harga) || harga < 0) continue;
    item.harga_satuan = harga;
    items.push(item);
  }
  return items;
}
