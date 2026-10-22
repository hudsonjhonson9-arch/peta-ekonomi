// Helper murni untuk fitur Draft Rincian: validasi item rencana belanja dan
// perhitungan total. Tidak ada akses DB dan tidak ada dependensi express —
// murni object-in/object-out.

// Total baris (rupiah, pembulatan Math.round — klien memakai rumus identik
// di DraftRincian sehingga total preview = total server).
export const jumlahItem = (volume, harga) => Math.round(volume * harga);

// → {ok: true, item} | {ok: false, error}
// wajib: uraian (string, trim, maks 500), satuan (trim), volume number >= 0,
// harga_satuan number >= 0; opsional: kelompok_belanja (trim — pengelompokan
// belanja ala SIPD, jadi header grup di daftar), spesifikasi, kode_rekening
// (trim), standar_harga_id (integer|null), harga_standar (number|null),
// catatan (trim).
// Field opsional yang kosong/hilang → null. subkegiatan_id TIDAK diproses di
// sini — route POST yang menempelkannya dari query param.
export function validasiItem(body) {
  const b = body ?? {};

  const uraian = String(b.uraian ?? '').trim();
  if (!uraian) return { ok: false, error: 'uraian wajib' };
  if (uraian.length > 500) return { ok: false, error: 'uraian maks 500 karakter' };

  const satuan = String(b.satuan ?? '').trim();
  if (!satuan) return { ok: false, error: 'satuan wajib' };

  const volume = Number(b.volume);
  if (!Number.isFinite(volume) || volume < 0) return { ok: false, error: 'volume harus >= 0' };

  const harga = Number(b.harga_satuan);
  if (!Number.isFinite(harga) || harga < 0) return { ok: false, error: 'harga_satuan harus >= 0' };

  const optTeks = (v) => { const s = String(v ?? '').trim(); return s || null; };

  // standar_harga_id: integer|null — string kosong jangan jatuh ke 0.
  let shId = b.standar_harga_id;
  if (shId === '' || shId == null) shId = null;
  else {
    const n = Number(shId);
    if (!Number.isInteger(n)) return { ok: false, error: 'standar_harga_id harus integer' };
    shId = n;
  }

  let hargaStandar = b.harga_standar;
  if (hargaStandar === '' || hargaStandar == null) hargaStandar = null;
  else {
    const n = Number(hargaStandar);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'harga_standar harus >= 0' };
    hargaStandar = n;
  }

  return { ok: true, item: {
    uraian, satuan, volume, harga_satuan: harga,
    kelompok_belanja: optTeks(b.kelompok_belanja),
    spesifikasi: optTeks(b.spesifikasi),
    kode_rekening: optTeks(b.kode_rekening),
    catatan: optTeks(b.catatan),
    standar_harga_id: shId,
    harga_standar: hargaStandar,
  } };
}

// ── Update parsial (PUT multi-user) ───────────────────────────────────────
// Klien mengirim HANYA field yang benar-benar diubah. Field yang tidak ada di
// body TIDAK disentuh — supaya edit user lain di kolom lain tidak tertimpa
// oleh snapshot render user ini (truth = database, bukan salinan klien).
// Setiap field yang hadir divalidasi dengan aturan yang sama seperti
// validasiItem; field opsi yang dikirim kosong → null (bersihkan).
// → {ok: true, patch} | {ok: false, error} | {ok: false, kosong: true}
export function validasiPatch(body) {
  const b = body ?? {};
  const patch = {};
  const ada = (k) => b[k] !== undefined;

  if (ada('uraian')) {
    const s = String(b.uraian ?? '').trim();
    if (!s) return { ok: false, error: 'uraian wajib' };
    if (s.length > 500) return { ok: false, error: 'uraian maks 500 karakter' };
    patch.uraian = s;
  }

  if (ada('satuan')) {
    const s = String(b.satuan ?? '').trim();
    if (!s) return { ok: false, error: 'satuan wajib' };
    patch.satuan = s;
  }

  if (ada('volume')) {
    const n = Number(b.volume);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'volume harus >= 0' };
    patch.volume = n;
  }

  if (ada('harga_satuan')) {
    const n = Number(b.harga_satuan);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'harga_satuan harus >= 0' };
    patch.harga_satuan = n;
  }

  const optTeks = (v) => { const s = String(v ?? '').trim(); return s || null; };
  for (const k of ['kelompok_belanja', 'spesifikasi', 'kode_rekening', 'catatan']) {
    if (ada(k)) patch[k] = optTeks(b[k]);
  }

  if (ada('standar_harga_id')) {
    let v = b.standar_harga_id;
    if (v === '' || v == null) v = null;
    else {
      const n = Number(v);
      if (!Number.isInteger(n)) return { ok: false, error: 'standar_harga_id harus integer' };
      v = n;
    }
    patch.standar_harga_id = v;
  }

  if (ada('harga_standar')) {
    let v = b.harga_standar;
    if (v === '' || v == null) v = null;
    else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'harga_standar harus >= 0' };
      v = n;
    }
    patch.harga_standar = v;
  }

  if (Object.keys(patch).length === 0) return { ok: false, kosong: true };
  return { ok: true, patch };
}
