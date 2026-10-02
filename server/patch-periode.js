// Bangun klausa UPDATE untuk PATCH /api/kertas-kerja/periode/:id.
//
// Dipisah dari server/index.js supaya bisa diuji tanpa menjalankan Express
// dan koneksi database.
//
// Aturan penting: sebuah kolom hanya diubah bila field-nya benar-benar
// dikirim di body. Tanpa itu, PATCH {doc_id} dari alur upload user akan ikut
// menimpa deadline dan catatan — persis bug yang membuat deadline admin
// selalu kembali ke nilai turunan deadline_rule.

const HARI = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const hariDalamBulan = (tahun, bulan) => {
  if (bulan === 2) {
    const leap = (tahun % 4 === 0 && tahun % 100 !== 0) || tahun % 400 === 0;
    return leap ? 29 : 28;
  }
  return HARI[bulan - 1];
};

// Terima body apa pun. Kembalikan {sets, params} atau {galat, status}.
export function susunPatchPeriode(body) {
  const b = body && typeof body === 'object' ? body : {};
  const punya = k => Object.prototype.hasOwnProperty.call(b, k);

  const sets = [];
  const params = [];
  const tambah = (kolom, nilai) => {
    params.push(nilai);
    sets.push(`${kolom} = $${params.length}`);
    return params.length;
  };

  // null = lepas dokumen, keyang tidak ada = jangan sentuh.
  let idxDocId = null;
  if (punya('doc_id')) {
    const kosong = b.doc_id === null || b.doc_id === undefined || b.doc_id === '';
    const baru = kosong ? null : parseInt(b.doc_id, 10);
    if (!kosong && !Number.isInteger(baru)) {
      return { galat: 'doc_id harus berupa angka', status: 400 };
    }
    idxDocId = tambah('doc_id', baru);
  }

  // uploaded_by/uploaded_at hanya bergerak saat dokumen benar-benar diganti,
  // sehingga melepas dokumen tidak menghapus jejak siapa yang mengunggah.
  if (idxDocId !== null) {
    params.push(b.uploaded_by || null);
    sets.push(`uploaded_by = CASE WHEN $${idxDocId} IS NULL THEN uploaded_by ELSE $${params.length} END`);
    sets.push(`uploaded_at = CASE WHEN $${idxDocId} IS NULL THEN uploaded_at ELSE NOW() END`);
  }

  if (punya('catatan')) tambah('catatan', b.catatan || null);

  // Deadline ditulis eksplisit oleh admin, bukan lagi turunan deadline_rule.
  if (punya('deadline')) {
    const d = String(b.deadline ?? '').trim();
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return { galat: 'Format deadline harus YYYY-MM-DD', status: 400 };
    const th = parseInt(m[1], 10);
    const bl = parseInt(m[2], 10);
    const hr = parseInt(m[3], 10);
    if (bl < 1 || bl > 12 || hr < 1 || hr > hariDalamBulan(th, bl)) {
      return { galat: 'Tanggal deadline tidak ada di kalender', status: 400 };
    }
    tambah('deadline', d);
  }

  if (punya('is_wajib')) {
    const v = b.is_wajib;
    tambah('is_wajib', v === true || v === '1' || v === 1);
  }

  if (!sets.length) return { galat: 'Tidak ada field yang diperbarui', status: 400 };
  return { sets, params };
}