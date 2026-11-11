import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import html2pdf from "html2pdf.js";

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

// ═════════════════════════════════════════════════════════════════════════════
// 2. GENERATOR FORMAT RESMI PDF & CETAK STANDAR A4 DINAS BAPPERIDA
// ═════════════════════════════════════════════════════════════════════════════

export function bangunHtmlSPT(it) {
  const t = bangunTagsSPT(it);
  return `
    <div style="font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; padding: 10px 15px; max-width: 760px; margin: 0 auto; line-height: 1.4;">
      <!-- Kop Surat Resmi BAPPERIDA -->
      <table style="width: 100%; border-bottom: 3px double #000; padding-bottom: 6px; margin-bottom: 16px;">
        <tr>
          <td style="text-align: center; vertical-align: middle;">
            <div style="font-size: 14pt; font-weight: bold; letter-spacing: 0.5px;">PEMERINTAH KABUPATEN SUMBA BARAT</div>
            <div style="font-size: 12.5pt; font-weight: bold; margin: 2px 0;">BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH</div>
            <div style="font-size: 9pt; font-family: Arial, sans-serif; margin-top: 2px;">
              Jl. Wee Karou Nomor. – Waikabubak Provinsi Nusa Tenggara Timur<br/>
              Telp (0387) 22203 Fax (0387) 21093, Email : wesumba@yahoo.com
            </div>
            <div style="font-size: 10pt; font-weight: bold; letter-spacing: 2px; margin-top: 2px;">W A I K A B U B A K</div>
          </td>
        </tr>
      </table>

      <!-- Judul SPT -->
      <div style="text-align: center; margin-bottom: 18px;">
        <div style="font-size: 13pt; font-weight: bold; text-decoration: underline; letter-spacing: 1px;">SURAT PERINTAH TUGAS</div>
        <div style="font-size: 11pt; margin-top: 2px;">Nomor : ${t.Nomor}</div>
      </div>

      <!-- Dasar -->
      <table style="width: 100%; font-size: 11pt; margin-bottom: 12px; border-collapse: collapse;">
        <tr>
          <td style="width: 90px; vertical-align: top; font-weight: bold;">Dasar</td>
          <td style="width: 15px; vertical-align: top; text-align: center;">:</td>
          <td style="vertical-align: top; line-height: 1.45;">
            1. ${t.Dasar}
          </td>
        </tr>
      </table>

      <!-- Memerintahkan -->
      <div style="text-align: center; font-size: 11.5pt; font-weight: bold; letter-spacing: 1px; margin: 12px 0 8px;">
        MEMERINTAHKAN :
      </div>

      <!-- Kepada -->
      <table style="width: 100%; font-size: 11pt; margin-bottom: 16px; border-collapse: collapse;">
        <tr>
          <td style="width: 90px; vertical-align: top; font-weight: bold;">Kepada</td>
          <td style="width: 15px; vertical-align: top; text-align: center;">:</td>
          <td style="vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse;">
              ${t.pelaksana.map((p) => `
                <tr>
                  <td style="width: 22px; vertical-align: top; padding: 2px 0;">${t.pelaksana.length > 1 ? p.No + "." : ""}</td>
                  <td style="width: 120px; vertical-align: top; padding: 2px 0;">Nama</td>
                  <td style="width: 12px; vertical-align: top; padding: 2px 0; text-align: center;">:</td>
                  <td style="vertical-align: top; padding: 2px 0; font-weight: bold;">${p.Nama}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top; padding: 2px 0;">Pangkat / Gol</td>
                  <td style="vertical-align: top; padding: 2px 0; text-align: center;">:</td>
                  <td style="vertical-align: top; padding: 2px 0;">${p.PangkatGol || "-"}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top; padding: 2px 0;">NIP</td>
                  <td style="vertical-align: top; padding: 2px 0; text-align: center;">:</td>
                  <td style="vertical-align: top; padding: 2px 0;">${p.NIP || "-"}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="vertical-align: top; padding: 2px 0;">Jabatan</td>
                  <td style="vertical-align: top; padding: 2px 0; text-align: center;">:</td>
                  <td style="vertical-align: top; padding: 2px 0;">${p.Jabatan || "-"}</td>
                </tr>
                <tr><td colspan="4" style="height: 6px;"></td></tr>
              `).join("")}
            </table>
          </td>
        </tr>
      </table>

      <!-- Untuk -->
      <table style="width: 100%; font-size: 11pt; margin-bottom: 24px; border-collapse: collapse;">
        <tr>
          <td style="width: 90px; vertical-align: top; font-weight: bold;">Untuk</td>
          <td style="width: 15px; vertical-align: top; text-align: center;">:</td>
          <td style="vertical-align: top; line-height: 1.45;">
            1. ${t.Untuk}
          </td>
        </tr>
      </table>

      <!-- Tanda Tangan & Paraf Hierarki -->
      <table style="width: 100%; font-size: 10.5pt; margin-top: 24px; border-collapse: collapse;">
        <tr>
          <!-- Kolom Paraf -->
          <td style="width: 45%; vertical-align: bottom;">
            <table style="border: 1px solid #000; border-collapse: collapse; font-size: 9pt; width: 220px;">
              <tr>
                <th colspan="2" style="border: 1px solid #000; padding: 4px; text-align: center; background: #f2f2f2; font-weight: bold;">
                  Paraf Hierarki
                </th>
              </tr>
              <tr>
                <td style="border: 1px solid #000; width: 24px; text-align: center; padding: 3px;">1.</td>
                <td style="border: 1px solid #000; padding: 3px 6px;">${t.Paraf1}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; text-align: center; padding: 3px;">2.</td>
                <td style="border: 1px solid #000; padding: 3px 6px;">${t.Paraf2}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #000; text-align: center; padding: 3px;">3.</td>
                <td style="border: 1px solid #000; padding: 3px 6px;">${t.Paraf3}</td>
              </tr>
            </table>
          </td>

          <!-- Kolom TTD Kepala BAPPERIDA -->
          <td style="width: 55%; vertical-align: top; text-align: left; padding-left: 20px;">
            <div>Ditetapkan di : ${t.DitetapkanDi}</div>
            <div>Pada Tanggal : ${t.TanggalSurat}</div>
            <div style="font-weight: bold; margin-top: 6px; line-height: 1.3;">
              KEPALA BAPPERIDA<br/>
              KABUPATEN SUMBA BARAT,
            </div>
            <div style="height: 60px;"></div>
            <div style="font-weight: bold; text-decoration: underline;">${t.KepalaNama}</div>
            <div>${t.KepalaPangkat}</div>
            <div>NIP. ${t.KepalaNIP}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function bangunHtmlSPPD(it, person = null) {
  const t = bangunTagsSPPD(it, person);

  let pengikutRows = "";
  let listP = [];
  try {
    listP = Array.isArray(it.pengikut) ? it.pengikut : JSON.parse(it.pengikut || "[]");
  } catch (_) {
    listP = [];
  }

  if (listP.length > 0) {
    pengikutRows = listP.map((p, idx) => `
      <div>${idx + 1}. ${p.nama || "-"} (${p.jabatan || p.nip || "Staf"})</div>
    `).join("");
  } else {
    pengikutRows = "-";
  }

  return `
    <div style="font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; padding: 10px 15px; max-width: 760px; margin: 0 auto; line-height: 1.35;">
      <!-- ══ LEMBAR I: RINCIAN SPPD ══ -->
      <div class="sppd-page-1">
        <!-- Kop Surat Resmi -->
        <table style="width: 100%; border-bottom: 3px double #000; padding-bottom: 6px; margin-bottom: 10px;">
          <tr>
            <td style="text-align: center; vertical-align: middle;">
              <div style="font-size: 13pt; font-weight: bold; letter-spacing: 0.5px;">PEMERINTAH KABUPATEN SUMBA BARAT</div>
              <div style="font-size: 11.5pt; font-weight: bold; margin: 2px 0;">BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH</div>
              <div style="font-size: 8.5pt; font-family: Arial, sans-serif; margin-top: 2px;">
                Jl. Wee Karou Nomor. – Waikabubak Provinsi Nusa Tenggara Timur<br/>
                Telp (0387) 22203 Fax (0387) 21093, Email : wesumba@yahoo.com
              </div>
              <div style="font-size: 9.5pt; font-weight: bold; letter-spacing: 2px; margin-top: 2px;">W A I K A B U B A K</div>
            </td>
          </tr>
        </table>

        <!-- Nomor & Lembar ke -->
        <table style="width: 100%; font-size: 9.5pt; margin-bottom: 6px;">
          <tr>
            <td style="width: 60%;"></td>
            <td style="width: 40%;">
              <table style="width: 100%; font-size: 9pt;">
                <tr><td style="width: 70px;">Lembar ke</td><td>: </td></tr>
                <tr><td>Kode No</td><td>: </td></tr>
                <tr><td>Nomor</td><td>: <b>${t.NomorSPPD}</b></td></tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Judul -->
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="font-size: 12pt; font-weight: bold; text-decoration: underline;">SURAT PERJALANAN DINAS (SPD)</div>
        </div>

        <!-- Tabel Isian 10 Poin -->
        <table style="width: 100%; border: 1px solid #000; border-collapse: collapse; font-size: 9pt;">
          <tr>
            <td style="border: 1px solid #000; width: 28px; text-align: center; vertical-align: top; padding: 2px 5px;">1.</td>
            <td style="border: 1px solid #000; width: 230px; vertical-align: top; padding: 2px 5px;">Pengguna Anggaran / KPA</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px; font-weight: bold;">${t.KpaNama}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 2px 5px;">2.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">Nama / NIP Pegawai yang melaksanakan dinas</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">
              <b>${t.Nama}</b><br/>
              NIP. ${t.NIP}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 2px 5px;">3.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">
              a. Pangkat dan Golongan<br/>
              b. Jabatan / Instansi<br/>
              c. Tingkat Biaya Perjalanan Dinas
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">
              a. ${t.PangkatGolongan}<br/>
              b. ${t.JabatanInstansi}<br/>
              c. ${t.TingkatBiaya}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 2px 5px;">4.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">Maksud perjalanan dinas</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">${t.Maksud}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 2px 5px;">5.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">Alat angkut yang dipergunakan</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">${t.AlatAngkut}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 2px 5px;">6.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">
              a. Tempat berangkat<br/>
              b. Tempat tujuan
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">
              a. ${t.TempatBerangkat}<br/>
              b. ${t.TempatTujuan}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 2px 5px;">7.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">
              a. Lamanya perjalanan dinas<br/>
              b. Tanggal berangkat<br/>
              c. Tanggal harus kembali
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">
              a. ${t.LamaHari}<br/>
              b. ${t.TanggalBerangkat}<br/>
              c. ${t.TanggalKembali}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 2px 5px;">8.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">Pengikut : Nama</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">${pengikutRows}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 2px 5px;">9.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">
              Pembebanan Anggaran<br/>
              a. Instansi<br/>
              b. Mata Anggaran
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">
              <br/>
              a. ${t.Instansi}<br/>
              b. ${t.MataAnggaran}
            </td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; text-align: center; vertical-align: top; padding: 2px 5px;">10.</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">Keterangan lain-lain</td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 2px 5px;">-</td>
          </tr>
        </table>

        <!-- Tanda Tangan Lembar I -->
        <table style="width: 100%; font-size: 10pt; margin-top: 14px;">
          <tr>
            <td style="width: 50%;"></td>
            <td style="width: 50%; padding-left: 20px;">
              <div>Ditetapkan di : ${t.DitetapkanDi}</div>
              <div>Pada Tanggal : ${t.TanggalPenetapan}</div>
              <div style="font-weight: bold; margin-top: 4px; line-height: 1.3;">
                Kepala Bapperida Kabupaten Sumba Barat,
              </div>
              <div style="height: 44px;"></div>
              <div style="font-weight: bold; text-decoration: underline;">${t.KepalaNama}</div>
              <div>${t.KepalaPangkat}</div>
              <div>NIP: ${t.KepalaNIP}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- ══ LEMBAR II: VISUM & PENGESAHAN ══ -->
      <div style="page-break-before: always; break-before: page;" class="sppd-page-2">
        <div style="text-align: right; font-size: 9pt; margin-bottom: 6px;">
          Nomor SPD: <b>${t.NomorSPPD}</b>
        </div>
        <table style="width: 100%; border: 1px solid #000; border-collapse: collapse; font-size: 9pt;">
          <!-- Kolom Visum I -->
          <tr>
            <td style="border: 1px solid #000; width: 50%; vertical-align: top; padding: 5px 7px;">
              &nbsp;
            </td>
            <td style="border: 1px solid #000; width: 50%; vertical-align: top; padding: 5px 7px;">
              I. Berangkat dari : ${t.TempatBerangkat}<br/>
              Ke : ${t.TempatTujuan}<br/>
              Pada Tanggal : ${t.TanggalBerangkat}<br/>
              <div style="font-weight: bold; margin-top: 4px;">KEPALA BIDANG PERENCANAAN, PENGENDALIAN DAN EVALUASI,</div>
              <div style="height: 34px;"></div>
              <div style="font-weight: bold; text-decoration: underline;">${t.BidangNama}</div>
              <div>NIP. ${t.BidangNIP}</div>
            </td>
          </tr>
          <!-- Kolom Visum II -->
          <tr>
            <td style="border: 1px solid #000; vertical-align: top; padding: 5px 7px;">
              II. Tiba pada : ${t.TempatTujuan}<br/>
              Tanggal : ${t.TanggalBerangkat}<br/>
              Kepala / Pejabat :<br/>
              <div style="height: 34px;"></div>
              ( ............................................................ )<br/>
              NIP.
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 5px 7px;">
              Berangkat dari : ${t.TempatTujuan}<br/>
              Ke : ${t.TempatBerangkat}<br/>
              Tanggal : ${t.TanggalKembali}<br/>
              Kepala / Pejabat :<br/>
              <div style="height: 34px;"></div>
              ( ............................................................ )<br/>
              NIP.
            </td>
          </tr>
          <!-- Kolom Visum III -->
          <tr>
            <td style="border: 1px solid #000; vertical-align: top; padding: 5px 7px;">
              III. Tiba pada : ${t.TempatBerangkat}<br/>
              Tanggal : ${t.TanggalKembali}<br/>
              Pejabat Pelaksana Teknis Kegiatan / Kasubbag :<br/>
              <div style="height: 34px;"></div>
              ( ............................................................ )<br/>
              NIP.
            </td>
            <td style="border: 1px solid #000; vertical-align: top; padding: 5px 7px;">
              Telah diperiksa, dengan keterangan bahwa perjalanan tersebut diatas benar dilakukan atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.<br/>
              <div style="font-weight: bold; margin-top: 4px;">SEKRETARIS BAPPERIDA KABUPATEN SUMBA BARAT</div>
              <div style="height: 34px;"></div>
              <div style="font-weight: bold; text-decoration: underline;">${t.SekretarisNama}</div>
              <div>NIP. ${t.SekretarisNIP}</div>
            </td>
          </tr>
          <!-- Kolom Catatan -->
          <tr>
            <td colspan="2" style="border: 1px solid #000; padding: 8px; font-size: 8.5pt; line-height: 1.35;">
              <b>V. Catatan Lain-lain:</b><br/>
              <b>VI. PERHATIAN:</b> Pengguna Anggaran / Kuasa Pengguna Anggaran yang menerbitkan SPD, pejabat/pegawai yang melakukan perjalanan dinas, para pejabat yang mengesahkan tanggal berangkat/tiba serta bendaharawan bertanggung jawab berdasarkan peraturan-peraturan Keuangan Negara apabila Negara mendapat rugi akibat kesalahan, kealpaan atau kelalaiannya.
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
            .print-toolbar {
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
              🖨️ Cetak / Simpan sebagai PDF
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
