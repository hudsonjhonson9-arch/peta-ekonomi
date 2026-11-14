import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

async function getHtml2Pdf() {
  const mod = await import("html2pdf.js");
  return mod.default || mod;
}

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

// ═════════════════════════════════════════════════════════════════════════════
// KONFIGURASI KOP SURAT (BAPPERIDA & SEKRETARIAT DAERAH)
// ═════════════════════════════════════════════════════════════════════════════

export const KOP_PRESETS = {
  BAPPERIDA: {
    key: "BAPPERIDA",
    label: "KOP BAPPERIDA",
    pemkab: "PEMERINTAH KABUPATEN SUMBA BARAT",
    instansi1: "BADAN PERENCANAAN PEMBANGUNAN, ",
    instansi2: "RISET DAN INOVASI DAERAH",
    instansiHtml: "BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH",
    alamat: "Jl. Wee Karou Nomor. – Waikabubak Provinsi Nusa Tenggara Timur",
    kontak: "Telp (0387) 22203 Fax (0387) 21093, Email : wesumba@yahoo.com",
    kota: "W A I K A B U B A K",
    defaultJabatanTtd: "KEPALA BAPPERIDA",
    defaultSekretarisJabatan: "SEKRETARIS BAPPERIDA",
    defaultInstansiAnggaran: "Bapperida Kabupaten Sumba Barat"
  },
  SEKDA: {
    key: "SEKDA",
    label: "KOP Sekretariat Daerah",
    pemkab: "PEMERINTAH KABUPATEN SUMBA BARAT",
    instansi1: "SEKRETARIAT DAERAH",
    instansi2: "",
    instansiHtml: "SEKRETARIAT DAERAH",
    alamat: "Jl. Wee Karou Nomor. – Waikabubak Provinsi Nusa Tenggara Timur",
    kontak: "Telp (0387) 22203 Fax (0387) 21093, Email : wesumba@yahoo.com",
    kota: "W A I K A B U B A K",
    defaultJabatanTtd: "SEKRETARIS DAERAH",
    defaultSekretarisJabatan: "SEKRETARIS DAERAH",
    defaultInstansiAnggaran: "Sekretariat Daerah Kabupaten Sumba Barat"
  }
};

export function resolveKopConfig(it = {}) {
  const wewenang = parseJson(it.wewenang, {}) || {};
  const rawKey = String(it.kop_surat || wewenang.kop_surat || "BAPPERIDA").toUpperCase();
  const isSekda = rawKey === "SEKDA" || rawKey.includes("SEKRETARIAT");
  return isSekda ? KOP_PRESETS.SEKDA : KOP_PRESETS.BAPPERIDA;
}

