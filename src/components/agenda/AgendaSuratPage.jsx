import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../../App.jsx";
import { useIsDark, Icon, Modal, Select, Button } from "../ui.jsx";
import useResponsive from "../../useResponsive.js";

const KODE_KLASIFIKASI_LIST = [
  { kode: "050", label: "050 - Perencanaan Pembangunan Daerah" },
  { kode: "005", label: "005 - Undangan & Rapat Dinas" },
  { kode: "900", label: "900 - Pengelolaan Keuangan & Anggaran" },
  { kode: "800", label: "800 - Kepegawaian & SDM Aparatur" },
  { kode: "020", label: "020 - Peralatan & Perlengkapan Kantor" },
  { kode: "060", label: "060 - Organisasi & Tata Laksana" },
  { kode: "045", label: "045 - Hukum, Perjanjian & Regulasi" },
];

const BIDANG_LIST = [
  "Sekretariat",
  "Bidang Perekonomian & SDA",
  "Bidang Pembangunan Manusia & Masyarakat (PMM)",
  "Bidang Infrastruktur & Kewilayahan (IPW)",
  "Bidang Perencanaan, Pengendalian & Evaluasi (P2E)",
  "Subbagian Umum & Kepegawaian",
  "Subbagian Perencanaan & Keuangan"
];

const PENANDATANGAN_LIST = [
  "Kepala BAPPERIDA",
  "Sekretaris BAPPERIDA",
  "Plt. Kepala BAPPERIDA",
  "Kepala Bidang Perekonomian & SDA",
  "Kepala Bidang PMM",
  "Kepala Bidang IPW",
  "Kepala Bidang P2E"
];

const ARAHAN_OPTIONS = [
  "Tindak lanjuti sesuai ketentuan",
  "Hadiri / Wakili rapat dinas",
  "Pelajari & berikan telaahan / saran",
  "Siapkan bahan / draf surat balasan",
  "Koordinasikan dengan bidang terkait",
  "Untuk diketahui & dipedomani",
  "Arsipkan & catat dalam agenda"
];

const DITERUSKAN_OPTIONS = [
  "Sekretaris BAPPERIDA",
  "Bidang Perekonomian & SDA",
  "Bidang Pembangunan Manusia & Masyarakat (PMM)",
  "Bidang Infrastruktur & Kewilayahan (IPW)",
  "Bidang Perencanaan, Pengendalian & Evaluasi (P2E)",
  "Subbagian Umum & Kepegawaian",
  "Subbagian Perencanaan & Keuangan",
  "Pejabat Fungsional / Staf Teknis"
];

