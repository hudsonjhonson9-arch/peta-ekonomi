import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../../App.jsx";
import { useIsDark, Icon, Modal, Select, CariPilih, Button, DatePicker } from "../ui.jsx";
import useResponsive from "../../useResponsive.js";
import {
  unduhSuratTugasDocx,
  unduhSppdDocx,
  unduhBundleSppdZip,
  unduhSuratTugasPdf,
  unduhSppdPdf,
  cetakSuratTugasWindow,
  cetakSppdWindow
} from "../../utils/sppdDocxGenerator.js";
import ModalPengaturanWewenang from "./ModalPengaturanWewenang.jsx";
import ModalPratinjauDokumen from "./ModalPratinjauDokumen.jsx";

const PEJABAT_PERINTAH_LIST = [
  "Kepala BAPPERIDA",
  "Sekretaris Daerah",
  "Sekretaris BAPPERIDA",
  "Plt. Kepala BAPPERIDA"
];

const ANGKUTAN_LIST = [
  "Kendaraan Dinas Roda 4",
  "Kendaraan Dinas Roda 2",
  "Angkutan Darat / Travel",
  "Pesawat Udara (Ekonomi)",
  "Kapal Laut / Feri"
];

const PROVINSI_LIST = [
  "Nusa Tenggara Timur",
  "DKI Jakarta",
  "Bali",
  "Jawa Timur",
  "Jawa Barat",
  "DI Yogyakarta",
  "Sulawesi Selatan",
  "Lainnya"
];

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyjrDE_5NnsTsKSyRvEwLLMJH3lWeGsg7jpM44btardExAFX1Vxvp246pazjQdH4UL5/exec";

function gasPostSppd(payload) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", GAS_URL);
    xhr.timeout = 300000;
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (json && json.error) reject(new Error(json.error));
        else resolve(json);
      } catch {
        reject(new Error("Balasan server Drive bukan JSON"));
      }
    };
    xhr.onerror = () => reject(new Error("Jaringan ke Google Drive gagal"));
    xhr.ontimeout = () => reject(new Error("Timeout saat mengunggah ke Google Drive"));
    xhr.send(JSON.stringify(payload));
  });
}

function fileToBase64(blob, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (onProgress) {
      reader.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 60));
      };
    }
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Gagal membaca berkas"));
    reader.readAsDataURL(blob);
  });
}

async function uploadFileToDriveFolder(file, { folderId, title, year, uploader, onProgress }) {
  const DIRECT_THRESHOLD = 30 * 1024 * 1024;
  const CHUNK_SIZE = 5 * 1024 * 1024;

  if (file.size <= DIRECT_THRESHOLD) {
    const b64 = await fileToBase64(file, onProgress);
    if (onProgress) onProgress(75);
    const res = await gasPostSppd({
      action: "direct",
      file: b64,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      title: title || file.name,
      type: "SPJ & LHP SPPD",
      sector: "Sekretariat",
      year: String(year || new Date().getFullYear()),
      uploader: uploader || "Staf BAPPERIDA",
      folderId: folderId || undefined,
      group: true
    });
    if (onProgress) onProgress(100);
    return res.fileUrl;
  }

  // Resumable mode for files > 30MB
  const initRes = await gasPostSppd({
    action: "initiate",
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    folderId: folderId || undefined
  });
  if (!initRes.uploadUrl) throw new Error(initRes.error || "Gagal memulai sesi upload Drive");

  let start = 0;
  let driveFileId = null;
  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunkB64 = await fileToBase64(file.slice(start, end));
    const chunkRes = await gasPostSppd({
      action: "chunk",
      uploadUrl: initRes.uploadUrl,
      chunkBase64: chunkB64,
      start,
      end,
      totalSize: file.size,
      filename: file.name,
      mimeType: file.type || "application/octet-stream"
    });
    if (chunkRes.status === 200 || chunkRes.status === 201) {
      driveFileId = chunkRes.fileId;
      break;
    }
    if (onProgress) onProgress(Math.round((end / file.size) * 85));
    start = end;
  }
  if (!driveFileId) throw new Error("Gagal mendapatkan ID berkas dari Google Drive");

  const finRes = await gasPostSppd({
    action: "finalize",
    fileId: driveFileId,
    title: title || file.name,
    type: "SPJ & LHP SPPD",
    sector: "Sekretariat",
    year: String(year || new Date().getFullYear()),
    uploader: uploader || "Staf BAPPERIDA",
    group: true
  });
  if (onProgress) onProgress(100);
  return finRes.fileUrl;
}