function getLogoUrl() {
  const baseUrl = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  return `${baseUrl.replace(/\/$/, "")}/Lambang_Kabupaten_Sumba_Barat.png`;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GENERATOR FORMAT WORD (.DOCX)
// ═════════════════════════════════════════════════════════════════════════════

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

export const TTD_DEFAULT = {
  status: "Definitif",
  jabatan: "KEPALA BAPPERIDA",
  nama: "CHARLES HERMANA WERU,S.Sos",
  pangkat: "Pembina Utama Muda – IV/c",
  nip: "19721102 200112 1 001"
};
export const PARAF_DEFAULT = ["Sekretaris BAPPERIDA", "Kepala Bidang Terkait", "Kasubbag Umum & Kepegawaian"];

// Dasar multi-baris -> loop {#dasarRows} di template
export function splitDasar(s) {
  return String(s || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean)
    .map((t, i) => ({ No: i + 1, Teks: t }));
}

function parseJson(v, fb) {
  if (!v) return fb;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch (_) { return fb; }
}

// Tag penandatangan (mendukung Plt. / Plh.) + paraf hierarki + KOP surat
function tagsTtdParaf(it) {
  const kop = resolveKopConfig(it);
  const rawTtd = parseJson(it.penandatangan, {}) || {};
  const t = { ...TTD_DEFAULT, ...rawTtd };
  const prefix = t.status && t.status !== "Definitif" ? t.status + " " : "";
  const paraf = parseJson(it.paraf, []);

  // Jika menggunakan KOP SEKDA dan jabatan penandatangan masih default Kepala BAPPERIDA, sesuaikan otomatis bila pejabat_perintah diisi Sekda
  let baseJabatan = t.jabatan || kop.defaultJabatanTtd || TTD_DEFAULT.jabatan;
  if (kop.key === "SEKDA" && (!rawTtd.jabatan || rawTtd.jabatan === "Kepala BAPPERIDA" || rawTtd.jabatan === "KEPALA BAPPERIDA") && it.pejabat_perintah && /sekretaris daerah|sekda|bupati/i.test(it.pejabat_perintah)) {
    baseJabatan = it.pejabat_perintah;
  }

  return {
    KopJenis: kop.key,
    KopLabel: kop.label,
    KopPemkab: kop.pemkab,
    KopInstansi1: kop.instansi1,
    KopInstansi2: kop.instansi2,
    KopInstansiHtml: kop.instansiHtml,
    KopAlamat: kop.alamat,
    KopKontak: kop.kontak,
    KopKota: kop.kota,
    JabatanTtd: (prefix + baseJabatan).toUpperCase(),
    KepalaNama: t.nama || "",
    KepalaPangkat: t.pangkat || "",
    KepalaNIP: t.nip || "",
    Paraf1: paraf[0] ?? PARAF_DEFAULT[0],
    Paraf2: paraf[1] ?? PARAF_DEFAULT[1],
    Paraf3: paraf[2] ?? PARAF_DEFAULT[2]
  };
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
  if (it.tempat_tujuan && !untuk.toLowerCase().includes(String(it.tempat_tujuan).toLowerCase())) {
    untuk += " di " + it.tempat_tujuan;
  }
  if (untuk && !/[.!]$/.test(untuk)) untuk += ".";

  // "Kepada :" dan nomor hanya di baris pertama / bila >1 orang
  pelaksana.forEach((p, i) => {
    p.KepadaLabel = i === 0 ? "Kepada" : "";
    p.TitikLabel = i === 0 ? ":" : "";
    p.Kepada = p.KepadaLabel;
    p.Titik = p.TitikLabel;
    p.NoTxt = pelaksana.length > 1 ? `${p.No}.` : "";
  });

  const dasarStr = it.dasar_hukum || `DPA Bapperida Kabupaten Sumba Barat TA ${tahun}`;
  const dasarRows = splitDasar(dasarStr);

  return {
    Nomor: it.nomor_spt || it.nomor_register || "001/SPT/2026",
    Dasar: dasarStr,
    dasarRows,
    pelaksana,
    Untuk: untuk,
    DitetapkanDi: it.ditetapkan_di || it.tempat_berangkat || "Waikabubak",
    TanggalSurat: tanggalID(it.tanggal_spt || it.tanggal_berangkat || new Date()),
    ...tagsTtdParaf(it)
  };
}

export function bangunTagsSPPD(it, person = null) {
  const tahun = it.tahun || new Date().getFullYear();
  const isMainPerson = !person || (person.nip && person.nip === it.pelaksana_nip && person.nama === it.pelaksana_nama);

  const nama = person?.nama || it.pelaksana_nama || "-";
  const nip = person?.nip || it.pelaksana_nip || "-";
  const pangkat = person?.pangkat || it.pelaksana_pangkat || "-";
  const jabatan = person?.jabatan || it.pelaksana_jabatan || "-";

  const tp = tagsTtdParaf(it);
  const kop = resolveKopConfig(it);
  const wewenang = parseJson(it.wewenang, {}) || {};
  const sekretaris = wewenang.sekretaris || {};
  const bidang = wewenang.bidang || {};
  const pelaksanaPptk = wewenang.pelaksana_pptk || {};
  const ktu = wewenang.ktu || {};

  // Resolusi Pejabat Pengesah Keberangkatan (Romawi I) per masing-masing personil:
  // Prioritas:
  // 1. Properti langsung pada objek `person` (`pptk_nama` / `pptk_nip` / `pptk_jabatan`)
  // 2. Bila Personil 1 (Pelaksana Utama), cek `it.pelaksana_pptk_*` atau `wewenang.pelaksana_pptk`
  // 3. Fallback ke `wewenang.bidang`
  const pptkNama =
    person?.pptk_nama ||
    person?.bidang_nama ||
    (isMainPerson ? (it.pelaksana_pptk_nama || pelaksanaPptk.nama) : "") ||
    bidang.nama ||
    "BERLIAN MAGU WERU,S.Sos";

  const pptkNip =
    person?.pptk_nip ||
    person?.bidang_nip ||
    (isMainPerson ? (it.pelaksana_pptk_nip || pelaksanaPptk.nip) : "") ||
    bidang.nip ||
    "19690619 200903 1 001";

  const pptkJabatan =
    person?.pptk_jabatan ||
    person?.bidang_jabatan ||
    (isMainPerson ? (it.pelaksana_pptk_jabatan || pelaksanaPptk.jabatan) : "") ||
    bidang.jabatan ||
    it.bidang_jabatan ||
    "Kepala Bidang PPE";

  const tempatBerangkatUtama = it.tempat_berangkat || "Waikabubak";
  const tempatTujuanUtama = it.tempat_tujuan || "-";
  const tglBerangkatUtama = tanggalID(it.tanggal_berangkat);

  // Rute & tanggal di Romawi I juga dapat dioverride per personil bila diperlukan
  const tempatBerangkatRomawiI =
    person?.tempat_berangkat ||
    (isMainPerson ? (it.pelaksana_tempat_berangkat || pelaksanaPptk.tempat_berangkat) : "") ||
    tempatBerangkatUtama;

  const tempatTujuanBerangkat =
    person?.tempat_tujuan ||
    (isMainPerson ? (it.pelaksana_tempat_tujuan || pelaksanaPptk.tempat_tujuan) : "") ||
    tempatTujuanUtama;

  const tglBerangkatRaw =
    person?.tanggal_berangkat ||
    (isMainPerson ? (it.pelaksana_tanggal_berangkat || pelaksanaPptk.tanggal_berangkat) : "") ||
    it.tanggal_berangkat;

  const tanggalBerangkatRomawiI = tglBerangkatRaw ? tanggalID(tglBerangkatRaw) : tglBerangkatUtama;

  const sekJabatan = (sekretaris.jabatan || kop.defaultSekretarisJabatan || "SEKRETARIS BAPPERIDA").toUpperCase();

  return {
    NomorSPPD: person?.nomor_sppd || it.nomor_sppd || it.nomor_register || "001/SPPD/2026",
    KpaNama: tp.KepalaNama,
    Nama: nama,
    NIP: nip,
    PangkatGolongan: pangkat,
    JabatanInstansi: jabatan,
    TingkatBiaya: person?.tingkat_biaya || it.tingkat_biaya || (it.jenis_sppd === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C"),
    Maksud: it.maksud_perjalanan || "-",
    AlatAngkut: it.alat_angkutan || "Kendaraan Dinas / Darat",
    TempatBerangkat: tempatBerangkatUtama,
    TempatTujuan: tempatTujuanUtama,
    TempatBerangkatRomawiI: tempatBerangkatRomawiI,
    TempatTujuanBerangkat: tempatTujuanBerangkat,
    TanggalBerangkatRomawiI: tanggalBerangkatRomawiI,
    LamaHari: it.lama_hari ? `${it.lama_hari} (${terbilang(it.lama_hari)}) Hari` : formatLamaHari(it.tanggal_berangkat, it.tanggalKembali || it.tanggal_kembali),
    TanggalBerangkat: tglBerangkatUtama,
    TanggalKembali: tanggalID(it.tanggal_kembali || it.tanggalKembali || it.tanggal_berangkat),
    Instansi: it.instansi || kop.defaultInstansiAnggaran || "Bapperida Kabupaten Sumba Barat",
    MataAnggaran: it.subkegiatan_nama
      ? `DPA Bapperida - ${it.subkegiatan_nama}`
      : `DPA Bapperida Kabupaten Sumba Barat TA ${tahun}`,
    DitetapkanDi: it.ditetapkan_di || tempatBerangkatUtama,
    TanggalPenetapan: tanggalID(it.tanggal_spt || it.tanggal_berangkat || new Date()),
    SekretarisJabatan: sekJabatan,
    SekretarisNama: sekretaris.nama || "IMANUEL MOSES KALEGOTAN, ST.,M.Si",
    SekretarisNIP: sekretaris.nip || "19800315 200501 1 011",
    BidangNama: pptkNama,
    BidangNIP: pptkNip,
    PPTKJabatan: pptkJabatan,
    KtuNama: ktu.nama || "",
    KtuNIP: ktu.nip || "",
    ...tp
  };
}

export async function unduhSuratTugasDocx(it) {
  const baseUrl = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  const templatePath = `${baseUrl.replace(/\/$/, "")}/templates/spt_template.docx`;
  const tags = bangunTagsSPT(it);
  const blob = await renderDocxBlob(templatePath, tags);
  const cleanNo = (it.nomor_spt || it.nomor_register || "SPT").replace(/[\/\\?%*:|"<>]/g, "_");
  unduhBlob(blob, `Surat_Tugas_${cleanNo}.docx`);
  return true;
}

export async function unduhSppdDocx(it, person = null) {
  const baseUrl = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  const templatePath = `${baseUrl.replace(/\/$/, "")}/templates/sppd_template.docx`;
  const tags = bangunTagsSPPD(it, person);
  const blob = await renderDocxBlob(templatePath, tags);
  const targetNama = (person?.nama || it.pelaksana_nama || "Pelaksana").replace(/[\/\\?%*:|"<>]/g, "_");
  const cleanNo = (it.nomor_sppd || it.nomor_register || "SPPD").replace(/[\/\\?%*:|"<>]/g, "_");
  unduhBlob(blob, `SPPD_${cleanNo}_${targetNama}.docx`);
  return true;
}

export async function unduhBundleSppdZip(it) {
  const baseUrl = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  const sptTemplatePath = `${baseUrl.replace(/\/$/, "")}/templates/spt_template.docx`;
  const sppdTemplatePath = `${baseUrl.replace(/\/$/, "")}/templates/sppd_template.docx`;

  const [sptRes, sppdRes] = await Promise.all([
    fetch(sptTemplatePath),
    fetch(sppdTemplatePath)
  ]);
  if (!sptRes.ok || !sppdRes.ok) {
    throw new Error("Gagal memuat template SPT atau SPPD");
  }

  const [sptBuf, sppdBuf] = await Promise.all([
    sptRes.arrayBuffer(),
    sppdRes.arrayBuffer()
  ]);

  const zipOut = new PizZip();

  // 1. Render SPT
  const sptZip = new PizZip(sptBuf);
  const sptDoc = new Docxtemplater(sptZip, {
    delimiters: { start: "{", end: "}" },
    paragraphLoop: true,
    linebreaks: true,
  });
  sptDoc.render(bangunTagsSPT(it));
  const cleanNo = (it.nomor_spt || it.nomor_register || "SPT").replace(/[\/\\?%*:|"<>]/g, "_");
  const sptContent = sptDoc.getZip().generate({ type: "uint8array" });
  zipOut.file(`SPT_${cleanNo}.docx`, sptContent);

  // 2. Render SPPD untuk pelaksana utama
  const renderSppdFile = (person, idx) => {
    const sppdZip = new PizZip(sppdBuf);
    const sppdDoc = new Docxtemplater(sppdZip, {
      delimiters: { start: "{", end: "}" },
      paragraphLoop: true,
      linebreaks: true,
    });
    sppdDoc.render(bangunTagsSPPD(it, person));
    const targetNama = (person?.nama || it.pelaksana_nama || `Pelaksana_${idx}`).replace(/[\/\\?%*:|"<>]/g, "_");
    const sppdContent = sppdDoc.getZip().generate({ type: "uint8array" });
    zipOut.file(`SPPD_${cleanNo}_${idx}_${targetNama}.docx`, sppdContent);
  };

  const wewenang = parseJson(it.wewenang, {}) || {};
  const p1Pptk = wewenang.pelaksana_pptk || {};

  renderSppdFile({
    nama: it.pelaksana_nama,
    nip: it.pelaksana_nip,
    pangkat: it.pelaksana_pangkat,
    jabatan: it.pelaksana_jabatan,
    pptk_nama: it.pelaksana_pptk_nama || p1Pptk.nama,
    pptk_nip: it.pelaksana_pptk_nip || p1Pptk.nip,
    pptk_jabatan: it.pelaksana_pptk_jabatan || p1Pptk.jabatan,
    tempat_berangkat: it.pelaksana_tempat_berangkat || p1Pptk.tempat_berangkat,
    tempat_tujuan: it.pelaksana_tempat_tujuan || p1Pptk.tempat_tujuan,
    tanggal_berangkat: it.pelaksana_tanggal_berangkat || p1Pptk.tanggal_berangkat
  }, 1);

  // 3. Render SPPD untuk pengikut jika ada
  let pengikutList = [];
  try {
    pengikutList = Array.isArray(it.pengikut) ? it.pengikut : JSON.parse(it.pengikut || "[]");
  } catch (_) {
    pengikutList = [];
  }

  pengikutList.forEach((p, idx) => {
    renderSppdFile(p, idx + 2);
  });

  const blob = zipOut.generate({
    type: "blob",
    mimeType: "application/zip",
    compression: "DEFLATE"
  });

  unduhBlob(blob, `PAKET_SPPD_${cleanNo}.zip`);
  return true;
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. GENERATOR FORMAT RESMI PDF & CETAK STANDAR A4 DINAS (BAPPERIDA / SEKDA)
// ═════════════════════════════════════════════════════════════════════════════

function renderKopHtml(t, compact = false) {
  const logoSrc = getLogoUrl();
  const isSekda = t.KopJenis === "SEKDA";
  const titleFontSize = isSekda ? (compact ? "15pt" : "16pt") : (compact ? "12pt" : "13pt");

  return `
    <table style="width: 100%; border-bottom: 3px double #000; padding-bottom: 6px; margin-bottom: ${compact ? "10px" : "14px"}; border-collapse: collapse;">
      <tr>
        <td style="width: 82px; vertical-align: middle; text-align: center; padding-right: 6px;">
          <img
            src="${logoSrc}"
            alt="Lambang Kabupaten Sumba Barat"
            crossorigin="anonymous"
            style="width: ${compact ? "68px" : "74px"}; height: auto; display: inline-block; object-fit: contain;"
          />
        </td>
        <td style="text-align: center; vertical-align: middle; font-family: Arial, Helvetica, sans-serif; padding-right: 30px;">
          <div style="font-size: ${compact ? "12pt" : "13pt"}; font-weight: bold; letter-spacing: 0.3px; line-height: 1.2;">
            ${t.KopPemkab}
          </div>
          <div style="font-size: ${titleFontSize}; font-weight: bold; margin: 2px 0; line-height: 1.2; letter-spacing: ${isSekda ? "1.5px" : "0.2px"};">
            ${t.KopInstansiHtml}
          </div>
          <div style="font-size: ${compact ? "8.5pt" : "9pt"}; margin-top: 2px; line-height: 1.3;">
            ${t.KopAlamat}<br/>
            ${t.KopKontak}
          </div>
          <div style="font-size: ${compact ? "9.5pt" : "10pt"}; font-weight: bold; letter-spacing: 2.5px; margin-top: 2px;">
            ${t.KopKota}
          </div>
        </td>
      </tr>
    </table>
  `;
}

export function bangunHtmlSPT(it) {
  const t = bangunTagsSPT(it);
  return `
    <div style="font-family: Arial, 'Times New Roman', sans-serif; color: #000; background: #fff; padding: 6px 10px; max-width: 780px; margin: 0 auto; line-height: 1.4; box-sizing: border-box;">
      <!-- Kop Surat Resmi (Dengan Logo Lambang Kabupaten Sumba Barat) -->
      ${renderKopHtml(t, false)}

      <!-- Judul SPT -->
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 12.5pt; font-weight: bold; text-decoration: underline; letter-spacing: 0.8px;">SURAT PERINTAH TUGAS</div>
        <div style="font-size: 10.5pt; margin-top: 2px; font-weight: bold;">Nomor : ${t.Nomor}</div>
      </div>

      <!-- Dasar -->
      <table style="width: 100%; font-size: 10.5pt; margin-bottom: 12px; border-collapse: collapse;">
        <tr>
          <td style="width: 85px; vertical-align: top; font-weight: bold; padding: 2px 0;">Dasar</td>
          <td style="width: 16px; vertical-align: top; text-align: center; padding: 2px 0;">:</td>
          <td style="vertical-align: top; line-height: 1.45; padding: 2px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              ${(t.dasarRows || []).map((d) => `
                <tr>
                  <td style="width: 22px; vertical-align: top; padding: 1px 0;">${d.No}.</td>
                  <td style="vertical-align: top; padding: 1px 0; text-align: justify;">${d.Teks}</td>
                </tr>
              `).join("") || `<tr><td style="width:22px;vertical-align:top;">1.</td><td>${t.Dasar}</td></tr>`}
            </table>
          </td>
        </tr>
      </table>

      <!-- Memerintahkan -->
      <div style="text-align: center; font-size: 11pt; font-weight: bold; letter-spacing: 0.8px; margin: 12px 0 10px;">
        MEMERINTAHKAN :
      </div>

      <!-- Kepada -->
      <table style="width: 100%; font-size: 10.5pt; margin-bottom: 14px; border-collapse: collapse;">
        <tr>
          <td style="width: 85px; vertical-align: top; font-weight: bold; padding: 2px 0;">Kepada</td>
          <td style="width: 16px; vertical-align: top; text-align: center; padding: 2px 0;">:</td>
          <td style="vertical-align: top; padding: 2px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              ${t.pelaksana.map((p) => `
                <tr>
                  <td style="width: 22px; vertical-align: top; padding: 1px 0;">${t.pelaksana.length > 1 ? p.No + "." : "1."}</td>
                  <td style="width: 115px; vertical-align: top; padding: 1px 0;">Nama</td>
                  <td style="width: 14px; vertical-align: top; padding: 1px 0; text-align: center;">:</td>
                  <td style="vertical-align: top; padding: 1px 0; font-weight: bold;">${p.Nama}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top; padding: 1px 0;">Pangkat / Gol</td>
                  <td style="vertical-align: top; padding: 1px 0; text-align: center;">:</td>
                  <td style="vertical-align: top; padding: 1px 0;">${p.PangkatGol || "-"}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top; padding: 1px 0;">NIP</td>
                  <td style="vertical-align: top; padding: 1px 0; text-align: center;">:</td>
                  <td style="vertical-align: top; padding: 1px 0;">${p.NIP || "-"}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top; padding: 1px 0;">Jabatan</td>
                  <td style="vertical-align: top; padding: 1px 0; text-align: center;">:</td>
                  <td style="vertical-align: top; padding: 1px 0;">${p.Jabatan || "-"}</td>
                </tr>
                <tr><td colspan="4" style="height: 6px;"></td></tr>
              `).join("")}
            </table>
          </td>
        </tr>
      </table>

      <!-- Untuk -->
      <table style="width: 100%; font-size: 10.5pt; margin-bottom: 20px; border-collapse: collapse;">
        <tr>
          <td style="width: 85px; vertical-align: top; font-weight: bold; padding: 2px 0;">Untuk</td>
          <td style="width: 16px; vertical-align: top; text-align: center; padding: 2px 0;">:</td>
          <td style="vertical-align: top; line-height: 1.45; padding: 2px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 22px; vertical-align: top;">1.</td>
                <td style="vertical-align: top; text-align: justify;">${t.Untuk}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Tanda Tangan & Paraf Hierarki -->
      <table style="width: 100%; font-size: 10pt; margin-top: 18px; border-collapse: collapse;">
        <tr>
          <!-- Kolom Paraf -->
          <td style="width: 46%; vertical-align: bottom; padding-right: 12px;">
            <table style="border: 1px solid #000; border-collapse: collapse; font-size: 8.5pt; width: 230px;">
              <tr>
                <th style="border: 1px solid #000; padding: 3px 5px; text-align: center; width: 26px;">NO</th>
                <th style="border: 1px solid #000; padding: 3px 6px; text-align: center;" colspan="2">Paraf Hirarki</th>
              </tr>
              <tr>
                <td style="border: 1px solid #000; text-align: center; padding: 3px;">1.</td>
                <td style="border: 1px solid #000; padding: 3px 6px;">${t.Paraf1}</td>
                <td style="border: 1px solid #000; width: 42px; padding: 3px;"></td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; text-align: center; padding: 3px;">2.</td>
                <td style="border: 1px solid #000; padding: 3px 6px;">${t.Paraf2}</td>
                <td style="border: 1px solid #000; padding: 3px;"></td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; text-align: center; padding: 3px;">3.</td>
                <td style="border: 1px solid #000; padding: 3px 6px;">${t.Paraf3}</td>
                <td style="border: 1px solid #000; padding: 3px;"></td>
              </tr>
            </table>
          </td>

          <!-- Kolom TTD Pejabat -->
          <td style="width: 54%; vertical-align: top; text-align: left; padding-left: 16px;">
            <table style="border-collapse: collapse; font-size: 10pt; margin-bottom: 6px;">
              <tr>
                <td style="width: 95px; padding: 1px 0;">Ditetapkan di</td>
                <td style="width: 12px; text-align: center;">:</td>
                <td style="padding: 1px 0;">${t.DitetapkanDi}</td>
              </tr>
              <tr>
                <td style="padding: 1px 0;">Pada Tanggal</td>
                <td style="text-align: center;">:</td>
                <td style="padding: 1px 0;">${t.TanggalSurat}</td>
              </tr>
            </table>
            <div style="text-align: center; font-weight: bold; margin-top: 6px; line-height: 1.3;">
              ${t.JabatanTtd}<br/>
              KABUPATEN SUMBA BARAT,
            </div>
            <div style="height: 56px;"></div>
            <div style="text-align: center;">
              <div style="font-weight: bold; text-decoration: underline;">${t.KepalaNama}</div>
              <div>${t.KepalaPangkat}</div>
              <div>NIP. ${t.KepalaNIP}</div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function bangunHtmlSPPD(it, person = null) {
  const t = bangunTagsSPPD(it, person);

  return `
    <div style="font-family: Arial, 'Times New Roman', sans-serif; color: #000; background: #fff; padding: 4px 8px; max-width: 780px; margin: 0 auto; line-height: 1.35; box-sizing: border-box;">
      <!-- ══ LEMBAR I: RINCIAN SPPD ══ -->
      <div class="sppd-page-1" style="padding-bottom: 18px;">
        <!-- Kop Surat Resmi (Dengan Logo Lambang Kabupaten Sumba Barat) -->
        ${renderKopHtml(t, true)}

        <!-- Nomor & Lembar ke -->
        <table style="width: 100%; font-size: 9.5pt; margin-bottom: 6px; border-collapse: collapse;">
          <tr>
            <td style="width: 55%;"></td>
            <td style="width: 45%;">
              <table style="width: 100%; font-size: 9.5pt; border-collapse: collapse;">
                <tr><td style="width: 78px; padding: 1px 0;">Lembar ke</td><td style="width: 10px;">:</td><td></td></tr>
                <tr><td style="padding: 1px 0;">Kode No</td><td>:</td><td></td></tr>
                <tr><td style="padding: 1px 0;">Nomor</td><td>:</td><td><b>${t.NomorSPPD}</b></td></tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Judul -->
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="font-size: 11.5pt; font-weight: bold; text-decoration: underline; letter-spacing: 0.5px;">SURAT PERJALANAN DINAS (SPD)</div>
        </div>

        <!-- Tabel Isian 10 Poin -->
        <table style="width: 100%; border: 1px solid #000; border-collapse: collapse; font-size: 9.5pt;">
          <tr>
            <td style="border: 1px solid #000; width: 28px; text-align: center; vertical-align: top; padding: 4px 5px;">1.</td>
            <td style="border: 1px solid #000; width: 42%; vertical-align: top; padding: 4px 6px;">Pengguna Anggaran / Kuasa Pengguna Anggaran</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px; font-weight: bold;">${t.KpaNama}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 4px 5px;">2.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">Nama / NIP Pegawai yang melaksanakan perjalanan Dinas</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              <b>${t.Nama}</b><br/>
              NIP. ${t.NIP}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 4px 5px;">3.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              a. Pangkat dan Golongan<br/>
              b. Jabatan / Instansi<br/>
              c. Tingkat Biaya Perjalanan Dinas
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              a. ${t.PangkatGolongan}<br/>
              b. ${t.JabatanInstansi}<br/>
              c. ${t.TingkatBiaya}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 4px 5px;">4.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">Maksud perjalanan dinas</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px; text-align: justify;">${t.Maksud}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 4px 5px;">5.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">Alat angkut yang digunakan</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">${t.AlatAngkut}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 4px 5px;">6.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              a. Tempat berangkat<br/>
              b. Tempat tujuan
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              a. ${t.TempatBerangkat}<br/>
              b. ${t.TempatTujuan}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 4px 5px;">7.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              a. Lamanya perjalanan dinas<br/>
              b. Tanggal berangkat<br/>
              c. Tanggal harus kembali
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              a. ${t.LamaHari}<br/>
              b. ${t.TanggalBerangkat}<br/>
              c. ${t.TanggalKembali}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 4px 5px;">8.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              Pengikut : Nama<br/>
              <span style="padding-left: 10px;">1.</span><br/>
              <span style="padding-left: 10px;">2.</span>
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                <tr>
                  <td style="width: 50%; border-bottom: 1px solid #000; padding-bottom: 2px;">Tanggal Lahir</td>
                  <td style="width: 50%; border-bottom: 1px solid #000; padding-bottom: 2px; padding-left: 6px; border-left: 1px solid #000;">Keterangan</td>
                </tr>
                <tr>
                  <td style="height: 28px;"></td>
                  <td style="border-left: 1px solid #000;"></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 4px 5px;">9.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              Pembebanan anggaran<br/>
              a. Instansi<br/>
              b. Mata anggaran
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">
              <br/>
              a. ${t.Instansi}<br/>
              b. ${t.MataAnggaran}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 4px 5px;">10.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">Keterangan lain-lain</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 4px 6px;">-</td>
          </tr>
        </table>

        <!-- Tanda Tangan & Paraf Lembar I -->
        <table style="width: 100%; font-size: 9.5pt; margin-top: 12px; border-collapse: collapse;">
          <tr>
            <td style="width: 46%; vertical-align: bottom; padding-right: 10px;">
              <table style="border: 1px solid #000; border-collapse: collapse; font-size: 8pt; width: 220px;">
                <tr>
                  <th style="border: 1px solid #000; padding: 2px 4px; text-align: center; width: 24px;">NO</th>
                  <th style="border: 1px solid #000; padding: 2px 5px; text-align: center;" colspan="2">Paraf Hirarki</th>
                </tr>
                <tr>
                  <td style="border: 1px solid #000; text-align: center; padding: 2px;">1.</td>
                  <td style="border: 1px solid #000; padding: 2px 5px;">${t.Paraf1}</td>
                  <td style="border: 1px solid #000; width: 38px;"></td>
                </tr>
                <tr>
                  <td style="border: 1px solid #000; text-align: center; padding: 2px;">2.</td>
                  <td style="border: 1px solid #000; padding: 2px 5px;">${t.Paraf2}</td>
                  <td style="border: 1px solid #000;"></td>
                </tr>
                <tr>
                  <td style="border: 1px solid #000; text-align: center; padding: 2px;">3.</td>
                  <td style="border: 1px solid #000; padding: 2px 5px;">${t.Paraf3}</td>
                  <td style="border: 1px solid #000;"></td>
                </tr>
              </table>
            </td>
            <td style="width: 54%; vertical-align: top; padding-left: 16px;">
              <table style="border-collapse: collapse; font-size: 9.5pt; margin-bottom: 4px;">
                <tr>
                  <td style="width: 90px;">Ditetapkan di</td>
                  <td style="width: 10px; text-align: center;">:</td>
                  <td>${t.DitetapkanDi}</td>
                </tr>
                <tr>
                  <td>Pada Tanggal</td>
                  <td style="text-align: center;">:</td>
                  <td>${t.TanggalPenetapan}</td>
                </tr>
              </table>
              <div style="text-align: center; font-weight: bold; margin-top: 4px; line-height: 1.25;">
                ${t.JabatanTtd}<br/>KABUPATEN SUMBA BARAT,
              </div>
              <div style="height: 46px;"></div>
              <div style="text-align: center;">
                <div style="font-weight: bold; text-decoration: underline;">${t.KepalaNama}</div>
                <div>${t.KepalaPangkat}</div>
                <div>NIP. ${t.KepalaNIP}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Pemisah Visual Halaman pada Pratinjau Layar -->
      <div class="screen-page-divider" style="border-top: 2px dashed #cbd5e1; margin: 16px 0 18px; position: relative; text-align: center;">
        <span style="background: #f1f5f9; color: #475569; font-family: sans-serif; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 99px; position: relative; top: -9px; letter-spacing: 0.5px;">
          LEMBAR II — VISUM &amp; PENGESAHAN PERJALANAN DINAS
        </span>
      </div>

      <!-- ══ LEMBAR II: VISUM & PENGESAHAN (ROMAWI I s/d VI) ══ -->
      <div style="page-break-before: always; break-before: page;" class="sppd-page-2">
        <table style="width: 100%; border: 1px solid #000; border-collapse: collapse; font-size: 9pt; table-layout: fixed;">
          <!-- Baris Romawi I -->
          <tr>
            <td style="border: 1px solid #000; width: 48%; vertical-align: top; padding: 6px 8px;">
              &nbsp;
            </td>
            <td style="border: 1px solid #000; width: 52%; vertical-align: top; padding: 6px 8px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                <tr>
                  <td style="width: 18px; vertical-align: top; font-weight: bold;">I.</td>
                  <td style="width: 105px; vertical-align: top;">Berangkat dari<br/><span style="font-size: 8pt;">(Tempat Kedudukan)</span></td>
                  <td style="width: 10px; vertical-align: top;">:</td>
                  <td style="vertical-align: top; font-weight: bold;">${t.TempatBerangkatRomawiI}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top;">Ke</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="vertical-align: top; font-weight: bold;">${t.TempatTujuanBerangkat}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top;">Pada Tanggal</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="vertical-align: top;">${t.TanggalBerangkatRomawiI}</td>
                </tr>
              </table>
              <div style="text-align: center; margin-top: 6px;">
                <div style="font-weight: bold; line-height: 1.25;">${(t.PPTKJabatan || "KEPALA BIDANG PPE").toUpperCase()},</div>
                <div style="height: 40px;"></div>
                <div style="font-weight: bold; text-decoration: underline;">${t.BidangNama}</div>
                <div>NIP. ${t.BidangNIP}</div>
              </div>
            </td>
          </tr>

          <!-- Baris Romawi II -->
          <tr>
            <td style="border: 1px solid #000; vertical-align: top; padding: 6px 8px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                <tr>
                  <td style="width: 22px; vertical-align: top; font-weight: bold;">II.</td>
                  <td style="width: 75px; vertical-align: top;">Tiba di</td>
                  <td style="width: 10px; vertical-align: top;">:</td>
                  <td style="vertical-align: top;">${t.TempatTujuan}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top;">Pada Tanggal</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="vertical-align: top;">${t.TanggalBerangkat}</td>
                </tr>
                <tr>
                  <td></td>
                  <td colspan="3" style="padding-top: 2px;">Kepala / Pejabat :</td>
                </tr>
              </table>
              <div style="height: 42px;"></div>
              <div style="text-align: center;">
                ( ............................................................ )<br/>
                <span style="display: inline-block; width: 85%; text-align: left;">NIP.</span>
              </div>
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 6px 8px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                <tr>
                  <td style="width: 90px; vertical-align: top;">Berangkat dari</td>
                  <td style="width: 10px; vertical-align: top;">:</td>
                  <td style="vertical-align: top;">${t.TempatTujuan}</td>
                </tr>
                <tr>
                  <td style="vertical-align: top;">Ke</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="vertical-align: top;">${t.TempatBerangkat}</td>
                </tr>
                <tr>
                  <td style="vertical-align: top;">Pada Tanggal</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="vertical-align: top;">${t.TanggalKembali}</td>
                </tr>
                <tr>
                  <td colspan="3" style="padding-top: 2px;">Kepala / Pejabat :</td>
                </tr>
              </table>
              <div style="height: 32px;"></div>
              <div style="text-align: center;">
                ( ............................................................ )<br/>
                <span style="display: inline-block; width: 85%; text-align: left;">NIP.</span>
              </div>
            </td>
          </tr>

          <!-- Baris Romawi III -->
          <tr>
            <td style="border: 1px solid #000; vertical-align: top; padding: 6px 8px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                <tr>
                  <td style="width: 22px; vertical-align: top; font-weight: bold;">III.</td>
                  <td style="width: 75px; vertical-align: top;">Tiba di</td>
                  <td style="width: 10px; vertical-align: top;">:</td>
                  <td style="vertical-align: top;"></td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top;">Pada Tanggal</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="vertical-align: top;"></td>
                </tr>
                <tr>
                  <td></td>
                  <td colspan="3" style="padding-top: 2px;">Kepala / Pejabat :</td>
                </tr>
              </table>
              <div style="height: 38px;"></div>
              <div style="text-align: center;">
                ( ............................................................ )<br/>
                <span style="display: inline-block; width: 85%; text-align: left;">NIP.</span>
              </div>
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 6px 8px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                <tr>
                  <td style="width: 90px; vertical-align: top;">Berangkat dari</td>
                  <td style="width: 10px; vertical-align: top;">:</td>
                  <td style="vertical-align: top;"></td>
                </tr>
                <tr>
                  <td style="vertical-align: top;">Ke</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="vertical-align: top;"></td>
                </tr>
                <tr>
                  <td style="vertical-align: top;">Pada Tanggal</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="vertical-align: top;"></td>
                </tr>
                <tr>
                  <td colspan="3" style="padding-top: 2px;">Kepala / Pejabat :</td>
                </tr>
              </table>
              <div style="height: 28px;"></div>
              <div style="text-align: center;">
                ( ............................................................ )<br/>
                <span style="display: inline-block; width: 85%; text-align: left;">NIP.</span>
              </div>
            </td>
          </tr>

          <!-- Baris Romawi IV -->
          <tr>
            <td style="border: 1px solid #000; vertical-align: top; padding: 6px 8px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
                <tr>
                  <td style="width: 22px; vertical-align: top; font-weight: bold;">IV.</td>
                  <td style="width: 95px; vertical-align: top;">Tiba kembali di</td>
                  <td style="width: 10px; vertical-align: top;">:</td>
                  <td style="vertical-align: top;">${t.TempatBerangkat}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top;">Pada Tanggal</td>
                  <td style="vertical-align: top;">:</td>
                  <td style="vertical-align: top;">${t.TanggalKembali}</td>
                </tr>
              </table>
              <div style="text-align: center; margin-top: 8px;">
                <div style="font-weight: bold; line-height: 1.25;">
                  ${t.JabatanTtd}<br/>KABUPATEN SUMBA BARAT,
                </div>
                <div style="height: 42px;"></div>
                <div style="font-weight: bold; text-decoration: underline;">${t.KepalaNama}</div>
                <div>${t.KepalaPangkat}</div>
                <div>NIP. ${t.KepalaNIP}</div>
              </div>
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 6px 8px;">
              <div style="text-align: justify; line-height: 1.3; font-size: 8.5pt;">
                Telah diperiksa, dengan keterangan bahwa perjalanan tersebut diatas benar dilakukan atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.
              </div>
              <div style="text-align: center; margin-top: 6px;">
                <div style="font-weight: bold; line-height: 1.25;">
                  ${t.SekretarisJabatan}<br/>KABUPATEN SUMBA BARAT
                </div>
                <div style="height: 40px;"></div>
                <div style="font-weight: bold; text-decoration: underline;">${t.SekretarisNama}</div>
                <div>NIP. ${t.SekretarisNIP}</div>
              </div>
            </td>
          </tr>

          <!-- Baris Romawi V & VI -->
          <tr>
            <td colspan="2" style="border: 1px solid #000; padding: 6px 8px; font-size: 8.5pt; line-height: 1.35;">
              <b>V. Catatan Lain-lain:</b>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border: 1px solid #000; padding: 6px 8px; font-size: 8.5pt; line-height: 1.35; text-align: justify;">
              <b>VI. PERHATIAN:</b> Pengguna Anggaran / Kuasa Pengguna Anggaran yang menerbitkan SPD, pejabat/pegawai/pihak lain yang melakukan perjalanan dinas, para pejabat yang mengesahkan tanggal berangkat/tiba serta bendahara pengeluaran bertanggung jawab berdasarkan peraturan-peraturan Keuangan Daerah apabila Negara menderita rugi akibat kesalahan, kelalaian dan kealpaannya.
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. FUNGSI EKSPOR PDF LANGSUNG (html2pdf.js) & PRATINJAU CETAK (Print Window)
// ═════════════════════════════════════════════════════════════════════════════

export async function unduhSuratTugasPdf(it) {
  const html = bangunHtmlSPT(it);
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "780px";
  document.body.appendChild(container);

  const cleanNo = (it.nomor_spt || it.nomor_register || "SPT").replace(/[\/\\?%*:|"<>]/g, "_");
  const opt = {
    margin: [10, 12, 10, 12],
    filename: `Surat_Tugas_${cleanNo}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  try {
    const html2pdf = await getHtml2Pdf();
    await html2pdf().set(opt).from(container).save();
    return true;
  } catch (err) {
    console.error("[sppdDocxGenerator] Gagal unduh PDF SPT:", err);
    throw err;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export async function unduhSppdPdf(it, person = null) {
  const html = bangunHtmlSPPD(it, person);
  const container = document.createElement("div");
  container.innerHTML = html;
  const divider = container.querySelector(".screen-page-divider");
  if (divider) divider.remove();
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "780px";
  document.body.appendChild(container);

  const targetNama = (person?.nama || it.pelaksana_nama || "Pelaksana").replace(/[\/\\?%*:|"<>]/g, "_");
  const cleanNo = (it.nomor_sppd || it.nomor_register || "SPPD").replace(/[\/\\?%*:|"<>]/g, "_");
  const opt = {
    margin: [8, 12, 8, 12],
    pagebreak: { mode: ["css"], avoid: "tr" },
    filename: `SPPD_${cleanNo}_${targetNama}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  try {
    const html2pdf = await getHtml2Pdf();
    await html2pdf().set(opt).from(container).save();
    return true;
  } catch (err) {
    console.error("[sppdDocxGenerator] Gagal unduh PDF SPPD:", err);
    throw err;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

export function cetakSuratTugasWindow(it) {
  const html = bangunHtmlSPT(it);
  cetakDokumenHtml(html, `Surat Tugas - ${it.nomor_spt || it.nomor_register}`);
}

export function cetakSppdWindow(it, person = null) {
  const html = bangunHtmlSPPD(it, person);
  const nama = person?.nama || it.pelaksana_nama || "Pelaksana";
  cetakDokumenHtml(html, `SPPD - ${nama} (${it.nomor_sppd || it.nomor_register})`);
}

function cetakDokumenHtml(innerHtml, title = "Dokumen Dinas") {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup diblokir oleh browser. Mohon izinkan popup untuk mencetak naskah dinas.");
    return;
  }

  w.document.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            background: #f8fafc;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #0f172a;
            color: #f8fafc;
            padding: 10px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
          }
          .btn-print {
            background: #2563eb;
            color: #fff;
            border: none;
            padding: 7px 16px;
            border-radius: 6px;
            font-weight: 700;
            cursor: pointer;
            font-size: 13px;
          }
          .btn-close {
            background: #334155;
            color: #cbd5e1;
            border: none;
            padding: 7px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            margin-left: 8px;
          }
          .doc-canvas {
            background: #fff;
            max-width: 780px;
            margin: 64px auto 30px;
            padding: 24px 30px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.06);
            border: 1px solid #e2e8f0;
          }
          @media print {
            .print-toolbar, .screen-page-divider {
              display: none !important;
            }
            body {
              background: #fff;
            }
            .doc-canvas {
              margin: 0;
              padding: 0;
              border: none;
              box-shadow: none;
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <div style="font-weight: 700;">
            ${title}
          </div>
          <div>
            <button class="btn-print" onclick="window.print()">
              Cetak / Simpan sebagai PDF
            </button>
            <button class="btn-close" onclick="window.close()">
              Tutup
            </button>
          </div>
        </div>
        <div class="doc-canvas">
          ${innerHtml}
        </div>
      </body>
    </html>
  `);
  w.document.close();
}
