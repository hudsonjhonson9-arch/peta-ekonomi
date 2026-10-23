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

// Koerce harga teks: aturan literal brief — titik = ribuan, koma = desimal.
// Buang semua karakter non-numerik (Rp, spasi, huruf), buang semua titik,
// lalu koma pertama → titik. "Rp 65.000" → 65000; "1.500.500,00" → 1500500.
// Sel angka (cell numerik) sudah datang sebagai number → jalur atas.
function keHarga(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v ?? '').replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const KOLOM_TEKS = [
  'kode_kelompok', 'uraian_kelompok', 'id_standar_harga', 'kode_barang',
  'spesifikasi', 'satuan', 'kode_rekening',
];

// Nama kolom target yang diterima apa adanya (klien sudah memetakan sheet
// sendiri lewat HEADER_MAP duplikat di src). tahun/jenis dikecualikan:
// nilainya selalu diambil dari body, bukan dari baris.
const KOLOM_ITEM = new Set([...KOLOM_TEKS, 'uraian_barang', 'harga_satuan']);

// ID sintetis untuk baris tanpa ID STANDAR HARGA (input manual). Dihitung dari
// isi baris, jadi identik selama isinya identik — dua baris identik memang satu
// item (aman digabung), sedangkan dua baris beda isi dapat ID berbeda (tidak
// pernah saling menimpa). Diberi awalan "lokal:" agar jelas bukan ID SIPD.
import { createHash } from 'node:crypto';
function idLokal(item) {
  const isi = ['uraian_barang', 'spesifikasi', 'satuan', 'harga_satuan',
    'kode_rekening', 'kode_barang', 'kode_kelompok']
    .map((k) => String(item[k] ?? '')).join('\u0000');
  return 'lokal:' + createHash('sha1').update(isi).digest('hex').slice(0, 16);
}

// rows: array baris — key header mentah (hasil parsing sheet) ATAU key berupa
// nama kolom target (klien sudah memetakan). Keduanya divalidasi sama.
// Baris tanpa uraian_barang ATAU dengan harga yang gagal dikoerce/<0 → dilewati.
// Jika semua baris gugur → {ok:false, error}.
export function validasiUpload(tahun, jenis, rows) {
  // String kosong/null → Number('') === 0 lolos isInteger; tolak dulu sebelum koerce.
  const teks = String(tahun ?? '').trim();
  const t = Number(teks);
  if (!teks || !Number.isInteger(t)) return { ok: false, error: 'tahun harus int' };
  if (jenis !== 'SSH' && jenis !== 'SBU') return { ok: false, error: 'jenis harus SSH atau SBU' };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: 'tidak ada baris' };

  const items = [];
  for (const row of rows) {
    const item = { tahun: t, jenis };
    for (const [h, v] of Object.entries(row ?? {})) {
      const kolom = KOLOM_ITEM.has(h) ? h : HEADER_MAP[normalisasiHeader(h)];
      if (!kolom) continue;
      item[kolom] = typeof v === 'string' ? v.trim() : v;
    }
    if (!item.uraian_barang) continue;
    const harga = keHarga(item.harga_satuan);
    if (!Number.isFinite(harga) || harga < 0) continue;
    item.harga_satuan = harga;
    for (const k of KOLOM_TEKS) if (item[k] == null || item[k] === '') item[k] = null;
    items.push(item);
  }
  if (items.length === 0) return { ok: false, error: 'semua baris gugur' };
  // Kunci merge = ID STANDAR HARGA. ID SIPD asli dipakai apa adanya; baris
  // tanpa ID dapat ID sintetis dari isi baris supaya tetap ter-upload tanpa
  // pernah menimpa baris lain. Duplikat ID dalam satu file: baris terakhir
  // menang (export SIPD sering mengulang blok; ID sama = item sama) — tanpa
  // ini ON CONFLICT gagal karena dua baris identik dalam satu batch INSERT.
  const unik = new Map();
  for (const it of items) {
    unik.set(String(it.id_standar_harga ?? idLokal(it)), it);
  }
  for (const [id, it] of unik) it.id_standar_harga = id;
  return { ok: true, items: [...unik.values()] };
}

// q: substring case-insensitive terhadap uraian_barang/spesifikasi/kode_barang.
// rekening: string dipisah koma (chips.join(',')) — dicocokkan secara hierarki:
// sama persis ATAU kode baris adalah keturunan (prefix "rek."), jadi memilih
// kode induk (5.1.02.01) tetap menampilkan baris berkode anak (5.1.02.01.01).
// Kode yang cocok boleh mana saja dari daftar (OR).
export function filterDaftar(daftar, { q, rekening } = {}) {
  const kata = String(q ?? '').trim().toLowerCase();
  const set = rekening
    ? new Set(String(rekening).split(',').map(s => s.trim()).filter(Boolean))
    : null;
  const rekCocok = (rek, val) => {
    const v = String(val ?? '').trim();
    return v !== '' && (v === rek || v.startsWith(`${rek}.`));
  };
  return (Array.isArray(daftar) ? daftar : []).filter((it) => {
    if (set && ![...set].some(rek => rekCocok(rek, it.kode_rekening))) return false;
    if (!kata) return true;
    return [it.uraian_barang, it.spesifikasi, it.kode_barang, it.id_standar_harga]
      .some((v) => String(v ?? '').toLowerCase().includes(kata));
  });
}
