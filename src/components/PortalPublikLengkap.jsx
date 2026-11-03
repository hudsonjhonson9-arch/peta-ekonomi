import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon, Badge } from "./ui.jsx";
import * as XLSX from "xlsx";
import SumbaBaratMap from "./SumbaBaratMap.jsx";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function PortalPublikLengkap({ onLoginClick, user = null }) {
  const { T, isDark } = useContext(ThemeContext);

  // Sub-navigasi portal: 'beranda' | 'dataset' | 'detail' | 'jelajah' | 'bandingkan' | 'visualisasi' | 'berita' | 'berita-detail' | 'katalog' | 'tanya-data'
  const [subPage, setSubPage] = useState("beranda");

  // State data utama
  const [ringkasan, setRingkasan] = useState(null);
  const [datasetList, setDatasetList] = useState([]);
  const [datasetMeta, setDatasetMeta] = useState({ total: 0, page: 1, limit: 10 });
  const [loading, setLoading] = useState(false);

  // Filter dataset
  const [searchQ, setSearchQ] = useState("");
  const [filterOpd, setFilterOpd] = useState("");
  const [filterTopik, setFilterTopik] = useState("");
  const [filterUrusan, setFilterUrusan] = useState("");
  const [sortOrder, setSortOrder] = useState("terbaru");

  // Detail dataset
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const [datasetDetail, setDatasetDetail] = useState(null);
  const [detailTab, setDetailTab] = useState("tabel"); // 'tabel' | 'grafik' | 'peta' | 'metadata' | 'lampiran'
  const [selectedChartField, setSelectedChartField] = useState("");
  const [chartType, setChartType] = useState("bar"); // 'bar' | 'line' | 'area'

  // Jelajah data
  const [jelajahTab, setJelajahTab] = useState("urusan"); // 'urusan' | 'topik' | 'opd'
  const [listUrusan, setListUrusan] = useState([]);
  const [listTopik, setListTopik] = useState([]);
  const [listOpd, setListOpd] = useState([]);

  // Bandingkan Indikator
  const [opsiIndikator, setOpsiIndikator] = useState([]);
  const [selectedIndikators, setSelectedIndikators] = useState([]);
  const [hasilBandingkan, setHasilBandingkan] = useState([]);
  const [loadingBandingkan, setLoadingBandingkan] = useState(false);

  // Visualisasi Makro
  const [visualisasiData, setVisualisasiData] = useState(null);

  // Berita & Konten
  const [beritaList, setBeritaList] = useState([]);
  const [beritaPopuler, setBeritaPopuler] = useState([]);
  const [beritaDetail, setBeritaDetail] = useState(null);
  const [katalogList, setKatalogList] = useState([]);
  const [katalogJenis, setKatalogJenis] = useState("Produk Hukum");

  // Tanya Data & Captcha
  const [captcha, setCaptcha] = useState({ token: "", svg_base64: "", soal: "" });
  const [qnaForm, setQnaForm] = useState({
    nama: "",
    email: "",
    nomorhp: "",
    organisasi: "",
    pertanyaan: "",
    captcha_jawaban: "",
  });
  const [qnaPesan, setQnaPesan] = useState({ jenis: "", teks: "" });

  // Catat kunjungan halaman setiap kali subPage berubah
  useEffect(() => {
    fetch("/api/portal/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `/portal/${subPage}`, referrer: document.referrer }),
    }).catch(() => {});
  }, [subPage]);

  // Fungsi sinkronisasi data langsung dari PostgreSQL database
  const muatSemuaDataPortal = () => {
    fetch("/api/portal/ringkasan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRingkasan(d))
      .catch(() => {});

    fetch("/api/portal/jelajah/urusan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setListUrusan(Array.isArray(d) ? d : []))
      .catch(() => {});

    fetch("/api/portal/jelajah/topik", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setListTopik(Array.isArray(d) ? d : []))
      .catch(() => {});

    fetch("/api/portal/jelajah/organisasi", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setListOpd(Array.isArray(d) ? d : []))
      .catch(() => {});

    fetch("/api/portal/berita?limit=6", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setBeritaList(d.data || []))
      .catch(() => {});

    fetch("/api/portal/berita/populer", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBeritaPopuler(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  // Muat data langsung dari database saat komponen dipasang, saat tab subPage berubah, dan berkala tiap 25 detik
  useEffect(() => {
    muatSemuaDataPortal();
    const interval = setInterval(muatSemuaDataPortal, 25000);
    const onFocus = () => muatSemuaDataPortal();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [subPage]);

  // Fetch Dataset List saat filter berubah
  useEffect(() => {
    if (subPage !== "dataset" && subPage !== "beranda") return;
    setLoading(true);
    const sp = new URLSearchParams();
    if (searchQ) sp.set("q", searchQ);
    if (filterOpd) sp.set("opd_id", filterOpd);
    if (filterTopik) sp.set("topik_id", filterTopik);
    if (filterUrusan) sp.set("urusan_id", filterUrusan);
    if (sortOrder) sp.set("sort", sortOrder);
    sp.set("limit", "12");

    sp.set("_t", String(Date.now()));
    fetch(`/api/portal/dataset?${sp.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [], meta: {} }))
      .then((d) => {
        setDatasetList(d.data || []);
        setDatasetMeta(d.meta || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subPage, searchQ, filterOpd, filterTopik, filterUrusan, sortOrder]);

  const navigasiPortal = (sub, id = null) => {
    setSubPage(sub);
    if (sub === "dataset") {
      setSelectedDatasetId(null);
      setDatasetDetail(null);
      history.replaceState(null, "", "#publik/dataset");
    } else if (sub === "detail" && id) {
      setSelectedDatasetId(id);
      history.replaceState(null, "", `#publik/dataset/${id}`);
    } else if (sub === "beranda") {
      history.replaceState(null, "", "#publik");
    } else {
      history.replaceState(null, "", `#publik/${sub}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Deep linking via URL hash: #publik/dataset, #publik/dataset/:id, #publik/bandingkan, dll.
  useEffect(() => {
    const bacaHash = () => {
      const h = (window.location.hash || "").replace(/^#\/?/, "");
      const segs = h.split("?")[0].split("/");
      const root = segs[0] || "";
      if (root === "publik" || root === "portal") {
        const sub = segs[1] || "beranda";
        const id = segs[2] || null;
        if (sub === "dataset" && id) {
          bukaDetailDataset(id);
        } else if (["beranda", "dataset", "jelajah", "bandingkan", "visualisasi", "berita", "katalog", "tanya-data"].includes(sub)) {
          setSubPage(sub);
        }
      }
    };
    bacaHash();
    window.addEventListener("hashchange", bacaHash);
    return () => window.removeEventListener("hashchange", bacaHash);
  }, []);

  // Fetch Detail Dataset saat dipilih
  const bukaDetailDataset = (id) => {
    setSelectedDatasetId(id);
    setLoading(true);
    setSubPage("detail");
    setDetailTab("tabel");
    try {
      history.replaceState(null, "", `#publik/dataset/${id}`);
    } catch (_) {}
    fetch(`/api/portal/dataset/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setDatasetDetail(d);
          const firstNumeric = (d.fields || []).find((f) => f.tipe_data === "angka" || f.tipe_data === "desimal" || f.tampil_grafik);
          setSelectedChartField(firstNumeric?.nama_field || d.fields?.[0]?.nama_field || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Unduh dataset
  const handleUnduh = (format) => {
    if (!datasetDetail) return;
    if (format === "csv" || format === "json") {
      window.open(`/api/portal/dataset/${datasetDetail.id}/unduh/${format}`, "_blank");
      return;
    }
    // Unduh Excel via SheetJS
    const wb = XLSX.utils.book_new();
    const rowsFormatted = (datasetDetail.rows || []).map((r) => ({
      Tahun: r.tahun,
      Periode: r.periode || "—",
      "Kode Wilayah": r.wilayah_kode || "—",
      "Nama Wilayah": r.nama_wilayah || "—",
      ...(r.data || {}),
    }));
    const ws = XLSX.utils.json_to_sheet(rowsFormatted);
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    const metaData = [
      ["METADATA DATASET SEKTORAL KABUPATEN SUMBA BARAT"],
      ["Nama Dataset", datasetDetail.nama || "—"],
      ["Produsen Data (OPD)", datasetDetail.opd_nama || "—"],
      ["Satuan", datasetDetail.satuan || "—"],
      ["Frekuensi", datasetDetail.frekuensi || "Tahunan"],
      ["Definisi", datasetDetail.definisi || "—"],
      ["Sumber Data", datasetDetail.sumber_data || "—"],
      ["Tanggal Verifikasi", datasetDetail.verified_at ? new Date(datasetDetail.verified_at).toLocaleDateString("id-ID") : "—"],
      ["Diunduh Pada", new Date().toLocaleString("id-ID")],
    ];
    const wsMeta = XLSX.utils.aoa_to_sheet(metaData);
    XLSX.utils.book_append_sheet(wb, wsMeta, "Tentang Data");

    XLSX.writeFile(wb, `${(datasetDetail.nama || "dataset").replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`);
  };

  // Muat opsi indikator untuk Bandingkan
  useEffect(() => {
    if (subPage === "bandingkan" && !opsiIndikator.length) {
      fetch("/api/portal/bandingkan/indikator")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setOpsiIndikator(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [subPage, opsiIndikator.length]);

  // Eksekusi perbandingan indikator
  const jalankanBandingkan = () => {
    if (!selectedIndikators.length) return;
    setLoadingBandingkan(true);
    fetch("/api/portal/bandingkan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: selectedIndikators }),
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setHasilBandingkan(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingBandingkan(false));
  };

  // Muat Visualisasi Makro
  useEffect(() => {
    if (subPage === "visualisasi" && !visualisasiData) {
      fetch("/api/portal/visualisasi")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setVisualisasiData(d))
        .catch(() => {});
    }
  }, [subPage, visualisasiData]);

  // Muat Captcha untuk Tanya Data
  const muatCaptcha = () => {
    fetch("/api/portal/captcha")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCaptcha(d))
      .catch(() => {});
  };

  useEffect(() => {
    if (subPage === "tanya-data") muatCaptcha();
  }, [subPage]);

  // Kirim Form Tanya Data
  const handleKirimQna = async (e) => {
    e.preventDefault();
    setQnaPesan({ jenis: "", teks: "" });

    try {
      const res = await fetch("/api/portal/qna-kirim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...qnaForm,
          captcha_token: captcha.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim pertanyaan");

      setQnaPesan({ jenis: "sukses", teks: data.message });
      setQnaForm({ nama: "", email: "", nomorhp: "", organisasi: "", pertanyaan: "", captcha_jawaban: "" });
      muatCaptcha();
    } catch (err) {
      setQnaPesan({ jenis: "error", teks: err.message });
      muatCaptcha();
    }
  };

  // Data olahan untuk chart di detail dataset
  const chartDataDetail = useMemo(() => {
    if (!datasetDetail || !datasetDetail.rows || !selectedChartField) return [];
    const grouped = {};
    for (const r of datasetDetail.rows) {
      const thn = String(r.tahun || "Tahun Ini");
      const val = parseFloat(r.data?.[selectedChartField]) || 0;
      if (!grouped[thn]) grouped[thn] = { tahun: thn, total: 0, count: 0 };
      grouped[thn].total += val;
      grouped[thn].count++;
    }
    return Object.values(grouped).sort((a, b) => parseInt(a.tahun) - parseInt(b.tahun));
  }, [datasetDetail, selectedChartField]);

  // Data olahan untuk peta tematik choropleth per kecamatan di detail dataset
  const mapItemsDetail = useMemo(() => {
    if (!datasetDetail || !datasetDetail.rows || !datasetDetail.rows.length) return [];
    const tahunMax = Math.max(...datasetDetail.rows.map(r => Number(r.tahun) || 0));
    const targetTahun = tahunMax || datasetDetail.rows[0].tahun;
    const barisTahun = datasetDetail.rows.filter(r => (Number(r.tahun) || 0) === targetTahun);
    return barisTahun.map(r => {
      const val = selectedChartField ? (parseFloat(r.data?.[selectedChartField]) || 0) : 0;
      return {
        kode: r.wilayah_kode,
        nama: r.nama_wilayah || r.data?.kecamatan,
        nilai: val,
        satuan: datasetDetail.satuan || "",
      };
    });
  }, [datasetDetail, selectedChartField]);

  return (
    <div style={{ minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: T.font }}>
      {/* ── NAVBAR PORTAL SATU DATA ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${T.border}`,
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            height: 68,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo Brand */}
          <div
            onClick={() => navigasiPortal("beranda")}
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
          >
            <img
              src="/Lambang_Kabupaten_Sumba_Barat.png"
              alt="Logo Sumba Barat"
              style={{ height: 42, width: 42, objectFit: "contain" }}
            />
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: T.text, lineHeight: 1.2 }}>
                Satu Data Sumba Barat
              </div>
              <div style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 500 }}>
                BAPPERIDA Kabupaten Sumba Barat
              </div>
            </div>
          </div>

          {/* Menu Navigasi */}
          <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {[
              { key: "beranda", label: "Beranda", icon: "home" },
              { key: "dataset", label: "Katalog Data", icon: "archive" },
              { key: "jelajah", label: "Jelajah Kategori", icon: "layers" },
              { key: "bandingkan", label: "Bandingkan", icon: "filter" },
              { key: "visualisasi", label: "Visualisasi", icon: "chart" },
              { key: "berita", label: "Berita", icon: "world" },
              { key: "katalog", label: "Katalog SK & Kajian", icon: "file" },
              { key: "tanya-data", label: "Tanya Data", icon: "users" },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => navigasiPortal(m.key)}
                style={{
                  padding: "8px 12px",
                  background: subPage === m.key ? `${T.primary}18` : "none",
                  color: subPage === m.key ? T.primary : T.text,
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: subPage === m.key ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
              >
                <Icon name={m.icon} size={15} />
                <span className="hide-mobile">{m.label}</span>
              </button>
            ))}
          </nav>

          {/* Tombol Sinkron Data Langsung dari DB */}
          <button
            onClick={muatSemuaDataPortal}
            title="Segarkan data langsung dari database"
            style={{
              padding: "8px 12px",
              background: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9",
              color: T.textSecondary,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icon name="refresh" size={13} />
            <span className="hide-mobile">Sinkron DB</span>
          </button>

          {/* Tombol Masuk / Kembali ke Admin */}
          {onLoginClick && (
            <button
              onClick={onLoginClick}
              style={{
                padding: "8px 16px",
                background: user ? (isDark ? "rgba(255,255,255,0.08)" : "#F1F5F9") : T.primary,
                color: user ? T.text : "#fff",
                border: user ? `1px solid ${T.border}` : "none",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: user ? "none" : "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <Icon name={user ? "chevronLeft" : "users"} size={14} />
              {user ? "Panel Admin" : "Login Petugas"}
            </button>
          )}
        </div>
      </header>

      {/* ── 1. BERANDA PORTAL ── */}
      {subPage === "beranda" && (
        <div>
          {/* Hero Banner */}
          <section
            style={{
              padding: "60px 24px",
              background: isDark
                ? "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)"
                : "linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 50%, #EFF6FF 100%)",
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: isDark ? "rgba(5, 150, 105, 0.2)" : "#D1FAE5",
                  color: "#059669",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 16,
                  letterSpacing: 0.5,
                }}
              >
                PORTAL RESMI SATU DATA KABUPATEN SUMBA BARAT
              </span>
              <h1
                style={{
                  fontSize: 38,
                  fontWeight: 800,
                  lineHeight: 1.2,
                  margin: "0 0 14px",
                  letterSpacing: -0.5,
                  color: T.text,
                }}
              >
                Data Terpadu untuk Perencanaan Pembangunan yang Lebih Baik
              </h1>
              <p style={{ fontSize: 16, color: T.textMuted, lineHeight: 1.6, margin: "0 0 28px" }}>
                Akses terbuka terhadap kumpulan data statistik sektoral, indikator kinerja daerah, capaian Standar
                Pelayanan Minimal (SPM), dan kajian perencanaan pembangunan daerah.
              </p>

              {/* Search Box Besar */}
              <div
                style={{
                  maxWidth: 680,
                  margin: "0 auto",
                  position: "relative",
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setSubPage("dataset")}
                  placeholder="Cari dataset, indikator, urusan, atau nama perangkat daerah..."
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    paddingRight: 120,
                    fontSize: 15,
                    border: "none",
                    outline: "none",
                    background: isDark ? "#1E293B" : "#fff",
                    color: T.text,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => navigasiPortal("dataset")}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: 6,
                    bottom: 6,
                    padding: "0 22px",
                    background: T.primary,
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon name="search" size={16} />
                  Cari Data
                </button>
              </div>

              {/* Quick Search Chips (ui-ux-pro-max discovery tags) */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>Pencarian Cepat:</span>
                {[
                  { label: "Kemiskinan", q: "kemiskinan" },
                  { label: "Pertanian & Padi", q: "padi" },
                  { label: "Pendidikan", q: "pendidikan" },
                  { label: "Kesehatan", q: "kesehatan" },
                  { label: "Kecamatan", q: "kecamatan" },
                ].map((chip) => (
                  <button
                    key={chip.q}
                    type="button"
                    onClick={() => {
                      setSearchQ(chip.q);
                      navigasiPortal("dataset");
                    }}
                    style={{
                      background: isDark ? "rgba(255,255,255,0.08)" : "#FFFFFF",
                      border: `1px solid ${T.border}`,
                      borderRadius: 20,
                      padding: "5px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: T.text,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = T.primary;
                      e.currentTarget.style.color = T.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.color = T.text;
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Statistik Ringkasan Counter */}
          <section style={{ maxWidth: 1240, margin: "-28px auto 40px", padding: "0 24px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {[
                { label: "Dataset Sektoral Terbuka", val: ringkasan?.total_dataset ?? 0, icon: "archive", color: "#059669" },
                { label: "Organisasi / Produsen Data", val: ringkasan?.total_opd ?? 0, icon: "building", color: "#2563EB" },
                { label: "Kategori Bidang Urusan", val: ringkasan?.total_urusan ?? 0, icon: "layers", color: "#7C3AED" },
                { label: "Topik Pembangunan", val: ringkasan?.total_topik ?? 0, icon: "tag", color: "#EA580C" },
              ].map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    background: T.cardBg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: "18px 20px",
                    boxShadow: T.shadow,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: `${s.color}15`,
                      color: s.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={s.icon} size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: T.text, lineHeight: 1.1 }}>{s.val}</div>
                    <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 4 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Dataset Populer & Terbaru */}
          <section style={{ maxWidth: 1240, margin: "0 auto 48px", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0 }}>Dataset Sektoral Populer</h2>
                <p style={{ fontSize: 13, color: T.textMuted, margin: "4px 0 0" }}>
                  Kumpulan data statistik yang paling banyak diakses oleh publik dan akademisi
                </p>
              </div>
              <button
                onClick={() => setSubPage("dataset")}
                style={{
                  background: "none",
                  border: "none",
                  color: T.primary,
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Lihat Semua ({ringkasan?.total_dataset ?? 0}) <Icon name="arrowRight" size={16} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 18,
              }}
            >
              {(ringkasan?.populer || datasetList.slice(0, 6)).map((d) => (
                <div
                  key={d.id}
                  onClick={() => bukaDetailDataset(d.id)}
                  style={{
                    background: T.cardBg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: T.shadow,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "#EFF6FF",
                          color: "#2563EB",
                        }}
                      >
                        {d.opd_singkatan || d.opd_nama}
                      </span>
                      {d.satuan && (
                        <span style={{ fontSize: 11, color: T.textMuted }}>• Satuan: {d.satuan}</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 8, lineHeight: 1.35 }}>
                      {d.nama}
                    </div>
                    {d.deskripsi && (
                      <p
                        style={{
                          fontSize: 12.5,
                          color: T.textMuted,
                          lineHeight: 1.5,
                          margin: "0 0 14px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {d.deskripsi}
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      paddingTop: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: T.textMuted,
                    }}
                  >
                    <span>{d.frekuensi || "Tahunan"}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon name="eye" size={13} /> {d.view_count || 0} dilihat
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Seksi Berita Terkini */}
          {beritaList.length > 0 && (
            <section style={{ maxWidth: 1240, margin: "0 auto 48px", padding: "0 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0 }}>Berita & Publikasi Terkini</h2>
                  <p style={{ fontSize: 13, color: T.textMuted, margin: "4px 0 0" }}>
                    Informasi pemutakhiran data, rilis statistik, dan kegiatan Satu Data Sumba Barat
                  </p>
                </div>
                <button
                  onClick={() => setSubPage("berita")}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.primary,
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Semua Berita <Icon name="arrowRight" size={16} />
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
                {beritaList.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setBeritaDetail(b);
                      setSubPage("berita-detail");
                    }}
                    style={{
                      background: T.cardBg,
                      border: `1px solid ${T.border}`,
                      borderRadius: 14,
                      overflow: "hidden",
                      boxShadow: T.shadow,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {b.gambar_url ? (
                      <img
                        src={b.gambar_url}
                        alt={b.judul}
                        style={{ width: "100%", height: 160, objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          height: 120,
                          background: `${T.primary}12`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: T.primary,
                        }}
                      >
                        <Icon name="world" size={32} />
                      </div>
                    )}
                    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 11.5, color: T.primary, fontWeight: 700, marginBottom: 6 }}>
                          {b.kategori || "Berita Data"}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 8, lineHeight: 1.4 }}>
                          {b.judul}
                        </div>
                        <p style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.5, margin: 0 }}>
                          {b.ringkasan}
                        </p>
                      </div>
                      <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 14 }}>
                        {new Date(b.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── 2. KATALOG DATASET PUBLIK ── */}
      {subPage === "dataset" && (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px" }}>
          {/* Header & Filter Bar */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0 }}>Katalog Dataset Terbuka</h1>
            <p style={{ fontSize: 13.5, color: T.textMuted, margin: "6px 0 16px" }}>
              Telusuri dan unduh data sektoral resmi yang telah divalidasi oleh Walidata Kabupaten Sumba Barat
            </p>

            {/* Filter Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: 16,
                boxShadow: T.shadow,
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>
                  Pencarian
                </label>
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Ketik kata kunci..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    background: T.inputBg || T.cardBg,
                    color: T.text,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>
                  Produsen Data (OPD)
                </label>
                <select
                  value={filterOpd}
                  onChange={(e) => setFilterOpd(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    background: T.inputBg || T.cardBg,
                    color: T.text,
                  }}
                >
                  <option value="">Semua Perangkat Daerah</option>
                  {listOpd.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>
                  Topik Pembangunan
                </label>
                <select
                  value={filterTopik}
                  onChange={(e) => setFilterTopik(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    background: T.inputBg || T.cardBg,
                    color: T.text,
                  }}
                >
                  <option value="">Semua Topik</option>
                  {listTopik.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama_topik}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>
                  Urusan Pemerintahan
                </label>
                <select
                  value={filterUrusan}
                  onChange={(e) => setFilterUrusan(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    background: T.inputBg || T.cardBg,
                    color: T.text,
                  }}
                >
                  <option value="">Semua Urusan</option>
                  {listUrusan.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.kode_urusan} {u.nama_urusan}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>
                  Urutkan
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    background: T.inputBg || T.cardBg,
                    color: T.text,
                  }}
                >
                  <option value="terbaru">Terbaru Diverifikasi</option>
                  <option value="populer">Paling Sering Dilihat</option>
                  <option value="nama-asc">Nama Indikator (A-Z)</option>
                  <option value="nama-desc">Nama Indikator (Z-A)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grid Dataset */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: T.textMuted }}>
              Memuat data katalog...
            </div>
          ) : !datasetList.length ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 0",
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
              }}
            >
              <div style={{ width: 48, height: 48, margin: "0 auto 12px", color: T.textMuted }}>
                <Icon name="search" size={48} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: T.text, marginBottom: 4 }}>
                Tidak Ada Dataset Ditemukan
              </div>
              <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
                Coba ubah kata kunci pencarian atau bersihkan filter yang dipilih
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 18 }}>
              {datasetList.map((d) => (
                <div
                  key={d.id}
                  onClick={() => bukaDetailDataset(d.id)}
                  style={{
                    background: T.cardBg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: T.shadow,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "#ECFDF5",
                          color: "#059669",
                        }}
                      >
                        {d.opd_singkatan || d.opd_nama}
                      </span>
                      {d.nama_topik && (
                        <span style={{ fontSize: 11, color: T.textMuted }}>{d.nama_topik}</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 8, lineHeight: 1.35 }}>
                      {d.nama}
                    </div>
                    <p
                      style={{
                        fontSize: 12.5,
                        color: T.textMuted,
                        lineHeight: 1.5,
                        margin: "0 0 14px",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {d.definisi || d.deskripsi || "Tidak ada deskripsi rinci"}
                    </p>
                  </div>

                  <div
                    style={{
                      borderTop: `1px solid ${T.border}`,
                      paddingTop: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: T.textMuted,
                    }}
                  >
                    <span>{d.satuan ? `Satuan: ${d.satuan}` : "—"}</span>
                    <span>{d.jumlah_baris ?? 0} baris data</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 3. DETAIL DATASET PUBLIK (TABEL / GRAFIK / PETA / METADATA) ── */}
      {subPage === "detail" && datasetDetail && (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px" }}>
          {/* Tombol Kembali & Breadcrumb */}
          <button
            onClick={() => setSubPage("dataset")}
            style={{
              background: "none",
              border: "none",
              color: T.primary,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 16,
              padding: 0,
            }}
          >
            <Icon name="arrowLeft" size={16} /> Kembali ke Katalog
          </button>

          {/* Header Card Detail Dataset */}
          <div
            style={{
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 24,
              boxShadow: T.shadow,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: "#ECFDF5",
                  color: "#059669",
                }}
              >
                PRODUSEN: {datasetDetail.opd_nama}
              </span>
              {datasetDetail.nama_topik && (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: "#EFF6FF",
                    color: "#2563EB",
                  }}
                >
                  {datasetDetail.nama_topik}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: "0 0 10px", lineHeight: 1.3 }}>
              {datasetDetail.nama}
            </h1>
            <p style={{ fontSize: 13.5, color: T.textMuted, lineHeight: 1.6, margin: "0 0 18px", maxWidth: 900 }}>
              {datasetDetail.definisi || datasetDetail.deskripsi}
            </p>

            {/* Actions Bar & Tombol Unduh */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                borderTop: `1px solid ${T.border}`,
                paddingTop: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12.5, color: T.textMuted }}>
                <span>Frekuensi: <b>{datasetDetail.frekuensi || "Tahunan"}</b></span>
                <span>Satuan: <b>{datasetDetail.satuan || "—"}</b></span>
                <span>Jumlah Baris: <b>{datasetDetail.rows?.length ?? 0}</b></span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>Unduh Data:</span>
                <button
                  onClick={() => handleUnduh("excel")}
                  style={{
                    padding: "7px 14px",
                    background: "#059669",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon name="file" size={14} /> Excel (.xlsx)
                </button>
                <button
                  onClick={() => handleUnduh("csv")}
                  style={{
                    padding: "7px 14px",
                    background: T.cardBg,
                    border: `1px solid ${T.border}`,
                    color: T.text,
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  CSV
                </button>
                <button
                  onClick={() => handleUnduh("json")}
                  style={{
                    padding: "7px 14px",
                    background: T.cardBg,
                    border: `1px solid ${T.border}`,
                    color: T.text,
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  JSON
                </button>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Navigasi Detail Dataset */}
          <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
            {[
              { key: "tabel", label: `Tabel Data (${datasetDetail.rows?.length ?? 0})`, icon: "archive" },
              { key: "grafik", label: "Grafik & Tren", icon: "chart" },
              { key: "peta", label: "Peta Kecamatan", icon: "world" },
              { key: "metadata", label: "Tentang Data Ini (Metadata)", icon: "file" },
              { key: "lampiran", label: `Berkas Lampiran (${datasetDetail.lampirans?.length ?? 0})`, icon: "upload" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setDetailTab(t.key)}
                style={{
                  padding: "10px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: detailTab === t.key ? `2px solid ${T.primary}` : "2px solid transparent",
                  color: detailTab === t.key ? T.primary : T.textMuted,
                  fontWeight: detailTab === t.key ? 700 : 500,
                  fontSize: 13.5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon name={t.icon} size={16} />
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: TABEL DATA */}
          {detailTab === "tabel" && (
            <div
              style={{
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: T.shadow,
              }}
            >
              {!datasetDetail.rows?.length ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted, fontSize: 13.5 }}>
                  Belum ada baris data yang dimasukkan pada dataset ini.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: T.bg, borderBottom: `2px solid ${T.border}`, textAlign: "left" }}>
                        <th style={{ padding: "12px 14px", fontWeight: 700, color: T.text }}>Tahun</th>
                        <th style={{ padding: "12px 14px", fontWeight: 700, color: T.text }}>Wilayah</th>
                        {(datasetDetail.fields || []).map((f) => (
                          <th key={f.id} style={{ padding: "12px 14px", fontWeight: 700, color: T.text }}>
                            {f.label || f.nama_field}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {datasetDetail.rows.map((r, i) => (
                        <tr
                          key={r.id}
                          style={{
                            borderBottom: `1px solid ${T.border}`,
                            background: i % 2 === 0 ? "transparent" : `${T.bg}50`,
                          }}
                        >
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: T.text }}>{r.tahun}</td>
                          <td style={{ padding: "10px 14px", color: T.textMuted }}>{r.nama_wilayah || r.wilayah_kode || "Total Kab."}</td>
                          {(datasetDetail.fields || []).map((f) => (
                            <td key={f.id} style={{ padding: "10px 14px", color: T.text }}>
                              {r.data ? (r.data[f.nama_field] ?? "—") : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GRAFIK & TREN */}
          {detailTab === "grafik" && (
            <div
              style={{
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: 24,
                boxShadow: T.shadow,
              }}
            >
              {/* Toolbar Pilihan Kolom & Jenis Grafik */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Pilih Indikator / Kolom:</label>
                  <select
                    value={selectedChartField}
                    onChange={(e) => setSelectedChartField(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.inputBg || T.cardBg,
                      color: T.text,
                      fontSize: 13,
                    }}
                  >
                    {(datasetDetail.fields || []).map((f) => (
                      <option key={f.id} value={f.nama_field}>
                        {f.label || f.nama_field}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { key: "bar", label: "Batang" },
                    { key: "line", label: "Garis Tren" },
                    { key: "area", label: "Area" },
                  ].map((ct) => (
                    <button
                      key={ct.key}
                      onClick={() => setChartType(ct.key)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: `1px solid ${T.border}`,
                        background: chartType === ct.key ? T.primary : T.cardBg,
                        color: chartType === ct.key ? "#fff" : T.text,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Container Chart */}
              {!chartDataDetail.length ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: T.textMuted }}>
                  Tidak ada data numerik yang dapat ditampilkan pada grafik
                </div>
              ) : (
                <div style={{ height: 380, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "bar" ? (
                      <BarChart data={chartDataDetail}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="tahun" stroke={T.textMuted} />
                        <YAxis stroke={T.textMuted} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" name={selectedChartField} fill={T.primary} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    ) : chartType === "line" ? (
                      <LineChart data={chartDataDetail}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="tahun" stroke={T.textMuted} />
                        <YAxis stroke={T.textMuted} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total" name={selectedChartField} stroke={T.primary} strokeWidth={3} />
                      </LineChart>
                    ) : (
                      <AreaChart data={chartDataDetail}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="tahun" stroke={T.textMuted} />
                        <YAxis stroke={T.textMuted} />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="total" name={selectedChartField} fill={T.primary} stroke={T.primary} fillOpacity={0.25} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PETA KECAMATAN CHOROPLETH */}
          {detailTab === "peta" && (
            <div
              style={{
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: 24,
                boxShadow: T.shadow,
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: 0 }}>
                  Visualisasi Peta Kecamatan Kabupaten Sumba Barat
                </h3>
                <p style={{ fontSize: 12.5, color: T.textMuted, margin: "4px 0 0" }}>
                  Pemetaan sebaran data per kecamatan (Kota Waikabubak, Loli, Wanokaka, Lamboya, Laboya Barat, Tanarighu)
                </p>
              </div>

              <div style={{ minHeight: 460 }}>
                <SumbaBaratMap
                  mode="dataset"
                  title={`Peta Sebaran: ${datasetDetail.nama}`}
                  subtitle={`Kabupaten Sumba Barat — Berdasarkan indikator ${selectedChartField || 'utama'}`}
                  items={mapItemsDetail}
                  height={440}
                  onSelectKecamatan={() => {}}
                />
              </div>
            </div>
          )}

          {/* TAB 4: METADATA & TENTANG DATA */}
          {detailTab === "metadata" && (
            <div
              style={{
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: 24,
                boxShadow: T.shadow,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: "0 0 16px" }}>
                Metadata Lengkap (Prinsip Satu Data Indonesia)
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { label: "Nama Indikator / Dataset", val: datasetDetail.nama },
                  { label: "Kode Indikator", val: datasetDetail.kode_indikator || "—" },
                  { label: "Kode SDS", val: datasetDetail.kode_sds || "—" },
                  { label: "Produsen Data (OPD)", val: datasetDetail.opd_nama },
                  { label: "Urusan Pemerintahan", val: datasetDetail.nama_urusan ? `${datasetDetail.kode_urusan || ""} ${datasetDetail.nama_urusan}` : "—" },
                  { label: "Bidang Urusan", val: datasetDetail.nama_bidang || "—" },
                  { label: "Topik & Sub-Topik", val: `${datasetDetail.nama_topik || "—"} / ${datasetDetail.nama_sub_topik || "—"}` },
                  { label: "Satuan Ukur", val: datasetDetail.satuan || datasetDetail.nama_satuan || "—" },
                  { label: "Frekuensi Pemutakhiran", val: datasetDetail.frekuensi || "Tahunan" },
                  { label: "Jadwal Pemutakhiran", val: datasetDetail.jadwal_pemutakhiran || "—" },
                  { label: "Klasifikasi Akses", val: datasetDetail.klasifikasi || "Terbuka" },
                  { label: "Sumber Data / Referensi", val: datasetDetail.sumber_data || datasetDetail.sumber_referensi || "—" },
                  { label: "Tanggal Verifikasi Walidata", val: datasetDetail.verified_at ? new Date(datasetDetail.verified_at).toLocaleString("id-ID") : "—" },
                  { label: "Kontak Produsen Data", val: `${datasetDetail.kontak_nama || "—"} (${datasetDetail.kontak_email || datasetDetail.kontak_telepon || "—"})` },
                ].map((item, idx) => (
                  <div key={idx} style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
                    <div style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 13.5, color: T.text, fontWeight: 700, marginTop: 3 }}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: LAMPIRAN PENDUKUNG */}
          {detailTab === "lampiran" && (
            <div
              style={{
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: 24,
                boxShadow: T.shadow,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: "0 0 16px" }}>
                Dokumen & Berkas Lampiran Pendukung
              </h3>

              {!datasetDetail.lampirans?.length ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted }}>
                  Tidak ada dokumen lampiran pendukung untuk dataset ini.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {datasetDetail.lampirans.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        border: `1px solid ${T.border}`,
                        borderRadius: 10,
                        padding: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: "#EFF6FF",
                            color: "#2563EB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon name="file" size={20} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{l.nama_asli}</div>
                          <div style={{ fontSize: 11, color: T.textMuted }}>{l.keterangan || "Berkas pendukung"}</div>
                        </div>
                      </div>
                      <a
                        href={l.url_file}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "6px 12px",
                          background: T.primary,
                          color: "#fff",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        Buka
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 4. JELAJAH KATEGORI (URUSAN / TOPIK / OPD) ── */}
      {subPage === "jelajah" && (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: "0 0 6px" }}>Jelajah Dataset Sektoral</h1>
          <p style={{ fontSize: 13.5, color: T.textMuted, margin: "0 0 20px" }}>
            Eksplorasi data statistik daerah berdasarkan urusan pemerintahan, topik pembangunan, atau perangkat daerah
          </p>

          {/* Switcher Jelajah */}
          <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${T.border}`, marginBottom: 24 }}>
            {[
              { key: "urusan", label: `Urusan Pemerintahan (${listUrusan.length})`, icon: "layers" },
              { key: "topik", label: `Topik Pembangunan (${listTopik.length})`, icon: "tag" },
              { key: "opd", label: `Perangkat Daerah / OPD (${listOpd.length})`, icon: "building" },
            ].map((j) => (
              <button
                key={j.key}
                onClick={() => setJelajahTab(j.key)}
                style={{
                  padding: "10px 18px",
                  background: "none",
                  border: "none",
                  borderBottom: jelajahTab === j.key ? `2px solid ${T.primary}` : "2px solid transparent",
                  color: jelajahTab === j.key ? T.primary : T.textMuted,
                  fontWeight: jelajahTab === j.key ? 700 : 500,
                  fontSize: 13.5,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon name={j.icon} size={16} />
                {j.label}
              </button>
            ))}
          </div>

          {/* LIST JELAJAH URUSAN */}
          {jelajahTab === "urusan" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
              {listUrusan.map((u) => (
                <div
                  key={u.id}
                  onClick={() => {
                    setFilterUrusan(u.id);
                    setSubPage("dataset");
                  }}
                  style={{
                    background: T.cardBg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: T.shadow,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>
                      KODE: {u.kode_urusan}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: "#EFF6FF",
                        color: "#2563EB",
                        borderRadius: 12,
                        fontSize: 11.5,
                        fontWeight: 700,
                      }}
                    >
                      {u.jumlah_dataset || 0} Dataset
                    </span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                    {u.nama_urusan}
                  </div>
                  {u.bidang_urusan && u.bidang_urusan.length > 0 && (
                    <div style={{ fontSize: 12, color: T.textMuted }}>
                      {u.bidang_urusan.length} Bidang Urusan Terkait
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* LIST JELAJAH TOPIK */}
          {jelajahTab === "topik" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {listTopik.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setFilterTopik(t.id);
                    setSubPage("dataset");
                  }}
                  style={{
                    background: T.cardBg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: T.shadow,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "#ECFDF5",
                      color: "#059669",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="tag" size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{t.nama_topik}</div>
                    <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 4 }}>
                      {t.jumlah_dataset || 0} Dataset Sektoral
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LIST JELAJAH ORGANISASI / OPD */}
          {jelajahTab === "opd" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
              {listOpd.map((o) => (
                <div
                  key={o.id}
                  onClick={() => {
                    setFilterOpd(o.id);
                    setSubPage("dataset");
                  }}
                  style={{
                    background: T.cardBg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: 20,
                    boxShadow: T.shadow,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>
                      {o.singkatan || "OPD"}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: "#EFF6FF",
                        color: "#2563EB",
                        borderRadius: 12,
                        fontSize: 11.5,
                        fontWeight: 700,
                      }}
                    >
                      {o.jumlah_dataset || 0} Dataset
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>{o.nama}</div>
                  {o.keterangan && (
                    <p style={{ fontSize: 12, color: T.textMuted, margin: 0, lineHeight: 1.4 }}>
                      {o.keterangan}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 5. BANDINGKAN INDIKATOR ── */}
      {subPage === "bandingkan" && (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: "0 0 6px" }}>Bandingkan Indikator Publik</h1>
          <p style={{ fontSize: 13.5, color: T.textMuted, margin: "0 0 20px" }}>
            Pilih beberapa indikator pembangunan dan bandingkan pergerakan tren data antar tahun
          </p>

          {/* Selector Form */}
          <div
            style={{
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 20,
              boxShadow: T.shadow,
              marginBottom: 24,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 12 }}>
              Pilih Indikator untuk Dibandingkan
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              <select
                id="select-ds-bandingkan"
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  fontSize: 13,
                  background: T.inputBg || T.cardBg,
                  color: T.text,
                  minWidth: 320,
                }}
              >
                <option value="">-- Pilih Indikator --</option>
                {opsiIndikator.map((ds) => (
                  <optgroup key={ds.id} label={`${ds.nama} (${ds.opd_nama})`}>
                    {(ds.numeric_fields || []).map((f) => (
                      <option key={`${ds.id}:${f.nama}`} value={`${ds.id}:${f.nama}:${ds.nama} - ${f.label}`}>
                        {ds.nama} — {f.label} ({ds.satuan || ""})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <button
                onClick={() => {
                  const el = document.getElementById("select-ds-bandingkan");
                  if (el && el.value) {
                    const [dsId, fName, label] = el.value.split(":");
                    if (!selectedIndikators.some((s) => s.dataset_id === dsId && s.field_name === fName)) {
                      setSelectedIndikators([...selectedIndikators, { dataset_id: dsId, field_name: fName, label }]);
                    }
                  }
                }}
                style={{
                  padding: "9px 16px",
                  background: T.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Tambah Indikator
              </button>
            </div>

            {/* List Indikator Terpilih */}
            {selectedIndikators.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {selectedIndikators.map((s, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#EFF6FF",
                      color: "#1D4ED8",
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    {s.label}
                    <button
                      onClick={() => setSelectedIndikators(selectedIndikators.filter((_, i) => i !== idx))}
                      style={{ background: "none", border: "none", color: "#1D4ED8", cursor: "pointer", padding: 0 }}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={jalankanBandingkan}
              disabled={loadingBandingkan || !selectedIndikators.length}
              style={{
                padding: "10px 22px",
                background: "#059669",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                cursor: loadingBandingkan || !selectedIndikators.length ? "not-allowed" : "pointer",
              }}
            >
              {loadingBandingkan ? "Memproses Data..." : "Tampilkan Grafik Perbandingan"}
            </button>
          </div>

          {/* Hasil Perbandingan */}
          {hasilBandingkan.length > 0 && (
            <div
              style={{
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: 24,
                boxShadow: T.shadow,
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: "0 0 20px" }}>
                Grafik Perbandingan Tren Data Antar Tahun
              </h3>

              <div style={{ height: 400, width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="tahun" type="category" allowDuplicatedCategory={false} stroke={T.textMuted} />
                    <YAxis stroke={T.textMuted} />
                    <Tooltip />
                    <Legend />
                    {hasilBandingkan.map((h, idx) => {
                      const colors = ["#059669", "#2563EB", "#7C3AED", "#EA580C", "#D97706"];
                      return (
                        <Line
                          key={idx}
                          data={h.series}
                          name={h.dataset.field_label || h.dataset.nama}
                          dataKey="nilai"
                          stroke={colors[idx % colors.length]}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 6. VISUALISASI DATA MAKRO DENGAN ANIMASI ── */}
      {subPage === "visualisasi" && (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: "0 0 6px" }}>Visualisasi Data Makro Pembangunan</h1>
          <p style={{ fontSize: 13.5, color: T.textMuted, margin: "0 0 24px" }}>
            Dasbor statistik interaktif capaian Standar Pelayanan Minimal dan pembagian indikator sektoral Sumba Barat
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Chart 1: Pertumbuhan Data per Tahun */}
            <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, boxShadow: T.shadow }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>
                Pertumbuhan Rekam Data Sektoral
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={visualisasiData?.pertumbuhan || []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="tahun" stroke={T.textMuted} />
                    <YAxis stroke={T.textMuted} />
                    <Tooltip />
                    <Area type="monotone" dataKey="record_count" name="Jumlah Baris Data" fill="#059669" stroke="#059669" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Capaian Rata-Rata SPM 6 Urusan Wajib */}
            <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, boxShadow: T.shadow }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>
                Rata-rata Capaian SPM 6 Urusan Wajib (%)
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={visualisasiData?.spm_capaian || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} stroke={T.textMuted} />
                    <YAxis dataKey="nama_urusan" type="category" width={110} stroke={T.textMuted} />
                    <Tooltip />
                    <Bar dataKey="rata_capaian" name="Capaian (%)" fill="#2563EB" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Distribusi per Topik */}
            <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, boxShadow: T.shadow, gridColumn: "1 / -1" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 14 }}>
                Distribusi Dataset Menurut Topik Pembangunan
              </div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={visualisasiData?.per_topik || []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="topik" stroke={T.textMuted} />
                    <YAxis stroke={T.textMuted} />
                    <Tooltip />
                    <Bar dataKey="jumlah" name="Jumlah Dataset" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. BERITA & DETAIL BERITA ── */}
      {subPage === "berita" && (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: "0 0 6px" }}>Berita & Artikel Publik</h1>
          <p style={{ fontSize: 13.5, color: T.textMuted, margin: "0 0 24px" }}>
            Kabar terkini seputar Satu Data Indonesia, sensus, survei, dan rilis statistik daerah
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
            {beritaList.map((b) => (
              <div
                key={b.id}
                onClick={() => {
                  setBeritaDetail(b);
                  setSubPage("berita-detail");
                }}
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: T.shadow,
                  cursor: "pointer",
                }}
              >
                {b.gambar_url && (
                  <img src={b.gambar_url} alt={b.judul} style={{ width: "100%", height: 180, objectFit: "cover" }} />
                )}
                <div style={{ padding: 18 }}>
                  <div style={{ fontSize: 11.5, color: T.primary, fontWeight: 700, marginBottom: 6 }}>
                    {b.kategori || "Berita"}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: T.text, marginBottom: 8, lineHeight: 1.35 }}>
                    {b.judul}
                  </div>
                  <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5, margin: "0 0 14px" }}>
                    {b.ringkasan}
                  </p>
                  <div style={{ fontSize: 11.5, color: T.textMuted }}>
                    {new Date(b.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETAIL BERITA */}
      {subPage === "berita-detail" && beritaDetail && (
        <div style={{ maxWidth: 840, margin: "0 auto", padding: "32px 24px" }}>
          <button
            onClick={() => setSubPage("berita")}
            style={{
              background: "none",
              border: "none",
              color: T.primary,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 16,
              padding: 0,
            }}
          >
            <Icon name="arrowLeft" size={16} /> Kembali ke Daftar Berita
          </button>

          <span style={{ fontSize: 12, fontWeight: 700, color: T.primary, textTransform: "uppercase" }}>
            {beritaDetail.kategori || "Berita"}
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: T.text, margin: "8px 0 14px", lineHeight: 1.25 }}>
            {beritaDetail.judul}
          </h1>
          <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 20 }}>
            Ditulis oleh <b>{beritaDetail.penulis || "Tim Satu Data"}</b> •{" "}
            {new Date(beritaDetail.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
          </div>

          {beritaDetail.gambar_url && (
            <img
              src={beritaDetail.gambar_url}
              alt={beritaDetail.judul}
              style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 14, marginBottom: 24 }}
            />
          )}

          <div
            style={{
              fontSize: 15,
              lineHeight: 1.8,
              color: T.text,
              whiteSpace: "pre-line",
            }}
          >
            {beritaDetail.konten || beritaDetail.ringkasan}
          </div>
        </div>
      )}

      {/* ── 8. KATALOG DOKUMEN & SK ── */}
      {subPage === "katalog" && (
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: "0 0 6px" }}>
            Katalog Produk Hukum, SK & Publikasi Kajian
          </h1>
          <p style={{ fontSize: 13.5, color: T.textMuted, margin: "0 0 20px" }}>
            Dokumen regulasi Satu Data, Surat Keputusan Tim Pelaksana, dan laporan kajian pembangunan daerah
          </p>

          <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
            {["Produk Hukum", "SK Tim Satu Data", "Publikasi Kajian"].map((j) => (
              <button
                key={j}
                onClick={() => setKatalogJenis(j)}
                style={{
                  padding: "9px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: katalogJenis === j ? `2px solid ${T.primary}` : "2px solid transparent",
                  color: katalogJenis === j ? T.primary : T.textMuted,
                  fontWeight: katalogJenis === j ? 700 : 500,
                  fontSize: 13.5,
                  cursor: "pointer",
                }}
              >
                {j}
              </button>
            ))}
          </div>

          <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, boxShadow: T.shadow }}>
            <div style={{ textAlign: "center", padding: "30px 0", color: T.textMuted, fontSize: 13.5 }}>
              Dokumen resmi dapat diakses dan diunduh melalui panel publikasi Satu Data BAPPERIDA Sumba Barat.
            </div>
          </div>
        </div>
      )}

      {/* ── 9. TANYA DATA & PERMOHONAN DENGAN CAPTCHA ── */}
      {subPage === "tanya-data" && (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: "0 0 6px" }}>Layanan Tanya Data</h1>
          <p style={{ fontSize: 13.5, color: T.textMuted, margin: "0 0 24px" }}>
            Ajukan pertanyaan, konfirmasi data, atau permohonan dataset kepada Walidata Satu Data Kabupaten Sumba Barat
          </p>

          {qnaPesan.teks && (
            <div
              style={{
                padding: "14px 18px",
                borderRadius: 10,
                fontSize: 13.5,
                marginBottom: 20,
                background: qnaPesan.jenis === "sukses" ? "#ECFDF5" : "#FEF2F2",
                border: `1px solid ${qnaPesan.jenis === "sukses" ? "#A7F3D0" : "#FECACA"}`,
                color: qnaPesan.jenis === "sukses" ? "#065F46" : "#991B1B",
              }}
            >
              {qnaPesan.teks}
            </div>
          )}

          <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, boxShadow: T.shadow }}>
            <form onSubmit={handleKirimQna}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={qnaForm.nama}
                    onChange={(e) => setQnaForm({ ...qnaForm, nama: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13.5, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                    Asal Instansi / Universitas / Organisasi
                  </label>
                  <input
                    type="text"
                    value={qnaForm.organisasi}
                    onChange={(e) => setQnaForm({ ...qnaForm, organisasi: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13.5, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                    Alamat Email (untuk balasan)
                  </label>
                  <input
                    type="email"
                    value={qnaForm.email}
                    onChange={(e) => setQnaForm({ ...qnaForm, email: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13.5, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                    Nomor WhatsApp / Telepon
                  </label>
                  <input
                    type="text"
                    value={qnaForm.nomorhp}
                    onChange={(e) => setQnaForm({ ...qnaForm, nomorhp: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13.5, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                  Rincian Pertanyaan / Permohonan Data *
                </label>
                <textarea
                  rows={4}
                  required
                  value={qnaForm.pertanyaan}
                  onChange={(e) => setQnaForm({ ...qnaForm, pertanyaan: e.target.value })}
                  placeholder="Jelaskan kebutuhan data atau pertanyaan Anda secara rinci..."
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13.5, boxSizing: "border-box" }}
                />
              </div>

              {/* Captcha Verifikasi */}
              <div
                style={{
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 4 }}>Verifikasi Keamanan (Anti-Spam)</div>
                  {captcha.svg_base64 && (
                    <img src={captcha.svg_base64} alt="Captcha" style={{ borderRadius: 6 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ display: "block", fontSize: 11.5, color: T.textMuted, marginBottom: 4 }}>
                    Jawaban Hitungan di Samping:
                  </label>
                  <input
                    type="text"
                    required
                    value={qnaForm.captcha_jawaban}
                    onChange={(e) => setQnaForm({ ...qnaForm, captcha_jawaban: e.target.value })}
                    placeholder="Ketik angka hasil hitungan"
                    style={{ width: "100%", padding: "8px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13.5 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={muatCaptcha}
                  style={{ background: "none", border: "none", color: T.primary, cursor: "pointer", fontSize: 12 }}
                >
                  <Icon name="refresh" size={16} /> Ganti Soal
                </button>
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px",
                  background: T.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Kirim Pertanyaan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── FOOTER PORTAL SATU DATA ── */}
      <footer
        style={{
          borderTop: `1px solid ${T.border}`,
          padding: "36px 24px",
          background: isDark ? "#0F172A" : "#F8FAFC",
          fontSize: 13,
          color: T.textMuted,
          marginTop: 60,
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <b>Portal Satu Data Kabupaten Sumba Barat</b>
            <div style={{ marginTop: 4 }}>
              Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah (BAPPERIDA)
            </div>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="/feed/berita.xml" target="_blank" rel="noreferrer" style={{ color: T.textMuted, textDecoration: "none" }}>
              RSS Berita
            </a>
            <a href="/sitemap.xml" target="_blank" rel="noreferrer" style={{ color: T.textMuted, textDecoration: "none" }}>
              Sitemap
            </a>
            <a href="/manifest.webmanifest" target="_blank" rel="noreferrer" style={{ color: T.textMuted, textDecoration: "none" }}>
              PWA Manifest
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

