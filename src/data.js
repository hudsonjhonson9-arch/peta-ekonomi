export const SECTORS = [
  "Semua Sektor",
  "Perencanaan",
  "Pertanian & Pangan",
  "Perdagangan & UMKM",
  "Pariwisata",
  "Investasi & Industri",
  "Ketenagakerjaan",
  "Keuangan Daerah",
  "Infrastruktur",
  "Kesehatan",
  "Pendidikan",
  "Lingkungan Hidup",
  "Sosial & Kemasyarakatan",
];

export const DOC_TYPES = [
  "Semua Jenis",
  "RPJMD",
  "Renstra",
  "Renja",
  "RKA",
  "Kajian Ekonomi",
  "Laporan Evaluasi",
  "Data Statistik",
  "Notulen Rapat",
];

export const YEARS = ["Semua Tahun","2027","2026","2025", "2024", "2023", "2022", "2021", "2020"];

export const STATUS_LIST = [
  "Semua Status",
  "Diarsipkan",
  "Menunggu Review",
  "Menunggu Persetujuan",
  "Ditolak",
];

export const STATUS_COLOR = {
  Diarsipkan:             { bg: "#EFF6FF", text: "#2563EB", darkBg: "#1E3A5F", darkText: "#60A5FA" },
  "Menunggu Review":      { bg: "#FFF7ED", text: "#EA580C", darkBg: "#431407", darkText: "#FB923C" },
  "Menunggu Persetujuan": { bg: "#FFFBEB", text: "#D97706", darkBg: "#451A03", darkText: "#FBBF24" },
  Ditolak:                { bg: "#FEF2F2", text: "#DC2626", darkBg: "#450A0A", darkText: "#F87171" },
};

export const ROLE_COLOR = {
  Admin:    { bg: "#EDE9FE", text: "#7C3AED", darkBg: "#2E1065", darkText: "#A78BFA" },
  Reviewer: { bg: "#EFF6FF", text: "#2563EB", darkBg: "#1E3A5F", darkText: "#60A5FA" },
  Staf:     { bg: "#F0FDF4", text: "#16A34A", darkBg: "#052E16", darkText: "#4ADE80" },
};

// ═══ Kertas Kerja (Output per Sub Kegiatan) ═══════════════════════════════

export const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Jumlah periode dalam setahun = target_per_tahun. Jadi target 12 berarti 12
// dokumen, satu per bulan; target 1 berarti satu dokumen untuk setahun.
// Frekuensi hanya menentukan penamaan periode dan aturan deadline.
export const FREKUENSI = [
  { value: "Bulanan",    label: "Bulanan",    jumlah: 12 },
  { value: "Triwulan",   label: "Triwulan",   jumlah: 4  },
  { value: "Semesteran", label: "Semesteran", jumlah: 2  },
  { value: "Tahunan",    label: "Tahunan",    jumlah: 1  },
  { value: "Lainnya",    label: "Lainnya",    jumlah: null },
];

export const FREKUENSI_MAP = Object.fromEntries(FREKUENSI.map(f => [f.value, f]));

// Target menentukan frekuensi yang paling pas. Target di luar 1/2/4/12
// tetap sah (jadi N periode bernama "Periode N"), hanya labelnya generik.
export function frekuensiDariTarget(target) {
  const t = parseInt(target, 10);
  if (t === 12) return "Bulanan";
  if (t === 4)  return "Triwulan";
  if (t === 2)  return "Semesteran";
  if (t === 1)  return "Tahunan";
  return "Lainnya";
}

// Jumlah periode yang akan dibuat = target, sama seperti perhitungan server.
export function jumlahPeriode(target) {
  const t = parseInt(target, 10);
  if (!Number.isInteger(t) || t < 1) return 1;
  return Math.min(24, t);
}

