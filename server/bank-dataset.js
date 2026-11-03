import { R_ADMIN, R_REVIEWER, R_BANKDATA } from './session.js';

export const TIPE_FIELD_SAH = ['teks', 'angka', 'desimal', 'tanggal', 'pilihan'];
export const KLASIFIKASI_SAH = ['terbuka', 'terbatas', 'tertutup'];
export const FREKUENSI_SAH = ['Tahunan', 'Semesteran', 'Triwulan', 'Bulanan', 'Lainnya'];
export const STATUS_SAH = ['draft', 'diajukan', 'disetujui', 'perlu_perbaikan', 'ditolak'];

export function opdTerbatas(user) {
  return !!user && (user.role === R_BANKDATA || user.opd_scoped === true);
}

export function opdMilik(user, opdId) {
  if (!user) return false;
  if (!opdTerbatas(user)) return true;
  if (!user.opd_id) return false;
  return String(user.opd_id) === String(opdId);
}

export function bolehEditStatus(status) {
  return status === 'draft' || status === 'perlu_perbaikan' || status === 'ditolak';
}

export function bolehVerifikasi(userOrRole) {
  if (typeof userOrRole === 'object' && userOrRole) {
    if (Array.isArray(userOrRole.permissions) && (userOrRole.permissions.includes('*') || userOrRole.permissions.includes('bankdata.verify'))) {
      return true;
    }
    const base = userOrRole.base_level || userOrRole.role;
    return base === R_ADMIN || base === R_REVIEWER || userOrRole.role === R_ADMIN || userOrRole.role === R_REVIEWER;
  }
  const role = userOrRole;
  return role === R_ADMIN || role === R_REVIEWER;
}

