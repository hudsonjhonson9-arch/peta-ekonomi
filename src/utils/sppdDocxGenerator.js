import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function toDate(v) {
  if (!v) return null;
  const s = String(v);
  const m = s.includes("T") ? null : s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function tanggalID(v) {
  const d = toDate(v);
  if (!d) return v ? String(v) : "";
  return d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
}

export function terbilang(n) {
  const angka = Number(n);
  if (isNaN(angka) || angka < 0) return "";
  const satuan = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima",
    "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
  ];
  if (angka < 12) return satuan[angka];
  if (angka < 20) return terbilang(angka - 10) + " Belas";
  if (angka < 100) return terbilang(Math.floor(angka / 10)) + " Puluh" + (angka % 10 ? " " + terbilang(angka % 10) : "");
  if (angka < 200) return "Seratus" + (angka % 100 ? " " + terbilang(angka % 100) : "");
  if (angka < 1000) return terbilang(Math.floor(angka / 100)) + " Ratus" + (angka % 100 ? " " + terbilang(angka % 100) : "");
  return String(angka);
}

export function formatLamaHari(start, end) {
  const d1 = toDate(start);
  const d2 = toDate(end);
  if (!d1 || !d2) return "1 (Satu) Hari";
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const n = Math.max(1, Math.round(diffTime / 86400000) + 1);
  return `${n} (${terbilang(n)}) Hari`;
}

function unduhBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1500);
}

export async function renderDocxBlob(templateUrl, tags) {
  try {
    const res = await fetch(templateUrl);
    if (!res.ok) throw new Error(`Gagal memuat berkas template (HTTP ${res.status})`);
    const arrayBuf = await res.arrayBuffer();
    const zip = new PizZip(arrayBuf);
    const doc = new Docxtemplater(zip, {
      delimiters: { start: "{", end: "}" },
      paragraphLoop: true,
      linebreaks: true,
    });
    doc.render(tags);
    return doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
  } catch (err) {
    console.error("[sppdDocxGenerator] Gagal render docx:", err);
    throw err;
  }
}

export function bangunTagsSPT(it) {
  const tahun = it.tahun || new Date().getFullYear();
  let pengikutList = [];
  try {
    pengikutList = Array.isArray(it.pengikut) ? it.pengikut : JSON.parse(it.pengikut || "[]");
  } catch (_) {
    pengikutList = [];
  }

  const pelaksana = [
    {
      No: 1,
      Nama: it.pelaksana_nama || "-",
      PangkatGol: it.pelaksana_pangkat || "-",
      NIP: it.pelaksana_nip ? `NIP. ${it.pelaksana_nip}` : "-",
      Jabatan: it.pelaksana_jabatan || "-"
    },
    ...pengikutList.map((p, idx) => ({
      No: idx + 2,
      Nama: p.nama || "-",
      PangkatGol: p.pangkat || "-",
      NIP: p.nip ? `NIP. ${p.nip}` : "-",
      Jabatan: p.jabatan || "-"
    }))
  ];

  let untuk = (it.maksud_perjalanan || "").trim();
  if (it.tempat_tujuan) untuk += " di " + it.tempat_tujuan;
  if (untuk && !/[.!]$/.test(untuk)) untuk += ".";

  return {
    Nomor: it.nomor_spt || it.nomor_register || "001/SPT/2026",
    Dasar: it.dasar_hukum || `DPA Bapperida Kabupaten Sumba Barat TA ${tahun}`,
    pelaksana,
    Untuk: untuk,
    DitetapkanDi: it.tempat_berangkat || "Waikabubak",
    TanggalSurat: tanggalID(it.tanggal_spt || it.tanggal_berangkat || new Date()),
    KepalaNama: it.pejabat_perintah || "CHARLES HERMANA WERU,S.Sos",
    KepalaPangkat: "Pembina Utama Muda – IV/c",
    KepalaNIP: "19721102 200112 1 001",
    Paraf1: "Sekretaris BAPPERIDA",
    Paraf2: "Kepala Bidang Terkait",
    Paraf3: "Kasubbag Umum & Kepegawaian"
  };
}