// Pilihan deadline per frekuensi. Nilai ini dikirim apa adanya ke kolom
// deadline_rule; perhitungannya di server (lihat hitungDeadline).
export const DEADLINE_PRESET = {
  Bulanan: [
    { value: "next_month:5",    label: "Tanggal 5 bulan berikutnya" },
    { value: "next_month:10",   label: "Tanggal 10 bulan berikutnya" },
    { value: "next_month:15",   label: "Tanggal 15 bulan berikutnya" },
    { value: "next_month:20",   label: "Tanggal 20 bulan berikutnya" },
    { value: "next_month:25",   label: "Tanggal 25 bulan berikutnya" },
    { value: "next_month:last", label: "Hari terakhir bulan berikutnya" },
  ],
  Triwulan: [
    { value: "quarter_end:5",  label: "5 hari setelah akhir kuartal" },
    { value: "quarter_end:10", label: "10 hari setelah akhir kuartal" },
  ],
  Semesteran: [
    { value: "semiannual_end:5",  label: "5 hari setelah akhir semester" },
    { value: "semiannual_end:10", label: "10 hari setelah akhir semester" },
  ],
  Tahunan: [
    { value: "year_end",      label: "31 Desember tahun tersebut" },
    { value: "next_january",  label: "31 Januari tahun berikutnya" },
  ],
  Lainnya: [
    { value: "year_end",       label: "31 Desember tahun tersebut" },
    { value: "next_january",   label: "31 Januari tahun berikutnya" },
    { value: "next_month:10",  label: "Tanggal 10 bulan berikutnya" },
  ],
};

export const DEADLINE_DEFAULT = {
  Bulanan: "next_month:10",
  Triwulan: "quarter_end:10",
  Semesteran: "semiannual_end:10",
  Tahunan: "year_end",
  Lainnya: "year_end",
};

export function labelDeadline(frekuensi, rule) {
  const list = DEADLINE_PRESET[frekuensi] || DEADLINE_PRESET.Tahunan;
  return list.find(d => d.value === rule)?.label || "—";
}

// Hanya Admin yang boleh membuat/mengubah definisi output, mengatur periode
// satu tahun, dan mengoreksi deadline. Semua role boleh melihat & mengunggah.
//
// CATATAN: ini gate di sisi klien saja. Server arsip-digital belum punya
// autentikasi/sesi sama sekali, jadi gate ini bukan pengaman sungguhan.
export function canManageOutput(role) {
  return role === "Admin";
}

// Status periode tidak disimpan di database — diturunkan dari deadline dan
// status dokumen, supaya tidak pernah out-of-sync dengan review dokumen.
export const STATUS_PERIODE = {
  Terlambat:    { label: "Terlambat",      icon: "alert",       color: "#DC2626", darkBg: "#450A0A", darkText: "#F87171" },
  JatuhTempo:   { label: "Jatuh tempo",    icon: "clock",       color: "#EA580C", darkBg: "#431407", darkText: "#FB923C" },
  Menunggu:     { label: "Menunggu review",icon: "clock",       color: "#D97706", darkBg: "#451A03", darkText: "#FBBF24" },
  Ditolak:      { label: "Ditolak",        icon: "alert",       color: "#DC2626", darkBg: "#450A0A", darkText: "#F87171" },
  Selesai:      { label: "Diarsipkan",     icon: "checkCircle", color: "#16A34A", darkBg: "#052E16", darkText: "#4ADE80" },
  Belum:        { label: "Belum ada",      icon: "file",        color: "#64748B", darkBg: "#1E293B", darkText: "#94A3B8" },
  TidakBerlaku: { label: "Tidak berlaku",  icon: "x",           color: "#94A3B8", darkBg: "#1E293B", darkText: "#64748B" },
};

const HARI_MENDATANG = 3;

// p = satu baris kertas_kerja_periode
export function statusPeriode(p, hariIni = new Date()) {
  if (!p) return "Belum";
  if (!p.is_wajib) return "TidakBerlaku";
  if (p.doc_id == null) {
    const d = new Date(p.deadline + "T00:00:00");
    const today = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
    if (d < today) return "Terlambat";
    const soon = new Date(today);
    soon.setDate(soon.getDate() + HARI_MENDATANG);
    if (d <= soon) return "JatuhTempo";
    return "Belum";
  }
  if (p.doc_status === "Diarsipkan") return "Selesai";
  if (p.doc_status === "Ditolak") return "Ditolak";
  return "Menunggu";
}

// Progres satu output: hanya periode wajib yang dihitung.
export function progresOutput(output) {
  const wajib = (output.periods || []).filter(p => p.is_wajib);
  if (wajib.length === 0) {
    return { terisi: 0, total: output.target_per_tahun || 0, persen: 0 };
  }
  const terisi = wajib.filter(p => p.doc_id != null).length;
  const total = wajib.length;
  return { terisi, total, persen: total ? Math.round((terisi / total) * 100) : 0 };
}

export function sisaHari(deadline) {
  const d = new Date(deadline + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

export function formatTanggal(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}