export function validasiMetadataDataset(body = {}) {
  const opdId = body.opd_id != null && String(body.opd_id).trim() !== ''
    ? parseInt(body.opd_id, 10)
    : null;
  if (!Number.isInteger(opdId) || opdId <= 0) {
    return { ok: false, error: 'OPD wajib dipilih' };
  }
  const nama = String(body.nama || body.judul || body.nama_data || '').trim();
  if (!nama) return { ok: false, error: 'Nama data / indikator wajib diisi' };
  const klasifikasi = String(body.klasifikasi || body.klasifikasi_risiko || 'terbuka').trim().toLowerCase();
  if (!KLASIFIKASI_SAH.includes(klasifikasi)) {
    return { ok: false, error: 'Klasifikasi tidak valid' };
  }
  const rawFrek = String(body.frekuensi || body.frekuensi_pemutakhiran || 'Tahunan').trim();
  let frekuensi = 'Tahunan';
  const lowFrek = rawFrek.toLowerCase();
  if (lowFrek.startsWith('tahun')) frekuensi = 'Tahunan';
  else if (lowFrek.startsWith('semest')) frekuensi = 'Semesteran';
  else if (lowFrek.startsWith('triw')) frekuensi = 'Triwulan';
  else if (lowFrek.startsWith('bulan')) frekuensi = 'Bulanan';
  else if (FREKUENSI_SAH.includes(rawFrek)) frekuensi = rawFrek;

  const tahunMulai = body.tahun_mulai != null && String(body.tahun_mulai).trim() !== ''
    ? parseInt(body.tahun_mulai, 10)
    : null;
  if (tahunMulai !== null && (!Number.isInteger(tahunMulai) || tahunMulai < 1900 || tahunMulai > 2100)) {
    return { ok: false, error: 'Tahun mulai tidak valid' };
  }

  const urusanId = body.urusan_id ? parseInt(body.urusan_id, 10) : null;
  const bidangUrusanId = (body.bidang_urusan_id || body.bidang_id) ? parseInt(body.bidang_urusan_id || body.bidang_id, 10) : null;
  
  let topikId = null;
  if (Array.isArray(body.topic_ids) && body.topic_ids.length > 0) topikId = parseInt(body.topic_ids[0], 10);
  else if (body.topik_id) topikId = parseInt(body.topik_id, 10);

  let subTopikId = null;
  if (Array.isArray(body.subtopic_ids) && body.subtopic_ids.length > 0) subTopikId = parseInt(body.subtopic_ids[0], 10);
  else if (body.sub_topik_id) subTopikId = parseInt(body.sub_topik_id, 10);

  const satuanId = body.satuan_id ? parseInt(body.satuan_id, 10) : null;

  let keywords = [];
  if (Array.isArray(body.keywords)) {
    keywords = body.keywords.map(k => String(k).trim()).filter(Boolean);
  } else if (typeof body.keywords === 'string' && body.keywords.trim()) {
    try {
      const parsed = JSON.parse(body.keywords);
      if (Array.isArray(parsed)) keywords = parsed.map(k => String(k).trim()).filter(Boolean);
      else keywords = body.keywords.split(',').map(k => k.trim()).filter(Boolean);
    } catch {
      keywords = body.keywords.split(',').map(k => k.trim()).filter(Boolean);
    }
  }

  const kodeSds = body.kode_sds ? String(body.kode_sds).trim() : null;
  const kodeIndikator = body.kode_indikator ? String(body.kode_indikator).trim() : null;
  const definisi = body.definisi ? String(body.definisi).trim() : null;
  const sumberReferensi = (body.sumber_referensi || body.sumber_data) ? String(body.sumber_referensi || body.sumber_data).trim() : null;
  const prioritas = (body.prioritas === 'prioritas' || body.prioritas === 'Prioritas') ? 'prioritas' : 'non_prioritas';
  const klasifikasiRisiko = klasifikasi;
  const klasifikasiPenyajian = body.klasifikasi_penyajian ? String(body.klasifikasi_penyajian).trim() : null;
  const jadwalPemutakhiran = body.jadwal_pemutakhiran || null;
  const jadwalPemutakhiranAkhir = body.jadwal_pemutakhiran_akhir || null;

  const lowNama = nama.toLowerCase();
  const lowDesk = String(body.deskripsi || '').toLowerCase();
  const isNegatifDefault =
    lowNama.includes('miskin') ||
    lowNama.includes('kemiskinan') ||
    lowNama.includes('stunting') ||
    lowNama.includes('kematian') ||
    lowNama.includes('pengangguran') ||
    lowNama.includes('gizi buruk') ||
    lowNama.includes('putus sekolah') ||
    lowNama.includes('kriminal') ||
    lowDesk.includes('kemiskinan') ||
    lowDesk.includes('stunting');

  let polaritas = 'positif';
  if (body.polaritas === 'negatif' || body.polaritas === 'positif') {
    polaritas = body.polaritas;
  } else if (isNegatifDefault) {
    polaritas = 'negatif';
  }

  const nilai = {
    opd_id: opdId,
    nama,
    deskripsi: body.deskripsi ? String(body.deskripsi).trim() : (definisi || null),
    definisi: definisi || (body.deskripsi ? String(body.deskripsi).trim() : null),
    satuan: (body.satuan || body.satuan_default) ? String(body.satuan || body.satuan_default).trim() : null,
    sumber_data: sumberReferensi,
    klasifikasi,
    frekuensi,
    tahun_mulai: tahunMulai,
    urusan_id: urusanId,
    bidang_urusan_id: bidangUrusanId,
    topik_id: topikId,
    sub_topik_id: subTopikId,
    satuan_id: satuanId,
    keywords,
    kode_sds: kodeSds,
    kode_indikator: kodeIndikator,
    sumber_referensi: sumberReferensi,
    prioritas,
    klasifikasi_risiko: klasifikasiRisiko,
    klasifikasi_penyajian: klasifikasiPenyajian,
    frekuensi_pemutakhiran: frekuensi,
    jadwal_pemutakhiran: jadwalPemutakhiran,
    jadwal_pemutakhiran_akhir: jadwalPemutakhiranAkhir,
    polaritas,
  };
  return {
    ok: true,
    nilai,
    data: nilai,
  };
}

