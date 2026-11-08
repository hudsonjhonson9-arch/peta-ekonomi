import { useState, useEffect, useContext, useMemo, useRef, useCallback } from "react";
import useResponsive from "../useResponsive.js";
import { ThemeContext } from "../App.jsx";
import { Icon, Badge } from "./ui.jsx";
import { Select } from "./customControls.jsx";
import * as XLSX from "xlsx";
import SumbaBaratMap from "./SumbaBaratMap.jsx";
import GrafikDataset from "./GrafikDataset.jsx";
import { PortalNavbar, PortalHero, SectionHead, DatasetCard, portalVars } from "./PortalChrome.jsx";
import { kitVars } from "./pageKit.jsx";
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


// Dokumen publikasi resmi dimuat secara dinamis dari tabel bapperida_dokumen WHERE publik = TRUE.

function getEmbedDriveUrl(url) {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  return url;
}

export default function PortalPublikLengkap({ onLoginClick, user = null }) {
  const { T, isDark } = useContext(ThemeContext);
  const { isMobile } = useResponsive();

  // Sub-navigasi portal: 'beranda' | 'dataset' | 'detail' | 'jelajah' | 'bandingkan' | 'visualisasi' | 'berita' | 'berita-detail' | 'katalog' | 'tanya-data'
  const [subPage, setSubPage] = useState("beranda");
  // Portal satu halaman: semua bagian tampil berurutan dan menu hanya melompat ke bagian.
  // "detail" dan "berita-detail" adalah tampilan lanjutan yang menggantikan halaman utama.
  const landing = subPage !== "detail" && subPage !== "berita-detail";
  const [aktifBagian, setAktifBagian] = useState("beranda");
  const pendingScroll = useRef(null);

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
  const [pilihanBandingkan, setPilihanBandingkan] = useState("");
  const [hasilBandingkan, setHasilBandingkan] = useState([]);
  const [loadingBandingkan, setLoadingBandingkan] = useState(false);

  const optionsBandingkan = useMemo(() => {
    return opsiIndikator.map((ds) => ({
      group: `${ds.nama} (${ds.opd_nama})`,
      options: (ds.numeric_fields || []).map((f) => ({
        value: `${ds.id}:${f.nama}:${ds.nama} - ${f.label}`,
        label: `${ds.nama} — ${f.label}`,
        sub: `Produsen: ${ds.opd_nama || "BAPPERIDA"} • Satuan: ${ds.satuan || "Angka"}`,
      })),
    }));
  }, [opsiIndikator]);

  const tambahIndikatorBandingkan = useCallback((val) => {
    const target = val || pilihanBandingkan;
    if (!target) return;
    const parts = target.split(":");
    if (parts.length >= 3) {
      const dsId = parts[0];
      const fName = parts[1];
      const label = parts.slice(2).join(":");
      setSelectedIndikators((prev) => {
        if (prev.some((s) => s.dataset_id === dsId && s.field_name === fName)) return prev;
        return [...prev, { dataset_id: dsId, field_name: fName, label }];
      });
    }
    setPilihanBandingkan("");
  }, [pilihanBandingkan]);

  // Visualisasi Makro
  const [visualisasiData, setVisualisasiData] = useState(null);

  // Berita & Konten
  const [beritaList, setBeritaList] = useState([]);
  const [beritaPopuler, setBeritaPopuler] = useState([]);
  const [beritaDetail, setBeritaDetail] = useState(null);
  const [katalogList, setKatalogList] = useState([]);
  const [katalogJenis, setKatalogJenis] = useState("Semua");
  const [katalogSearch, setKatalogSearch] = useState("");
  const [previewPublikasi, setPreviewPublikasi] = useState(null);


  const kategoriOpsi = useMemo(() => {
    const cats = new Set();
    katalogList.forEach((d) => {
      if (d.kategori) cats.add(d.kategori);
      else if (d.jenis) cats.add(d.jenis);
      else if (d.tipe) cats.add(d.tipe);
    });
    return ["Semua", ...Array.from(cats)];
  }, [katalogList]);


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

  // Leaderboard Cakupan Data per OPD
  const [leaderboardOpd, setLeaderboardOpd] = useState([]);
  const [lbTab, setLbTab] = useState("target_sk"); // "target_sk" | "volume"
  const [lbSearch, setLbSearch] = useState("");
  const [lbShowAll, setLbShowAll] = useState(false);

  // Catat kunjungan halaman setiap kali subPage berubah
  useEffect(() => {
    fetch("/api/portal/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: `/portal/${subPage}`, referrer: document.referrer }),
    }).catch(() => { });
  }, [subPage]);

  // Fungsi sinkronisasi data langsung dari PostgreSQL database dengan cooldown 5 detik
  const lastSyncRef = useRef(0);
  const muatSemuaDataPortal = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastSyncRef.current < 5000) return;
    lastSyncRef.current = now;

    fetch("/api/portal/ringkasan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRingkasan(d))
      .catch(() => { });

    fetch("/api/portal/jelajah/urusan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setListUrusan(Array.isArray(d) ? d : []))
      .catch(() => { });

    fetch("/api/portal/jelajah/topik", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setListTopik(Array.isArray(d) ? d : []))
      .catch(() => { });

    fetch("/api/portal/jelajah/organisasi", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setListOpd(Array.isArray(d) ? d : []))
      .catch(() => { });

    fetch("/api/portal/leaderboard-opd", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLeaderboardOpd(Array.isArray(d) ? d : []))
      .catch(() => { });

    fetch("/api/portal/berita?limit=6", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setBeritaList(d.data || []))
      .catch(() => { });

    fetch("/api/portal/berita/populer", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBeritaPopuler(Array.isArray(d) ? d : []))
      .catch(() => { });

    fetch("/api/portal/katalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (Array.isArray(d)) {
          setKatalogList(d);
        }
      })
      .catch((err) => {
        console.error("Katalog publikasi load error:", err);
        setKatalogList([]);
      });
  }, []);

  // Muat data langsung dari database saat komponen dipasang dan berkala tiap 40 detik
  useEffect(() => {
    muatSemuaDataPortal(true);
    const interval = setInterval(() => muatSemuaDataPortal(false), 40000);
    const onFocus = () => muatSemuaDataPortal(false);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [muatSemuaDataPortal]);

  // Fetch Dataset List saat filter berubah
  useEffect(() => {
    if (!landing) return;
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
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [landing, searchQ, filterOpd, filterTopik, filterUrusan, sortOrder]);

  const BAGIAN = ["beranda", "dataset", "jelajah", "leaderboard", "peta", "bandingkan", "visualisasi", "berita", "katalog", "tanya-data"];

  // Logika pengurutan & filter Leaderboard OPD
  const lbSortedRows = useMemo(() => {
    const list = [...leaderboardOpd];
    if (lbTab === "target_sk") {
      return list.sort((a, b) => {
        if (b.persentase_sk !== a.persentase_sk) return b.persentase_sk - a.persentase_sk;
        if (b.realisasi_sk !== a.realisasi_sk) return b.realisasi_sk - a.realisasi_sk;
        return a.nama.localeCompare(b.nama);
      });
    } else {
      return list.sort((a, b) => {
        if (b.total_dataset !== a.total_dataset) return b.total_dataset - a.total_dataset;
        if (b.disetujui !== a.disetujui) return b.disetujui - a.disetujui;
        return a.nama.localeCompare(b.nama);
      });
    }
  }, [leaderboardOpd, lbTab]);

  const lbFilteredRows = useMemo(() => {
    if (!lbSearch.trim()) return lbSortedRows;
    const q = lbSearch.toLowerCase();
    return lbSortedRows.filter((r) => `${r.nama} ${r.singkatan || ""}`.toLowerCase().includes(q));
  }, [lbSortedRows, lbSearch]);

  const lbDisplayList = lbShowAll ? lbFilteredRows : lbFilteredRows.slice(0, 6);

  const lbAvgPct = useMemo(() => {
    const valid = leaderboardOpd.filter((r) => Number(r.target_sk) > 0);
    if (!valid.length) return 0;
    const sum = valid.reduce((acc, r) => acc + Number(r.persentase_sk || 0), 0);
    return Math.round(sum / valid.length);
  }, [leaderboardOpd]);

  // Gulir ke bagian yang sedang ditunggu. Hanya memakai ref dan DOM, jadi aman dipanggil dari mana saja.
  const scrollKeBagian = () => {
    const sub = pendingScroll.current;
    if (!sub) return;
    if (sub === "beranda") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      pendingScroll.current = null;
      return;
    }
    const el = document.getElementById(`bagian-${sub}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      pendingScroll.current = null;
    }
  };

  const lompatKe = (sub) => {
    pendingScroll.current = sub;
    setAktifBagian(sub);
    // Dari tampilan detail, kembali dulu ke halaman utama; efek di bawah yang menggulir.
    setSubPage((p) => (p === "detail" || p === "berita-detail" ? "beranda" : p));
    requestAnimationFrame(scrollKeBagian);
  };

  useEffect(() => {
    scrollKeBagian();
  }, [subPage]);

  // Sorot menu sesuai bagian yang sedang terlihat
  useEffect(() => {
    if (!landing || typeof IntersectionObserver === "undefined") return;
    const els = BAGIAN.filter((b) => b !== "beranda")
      .map((b) => document.getElementById(`bagian-${b}`))
      .filter(Boolean);
    if (!els.length) return;
    const terlihat = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const k = e.target.id.replace("bagian-", "");
          if (e.isIntersecting) terlihat.add(k);
          else terlihat.delete(k);
        });
        const urut = BAGIAN.filter((b) => terlihat.has(b));
        setAktifBagian(urut.length ? urut[0] : "beranda");
      },
      { rootMargin: "-130px 0px -55% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [landing]);

  const navigasiPortal = (sub, id = null) => {
    if (sub === "detail" && id) {
      setSelectedDatasetId(id);
      setSubPage("detail");
      history.replaceState(null, "", `#publik/dataset/${id}`);
      window.scrollTo({ top: 0 });
      return;
    }
    if (BAGIAN.includes(sub)) {
      if (sub === "dataset") {
        setSelectedDatasetId(null);
        setDatasetDetail(null);
      }
      history.replaceState(null, "", sub === "beranda" ? "#publik" : `#publik/${sub}`);
      lompatKe(sub);
      return;
    }
    setSubPage(sub);
    history.replaceState(null, "", `#publik/${sub}`);
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
          lompatKe(sub);
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
    window.scrollTo({ top: 0 });
    try {
      history.replaceState(null, "", `#publik/dataset/${id}`);
    } catch (_) { }
    fetch(`/api/portal/dataset/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setDatasetDetail(d);
          const firstNumeric = (d.fields || []).find((f) => f.tipe_data === "angka" || f.tipe_data === "desimal" || f.tampil_grafik);
          setSelectedChartField(firstNumeric?.nama_field || d.fields?.[0]?.nama_field || "");
        }
      })
      .catch(() => { })
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
    if (landing && !opsiIndikator.length) {
      fetch("/api/portal/bandingkan/indikator")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setOpsiIndikator(Array.isArray(d) ? d : []))
        .catch(() => { });
    }
  }, [landing, opsiIndikator.length]);

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
      .catch(() => { })
      .finally(() => setLoadingBandingkan(false));
  };

  // Muat Visualisasi Makro
  useEffect(() => {
    if (landing && !visualisasiData) {
      fetch("/api/portal/visualisasi")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setVisualisasiData(d))
        .catch(() => { });
    }
  }, [landing, visualisasiData]);

  // Muat Captcha untuk Tanya Data
  const muatCaptcha = () => {
    fetch("/api/portal/captcha")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCaptcha(d))
      .catch(() => { });
  };

  useEffect(() => {
    if (landing) muatCaptcha();
  }, [landing]);

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
    <div className="pk" style={{ minHeight: "100dvh", background: T.bg, color: T.text, fontFamily: T.font, ...kitVars(T, isDark), ...portalVars(isDark) }}>
      {/* ── NAVBAR PORTAL SATU DATA ── */}
      <PortalNavbar subPage={subPage === "berita-detail" ? "berita" : subPage === "detail" ? "dataset" : aktifBagian} onNav={navigasiPortal} user={user} onLoginClick={onLoginClick} />

      {/* ── 1. BERANDA PORTAL ── */}
      {landing && (
        <div id="bagian-beranda">
          <PortalHero searchQ={searchQ} setSearchQ={setSearchQ} onNav={navigasiPortal} ringkasan={ringkasan} />

          {/* Dataset populer */}
          <section className="pp-sec" style={{ paddingBottom: 48 }}>
            <SectionHead
              title="Dataset sektoral populer"
              desc="Kumpulan data statistik yang paling banyak diakses oleh publik dan akademisi"
              actionLabel={`Lihat semua (${ringkasan?.total_dataset ?? 0})`}
              onAction={() => navigasiPortal("dataset")}
            />
            <div className="pp-cards">
              {(ringkasan?.populer || datasetList.slice(0, 6)).map((d) => (
                <DatasetCard key={d.id} d={d} onOpen={bukaDetailDataset} />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── 2. KATALOG DATASET PUBLIK ── */}
      {landing && (
        <div id="bagian-dataset" className="pp-anchor" style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 16px" }}>
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
                <Select
                  fullWidth
                  searchable
                  value={filterOpd}
                  placeholder="Semua Perangkat Daerah"
                  onChange={(val) => setFilterOpd(val)}
                  options={[
                    { value: "", label: "Semua Perangkat Daerah" },
                    ...listOpd.map((o) => ({ value: String(o.id), label: o.nama, sub: o.singkatan })),
                  ]}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>
                  Topik Pembangunan
                </label>
                <Select
                  fullWidth
                  searchable
                  value={filterTopik}
                  placeholder="Semua Topik"
                  onChange={(val) => setFilterTopik(val)}
                  options={[
                    { value: "", label: "Semua Topik" },
                    ...listTopik.map((t) => ({ value: String(t.id), label: t.nama_topik })),
                  ]}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>
                  Urusan Pemerintahan
                </label>
                <Select
                  fullWidth
                  searchable
                  value={filterUrusan}
                  placeholder="Semua Urusan"
                  onChange={(val) => setFilterUrusan(val)}
                  options={[
                    { value: "", label: "Semua Urusan" },
                    ...listUrusan.map((u) => ({ value: String(u.id), label: `${u.kode_urusan} ${u.nama_urusan}` })),
                  ]}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>
                  Urutkan
                </label>
                <Select
                  fullWidth
                  value={sortOrder}
                  onChange={(val) => setSortOrder(val)}
                  options={[
                    { value: "terbaru", label: "Terbaru Diverifikasi" },
                    { value: "populer", label: "Paling Sering Dilihat" },
                    { value: "nama-asc", label: "Nama Indikator (A-Z)" },
                    { value: "nama-desc", label: "Nama Indikator (Z-A)" },
                  ]}
                />
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
                      {d.polaritas === "negatif" && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "#FEF2F2",
                          color: "#DC2626",
                          border: "1px solid #FECACA",
                          marginLeft: "auto",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}>
                          <Icon name="trendingDown" size={10} /> Minimasi
                        </span>
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
            onClick={() => navigasiPortal("dataset")}
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
              {datasetDetail.polaritas === "negatif" ? (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: "#FEF2F2",
                    color: "#DC2626",
                    border: "1px solid #FECACA",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Indikator Minimasi: Nilai yang semakin kecil / menurun menandakan capaian positif"
                >
                  <Icon name="trendingDown" size={13} /> Target Minimasi (Semakin kecil semakin baik)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: "#ECFDF5",
                    color: "#059669",
                    border: "1px solid #A7F3D0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Indikator Maksimasi: Nilai yang semakin tinggi menandakan capaian positif"
                >
                  <Icon name="trendingUp" size={13} /> Target Maksimasi (Semakin besar semakin baik)
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
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12.5, color: T.textMuted, flexWrap: "wrap" }}>
                <span>Frekuensi: <b>{datasetDetail.frekuensi || "Tahunan"}</b></span>
                <span>Satuan: <b>{datasetDetail.satuan || "—"}</b></span>
                <span>Jumlah Baris: <b>{datasetDetail.rows?.length ?? 0}</b></span>
                <span>
                  Arah Capaian:{" "}
                  <b style={{ color: datasetDetail.polaritas === "negatif" ? "#DC2626" : "#059669" }}>
                    {datasetDetail.polaritas === "negatif" ? "Minimasi (Makin kecil makin bagus)" : "Maksimasi (Makin besar makin bagus)"}
                  </b>
                </span>
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Pilih Indikator / Kolom:</label>
                  <div style={{ minWidth: 240 }}>
                    <Select
                      value={selectedChartField}
                      onChange={(val) => setSelectedChartField(val)}
                      options={(datasetDetail.fields || []).map((f) => ({
                        value: f.nama_field,
                        label: f.label || f.nama_field,
                      }))}
                    />
                  </div>
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
                  onSelectKecamatan={() => { }}
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
                        href={/^(https?:|\/)/i.test(l.url_file) ? l.url_file : "#"}
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
      {landing && (
        <div id="bagian-jelajah" className="pp-anchor" style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 16px" }}>
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
                    navigasiPortal("dataset");
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
                    navigasiPortal("dataset");
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
                    navigasiPortal("dataset");
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

      {/* ── 4a. LEADERBOARD CAKUPAN DATA PER OPD ── */}
      {landing && (
        <div id="bagian-leaderboard" className="pp-anchor" style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 16px" }}>
          {/* Header Widget */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="award" size={18} />
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0 }}>
                  Leaderboard Cakupan Data per OPD
                </h1>
                <span style={{ fontSize: 11.5, fontWeight: 700, background: "#ECFDF5", color: "#059669", padding: "3px 10px", borderRadius: 99, border: "1px solid #BBF7D0" }}>
                  Rata-rata {lbAvgPct}%
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: T.textMuted, margin: "6px 0 0" }}>
                Peringkat ketercapaian target SK Bupati dan keaktifan produsen data Kabupaten Sumba Barat
              </p>
            </div>

            {/* Tab Toggle Mode */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.card, border: `1px solid ${T.border}`, padding: 4, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => setLbTab("target_sk")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background: lbTab === "target_sk" ? T.primary : "transparent",
                  color: lbTab === "target_sk" ? "#fff" : T.textSecondary,
                  boxShadow: lbTab === "target_sk" ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                Target SK Bupati
              </button>
              <button
                type="button"
                onClick={() => setLbTab("volume")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  background: lbTab === "volume" ? T.primary : "transparent",
                  color: lbTab === "volume" ? "#fff" : T.textSecondary,
                  boxShadow: lbTab === "volume" ? "0 1px 3px rgba(37,99,235,0.3)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                Volume Dataset
              </button>
            </div>
          </div>

          {/* Kartu Kontainer Leaderboard */}
          <div style={{ background: T.cardBg || T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, boxShadow: T.shadow }}>
            {/* Bar Pencarian */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Cari perangkat daerah (OPD)..."
                value={lbSearch}
                onChange={(e) => setLbSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 34px",
                  borderRadius: 8,
                  border: `1px solid ${T.border}`,
                  background: T.inputBg || T.card,
                  color: T.text,
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textMuted, display: "flex" }}>
                <Icon name="search" size={14} />
              </span>
            </div>

            {/* Tabel Leaderboard */}
            <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.surfaceHover || "rgba(0,0,0,0.02)", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontSize: 11, textAlign: "left" }}>
                    <th style={{ padding: "8px 12px", width: 60, textAlign: "center" }}>Rank</th>
                    <th style={{ padding: "8px 12px" }}>Perangkat Daerah</th>
                    {lbTab === "target_sk" ? (
                      <>
                        <th style={{ padding: "8px 12px", width: 110 }}>Target SK</th>
                        <th style={{ padding: "8px 12px", width: 150 }}>Realisasi Dataset</th>
                        <th style={{ padding: "8px 12px", minWidth: 160 }}>Ketercapaian</th>
                        <th style={{ padding: "8px 12px", width: 110, textAlign: "right" }}>Status</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: "8px 12px", width: 110 }}>Total Dataset</th>
                        <th style={{ padding: "8px 12px", width: 110 }}>Disetujui</th>
                        <th style={{ padding: "8px 12px", width: 120 }}>Menunggu Verval</th>
                        <th style={{ padding: "8px 12px", width: 90, textAlign: "right" }}>Draf</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lbDisplayList.map((row, idx) => {
                    const rank = idx + 1;
                    let rankBadgeBg = T.surfaceHover || "rgba(0,0,0,0.04)";
                    let rankBadgeColor = T.textSecondary;
                    let rankLabel = `#${rank}`;
                    if (rank === 1) {
                      rankBadgeBg = "#FEF9C3";
                      rankBadgeColor = "#854D0E";
                      rankLabel = "#1";
                    } else if (rank === 2) {
                      rankBadgeBg = "#F1F5F9";
                      rankBadgeColor = "#334155";
                      rankLabel = "#2";
                    } else if (rank === 3) {
                      rankBadgeBg = "#FFEDD5";
                      rankBadgeColor = "#9A3412";
                      rankLabel = "#3";
                    }

                    const pct = Number(row.persentase_sk || 0);
                    const statusColor = pct >= 80 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
                    const statusLabel = pct >= 80 ? "Sangat Baik" : pct >= 50 ? "Sedang" : "Rendah";

                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: idx < lbDisplayList.length - 1 ? `1px solid ${T.border}` : "none",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 26,
                              height: 24,
                              padding: "0 6px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: rankBadgeBg,
                              color: rankBadgeColor,
                            }}
                          >
                            {rankLabel}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div
                            onClick={() => {
                              setFilterOpd(row.id);
                              navigasiPortal("dataset");
                            }}
                            style={{ cursor: "pointer" }}
                            title="Klik untuk menyaring dataset dari OPD ini di katalog"
                          >
                            <span style={{ fontWeight: 600, color: T.primary }}>
                              {row.nama}
                            </span>
                            {row.singkatan && (
                              <div style={{ fontSize: 11, color: T.textMuted }}>{row.singkatan}</div>
                            )}
                          </div>
                        </td>
                        {lbTab === "target_sk" ? (
                          <>
                            <td style={{ padding: "10px 12px", color: T.textSecondary }}>
                              {Number(row.target_sk) > 0 ? (
                                <span style={{ fontWeight: 600 }}>{row.target_sk} Dataset</span>
                              ) : (
                                <span style={{ color: T.textMuted, fontStyle: "italic" }}>Belum ada SK</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontWeight: 700, color: T.text }}>{row.realisasi_sk || row.total_dataset || 0}</span>
                              <span style={{ fontSize: 11, color: T.textMuted }}> ({row.disetujui_sk || row.disetujui || 0} disetujui)</span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, height: 7, background: T.surfaceHover || "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden" }}>
                                  <div
                                    style={{
                                      width: `${Math.min(100, pct)}%`,
                                      height: "100%",
                                      background: statusColor,
                                      borderRadius: 99,
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor, width: 38 }}>
                                  {pct}%
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right" }}>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  background: `${statusColor}18`,
                                  color: statusColor,
                                  border: `1px solid ${statusColor}33`,
                                }}
                              >
                                {Number(row.target_sk) > 0 ? statusLabel : "Belum SK"}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: T.text }}>
                              {row.total_dataset || 0} Dataset
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ color: "#16A34A", fontWeight: 600 }}>{row.disetujui || 0}</span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {Number(row.menunggu_verval) > 0 ? (
                                <span style={{ color: "#D97706", fontWeight: 600 }}>{row.menunggu_verval} dataset</span>
                              ) : (
                                <span style={{ color: T.textMuted }}>0</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: T.textMuted }}>
                              {row.draft || 0}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {lbFilteredRows.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>
                        Tidak ada perangkat daerah yang cocok dengan kata kunci &quot;{lbSearch}&quot;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Leaderboard */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 11.5, color: T.textMuted, flexWrap: "wrap", gap: 10 }}>
              <div>
                Menampilkan {lbDisplayList.length} dari {lbFilteredRows.length} Perangkat Daerah Kabupaten Sumba Barat
              </div>
              {lbFilteredRows.length > 6 && (
                <button
                  type="button"
                  onClick={() => setLbShowAll(!lbShowAll)}
                  style={{
                    background: "none",
                    border: "none",
                    color: T.primary,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 11.5,
                    fontFamily: "inherit",
                    padding: 0,
                  }}
                >
                  {lbShowAll ? "Tampilkan Lebih Sedikit ↑" : `Lihat Semua (${lbFilteredRows.length} OPD) ↓`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 4b. PETA WILAYAH ── */}
      {landing && (
        <div id="bagian-peta" className="pp-anchor" style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 16px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: "0 0 6px" }}>Peta Wilayah Kabupaten Sumba Barat</h1>
          <p style={{ fontSize: 13.5, color: T.textMuted, margin: "0 0 24px" }}>
            Batas administrasi kecamatan berdasarkan kode wilayah Kemendagri 53.12
          </p>
          <div style={{ background: T.cardBg || T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, boxShadow: T.shadow }}>
            <SumbaBaratMap
              mode="wilayah"
              title="Peta Administrasi Kecamatan"
              subtitle="Arahkan kursor ke poligon kecamatan untuk melihat nama dan jumlah desa"
              height={460}
            />
          </div>
        </div>
      )}

      {/* ── 5. BANDINGKAN INDIKATOR ── */}
      {landing && (
        <div id="bagian-bandingkan" className="pp-anchor" style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 16px" }}>
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
              <div style={{ minWidth: 320, flex: "1 1 340px", maxWidth: 640 }}>
                <Select
                  fullWidth
                  searchable
                  value={pilihanBandingkan}
                  placeholder="— Cari dan pilih indikator data —"
                  onChange={(val) => setPilihanBandingkan(val)}
                  options={optionsBandingkan}
                />
              </div>

              <button
                type="button"
                onClick={() => tambahIndikatorBandingkan()}
                disabled={!pilihanBandingkan}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 18px",
                  background: pilihanBandingkan ? T.primary : T.surfaceHover || "#E2E8F0",
                  color: pilihanBandingkan ? "#fff" : T.textMuted,
                  border: "none",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: pilihanBandingkan ? "pointer" : "default",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon name="plus" size={14} />
                <span>Tambah Indikator</span>
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
      {landing && (
        <div id="bagian-visualisasi" className="pp-anchor" style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 16px" }}>
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
      {landing && (
        <div id="bagian-berita" className="pp-anchor" style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 16px" }}>
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
                  window.scrollTo({ top: 0 });
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
            onClick={() => navigasiPortal("berita")}
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

      {/* ── 8. KATALOG DOKUMEN & PUBLIKASI PERENCANAAN DAERAH ── */}
      {landing && (
        <div id="bagian-katalog" className="pp-anchor" style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 24px 20px" }}>
          {/* Header Bagian */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
            <div style={{ maxWidth: 680 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: `${T.primary}15`, color: T.primary, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
                <Icon name="archive" size={13} />
                Keterbukaan Informasi Publik
              </div>
              <h2 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: T.text, margin: "0 0 8px", lineHeight: 1.25 }}>
                Dokumen Publikasi & Perencanaan Daerah
              </h2>
              <p style={{ fontSize: 14, color: T.textSecondary, margin: 0, lineHeight: 1.6 }}>
                Akses resmi dokumen perencanaan jangka panjang (RPJPD), jangka menengah (RPJMD), rencana tahunan (RKPD), laporan akuntabilitas kinerja (LKjIP), kajian riset makro, serta produk hukum Kabupaten Sumba Barat.
              </p>
            </div>

            {/* Statistik Ringkas */}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 16px", textAlign: "center", minWidth: 90 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.primary }}>{katalogList.length}</div>
                <div style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Dokumen</div>
              </div>
              <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 16px", textAlign: "center", minWidth: 90 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#10B981" }}>
                  {(() => {
                    const years = katalogList.map(d => Number(d.tahun)).filter(y => y > 1900 && y < 2100);
                    if (!years.length) return "2025";
                    const min = Math.min(...years);
                    const max = Math.max(...years);
                    return min === max ? String(min) : `${min}–${max}`;
                  })()}
                </div>
                <div style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 600, textTransform: "uppercase" }}>Rentang Waktu</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 24, boxShadow: T.shadowSm }}>
            {/* Input Pencarian */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Cari judul dokumen, nomor regulasi (Perda/Perbup/SK), topik, atau instansi..."
                value={katalogSearch}
                onChange={(e) => setKatalogSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 38px 10px 14px",
                  borderRadius: 9,
                  border: `1.5px solid ${T.border}`,
                  fontSize: 13.5,
                  background: T.inputBg || (isDark ? "#1E293B" : "#F8FAFC"),
                  color: T.text,
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.15s ease",
                }}
              />
              {katalogSearch ? (
                <button
                  type="button"
                  onClick={() => setKatalogSearch("")}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textMuted, cursor: "pointer", display: "flex" }}
                >
                  <Icon name="x" size={15} />
                </button>
              ) : (
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none", display: "flex" }}>
                  <Icon name="search" size={16} />
                </div>
              )}
            </div>

            {/* Kategori Tab Filter Pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {kategoriOpsi.map((kat) => {
                const count = kat === "Semua"
                  ? katalogList.length
                  : katalogList.filter((d) => d.jenis === kat || d.kategori === kat || d.tipe === kat).length;
                const active = katalogJenis === kat;
                return (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => setKatalogJenis(kat)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: active ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                      background: active ? T.primaryLight || `${T.primary}18` : "transparent",
                      color: active ? T.primary : T.textSecondary,
                      fontWeight: active ? 700 : 500,
                      fontSize: 12.5,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{kat === "Semua" ? "Semua Dokumen" : kat}</span>
                    <span style={{
                      fontSize: 10.5,
                      padding: "1px 6px",
                      borderRadius: 99,
                      background: active ? T.primary : (T.surfaceHover || "rgba(0,0,0,0.06)"),
                      color: active ? "#fff" : T.textMuted,
                      fontWeight: 700,
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daftar Kartu Dokumen */}
          {(() => {
            const filteredDocs = katalogList.filter((doc) => {
              const matchKat = katalogJenis === "Semua" || doc.jenis === katalogJenis || doc.kategori === katalogJenis || doc.tipe === katalogJenis;
              const q = katalogSearch.trim().toLowerCase();
              const matchQ =
                !q ||
                (doc.judul || "").toLowerCase().includes(q) ||
                (doc.nomor || "").toLowerCase().includes(q) ||
                (doc.deskripsi || "").toLowerCase().includes(q) ||
                (doc.instansi || "").toLowerCase().includes(q) ||
                (doc.jenis || "").toLowerCase().includes(q) ||
                (doc.kategori || "").toLowerCase().includes(q) ||
                (doc.tipe || "").toLowerCase().includes(q);
              return matchKat && matchQ;
            });

            if (filteredDocs.length === 0) {
              return (
                <div style={{ background: T.cardBg, border: `1px dashed ${T.border}`, borderRadius: 14, padding: "50px 20px", textAlign: "center" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: T.surfaceHover || "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: T.textMuted }}>
                    <Icon name="search" size={22} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                    Dokumen Tidak Ditemukan
                  </div>
                  <div style={{ fontSize: 13, color: T.textMuted, maxWidth: 420, margin: "0 auto 16px" }}>
                    Tidak ada dokumen yang cocok dengan kata kunci "{katalogSearch}". Coba kata kunci lain atau pilih kategori "Semua Dokumen".
                  </div>
                  <button
                    type="button"
                    onClick={() => { setKatalogSearch(""); setKatalogJenis("Semua"); }}
                    style={{ padding: "8px 16px", borderRadius: 8, background: T.primary, color: "#fff", border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                  >
                    Reset Pencarian
                  </button>
                </div>
              );
            }

            return (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(370px, 1fr))", gap: 16 }}>
                {filteredDocs.map((doc) => {
                  const isPerencanaan = (doc.jenis || "").includes("Perencanaan");
                  const isEvaluasi = (doc.jenis || "").includes("Evaluasi");
                  const isRiset = (doc.jenis || "").includes("Riset");
                  const isHukum = (doc.jenis || "").includes("Hukum") || (doc.jenis || "").includes("SK");

                  const badgeColor = isPerencanaan ? "#2563EB" : isEvaluasi ? "#D97706" : isRiset ? "#059669" : isHukum ? "#7C3AED" : T.primary;
                  const badgeBg = isPerencanaan ? "#EFF6FF" : isEvaluasi ? "#FEF3C7" : isRiset ? "#ECFDF5" : isHukum ? "#F5F3FF" : `${T.primary}15`;

                  return (
                    <div
                      key={doc.id || doc.judul}
                      style={{
                        background: T.cardBg,
                        border: `1px solid ${T.border}`,
                        borderRadius: 14,
                        padding: "18px 20px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        boxShadow: T.shadowSm,
                        transition: "all 0.2s ease",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = T.primary;
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = T.border;
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = T.shadowSm;
                      }}
                    >
                      <div>
                        {/* Baris Badge & Metadata */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: badgeBg, color: badgeColor }}>
                            {doc.jenis || "Dokumen Resmi"}
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: T.textMuted }}>
                            {doc.tahun ? `Tahun ${doc.tahun}` : "Resmi"}
                          </span>
                        </div>

                        {/* Judul Dokumen */}
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 6px", lineHeight: 1.4 }}>
                          {doc.judul}
                        </h3>

                        {/* Nomor Dokumen / Regulasi */}
                        {doc.nomor && (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.textSecondary, fontFamily: "monospace", background: T.surfaceHover || "rgba(0,0,0,0.03)", padding: "2px 7px", borderRadius: 4, marginBottom: 8 }}>
                            <Icon name="file" size={11} />
                            <span>{doc.nomor}</span>
                          </div>
                        )}

                        {/* Deskripsi Singkat */}
                        {doc.deskripsi && (
                          <p style={{ fontSize: 12.5, color: T.textSecondary, margin: "0 0 14px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {doc.deskripsi}
                          </p>
                        )}
                      </div>

                      {/* Footer Kartu & Tombol Aksi */}
                      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 11.5, color: T.textMuted, display: "flex", alignItems: "center", gap: 5 }}>
                          <Icon name="building" size={12} />
                          <span title={doc.instansi || "BAPPERIDA"}>
                            {doc.instansi ? (doc.instansi.length > 25 ? doc.instansi.substring(0, 25) + "..." : doc.instansi) : "BAPPERIDA Kab. Sumba Barat"}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 6 }}>
                          {doc.file_url && (
                            <button
                              type="button"
                              onClick={() => setPreviewPublikasi(doc)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "6px 11px",
                                borderRadius: 7,
                                background: T.surfaceHover || "rgba(0,0,0,0.04)",
                                color: T.text,
                                border: `1px solid ${T.border}`,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "all 0.12s ease",
                              }}
                            >
                              <Icon name="eye" size={13} />
                              <span>Lihat</span>
                            </button>
                          )}
                          <a
                            href={doc.file_url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={!doc.file_url?.includes("drive.google.com")}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 12px",
                              borderRadius: 7,
                              background: T.primary,
                              color: "#fff",
                              textDecoration: "none",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                            }}
                          >
                            <Icon name="download" size={13} />
                            <span>Unduh</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Kotak Informasi Hukum & Keterbukaan */}
          <div style={{ marginTop: 24, background: `${T.primary}08`, border: `1px solid ${T.primary}25`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ color: T.primary, marginTop: 2 }}>
              <Icon name="shield" size={18} />
            </div>
            <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.6 }}>
              Seluruh dokumen publikasi, rencana pembangunan, dan produk hukum yang dipublikasikan di halaman ini merupakan salinan resmi pemerintah daerah sesuai amanat <b>Undang-Undang No. 14 Tahun 2008 tentang Keterbukaan Informasi Publik (KIP)</b>. Untuk permohonan salinan cetak atau informasi data lebih lanjut, Anda dapat menggunakan layanan <b>Tanya Data</b> di bawah ini.
            </div>
          </div>
        </div>
      )}

      {/* ── 9. TANYA DATA & PERMOHONAN DENGAN CAPTCHA ── */}
      {landing && (
        <div id="bagian-tanya-data" className="pp-anchor" style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 16px" }}>
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
      
      {/* ── MODAL PRATINJAU DOKUMEN PUBLIKASI ── */}
      {previewPublikasi && (
        <div
          onClick={() => setPreviewPublikasi(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.72)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 12 : 24,
            boxSizing: "border-box",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.cardBg,
              borderRadius: 16,
              width: "100%",
              maxWidth: 960,
              height: isMobile ? "92vh" : "88vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
              border: `1px solid ${T.border}`,
            }}
          >
            {/* Header Modal */}
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${T.primary}18`, color: T.primary }}>
                    {previewPublikasi.jenis || "Dokumen Publikasi"}
                  </span>
                  {previewPublikasi.nomor && (
                    <span style={{ fontSize: 11.5, color: T.textMuted, fontFamily: "monospace" }}>
                      {previewPublikasi.nomor}
                    </span>
                  )}
                </div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={previewPublikasi.judul}>
                  {previewPublikasi.judul}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPublikasi(null)}
                style={{ background: T.surfaceHover || "rgba(0,0,0,0.06)", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: T.textSecondary, cursor: "pointer" }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* Viewer Area (Iframe atau Google Drive Embed) */}
            <div style={{ flex: 1, background: isDark ? "#0F172A" : "#F1F5F9", position: "relative" }}>
              {previewPublikasi.file_url ? (
                <iframe
                  src={getEmbedDriveUrl(previewPublikasi.file_url)}
                  title={previewPublikasi.judul}
                  width="100%"
                  height="100%"
                  style={{ border: "none", position: "absolute", inset: 0 }}
                  allow="autoplay"
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: 30, textAlign: "center", color: T.textMuted }}>
                  <Icon name="file" size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                    Tautan Pratinjau Belum Tersedia
                  </div>
                  <div style={{ fontSize: 13, maxWidth: 360 }}>
                    Dokumen ini dapat diminta secara resmi melalui bagian Layanan Tanya Data di Portal Publik.
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", background: T.cardBg }}>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                Penerbit: <b>{previewPublikasi.instansi || "BAPPERIDA Kabupaten Sumba Barat"}</b>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {previewPublikasi.file_url && (
                  <a
                    href={/^(https?:|\/)/i.test(previewPublikasi.file_url) ? previewPublikasi.file_url : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 14px",
                      borderRadius: 8,
                      background: T.surfaceHover || "rgba(0,0,0,0.06)",
                      color: T.text,
                      textDecoration: "none",
                      fontSize: 12.5,
                      fontWeight: 600,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    <Icon name="externalLink" size={13} />
                    <span>Buka di Tab Baru</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewPublikasi(null)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 8,
                    background: T.primary,
                    color: "#fff",
                    border: "none",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

