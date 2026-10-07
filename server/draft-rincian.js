// Helper murni untuk fitur Draft Rincian: validasi item rencana belanja dan
// perhitungan total. Tidak ada akses DB dan tidak ada dependensi express —
// murni object-in/object-out.

// Total baris (rupiah, pembulatan Math.round — klien memakai rumus identik
// di DraftRincian sehingga total preview = total server).
export const jumlahItem = (volume, harga) => Math.round(volume * harga);

// → {ok: true, item} | {ok: false, error}
// wajib: uraian (string, trim, maks 500), satuan (trim), volume number > 0,
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
  if (!Number.isFinite(volume) || volume <= 0) return { ok: false, error: 'volume harus > 0' };

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
