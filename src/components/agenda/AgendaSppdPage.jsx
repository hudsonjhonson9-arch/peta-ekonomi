import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../../App.jsx";
import { useIsDark, Icon, Modal, Select, Button, DatePicker } from "../ui.jsx";
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

  useEffect(() => {
    fetch("/api/agenda/pegawai-list")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setPegawaiList(j.items || []); })
      .catch(() => {});
  }, []);


  const notif = (msg) => {
    if (showToast) showToast(msg);
    else alert(msg);
  };

  const unduhSPT = async (it) => {
    setIsGeneratingDocx(true);
    try {
      notif("Menyiapkan dokumen Surat Perintah Tugas (SPT .docx)...");
      await unduhSuratTugasDocx(it);
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
      const namaTarget = person?.nama || it.pelaksana_nama || "Pelaksana";
      notif(`Menyiapkan lembar SPPD untuk ${namaTarget} (.docx)...`);
      await unduhSppdDocx(it, person);
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
      await unduhSuratTugasPdf(it);
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
      const namaTarget = person?.nama || it.pelaksana_nama || "Pelaksana";
      notif(`Menyiapkan lembar SPPD untuk ${namaTarget} (.pdf)...`);
      await unduhSppdPdf(it, person);
      notif(`SPPD untuk ${namaTarget} berhasil diunduh (.pdf)!`);
    } catch (err) {
      notif("Gagal membuat PDF SPPD: " + (err?.message || err));
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  const cetakSPT = (it) => {
    cetakSuratTugasWindow(it);
  };

  const cetakSPPD = (it, person = null) => {
    cetakSppdWindow(it, person);
  };

  const unduhZipBundle = async (it) => {
    setIsGeneratingDocx(true);
    try {
      notif("Menyiapkan paket ZIP (SPT + semua SPPD)…");
      await unduhBundleSppdZip(it);
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

  // ── Pratinjau Nomor Register SPPD ─────────────────────────────────────────
  const fetchPreviewRegister = async (targetJenis) => {
    try {
      const res = await fetch(`/api/agenda/sppd/preview-nomor?tahun=${tahun}&jenis=${targetJenis || jenis}`);
      const data = await res.json();
      if (data.ok) return data.nomor_register;
    } catch (_) {}
    return targetJenis === "LUAR_DAERAH" ? "001/SPPD-LD/2026" : "001/SPPD-DD/2026";
  };

  // ── Tambah / Ambil Nomor SPPD (Staff & Admin) ────────────────────────────
  const bukaAmbilNomorSppd = async (presetJenis) => {
    const selectedJenis = presetJenis || jenis;
    const preview = await fetchPreviewRegister(selectedJenis);

    setModalSppd({
      mode: "tambah",
      previewNomor: preview,
      data: {
        jenis_sppd: selectedJenis,
        nomor_spt: preview,
        nomor_sppd: preview,
        tanggal_spt: new Date().toISOString().split("T")[0],
        pejabat_perintah: "Kepala BAPPERIDA",
        pelaksana_nip: user?.nip || "",
        pelaksana_nama: user?.name || "",
        pelaksana_pangkat: "",
        pelaksana_jabatan: "",
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

    setModalSppd({
      mode: "edit",
      previewNomor: it.nomor_register,
      data: {
        id: it.id,
        jenis_sppd: it.jenis_sppd,
        nomor_register: it.nomor_register,
        nomor_spt: it.nomor_spt || it.nomor_register,
        nomor_sppd: it.nomor_sppd || it.nomor_register,
        tanggal_spt: it.tanggal_spt ? it.tanggal_spt.split("T")[0] : "",
        pejabat_perintah: it.pejabat_perintah || "Kepala BAPPERIDA",
        pelaksana_nip: it.pelaksana_nip || "",
        pelaksana_nama: it.pelaksana_nama || "",
        pelaksana_pangkat: it.pelaksana_pangkat || "",
        pelaksana_jabatan: it.pelaksana_jabatan || "",
        pengikut: parsedPengikut,
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

    setSubmitting(true);
    try {
      const url = mode === "tambah" ? "/api/agenda/sppd" : `/api/agenda/sppd/${data.id}`;
      const method = mode === "tambah" ? "POST" : "PUT";
      const payload = { ...data, tahun };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();
      if (!resJson.ok) throw new Error(resJson.message || "Gagal menyimpan register SPPD");

      notif(mode === "tambah" ? `Nomor Register SPPD berhasil diambil: ${resJson.item?.nomor_register || ""}` : "Data SPPD berhasil diperbarui!");
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
  const bukaModalSpj = (it) => {
    let parsedSpj = [];
    try {
      parsedSpj = Array.isArray(it.berkas_spj) ? it.berkas_spj : JSON.parse(it.berkas_spj || "[]");
    } catch (_) {}

    setModalSpj({
      sppd: it,
      file_lhp_url: it.file_lhp_url || "",
      file_spt_url: it.file_spt_url || "",
      file_sppd_url: it.file_sppd_url || "",
      berkas_spj: parsedSpj,
      status: it.status || "Pengajuan",
      baruNama: "",
      baruUrl: ""
    });
  };

  const simpanBerkasSpj = async (e) => {
    e.preventDefault();
    const { sppd, file_lhp_url, file_spt_url, file_sppd_url, berkas_spj, status } = modalSpj;
    setSubmitting(true);
    try {
      // Update LHP & berkas utama
      const res1 = await fetch(`/api/agenda/sppd/${sppd.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_lhp_url,
          file_spt_url,
          file_sppd_url,
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
    setModalSppd({
      ...modalSppd,
      data: {
        ...modalSppd.data,
        pengikut: [...cur, { nama: "", nip: "", pangkat: "", jabatan: "" }]
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
                        {/* Tombol Pratinjau Dokumen */}
                        <button
                          type="button"
                          title="Pratinjau & Cetak SPT / SPPD"
                          onClick={() => setModalPratinjau({ item: it })}
                          style={{
                            height: 28,
                            padding: "0 9px",
                            borderRadius: 6,
                            border: `1px solid ${isDark ? "rgba(16,185,129,0.4)" : "#A7F3D0"}`,
                            background: isDark ? "rgba(5,150,105,0.15)" : "#ECFDF5",
                            color: isDark ? "#34D399" : "#059669",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            transition: "all 0.15s ease"
                          }}
                        >
                          <Icon name="eye" size={12} />
                          <span>Pratinjau</span>
                        </button>

                        {/* Tombol Cetak / Unduh Dokumen Resmi */}
                        <button
                          type="button"
                          title="Cetak & Unduh Surat Tugas (SPT) dan SPPD (.docx)"
                          onClick={() => setModalCetak({ item: it })}
                          style={{
                            height: 28,
                            padding: "0 9px",
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
                          <span>Cetak</span>
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
          maxWidth={680}
        >
          <form onSubmit={simpanSppd} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Live Register Number Banner */}
            <div style={{ background: isDark ? "#172337" : "#EFF6FF", border: `1px solid ${isDark ? "#2563EB" : "#BFDBFE"}`, padding: "12px 16px", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>NOMOR REGISTER RESMI</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: T.text, marginTop: 2 }}>
                    {modalSppd.previewNomor}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextJ = "DALAM_DAERAH";
                      const p = await fetchPreviewRegister(nextJ);
                      setModalSppd({
                        ...modalSppd,
                        previewNomor: modalSppd.mode === "tambah" ? p : modalSppd.previewNomor,
                        data: {
                          ...modalSppd.data,
                          jenis_sppd: nextJ,
                          tempat_tujuan: "",
                          provinsi_tujuan: "",
                          alat_angkutan: "Kendaraan Dinas Roda 4"
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
                      setModalSppd({
                        ...modalSppd,
                        previewNomor: modalSppd.mode === "tambah" ? p : modalSppd.previewNomor,
                        data: {
                          ...modalSppd.data,
                          jenis_sppd: nextJ,
                          tempat_tujuan: "Kupang",
                          provinsi_tujuan: "Nusa Tenggara Timur",
                          alat_angkutan: "Pesawat Udara (Ekonomi)"
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
              </div>
            </div>

            {/* Pelaksana Utama */}
            <datalist id="daftar-pegawai">
              {pegawaiList.map((p) => <option key={p.id} value={p.nama}>{p.nip} · {p.jabatan}</option>)}
            </datalist>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", background: T.bg }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 10 }}>1. Personil 1 (Pelaksana Utama)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ketik nama — pilih dari saran pegawai atau isi manual"
                    list="daftar-pegawai"
                    value={modalSppd.data.pelaksana_nama}
                    onChange={(e) => {
                      const v = e.target.value;
                      const p = pegawaiList.find((x) => x.nama === v);
                      setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_nama: v, ...(p ? { pelaksana_nip: p.nip || "", pelaksana_pangkat: p.pangkat || "", pelaksana_jabatan: p.jabatan || "" } : {}) } });
                    }}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>NIP Pegawai *</label>
                  <input
                    type="text"
                    required
                    placeholder="19800101 200501 1 001"
                    value={modalSppd.data.pelaksana_nip}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_nip: e.target.value } })}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Pangkat / Golongan</label>
                  <input
                    type="text"
                    placeholder="Pembina, IV/a"
                    value={modalSppd.data.pelaksana_pangkat}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_pangkat: e.target.value } })}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Jabatan</label>
                  <input
                    type="text"
                    placeholder="Perencana Ahli Muda / Staf"
                    value={modalSppd.data.pelaksana_jabatan}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pelaksana_jabatan: e.target.value } })}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5 }}
                  />
                </div>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Tempat Berangkat</label>
                  <input
                    type="text"
                    value={modalSppd.data.tempat_berangkat}
                    onChange={(e) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, tempat_berangkat: e.target.value } })}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5 }}
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
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12.5 }}
                  />
                </div>

                {modalSppd.data.jenis_sppd === "LUAR_DAERAH" ? (
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
                ) : (
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>Alat Angkutan</label>
                    <Select
                      fullWidth
                      size="sm"
                      value={modalSppd.data.alat_angkutan}
                      onChange={(v) => setModalSppd({ ...modalSppd, data: { ...modalSppd.data, alat_angkutan: v } })}
                      options={ANGKUTAN_LIST.map((a) => ({ value: a, label: a }))}
                    />
                  </div>
                )}
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
            </div>

            {/* Pengikut (Dinas Bersama) */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", background: T.bg }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>4. Personil Tambahan / Anggota Tim ({modalSppd.data.pengikut?.length || 0})</div>
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

              {(!modalSppd.data.pengikut || modalSppd.data.pengikut.length === 0) ? (
                <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>
                  Belum ada personil tambahan. Surat Tugas hanya untuk Personil 1.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {modalSppd.data.pengikut.map((p, idx) => (
                    <div key={idx} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: 8, background: T.card, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, whiteSpace: "nowrap", flex: 1 }}>Personil {idx + 2}</span>
                        <button
                          type="button"
                          aria-label={`Hapus personil ${idx + 2}`}
                          onClick={() => hapusPengikut(idx)}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "none", background: T.dangerBg || "#FEF2F2", color: T.danger, cursor: "pointer" }}
                        >
                          <Icon name="x" size={13} />
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6 }}>
                        {[["nama", "Nama lengkap"], ["nip", "NIP"], ["pangkat", "Pangkat / Golongan"], ["jabatan", "Jabatan"]].map(([f, ph]) => (
                          <input
                            key={f}
                            type="text"
                            placeholder={f === "nama" ? "Ketik nama — saran pegawai / manual" : ph}
                            list={f === "nama" ? "daftar-pegawai" : undefined}
                            value={p[f] || ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              const pg = f === "nama" && pegawaiList.find((x) => x.nama === v);
                              if (pg) {
                                const cur = [...modalSppd.data.pengikut];
                                cur[idx] = { nama: pg.nama, nip: pg.nip || "", pangkat: pg.pangkat || "", jabatan: pg.jabatan || "" };
                                setModalSppd({ ...modalSppd, data: { ...modalSppd.data, pengikut: cur } });
                              } else updatePengikut(idx, f, v);
                            }}
                            style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 12 }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
          onClose={() => setModalSpj(null)}
          maxWidth={620}
        >
          <form onSubmit={simpanBerkasSpj} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: isDark ? "#172337" : "#F1F5F9", padding: "10px 14px", borderRadius: 8, borderLeft: `4px solid ${T.success}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary }}>PERJALANAN DINAS</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 2 }}>{modalSpj.sppd.maksud_perjalanan}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                Tujuan: {modalSpj.sppd.tempat_tujuan} • Durasi: {modalSpj.sppd.lama_hari || 1} Hari Dinas
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Tautan Berkas LHP (Laporan Hasil Perjalanan Dinas - PDF) *
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/.../lhp.pdf"
                value={modalSpj.file_lhp_url}
                onChange={(e) => setModalSpj({ ...modalSpj, file_lhp_url: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tautan File SPT Resmi Bertandatangan
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/.../spt.pdf"
                  value={modalSpj.file_spt_url}
                  onChange={(e) => setModalSpj({ ...modalSpj, file_spt_url: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tautan File SPPD Bertandatangan & Cap
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/.../sppd.pdf"
                  value={modalSpj.file_sppd_url}
                  onChange={(e) => setModalSpj({ ...modalSpj, file_sppd_url: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            {/* Lampiran Bukti Kwitansi / Tiket / Hotel */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", background: T.bg }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 8 }}>
                Daftar Lampiran Bukti SPJ (Tiket, Hotel, Boarding Pass, Dokumentasi):
              </div>

              {modalSpj.berkas_spj.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {modalSpj.berkas_spj.map((b, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.card, padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.border}` }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{b.nama || "Bukti SPJ"}</div>
                        <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.primary, textDecoration: "none" }}>
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

              {/* Form Tambah Bukti */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Mis. Tiket Pesawat Kupang-Tambolaka"
                  value={modalSpj.baruNama}
                  onChange={(e) => setModalSpj({ ...modalSpj, baruNama: e.target.value })}
                  style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                />
                <input
                  type="url"
                  placeholder="https://drive.google.com/.../tiket.pdf"
                  value={modalSpj.baruUrl}
                  onChange={(e) => setModalSpj({ ...modalSpj, baruUrl: e.target.value })}
                  style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, color: T.text, fontSize: 12 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!modalSpj.baruNama || !modalSpj.baruUrl) {
                      notif("Isi nama dan URL bukti dokumen!");
                      return;
                    }
                    const next = [...modalSpj.berkas_spj, { nama: modalSpj.baruNama, url: modalSpj.baruUrl }];
                    setModalSpj({ ...modalSpj, berkas_spj: next, baruNama: "", baruUrl: "" });
                  }}
                  style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  + Tambah
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
                onClick={() => setModalSpj(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.success, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.7 : 1 }}
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
                {modalDetail.data.jenis_sppd === "LUAR_DAERAH" ? "✈️ Perjalanan Dinas Luar Daerah" : "📍 Perjalanan Dinas Dalam Daerah"}
              </div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor SPT:</div>
              <div style={{ fontWeight: 700, color: T.text }}>{modalDetail.data.nomor_spt}</div>

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

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Maksud Perjalanan:</div>
              <div style={{ color: T.text, lineHeight: 1.5 }}>{modalDetail.data.maksud_perjalanan}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Rute & Destinasi:</div>
              <div style={{ color: T.text, fontWeight: 600 }}>
                {modalDetail.data.tempat_berangkat || "Waikabubak"} ➔ {modalDetail.data.tempat_tujuan}
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
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      disabled={isGeneratingDocx}
                      onClick={() => unduhSPT(modalDetail.data)}
                      style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: T.primary, color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: isGeneratingDocx ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon name="file" size={12} />
                      <span>Word (.docx)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingDocx}
                      onClick={() => unduhSPTPdf(modalDetail.data)}
                      style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#DC2626", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: isGeneratingDocx ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon name="download" size={12} />
                      <span>PDF (.pdf)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cetakSPT(modalDetail.data)}
                      style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon name="externalLink" size={12} />
                      <span>Cetak</span>
                    </button>
                  </div>
                </div>

                {/* SPPD Utama Actions */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, background: T.card, padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>SPPD (Pelaksana Utama)</div>
                    <div style={{ fontSize: 11, color: T.textSecondary }}>{modalDetail.data.pelaksana_nama}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      disabled={isGeneratingDocx}
                      onClick={() => unduhSPPD(modalDetail.data, null)}
                      style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: isGeneratingDocx ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon name="file" size={12} />
                      <span>Word (.docx)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingDocx}
                      onClick={() => unduhSPPDPdf(modalDetail.data, null)}
                      style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#DC2626", color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: isGeneratingDocx ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon name="download" size={12} />
                      <span>PDF (.pdf)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cetakSPPD(modalDetail.data, null)}
                      style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon name="externalLink" size={12} />
                      <span>Cetak</span>
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
            notif("Wewenang diperbarui. Dokumen berikutnya akan menggunakan konfigurasi baru.");
          }}
        />
      )}

      {/* MODAL: PRATINJAU DOKUMEN */}
      {modalPratinjau && (
        <ModalPratinjauDokumen
          item={modalPratinjau.item}
          onClose={() => setModalPratinjau(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
