// Helper murni alur validasi Screening RKA (pola SIPD-RI):
// Draft → Menunggu → Disetujui/Ditolak. Tanpa akses DB — object-in/object-out.
//
// Transisi dijaga server (routes /api/screening/ajukan & /api/screening/validasi)
// supaya status tidak bisa melompat walau klien dimanipulasi; hasil helper
// membawa `http` sebagai kode status yang pas (409 konflik status, 400 isi).

// Nilai yang dikenal kolom pks_subkegiatan.status_validasi.
export const STATUS_SCREENING = ['draft', 'menunggu', 'disetujui', 'ditolak'];

// Staf mengajukan sub kegiatan untuk direview Admin.
// → {ok: true, ke: 'menunggu'} | {ok: false, error, http}
export function ajukanDari(dari) {
  const s = dari || 'draft';
  if (s === 'draft' || s === 'ditolak') return { ok: true, ke: 'menunggu' };
  if (s === 'menunggu') {
    return { ok: false, http: 409, error: 'Sudah berstatus Menunggu — tunggu validasi Admin.' };
  }
  return {
    ok: false, http: 409,
    error: 'Sudah disetujui — minta Admin mengembalikan ke Draft dulu.',
  };
}

// Admin memvalidasi: 'disetujui'/'ditolak' hanya dari Menunggu;
// 'draft' = pengembalian dari status mana pun selain Draft (buka kembali).
// → {ok: true, ke} | {ok: false, error, http}
export function validasiStatus(dari, ke, catatan) {
  const s = dari || 'draft';
  if (!STATUS_SCREENING.includes(ke)) {
    return { ok: false, http: 400, error: `Status "${ke}" tidak dikenal` };
  }
  if (ke === 'disetujui' || ke === 'ditolak') {
    if (s !== 'menunggu') {
      return {
        ok: false, http: 409,
        error: `Hanya status Menunggu yang bisa ${ke === 'disetujui' ? 'disetujui' : 'ditolak'} (sekarang: ${s}).`,
      };
    }
    if (ke === 'ditolak' && !String(catatan ?? '').trim()) {
      return { ok: false, http: 400, error: 'Catatan wajib diisi saat menolak.' };
    }
    return { ok: true, ke };
  }
  // ke === 'draft'
  if (s === 'draft') return { ok: false, http: 409, error: 'Sudah berstatus Draft.' };
  return { ok: true, ke: 'draft' };
}

// Pra-syarat menyetujui (validasi otomatis server): pagu terisi > 0 dan total
// rencana (Σ draft_rincian) tidak melebihi pagu. Peringatan selisih harga vs
// standar TIDAK memblokir — itu warning klien.
// → {ok: true} | {ok: false, error, http: 400}
export function cekSetujui(pagu, totalRencana) {
  const p = pagu == null || pagu === '' ? null : Number(pagu);
  if (p == null || !Number.isFinite(p) || p <= 0) {
    return { ok: false, http: 400, error: 'Pagu belum diisi — lengkapi pagu sebelum menyetujui.' };
  }
  const t = Number(totalRencana) || 0;
  if (t > p) {
    return {
      ok: false, http: 400,
      error: `Total rencana (Rp ${Math.round(t).toLocaleString('id-ID')}) melebihi pagu (Rp ${Math.round(p).toLocaleString('id-ID')}).`,
    };
  }
  return { ok: true };
}
