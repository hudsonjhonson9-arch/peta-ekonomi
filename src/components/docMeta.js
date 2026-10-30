// Warna & ikon tipe dokumen. Dipisah dari DocPages supaya daftar dokumen
// (PustakaBerkas) dan halaman detail memakai definisi yang sama.

let _dark = false;
export function setDark(v) { _dark = !!v; }

export function adapt(c) {
  if (!_dark) return c;
  const fg = c.color || c.text;
  const bg = `color-mix(in srgb, ${fg} 22%, transparent)`;
  const nf = `color-mix(in srgb, ${fg} 60%, white)`;
  return c.color ? { ...c, bg, color: nf } : { ...c, bg, text: nf };
}

export const FILE_TYPE_COLORS = {
  "Laporan": { bg: "#EFF6FF", text: "#2563EB" },
  "Peraturan": { bg: "#FEF3C7", text: "#D97706" },
  "Keputusan": { bg: "#F3E8FF", text: "#9333EA" },
  "Notulis": { bg: "#ECFDF5", text: "#059669" },
  "Data": { bg: "#FFF1F2", text: "#E11D48" },
};

export function getFileTypeColor(type) {
  return adapt(FILE_TYPE_COLORS[type] || { bg: "#F1F5F9", text: "#64748B" });
}

export const BIDANG_COLORS = {
  "Sekretariat":                                    { bg: "#F1F5F9", text: "#475569" },
  "Bidang Perencanaan":                             { bg: "#EFF6FF", text: "#2563EB" },
  "Bidang Ekonomi dan SDA":                         { bg: "#ECFDF5", text: "#059669" },
  "Bidang Pemerintahan dan Pembangunan Manusia":    { bg: "#FEF3C7", text: "#D97706" },
  "Bidang Infrastruktur dan Kewilayahan":           { bg: "#F3E8FF", text: "#9333EA" },
  "Bidang Riset dan Inovasi Daerah":                { bg: "#FFF1F2", text: "#E11D48" },
};

export function getBidangColor(bidang) {
  return adapt(BIDANG_COLORS[bidang] || { bg: "#F1F5F9", text: "#64748B" });
}

export const EXT_MAP = {
  pdf:  { icon: "file", bg: "#FEF2F2", color: "#DC2626", label: "PDF" },
  doc:  { icon: "file", bg: "#EFF6FF", color: "#2563EB", label: "Word" },
  docx: { icon: "file", bg: "#EFF6FF", color: "#2563EB", label: "Word" },
  xls:  { icon: "file", bg: "#ECFDF5", color: "#059669", label: "Excel" },
  xlsx: { icon: "file", bg: "#ECFDF5", color: "#059669", label: "Excel" },
  ppt:  { icon: "file", bg: "#FEF3C7", color: "#D97706", label: "PPT" },
  pptx: { icon: "file", bg: "#FEF3C7", color: "#D97706", label: "PPT" },
  jpg:  { icon: "file", bg: "#F5F3FF", color: "#7C3AED", label: "Gambar" },
  jpeg: { icon: "file", bg: "#F5F3FF", color: "#7C3AED", label: "Gambar" },
  png:  { icon: "file", bg: "#F5F3FF", color: "#7C3AED", label: "Gambar" },
  gif:  { icon: "file", bg: "#F5F3FF", color: "#7C3AED", label: "Gambar" },
  csv:  { icon: "file", bg: "#ECFDF5", color: "#059669", label: "CSV" },
  zip:  { icon: "file", bg: "#F1F5F9", color: "#64748B", label: "ZIP" },
};

export const TYPE_COLORS = {
  "Perencanaan":             { bg: "#ECFDF5", color: "#059669" },
  "Perencanaan Tahunan (RKPD)": { bg: "#ECFDF5", color: "#059669" },
  "RKPD":                    { bg: "#ECFDF5", color: "#059669" },
  "Renstra":                 { bg: "#ECFDF5", color: "#059669" },
  "Renja":                   { bg: "#FEF3C7", color: "#D97706" },
  "RKA":                     { bg: "#FEF3C7", color: "#D97706" },
  "Laporan Evaluasi":        { bg: "#EFF6FF", color: "#2563EB" },
  "Evaluasi & Pelaporan":    { bg: "#EFF6FF", color: "#2563EB" },
  "Kajian Ekonomi":          { bg: "#F5F3FF", color: "#7C3AED" },
  "Forum Perencanaan":       { bg: "#FDF2F8", color: "#DB2777" },
  "Administrasi Umum":       { bg: "#F1F5F9", color: "#475569" },
  "Administrasi":            { bg: "#F1F5F9", color: "#475569" },
};
export const DEFAULT_TYPE_COLOR = { bg: "#F1F5F9", color: "#64748B" };

export function getFileExtInfo(name) {
  if (!name) return adapt({ icon: "file", bg: "#F1F5F9", color: "#64748B", label: "File" });
  const ext = name.split(".").pop().toLowerCase();
  return adapt(EXT_MAP[ext] || { icon: "file", bg: "#F1F5F9", color: "#64748B", label: ext.toUpperCase() });
}

// ponytail: fallback ke warna kategori kalau dokumen tidak punya daftar berkas
export function getDocFileInfo(d) {
  if (Array.isArray(d.files) && d.files.length > 0) {
    return getFileExtInfo(d.files[0].name || d.files[0]);
  }
  return { icon: "file", ...adapt(TYPE_COLORS[d.type] || DEFAULT_TYPE_COLOR), label: d.type || "File" };
}