export default function AgendaSppdPage({ user, showToast }) {
  const { T } = useContext(ThemeContext);
  const isDark = useIsDark();
  const { isMobile } = useResponsive();

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const r = (user.role || "").toLowerCase();
    return r === "admin";
  }, [user]);

  const [jenis, setJenis] = useState("DALAM_DAERAH"); // "DALAM_DAERAH" | "LUAR_DAERAH"
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [items, setItems] = useState([]);
  const [allSppd, setAllSppd] = useState([]); // to compute global metrics
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modals
  const [modalSppd, setModalSppd] = useState(null); // { mode: 'tambah'|'edit', data, previewNomor }
  const [modalSpj, setModalSpj] = useState(null); // { sppd, form }
  const [modalDetail, setModalDetail] = useState(null); // { data }
  const [modalHapus, setModalHapus] = useState(null); // { data }
  const [modalCetak, setModalCetak] = useState(null); // { item }
  const [modalWewenang, setModalWewenang] = useState(false);
  const [modalPratinjau, setModalPratinjau] = useState(null); // { item }
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pegawaiList, setPegawaiList] = useState([]);
  const [wewenangConfig, setWewenangConfig] = useState(null);
  const [nomorCheck, setNomorCheck] = useState({ status: "idle", message: "", conflict: null });

  const opsiPegawaiNama = useMemo(() => {
    return (pegawaiList || []).map((p) => ({
      value: p.nama,
      label: p.nama,
      sub: p.nip ? `NIP. ${p.nip}` : "",
      hint: [p.jabatan, p.pangkat].filter(Boolean).join(" • "),
      raw: p
    }));
  }, [pegawaiList]);

  useEffect(() => {
    fetch("/api/agenda/pegawai-list")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setPegawaiList(j.items || []); })
      .catch(() => {});
    fetch("/api/agenda/wewenang")
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data) setWewenangConfig(j.data); })
      .catch(() => {});
  }, []);

  // Gabungkan pengaturan wewenang global ke item agar preview & unduh selalu sesuai pengaturan
  const enrichWithWewenang = (it) => {
    if (!it) return it;
    let parsedWewenang = {};
    try {
      parsedWewenang = typeof it.wewenang === "object" && it.wewenang ? it.wewenang : JSON.parse(it.wewenang || "{}");
    } catch (_) {
      parsedWewenang = {};
    }
    const mergedWewenang = {
      kop_surat: it.kop_surat || parsedWewenang.kop_surat || wewenangConfig?.kop_surat || "BAPPERIDA",
      sekretaris: parsedWewenang.sekretaris || wewenangConfig?.sekretaris || undefined,
      bidang: parsedWewenang.bidang || wewenangConfig?.bidang || undefined,
      ktu: parsedWewenang.ktu || wewenangConfig?.ktu || undefined,
      pelaksana_pptk: parsedWewenang.pelaksana_pptk || undefined
    };
    return {
      ...it,
      kop_surat: mergedWewenang.kop_surat,
      penandatangan: it.penandatangan || wewenangConfig?.kepala || null,
      paraf: it.paraf || wewenangConfig?.paraf || null,
      wewenang: mergedWewenang
    };
  };

  const bukaPratinjau = (it, defaultTab = "spt", defaultPersonIdx = 0) => {
    setModalPratinjau({ item: enrichWithWewenang(it), defaultTab, defaultPersonIdx });
  };


  const notif = (msg) => {
    if (showToast) showToast(msg);
    else alert(msg);
  };

  const unduhSPT = async (it) => {
    setIsGeneratingDocx(true);
    try {
      notif("Menyiapkan dokumen Surat Perintah Tugas (SPT .docx)...");
      await unduhSuratTugasDocx(enrichWithWewenang(it));
      notif("Surat Perintah Tugas (SPT) berhasil diunduh (.docx)!");
    } catch (err) {
      notif("Gagal membuat SPT: " + (err?.message || err));
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  const unduhSPPD = async (it, person = null) => {
    setIsGeneratingDocx(true);
    try {
      const enriched = enrichWithWewenang(it);
      const namaTarget = person?.nama || enriched.pelaksana_nama || "Pelaksana";
      notif(`Menyiapkan lembar SPPD untuk ${namaTarget} (.docx)...`);
      await unduhSppdDocx(enriched, person);
      notif(`SPPD untuk ${namaTarget} berhasil diunduh (.docx)!`);
    } catch (err) {
      notif("Gagal membuat SPPD: " + (err?.message || err));
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  const unduhSPTPdf = async (it) => {
    setIsGeneratingDocx(true);
    try {
      notif("Menyiapkan dokumen Surat Perintah Tugas (SPT .pdf)...");
      await unduhSuratTugasPdf(enrichWithWewenang(it));
      notif("Surat Perintah Tugas (SPT) berhasil diunduh (.pdf)!");
    } catch (err) {
      notif("Gagal membuat PDF SPT: " + (err?.message || err));
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  const unduhSPPDPdf = async (it, person = null) => {
    setIsGeneratingDocx(true);
    try {
      const enriched = enrichWithWewenang(it);
      const namaTarget = person?.nama || enriched.pelaksana_nama || "Pelaksana";
      notif(`Menyiapkan lembar SPPD untuk ${namaTarget} (.pdf)...`);
      await unduhSppdPdf(enriched, person);
      notif(`SPPD untuk ${namaTarget} berhasil diunduh (.pdf)!`);
    } catch (err) {
      notif("Gagal membuat PDF SPPD: " + (err?.message || err));
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  const cetakSPT = (it) => {
    cetakSuratTugasWindow(enrichWithWewenang(it));
  };

  const cetakSPPD = (it, person = null) => {
    cetakSppdWindow(enrichWithWewenang(it), person);
  };

  const unduhZipBundle = async (it) => {
    setIsGeneratingDocx(true);
    try {
      notif("Menyiapkan paket ZIP (SPT + semua SPPD)…");
      await unduhBundleSppdZip(enrichWithWewenang(it));
      notif("Paket ZIP berhasil diunduh!");
    } catch (err) {
      notif("Gagal membuat ZIP: " + (err?.message || err));
    } finally {
      setIsGeneratingDocx(false);
    }
  };


  useEffect(() => {
    fetchData();
    fetchAllMetrics();
  }, [jenis, tahun]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = search ? `&q=${encodeURIComponent(search)}` : "";
      if (statusFilter) q += `&status=${encodeURIComponent(statusFilter)}`;

      const res = await fetch(`/api/agenda/sppd?jenis=${jenis}&tahun=${tahun}${q}`);
      const data = await res.json();
      if (data.ok) setItems(data.items || []);
      else setError(data.message || "Gagal memuat register SPPD");
    } catch (e) {
      setError(e.message || "Kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMetrics = async () => {
    try {
      const res = await fetch(`/api/agenda/sppd?tahun=${tahun}&limit=100`);
      const data = await res.json();
      if (data.ok) setAllSppd(data.items || []);
    } catch (_) {}
  };

  // Metrics (Clean without Anggaran)
  const statDalam = allSppd.filter(x => x.jenis_sppd === "DALAM_DAERAH").length;
  const statLuar = allSppd.filter(x => x.jenis_sppd === "LUAR_DAERAH").length;
  const statSelesai = allSppd.filter(x => x.status === "Selesai" || x.status === "Laporan Masuk").length;

  // ── Pratinjau Nomor Register SPPD & Cek Ketersediaan Nomor Custom ──────────
  const fetchPreviewRegister = async (targetJenis) => {
    try {
      const res = await fetch(`/api/agenda/sppd/preview-nomor?tahun=${tahun}&jenis=${targetJenis || jenis}`);
      const data = await res.json();
      if (data.ok) return data.nomor_register;
    } catch (_) {}
    return targetJenis === "LUAR_DAERAH" ? `001/SPPD-LD/${tahun}` : `001/SPPD-DD/${tahun}`;
  };

  const cekKetersediaanNomor = async (nomorVal, excludeId = null) => {
    const trimmed = String(nomorVal || "").trim();
    if (!trimmed) {
      setNomorCheck({ status: "idle", message: "", conflict: null });
      return false;
    }
    setNomorCheck({ status: "checking", message: "Memeriksa ketersediaan nomor...", conflict: null });
    try {
      const exParam = excludeId ? `&exclude_id=${encodeURIComponent(excludeId)}` : "";
      const res = await fetch(`/api/agenda/sppd/cek-nomor?nomor=${encodeURIComponent(trimmed)}${exParam}`);
      const data = await res.json();
      if (data.ok) {
        if (data.exists) {
          setNomorCheck({
            status: "taken",
            message: `Nomor "${trimmed}" sudah digunakan oleh ${data.conflict?.pelaksana_nama || "pegawai lain"} (${data.conflict?.nomor_register || ""}).`,
            conflict: data.conflict
          });
          return false;
        } else {
          setNomorCheck({
            status: "available",
            message: `Nomor "${trimmed}" tersedia dan belum pernah digunakan.`,
            conflict: null
          });
          return true;
        }
      }
    } catch (_) {}
    setNomorCheck({ status: "idle", message: "", conflict: null });
    return true;
  };

  useEffect(() => {
    if (!modalSppd?.data?.nomor_register) {
      setNomorCheck({ status: "idle", message: "", conflict: null });
      return;
    }
    const timer = setTimeout(() => {
      cekKetersediaanNomor(modalSppd.data.nomor_register, modalSppd.mode === "edit" ? modalSppd.data.id : null);
    }, 320);
    return () => clearTimeout(timer);
  }, [modalSppd?.data?.nomor_register, modalSppd?.mode, modalSppd?.data?.id]);

  // ── Tambah / Ambil Nomor SPPD (Staff & Admin) ────────────────────────────
  const bukaAmbilNomorSppd = async (presetJenis) => {
    const selectedJenis = presetJenis || jenis;
    const preview = await fetchPreviewRegister(selectedJenis);
    const me = pegawaiList.find((x) => (user?.nip && x.nip === user.nip) || (user?.name && x.nama === user.name));
    const defBidang = wewenangConfig?.bidang || {
      jabatan: "Kepala Bidang PPE",
      nama: "BERLIAN MAGU WERU,S.Sos",
      nip: "19690619 200903 1 001"
    };
    const defKop = wewenangConfig?.kop_surat || "BAPPERIDA";

    setModalSppd({
      mode: "tambah",
      previewNomor: preview,
      data: {
        jenis_sppd: selectedJenis,
        kop_surat: defKop,
        nomor_register: preview,
        nomor_spt: preview,
        nomor_sppd: preview,
        tanggal_spt: new Date().toISOString().split("T")[0],
        ditetapkan_di: "Waikabubak",
        dasar_hukum: `DPA Bapperida Kabupaten Sumba Barat TA ${tahun}`,
        tingkat_biaya: selectedJenis === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C",
        pelaksana_tingkat_biaya: selectedJenis === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C",
        pejabat_perintah: defKop === "SEKDA" ? "Sekretaris Daerah" : "Kepala BAPPERIDA",
        pelaksana_nip: me?.nip || user?.nip || "",
        pelaksana_nama: me?.nama || user?.name || "",
        pelaksana_pangkat: me?.pangkat || "",
        pelaksana_jabatan: me?.jabatan || "",
        pelaksana_pptk_jabatan: defBidang.jabatan || "Kepala Bidang PPE",
        pelaksana_pptk_nama: defBidang.nama || "BERLIAN MAGU WERU,S.Sos",
        pelaksana_pptk_nip: defBidang.nip || "19690619 200903 1 001",
        pengikut: [],
        maksud_perjalanan: "",
        tempat_berangkat: "Waikabubak",
        tempat_tujuan: selectedJenis === "LUAR_DAERAH" ? "Kupang" : "",
        provinsi_tujuan: selectedJenis === "LUAR_DAERAH" ? "Nusa Tenggara Timur" : "",
        rute_perjalanan: "",
        alat_angkutan: selectedJenis === "LUAR_DAERAH" ? "Pesawat Udara (Ekonomi)" : "Kendaraan Dinas Roda 4",
        tanggal_berangkat: new Date().toISOString().split("T")[0],
        tanggal_kembali: new Date().toISOString().split("T")[0],
        subkegiatan_id: null,
        subkegiatan_nama: "Koordinasi dan Penyusunan Dokumen Perencanaan Pembangunan Daerah",
        penandatangan: wewenangConfig?.kepala || null,
        paraf: wewenangConfig?.paraf || null,
        wewenang: wewenangConfig ? {
          kop_surat: defKop,
          sekretaris: wewenangConfig.sekretaris,
          bidang: wewenangConfig.bidang,
          ktu: wewenangConfig.ktu
        } : { kop_surat: defKop },
        file_spt_url: "",
        file_sppd_url: ""
      }
    });
  };

  // ── Edit SPPD (Admin Only) ───────────────────────────────────────────────
  const bukaEditSppd = (it) => {
    let parsedPengikut = [];
    try {
      parsedPengikut = Array.isArray(it.pengikut) ? it.pengikut : JSON.parse(it.pengikut || "[]");
    } catch (_) {}

    let parsedWewenang = {};
    try {
      parsedWewenang = typeof it.wewenang === "object" && it.wewenang ? it.wewenang : JSON.parse(it.wewenang || "{}");
    } catch (_) {}

    const defBidang = parsedWewenang.bidang || wewenangConfig?.bidang || {
      jabatan: "Kepala Bidang PPE",
      nama: "BERLIAN MAGU WERU,S.Sos",
      nip: "19690619 200903 1 001"
    };
    const p1Pptk = parsedWewenang.pelaksana_pptk || defBidang;
    const kopSurat = it.kop_surat || parsedWewenang.kop_surat || wewenangConfig?.kop_surat || "BAPPERIDA";

    setModalSppd({
      mode: "edit",
      previewNomor: it.nomor_register,
      data: {
        id: it.id,
        jenis_sppd: it.jenis_sppd,
        kop_surat: kopSurat,
        nomor_register: it.nomor_register,
        nomor_spt: it.nomor_spt || it.nomor_register,
        nomor_sppd: it.nomor_sppd || it.nomor_register,
        tanggal_spt: it.tanggal_spt ? it.tanggal_spt.split("T")[0] : "",
        ditetapkan_di: it.ditetapkan_di || it.tempat_berangkat || "Waikabubak",
        dasar_hukum: it.dasar_hukum || `DPA Bapperida Kabupaten Sumba Barat TA ${it.tahun || tahun}`,
        tingkat_biaya: it.tingkat_biaya || (it.jenis_sppd === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C"),
        pelaksana_tingkat_biaya: p1Pptk.tingkat_biaya || it.pelaksana_tingkat_biaya || it.tingkat_biaya || (it.jenis_sppd === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C"),
        pejabat_perintah: it.pejabat_perintah || "Kepala BAPPERIDA",
        pelaksana_nip: it.pelaksana_nip || "",
        pelaksana_nama: it.pelaksana_nama || "",
        pelaksana_pangkat: it.pelaksana_pangkat || "",
        pelaksana_jabatan: it.pelaksana_jabatan || "",
        pelaksana_pptk_jabatan: p1Pptk.jabatan || defBidang.jabatan || "Kepala Bidang PPE",
        pelaksana_pptk_nama: p1Pptk.nama || defBidang.nama || "BERLIAN MAGU WERU,S.Sos",
        pelaksana_pptk_nip: p1Pptk.nip || defBidang.nip || "19690619 200903 1 001",
        pengikut: parsedPengikut.map((p) => ({
          ...p,
          tingkat_biaya: p.tingkat_biaya || it.tingkat_biaya || (it.jenis_sppd === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C"),
          pptk_jabatan: p.pptk_jabatan || defBidang.jabatan || "Kepala Bidang PPE",
          pptk_nama: p.pptk_nama || defBidang.nama || "BERLIAN MAGU WERU,S.Sos",
          pptk_nip: p.pptk_nip || defBidang.nip || "19690619 200903 1 001"
        })),
        maksud_perjalanan: it.maksud_perjalanan || "",
        tempat_berangkat: it.tempat_berangkat || "Waikabubak",
        tempat_tujuan: it.tempat_tujuan || "",
        provinsi_tujuan: it.provinsi_tujuan || "",
        rute_perjalanan: it.rute_perjalanan || "",
        alat_angkutan: it.alat_angkutan || "Kendaraan Dinas Roda 4",
        tanggal_berangkat: it.tanggal_berangkat ? it.tanggal_berangkat.split("T")[0] : "",
        tanggal_kembali: it.tanggal_kembali ? it.tanggal_kembali.split("T")[0] : "",
        subkegiatan_nama: it.subkegiatan_nama || "",
        status: it.status || "Pengajuan",
        penandatangan: it.penandatangan || wewenangConfig?.kepala || null,
        paraf: it.paraf || wewenangConfig?.paraf || null,
        wewenang: {
          ...parsedWewenang,
          kop_surat: kopSurat,
          sekretaris: parsedWewenang.sekretaris || wewenangConfig?.sekretaris,
          bidang: parsedWewenang.bidang || wewenangConfig?.bidang,
          ktu: parsedWewenang.ktu || wewenangConfig?.ktu
        },
        file_spt_url: it.file_spt_url || "",
        file_sppd_url: it.file_sppd_url || "",
        file_lhp_url: it.file_lhp_url || ""
      }
    });
  };

  const simpanSppd = async (e) => {
    e.preventDefault();
    const { mode, data } = modalSppd;
    if (!data.pelaksana_nip || !data.pelaksana_nama || !data.maksud_perjalanan || !data.tempat_tujuan) {
      notif("Nama pelaksana, NIP, maksud perjalanan, dan tempat tujuan wajib diisi!");
      return;
    }
    if (!data.tanggal_berangkat || !data.tanggal_kembali) {
      notif("Tanggal berangkat dan tanggal kembali perjalanan dinas wajib diisi!");
      return;
    }
    if (nomorCheck.status === "taken") {
      notif(nomorCheck.message || "Nomor register sudah digunakan! Silakan ganti nomor terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    try {
      const url = mode === "tambah" ? "/api/agenda/sppd" : `/api/agenda/sppd/${data.id}`;
      const method = mode === "tambah" ? "POST" : "PUT";
      const customNomorReg = (data.nomor_register || modalSppd.previewNomor || "").trim();
      const wewenangPayload = {
        ...(data.wewenang || {}),
        kop_surat: data.kop_surat || "BAPPERIDA",
        sekretaris: data.wewenang?.sekretaris || wewenangConfig?.sekretaris,
        bidang: data.wewenang?.bidang || wewenangConfig?.bidang,
        ktu: data.wewenang?.ktu || wewenangConfig?.ktu,
        pelaksana_pptk: {
          jabatan: data.pelaksana_pptk_jabatan || wewenangConfig?.bidang?.jabatan || "Kepala Bidang PPE",
          nama: data.pelaksana_pptk_nama || wewenangConfig?.bidang?.nama || "BERLIAN MAGU WERU,S.Sos",
          nip: data.pelaksana_pptk_nip || wewenangConfig?.bidang?.nip || "19690619 200903 1 001",
          tingkat_biaya: data.pelaksana_tingkat_biaya || data.tingkat_biaya || "Tingkat C"
        }
      };

      const payload = {
        ...data,
        nomor_register: customNomorReg,
        nomor_spt: (data.nomor_spt || customNomorReg).trim(),
        nomor_sppd: (data.nomor_sppd || customNomorReg).trim(),
        pelaksana_tingkat_biaya: data.pelaksana_tingkat_biaya || data.tingkat_biaya,
        wewenang: wewenangPayload,
        tahun
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();
      if (!resJson.ok) throw new Error(resJson.message || "Gagal menyimpan register SPPD");

      notif(mode === "tambah" ? `Nomor Register SPPD berhasil diterbitkan: ${resJson.item?.nomor_register || ""}` : "Data SPPD berhasil diperbarui!");
      setModalSppd(null);
      fetchData();
      fetchAllMetrics();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Kelola SPJ & Laporan Hasil Perjalanan (Staff & Admin) ─────────────────
  const [spjUploadingField, setSpjUploadingField] = useState(null); // "lhp" | "spt" | "sppd" | "lampiran" | null
  const [spjUploadProgress, setSpjUploadProgress] = useState(0);

  const bukaModalSpj = (it) => {
    let parsedSpj = [];
    try {
      parsedSpj = Array.isArray(it.berkas_spj) ? it.berkas_spj : JSON.parse(it.berkas_spj || "[]");
    } catch (_) {}

    let parsedWewenang = {};
    try {
      parsedWewenang = typeof it.wewenang === "object" && it.wewenang ? it.wewenang : JSON.parse(it.wewenang || "{}");
    } catch (_) {}

    setModalSpj({
      sppd: it,
      file_lhp_url: it.file_lhp_url || "",
      file_spt_url: it.file_spt_url || "",
      file_sppd_url: it.file_sppd_url || "",
      berkas_spj: parsedSpj,
      status: it.status || "Pengajuan",
      drive_folder_id: parsedWewenang.spj_drive_folder_id || "",
      drive_folder_url: parsedWewenang.spj_drive_folder_url || "",
      baruNama: "",
      baruUrl: ""
    });
  };

  const pastikanFolderDriveSpj = async (currentModalSpj) => {
    if (currentModalSpj.drive_folder_id) {
      return {
        folderId: currentModalSpj.drive_folder_id,
        folderUrl: currentModalSpj.drive_folder_url
      };
    }
    const sppd = currentModalSpj.sppd;
    const cleanReg = String(sppd.nomor_register || "SPPD").replace(/\//g, "-");
    const folderName = `SPJ - ${cleanReg} - ${sppd.pelaksana_nama || "Pelaksana"}`;
    const folderRes = await gasPostSppd({
      action: "createFolder",
      folderName
    });
    if (!folderRes || !folderRes.folderId) {
      throw new Error(folderRes?.error || "Gagal membuat folder khusus SPPD di Google Drive");
    }
    return {
      folderId: folderRes.folderId,
      folderUrl: folderRes.folderUrl || `https://drive.google.com/drive/folders/${folderRes.folderId}`
    };
  };

  const handleUploadBerkasSpjKeDrive = async (targetKey, fileObj, customLabel = "") => {
    if (!fileObj || !modalSpj) return;
    setSpjUploadingField(targetKey);
    setSpjUploadProgress(5);
    try {
      const { folderId, folderUrl } = await pastikanFolderDriveSpj(modalSpj);
      const sppd = modalSpj.sppd;
      const prefixLabel =
        targetKey === "lhp"
          ? `LHP - ${sppd.nomor_register}`
          : targetKey === "spt"
          ? `SPT Resmi - ${sppd.nomor_spt || sppd.nomor_register}`
          : targetKey === "sppd"
          ? `SPPD Cap - ${sppd.nomor_sppd || sppd.nomor_register}`
          : `${customLabel || fileObj.name} - ${sppd.nomor_register}`;

      const uploadedUrl = await uploadFileToDriveFolder(fileObj, {
        folderId,
        title: prefixLabel,
        year: sppd.tahun || tahun,
        uploader: user?.name || sppd.pelaksana_nama || "Staf BAPPERIDA",
        onProgress: (pct) => setSpjUploadProgress(pct)
      });

      if (!uploadedUrl) throw new Error("Tautan berkas Google Drive kosong");

      setModalSpj((prev) => {
        if (!prev) return prev;
        const base = {
          ...prev,
          drive_folder_id: folderId,
          drive_folder_url: folderUrl
        };
        if (targetKey === "lhp") {
          return {
            ...base,
            file_lhp_url: uploadedUrl,
            status: prev.status === "Pengajuan" ? "Laporan Masuk" : prev.status
          };
        }
        if (targetKey === "spt") return { ...base, file_spt_url: uploadedUrl };
        if (targetKey === "sppd") return { ...base, file_sppd_url: uploadedUrl };
        if (targetKey === "lampiran") {
          const namaBukti = (prev.baruNama || customLabel || fileObj.name.replace(/\.[^.]+$/, "")).trim();
          return {
            ...base,
            berkas_spj: [...prev.berkas_spj, { nama: namaBukti, url: uploadedUrl }],
            baruNama: "",
            baruUrl: ""
          };
        }
        return base;
      });

      notif(`Berkas "${fileObj.name}" berhasil diunggah ke folder Google Drive SPPD.`);
    } catch (err) {
      notif("Gagal unggah ke Google Drive: " + (err?.message || err));
    } finally {
      setSpjUploadingField(null);
      setSpjUploadProgress(0);
    }
  };

  const simpanBerkasSpj = async (e) => {
    e.preventDefault();
    const { sppd, file_lhp_url, file_spt_url, file_sppd_url, berkas_spj, status, drive_folder_id, drive_folder_url } = modalSpj;
    setSubmitting(true);
    try {
      let existingWewenang = {};
      try {
        existingWewenang = typeof sppd.wewenang === "object" && sppd.wewenang ? sppd.wewenang : JSON.parse(sppd.wewenang || "{}");
      } catch (_) {}

      const updatedWewenang = {
        ...existingWewenang,
        ...(drive_folder_id ? { spj_drive_folder_id: drive_folder_id } : {}),
        ...(drive_folder_url ? { spj_drive_folder_url: drive_folder_url } : {})
      };

      // Update LHP & berkas utama + simpan metadata folder Drive
      const res1 = await fetch(`/api/agenda/sppd/${sppd.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_lhp_url,
          file_spt_url,
          file_sppd_url,
          wewenang: updatedWewenang,
          status: status || (file_lhp_url ? "Laporan Masuk" : sppd.status)
        })
      });
      const data1 = await res1.json();
      if (!data1.ok) throw new Error(data1.message || "Gagal menyimpan berkas SPPD");

      // Update lampiran bukti SPJ
      const res2 = await fetch(`/api/agenda/sppd/${sppd.id}/spj`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ berkas_spj })
      });
      const data2 = await res2.json();
      if (!data2.ok) throw new Error(data2.message || "Gagal menyimpan lampiran SPJ");

      notif("Berkas LHP & SPJ perjalanan dinas berhasil diperbarui!");
      setModalSpj(null);
      fetchData();
      fetchAllMetrics();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Hapus SPPD (Admin Only) ───────────────────────────────────────────────
  const konfirmasiHapusSppd = async () => {
    if (!isAdmin) {
      notif("Akses ditolak: Hanya administrator yang dapat menghapus register SPPD.");
      return;
    }
    const it = modalHapus.data;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agenda/sppd/${it.id}`, { method: "DELETE" });
      const resJson = await res.json();
      if (!resJson.ok) throw new Error(resJson.message || "Gagal menghapus SPPD");

      notif("Register SPPD berhasil dihapus");
      setModalHapus(null);
      fetchData();
      fetchAllMetrics();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper pengikut items
  const tambahPengikut = () => {
    if (!modalSppd) return;
    const cur = modalSppd.data.pengikut || [];
    const defBidang = wewenangConfig?.bidang || {
      jabatan: modalSppd.data.pelaksana_pptk_jabatan || "Kepala Bidang PPE",
      nama: modalSppd.data.pelaksana_pptk_nama || "BERLIAN MAGU WERU,S.Sos",
      nip: modalSppd.data.pelaksana_pptk_nip || "19690619 200903 1 001"
    };
    setModalSppd({
      ...modalSppd,
      data: {
        ...modalSppd.data,
        pengikut: [
          ...cur,
          {
            nama: "",
            nip: "",
            pangkat: "",
            jabatan: "",
            tingkat_biaya: modalSppd.data.tingkat_biaya || (modalSppd.data.jenis_sppd === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C"),
            pptk_jabatan: defBidang.jabatan || "Kepala Bidang PPE",
            pptk_nama: defBidang.nama || "BERLIAN MAGU WERU,S.Sos",
            pptk_nip: defBidang.nip || "19690619 200903 1 001"
          }
        ]
      }
    });
  };

  const updatePengikut = (idx, field, val) => {
    const cur = [...modalSppd.data.pengikut];
    cur[idx] = { ...cur[idx], [field]: val };
    setModalSppd({
      ...modalSppd,
      data: { ...modalSppd.data, pengikut: cur }
    });
  };

  const hapusPengikut = (idx) => {
    const cur = modalSppd.data.pengikut.filter((_, i) => i !== idx);
    setModalSppd({
      ...modalSppd,
      data: { ...modalSppd.data, pengikut: cur }
    });
  };

  // Badge Status Renderer (Anti-slop: crisp, accessible, semantic)
  const renderStatusBadge = (status) => {
    const s = status || "Pengajuan";
    let bg = isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.15)";
    let col = T.textSecondary;

    if (s === "Selesai") {
      bg = isDark ? "rgba(16,185,129,0.18)" : "rgba(5,150,105,0.1)";
      col = T.success;
    } else if (s === "Laporan Masuk" || s === "Disetujui") {
      bg = isDark ? "rgba(59,130,246,0.18)" : "rgba(37,99,235,0.1)";
      col = T.primary;
    } else if (s === "Berangkat" || s === "Pengajuan") {
      bg = isDark ? "rgba(245,158,11,0.18)" : "rgba(217,119,6,0.1)";
      col = T.warning;
    }

    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: col,
        whiteSpace: "nowrap"
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: col, flexShrink: 0 }} />
        {s}
      </span>
    );
  };

  // Skeleton Loader for SPPD tables (Rule 19: Add loading states)
  const renderTableSkeleton = (cols = 8, rows = 5) => {
    const bgBar = isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0";
    return (
      <div style={{ padding: "8px 0" }}>
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={rIdx}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 16,
              padding: "14px 16px",
              borderBottom: `1px solid ${isDark ? "#334155" : "#F1F5F9"}`,
              alignItems: "center",
              animation: "agendaPulse 1.4s ease-in-out infinite",
              animationDelay: `${rIdx * 0.12}s`,
            }}
          >
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                style={{
                  height: cIdx === 0 ? 15 : 13,
                  width: cIdx === 0 ? "70%" : cIdx === 2 ? "90%" : "60%",
                  borderRadius: 4,
                  background: bgBar,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: T.font }}>
      <style>{`
        @keyframes agendaPulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.9; }
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 700, color: T.text, letterSpacing: "-0.015em" }}>
            Buku Register SPPD & SPT
          </h2>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>
            Penerbitan surat perintah tugas (SPT), registrasi perjalanan dinas (SPPD), dan verifikasi SPJ · {items.length} register ({statSelesai} selesai/SPJ lengkap)
          </div>
        </div>

        {/* Year Selector & Primary Action */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Select
            value={tahun}
            onChange={(v) => setTahun(parseInt(v, 10))}
            options={[
              { value: 2026, label: "Tahun 2026" },
              { value: 2025, label: "Tahun 2025" },
              { value: 2024, label: "Tahun 2024" },
            ]}
            icon="calendar"
            size="sm"
            minWidth={130}
          />

          <Button
            variant="primary"
            icon="plus"
            onClick={() => bukaAmbilNomorSppd(jenis)}
          >
            Ambil Nomor SPPD ({jenis === "DALAM_DAERAH" ? "Dalam Daerah" : "Luar Daerah"})
          </Button>

          <Button
            variant="secondary"
            icon="settings"
            onClick={() => setModalWewenang(true)}
            title="Pengaturan pejabat penandatangan dan paraf hierarki"
          >
            Wewenang
          </Button>
        </div>
      </div>

      {/* ── Sub-Nav Tabs (Matching BankData & DocPages) ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => { setJenis("DALAM_DAERAH"); setStatusFilter(""); }}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: jenis === "DALAM_DAERAH" ? T.primary : T.card,
            color: jenis === "DALAM_DAERAH" ? "#fff" : T.textSecondary,
            border: `1px solid ${jenis === "DALAM_DAERAH" ? T.primary : T.border}`,
            boxShadow: jenis === "DALAM_DAERAH" ? T.shadowSm : "none",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="building" size={14} />
          <span>SPPD Dalam Daerah</span>
          <span
            style={{
              padding: "1px 7px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: jenis === "DALAM_DAERAH" ? "rgba(255,255,255,0.22)" : isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              color: jenis === "DALAM_DAERAH" ? "#fff" : T.textMuted,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {statDalam}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setJenis("LUAR_DAERAH"); setStatusFilter(""); }}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: jenis === "LUAR_DAERAH" ? T.primary : T.card,
            color: jenis === "LUAR_DAERAH" ? "#fff" : T.textSecondary,
            border: `1px solid ${jenis === "LUAR_DAERAH" ? T.primary : T.border}`,
            boxShadow: jenis === "LUAR_DAERAH" ? T.shadowSm : "none",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="externalLink" size={14} />
          <span>SPPD Luar Daerah</span>
          <span
            style={{
              padding: "1px 7px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: jenis === "LUAR_DAERAH" ? "rgba(255,255,255,0.22)" : isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              color: jenis === "LUAR_DAERAH" ? "#fff" : T.textMuted,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {statLuar}
          </span>
        </button>
      </div>

      {/* ── Toolbar Search & Filter (Matching DocPages / BankData) ── */}
      <div
        style={{
          background: T.card,
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          padding: isMobile ? 12 : 14,
          marginBottom: 16,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted, display: "flex", pointerEvents: "none" }}>
            <Icon name="search" size={14} />
          </div>
          <input
            type="text"
            placeholder="Cari pelaksana, maksud perjalanan, atau tujuan dinas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            style={{
              width: "100%",
              padding: "9px 12px 9px 34px",
              borderRadius: 8,
              border: `1.5px solid ${T.border}`,
              background: T.inputBg,
              color: T.text,
              fontSize: 13,
              fontFamily: T.font,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filter Status */}
        <div style={{ width: isMobile ? "100%" : 180 }}>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Semua Status SPPD"
            options={[
              { value: "", label: "Semua Status SPPD" },
              { value: "Pengajuan", label: "Pengajuan" },
              { value: "Disetujui", label: "Disetujui" },
              { value: "Berangkat", label: "Berangkat" },
              { value: "Laporan Masuk", label: "Laporan Masuk" },
              { value: "Selesai", label: "Selesai" },
            ]}
            fullWidth
            size="sm"
          />
        </div>

        <Button
          variant="secondary"
          icon="refresh"
          size="sm"
          onClick={fetchData}
        >
          Segarkan
        </Button>

        <div style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
          {items.length} register
        </div>
      </div>

      {/* ── Table Container ── */}
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: T.shadowSm,
        overflow: "hidden"
      }}>
        {loading ? (
          renderTableSkeleton(7, 5)
        ) : error ? (
          <div style={{ padding: 48, textAlign: "center", color: T.danger }}>
            <Icon name="alert" size={24} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>{error}</div>
            <button
              type="button"
              onClick={fetchData}
              style={{ marginTop: 12, padding: "6px 14px", borderRadius: 6, background: T.bg, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", fontSize: 12 }}
            >
              Coba Lagi
            </button>
          </div>
        ) : items.length === 0 ? (
          <div style={{
            padding: "56px 20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF",
              color: T.primary,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Icon name="building" size={22} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                Belum ada data register SPPD {jenis === "DALAM_DAERAH" ? "Dalam Daerah" : "Luar Daerah"} untuk tahun {tahun}
              </div>
              <div style={{ fontSize: 12.5, color: T.textSecondary, maxWidth: 440, margin: "4px auto 0", lineHeight: 1.5 }}>
                Ambil nomor register baru untuk menetapkan surat perintah tugas (SPT) dan perjalanan dinas resmi.
              </div>
            </div>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => bukaAmbilNomorSppd(jenis)}
            >
              Ambil Nomor SPPD Pertama
            </Button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
              <thead>
                <tr style={{ background: isDark ? "#131D31" : "#F8FAFC", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>
                  <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 140 }}>No. Register</th>
                  <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 170 }}>Pelaksana Utama</th>
                  <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 240 }}>Maksud Perjalanan Dinas</th>
                  <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 140 }}>Tujuan & Transport</th>
                  <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 140 }}>Jadwal & Hari</th>
                  <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 110 }}>Status</th>
                  <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "right", minWidth: 160 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr
                    key={it.id}
                    style={{
                      borderBottom: `1px solid ${T.border}`,
                      transition: "background 0.1s ease"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "#1E293B" : "#F8FAFC"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ fontFamily: "monospace", fontWeight: 600, color: T.primary, fontVariantNumeric: "tabular-nums" }}>
                        {it.nomor_register}
                      </div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>
                        SPT: {it.nomor_spt || "—"}
                      </div>
                    </td>

                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ fontWeight: 600, color: T.text }}>{it.pelaksana_nama}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary, fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>NIP: {it.pelaksana_nip || "—"}</div>
                      {it.pelaksana_jabatan && (
                        <div style={{ fontSize: 11, color: T.textMuted }}>{it.pelaksana_jabatan}</div>
                      )}
                    </td>

                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ color: T.text, lineHeight: 1.4, marginBottom: 4 }}>{it.maksud_perjalanan}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>
                        Subkeg: {it.subkegiatan_nama || "BAPPERIDA"}
                      </div>
                    </td>

                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ fontWeight: 600, color: T.text }}>{it.tempat_tujuan}</div>
                      {it.provinsi_tujuan && (
                        <div style={{ fontSize: 11, color: T.textMuted }}>{it.provinsi_tujuan}</div>
                      )}
                      <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{it.alat_angkutan}</div>
                    </td>

                    <td style={{ padding: "11px 14px", fontVariantNumeric: "tabular-nums" }}>
                      <div style={{ fontWeight: 600, color: T.text, fontSize: 12 }}>
                        {it.tanggal_berangkat ? it.tanggal_berangkat.split("T")[0] : "—"}
                      </div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>
                        s/d {it.tanggal_kembali ? it.tanggal_kembali.split("T")[0] : "—"}
                      </div>
                      <div style={{ fontSize: 11, color: T.warning, fontWeight: 600, marginTop: 2 }}>
                        {it.lama_hari || 1} Hari Dinas
                      </div>
                    </td>

                    <td style={{ padding: "11px 14px" }}>
                      {renderStatusBadge(it.status)}
                    </td>

                    <td style={{ padding: "11px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                        {/* Tombol Pratinjau & Unduh Dokumen (Preview langsung terbuka saat download) */}
                        <button
                          type="button"
                          title="Pratinjau, Unduh (.docx/.pdf/.zip) & Cetak SPT / SPPD"
                          onClick={() => bukaPratinjau(it)}
                          style={{
                            height: 28,
                            padding: "0 10px",
                            borderRadius: 6,
                            border: `1px solid ${isDark ? "rgba(59,130,246,0.4)" : "#BFDBFE"}`,
                            background: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF",
                            color: T.primary,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            transition: "all 0.15s ease"
                          }}
                        >
                          <Icon name="download" size={12} />
                          <span>Unduh / Pratinjau</span>
                        </button>

                        {/* Berkas SPJ & LHP */}
                        <button
                          type="button"
                          title="Kelola LHP & SPJ"
                          onClick={() => bukaModalSpj(it)}
                          style={{
                            height: 28,
                            padding: "0 9px",
                            borderRadius: 6,
                            border: `1px solid ${T.border}`,
                            background: it.file_lhp_url ? (isDark ? "rgba(16,185,129,0.18)" : "rgba(5,150,105,0.08)") : T.bg,
                            color: it.file_lhp_url ? T.success : T.text,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            transition: "all 0.15s ease"
                          }}
                        >
                          <Icon name="upload" size={12} />
                          <span>SPJ/LHP</span>
                        </button>

                        {/* Detail Button */}
                        <button
                          type="button"
                          title="Lihat Detail SPT & SPPD"
                          onClick={() => setModalDetail({ data: it })}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: `1px solid ${T.border}`,
                            background: T.bg,
                            color: T.textSecondary,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <Icon name="eye" size={13} />
                        </button>

                        {/* Edit Button (Admin Only) */}
                        {isAdmin && (
                          <button
                            type="button"
                            title="Edit Register SPPD"
                            onClick={() => bukaEditSppd(it)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: T.bg,
                              color: T.textSecondary,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <Icon name="edit" size={13} />
                          </button>
                        )}

                        {/* Hapus Button (Admin Only) */}
                        {isAdmin && (
                          <button
                            type="button"
                            title="Hapus Register SPPD"
                            onClick={() => setModalHapus({ data: it })}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: `1px solid ${T.dangerBorder || "#FECACA"}`,
                              background: T.dangerBg || "#FEF2F2",
                              color: T.danger,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: AMBIL NOMOR / PENDAFTARAN SPPD (STAFF & ADMIN) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalSppd && (
        <Modal
          title={modalSppd.mode === "tambah" ? "Ambil Nomor Register SPPD & SPT" : "Edit Register SPPD"}
          subtitle="Form penetapan surat perintah tugas (SPT) dan registrasi perjalanan dinas (SPPD)"
          icon="file"
          onClose={() => setModalSppd(null)}
          maxWidth={740}
        >
          <form onSubmit={simpanSppd} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Live Register Number Banner (Editable / Custom + Cek Ketersediaan Otomatis + Pilihan KOP) */}
            <div style={{ background: isDark ? "#172337" : "#EFF6FF", border: `1px solid ${isDark ? "#2563EB" : "#BFDBFE"}`, padding: "12px 16px", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 280px" }}>
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.03em" }}>
                      NOMOR REGISTER / SURAT (DAPAT DICUSTOM) *
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 001/SPPD-DD/2026 atau BAPPERIDA.090/015/2026"
                      value={modalSppd.data.nomor_register ?? modalSppd.previewNomor ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const prevReg = modalSppd.data.nomor_register || modalSppd.previewNomor || "";
                        const syncSpt = !modalSppd.data.nomor_spt || modalSppd.data.nomor_spt === prevReg;
                        const syncSppd = !modalSppd.data.nomor_sppd || modalSppd.data.nomor_sppd === prevReg;
                        setModalSppd({
                          ...modalSppd,
                          previewNomor: val,
                          data: {
                            ...modalSppd.data,
                            nomor_register: val,
                            ...(syncSpt ? { nomor_spt: val } : {}),
                            ...(syncSppd ? { nomor_sppd: val } : {})
                          }
                        });
                      }}
                      style={{
                        flex: 1,
                        padding: "7px 10px",
                        borderRadius: 6,
                        border: `1.5px solid ${
                          nomorCheck.status === "taken"
                            ? T.danger
                            : nomorCheck.status === "available"
                            ? T.success
                            : T.border
                        }`,
                        background: T.card,
                        color: T.text,
                        fontSize: 13.5,
                        fontWeight: 800,
                        fontFamily: "monospace",
                        fontVariantNumeric: "tabular-nums"
                      }}
                    />
                  </div>

                  {/* Indikator Status Cek Nomor Otomatis */}
                  {nomorCheck.status !== "idle" && (
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 11.5,
                        fontWeight: 600,
                        color:
                          nomorCheck.status === "taken"
                            ? T.danger
                            : nomorCheck.status === "available"
                            ? T.success
                            : T.textSecondary,
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <Icon
                        name={
                          nomorCheck.status === "taken"
                            ? "alert"
                            : nomorCheck.status === "available"
                            ? "checkCircle"
                            : "clock"
                        }
                        size={13}
                      />
                      <span>{nomorCheck.message}</span>
                    </div>
                  )}
                </div>

                {/* Pilihan Jenis SPPD & KOP Surat */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const nextJ = "DALAM_DAERAH";
                        const p = await fetchPreviewRegister(nextJ);
                        const isDefaultNum = !modalSppd.data.nomor_register || modalSppd.data.nomor_register === modalSppd.previewNomor;
                        const nextNum = modalSppd.mode === "tambah" && isDefaultNum ? p : (modalSppd.data.nomor_register || modalSppd.previewNomor);
                        setModalSppd({
                          ...modalSppd,
                          previewNomor: nextNum,
                          data: {
                            ...modalSppd.data,
                            jenis_sppd: nextJ,
                            nomor_register: nextNum,
                            nomor_spt: isDefaultNum ? nextNum : modalSppd.data.nomor_spt,
                            nomor_sppd: isDefaultNum ? nextNum : modalSppd.data.nomor_sppd,
                            tempat_tujuan: "",
                            provinsi_tujuan: "",
                            alat_angkutan: "Kendaraan Dinas Roda 4",
                            tingkat_biaya: "Tingkat C"
                          }
                        });
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "none",
                        background: modalSppd.data.jenis_sppd === "DALAM_DAERAH" ? T.primary : T.card,
                        color: modalSppd.data.jenis_sppd === "DALAM_DAERAH" ? "#fff" : T.text,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Dalam Daerah
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const nextJ = "LUAR_DAERAH";
                        const p = await fetchPreviewRegister(nextJ);
                        const isDefaultNum = !modalSppd.data.nomor_register || modalSppd.data.nomor_register === modalSppd.previewNomor;
                        const nextNum = modalSppd.mode === "tambah" && isDefaultNum ? p : (modalSppd.data.nomor_register || modalSppd.previewNomor);
                        setModalSppd({
                          ...modalSppd,
                          previewNomor: nextNum,
                          data: {
                            ...modalSppd.data,
                            jenis_sppd: nextJ,
                            nomor_register: nextNum,
                            nomor_spt: isDefaultNum ? nextNum : modalSppd.data.nomor_spt,
                            nomor_sppd: isDefaultNum ? nextNum : modalSppd.data.nomor_sppd,
                            tempat_tujuan: "Kupang",
                            provinsi_tujuan: "Nusa Tenggara Timur",
                            alat_angkutan: "Pesawat Udara (Ekonomi)",
                            tingkat_biaya: "Tingkat B"
                          }
                        });
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "none",
                        background: modalSppd.data.jenis_sppd === "LUAR_DAERAH" ? T.primary : T.card,
                        color: modalSppd.data.jenis_sppd === "LUAR_DAERAH" ? "#fff" : T.text,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Luar Daerah
                    </button>
                  </div>

                  {/* Pilihan KOP Surat: BAPPERIDA vs Sekretariat Daerah */}
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: T.textSecondary, marginRight: 2 }}>KOP SURAT:</span>
                    {[
                      { key: "BAPPERIDA", label: "KOP BAPPERIDA" },
                      { key: "SEKDA", label: "KOP Sekretariat Daerah" }
                    ].map((k) => {
                      const active = (modalSppd.data.kop_surat || "BAPPERIDA") === k.key;
                      return (
                        <button
                          key={k.key}
                          type="button"
                          onClick={() =>
                            setModalSppd({
                              ...modalSppd,
                              data: {
                                ...modalSppd.data,
                                kop_surat: k.key,
                                pejabat_perintah:
                                  k.key === "SEKDA" && modalSppd.data.pejabat_perintah === "Kepala BAPPERIDA"
                                    ? "Sekretaris Daerah"
                                    : k.key === "BAPPERIDA" && modalSppd.data.pejabat_perintah === "Sekretaris Daerah"
                                    ? "Kepala BAPPERIDA"
                                    : modalSppd.data.pejabat_perintah
                              }
                            })
                          }
                          style={{
                            padding: "4px 8px",
                            borderRadius: 5,
                            border: `1px solid ${active ? T.primary : T.border}`,
                            background: active ? T.primary : T.card,
                            color: active ? "#fff" : T.textSecondary,
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          {k.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Personil / Tim Pelaksana (Disatukan: Personil 1 + Personil Tambahan, Tanpa Datalist Ganda + Pengaturan Romawi I Per Personil) */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", background: T.bg }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>
                  1. Personil / Tim Pelaksana ({1 + (modalSppd.data.pengikut?.length || 0)})
                </div>
                <button
                  type="button"
                  onClick={tambahPengikut}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: `1px solid ${T.border}`,
                    background: T.card,
                    color: T.primary,
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "pointer"
                  }}
                >
                  + Tambah Personil
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Personil 1 (Pelaksana Utama) */}
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, background: T.card, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: T.primary }}>Personil 1 (Pelaksana Utama)</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>Pilih dari daftar pegawai atau ketik langsung</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Nama Lengkap *</label>
                      <CariPilih
                        value={modalSppd.data.pelaksana_nama || ""}
                        opsi={opsiPegawaiNama}
                        placeholder="Cari nama / NIP pegawai atau ketik manual..."
                        kosongDaftar="Belum ada data pegawai."
                        kosongCari="Pegawai tidak ditemukan. Tekan Enter untuk memakai nama ini."
                        onChange={(val) => {
                          const p = pegawaiList.find((x) => x.nama === val);
                          setModalSppd({
                            ...modalSppd,
                            data: {
                              ...modalSppd.data,
                              pelaksana_nama: val,
                              ...(p
                                ? {
                                    pelaksana_nip: p.nip || "",
                                    pelaksana_pangkat: p.pangkat || "",
                                    pelaksana_jabatan: p.jabatan || ""
                                  }
                                : {})
                            }
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>NIP Pegawai *</label>
                      <input
                        type="text"
                        required
                        autoComplete="off"
                        placeholder="19800101 200501 1 001"
                        value={modalSppd.data.pelaksana_nip}
                        onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_nip: e.target.value } })}
                        style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12.5 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr 0.9fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Pangkat / Golongan</label>
                      <input
                        type="text"
                        placeholder="Pembina, IV/a"
                        value={modalSppd.data.pelaksana_pangkat}
                        onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_pangkat: e.target.value } })}
                        style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12.5 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Jabatan</label>
                      <input
                        type="text"
                        placeholder="Perencana Ahli Muda / Staf"
                        value={modalSppd.data.pelaksana_jabatan}
                        onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_jabatan: e.target.value } })}
                        style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12.5 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Tingkat Biaya</label>
                      <Select
                        fullWidth
                        size="sm"
                        value={modalSppd.data.pelaksana_tingkat_biaya || modalSppd.data.tingkat_biaya || (modalSppd.data.jenis_sppd === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C")}
                        onChange={(v) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_tingkat_biaya: v } })}
                        options={[
                          { value: "Tingkat A", label: "Tingkat A" },
                          { value: "Tingkat B", label: "Tingkat B" },
                          { value: "Tingkat C", label: "Tingkat C" },
                          { value: "Tingkat D", label: "Tingkat D" }
                        ]}
                      />
                    </div>
                  </div>

                  {/* Pengesahan Keberangkatan (Romawi I) untuk Personil 1 — Terpadu dengan CariPilih */}
                  <div style={{ marginTop: 4, paddingTop: 8, borderTop: `1px dashed ${T.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 6 }}>
                      Pejabat Pengesah Berangkat (Romawi I - Personil 1):
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 0.9fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10.5, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 3 }}>Nama Pejabat (Cari / Ketik)</label>
                        <CariPilih
                          value={modalSppd.data.pelaksana_pptk_nama || ""}
                          opsi={opsiPegawaiNama}
                          placeholder="Cari nama pejabat pengesah..."
                          kosongDaftar="Belum ada data pegawai."
                          kosongCari="Tidak ditemukan. Tekan Enter untuk memakai nama ini."
                          onChange={(val) => {
                            const p = pegawaiList.find((x) => x.nama === val);
                            setModalSppd({
                              ...modalSppd,
                              data: {
                                ...modalSppd.data,
                                pelaksana_pptk_nama: val,
                                ...(p
                                  ? {
                                      pelaksana_pptk_nip: p.nip || "",
                                      pelaksana_pptk_jabatan: p.jabatan || modalSppd.data.pelaksana_pptk_jabatan || "Kepala Bidang PPE"
                                    }
                                  : {})
                              }
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10.5, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 3 }}>Jabatan Pengesah (Romawi I)</label>
                        <input
                          type="text"
                          placeholder="Mis. KEPALA BIDANG PPE"
                          value={modalSppd.data.pelaksana_pptk_jabatan || ""}
                          onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_pptk_jabatan: e.target.value } })}
                          style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10.5, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 3 }}>NIP Pejabat</label>
                        <input
                          type="text"
                          placeholder="NIP Pejabat Pengesah"
                          value={modalSppd.data.pelaksana_pptk_nip || ""}
                          onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_pptk_nip: e.target.value } })}
                          style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personil 2, 3, ... (Anggota Tim / Pengikut) */}
                {(modalSppd.data.pengikut || []).map((p, idx) => (
                  <div key={idx} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, background: T.card, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: T.text }}>Personil {idx + 2}</span>
                      <button
                        type="button"
                        aria-label={`Hapus personil ${idx + 2}`}
                        onClick={() => hapusPengikut(idx)}
                        style={{ padding: "5px 8px", borderRadius: 6, border: "none", background: T.dangerBg || "#FEF2F2", color: T.danger, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}
                      >
                        <Icon name="x" size={12} />
                        <span>Hapus</span>
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Nama Lengkap *</label>
                        <CariPilih
                          value={p.nama || ""}
                          opsi={opsiPegawaiNama}
                          placeholder="Cari nama / NIP pegawai atau ketik manual..."
                          kosongDaftar="Belum ada data pegawai."
                          kosongCari="Pegawai tidak ditemukan. Tekan Enter untuk memakai nama ini."
                          onChange={(val) => {
                            const pg = pegawaiList.find((x) => x.nama === val);
                            const cur = [...modalSppd.data.pengikut];
                            cur[idx] = {
                              ...cur[idx],
                              nama: val,
                              ...(pg
                                ? {
                                    nip: pg.nip || "",
                                    pangkat: pg.pangkat || "",
                                    jabatan: pg.jabatan || ""
                                  }
                                : {})
                            };
                            setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pengikut: cur } });
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>NIP Pegawai</label>
                        <input
                          type="text"
                          autoComplete="off"
                          placeholder="NIP"
                          value={p.nip || ""}
                          onChange={(e) => updatePengikut(idx, "nip", e.target.value)}
                          style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12.5 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr 0.9fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Pangkat / Golongan</label>
                        <input
                          type="text"
                          autoComplete="off"
                          placeholder="Pangkat / Golongan"
                          value={p.pangkat || ""}
                          onChange={(e) => updatePengikut(idx, "pangkat", e.target.value)}
                          style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12.5 }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Jabatan</label>
                        <input
                          type="text"
                          autoComplete="off"
                          placeholder="Jabatan"
                          value={p.jabatan || ""}
                          onChange={(e) => updatePengikut(idx, "jabatan", e.target.value)}
                          style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12.5 }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Tingkat Biaya</label>
                        <Select
                          fullWidth
                          size="sm"
                          value={p.tingkat_biaya || modalSppd.data.tingkat_biaya || (modalSppd.data.jenis_sppd === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C")}
                          onChange={(v) => updatePengikut(idx, "tingkat_biaya", v)}
                          options={[
                            { value: "Tingkat A", label: "Tingkat A" },
                            { value: "Tingkat B", label: "Tingkat B" },
                            { value: "Tingkat C", label: "Tingkat C" },
                            { value: "Tingkat D", label: "Tingkat D" }
                          ]}
                        />
                      </div>
                    </div>

                    {/* Pengesahan Keberangkatan (Romawi I) untuk Personil ke-(idx+2) — Terpadu dengan CariPilih */}
                    <div style={{ marginTop: 4, paddingTop: 8, borderTop: `1px dashed ${T.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 6 }}>
                        Pejabat Pengesah Berangkat (Romawi I - Personil {idx + 2}):
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 0.9fr", gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 3 }}>Nama Pejabat (Cari / Ketik)</label>
                          <CariPilih
                            value={p.pptk_nama || ""}
                            opsi={opsiPegawaiNama}
                            placeholder="Cari nama pejabat pengesah..."
                            kosongDaftar="Belum ada data pegawai."
                            kosongCari="Tidak ditemukan. Tekan Enter untuk memakai nama ini."
                            onChange={(val) => {
                              const pg = pegawaiList.find((x) => x.nama === val);
                              const cur = [...modalSppd.data.pengikut];
                              cur[idx] = {
                                ...cur[idx],
                                pptk_nama: val,
                                ...(pg
                                  ? {
                                      pptk_nip: pg.nip || "",
                                      pptk_jabatan: pg.jabatan || cur[idx].pptk_jabatan || "Kepala Bidang PPE"
                                    }
                                  : {})
                              };
                              setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pengikut: cur } });
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 3 }}>Jabatan Pengesah (Romawi I)</label>
                          <input
                            type="text"
                            placeholder="Mis. KEPALA BIDANG PPE"
                            value={p.pptk_jabatan || ""}
                            onChange={(e) => updatePengikut(idx, "pptk_jabatan", e.target.value)}
                            style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 3 }}>NIP Pejabat</label>
                          <input
                            type="text"
                            placeholder="NIP Pejabat Pengesah"
                            value={p.pptk_nip || ""}
                            onChange={(e) => updatePengikut(idx, "pptk_nip", e.target.value)}
                            style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.inputBorder || T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Maksud & Rute Perjalanan */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", background: T.bg }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 10 }}>2. Maksud & Destinasi Tugas</div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Maksud Perjalanan Dinas *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Deskripsikan secara lengkap agenda kegiatan dinas..."
                  value={modalSppd.data.maksud_perjalanan}
                  onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, maksud_perjalanan: e.target.value } })}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5, resize: "vertical" }}
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Dasar Hukum / Menimbang SPT <span style={{ fontWeight: 400, color: T.textMuted }}>(1 baris = 1 poin dasar)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder={`DPA Bapperida Kabupaten Sumba Barat TA ${tahun}`}
                  value={modalSppd.data.dasar_hukum || ""}
                  onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, dasar_hukum: e.target.value } })}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (modalSppd.data.jenis_sppd === "LUAR_DAERAH" ? "1fr 1fr" : "1fr 1fr 1.2fr"), gap: 10, marginTop: 10, alignItems: "end" }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Tempat Berangkat</label>
                  <input
                    type="text"
                    value={modalSppd.data.tempat_berangkat}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, tempat_berangkat: e.target.value } })}
                    style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Tempat Tujuan *</label>
                  <input
                    type="text"
                    required
                    placeholder="Mis. Kupang / Wanokaka"
                    value={modalSppd.data.tempat_tujuan}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, tempat_tujuan: e.target.value } })}
                    style={{ width: "100%", height: 36, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5 }}
                  />
                </div>

                {modalSppd.data.jenis_sppd === "LUAR_DAERAH" && (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Provinsi Tujuan</label>
                    <Select
                      fullWidth
                      size="sm"
                      searchable
                      value={modalSppd.data.provinsi_tujuan}
                      onChange={(v) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, provinsi_tujuan: v } })}
                      options={PROVINSI_LIST.map((p) => ({ value: p, label: p }))}
                    />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>5. Alat Angkut yang Digunakan</label>
                  <CariPilih
                    value={modalSppd.data.alat_angkutan || ""}
                    opsi={ANGKUTAN_LIST.map((a) => ({ value: a, label: a }))}
                    placeholder="Pilih atau ketik alat angkut..."
                    kosongDaftar="Belum ada opsi alat angkut."
                    kosongCari="Tekan Enter untuk memakai alat angkut ini."
                    onChange={(v) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, alat_angkutan: v } })}
                  />
                </div>
              </div>
            </div>

            {/* Waktu & Pejabat Pemberi Perintah */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", background: T.bg }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 10 }}>3. Waktu Pelaksanaan & Pejabat Perintah</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Tgl. Berangkat *</label>
                  <DatePicker
                    size="sm"
                    value={modalSppd.data.tanggal_berangkat}
                    onChange={(val) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, tanggal_berangkat: val } })}
                    placeholder="Pilih tanggal berangkat..."
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Tgl. Kembali *</label>
                  <DatePicker
                    size="sm"
                    value={modalSppd.data.tanggal_kembali}
                    onChange={(val) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, tanggal_kembali: val } })}
                    placeholder="Pilih tanggal kembali..."
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Pejabat Pemberi Perintah</label>
                  <Select
                    fullWidth
                    size="sm"
                    value={modalSppd.data.pejabat_perintah}
                    onChange={(v) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pejabat_perintah: v } })}
                    options={PEJABAT_PERINTAH_LIST.map((p) => ({ value: p, label: p }))}
                  />
                </div>
              </div>

              {/* Detail Nomor SPT/SPPD, Penetapan & Anggaran (seperti Perjalanan Dinas di Absen) */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Nomor SPT</label>
                  <input
                    type="text"
                    value={modalSppd.data.nomor_spt || ""}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, nomor_spt: e.target.value } })}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Nomor SPPD</label>
                  <input
                    type="text"
                    value={modalSppd.data.nomor_sppd || ""}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, nomor_sppd: e.target.value } })}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Tingkat Biaya</label>
                  <Select
                    fullWidth
                    size="sm"
                    value={modalSppd.data.tingkat_biaya || "Tingkat C"}
                    onChange={(v) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, tingkat_biaya: v } })}
                    options={[
                      { value: "Tingkat A", label: "Tingkat A" },
                      { value: "Tingkat B", label: "Tingkat B" },
                      { value: "Tingkat C", label: "Tingkat C" },
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Ditetapkan Di</label>
                  <input
                    type="text"
                    value={modalSppd.data.ditetapkan_di || "Waikabubak"}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, ditetapkan_di: e.target.value } })}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Tgl. Penetapan SPT</label>
                  <DatePicker
                    size="sm"
                    value={modalSppd.data.tanggal_spt || ""}
                    onChange={(val) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, tanggal_spt: val } })}
                    placeholder="Tanggal penetapan..."
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Subkegiatan / Mata Anggaran</label>
                  <input
                    type="text"
                    placeholder="Nama subkegiatan DPA..."
                    value={modalSppd.data.subkegiatan_nama || ""}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, subkegiatan_nama: e.target.value } })}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                  />
                </div>
              </div>
            </div>

            {modalSppd.mode === "edit" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Status SPPD
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalSppd.data.status}
                  onChange={(v) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, status: v } })}
                  options={[
                    { value: "Pengajuan", label: "Pengajuan" },
                    { value: "Disetujui", label: "Disetujui" },
                    { value: "Berangkat", label: "Berangkat" },
                    { value: "Laporan Masuk", label: "Laporan Masuk" },
                    { value: "Selesai", label: "Selesai" },
                  ]}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setModalSppd(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Menyimpan..." : (modalSppd.mode === "tambah" ? "Terbitkan Nomor SPPD" : "Simpan Perubahan")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: KELOLA SPJ & LAPORAN HASIL PERJALANAN (STAFF & ADMIN) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalSpj && (
        <Modal
          title="Kelola Berkas Pertanggungjawaban (SPJ & LHP)"
          subtitle={`Register: ${modalSpj.sppd.nomor_register} - ${modalSpj.sppd.pelaksana_nama}`}
          icon="upload"
          onClose={() => !spjUploadingField && setModalSpj(null)}
          maxWidth={680}
        >
          <form onSubmit={simpanBerkasSpj} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: isDark ? "#172337" : "#F1F5F9", padding: "10px 14px", borderRadius: 8, borderLeft: `4px solid ${T.success}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary }}>PERJALANAN DINAS</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 2 }}>{modalSpj.sppd.maksud_perjalanan}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                  Tujuan: {modalSpj.sppd.tempat_tujuan} • Durasi: {modalSpj.sppd.lama_hari || 1} Hari Dinas
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Icon name="folder" size={13} />
                  <span>Folder Google Drive Otomatis per Register</span>
                </div>
                {modalSpj.drive_folder_url ? (
                  <a
                    href={modalSpj.drive_folder_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: T.primary,
                      color: "#fff",
                      fontSize: 11.5,
                      fontWeight: 700,
                      textDecoration: "none"
                    }}
                  >
                    <Icon name="externalLink" size={12} />
                    <span>Buka Folder Drive SPPD</span>
                  </a>
                ) : (
                  <span style={{ fontSize: 11, color: T.textMuted }}>
                    Folder <b>SPJ - {String(modalSpj.sppd.nomor_register || "").replace(/\//g, "-")}</b> dibuat otomatis saat upload pertama
                  </span>
                )}
              </div>
            </div>

            {spjUploadingField && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: isDark ? "rgba(37,99,235,0.16)" : "#EFF6FF", border: `1px solid ${T.primary}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>
                  Mengunggah berkas ke Folder Google Drive SPPD... ({spjUploadProgress}%)
                </span>
                <div style={{ width: 120, height: 6, borderRadius: 99, background: isDark ? "#1e293b" : "#DBEAFE", overflow: "hidden" }}>
                  <div style={{ width: `${spjUploadProgress}%`, height: "100%", background: T.primary, transition: "width 0.2s ease" }} />
                </div>
              </div>
            )}

            {/* 1. Berkas LHP */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>
                  Berkas LHP (Laporan Hasil Perjalanan Dinas - PDF/Word) *
                </label>
                {modalSpj.file_lhp_url && (
                  <a href={modalSpj.file_lhp_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, fontWeight: 700, color: T.primary, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="externalLink" size={12} /> Lihat Berkas LHP
                  </a>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                <input
                  type="url"
                  placeholder="Upload file di samping atau tempel link https://drive.google.com/..."
                  value={modalSpj.file_lhp_url}
                  onChange={(e) => setModalSpj({ ...modalSpj, file_lhp_url: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12.5 }}
                />
                <label
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: T.primary,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: spjUploadingField ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    opacity: spjUploadingField ? 0.65 : 1
                  }}
                >
                  <Icon name="upload" size={13} />
                  <span>{spjUploadingField === "lhp" ? `Mengunggah ${spjUploadProgress}%` : "Upload ke Drive"}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    disabled={!!spjUploadingField}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadBerkasSpjKeDrive("lhp", f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            {/* 2. File SPT & SPPD Bertandatangan */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>
                    File SPT Resmi Bertandatangan
                  </label>
                  {modalSpj.file_spt_url && (
                    <a href={modalSpj.file_spt_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: T.primary, textDecoration: "none" }}>
                      Buka
                    </a>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/.../spt.pdf"
                    value={modalSpj.file_spt_url}
                    onChange={(e) => setModalSpj({ ...modalSpj, file_spt_url: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12 }}
                  />
                  <label
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${T.primary}`,
                      background: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF",
                      color: T.primary,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: spjUploadingField ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      whiteSpace: "nowrap"
                    }}
                  >
                    <Icon name="upload" size={12} />
                    <span>{spjUploadingField === "spt" ? `${spjUploadProgress}%` : "Upload"}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      disabled={!!spjUploadingField}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadBerkasSpjKeDrive("spt", f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>
                    File SPPD Bertandatangan & Cap
                  </label>
                  {modalSpj.file_sppd_url && (
                    <a href={modalSpj.file_sppd_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: T.primary, textDecoration: "none" }}>
                      Buka
                    </a>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/.../sppd.pdf"
                    value={modalSpj.file_sppd_url}
                    onChange={(e) => setModalSpj({ ...modalSpj, file_sppd_url: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 12 }}
                  />
                  <label
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${T.primary}`,
                      background: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF",
                      color: T.primary,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: spjUploadingField ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      whiteSpace: "nowrap"
                    }}
                  >
                    <Icon name="upload" size={12} />
                    <span>{spjUploadingField === "sppd" ? `${spjUploadProgress}%` : "Upload"}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      disabled={!!spjUploadingField}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadBerkasSpjKeDrive("sppd", f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* 3. Lampiran Bukti Kwitansi / Tiket / Hotel */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", background: T.bg }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 8 }}>
                Daftar Lampiran Bukti SPJ (Tiket, Hotel, Boarding Pass, Dokumentasi):
              </div>

              {modalSpj.berkas_spj.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {modalSpj.berkas_spj.map((b, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.card, padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.border}` }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{b.nama || "Bukti SPJ"}</div>
                        <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.primary, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {b.url}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = modalSpj.berkas_spj.filter((_, i) => i !== idx);
                          setModalSpj({ ...modalSpj, berkas_spj: next });
                        }}
                        style={{ border: "none", background: "none", color: T.danger, cursor: "pointer", padding: 4 }}
                      >
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Form Tambah / Upload Bukti */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto auto", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Nama Bukti (mis. Tiket Pesawat Kupang-Tambolaka)"
                  value={modalSpj.baruNama}
                  onChange={(e) => setModalSpj({ ...modalSpj, baruNama: e.target.value })}
                  style={{ padding: "7px 9px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                />
                <input
                  type="url"
                  placeholder="Link Drive (opsional jika klik Upload File)"
                  value={modalSpj.baruUrl}
                  onChange={(e) => setModalSpj({ ...modalSpj, baruUrl: e.target.value })}
                  style={{ padding: "7px 9px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                />
                <label
                  style={{
                    padding: "7px 11px",
                    borderRadius: 6,
                    background: "#059669",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: spjUploadingField ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    whiteSpace: "nowrap"
                  }}
                >
                  <Icon name="upload" size={12} />
                  <span>{spjUploadingField === "lampiran" ? `Upload ${spjUploadProgress}%` : "Upload File"}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    disabled={!!spjUploadingField}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadBerkasSpjKeDrive("lampiran", f, modalSpj.baruNama);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!modalSpj.baruNama || !modalSpj.baruUrl) {
                      notif("Isi nama bukti dan URL, atau gunakan tombol Upload File untuk mengunggah langsung ke Drive!");
                      return;
                    }
                    const next = [...modalSpj.berkas_spj, { nama: modalSpj.baruNama, url: modalSpj.baruUrl }];
                    setModalSpj({ ...modalSpj, berkas_spj: next, baruNama: "", baruUrl: "" });
                  }}
                  style={{ padding: "7px 12px", borderRadius: 6, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  + Tambah Link
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Status Verifikasi Berkas
              </label>
              <Select
                fullWidth
                size="md"
                value={modalSpj.status}
                onChange={(v) => setModalSpj({ ...modalSpj, status: v })}
                options={[
                  { value: "Laporan Masuk", label: "Laporan Masuk (Dalam Verifikasi TU/Keuangan)" },
                  { value: "Selesai", label: "Selesai (SPJ Lengkap & Terverifikasi)" },
                  { value: "Pengajuan", label: "Belum Selesai" },
                ]}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                disabled={!!spjUploadingField}
                onClick={() => setModalSpj(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={submitting || !!spjUploadingField}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.success, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting || spjUploadingField ? 0.7 : 1 }}
              >
                {submitting ? "Menyimpan..." : "Simpan Berkas SPJ & LHP"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: DETAIL LENGKAP SPPD & SPT */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalDetail && (
        <Modal
          title="Rincian Register SPT & SPPD"
          subtitle={`Detail registrasi dinas nomor: ${modalDetail.data.nomor_register}`}
          icon="fileText"
          onClose={() => setModalDetail(null)}
          maxWidth={620}
        >
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 8, fontSize: 13 }}>
              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor Register:</div>
              <div style={{ fontWeight: 800, fontFamily: "monospace", color: T.primary }}>{modalDetail.data.nomor_register}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Jenis SPPD:</div>
              <div style={{ fontWeight: 700, color: T.text }}>
                {modalDetail.data.jenis_sppd === "LUAR_DAERAH" ? "Perjalanan Dinas Luar Daerah" : "Perjalanan Dinas Dalam Daerah"}
              </div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor SPT:</div>
              <div style={{ fontWeight: 700, color: T.text }}>{modalDetail.data.nomor_spt || modalDetail.data.nomor_register}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor SPPD:</div>
              <div style={{ fontWeight: 700, color: T.text }}>{modalDetail.data.nomor_sppd || modalDetail.data.nomor_register}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Pelaksana Utama:</div>
              <div>
                <span style={{ fontWeight: 700, color: T.text }}>{modalDetail.data.pelaksana_nama}</span>
                <span style={{ fontSize: 12, color: T.textSecondary, marginLeft: 6 }}>
                  (NIP: {modalDetail.data.pelaksana_nip})
                </span>
                {modalDetail.data.pelaksana_jabatan && (
                  <div style={{ fontSize: 12, color: T.textMuted }}>{modalDetail.data.pelaksana_jabatan} • {modalDetail.data.pelaksana_pangkat}</div>
                )}
              </div>

              {(() => {
                let listP = [];
                try { listP = Array.isArray(modalDetail.data.pengikut) ? modalDetail.data.pengikut : JSON.parse(modalDetail.data.pengikut || "[]"); } catch (_) {}
                if (!listP.length) return null;
                return (
                  <>
                    <div style={{ color: T.textSecondary, fontWeight: 600 }}>Personil Tambahan:</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {listP.map((p, idx) => (
                        <div key={idx} style={{ fontSize: 12.5, color: T.text }}>
                          <b>{idx + 2}. {p.nama}</b> {p.nip ? `(NIP: ${p.nip})` : ""}
                          {(p.jabatan || p.pangkat) && (
                            <div style={{ fontSize: 11.5, color: T.textMuted }}>{p.jabatan}{p.pangkat ? ` • ${p.pangkat}` : ""}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Dasar Hukum SPT:</div>
              <div style={{ color: T.text, fontSize: 12.5, whiteSpace: "pre-line", lineHeight: 1.45 }}>
                {modalDetail.data.dasar_hukum || `DPA Bapperida Kabupaten Sumba Barat TA ${modalDetail.data.tahun || tahun}`}
              </div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Maksud Perjalanan:</div>
              <div style={{ color: T.text, lineHeight: 1.5 }}>{modalDetail.data.maksud_perjalanan}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Rute & Destinasi:</div>
              <div style={{ color: T.text, fontWeight: 600 }}>
                {modalDetail.data.tempat_berangkat || "Waikabubak"} ke {modalDetail.data.tempat_tujuan}
                {modalDetail.data.provinsi_tujuan && ` (Prov. ${modalDetail.data.provinsi_tujuan})`}
              </div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Alat Angkutan:</div>
              <div style={{ color: T.text }}>{modalDetail.data.alat_angkutan}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Waktu Pelaksanaan:</div>
              <div style={{ color: T.text }}>
                {modalDetail.data.tanggal_berangkat ? modalDetail.data.tanggal_berangkat.split("T")[0] : "—"} s/d {modalDetail.data.tanggal_kembali ? modalDetail.data.tanggal_kembali.split("T")[0] : "—"}
                <span style={{ marginLeft: 8, fontWeight: 700, color: T.warning }}>({modalDetail.data.lama_hari || 1} Hari)</span>
              </div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Subkegiatan:</div>
              <div style={{ color: T.text, fontSize: 12.5 }}>{modalDetail.data.subkegiatan_nama || "BAPPERIDA"}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Tingkat Biaya:</div>
              <div style={{ color: T.text }}>{modalDetail.data.tingkat_biaya || (modalDetail.data.jenis_sppd === "LUAR_DAERAH" ? "Tingkat B" : "Tingkat C")}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Penetapan Surat:</div>
              <div style={{ color: T.text }}>
                {modalDetail.data.ditetapkan_di || modalDetail.data.tempat_berangkat || "Waikabubak"}, {modalDetail.data.tanggal_spt ? modalDetail.data.tanggal_spt.split("T")[0] : (modalDetail.data.tanggal_berangkat ? modalDetail.data.tanggal_berangkat.split("T")[0] : "—")}
              </div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Pejabat Perintah:</div>
              <div style={{ color: T.text }}>{modalDetail.data.pejabat_perintah || "Kepala BAPPERIDA"}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Status:</div>
              <div>{renderStatusBadge(modalDetail.data.status)}</div>
            </div>

            {/* Berkas Tautan */}
            <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: T.bg, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 6 }}>BERKAS DIGITAL</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {modalDetail.data.file_spt_url && (
                  <a href={modalDetail.data.file_spt_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.primary, textDecoration: "none", fontWeight: 600 }}>
                    <Icon name="link" size={13} /> Naskah SPT
                  </a>
                )}
                {modalDetail.data.file_sppd_url && (
                  <a href={modalDetail.data.file_sppd_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.primary, textDecoration: "none", fontWeight: 600 }}>
                    <Icon name="link" size={13} /> Naskah SPPD
                  </a>
                )}
                {modalDetail.data.file_lhp_url && (
                  <a href={modalDetail.data.file_lhp_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.success, textDecoration: "none", fontWeight: 600 }}>
                    <Icon name="checkCircle" size={13} /> Laporan Hasil (LHP)
                  </a>
                )}
                {!modalDetail.data.file_spt_url && !modalDetail.data.file_sppd_url && !modalDetail.data.file_lhp_url && (
                  <span style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>Belum ada berkas digital terunggah.</span>
                )}
              </div>
            </div>

            {/* Generator Naskah Dinas Otomatis (.docx & .pdf) */}
            <div style={{ marginTop: 8, padding: "14px 16px", borderRadius: 10, background: isDark ? "rgba(37,99,235,0.08)" : "#EFF6FF", border: `1px solid ${isDark ? "#2563EB" : "#BFDBFE"}` }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.primary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="download" size={14} />
                <span>Cetak / Unduh Dokumen Resmi Otomatis (Word & PDF)</span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* SPT Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: T.card, padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Surat Perintah Tugas (SPT)</div>
                    <div style={{ fontSize: 11, color: T.textSecondary }}>No. {modalDetail.data.nomor_spt || modalDetail.data.nomor_register}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => { const d = modalDetail.data; setModalDetail(null); bukaPratinjau(d, "spt", 0); }}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: T.primary, color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon name="eye" size={12} />
                      <span>Pratinjau & Unduh SPT</span>
                    </button>
                  </div>
                </div>

                {/* SPPD Utama Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: T.card, padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>SPPD (Semua Personil)</div>
                    <div style={{ fontSize: 11, color: T.textSecondary }}>{modalDetail.data.pelaksana_nama}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => { const d = modalDetail.data; setModalDetail(null); bukaPratinjau(d, "sppd", 0); }}
                      style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon name="eye" size={12} />
                      <span>Pratinjau & Unduh SPPD</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setModalDetail(null)}
                style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: KONFIRMASI HAPUS (ADMIN ONLY) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalHapus && (
        <Modal
          title="Hapus Register SPPD"
          subtitle="Tindakan ini memerlukan hak akses Administrator"
          icon="trash"
          onClose={() => setModalHapus(null)}
          maxWidth={460}
        >
          <div style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: 13, color: T.text, lineHeight: 1.5, margin: "0 0 16px" }}>
              Apakah Anda yakin ingin menghapus data register SPPD <strong>{modalHapus.data.nomor_register}</strong> ({modalHapus.data.pelaksana_nama})?
            </p>
            <div style={{ background: T.bg, padding: 12, borderRadius: 8, fontSize: 12, color: T.textSecondary, marginBottom: 16 }}>
              Seluruh riwayat perjalanan dinas dan lampiran SPJ terkait data ini akan dihapus secara permanen dari basis data.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalHapus(null)}
                style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 12.5 }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={konfirmasiHapusSppd}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.danger, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
              >
                {submitting ? "Menghapus..." : "Hapus Permanen"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 5: CETAK & UNDUH DOKUMEN RESMI (.DOCX & .PDF) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalCetak && (
        <Modal
          title="Cetak & Unduh Dokumen Resmi"
          subtitle={`Format dokumen Word (.docx) dan PDF (.pdf) untuk ${modalCetak.item.nomor_register}`}
          icon="download"
          onClose={() => setModalCetak(null)}
          maxWidth={600}
        >
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Box Surat Tugas (SPT) */}
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>
                  Surat Perintah Tugas (SPT)
                </div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                  Nomor: <b>{modalCetak.item.nomor_spt || modalCetak.item.nomor_register}</b> · Ditetapkan oleh: {modalCetak.item.pejabat_perintah || "Kepala BAPPERIDA"}
                </div>
                <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>
                  Personil: 1 pelaksana utama {modalCetak.item.pengikut?.length ? `+ ${modalCetak.item.pengikut.length} orang pengikut` : "(perorangan)"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={isGeneratingDocx}
                  onClick={() => unduhSPT(modalCetak.item)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 7,
                    border: "none",
                    background: T.primary,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isGeneratingDocx ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: isGeneratingDocx ? 0.7 : 1,
                  }}
                >
                  <Icon name="file" size={13} />
                  <span>Unduh Word (.docx)</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingDocx}
                  onClick={() => unduhSPTPdf(modalCetak.item)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 7,
                    border: "none",
                    background: "#DC2626",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isGeneratingDocx ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: isGeneratingDocx ? 0.7 : 1,
                  }}
                >
                  <Icon name="download" size={13} />
                  <span>Unduh PDF (.pdf)</span>
                </button>
                <button
                  type="button"
                  onClick={() => cetakSPT(modalCetak.item)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 7,
                    border: `1px solid ${T.border}`,
                    background: T.card,
                    color: T.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon name="externalLink" size={13} />
                  <span>Pratinjau / Cetak</span>
                </button>
              </div>
            </div>

            {/* Box SPPD Pelaksana Utama */}
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>
                  SPPD (Pelaksana Utama)
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.primary, marginTop: 2 }}>
                  {modalCetak.item.pelaksana_nama}
                </div>
                <div style={{ fontSize: 11.5, color: T.textSecondary, marginTop: 2 }}>
                  NIP: {modalCetak.item.pelaksana_nip || "—"} · {modalCetak.item.pelaksana_jabatan || "Staf"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={isGeneratingDocx}
                  onClick={() => unduhSPPD(modalCetak.item, null)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 7,
                    border: "none",
                    background: "#059669",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isGeneratingDocx ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: isGeneratingDocx ? 0.7 : 1,
                  }}
                >
                  <Icon name="file" size={13} />
                  <span>Unduh Word (.docx)</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingDocx}
                  onClick={() => unduhSPPDPdf(modalCetak.item, null)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 7,
                    border: "none",
                    background: "#DC2626",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isGeneratingDocx ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: isGeneratingDocx ? 0.7 : 1,
                  }}
                >
                  <Icon name="download" size={13} />
                  <span>Unduh PDF (.pdf)</span>
                </button>
                <button
                  type="button"
                  onClick={() => cetakSPPD(modalCetak.item, null)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 7,
                    border: `1px solid ${T.border}`,
                    background: T.card,
                    color: T.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon name="externalLink" size={13} />
                  <span>Pratinjau / Cetak</span>
                </button>
              </div>
            </div>

            {/* Box Pengikut jika ada */}
            {(() => {
              let listP = [];
              try {
                listP = Array.isArray(modalCetak.item.pengikut)
                  ? modalCetak.item.pengikut
                  : JSON.parse(modalCetak.item.pengikut || "[]");
              } catch (_) {}
              if (!listP || listP.length === 0) return null;

              return (
                <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>
                    SPPD Pegawai Pengikut ({listP.length} orang)
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {listP.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          background: T.card,
                          borderRadius: 8,
                          border: `1px solid ${T.border}`,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{p.nama || `Pengikut #${idx + 1}`}</div>
                          <div style={{ fontSize: 11.5, color: T.textSecondary }}>NIP: {p.nip || "—"} · {p.jabatan || "-"}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            disabled={isGeneratingDocx}
                            onClick={() => unduhSPPD(modalCetak.item, p)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "none",
                              background: "#059669",
                              color: "#fff",
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: isGeneratingDocx ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Icon name="file" size={11} />
                            <span>Word</span>
                          </button>
                          <button
                            type="button"
                            disabled={isGeneratingDocx}
                            onClick={() => unduhSPPDPdf(modalCetak.item, p)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "none",
                              background: "#DC2626",
                              color: "#fff",
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: isGeneratingDocx ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Icon name="download" size={11} />
                            <span>PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cetakSPPD(modalCetak.item, p)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: T.bg,
                              color: T.text,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Icon name="externalLink" size={11} />
                            <span>Cetak</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setModalCetak(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: T.card,
                  color: T.text,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: PENGATURAN WEWENANG */}
      {modalWewenang && (
        <ModalPengaturanWewenang
          onClose={() => setModalWewenang(false)}
          pegawaiList={pegawaiList}
          showToast={showToast}
          onSaved={(data) => {
            if (data) setWewenangConfig(data);
            notif("Wewenang diperbarui. Dokumen berikutnya akan menggunakan konfigurasi baru.");
          }}
        />
      )}

      {/* MODAL: PRATINJAU DOKUMEN */}
      {modalPratinjau && (
        <ModalPratinjauDokumen
          item={modalPratinjau.item}
          defaultTab={modalPratinjau.defaultTab || "spt"}
          defaultPersonIdx={modalPratinjau.defaultPersonIdx || 0}
          onClose={() => setModalPratinjau(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
