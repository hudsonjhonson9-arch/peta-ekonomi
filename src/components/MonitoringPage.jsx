import { useState, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { ThemeContext } from "../App.jsx";
import useResponsive from "../useResponsive.js";
import { Icon, Select, DatePicker, Button, Badge } from "./ui.jsx";

export default function MonitoringPage({ showToast }) {
  const { T } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();

  const [tab, setTabState] = useState(() => {
    try {
      return localStorage.getItem("monitoring_tab") || "api_token";
    } catch {
      return "api_token";
    }
  });
  const setTab = (t) => {
    setTabState(t);
    try {
      localStorage.setItem("monitoring_tab", t);
    } catch (_) {}
  };

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [newTokenRaw, setNewTokenRaw] = useState("");

  // API Token Tester & Docs State
  const [testerToken, setTesterToken] = useState("");
  const [testerEndpoint, setTesterEndpoint] = useState("/api/v1/ping");
  const [testerResult, setTesterResult] = useState(null);
  const [testerLoading, setTesterLoading] = useState(false);
  const [docLangTab, setDocLangTab] = useState("curl"); // 'curl' | 'js' | 'python'

  // Query Builder State
  const [qbConfig, setQbConfig] = useState({
    opd_id: "SEMUA",
    status: "SEMUA",
    tahun_mulai: "",
    tahun_akhir: "",
    wilayah_kode: "SEMUA",
    agregasi: "avg",
  });
  const [qbResult, setQbResult] = useState(null);
  const [qbLoading, setQbLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["satudata-monitoring"],
    queryFn: () => fetch("/api/monitoring", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : {})),
  });

  const { data: opdList = [] } = useQuery({
    queryKey: ["bankdata-opd"],
    queryFn: () => fetch("/api/bankdata/opd", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : [])),
  });

  const reload = () => queryClient.invalidateQueries({ queryKey: ["satudata-monitoring"] });

  const qnas = data?.qna || [];
  const faqs = data?.faq || [];
  const visitors = data?.visitors || [];
  const savedQueries = data?.saved_queries || [];
  const apiTokens = data?.api_tokens || [];
  const datasetLogs = data?.dataset_logs || [];
  const docLogs = data?.doc_logs || [];
  const counts = data?.counts || {};
  const health = data?.health || {};

  const pendingQna = qnas.filter(q => q.status === "menunggu").length;

  const jalankanQueryBuilder = async (cfg = qbConfig) => {
    setQbLoading(true);
    try {
      const res = await fetch("/api/monitoring/query-run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menjalankan Query Builder");
      setQbResult(out);
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    } finally {
      setQbLoading(false);
    }
  };

  const eksporHasilQueryExcel = () => {
    if (!qbResult) return;
    const wb = XLSX.utils.book_new();
    const sumHeader = ["ID Dataset", "OPD", "Nama Indikator / Dataset", "Satuan", "Field Utama", "Jumlah Baris", "Total (SUM)", "Rata-rata (AVG)", "Minimum", "Maksimum"];
    const sumBody = (qbResult.summary || []).map(s => [
      s.dataset_id, s.opd_nama, s.nama, s.satuan || "", s.field_utama, s.jumlah_baris, s.sum, s.avg, s.min, s.max,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([sumHeader, ...sumBody]), "Ringkasan_Agregasi");

    const rowHeader = ["Dataset", "OPD", "Tahun", "Periode", "Wilayah", "Nilai JSON"];
    const rowBody = (qbResult.rows || []).map(r => [
      r.dataset_nama, r.opd_nama, r.tahun, r.periode || "Tahunan", r.wilayah_kode || "", JSON.stringify(r.data || {}),
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([rowHeader, ...rowBody]), "Baris_Data");
    XLSX.writeFile(wb, `Query_Builder_SatuData_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const eksporHasilQueryJson = () => {
    if (!qbResult) return;
    const blob = new Blob([JSON.stringify(qbResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Query_Builder_SatuData_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const eksporVisitorsExcel = () => {
    const header = ["Waktu", "Nama Pengunjung", "Email", "Telepon", "Asal Instansi", "Keperluan", "Aksi", "Dataset"];
    const rows = visitors.map(v => [
      new Date(v.created_at).toLocaleString("id-ID"),
      v.nama, v.email || "", v.telepon || "", v.instansi || "", v.keperluan, v.aksi || "", v.dataset_nama || "",
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "Data_Pengunjung");
    XLSX.writeFile(wb, "Laporan_Pengunjung_Portal_SatuData.xlsx");
  };

  const simpanModal = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      let url = "";
      let method = "POST";
      if (modal.type === "qna_answer") {
        url = `/api/monitoring/qna/${modal.item.id}`;
        method = "PUT";
      } else if (modal.type === "faq") {
        url = modal.mode === "edit" ? `/api/monitoring/faq/${modal.item.id}` : "/api/monitoring/faq";
        method = modal.mode === "edit" ? "PUT" : "POST";
      } else if (modal.type === "api_token") {
        url = "/api/monitoring/api-token";
        method = "POST";
      } else if (modal.type === "save_query") {
        url = "/api/monitoring/saved-query";
        method = "POST";
      }

      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menyimpan");
      if (out.token) {
        setNewTokenRaw(out.token);
        setTesterToken(out.token);
      }
      showToast?.(out.message || "Berhasil disimpan");
      setModal(null);
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleTokenActive = async (id) => {
    try {
      const res = await fetch(`/api/monitoring/api-token/${id}/toggle`, {
        method: "PATCH",
        credentials: "same-origin",
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal mengubah status token");
      showToast?.(out.message || "Status token berhasil diubah");
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    }
  };

  const jalankanUjiToken = async () => {
    if (!testerToken.trim()) {
      showToast?.("Masukkan kunci API Token untuk diuji");
      return;
    }
    setTesterLoading(true);
    setTesterResult(null);
    const start = performance.now();
    try {
      const res = await fetch(testerEndpoint, {
        headers: {
          Authorization: `Bearer ${testerToken.trim()}`,
        },
      });
      const timeMs = Math.round(performance.now() - start);
      const json = await res.json().catch(() => ({}));
      setTesterResult({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        timeMs,
        data: json,
      });
      reload();
    } catch (e) {
      const timeMs = Math.round(performance.now() - start);
      setTesterResult({
        status: 500,
        statusText: "Error",
        ok: false,
        timeMs,
        data: { error: e.message },
      });
    } finally {
      setTesterLoading(false);
    }
  };

  const hapusItem = async (path, label) => {
    if (!window.confirm(`Hapus ${label}?`)) return;
    try {
      const res = await fetch(path, { method: "DELETE", credentials: "same-origin" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menghapus");
      showToast?.(out.message || "Berhasil dihapus");
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    }
  };

  const inpStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.inputBg,
    color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  };
  const lblStyle = {
    display: "block", fontSize: 11, fontWeight: 700, color: T.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5,
  };
  const thStyle = {
    padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5,
    borderBottom: `1px solid ${T.border}`, background: T.bgAlt, whiteSpace: "nowrap",
  };
  const tdStyle = {
    padding: "10px 12px", fontSize: 13, color: T.text,
    borderBottom: `1px solid ${T.border}`, verticalAlign: "middle",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 800, color: T.text }}>
            Monitoring & Sistem Satu Data
          </h2>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>
            Pertanyaan Masyarakat (Q&A) & FAQ, Laporan Data Pengunjung, Query Builder Lintas Indikator, Log Aktivitas & Kesehatan Sistem
          </div>
        </div>
      </div>

      {/* Tabs */}
      <style>{`
        .sd-tabs-no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>
      <div
        className="sd-tabs-no-scrollbar"
        onWheel={e => { if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY; }}
        style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", marginBottom: 16 }}
      >
        {[
          { key: "api_token",     label: `API Token & Integrasi (${apiTokens.length})`, icon: "shield" },
          { key: "qna",           label: "Pertanyaan Q&A & FAQ",          icon: "file",    badge: pendingQna },
          { key: "visitor",       label: `Data Pengunjung (${visitors.length})`, icon: "users" },
          { key: "query_builder", label: "Query Builder & Ekspor",        icon: "filter" },
          { key: "activity",      label: "Activity Log & Metrik",         icon: "history" },
          { key: "health",        label: "Kesehatan Server",              icon: "server" },
        ].map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 7, flexShrink: 0, whiteSpace: "nowrap",
                padding: "8px 14px", borderRadius: 9,
                border: active ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                background: active ? `${T.primary}15` : T.card,
                color: active ? T.primary : T.textSecondary,
                fontSize: 13, fontWeight: active ? 700 : 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <Icon name={t.icon} size={14} />
              <span>{t.label}</span>
              {t.badge > 0 && (
                <span style={{ background: "#DC2626", color: "#fff", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Memuat data monitoring...</div>
      ) : (
        <>
          {/* TAB 1: PERTANYAAN MASYARAKAT (Q&A) & KELOLA FAQ */}
          {tab === "qna" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Panel Pertanyaan Masuk */}
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Pertanyaan Masyarakat (Q&A Masuk)</div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>Pertanyaan dan permohonan data yang dikirim pengunjung melalui Portal Publik</div>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Tanggal</th>
                        <th style={thStyle}>Penanya & Instansi</th>
                        <th style={thStyle}>Pertanyaan</th>
                        <th style={thStyle}>Jawaban Tim Walidata</th>
                        <th style={thStyle}>Status</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qnas.map(q => (
                        <tr key={q.id}>
                          <td style={{ ...tdStyle, fontSize: 12, whiteSpace: "nowrap" }}>
                            {new Date(q.created_at).toLocaleDateString("id-ID")}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 700 }}>{q.nama}</div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>{q.email} · {q.instansi || "Masyarakat Umum"}</div>
                          </td>
                          <td style={{ ...tdStyle, maxWidth: 280 }}>{q.pertanyaan}</td>
                          <td style={{ ...tdStyle, maxWidth: 280, color: q.jawaban ? T.text : T.textMuted }}>
                            {q.jawaban || "Belum dijawab"}
                          </td>
                          <td style={tdStyle}>
                            <Badge
                              label={q.status === "dijawab" ? (q.tampil_publik ? "Dijawab (Publik)" : "Dijawab") : "Menunggu"}
                              colors={q.status === "dijawab" ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#FEF3C7", text: "#D97706" }}
                            />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            <Button
                              size="xs"
                              variant="primary"
                              icon="edit"
                              onClick={() => {
                                setForm({ jawaban: q.jawaban || "", tampil_publik: q.tampil_publik ?? true, status: "dijawab" });
                                setModal({ type: "qna_answer", item: q });
                              }}
                            >
                              Jawab
                            </Button>{" "}
                            <Button
                              size="xs"
                              variant="ghost"
                              icon="trash"
                              onClick={() => hapusItem(`/api/monitoring/qna/${q.id}`, `Pertanyaan dari ${q.nama}`)}
                              style={{ color: T.danger }}
                            />
                          </td>
                        </tr>
                      ))}
                      {qnas.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>
                            Belum ada pertanyaan masuk dari pengunjung portal publik.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Panel Kelola FAQ */}
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Kelola FAQ (Pertanyaan yang Sering Diajukan)</div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>Ditampilkan otomatis pada Portal Publik Satu Data</div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="plus"
                    onClick={() => {
                      setForm({ pertanyaan: "", jawaban: "", urutan: faqs.length + 1, is_active: true });
                      setModal({ mode: "add", type: "faq" });
                    }}
                  >
                    Tambah FAQ
                  </Button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Urutan</th>
                        <th style={thStyle}>Pertanyaan FAQ</th>
                        <th style={thStyle}>Jawaban</th>
                        <th style={thStyle}>Status</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faqs.map(f => (
                        <tr key={f.id}>
                          <td style={tdStyle}>{f.urutan}</td>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{f.pertanyaan}</td>
                          <td style={{ ...tdStyle, color: T.textSecondary }}>{f.jawaban}</td>
                          <td style={tdStyle}>
                            <Badge label={f.is_active ? "Aktif" : "Nonaktif"} colors={f.is_active ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#F1F5F9", text: "#64748B" }} />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            <Button
                              size="xs"
                              variant="ghost"
                              icon="edit"
                              onClick={() => {
                                setForm({ ...f });
                                setModal({ mode: "edit", type: "faq", item: f });
                              }}
                            >
                              Edit
                            </Button>{" "}
                            <Button
                              size="xs"
                              variant="ghost"
                              icon="trash"
                              onClick={() => hapusItem(`/api/monitoring/faq/${f.id}`, f.pertanyaan)}
                              style={{ color: T.danger }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DATA PENGUNJUNG (BUKU TAMU) */}
          {tab === "visitor" && (
            <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Laporan Data Pengunjung & Pengunduh Dataset</div>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>Rekapitulasi buku tamu pengunjung dan alasan pengunduhan data sektoral</div>
                </div>
                <Button variant="secondary" icon="download" onClick={eksporVisitorsExcel}>
                  Ekspor Laporan Excel
                </Button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Waktu</th>
                      <th style={thStyle}>Nama Pengunjung</th>
                      <th style={thStyle}>Kontak</th>
                      <th style={thStyle}>Asal Instansi / Profesi</th>
                      <th style={thStyle}>Keperluan Akses / Unduh</th>
                      <th style={thStyle}>Dataset Terkait</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.map(v => (
                      <tr key={v.id}>
                        <td style={{ ...tdStyle, fontSize: 12, whiteSpace: "nowrap" }}>
                          {new Date(v.created_at).toLocaleString("id-ID")}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{v.nama}</td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>{v.email || "—"} {v.telepon ? `(${v.telepon})` : ""}</td>
                        <td style={tdStyle}>{v.instansi || "Umum"}</td>
                        <td style={tdStyle}>{v.keperluan}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: T.primary }}>{v.dataset_nama || "Portal Publik"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <Button
                            size="xs"
                            variant="ghost"
                            icon="trash"
                            onClick={() => hapusItem(`/api/monitoring/visitor/${v.id}`, `Catatan ${v.nama}`)}
                            style={{ color: T.danger }}
                          />
                        </td>
                      </tr>
                    ))}
                    {visitors.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                          Belum ada catatan buku tamu pengunjung.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: QUERY BUILDER & SANDINGKAN INDIKATOR */}
          {tab === "query_builder" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 4 }}>
                  Query Builder & Eksportir Indikator Lintas OPD
                </div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 14 }}>
                  Susun filter indikator sektoral, rentang tahun, dan agregasi untuk mengekspor gabungan data dalam format Excel atau JSON
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={lblStyle}>Filter OPD</label>
                    <Select
                      value={qbConfig.opd_id}
                      onChange={v => setQbConfig(c => ({ ...c, opd_id: v }))}
                      options={[
                        { value: "SEMUA", label: "Semua OPD" },
                        ...opdList.map(o => ({ value: String(o.id), label: o.nama })),
                      ]}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Status Verifikasi</label>
                    <Select
                      value={qbConfig.status}
                      onChange={v => setQbConfig(c => ({ ...c, status: v }))}
                      options={[
                        { value: "SEMUA", label: "Semua Status" },
                        { value: "disetujui", label: "Disetujui (Publik)" },
                        { value: "diajukan", label: "Menunggu Verifikasi" },
                        { value: "draft", label: "Draft" },
                      ]}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Tahun Mulai</label>
                    <input
                      type="number"
                      placeholder="Mis: 2020"
                      value={qbConfig.tahun_mulai}
                      onChange={e => setQbConfig(c => ({ ...c, tahun_mulai: e.target.value }))}
                      style={inpStyle}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Tahun Akhir</label>
                    <input
                      type="number"
                      placeholder="Mis: 2026"
                      value={qbConfig.tahun_akhir}
                      onChange={e => setQbConfig(c => ({ ...c, tahun_akhir: e.target.value }))}
                      style={inpStyle}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Fungsi Agregasi</label>
                    <Select
                      value={qbConfig.agregasi}
                      onChange={v => setQbConfig(c => ({ ...c, agregasi: v }))}
                      options={[
                        { value: "avg", label: "Rata-rata (AVG)" },
                        { value: "sum", label: "Jumlah Total (SUM)" },
                        { value: "min", label: "Nilai Minimum (MIN)" },
                        { value: "max", label: "Nilai Maksimum (MAX)" },
                      ]}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="primary" icon="search" loading={qbLoading} onClick={() => jalankanQueryBuilder()}>
                      Jalankan Query
                    </Button>
                    <Button
                      variant="secondary"
                      icon="plus"
                      onClick={() => {
                        setForm({ nama_query: "", deskripsi: "", config_json: qbConfig, is_shared: true });
                        setModal({ type: "save_query" });
                      }}
                    >
                      Simpan Query Ini
                    </Button>
                  </div>

                  {qbResult && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button variant="success" icon="download" onClick={eksporHasilQueryExcel}>
                        Download Excel (.xlsx)
                      </Button>
                      <Button variant="secondary" icon="download" onClick={eksporHasilQueryJson}>
                        Download JSON (.json)
                      </Button>
                    </div>
                  )}
                </div>

                {/* Daftar Query Tersimpan */}
                {savedQueries.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Query Tersimpan:</span>
                    {savedQueries.map(sq => (
                      <span
                        key={sq.id}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 10px", borderRadius: 20, background: T.bgAlt,
                          border: `1px solid ${T.border}`, fontSize: 12,
                        }}
                      >
                        <button
                          onClick={() => {
                            const cfg = sq.config_json || {};
                            setQbConfig(c => ({ ...c, ...cfg }));
                            jalankanQueryBuilder({ ...qbConfig, ...cfg });
                          }}
                          style={{ background: "none", border: "none", color: T.primary, fontWeight: 700, cursor: "pointer", padding: 0 }}
                        >
                          {sq.nama_query}
                        </button>
                        <button
                          onClick={() => hapusItem(`/api/monitoring/saved-query/${sq.id}`, sq.nama_query)}
                          style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", padding: 0 }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Hasil Query Builder */}
              {qbResult && (
                <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontWeight: 800, fontSize: 14 }}>
                    Hasil Query: {qbResult.datasets?.length || 0} Indikator Cocok ({qbResult.total_rows || 0} Baris Data)
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Perangkat Daerah (OPD)</th>
                          <th style={thStyle}>Nama Dataset / Indikator</th>
                          <th style={thStyle}>Satuan</th>
                          <th style={thStyle}>Kolom Numerik Utama</th>
                          <th style={thStyle}>Banyak Baris</th>
                          <th style={thStyle}>Jumlah (SUM)</th>
                          <th style={thStyle}>Rata-rata (AVG)</th>
                          <th style={thStyle}>Minimum</th>
                          <th style={thStyle}>Maksimum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(qbResult.summary || []).map(s => (
                          <tr key={s.dataset_id}>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>{s.opd_nama}</td>
                            <td style={{ ...tdStyle, fontWeight: 700, color: T.primary }}>{s.nama}</td>
                            <td style={tdStyle}>{s.satuan || "—"}</td>
                            <td style={tdStyle}>{s.field_utama}</td>
                            <td style={tdStyle}>{s.jumlah_baris}</td>
                            <td style={{ ...tdStyle, fontWeight: 700 }}>{s.sum.toLocaleString("id-ID")}</td>
                            <td style={{ ...tdStyle, fontWeight: 700 }}>{s.avg.toLocaleString("id-ID")}</td>
                            <td style={tdStyle}>{s.min.toLocaleString("id-ID")}</td>
                            <td style={tdStyle}>{s.max.toLocaleString("id-ID")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ACTIVITY LOG & METRIK */}
          {tab === "activity" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, 1fr)", gap: 10 }}>
                {[
                  { label: "Total OPD", val: counts.total_opd || 0, color: "#2563EB" },
                  { label: "Total Dataset", val: counts.total_dataset || 0, color: "#7C3AED" },
                  { label: "Dataset Disetujui", val: counts.dataset_disetujui || 0, color: "#16A34A" },
                  { label: "Baris Data Sektoral", val: counts.total_baris_dataset || 0, color: "#0E7490" },
                  { label: "Baris Capaian SPM", val: counts.total_capaian_spm || 0, color: "#D97706" },
                  { label: "Total Dokumen Arsip", val: counts.total_dokumen || 0, color: "#DC2626" },
                ].map((c, idx) => (
                  <div key={idx} style={{ background: T.card, borderRadius: 12, padding: 14, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>{c.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.val}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, fontWeight: 800, fontSize: 14 }}>
                  Jejak Aktivitas Verifikasi & Perubahan Dataset Sektoral
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Waktu</th>
                        <th style={thStyle}>Pelaku (Actor)</th>
                        <th style={thStyle}>Aksi</th>
                        <th style={thStyle}>Dataset</th>
                        <th style={thStyle}>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasetLogs.map(l => (
                        <tr key={l.id}>
                          <td style={{ ...tdStyle, fontSize: 12, whiteSpace: "nowrap" }}>
                            {new Date(l.created_at).toLocaleString("id-ID")}
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{l.aktor || "Sistem"}</td>
                          <td style={tdStyle}>
                            <Badge label={String(l.aksi || "").toUpperCase()} colors={{ bg: "#EFF6FF", text: "#2563EB" }} />
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{l.dataset_nama || `#${l.dataset_id}`}</td>
                          <td style={{ ...tdStyle, color: T.textSecondary }}>{l.catatan || "—"}</td>
                        </tr>
                      ))}
                      {datasetLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>
                            Belum ada log aktivitas dataset.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: API TOKEN & INTEGRASI EKSTERNAL */}
          {tab === "api_token" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Summary Metric Cards */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
                <div style={{ background: T.card, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>Total API Token</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 4 }}>{apiTokens.length} Kunci</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Terdaftar di sistem</div>
                </div>
                <div style={{ background: T.card, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>Token Aktif</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#16A34A", marginTop: 4 }}>
                    {apiTokens.filter(t => t.is_active).length} Aktif
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Siap melayani request</div>
                </div>
                <div style={{ background: T.card, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>Terakhir Digunakan</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.primary, marginTop: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(() => {
                      const latest = apiTokens.filter(t => t.last_used_at).sort((a,b) => new Date(b.last_used_at) - new Date(a.last_used_at))[0];
                      return latest ? new Date(latest.last_used_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " (" + new Date(latest.last_used_at).toLocaleDateString("id-ID") + ")" : "Belum pernah";
                    })()}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Panggilan API terakhir</div>
                </div>
                <div style={{ background: T.card, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>Protokol Keamanan</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#7C3AED", marginTop: 4 }}>Bearer Token</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>SHA-256 Hashing</div>
                </div>
              </div>

              {/* Banner Token Baru bila baru dibuat */}
              {newTokenRaw && (
                <div style={{
                  padding: "16px 20px", borderRadius: 14, background: "#FEF3C7",
                  border: "2px solid #F59E0B", color: "#78350F", boxShadow: T.shadowLg,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 15 }}>
                    <Icon name="checkCircle" size={18} style={{ color: "#D97706" }} />
                    API Token Baru Berhasil Dibuat!
                  </div>
                  <div style={{ fontSize: 12, color: "#92400E", marginTop: 4, marginBottom: 10 }}>
                    <b>Penting:</b> Salin token ini sekarang. Kunci rahasia ini <u>hanya ditampilkan satu kali</u> demi keamanan dan tidak akan dapat dilihat kembali setelah Anda menutup pesan ini.
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <code style={{
                      padding: "10px 14px", background: "#FFFBEB", borderRadius: 8,
                      fontWeight: 700, fontSize: 14, fontFamily: "monospace", letterSpacing: 0.5,
                      border: "1px solid #FCD34D", color: "#1E293B", wordBreak: "break-all",
                    }}>
                      {newTokenRaw}
                    </code>
                    <Button
                      size="sm"
                      variant="primary"
                      icon="copy"
                      onClick={() => {
                        navigator.clipboard?.writeText(newTokenRaw);
                        showToast?.("Token berhasil disalin ke clipboard!");
                      }}
                    >
                      Salin Token
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTesterToken(newTokenRaw);
                        showToast?.("Token dimuat ke panel pengujian di bawah");
                      }}
                    >
                      Muat ke Tester
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNewTokenRaw("")}>Tutup</Button>
                  </div>
                </div>
              )}

              {/* Tabel Manajemen API Token */}
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Daftar Kunci Akses API (SDPDN & Eksternal)</div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>Kunci akses terprogram untuk membaca katalog dataset, capaian SPM, dan master wilayah secara aman</div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="plus"
                    onClick={() => {
                      setForm({
                        nama_token: "",
                        keterangan: "",
                        abilities: "read:dataset,read:spm,read:wilayah",
                        expires_at: "",
                      });
                      setModal({ type: "api_token" });
                    }}
                  >
                    Buat API Token Baru
                  </Button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Nama Token / Sistem Integrator</th>
                        <th style={thStyle}>Prefix Kunci</th>
                        <th style={thStyle}>Hak Akses (Scopes)</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Terakhir Digunakan</th>
                        <th style={thStyle}>Kedaluwarsa</th>
                        <th style={thStyle}>Dibuat Oleh</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiTokens.map(t => {
                        const scopes = String(t.abilities || "").split(",").map(s => s.trim()).filter(Boolean);
                        return (
                          <tr key={t.id}>
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 800, color: T.text }}>{t.nama_token}</div>
                              {t.keterangan && (
                                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{t.keterangan}</div>
                              )}
                            </td>
                            <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>
                              <span style={{ background: T.bgAlt, padding: "3px 8px", borderRadius: 6, border: `1px solid ${T.border}` }}>
                                {t.token_prefix}...
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {scopes.map(sc => (
                                  <Badge
                                    key={sc}
                                    label={sc}
                                    colors={
                                      sc.includes("dataset")
                                        ? { bg: "#EFF6FF", text: "#2563EB" }
                                        : sc.includes("spm")
                                        ? { bg: "#F0FDF4", text: "#16A34A" }
                                        : sc.includes("wilayah")
                                        ? { bg: "#EDE9FE", text: "#7C3AED" }
                                        : { bg: "#FEF3C7", text: "#D97706" }
                                    }
                                  />
                                ))}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <button
                                onClick={() => toggleTokenActive(t.id)}
                                title="Klik untuk toggle status aktif/nonaktif"
                                style={{
                                  background: "none", border: "none", cursor: "pointer", padding: 0,
                                }}
                              >
                                <Badge
                                  label={t.is_active ? "Aktif" : "Nonaktif"}
                                  colors={t.is_active ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#F1F5F9", text: "#64748B" }}
                                />
                              </button>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: 12, color: t.last_used_at ? T.text : T.textMuted }}>
                                {t.last_used_at ? new Date(t.last_used_at).toLocaleString("id-ID") : "Belum pernah"}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: 12, color: t.expires_at ? T.text : T.textMuted }}>
                                {t.expires_at ? String(t.expires_at).slice(0, 10) : "Tanpa Batas Waktu"}
                              </span>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: 12 }}>{t.created_by || "Admin"}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 6 }}>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => toggleTokenActive(t.id)}
                                >
                                  {t.is_active ? "Nonaktifkan" : "Aktifkan"}
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  icon="trash"
                                  onClick={() => hapusItem(`/api/monitoring/api-token/${t.id}`, `Token ${t.nama_token}`)}
                                  style={{ color: T.danger }}
                                >
                                  Cabut
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {apiTokens.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                            <Icon name="shield" size={28} style={{ opacity: 0.4, marginBottom: 6 }} />
                            <div>Belum ada API Token aktif. Klik "Buat API Token Baru" untuk integrasi SDPDN atau aplikasi luar.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Panel Uji Token & Interactive Tester */}
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Alat Uji & Verifikasi API Token (Interactive Ping Tester)</div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>Simulasikan request integrasi eksternal dengan kunci API untuk memverifikasi validitas, status aktif, dan cakupan wewenang.</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1.5fr auto", gap: 10, alignItems: "flex-end" }}>
                  <div>
                    <label style={lblStyle}>Kunci API Token yang Akan Diuji</label>
                    <input
                      value={testerToken}
                      onChange={e => setTesterToken(e.target.value)}
                      placeholder="Masukkan token, mis: sdi_30413ebf418086a472d54984..."
                      style={{ ...inpStyle, fontFamily: "monospace" }}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Pilih Endpoint Integrasi</label>
                    <Select
                      value={testerEndpoint}
                      onChange={v => setTesterEndpoint(v)}
                      options={[
                        { value: "/api/v1/ping", label: "GET /api/v1/ping (Tes Koneksi Token)" },
                        { value: "/api/v1/dataset", label: "GET /api/v1/dataset (Katalog Dataset)" },
                        { value: "/api/v1/spm", label: "GET /api/v1/spm (Capaian SPM)" },
                        { value: "/api/v1/wilayah", label: "GET /api/v1/wilayah (Master Wilayah)" },
                      ]}
                    />
                  </div>
                  <div>
                    <Button
                      size="md"
                      variant="primary"
                      loading={testerLoading}
                      onClick={jalankanUjiToken}
                    >
                      Jalankan Uji
                    </Button>
                  </div>
                </div>

                {testerResult && (
                  <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: T.bgAlt, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Badge
                          label={`${testerResult.status} ${testerResult.statusText || ""}`}
                          colors={testerResult.ok ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#FEF2F2", text: "#DC2626" }}
                        />
                        <span style={{ fontSize: 12, color: T.textSecondary }}>
                          Waktu Respon: <b>{testerResult.timeMs} ms</b>
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "monospace" }}>
                        Authorization: Bearer {testerToken.slice(0, 10)}...
                      </span>
                    </div>
                    <pre style={{
                      margin: 0, padding: 12, borderRadius: 8, background: T.card,
                      fontSize: 12, fontFamily: "monospace", color: T.text,
                      maxHeight: 220, overflowY: "auto", border: `1px solid ${T.border}`,
                    }}>
                      {JSON.stringify(testerResult.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Panduan Integrasi Developer & Cuplikan Kode */}
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Panduan Integrasi & Contoh Pemanggilan API</div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>Gunakan contoh kode berikut untuk mengintegrasikan Satu Data ke portal SDPDN, aplikasi provinsi, atau bot AI</div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[
                      { key: "curl", label: "cURL" },
                      { key: "js", label: "JavaScript (Fetch)" },
                      { key: "python", label: "Python" },
                    ].map(l => (
                      <button
                        key={l.key}
                        onClick={() => setDocLangTab(l.key)}
                        style={{
                          padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                          border: "none", cursor: "pointer",
                          background: docLangTab === l.key ? T.primary : T.bgAlt,
                          color: docLangTab === l.key ? "#fff" : T.textSecondary,
                        }}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ position: "relative" }}>
                  <pre style={{
                    margin: 0, padding: 14, borderRadius: 10, background: T.bgAlt,
                    color: T.text, fontSize: 12.5, fontFamily: "monospace", overflowX: "auto",
                    border: `1px solid ${T.border}`,
                  }}>
                    {docLangTab === "curl" && `# 1. Tes Konektivitas Token
curl -X GET "${window.location.origin}/api/v1/ping" \\
  -H "Authorization: Bearer <TOKEN_ANDA>"

# 2. Ambil Katalog Dataset Terpublikasi
curl -X GET "${window.location.origin}/api/v1/dataset?limit=20" \\
  -H "Authorization: Bearer <TOKEN_ANDA>"

# 3. Ambil Capaian Standar Pelayanan Minimal (SPM)
curl -X GET "${window.location.origin}/api/v1/spm" \\
  -H "Authorization: Bearer <TOKEN_ANDA>"`}

                    {docLangTab === "js" && `// Mengambil data dataset dengan fetch API
const API_TOKEN = '<TOKEN_ANDA>';
const response = await fetch('${window.location.origin}/api/v1/dataset', {
  headers: {
    'Authorization': 'Bearer ' + API_TOKEN,
    'Accept': 'application/json'
  }
});
const data = await response.json();
console.log('Dataset BAPPERIDA:', data);`}

                    {docLangTab === "python" && `import requests

API_TOKEN = '<TOKEN_ANDA>'
headers = {'Authorization': f'Bearer {API_TOKEN}'}

# Ambil data capaian SPM
res = requests.get('${window.location.origin}/api/v1/spm', headers=headers)
if res.status_code == 200:
    spm_data = res.json()
    print("Jumlah Urusan SPM:", len(spm_data.get('capaian', [])))
else:
    print("Error:", res.status_code, res.text)`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: KESEHATAN SISTEM */}
          {tab === "health" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Kartu Pemeriksaan Kesehatan Sistem */}
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Pemeriksaan Kesehatan Server (System Health)</div>
                    <div style={{ fontSize: 12, color: T.textSecondary }}>Pemantauan waktu nyata basis data PostgreSQL, memori server, dan waktu aktif</div>
                  </div>
                  <Badge
                    label={health.status === "healthy" ? "HEALTHY (200 OK)" : "WARNING"}
                    colors={health.status === "healthy" ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#FEF3C7", text: "#D97706" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 12 }}>
                  <div style={{ padding: 14, borderRadius: 10, background: T.bgAlt, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>LATENSI DATABASE</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#16A34A", marginTop: 4 }}>{health.db_latency_ms ?? 0} ms</div>
                    <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Ambang normal &lt; 100 ms</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, background: T.bgAlt, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>MEMORI SERVER (RSS / HEAP)</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.primary, marginTop: 4 }}>{health.memory_rss_mb ?? 0} MB</div>
                    <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Heap terpakai: {health.memory_heap_mb ?? 0} MB</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, background: T.bgAlt, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>WAKTU AKTIF (UPTIME)</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginTop: 4 }}>
                      {Math.floor((health.uptime_seconds || 0) / 3600)}j {Math.floor(((health.uptime_seconds || 0) % 3600) / 60)}m
                    </div>
                    <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Runtime Node {health.node_version}</div>
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, background: T.bgAlt, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700 }}>WAKTU PENGECEKAN</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginTop: 6 }}>
                      {health.checked_at ? new Date(health.checked_at).toLocaleTimeString("id-ID") : "—"}
                    </div>
                    <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>Endpoint `/api/health` aktif</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Form */}
      {modal && (
        <div
          onClick={() => !busy && setModal(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
            zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card, color: T.text, borderRadius: 14,
              border: `1px solid ${T.border}`, boxShadow: T.shadowLg,
              width: "100%", maxWidth: 500, padding: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {modal.type === "qna_answer"
                  ? "Jawab Pertanyaan Masyarakat"
                  : modal.type === "faq"
                  ? `${modal.mode === "edit" ? "Edit" : "Tambah"} FAQ`
                  : modal.type === "api_token"
                  ? "Buat API Token Baru"
                  : "Simpan Konfigurasi Query"}
              </h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {modal.type === "qna_answer" && (
                <>
                  <div style={{ padding: 12, borderRadius: 8, background: T.bgAlt, fontSize: 12.5 }}>
                    <div><b>Penanya:</b> {modal.item?.nama} ({modal.item?.instansi || "Umum"})</div>
                    <div style={{ marginTop: 4 }}><b>Pertanyaan:</b> {modal.item?.pertanyaan}</div>
                  </div>
                  <div>
                    <label style={lblStyle}>Jawaban Resmi Tim Walidata *</label>
                    <textarea rows={4} value={form.jawaban || ""} onChange={e => setForm(f => ({ ...f, jawaban: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Tampilkan di Halaman Tanya Jawab Publik?</label>
                    <Select
                      value={form.tampil_publik ? "1" : "0"}
                      onChange={v => setForm(f => ({ ...f, tampil_publik: v === "1" }))}
                      options={[
                        { value: "1", label: "Ya, Tampilkan di Portal Publik" },
                        { value: "0", label: "Tidak (Hanya Arsip Internal)" },
                      ]}
                    />
                  </div>
                </>
              )}

              {modal.type === "faq" && (
                <>
                  <div>
                    <label style={lblStyle}>Pertanyaan FAQ *</label>
                    <input value={form.pertanyaan || ""} onChange={e => setForm(f => ({ ...f, pertanyaan: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Jawaban *</label>
                    <textarea rows={3} value={form.jawaban || ""} onChange={e => setForm(f => ({ ...f, jawaban: e.target.value }))} style={inpStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Urutan Tampil</label>
                      <input type="number" value={form.urutan || 1} onChange={e => setForm(f => ({ ...f, urutan: Number(e.target.value) }))} style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Status</label>
                      <Select
                        value={form.is_active ? "1" : "0"}
                        onChange={v => setForm(f => ({ ...f, is_active: v === "1" }))}
                        options={[{ value: "1", label: "Aktif" }, { value: "0", label: "Nonaktif" }]}
                      />
                    </div>
                  </div>
                </>
              )}

              {modal.type === "api_token" && (
                <>
                  <div>
                    <label style={lblStyle}>Nama Token / Sistem Integrator *</label>
                    <input
                      value={form.nama_token || ""}
                      onChange={e => setForm(f => ({ ...f, nama_token: e.target.value }))}
                      placeholder="Mis: Integrasi SDPDN / Portal Provinsi / Dashboard Eksekutif"
                      style={inpStyle}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Keterangan / Catatan Penggunaan</label>
                    <input
                      value={form.keterangan || ""}
                      onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
                      placeholder="Mis: Integrasi pertukaran data statistik berkala per triwulan"
                      style={inpStyle}
                    />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ ...lblStyle, marginBottom: 0 }}>Cakupan Hak Akses (Scopes)</label>
                      <button
                        type="button"
                        onClick={() => {
                          const current = (form.abilities || "").split(",").filter(Boolean);
                          const allScopes = ["read:dataset", "write:dataset", "read:spm", "read:wilayah", "read:konten"];
                          const isAll = allScopes.every(s => current.includes(s));
                          setForm(f => ({
                            ...f,
                            abilities: isAll ? "read:dataset" : allScopes.join(","),
                          }));
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: T.primary }}
                      >
                        Pilih Semua / Reset
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                      {[
                        { key: "read:dataset", label: "Baca Dataset & Nilai", desc: "Membaca katalog & record statistik" },
                        { key: "write:dataset", label: "Input / Tulis Dataset", desc: "Tambah & perbarui nilai dataset" },
                        { key: "read:spm", label: "Baca Capaian SPM", desc: "Membaca rekap 6 urusan SPM" },
                        { key: "read:wilayah", label: "Baca Master Wilayah", desc: "Membaca hierarki kode wilayah" },
                        { key: "read:konten", label: "Baca Konten Portal", desc: "Membaca berita & publikasi kajian" },
                      ].map(sc => {
                        const curList = (form.abilities || "read:dataset,read:spm,read:wilayah").split(",").map(s => s.trim()).filter(Boolean);
                        const isChecked = curList.includes(sc.key) || curList.includes("*");
                        return (
                          <label
                            key={sc.key}
                            onClick={e => {
                              e.preventDefault();
                              const set = new Set(curList);
                              if (set.has(sc.key)) set.delete(sc.key);
                              else set.add(sc.key);
                              setForm(f => ({ ...f, abilities: Array.from(set).join(",") }));
                            }}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: 8, padding: 8,
                              borderRadius: 8, border: `1px solid ${isChecked ? T.primary : T.border}`,
                              background: isChecked ? `${T.primary}12` : T.bgAlt,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              style={{ marginTop: 2, accentColor: T.primary }}
                            />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: isChecked ? T.primary : T.text }}>
                                {sc.label}
                              </div>
                              <div style={{ fontSize: 10, color: T.textMuted }}>{sc.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Masa Berlaku (Kedaluwarsa)</label>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      {[
                        { label: "Tanpa Batas", days: null },
                        { label: "30 Hari", days: 30 },
                        { label: "90 Hari", days: 90 },
                        { label: "1 Tahun", days: 365 },
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            if (!p.days) {
                              setForm(f => ({ ...f, expires_at: "" }));
                            } else {
                              const d = new Date();
                              d.setDate(d.getDate() + p.days);
                              setForm(f => ({ ...f, expires_at: d.toISOString().slice(0, 10) }));
                            }
                          }}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            border: `1px solid ${T.border}`, background: T.bgAlt, color: T.textSecondary,
                            cursor: "pointer",
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <DatePicker
                      value={form.expires_at || ""}
                      onChange={v => setForm(f => ({ ...f, expires_at: v }))}
                    />
                  </div>
                </>
              )}

              {modal.type === "save_query" && (
                <>
                  <div>
                    <label style={lblStyle}>Nama Query Tersimpan *</label>
                    <input value={form.nama_query || ""} onChange={e => setForm(f => ({ ...f, nama_query: e.target.value }))} placeholder="Mis: Rekap Indikator Disetujui 2024-2025" style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Deskripsi</label>
                    <input value={form.deskripsi || ""} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <Button variant="ghost" onClick={() => setModal(null)}>Batal</Button>
              <Button variant="primary" loading={busy} onClick={simpanModal}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