export default function AgendaSuratPage({ user, showToast }) {
  const { T } = useContext(ThemeContext);
  const isDark = useIsDark();
  const { isMobile } = useResponsive();

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const r = (user.role || "").toLowerCase();
    return r === "admin";
  }, [user]);

  const [tab, setTab] = useState("masuk"); // "masuk" | "keluar"
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [sifatFilter, setSifatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [itemsMasuk, setItemsMasuk] = useState([]);
  const [itemsKeluar, setItemsKeluar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modals
  const [modalMasuk, setModalMasuk] = useState(null); // { mode: 'tambah'|'edit', data }
  const [modalKeluar, setModalKeluar] = useState(null); // { mode: 'tambah'|'edit', data, previewNomor }
  const [modalDisposisi, setModalDisposisi] = useState(null); // { surat, form, loading }
  const [modalDetail, setModalDetail] = useState(null); // { jenis: 'masuk'|'keluar', data }
  const [modalHapus, setModalHapus] = useState(null); // { jenis: 'masuk'|'keluar', data }
  const [submitting, setSubmitting] = useState(false);

  const notif = (msg) => {
    if (showToast) showToast(msg);
    else alert(msg);
  };

  useEffect(() => {
    fetchData();
  }, [tab, tahun]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = search ? `&q=${encodeURIComponent(search)}` : "";
      if (statusFilter) q += `&status=${encodeURIComponent(statusFilter)}`;

      if (tab === "masuk") {
        const res = await fetch(`/api/agenda/surat-masuk?tahun=${tahun}${q}`);
        const data = await res.json();
        if (data.ok) setItemsMasuk(data.items || []);
        else setError(data.message || "Gagal memuat data surat masuk");
      } else {
        const res = await fetch(`/api/agenda/surat-keluar?tahun=${tahun}${q}`);
        const data = await res.json();
        if (data.ok) setItemsKeluar(data.items || []);
        else setError(data.message || "Gagal memuat data surat keluar");
      }
    } catch (e) {
      setError(e.message || "Kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  // Filtered items (client-side for sifatFilter)
  const filteredMasuk = useMemo(() => {
    return itemsMasuk.filter((it) => {
      if (sifatFilter && it.sifat !== sifatFilter) return false;
      return true;
    });
  }, [itemsMasuk, sifatFilter]);

  const filteredKeluar = useMemo(() => {
    return itemsKeluar.filter((it) => {
      if (sifatFilter && it.sifat !== sifatFilter) return false;
      return true;
    });
  }, [itemsKeluar, sifatFilter]);

  // Metric Stats
  const statMasukTotal = itemsMasuk.length;
  const statMasukDisposisi = itemsMasuk.filter(i => i.status === "Didisposisi").length;
  const statMasukMenunggu = itemsMasuk.filter(i => i.status !== "Didisposisi" && i.status !== "Selesai").length;
  const statKeluarTotal = itemsKeluar.length;
  const statKeluarAktif = itemsKeluar.filter(i => i.status !== "Dibatalkan").length;

  // ── Handlers Surat Masuk ──────────────────────────────────────────────────
  const bukaTambahSuratMasuk = () => {
    setModalMasuk({
      mode: "tambah",
      data: {
        nomor_surat_asli: "",
        tanggal_terima: new Date().toISOString().split("T")[0],
        tanggal_surat: new Date().toISOString().split("T")[0],
        asal_surat: "",
        perihal: "",
        sifat: "Biasa",
        kode_klasifikasi: "050",
        jumlah_lampiran: "1 Berkas",
        file_url: "",
        file_name: ""
      }
    });
  };

  const bukaEditSuratMasuk = (it) => {
    setModalMasuk({
      mode: "edit",
      data: {
        id: it.id,
        nomor_surat_asli: it.nomor_surat_asli || "",
        tanggal_terima: it.tanggal_terima ? it.tanggal_terima.split("T")[0] : "",
        tanggal_surat: it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "",
        asal_surat: it.asal_surat || "",
        perihal: it.perihal || "",
        sifat: it.sifat || "Biasa",
        kode_klasifikasi: it.kode_klasifikasi || "050",
        jumlah_lampiran: it.jumlah_lampiran || "—",
        file_url: it.file_url || "",
        file_name: it.file_name || "",
        status: it.status || "Diterima"
      }
    });
  };

  const simpanSuratMasuk = async (e) => {
    e.preventDefault();
    const { mode, data } = modalMasuk;
    if (!data.nomor_surat_asli || !data.asal_surat || !data.perihal) {
      notif("Nomor surat asli, asal surat, dan perihal wajib diisi!");
      return;
    }
    setSubmitting(true);
    try {
      const url = mode === "tambah" ? "/api/agenda/surat-masuk" : `/api/agenda/surat-masuk/${data.id}`;
      const method = mode === "tambah" ? "POST" : "PUT";
      const payload = { ...data, tahun };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();
      if (!resJson.ok) throw new Error(resJson.message || "Gagal menyimpan surat masuk");

      notif(mode === "tambah" ? "Surat masuk berhasil dicatat ke buku agenda!" : "Surat masuk berhasil diperbarui!");
      setModalMasuk(null);
      fetchData();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Handlers Disposisi ────────────────────────────────────────────────────
  const bukaModalDisposisi = async (surat) => {
    setModalDisposisi({
      surat,
      loading: true,
      form: {
        tanggal_disposisi: new Date().toISOString().split("T")[0],
        pemberi_disposisi: "Kepala BAPPERIDA",
        arahan: [],
        catatan_instruksi: "",
        diteruskan_kepada: [],
        batas_waktu: "",
        status_tindaklanjut: "Didisposisikan"
      }
    });

    try {
      const res = await fetch(`/api/agenda/surat-masuk/${surat.id}/disposisi`);
      const data = await res.json();
      if (data.ok && data.disposisi) {
        const d = data.disposisi;
        setModalDisposisi(prev => ({
          ...prev,
          loading: false,
          form: {
            tanggal_disposisi: d.tanggal_disposisi ? d.tanggal_disposisi.split("T")[0] : new Date().toISOString().split("T")[0],
            pemberi_disposisi: d.pemberi_disposisi || "Kepala BAPPERIDA",
            arahan: Array.isArray(d.arahan) ? d.arahan : (typeof d.arahan === "string" ? JSON.parse(d.arahan || "[]") : []),
            catatan_instruksi: d.catatan_instruksi || "",
            diteruskan_kepada: Array.isArray(d.diteruskan_kepada) ? d.diteruskan_kepada : (typeof d.diteruskan_kepada === "string" ? JSON.parse(d.diteruskan_kepada || "[]") : []),
            batas_waktu: d.batas_waktu ? d.batas_waktu.split("T")[0] : "",
            status_tindaklanjut: d.status_tindaklanjut || "Didisposisikan"
          }
        }));
      } else {
        setModalDisposisi(prev => ({ ...prev, loading: false }));
      }
    } catch (_) {
      setModalDisposisi(prev => ({ ...prev, loading: false }));
    }
  };

  const simpanDisposisi = async (e) => {
    e.preventDefault();
    const { surat, form } = modalDisposisi;
    if (!form.diteruskan_kepada.length && !form.catatan_instruksi) {
      notif("Pilih minimal satu penerima disposisi atau isi catatan instruksi!");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agenda/surat-masuk/${surat.id}/disposisi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Gagal menyimpan lembar disposisi");

      notif("Lembar disposisi surat berhasil disimpan & status diperbarui!");
      setModalDisposisi(null);
      fetchData();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Handlers Surat Keluar ─────────────────────────────────────────────────
  const fetchPreviewNomorKeluar = async (kode) => {
    try {
      const res = await fetch(`/api/agenda/surat-keluar/preview-nomor?tahun=${tahun}&kode=${encodeURIComponent(kode || "050")}`);
      const data = await res.json();
      if (data.ok) return data.nomor_surat;
    } catch (_) {}
    return "050/..../BAPPERIDA/.../2026";
  };

  const bukaTambahSuratKeluar = async () => {
    const preview = await fetchPreviewNomorKeluar("050");
    setModalKeluar({
      mode: "tambah",
      previewNomor: preview,
      data: {
        kode_klasifikasi: "050",
        tanggal_surat: new Date().toISOString().split("T")[0],
        tujuan_surat: "",
        perihal: "",
        sifat: "Biasa",
        bidang_pengonsep: BIDANG_LIST[0],
        penandatangan: "Kepala BAPPERIDA",
        file_draft_url: "",
        file_final_url: "",
        status: "Draf"
      }
    });
  };

  const bukaEditSuratKeluar = (it) => {
    setModalKeluar({
      mode: "edit",
      previewNomor: it.nomor_surat,
      data: {
        id: it.id,
        nomor_surat: it.nomor_surat,
        kode_klasifikasi: it.kode_klasifikasi || "050",
        tanggal_surat: it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "",
        tujuan_surat: it.tujuan_surat || "",
        perihal: it.perihal || "",
        sifat: it.sifat || "Biasa",
        bidang_pengonsep: it.bidang_pengonsep || BIDANG_LIST[0],
        penandatangan: it.penandatangan || "Kepala BAPPERIDA",
        file_draft_url: it.file_draft_url || "",
        file_final_url: it.file_final_url || "",
        status: it.status || "Draf"
      }
    });
  };

  const simpanSuratKeluar = async (e) => {
    e.preventDefault();
    const { mode, data } = modalKeluar;
    if (!data.tujuan_surat || !data.perihal || !data.bidang_pengonsep) {
      notif("Tujuan surat, perihal, dan bidang pengonsep wajib diisi!");
      return;
    }
    setSubmitting(true);
    try {
      const url = mode === "tambah" ? "/api/agenda/surat-keluar" : `/api/agenda/surat-keluar/${data.id}`;
      const method = mode === "tambah" ? "POST" : "PUT";
      const payload = { ...data, tahun };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();
      if (!resJson.ok) throw new Error(resJson.message || "Gagal booking nomor surat keluar");

      notif(mode === "tambah" ? `Nomor surat keluar berhasil dibooking: ${resJson.item?.nomor_surat || ""}` : "Data surat keluar berhasil diperbarui!");
      setModalKeluar(null);
      fetchData();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Hapus / Batalkan (Admin Only) ─────────────────────────────────────────
  const konfirmasiHapus = async (forceDelete = false) => {
    if (!isAdmin) {
      notif("Akses ditolak: Hanya administrator yang dapat menghapus data.");
      return;
    }
    const { jenis, data } = modalHapus;
    setSubmitting(true);
    try {
      let url = "";
      if (jenis === "masuk") {
        url = `/api/agenda/surat-masuk/${data.id}`;
      } else {
        url = `/api/agenda/surat-keluar/${data.id}${forceDelete ? "?force=true" : ""}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      const resJson = await res.json();
      if (!resJson.ok) throw new Error(resJson.message || "Gagal menghapus data");

      notif(resJson.message || "Data berhasil dihapus");
      setModalHapus(null);
      fetchData();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Badge Status Renderer (Anti-slop: crisp, accessible, semantic)
  const renderStatusBadge = (status) => {
    const s = status || "Diterima";
    let bg = isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.15)";
    let col = T.textSecondary;

    if (s === "Didisposisi" || s === "Ditandatangani") {
      bg = isDark ? "rgba(59,130,246,0.18)" : "rgba(37,99,235,0.1)";
      col = T.primary;
    } else if (s === "Selesai" || s === "Terkirim") {
      bg = isDark ? "rgba(16,185,129,0.18)" : "rgba(5,150,105,0.1)";
      col = T.success;
    } else if (s === "Draf" || s === "Menunggu TTD") {
      bg = isDark ? "rgba(245,158,11,0.18)" : "rgba(217,119,6,0.1)";
      col = T.warning;
    } else if (s === "Dibatalkan") {
      bg = isDark ? "rgba(239,68,68,0.18)" : "rgba(220,38,38,0.1)";
      col = T.danger;
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

  const renderSifatBadge = (sifat) => {
    const s = sifat || "Biasa";
    let bg = isDark ? "rgba(148,163,184,0.1)" : "rgba(100,116,139,0.08)";
    let col = T.textSecondary;
    if (s === "Penting") { bg = isDark ? "rgba(245,158,11,0.16)" : "rgba(245,158,11,0.1)"; col = isDark ? "#FBBF24" : "#B45309"; }
    else if (s === "Rahasia") { bg = isDark ? "rgba(239,68,68,0.16)" : "rgba(220,38,38,0.1)"; col = isDark ? "#F87171" : "#B91C1C"; }
    else if (s === "Segera") { bg = isDark ? "rgba(168,85,247,0.16)" : "rgba(147,51,234,0.1)"; col = isDark ? "#C084FC" : "#7E22CE"; }

    return (
      <span style={{
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10.5,
        fontWeight: 600,
        background: bg,
        color: col,
        whiteSpace: "nowrap"
      }}>
        {s}
      </span>
    );
  };

  // Skeleton Loader for tables (Rule 19: Add loading states)
  const renderTableSkeleton = (cols = 7, rows = 5) => {
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
                  width: cIdx === 0 ? "70%" : cIdx === 4 ? "90%" : "60%",
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
            Buku Agenda Surat
          </h2>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>
            Registrasi digital surat masuk, disposisi tindak lanjut pimpinan, dan penomoran surat keluar dinas
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

          {tab === "masuk" ? (
            <Button
              variant="primary"
              icon="plus"
              onClick={bukaTambahSuratMasuk}
            >
              Catat Surat Masuk
            </Button>
          ) : (
            <Button
              variant="primary"
              icon="plus"
              onClick={bukaTambahSuratKeluar}
            >
              Booking Nomor Surat
            </Button>
          )}
        </div>
      </div>

      {/* ── Metric Summary Strip (4 KPI Cards Matching Dashboard) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          gap: isMobile ? 8 : 12,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: `Surat Masuk (${tahun})`,
            value: statMasukTotal,
            hint: "Dokumen registrasi masuk",
            icon: "fileText",
            color: "#2563EB",
          },
          {
            label: "Telah Didisposisi",
            value: statMasukDisposisi,
            hint: "Instruksi tindak lanjut aktif",
            icon: "checkCircle",
            color: "#10B981",
          },
          {
            label: "Menunggu Tindak Lanjut",
            value: statMasukMenunggu,
            hint: "Perlu arahan pimpinan",
            icon: "clock",
            color: "#F59E0B",
          },
          {
            label: "Surat Keluar Terdaftar",
            value: statKeluarAktif,
            hint: "Nomor dinas resmi aktif",
            icon: "externalLink",
            color: "#8B5CF6",
          },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: T.card,
              borderRadius: 12,
              padding: 16,
              border: `1px solid ${T.border}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 90,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 11.5, color: T.textSecondary, fontWeight: 500, lineHeight: 1.3 }}>
                {s.label}
              </div>
              <div
                style={{
                  width: 30,
                  height: 30,
                  background: `${s.color}15`,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={s.icon} size={15} style={{ color: s.color }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>
                {s.value}
              </div>
              {s.hint && (
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{s.hint}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Segmented Capsule Tab Switcher ── */}
      <div
        style={{
          display: "inline-flex",
          background: T.card,
          padding: 4,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          gap: 4,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => { setTab("masuk"); setStatusFilter(""); setSifatFilter(""); }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 14px",
            borderRadius: 7,
            border: "none",
            background: tab === "masuk" ? T.primary : "transparent",
            color: tab === "masuk" ? "#fff" : T.textSecondary,
            fontWeight: tab === "masuk" ? 700 : 500,
            fontSize: 12.5,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="archive" size={14} />
          <span>Buku Surat Masuk & Disposisi</span>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: tab === "masuk" ? "rgba(255,255,255,0.22)" : isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              color: tab === "masuk" ? "#fff" : T.textMuted,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {itemsMasuk.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setTab("keluar"); setStatusFilter(""); setSifatFilter(""); }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 14px",
            borderRadius: 7,
            border: "none",
            background: tab === "keluar" ? T.primary : "transparent",
            color: tab === "keluar" ? "#fff" : T.textSecondary,
            fontWeight: tab === "keluar" ? 700 : 500,
            fontSize: 12.5,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="externalLink" size={14} />
          <span>Buku Surat Keluar & Booking Nomor</span>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: tab === "keluar" ? "rgba(255,255,255,0.22)" : isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              color: tab === "keluar" ? "#fff" : T.textMuted,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {itemsKeluar.length}
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
            placeholder={tab === "masuk" ? "Cari nomor agenda, perihal, atau instansi pengirim..." : "Cari nomor surat, tujuan dinas, atau perihal..."}
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

        {/* Filter Sifat */}
        <div style={{ width: isMobile ? "100%" : 150 }}>
          <Select
            value={sifatFilter}
            onChange={setSifatFilter}
            placeholder="Semua Sifat"
            options={[
              { value: "", label: "Semua Sifat" },
              { value: "Biasa", label: "Biasa" },
              { value: "Penting", label: "Penting" },
              { value: "Rahasia", label: "Rahasia" },
              { value: "Segera", label: "Segera" },
            ]}
            fullWidth
            size="sm"
          />
        </div>

        {/* Filter Status */}
        <div style={{ width: isMobile ? "100%" : 160 }}>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Semua Status"
            options={tab === "masuk" ? [
              { value: "", label: "Semua Status" },
              { value: "Diterima", label: "Diterima" },
              { value: "Didisposisi", label: "Didisposisi" },
              { value: "Selesai", label: "Selesai" },
            ] : [
              { value: "", label: "Semua Status" },
              { value: "Draf", label: "Draf" },
              { value: "Ditandatangani", label: "Ditandatangani" },
              { value: "Terkirim", label: "Terkirim" },
              { value: "Dibatalkan", label: "Dibatalkan" },
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
          {tab === "masuk" ? `${filteredMasuk.length} surat masuk` : `${filteredKeluar.length} surat keluar`}
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
        ) : tab === "masuk" ? (
          /* ═════════ TABEL SURAT MASUK ═════════ */
          filteredMasuk.length === 0 ? (
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
                <Icon name="mail" size={22} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Belum ada catatan surat masuk untuk tahun {tahun}</div>
                <div style={{ fontSize: 12.5, color: T.textSecondary, maxWidth: 440, margin: "4px auto 0", lineHeight: 1.5 }}>
                  Mulai mencatat surat dinas masuk untuk pengelolaan agenda disposisi pimpinan dan arsip digital.
                </div>
              </div>
              <Button
                variant="primary"
                icon="plus"
                onClick={bukaTambahSuratMasuk}
              >
                Catat Surat Masuk Pertama
              </Button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F8FAFC", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 140 }}>No. Agenda</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 110 }}>Tgl. Terima</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em" }}>Asal Instansi</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em" }}>Nomor & Tgl Asli</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 260 }}>Perihal & Sifat</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 130 }}>Status</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "right", minWidth: 150 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMasuk.map((it) => (
                    <tr
                      key={it.id}
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        transition: "background 0.1s ease"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "#1E293B" : "#F8FAFC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "11px 14px", fontFamily: "monospace", fontWeight: 600, color: T.primary, fontVariantNumeric: "tabular-nums" }}>
                        {it.nomor_agenda}
                      </td>
                      <td style={{ padding: "11px 14px", fontVariantNumeric: "tabular-nums", color: T.text }}>
                        {it.tanggal_terima ? it.tanggal_terima.split("T")[0] : "—"}
                      </td>
                      <td style={{ padding: "11px 14px", fontWeight: 600, color: T.text }}>
                        {it.asal_surat}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ fontWeight: 600, color: T.text }}>{it.nomor_surat_asli}</div>
                        <div style={{ fontSize: 11, color: T.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                          {it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "—"}
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ color: T.text, lineHeight: 1.4, marginBottom: 4 }}>{it.perihal}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {renderSifatBadge(it.sifat)}
                          <span style={{ fontSize: 11, color: T.textMuted }}>Kode: {it.kode_klasifikasi || "050"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        {renderStatusBadge(it.status)}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                          {/* Disposisi Button */}
                          <button
                            type="button"
                            title="Lembar Disposisi"
                            onClick={() => bukaModalDisposisi(it)}
                            style={{
                              height: 28,
                              padding: "0 9px",
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: it.status === "Didisposisi" ? (isDark ? "rgba(59,130,246,0.18)" : "rgba(37,99,235,0.08)") : T.bg,
                              color: it.status === "Didisposisi" ? T.primary : T.text,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              transition: "all 0.15s ease"
                            }}
                          >
                            <Icon name="fileText" size={12} />
                            <span>Disposisi</span>
                          </button>

                          {/* Detail Button */}
                          <button
                            type="button"
                            title="Lihat Detail"
                            onClick={() => setModalDetail({ jenis: "masuk", data: it })}
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
                              title="Edit Surat Masuk"
                              onClick={() => bukaEditSuratMasuk(it)}
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
                              title="Hapus Surat Masuk"
                              onClick={() => setModalHapus({ jenis: "masuk", data: it })}
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
          )
        ) : (
          /* ═════════ TABEL SURAT KELUAR ═════════ */
          filteredKeluar.length === 0 ? (
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
                background: isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF",
                color: "#8B5CF6",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Icon name="externalLink" size={22} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Belum ada register surat keluar untuk tahun {tahun}</div>
                <div style={{ fontSize: 12.5, color: T.textSecondary, maxWidth: 440, margin: "4px auto 0", lineHeight: 1.5 }}>
                  Pesan nomor urut surat keluar resmi untuk menjamin integritas tata naskah dinas.
                </div>
              </div>
              <Button
                variant="primary"
                icon="plus"
                onClick={bukaTambahSuratKeluar}
              >
                Booking Nomor Pertama
              </Button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F8FAFC", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 80 }}>No. Urut</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 200 }}>Nomor Surat Dinas</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 110 }}>Tanggal</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em" }}>Tujuan Surat</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 240 }}>Perihal & Bidang</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 120 }}>Status</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "right", minWidth: 140 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeluar.map((it) => (
                    <tr
                      key={it.id}
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        transition: "background 0.1s ease",
                        opacity: it.status === "Dibatalkan" ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "#1E293B" : "#F8FAFC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "11px 14px", fontFamily: "monospace", fontWeight: 600, color: T.primary, fontVariantNumeric: "tabular-nums" }}>
                        {String(it.nomor_urut || 1).padStart(4, "0")}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ fontFamily: "monospace", fontWeight: 600, color: T.text, fontSize: 13, textDecoration: it.status === "Dibatalkan" ? "line-through" : "none" }}>
                          {it.nomor_surat}
                        </div>
                        <div style={{ fontSize: 11, color: T.textSecondary }}>
                          Reg: {it.nomor_agenda || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px", fontVariantNumeric: "tabular-nums", color: T.text }}>
                        {it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "—"}
                      </td>
                      <td style={{ padding: "11px 14px", fontWeight: 600, color: T.text }}>
                        {it.tujuan_surat}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ color: T.text, lineHeight: 1.4, marginBottom: 4 }}>{it.perihal}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: T.textSecondary, fontWeight: 600 }}>{it.bidang_pengonsep}</span>
                          <span style={{ fontSize: 11, color: T.textMuted }}>• TTD: {it.penandatangan || "Kepala Badan"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        {renderStatusBadge(it.status)}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                          {/* Detail Button */}
                          <button
                            type="button"
                            title="Lihat Detail"
                            onClick={() => setModalDetail({ jenis: "keluar", data: it })}
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
                              title="Edit Surat Keluar"
                              onClick={() => bukaEditSuratKeluar(it)}
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

                          {/* Batalkan / Hapus Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              type="button"
                              title="Batalkan / Hapus Nomor"
                              onClick={() => setModalHapus({ jenis: "keluar", data: it })}
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
          )
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: TAMBAH / EDIT SURAT MASUK */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalMasuk && (
        <Modal
          title={modalMasuk.mode === "tambah" ? "Catat Agenda Surat Masuk" : "Edit Agenda Surat Masuk"}
          subtitle="Form registrasi surat dinas masuk BAPPERIDA Sumba Barat"
          icon="archive"
          onClose={() => setModalMasuk(null)}
          maxWidth={600}
        >
          <form onSubmit={simpanSuratMasuk} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Nomor Surat Asli *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mis. 050/123/DISP/XI/2026"
                  value={modalMasuk.data.nomor_surat_asli}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, nomor_surat_asli: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Asal Instansi Pengirim *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mis. Dinas PUPR Sumba Barat"
                  value={modalMasuk.data.asal_surat}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, asal_surat: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tanggal Surat Asli
                </label>
                <input
                  type="date"
                  value={modalMasuk.data.tanggal_surat}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, tanggal_surat: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tanggal Diterima
                </label>
                <input
                  type="date"
                  value={modalMasuk.data.tanggal_terima}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, tanggal_terima: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Perihal Surat *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Tuliskan pokok perihal surat dinas secara lengkap..."
                value={modalMasuk.data.perihal}
                onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, perihal: e.target.value } })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Sifat Surat
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalMasuk.data.sifat}
                  onChange={(v) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, sifat: v } })}
                  options={[
                    { value: "Biasa", label: "Biasa" },
                    { value: "Penting", label: "Penting" },
                    { value: "Rahasia", label: "Rahasia" },
                    { value: "Segera", label: "Segera" },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Kode Klasifikasi
                </label>
                <Select
                  fullWidth
                  size="md"
                  searchable
                  value={modalMasuk.data.kode_klasifikasi}
                  onChange={(v) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, kode_klasifikasi: v } })}
                  options={KODE_KLASIFIKASI_LIST.map((k) => ({
                    value: k.kode,
                    label: `${k.kode} - ${k.label.split("- ")[1] || k.label}`,
                  }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Jumlah Lampiran
                </label>
                <input
                  type="text"
                  placeholder="Mis. 1 Gabung / —"
                  value={modalMasuk.data.jumlah_lampiran}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, jumlah_lampiran: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Tautan Berkas Pindaian / Google Drive (Opsional)
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/... atau tautan file PDF"
                value={modalMasuk.data.file_url}
                onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, file_url: e.target.value } })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
              />
            </div>

            {modalMasuk.mode === "edit" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Status Surat
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalMasuk.data.status}
                  onChange={(v) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, status: v } })}
                  options={[
                    { value: "Diterima", label: "Diterima" },
                    { value: "Didisposisi", label: "Didisposisi" },
                    { value: "Selesai", label: "Selesai" },
                  ]}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setModalMasuk(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Menyimpan..." : "Simpan Surat Masuk"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: DISPOSISI DIGITAL PIMPINAN (STAFF & ADMIN) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalDisposisi && (
        <Modal
          title="Lembar Disposisi Digital"
          subtitle={`Disposisi untuk Surat: ${modalDisposisi.surat?.nomor_agenda || ""} - ${modalDisposisi.surat?.asal_surat || ""}`}
          icon="fileText"
          onClose={() => setModalDisposisi(null)}
          maxWidth={650}
        >
          {modalDisposisi.loading ? (
            <div style={{ padding: 40, textAlign: "center", color: T.textSecondary }}>Memuat riwayat lembar disposisi...</div>
          ) : (
            <form onSubmit={simpanDisposisi} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: isDark ? "#172337" : "#F1F5F9", padding: "10px 14px", borderRadius: 8, borderLeft: `4px solid ${T.primary}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary }}>PERIHAL SURAT</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginTop: 2 }}>{modalDisposisi.surat?.perihal}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                  No. Asli: {modalDisposisi.surat?.nomor_surat_asli} • Dari: {modalDisposisi.surat?.asal_surat}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                    Pemberi Disposisi
                  </label>
                  <Select
                    fullWidth
                    size="md"
                    value={modalDisposisi.form.pemberi_disposisi}
                    onChange={(v) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, pemberi_disposisi: v } })}
                    options={[
                      { value: "Kepala BAPPERIDA", label: "Kepala BAPPERIDA" },
                      { value: "Sekretaris BAPPERIDA", label: "Sekretaris BAPPERIDA" },
                      { value: "Plt. Kepala BAPPERIDA", label: "Plt. Kepala BAPPERIDA" },
                    ]}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                    Tanggal Disposisi
                  </label>
                  <input
                    type="date"
                    value={modalDisposisi.form.tanggal_disposisi}
                    onChange={(e) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, tanggal_disposisi: e.target.value } })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Checklist Diteruskan Kepada */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 6 }}>
                  Diteruskan Kepada (Pilih Bidang / Bagian):
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, background: T.bg, padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  {DITERUSKAN_OPTIONS.map((opt) => {
                    const checked = modalDisposisi.form.diteruskan_kepada.includes(opt);
                    return (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = modalDisposisi.form.diteruskan_kepada;
                            const next = e.target.checked ? [...cur, opt] : cur.filter(x => x !== opt);
                            setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, diteruskan_kepada: next } });
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Checklist Arahan Pimpinan */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 6 }}>
                  Petunjuk / Arahan Tindak Lanjut:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, background: T.bg, padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  {ARAHAN_OPTIONS.map((opt) => {
                    const checked = modalDisposisi.form.arahan.includes(opt);
                    return (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = modalDisposisi.form.arahan;
                            const next = e.target.checked ? [...cur, opt] : cur.filter(x => x !== opt);
                            setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, arahan: next } });
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Catatan Khusus / Instruksi Tambahan:
                </label>
                <textarea
                  rows={3}
                  placeholder="Tuliskan catatan khusus atau arahan spesifik dari pimpinan..."
                  value={modalDisposisi.form.catatan_instruksi}
                  onChange={(e) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, catatan_instruksi: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                    Batas Waktu Tindak Lanjut (Opsional)
                  </label>
                  <input
                    type="date"
                    value={modalDisposisi.form.batas_waktu}
                    onChange={(e) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, batas_waktu: e.target.value } })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                    Status Disposisi
                  </label>
                  <Select
                    fullWidth
                    size="md"
                    value={modalDisposisi.form.status_tindaklanjut}
                    onChange={(v) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, status_tindaklanjut: v } })}
                    options={[
                      { value: "Didisposisikan", label: "Didisposisikan" },
                      { value: "Dalam Proses", label: "Dalam Proses" },
                      { value: "Selesai", label: "Selesai" },
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalDisposisi(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Menyimpan..." : "Simpan Disposisi Digital"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: BOOKING / EDIT NOMOR SURAT KELUAR */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalKeluar && (
        <Modal
          title={modalKeluar.mode === "tambah" ? "Booking Nomor Surat Keluar" : "Edit Surat Keluar"}
          subtitle="Penerbitan nomor surat dinas resmi dengan penomoran berurutan otomatis"
          icon="externalLink"
          onClose={() => setModalKeluar(null)}
          maxWidth={620}
        >
          <form onSubmit={simpanSuratKeluar} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Live Number Preview */}
            <div style={{ background: isDark ? "#172337" : "#EFF6FF", border: `1px solid ${isDark ? "#2563EB" : "#BFDBFE"}`, padding: "12px 16px", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>
                {modalKeluar.mode === "tambah" ? "PRATINJAU NOMOR SURAT BERIKUTNYA" : "NOMOR SURAT DINAS"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: T.text, marginTop: 4, letterSpacing: "0.02em" }}>
                {modalKeluar.previewNomor}
              </div>
              <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>
                Sistem mengunci urutan secara atomik di database untuk mencegah nomor ganda antar bidang.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Kode Klasifikasi *
                </label>
                <Select
                  fullWidth
                  size="md"
                  searchable
                  value={modalKeluar.data.kode_klasifikasi}
                  onChange={async (v) => {
                    const newKode = v;
                    const prev = await fetchPreviewNomorKeluar(newKode);
                    setModalKeluar({
                      ...modalKeluar,
                      previewNomor: modalKeluar.mode === "tambah" ? prev : modalKeluar.previewNomor,
                      data: { ...modalKeluar.data, kode_klasifikasi: newKode }
                    });
                  }}
                  options={KODE_KLASIFIKASI_LIST.map((k) => ({
                    value: k.kode,
                    label: k.label,
                  }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tanggal Surat *
                </label>
                <input
                  type="date"
                  required
                  value={modalKeluar.data.tanggal_surat}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, tanggal_surat: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Tujuan Surat Dinas *
              </label>
              <input
                type="text"
                required
                placeholder="Mis. Kepala Dinas Pendidikan, Kepemudaan dan Olahraga Kab. Sumba Barat"
                value={modalKeluar.data.tujuan_surat}
                onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, tujuan_surat: e.target.value } })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Perihal Surat Dinas *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Tuliskan pokok perihal surat keluar secara lengkap..."
                value={modalKeluar.data.perihal}
                onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, perihal: e.target.value } })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Bidang Pengonsep *
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalKeluar.data.bidang_pengonsep}
                  onChange={(v) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, bidang_pengonsep: v } })}
                  options={BIDANG_LIST.map((b) => ({ value: b, label: b }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Pejabat Penandatangan
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalKeluar.data.penandatangan}
                  onChange={(v) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, penandatangan: v } })}
                  options={PENANDATANGAN_LIST.map((p) => ({ value: p, label: p }))}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Sifat Surat
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalKeluar.data.sifat}
                  onChange={(v) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, sifat: v } })}
                  options={[
                    { value: "Biasa", label: "Biasa" },
                    { value: "Penting", label: "Penting" },
                    { value: "Rahasia", label: "Rahasia" },
                    { value: "Segera", label: "Segera" },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Status Surat
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalKeluar.data.status}
                  onChange={(v) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, status: v } })}
                  options={[
                    { value: "Draf", label: "Draf" },
                    { value: "Ditandatangani", label: "Ditandatangani" },
                    { value: "Terkirim", label: "Terkirim" },
                    ...(isAdmin ? [{ value: "Dibatalkan", label: "Dibatalkan" }] : []),
                  ]}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tautan Draf Surat (Docs/Drive)
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/..."
                  value={modalKeluar.data.file_draft_url}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, file_draft_url: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tautan Surat Final (Signed PDF)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/.../pdf"
                  value={modalKeluar.data.file_final_url}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, file_final_url: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setModalKeluar(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Memproses..." : (modalKeluar.mode === "tambah" ? "Booking Nomor Resmi" : "Simpan Perubahan")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: DETAIL LENGKAP */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalDetail && (
        <Modal
          title={modalDetail.jenis === "masuk" ? "Rincian Surat Masuk" : "Rincian Surat Keluar"}
          subtitle="Detail informasi agenda surat dinas"
          icon="fileText"
          onClose={() => setModalDetail(null)}
          maxWidth={580}
        >
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, fontSize: 13 }}>
              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor Agenda:</div>
              <div style={{ fontWeight: 700, fontFamily: "monospace", color: T.primary }}>{modalDetail.data.nomor_agenda || "—"}</div>

              {modalDetail.jenis === "masuk" ? (
                <>
                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor Surat Asli:</div>
                  <div style={{ fontWeight: 700, color: T.text }}>{modalDetail.data.nomor_surat_asli}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Asal Instansi:</div>
                  <div style={{ fontWeight: 600, color: T.text }}>{modalDetail.data.asal_surat}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Tanggal Terima:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.tanggal_terima ? modalDetail.data.tanggal_terima.split("T")[0] : "—"}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Tanggal Surat:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.tanggal_surat ? modalDetail.data.tanggal_surat.split("T")[0] : "—"}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Jumlah Lampiran:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.jumlah_lampiran || "—"}</div>
                </>
              ) : (
                <>
                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor Surat:</div>
                  <div style={{ fontWeight: 700, fontFamily: "monospace", color: T.text }}>{modalDetail.data.nomor_surat}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Tujuan Surat:</div>
                  <div style={{ fontWeight: 600, color: T.text }}>{modalDetail.data.tujuan_surat}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Tanggal Surat:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.tanggal_surat ? modalDetail.data.tanggal_surat.split("T")[0] : "—"}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Bidang Pengonsep:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.bidang_pengonsep}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Penandatangan:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.penandatangan}</div>
                </>
              )}

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Perihal:</div>
              <div style={{ color: T.text, lineHeight: 1.5 }}>{modalDetail.data.perihal}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Sifat & Status:</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {renderSifatBadge(modalDetail.data.sifat)}
                {renderStatusBadge(modalDetail.data.status)}
              </div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Pencatat (TU):</div>
              <div style={{ color: T.textSecondary, fontSize: 12 }}>{modalDetail.data.created_by || "Admin TU"}</div>
            </div>

            {/* Berkas File Link */}
            {(modalDetail.data.file_url || modalDetail.data.file_draft_url || modalDetail.data.file_final_url) && (
              <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: T.bg, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 6 }}>BERKAS TERKAIT</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {modalDetail.data.file_url && (
                    <a href={modalDetail.data.file_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.primary, textDecoration: "none", fontWeight: 600 }}>
                      <Icon name="link" size={13} /> Berkas Surat Masuk
                    </a>
                  )}
                  {modalDetail.data.file_draft_url && (
                    <a href={modalDetail.data.file_draft_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.warning, textDecoration: "none", fontWeight: 600 }}>
                      <Icon name="file" size={13} /> Draf Naskah
                    </a>
                  )}
                  {modalDetail.data.file_final_url && (
                    <a href={modalDetail.data.file_final_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.success, textDecoration: "none", fontWeight: 600 }}>
                      <Icon name="checkCircle" size={13} /> Surat Bertandatangan
                    </a>
                  )}
                </div>
              </div>
            )}

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
      {/* MODAL 5: KONFIRMASI HAPUS (ADMIN ONLY) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalHapus && (
        <Modal
          title={modalHapus.jenis === "masuk" ? "Hapus Surat Masuk" : "Hapus / Batalkan Surat Keluar"}
          subtitle="Tindakan ini memerlukan hak akses Administrator"
          icon="trash"
          onClose={() => setModalHapus(null)}
          maxWidth={480}
        >
          <div style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: 13, color: T.text, lineHeight: 1.5, margin: "0 0 16px" }}>
              Apakah Anda yakin ingin menghapus arsip surat agenda{" "}
              <strong>
                {modalHapus.jenis === "masuk" ? modalHapus.data.nomor_agenda : modalHapus.data.nomor_surat}
              </strong>
              ?
            </p>

            {modalHapus.jenis === "keluar" ? (
              <div style={{ background: T.bg, padding: 12, borderRadius: 8, fontSize: 12, color: T.textSecondary, marginBottom: 16 }}>
                <strong>Catatan Surat Keluar:</strong>
                <p style={{ margin: "4px 0 0" }}>
                  Disarankan memilih <strong>"Tandai Dibatalkan"</strong> agar nomor urut surat tidak terputus/hilang dalam buku agenda fisik.
                </p>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalHapus(null)}
                style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 12.5 }}
              >
                Batal
              </button>

              {modalHapus.jenis === "keluar" && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => konfirmasiHapus(false)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: T.warning, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
                >
                  Tandai Dibatalkan
                </button>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => konfirmasiHapus(true)}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: T.danger, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
              >
                {submitting ? "Menghapus..." : "Hapus Permanen"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