export function normalisasiNamaField(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function validasiDaftarField(fields) {
  if (!Array.isArray(fields)) return { ok: false, error: 'Daftar field harus berupa array' };
  const seen = new Set();
  const out = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i] || {};
    const label = String(f.label || '').trim();
    if (!label) return { ok: false, error: `Field #${i + 1}: label wajib diisi` };
    const nama_field = normalisasiNamaField(f.nama_field || f.nama || label);
    if (!nama_field) return { ok: false, error: `Field #${i + 1}: nama field tidak valid` };
    if (seen.has(nama_field)) {
      return { ok: false, error: `Nama field duplikat: "${nama_field}"` };
    }
    seen.add(nama_field);
    const tipe_data = f.tipe_data || f.tipe || 'teks';
    if (!TIPE_FIELD_SAH.includes(tipe_data)) {
      return { ok: false, error: `Field "${label}": tipe data "${tipe_data}" tidak dikenal` };
    }
    let pilihan = [];
    if (tipe_data === 'pilihan') {
      const rawPilihan = Array.isArray(f.pilihan)
        ? f.pilihan
        : typeof f.pilihan === 'string'
          ? f.pilihan.split(',')
          : [];
      pilihan = rawPilihan.map(x => String(x).trim()).filter(Boolean);
      if (pilihan.length === 0) {
        return { ok: false, error: `Field "${label}": tipe pilihan wajib memiliki minimal 1 opsi` };
      }
    }
    const bisaGrafik = tipe_data === 'angka' || tipe_data === 'desimal';
    const tampil_grafik = bisaGrafik
      ? (f.tampil_grafik !== undefined ? Boolean(f.tampil_grafik) : true)
      : false;

    out.push({
      nama_field,
      nama: nama_field,
      label,
      tipe_data,
      tipe: tipe_data,
      wajib: Boolean(f.wajib),
      urutan: Number.isInteger(f.urutan) ? f.urutan : i + 1,
      pilihan,
      tampil_grafik,
    });
  }
  return { ok: true, fields: out };
}

export function validasiSatuBaris(row, fields, idx = 0) {
  const prefix = `Baris #${idx + 1}`;
  if (!row || typeof row !== 'object') return { ok: false, error: `${prefix}: format baris tidak valid` };
  const tahun = parseInt(row.tahun, 10);
  if (!Number.isInteger(tahun) || tahun < 1900 || tahun > 2100) {
    return { ok: false, error: `${prefix}: tahun tidak valid` };
  }
  const periode = row.periode != null && String(row.periode).trim() !== ''
    ? String(row.periode).trim()
    : null;
  const wilayah_kode = row.wilayah_kode != null && String(row.wilayah_kode).trim() !== ''
    ? String(row.wilayah_kode).trim()
    : null;

  const rawData = row.data && typeof row.data === 'object' ? row.data : row;
  const cleanData = {};

  for (const f of fields) {
    const v = rawData[f.nama_field] !== undefined ? rawData[f.nama_field] : rawData[f.label];
    const kosong = v === undefined || v === null || String(v).trim() === '';
    if (kosong) {
      if (f.wajib) {
        return { ok: false, error: `${prefix}: kolom "${f.label}" wajib diisi` };
      }
      cleanData[f.nama_field] = null;
      continue;
    }

    const str = String(v).trim();
    if (f.tipe_data === 'angka') {
      const n = Number(str.replace(/,/g, ''));
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        return { ok: false, error: `${prefix}: kolom "${f.label}" harus berupa bilangan bulat` };
      }
      cleanData[f.nama_field] = n;
    } else if (f.tipe_data === 'desimal') {
      const sClean = str.replace(/\s+/g, '');
      const norm = sClean.includes(',') ? sClean.replace(/\./g, '').replace(',', '.') : sClean;
      const n = Number(norm);
      if (!Number.isFinite(n)) {
        return { ok: false, error: `${prefix}: kolom "${f.label}" harus berupa angka/desimal` };
      }
      cleanData[f.nama_field] = n;
    } else if (f.tipe_data === 'tanggal') {
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: `${prefix}: kolom "${f.label}" harus berupa tanggal yang valid` };
      }
      cleanData[f.nama_field] = str;
    } else if (f.tipe_data === 'pilihan') {
      const opsi = Array.isArray(f.pilihan) ? f.pilihan : [];
      if (!opsi.includes(str)) {
        return { ok: false, error: `${prefix}: nilai "${str}" pada "${f.label}" tidak ada dalam pilihan (${opsi.join(', ')})` };
      }
      cleanData[f.nama_field] = str;
    } else {
      cleanData[f.nama_field] = str;
    }
  }

  return {
    ok: true,
    row: {
      tahun,
      periode,
      wilayah_kode,
      data: cleanData,
    },
  };
}
