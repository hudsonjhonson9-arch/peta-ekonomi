import { useState, useContext, useEffect, useMemo } from "react";
import { ThemeContext } from "../App.jsx";
import useResponsive from "../useResponsive.js";
import { Icon, Badge, Select } from "./ui.jsx";

function makeStyles(T) {
  const btnBase = {
    fontFamily: T.font,
    fontWeight: 600,
    borderRadius: T.radius,
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.15s ease",
    outline: "none",
    whiteSpace: "nowrap",
  };
  const btnPrimary = {
    ...btnBase,
    background: T.primary,
    color: "#fff",
    padding: "9px 16px",
    fontSize: 13,
    boxShadow: "0 1px 3px rgba(37,99,235,0.3)",
  };
  const btnGhost = {
    ...btnBase,
    background: "transparent",
    color: T.textSecondary,
    padding: "8px 12px",
    fontSize: 12,
  };
  const cardStyle = {
    background: T.card,
    borderRadius: T.radiusLg,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowSm,
  };
  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    fontFamily: T.font,
    border: `1.5px solid ${T.border}`,
    borderRadius: T.radius,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
    color: T.text,
    background: T.inputBg,
  };
  return { btnBase, btnPrimary, btnGhost, cardStyle, inputStyle };
}

export default function DokumentasiApiPage({ user }) {
  const { T, isDark } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const s = useMemo(() => makeStyles(T), [T]);

  const [tabAktif, setTabAktif] = useState("endpoints"); // 'endpoints' | 'auth' | 'tester' | 'scheduler'
  const [toast, setToast] = useState("");
  const [endpointTerbuka, setEndpointTerbuka] = useState("list");
  const [langTab, setLangTab] = useState("curl"); // 'curl' | 'js' | 'python'

  // Tester State
  const [testEndpoint, setTestEndpoint] = useState("/api/v1/dataset-sektoral");
  const [testToken, setTestToken] = useState("");
  const [testParams, setTestParams] = useState({ page: "1", per_page: "5", q: "", tahun: "2025" });
  const [testId, setTestId] = useState("1");
  const [loadingTest, setLoadingTest] = useState(false);
  const [testResponse, setTestResponse] = useState(null);
  const [testLatency, setTestLatency] = useState(null);

  // Scheduler State
  const [schedulerData, setSchedulerData] = useState(null);
  const [loadingScheduler, setLoadingScheduler] = useState(false);
  const [runningScheduler, setRunningScheduler] = useState(false);

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const salinTeks = (text, label) => {
    navigator.clipboard?.writeText(text);
    showToastMsg(`${label || "Teks"} berhasil disalin ke clipboard`);
  };

  const muatStatusScheduler = async () => {
    setLoadingScheduler(true);
    try {
      const res = await fetch("/api/monitoring/scheduler");
      if (res.ok) {
        const data = await res.json();
        setSchedulerData(data);
      }
    } catch (_) {}
    setLoadingScheduler(false);
  };

  const jalankanSchedulerManual = async () => {
    setRunningScheduler(true);
    try {
      const res = await fetch("/api/monitoring/scheduler/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToastMsg(data.message || "Scheduler berhasil dijalankan");
        muatStatusScheduler();
      } else {
        showToastMsg("Gagal: " + (data.error || "Terjadi kesalahan"));
      }
    } catch (e) {
      showToastMsg("Gagal menghubungi server");
    } finally {
      setRunningScheduler(false);
    }
  };

  useEffect(() => {
    if (tabAktif === "scheduler") {
      muatStatusScheduler();
    }
  }, [tabAktif]);

  const jalankanTest = async () => {
    setLoadingTest(true);
    setTestResponse(null);
    const start = Date.now();

    try {
      let url = testEndpoint;
      if (testEndpoint === "/api/v1/dataset-sektoral/:id") {
        url = `/api/v1/dataset-sektoral/${encodeURIComponent(testId || 1)}`;
      }

      const sp = new URLSearchParams();
      if (testEndpoint === "/api/v1/dataset-sektoral") {
        if (testParams.page) sp.set("page", testParams.page);
        if (testParams.per_page) sp.set("per_page", testParams.per_page);
        if (testParams.q) sp.set("q", testParams.q);
        if (testParams.tahun) sp.set("tahun", testParams.tahun);
      }
      const qs = sp.toString();
      if (qs) url += `?${qs}`;

      const headers = { Accept: "application/json" };
      if (testToken.trim()) {
        headers["Authorization"] = `Bearer ${testToken.trim()}`;
      }

      const res = await fetch(url, { headers });
      const latency = Date.now() - start;
      setTestLatency(latency);

      const json = await res.json().catch(() => ({ error: "Respon bukan format JSON yang sah" }));
      setTestResponse({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        data: json,
      });
    } catch (err) {
      setTestLatency(Date.now() - start);
      setTestResponse({
        status: 500,
        statusText: "Error",
        ok: false,
        data: { error: err.message },
      });
    }
    setLoadingTest(false);
  };

  const ENDPOINTS = [
    {
      id: "list",
      method: "GET",
      path: "/api/v1/dataset-sektoral",
      title: "Daftar Dataset Sektoral Terbuka (Standar SDPDN)",
      desc: "Mengambil daftar seluruh indikator dan dataset terbuka di Kabupaten Sumba Barat untuk replikasi nasional Satu Data Indonesia (SDI). Mendukung pagination, filter tahun, kode bidang urusan, topik, dan pencarian bebas.",
      params: [
        { name: "page", type: "integer", req: "Opsional (def: 1)", desc: "Nomor halaman data" },
        { name: "per_page", type: "integer", req: "Opsional (def: 25)", desc: "Jumlah indikator per halaman (maks: 100)" },
        { name: "tahun", type: "integer", req: "Opsional", desc: "Filter ketersediaan data tahun tertentu (contoh: 2025)" },
        { name: "kode_bidang_urusan", type: "string", req: "Opsional", desc: "Filter berdasarkan kode urusan Kemendagri (contoh: 1.01)" },
        { name: "topic_slug", type: "string", req: "Opsional", desc: "Filter slug topik dataset (contoh: ekonomi-keuangan)" },
        { name: "q", type: "string", req: "Opsional", desc: "Pencarian teks bebas pada nama atau definisi indikator" },
      ],
      curl: `curl -X GET "${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/dataset-sektoral?page=1&per_page=10&tahun=2025" \\\n  -H "Accept: application/json" \\\n  -H "Authorization: Bearer <TOKEN_ANDA>"`,
      js: `const res = await fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/dataset-sektoral?page=1&per_page=10', {\n  headers: {\n    'Accept': 'application/json',\n    'Authorization': 'Bearer ' + API_TOKEN\n  }\n});\nconst result = await res.json();\nconsole.log(result.data);`,
      python: `import requests\n\nurl = "${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/dataset-sektoral"\nheaders = {\n    "Accept": "application/json",\n    "Authorization": "Bearer " + API_TOKEN\n}\nparams = {"page": 1, "per_page": 10}\nres = requests.get(url, headers=headers, params=params)\nprint(res.json())`,
      sampleResponse: {
        success: true,
        kode_wilayah: "53.12",
        nama_wilayah: "Kabupaten Sumba Barat",
        standar: "SDPDN-v1",
        metadata: {
          total_data: 24,
          halaman: 1,
          per_halaman: 10,
          total_halaman: 3
        },
        data: [
          {
            id: 1,
            kode_indikator: "IND-5312-0001",
            nama_indikator: "Laju Pertumbuhan Ekonomi",
            bidang_urusan: "Perencanaan",
            kode_bidang_urusan: "1.01",
            satuan: "Persen (%)",
            definisi: "Pertumbuhan PDRB atas dasar harga konstan",
            tipe_data: "Angka",
            frekuensi_rilis: "Tahunan",
            produsen_data: "BAPPERIDA",
            tahun_tersedia: [2023, 2024, 2025],
            nilai_terakhir: { tahun: 2025, nilai: 5.12, status: "Tetap" }
          }
        ]
      }
    },
    {
      id: "detail",
      method: "GET",
      path: "/api/v1/dataset-sektoral/:id",
      title: "Detail Dataset & Deret Waktu Realisasi",
      desc: "Mengembalikan metadata lengkap satu indikator beserta deret nilai tahunan (time-series) dan rincian per kecamatan yang telah diverifikasi oleh Walidata. Parameter :id dapat berupa ID integer atau kode indikator.",
      params: [
        { name: "id", type: "string | integer", req: "Wajib (URL param)", desc: "ID unik angka (misal: 1) atau kode indikator (misal: IND-5312-0001)" }
      ],
      curl: `curl -X GET "${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/dataset-sektoral/1" \\\n  -H "Accept: application/json" \\\n  -H "Authorization: Bearer <TOKEN_ANDA>"`,
      js: `const res = await fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/dataset-sektoral/1', {\n  headers: {\n    'Accept': 'application/json',\n    'Authorization': 'Bearer ' + API_TOKEN\n  }\n});\nconst dataset = await res.json();\nconsole.log(dataset.data);`,
      python: `import requests\n\nurl = "${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/dataset-sektoral/1"\nheaders = {"Authorization": f"Bearer {API_TOKEN}"}\nres = requests.get(url, headers=headers)\nprint(res.json())`,
      sampleResponse: {
        success: true,
        kode_wilayah: "53.12",
        data: {
          id: 1,
          kode_indikator: "IND-5312-0001",
          nama_indikator: "Laju Pertumbuhan Ekonomi",
          produsen_data: "BAPPERIDA",
          satuan: "Persen (%)",
          realisasi_tahunan: [
            { tahun: 2023, nilai: 4.85, status_verifikasi: "Disetujui" },
            { tahun: 2024, nilai: 4.98, status_verifikasi: "Disetujui" },
            { tahun: 2025, nilai: 5.12, status_verifikasi: "Disetujui" }
          ]
        }
      }
    },
    {
      id: "ping",
      method: "GET",
      path: "/api/v1/ping",
      title: "Health Check & Validasi Token",
      desc: "Endpoint pemantauan ringan untuk memeriksa ketersediaan server Satu Data Sumba Barat dan memvalidasi token otentikasi Bearer secara real-time.",
      params: [],
      curl: `curl -X GET "${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/ping" \\\n  -H "Accept: application/json"`,
      js: `const res = await fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/ping');\nconst status = await res.json();\nconsole.log(status);`,
      python: `import requests\nres = requests.get("${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/ping")\nprint(res.json())`,
      sampleResponse: {
        status: "ok",
        app: "Satu Data & Arsip Digital Kab. Sumba Barat",
        standar: "SDPDN-v1",
        version: "1.0.0",
        timestamp: "2026-11-04T10:45:00.000Z",
        token_valid: true
      }
    },
    {
      id: "spec",
      method: "GET",
      path: "/api/documentation/json",
      title: "Spesifikasi OpenAPI 3.0.3 (Swagger)",
      desc: "Mengembalikan dokumen spesifikasi resmi OpenAPI 3.0.3 dalam format JSON standar yang dapat diimpor langsung ke Postman, Insomnia, Swagger UI, atau gateway SDPDN nasional.",
      params: [],
      curl: `curl -X GET "${typeof window !== 'undefined' ? window.location.origin : ''}/api/documentation/json"`,
      js: `const res = await fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/documentation/json');\nconst openapi = await res.json();`,
      python: `import requests\nres = requests.get("${typeof window !== 'undefined' ? window.location.origin : ''}/api/documentation/json")\nprint(res.json()["info"])`,
      sampleResponse: {
        openapi: "3.0.3",
        info: {
          title: "API Satu Data Kabupaten Sumba Barat",
          version: "1.0.0",
          description: "Spesifikasi resmi integrasi Satu Data Perencanaan Pembangunan Daerah Nasional (SDPDN)"
        }
      }
    }
  ];

  return (
    <div style={{ padding: isMobile ? 14 : "20px 28px", fontFamily: T.font, color: T.text, minHeight: "100%" }}>
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: T.card, border: `1px solid ${T.primary}`,
          padding: "12px 18px", borderRadius: T.radius,
          boxShadow: T.shadowLg, display: "flex", alignItems: "center", gap: 10,
          color: T.text, fontSize: 13, fontWeight: 600
        }}>
          <Icon name="checkCircle" size={16} style={{ color: T.primary }} />
          {toast}
        </div>
      )}

      {/* ── Page Header ────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>
              Dokumentasi API Satu Data
            </h1>
            <span style={{
              fontSize: 11, fontWeight: 700, color: T.primary, background: T.primaryLight,
              padding: "3px 10px", borderRadius: 99, border: `1px solid ${T.border}`,
              letterSpacing: "0.04em", textTransform: "uppercase"
            }}>
              SDPDN Ready &bull; OpenAPI 3.0
            </span>
          </div>
          <p style={{ fontSize: 13, color: T.textSecondary, margin: "6px 0 0" }}>
            Antarmuka resmi pertukaran data pembangunan daerah untuk replikasi nasional Satu Data Indonesia (SDI) & integrasi OPD Kabupaten Sumba Barat
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a
            href="/api/documentation/json"
            target="_blank"
            rel="noreferrer"
            style={{
              ...s.btnBase, padding: "8px 14px", fontSize: 12,
              background: T.card, border: `1px solid ${T.border}`,
              color: T.text, textDecoration: "none"
            }}
          >
            <Icon name="download" size={14} /> Unduh OpenAPI JSON
          </a>
          <button
            onClick={() => setTabAktif("tester")}
            style={s.btnPrimary}
          >
            <Icon name="search" size={14} /> Uji Coba di Playground
          </button>
        </div>
      </div>

      {/* ── Executive KPI Metric Cards ─────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: isMobile ? 10 : 14,
        marginBottom: 20
      }}>
        {/* Card 1: Endpoints */}
        <div style={{ ...s.cardStyle, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: T.primaryLight,
            display: "flex", alignItems: "center", justifyContent: "center", color: T.primary, flexShrink: 0
          }}>
            <Icon name="world" size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Katalog Endpoint
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, lineHeight: 1.2, marginTop: 2 }}>
              4 Endpoint
            </div>
            <div style={{ fontSize: 11, color: T.primary, fontWeight: 600, marginTop: 2 }}>
              Standar SDPDN Nasional
            </div>
          </div>
        </div>

        {/* Card 2: Wilayah SDI */}
        <div style={{ ...s.cardStyle, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: isDark ? "#2E1065" : "#F5F3FF",
            display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#C4B5FD" : "#7C3AED", flexShrink: 0
          }}>
            <Icon name="building" size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Kode Wilayah
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, lineHeight: 1.2, marginTop: 2 }}>
              53.12
            </div>
            <div style={{ fontSize: 11, color: isDark ? "#C4B5FD" : "#7C3AED", fontWeight: 600, marginTop: 2 }}>
              Kab. Sumba Barat, NTT
            </div>
          </div>
        </div>

        {/* Card 3: Otentikasi */}
        <div style={{ ...s.cardStyle, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: T.successBg,
            display: "flex", alignItems: "center", justifyContent: "center", color: T.success, flexShrink: 0
          }}>
            <Icon name="shield" size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Otentikasi
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, lineHeight: 1.2, marginTop: 2 }}>
              Bearer Token
            </div>
            <div style={{ fontSize: 11, color: T.success, fontWeight: 600, marginTop: 2 }}>
              Sanctum Compatible
            </div>
          </div>
        </div>

        {/* Card 4: Scheduler */}
        <div style={{ ...s.cardStyle, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: isDark ? "#083344" : "#ECFEFF",
            display: "flex", alignItems: "center", justifyContent: "center", color: isDark ? "#67E8F9" : "#0891B2", flexShrink: 0
          }}>
            <Icon name="chart" size={22} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Scheduler Otomatis
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, lineHeight: 1.2, marginTop: 2 }}>
              3 Cron Job
            </div>
            <div style={{ fontSize: 11, color: isDark ? "#38BDF8" : "#0284C7", fontWeight: 600, marginTop: 2 }}>
              Health Check & Reminder
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-Navigasi (Pill Tabs) ─────────────────────────────────── */}
      <style>{`
        .sd-tabs-no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>
      <div
        className="sd-tabs-no-scrollbar"
        style={{
          display: "flex", gap: 8, overflowX: "auto",
          scrollbarWidth: "none", msOverflowStyle: "none",
          marginBottom: 20
        }}
      >
        {[
          { key: "endpoints", label: "Katalog Endpoint SDPDN", icon: "world", badge: "4" },
          { key: "auth", label: "Autentikasi & Sanctum Token", icon: "shield" },
          { key: "tester", label: "Konsol Tester Interaktif", icon: "search", badge: "Live" },
          { key: "scheduler", label: "Scheduler & Pemutakhiran", icon: "chart", badge: "Otomatis" },
        ].map((t) => {
          const aktif = tabAktif === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTabAktif(t.key)}
              style={{
                ...s.btnBase,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: aktif ? 700 : 500,
                background: aktif ? T.primary : T.card,
                color: aktif ? "#FFFFFF" : T.textSecondary,
                border: `1px solid ${aktif ? T.primary : T.border}`,
                boxShadow: aktif ? "0 2px 6px rgba(37,99,235,0.25)" : "none",
              }}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
              {t.badge && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                  background: aktif ? "rgba(255,255,255,0.25)" : T.primaryLight,
                  color: aktif ? "#FFFFFF" : T.primary,
                  marginLeft: 2
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: KATALOG ENDPOINT ─────────────────────────────────── */}
      {tabAktif === "endpoints" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {ENDPOINTS.map((ep) => {
            const isBuka = endpointTerbuka === ep.id;
            return (
              <div key={ep.id} style={{ ...s.cardStyle, overflow: "hidden" }}>
                {/* Header Akordion */}
                <div
                  onClick={() => setEndpointTerbuka(isBuka ? "" : ep.id)}
                  style={{
                    padding: "16px 20px", display: "flex", alignItems: "center",
                    justifyContent: "space-between", cursor: "pointer",
                    background: isBuka ? T.surfaceHover : "transparent",
                    borderBottom: isBuka ? `1px solid ${T.border}` : "none",
                    transition: "background 0.12s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flexWrap: "wrap" }}>
                    <span style={{
                      background: ep.method === "GET" ? T.successBg : T.primaryLight,
                      color: ep.method === "GET" ? T.success : T.primary,
                      border: `1px solid ${ep.method === "GET" ? T.successBorder : T.border}`,
                      fontWeight: 800, fontSize: 11, padding: "3px 10px", borderRadius: 6,
                    }}>
                      {ep.method}
                    </span>
                    <span style={{ fontFamily: "monospace, sans-serif", fontSize: 14, fontWeight: 700, color: T.text }}>
                      {ep.path}
                    </span>
                    <span style={{ fontSize: 12, color: T.textSecondary }}>
                      &bull; {ep.title}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name={isBuka ? "chevronUp" : "chevronDown"} size={16} style={{ color: T.textMuted }} />
                  </div>
                </div>

                {/* Konten Terbuka */}
                {isBuka && (
                  <div style={{ padding: isMobile ? 16 : "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
                    <p style={{ margin: 0, fontSize: 13, color: T.textSecondary, lineHeight: 1.6 }}>
                      {ep.desc}
                    </p>

                    {/* Parameter Query Table */}
                    {ep.params.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Parameter Query & Path
                        </div>
                        <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: T.radius }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: T.primaryLight, textAlign: "left", color: T.primary }}>
                                <th style={{ padding: "9px 14px", fontWeight: 700 }}>Parameter</th>
                                <th style={{ padding: "9px 14px", fontWeight: 700 }}>Tipe</th>
                                <th style={{ padding: "9px 14px", fontWeight: 700 }}>Status</th>
                                <th style={{ padding: "9px 14px", fontWeight: 700 }}>Keterangan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ep.params.map((p, pIdx) => (
                                <tr key={pIdx} style={{ borderBottom: pIdx < ep.params.length - 1 ? `1px solid ${T.border}` : "none" }}>
                                  <td style={{ padding: "9px 14px", fontFamily: "monospace, sans-serif", fontWeight: 700, color: T.primary }}>
                                    {p.name}
                                  </td>
                                  <td style={{ padding: "9px 14px", color: T.textMuted }}>{p.type}</td>
                                  <td style={{ padding: "9px 14px", color: T.textSecondary }}>{p.req}</td>
                                  <td style={{ padding: "9px 14px", color: T.text }}>{p.desc}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Contoh Kode Snippets */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Contoh Pemanggilan
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {["curl", "js", "python"].map((l) => (
                            <button
                              key={l}
                              onClick={() => setLangTab(l)}
                              style={{
                                ...s.btnBase, padding: "4px 10px", fontSize: 11,
                                background: langTab === l ? T.primaryLight : "transparent",
                                color: langTab === l ? T.primary : T.textSecondary,
                                border: `1px solid ${langTab === l ? T.border : "transparent"}`
                              }}
                            >
                              {l.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ position: "relative" }}>
                        <pre style={{
                          margin: 0, padding: "14px 18px", borderRadius: T.radius,
                          background: isDark ? "#0f172a" : "#f8fafc",
                          border: `1px solid ${T.border}`,
                          fontSize: 12, fontFamily: "monospace, sans-serif",
                          color: T.text, overflowX: "auto", lineHeight: 1.5
                        }}>
                          {langTab === "curl" ? ep.curl : (langTab === "js" ? ep.js : ep.python)}
                        </pre>
                        <button
                          onClick={() => salinTeks(langTab === "curl" ? ep.curl : (langTab === "js" ? ep.js : ep.python), `Kode ${langTab.toUpperCase()}`)}
                          style={{
                            position: "absolute", top: 10, right: 10,
                            ...s.btnBase, padding: "5px 10px", fontSize: 11,
                            background: T.card, border: `1px solid ${T.border}`, color: T.text
                          }}
                        >
                          <Icon name="copy" size={12} /> Salin
                        </button>
                      </div>
                    </div>

                    {/* Sample Response */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Contoh Respon JSON (200 OK)
                      </div>
                      <pre style={{
                        margin: 0, padding: "14px 18px", borderRadius: T.radius,
                        background: isDark ? "#0f172a" : "#f8fafc",
                        border: `1px solid ${T.border}`,
                        fontSize: 12, fontFamily: "monospace, sans-serif",
                        color: T.text, overflowX: "auto", maxHeight: 240, lineHeight: 1.5
                      }}>
                        {JSON.stringify(ep.sampleResponse, null, 2)}
                      </pre>
                    </div>

                    {/* Actions Bar */}
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                      <button
                        onClick={() => {
                          setTestEndpoint(ep.path);
                          setTabAktif("tester");
                        }}
                        style={s.btnPrimary}
                      >
                        <Icon name="search" size={13} /> Uji Endpoint Ini di Konsol Tester
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 2: AUTENTIKASI & TOKEN ──────────────────────────────── */}
      {tabAktif === "auth" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...s.cardStyle, padding: isMobile ? 18 : "24px 28px" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: "0 0 10px 0" }}>
              Standar Otentikasi Bearer Token (Sanctum Compatible)
            </h2>
            <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, margin: "0 0 20px 0" }}>
              API Satu Data Kabupaten Sumba Barat menggunakan otentikasi standar industri Bearer Token. Token ini dapat diterbitkan oleh Administrator / Walidata BAPPERIDA untuk sistem SDPDN Nasional, aplikasi portal keterbukaan data, maupun aplikasi internal OPD daerah.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ background: T.surfaceHover, padding: 18, borderRadius: T.radius, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="shield" size={16} /> Header Permintaan Wajib
                </div>
                <p style={{ fontSize: 12, color: T.textSecondary, margin: "0 0 10px 0" }}>
                  Sertakan token otentikasi pada setiap HTTP request header:
                </p>
                <div style={{
                  background: isDark ? "#0f172a" : "#ffffff", padding: "10px 14px",
                  borderRadius: 8, border: `1px solid ${T.border}`, fontFamily: "monospace, sans-serif",
                  fontSize: 12, color: T.primary, fontWeight: 600
                }}>
                  Authorization: Bearer &lt;TOKEN_ANDA&gt;
                </div>
              </div>

              <div style={{ background: T.surfaceHover, padding: 18, borderRadius: T.radius, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.success, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="checkCircle" size={16} /> Cakupan Izin (Abilities)
                </div>
                <p style={{ fontSize: 12, color: T.textSecondary, margin: "0 0 10px 0" }}>
                  Token dibatasi oleh izin spesifik untuk mencegah akses tidak sah:
                </p>
                <ul style={{ fontSize: 12, color: T.text, margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  <li><code style={{ color: T.primary, fontWeight: 700 }}>dataset:read</code> — Akses seluruh katalog & nilai dataset terbuka</li>
                  <li><code style={{ color: T.primary, fontWeight: 700 }}>*</code> — Akses penuh integrasi sistem & replikasi nasional</li>
                </ul>
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10 }}>
              Daftar Kode Status HTTP (Response Codes)
            </div>
            <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: T.radius }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: T.primaryLight, textAlign: "left", color: T.primary }}>
                    <th style={{ padding: "10px 14px", fontWeight: 700, width: 120 }}>HTTP Status</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, width: 180 }}>Kondisi</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700 }}>Keterangan & Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { code: "200 OK", cond: "Berhasil", desc: "Permintaan berhasil diproses dan mengembalikan payload JSON.", color: T.success },
                    { code: "401 Unauthorized", cond: "Token Tidak Sah / Kosong", desc: "Header Authorization Bearer tidak disertakan atau token telah kedaluwarsa.", color: T.danger },
                    { code: "403 Forbidden", cond: "Izin Tidak Mencukupi", desc: "Token tidak memiliki kemampuan (abilities) untuk mengakses endpoint target.", color: T.danger },
                    { code: "404 Not Found", cond: "Data Tidak Ditemukan", desc: "ID indikator atau rute API yang dituju tidak terdaftar di sistem.", color: T.textMuted },
                    { code: "500 Internal Error", cond: "Kendala Server", desc: "Terjadi kesalahan internal pada basis data atau pemrosesan server.", color: T.danger },
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace, sans-serif", fontWeight: 700, color: row.color }}>{row.code}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: T.text }}>{row.cond}</td>
                      <td style={{ padding: "10px 14px", color: T.textSecondary }}>{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: KONSOL TESTER PLAYGROUND ──────────────────────────── */}
      {tabAktif === "tester" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1.4fr", gap: 16 }}>
          {/* Request Panel */}
          <div style={{ ...s.cardStyle, padding: isMobile ? 16 : 22, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>
                Konfigurasi Permintaan API
              </h3>
              <p style={{ fontSize: 12, color: T.textSecondary, margin: "4px 0 0" }}>
                Kirim permintaan langsung ke server Satu Data Sumba Barat
              </p>
            </div>

            {/* Target Endpoint */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>
                Target Endpoint
              </label>
              <Select
                fullWidth
                size="md"
                value={testEndpoint}
                onChange={v => setTestEndpoint(v)}
                options={[
                  { value: "/api/v1/dataset-sektoral", label: "GET /api/v1/dataset-sektoral (Katalog Dataset)" },
                  { value: "/api/v1/dataset-sektoral/:id", label: "GET /api/v1/dataset-sektoral/:id (Detail Dataset)" },
                  { value: "/api/v1/ping", label: "GET /api/v1/ping (Health Check)" },
                ]}
              />
            </div>

            {/* Param ID jika :id */}
            {testEndpoint === "/api/v1/dataset-sektoral/:id" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>
                  ID Indikator / Kode
                </label>
                <input
                  value={testId}
                  onChange={e => setTestId(e.target.value)}
                  placeholder="Contoh: 1 atau IND-5312-0001"
                  style={s.inputStyle}
                />
              </div>
            )}

            {/* Query Params jika katalog */}
            {testEndpoint === "/api/v1/dataset-sektoral" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>
                    Halaman (Page)
                  </label>
                  <input
                    value={testParams.page}
                    onChange={e => setTestParams({ ...testParams, page: e.target.value })}
                    style={s.inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>
                    Per Halaman
                  </label>
                  <input
                    value={testParams.per_page}
                    onChange={e => setTestParams({ ...testParams, per_page: e.target.value })}
                    style={s.inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>
                    Tahun
                  </label>
                  <input
                    value={testParams.tahun}
                    onChange={e => setTestParams({ ...testParams, tahun: e.target.value })}
                    placeholder="2025"
                    style={s.inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>
                    Kata Kunci (q)
                  </label>
                  <input
                    value={testParams.q}
                    onChange={e => setTestParams({ ...testParams, q: e.target.value })}
                    placeholder="Cari..."
                    style={s.inputStyle}
                  />
                </div>
              </div>
            )}

            {/* Bearer Token */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.text, display: "block", marginBottom: 6 }}>
                Bearer Token (Opsional untuk pengujian)
              </label>
              <input
                type="password"
                value={testToken}
                onChange={e => setTestToken(e.target.value)}
                placeholder="Masukkan token Bearer..."
                style={s.inputStyle}
              />
              <span style={{ fontSize: 11, color: T.textMuted, marginTop: 4, display: "block" }}>
                Dapat dikosongkan untuk menguji respon publik atau pengecekan otentikasi
              </span>
            </div>

            <button
              onClick={jalankanTest}
              disabled={loadingTest}
              style={{
                ...s.btnPrimary,
                padding: "11px 18px",
                opacity: loadingTest ? 0.6 : 1,
                cursor: loadingTest ? "not-allowed" : "pointer"
              }}
            >
              <Icon name="search" size={15} />
              {loadingTest ? "Mengirim Permintaan..." : "Kirim Permintaan (Send Request)"}
            </button>
          </div>

          {/* Response Panel */}
          <div style={{ ...s.cardStyle, padding: isMobile ? 16 : 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>
                  Respon Server
                </h3>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                  Hasil eksekusi payload JSON real-time
                </div>
              </div>

              {testResponse && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                    background: testResponse.ok ? T.successBg : T.dangerBg,
                    color: testResponse.ok ? T.success : T.danger,
                    border: `1px solid ${testResponse.ok ? T.successBorder : T.dangerBorder}`
                  }}>
                    {testResponse.status} {testResponse.statusText}
                  </span>
                  {testLatency !== null && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
                      background: T.primaryLight, color: T.primary, border: `1px solid ${T.border}`
                    }}>
                      {testLatency} ms
                    </span>
                  )}
                </div>
              )}
            </div>

            {testResponse ? (
              <div style={{ position: "relative" }}>
                <pre style={{
                  margin: 0, padding: "16px 18px", borderRadius: T.radius,
                  background: isDark ? "#0f172a" : "#f8fafc",
                  border: `1px solid ${T.border}`,
                  fontSize: 12, fontFamily: "monospace, sans-serif",
                  color: T.text, overflowX: "auto", maxHeight: 420, lineHeight: 1.5
                }}>
                  {JSON.stringify(testResponse.data, null, 2)}
                </pre>
                <button
                  onClick={() => salinTeks(JSON.stringify(testResponse.data, null, 2), "Respon JSON")}
                  style={{
                    position: "absolute", top: 10, right: 10,
                    ...s.btnBase, padding: "5px 10px", fontSize: 11,
                    background: T.card, border: `1px solid ${T.border}`, color: T.text
                  }}
                >
                  <Icon name="copy" size={12} /> Salin Respon
                </button>
              </div>
            ) : (
              <div style={{
                padding: "60px 20px", textAlign: "center", border: `1px dashed ${T.border}`,
                borderRadius: T.radius, background: T.surfaceHover
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: T.primaryLight,
                  color: T.primary, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12
                }}>
                  <Icon name="world" size={20} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Belum Ada Permintaan Dikirim</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
                  Pilih endpoint di sebelah kiri lalu klik "Kirim Permintaan" untuk melihat respon
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: SCHEDULER & PEMUTAKHIRAN ─────────────────────────── */}
      {tabAktif === "scheduler" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...s.cardStyle, padding: isMobile ? 18 : "24px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>
                  Scheduler Otomatis & Pemutakhiran Data
                </h2>
                <p style={{ fontSize: 13, color: T.textSecondary, margin: "4px 0 0" }}>
                  Status tugas terjadwal (cron queue) untuk keandalan replikasi dan pemutakhiran data OPD
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={muatStatusScheduler}
                  disabled={loadingScheduler}
                  style={{
                    ...s.btnBase, padding: "8px 14px", fontSize: 12,
                    background: T.card, border: `1px solid ${T.border}`, color: T.text
                  }}
                >
                  <Icon name="refresh" size={13} /> {loadingScheduler ? "Memuat..." : "Segarkan Status"}
                </button>
                <button
                  onClick={jalankanSchedulerManual}
                  disabled={runningScheduler}
                  style={{
                    ...s.btnPrimary,
                    padding: "8px 14px", fontSize: 12,
                    opacity: runningScheduler ? 0.6 : 1
                  }}
                >
                  <Icon name="clock" size={13} /> {runningScheduler ? "Menjalankan..." : "Jalankan Scheduler Sekarang"}
                </button>
              </div>
            </div>

            {/* List Tugas Terjadwal */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
              {/* Job 1 */}
              <div style={{ background: T.surfaceHover, padding: 18, borderRadius: T.radius, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase" }}>Job 1</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: T.successBg, color: T.success }}>Aktif</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Health Check 5 Menit</div>
                <p style={{ fontSize: 12, color: T.textSecondary, margin: "6px 0 0" }}>
                  Memeriksa kesehatan endpoint API, koneksi database, dan kesiapan replikasi SDI secara berkala setiap 5 menit.
                </p>
              </div>

              {/* Job 2 */}
              <div style={{ background: T.surfaceHover, padding: 18, borderRadius: T.radius, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase" }}>Job 2</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: T.successBg, color: T.success }}>Aktif</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Pengingat Pemutakhiran OPD</div>
                <p style={{ fontSize: 12, color: T.textSecondary, margin: "6px 0 0" }}>
                  Mengecek jadwal jatuh tempo pengisian data indikator dan mengirimkan reminder otomatis ke email produsen data OPD.
                </p>
              </div>

              {/* Job 3 */}
              <div style={{ background: T.surfaceHover, padding: 18, borderRadius: T.radius, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase" }}>Job 3</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: T.successBg, color: T.success }}>Aktif</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Pembersihan Token Kedaluwarsa</div>
                <p style={{ fontSize: 12, color: T.textSecondary, margin: "6px 0 0" }}>
                  Memangkas token API kedaluwarsa atau nonaktif secara otomatis setiap 6 jam untuk menjaga performa sistem.
                </p>
              </div>
            </div>

            {/* Status Server */}
            {schedulerData && (
              <div style={{
                background: isDark ? "#0f172a" : "#f8fafc", padding: "14px 18px",
                borderRadius: T.radius, border: `1px solid ${T.border}`, fontSize: 12, color: T.text
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Status Sistem Terkini:</div>
                <div>Status Worker: <strong>{schedulerData.scheduler?.status || "Running"}</strong> &bull; Total Job Terdaftar: <strong>{schedulerData.scheduler?.total_jobs || 3}</strong></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
