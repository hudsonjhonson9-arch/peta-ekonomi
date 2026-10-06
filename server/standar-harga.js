// Helper murni untuk fitur Standar Harga (SSH/SBU): pemetaan header upload,
// validasi baris hasil parsing spreadsheet, dan filter daftar pencocokan.
// Tidak ada akses DB dan tidak ada dependensi express — murni array-in/array-out.

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
  return String(h ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Koerce harga: buang "Rp", spasi, titik ribuan, koma desimal → number.
// "1.500.500,00" → 1500500; "Rp 65.000" → 65000; "65000.50" → 65000.5.
function keHarga(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let s = String(v ?? '').trim().toLowerCase().replace(/rp/g, '').replace(/\s+/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(/,/g, '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const KOLOM_TEKS = [
  'kode_kelompok', 'uraian_kelompok', 'id_standar_harga', 'kode_barang',
  'spesifikasi', 'satuan', 'kode_rekening',
];

// rows: array objek dengan key header mentah (hasil parsing sheet).
// Baris tanpa uraian_barang ATAU dengan harga yang gagal dikoerce/<0 → dilewati.
// Jika semua baris gugur → {ok:false, error}.
export function validasiUpload(tahun, jenis, rows) {
  const t = Number(tahun);
  if (!Number.isInteger(t)) return { ok: false, error: 'tahun harus int' };
  if (jenis !== 'SSH' && jenis !== 'SBU') return { ok: false, error: 'jenis harus SSH atau SBU' };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: 'tidak ada baris' };

  const items = [];
  for (const row of rows) {
    const item = { tahun: t, jenis };
    for (const [h, v] of Object.entries(row ?? {})) {
      const kolom = HEADER_MAP[normalisasiHeader(h)];
      if (!kolom) continue;
      item[kolom] = typeof v === 'string' ? v.trim() : v;
    }
    if (!item.uraian_barang) continue;
    const harga = keHarga(item.harga_satuan);
    if (!Number.isFinite(harga) || harga < 0) continue;
    item.harga_satuan = harga;
    for (const k of KOLOM_TEKS) if (item[k] == null) item[k] = null; // siap INSERT, kolom opsional → null
    items.push(item);
  }
  if (items.length === 0) return { ok: false, error: 'semua baris gugur' };
  return { ok: true, items };
}

// q: substring case-insensitive terhadap uraian_barang/spesifikasi/kode_barang.
// rekening: string satu KODE REKENING (exact match) — multi-koma ditangani konsumen berikutnya.
export function filterDaftar(daftar, { q, rekening } = {}) {
  const kata = String(q ?? '').trim().toLowerCase();
  return (Array.isArray(daftar) ? daftar : []).filter((it) => {
    if (rekening && it.kode_rekening !== rekening) return false;
    if (!kata) return true;
    return [it.uraian_barang, it.spesifikasi, it.kode_barang]
      .some((v) => String(v ?? '').toLowerCase().includes(kata));
  });
}