export function bangunTagsSPPD(it, person = null) {
  const tahun = it.tahun || new Date().getFullYear();
  const nama = person?.nama || it.pelaksana_nama || "-";
  const nip = person?.nip || it.pelaksana_nip || "-";
  const pangkat = person?.pangkat || it.pelaksana_pangkat || "-";
  const jabatan = person?.jabatan || it.pelaksana_jabatan || "-";

  return {
    NomorSPPD: it.nomor_sppd || it.nomor_register || "001/SPPD/2026",
    KpaNama: it.pejabat_perintah || "CHARLES HERMANA WERU,S.Sos",
    Nama: nama,
    NIP: nip,
    PangkatGolongan: pangkat,
    JabatanInstansi: jabatan,
    TingkatBiaya: it.jenis_sppd === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C",
    Maksud: it.maksud_perjalanan || "-",
    AlatAngkut: it.alat_angkutan || "Kendaraan Dinas / Darat",
    TempatBerangkat: it.tempat_berangkat || "Waikabubak",
    TempatTujuan: it.tempat_tujuan || "-",
    LamaHari: formatLamaHari(it.tanggal_berangkat, it.tanggalKembali || it.tanggal_kembali),
    TanggalBerangkat: tanggalID(it.tanggal_berangkat),
    TanggalKembali: tanggalID(it.tanggal_kembali || it.tanggalKembali || it.tanggal_berangkat),
    Instansi: "Bapperida Kabupaten Sumba Barat",
    MataAnggaran: it.subkegiatan_nama
      ? `DPA Bapperida - ${it.subkegiatan_nama}`
      : `DPA Bapperida Kabupaten Sumba Barat TA ${tahun}`,
    DitetapkanDi: it.tempat_berangkat || "Waikabubak",
    TanggalPenetapan: tanggalID(it.tanggal_spt || it.tanggal_berangkat || new Date()),
    KepalaNama: it.pejabat_perintah || "CHARLES HERMANA WERU,S.Sos",
    KepalaPangkat: "Pembina Utama Muda – IV/c",
    KepalaNIP: "19721102 200112 1 001",
    SekretarisNama: "IMANUEL MOSES KALEGOTAN, ST.,M.Si",
    SekretarisNIP: "19800315 200501 1 011",
    BidangNama: "BERLIAN MAGU WERU,S.Sos",
    BidangNIP: "19690619 200903 1 001",
    KtuNama: "",
    KtuNIP: "",
    Paraf1: "Sekretaris BAPPERIDA",
    Paraf2: "Kepala Bidang Terkait",
    Paraf3: "Kasubbag Umum & Kepegawaian"
  };
}

export async function unduhSuratTugasDocx(it) {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const templatePath = `${baseUrl.replace(/\/$/, "")}/templates/spt_template.docx`;
  const tags = bangunTagsSPT(it);
  const blob = await renderDocxBlob(templatePath, tags);
  const cleanNo = (it.nomor_spt || it.nomor_register || "SPT").replace(/[\/\\?%*:|"<>]/g, "_");
  unduhBlob(blob, `Surat_Tugas_${cleanNo}.docx`);
  return true;
}

export async function unduhSppdDocx(it, person = null) {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const templatePath = `${baseUrl.replace(/\/$/, "")}/templates/sppd_template.docx`;
  const tags = bangunTagsSPPD(it, person);
  const blob = await renderDocxBlob(templatePath, tags);
  const targetNama = (person?.nama || it.pelaksana_nama || "Pelaksana").replace(/[\/\\?%*:|"<>]/g, "_");
  const cleanNo = (it.nomor_sppd || it.nomor_register || "SPPD").replace(/[\/\\?%*:|"<>]/g, "_");
  unduhBlob(blob, `SPPD_${cleanNo}_${targetNama}.docx`);
  return true;
}
