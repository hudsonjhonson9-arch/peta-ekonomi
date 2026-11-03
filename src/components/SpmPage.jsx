import { useState, useContext, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { ThemeContext } from "../App.jsx";
import useResponsive from "../useResponsive.js";
import { Icon, Select, Button, Badge } from "./ui.jsx";
import SumbaBaratMap, { resolveKecamatanKode } from "./SumbaBaratMap.jsx";

function statusCapaianSpm(persen) {
  const n = Number(persen) || 0;
  if (n >= 80) return { label: "Baik (≥80%)", color: "#16A34A", bg: "#DCFCE7", border: "#86EFAC" };
  if (n >= 60) return { label: "Cukup (60–79%)", color: "#D97706", bg: "#FEF3C7", border: "#FDE047" };
  return { label: "Perlu Perhatian (<60%)", color: "#DC2626", bg: "#FEE2E2", border: "#FCA5A5" };
}

export default function SpmPage({ user, showToast, readOnly = false }) {
  const { T } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);

  const isAdmin = !readOnly && user?.role === "Admin";

  const [tab, setTabState] = useState(() => {
    try {
      return localStorage.getItem("spm_tab") || "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const setTab = (t) => {
    setTabState(t);
    try {
      localStorage.setItem("spm_tab", t);
    } catch (_) {}
  };
  const [filterTahun, setFilterTahun] = useState("2025");
  const [filterUrusan, setFilterUrusan] = useState("SEMUA");
  const [filterWilayah, setFilterWilayah] = useState("SEMUA");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const endpoint = readOnly ? "/api/publik/spm" : "/api/spm";
  const { data, isLoading } = useQuery({
    queryKey: ["spm-data", endpoint],
    queryFn: () => fetch(endpoint, { credentials: "same-origin" }).then(r => (r.ok ? r.json() : {})),
  });

  const reload = () => queryClient.invalidateQueries({ queryKey: ["spm-data"] });

  const urusans = data?.urusan || [];
  const layanans = data?.layanan || [];
  const capaians = data?.capaian || [];
  const dokumens = data?.dokumen || [];
  const wilayahs = data?.wilayah || [];

  const filteredCapaian = useMemo(() => {
    return capaians.filter(c => {
      if (filterTahun !== "SEMUA" && String(c.tahun) !== String(filterTahun)) return false;
      if (filterUrusan !== "SEMUA" && String(c.spm_urusan_id) !== String(filterUrusan)) return false;
      if (filterWilayah !== "SEMUA" && String(c.wilayah_kode) !== String(filterWilayah)) return false;
      return true;
    });
  }, [capaians, filterTahun, filterUrusan, filterWilayah]);

  // Rata-rata per Urusan SPM
  const ringkasanUrusan = useMemo(() => {
    return urusans.map(u => {
      const rows = capaians.filter(
        c => String(c.spm_urusan_id) === String(u.id) && (filterTahun === "SEMUA" || String(c.tahun) === String(filterTahun))
      );
      const avg = rows.length
        ? Number((rows.reduce((s, r) => s + Number(r.capaian_persen || 0), 0) / rows.length).toFixed(2))
        : 0;
      const jmlLayanan = layanans.filter(l => String(l.spm_urusan_id) === String(u.id)).length;
      return { ...u, avg, jmlLayanan, jmlData: rows.length };
    });
  }, [urusans, layanans, capaians, filterTahun]);

  // Rata-rata per Kecamatan (Peta Choropleth Kecamatan Sumba Barat)
  const ringkasanKecamatan = useMemo(() => {
    const kecs = wilayahs.filter(w => w.tingkat === "Kecamatan");
    return kecs.map(k => {
      const rows = capaians.filter(
        c =>
          resolveKecamatanKode(c.wilayah_kode, c.nama_wilayah) === resolveKecamatanKode(k.kode_wilayah, k.nama_wilayah) &&
          (filterTahun === "SEMUA" || String(c.tahun) === String(filterTahun)) &&
          (filterUrusan === "SEMUA" || String(c.spm_urusan_id) === String(filterUrusan))
      );
      const avg = rows.length
        ? Number((rows.reduce((s, r) => s + Number(r.capaian_persen || 0), 0) / rows.length).toFixed(2))
        : 0;
      const totalPenerima = rows.reduce((s, r) => s + Number(r.penerima_layanan || 0), 0);
      return {
        kode_wilayah: k.kode_wilayah,
        nama_wilayah: k.nama_wilayah.replace(/^Kecamatan\s+/i, ""),
        nama_lengkap: k.nama_wilayah,
        penduduk: k.jumlah_penduduk,
        avg,
        totalPenerima,
        jmlIndikator: rows.length,
        status: statusCapaianSpm(avg),
      };
    });
  }, [wilayahs, capaians, filterTahun, filterUrusan]);

  const eksporExcelCapaian = () => {
    const header = [
      "Tahun", "Kode Urusan", "Urusan SPM", "Kode Layanan", "Jenis Layanan SPM",
      "Kode Wilayah", "Nama Wilayah", "Target", "Realisasi", "Capaian (%)",
      "Penerima Layanan", "Anggaran (Rp)", "Keterangan",
    ];
    const rows = filteredCapaian.map(c => [
      c.tahun, c.kode_urusan, c.nama_urusan, c.kode_layanan || "", c.nama_layanan,
      c.wilayah_kode, c.nama_wilayah, Number(c.target || 0), Number(c.realisasi || 0),
      Number(c.capaian_persen || 0), Number(c.penerima_layanan || 0), Number(c.anggaran || 0),
      c.keterangan || "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Capaian_SPM");
    XLSX.writeFile(wb, `Capaian_SPM_Sumba_Barat_${filterTahun}.xlsx`);
  };

  const unduhTemplateSpm = () => {
    const header = ["layanan_id", "nama_layanan", "tahun", "wilayah_kode", "nama_wilayah", "target", "realisasi", "capaian_persen", "penerima_layanan", "anggaran", "keterangan"];
    const contoh = layanans.slice(0, 5).map(l => [
      l.id, l.nama_layanan, Number(filterTahun) || 2025, "53.12", "Kabupaten Sumba Barat", 100, 90, 90, 1200, 500000000, "Capaian Tahunan",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...contoh]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_SPM");
    XLSX.writeFile(wb, "Template_Impor_Capaian_SPM.xlsx");
  };

  const handleImporExcel = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);
      if (!json.length) throw new Error("Berkas Excel kosong");
      const res = await fetch("/api/spm/capaian", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: json }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal mengimpor Excel SPM");
      showToast?.(out.message || "Impor Excel SPM berhasil");
      reload();
    } catch (err) {
      showToast?.("Gagal impor: " + err.message);
    }
  };

  const simpanModal = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      let url = "/api/spm/capaian";
      if (modal.type === "layanan") url = "/api/spm/layanan";
      if (modal.type === "dokumen") url = "/api/spm/dokumen";
      const res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menyimpan data SPM");
      showToast?.(out.message || "Data SPM berhasil disimpan");
      setModal(null);
      reload();
    } catch (err) {
      showToast?.("Gagal: " + err.message);
    } finally {
      setBusy(false);
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
    } catch (err) {
      showToast?.("Gagal: " + err.message);
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
            Standar Pelayanan Minimal (SPM)
          </h2>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>
            Pemantauan capaian 6 Urusan Wajib Pelayanan Dasar & 29 Jenis Layanan SPM Kabupaten Sumba Barat (Permendagri 59/2021)
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" icon="download" onClick={eksporExcelCapaian}>
            Ekspor Excel
          </Button>
          {isAdmin && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImporExcel} style={{ display: "none" }} />
              <Button variant="secondary" icon="upload" onClick={() => fileRef.current?.click()}>
                Impor Excel
              </Button>
              <Button
                variant="primary"
                icon="plus"
                onClick={() => {
                  if (tab === "dokumen") {
                    setForm({ judul: "", kategori: "Laporan SPM", tahun: 2025, nomor_dokumen: "", file_url: "", deskripsi: "" });
                    setModal({ type: "dokumen" });
                  } else if (tab === "referensi") {
                    setForm({ spm_urusan_id: urusans[0]?.id || 1, kode_layanan: "", nama_layanan: "", satuan: "%", target_nasional: 100, urutan: 1 });
                    setModal({ type: "layanan" });
                  } else {
                    setForm({
                      layanan_id: layanans[0]?.id || "",
                      tahun: Number(filterTahun) || 2025,
                      wilayah_kode: "53.12",
                      nama_wilayah: "Kabupaten Sumba Barat",
                      target: 100,
                      realisasi: 90,
                      capaian_persen: 90,
                      penerima_layanan: 1000,
                      anggaran: 0,
                      keterangan: "",
                    });
                    setModal({ type: "capaian" });
                  }
                }}
              >
                {tab === "dokumen" ? "Tambah Dokumen SPM" : tab === "referensi" ? "Tambah Jenis Layanan" : "Input Capaian SPM"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs + Global Filter */}
      <style>{`
        .sd-tabs-no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div
          className="sd-tabs-no-scrollbar"
          onWheel={e => { if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY; }}
          style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", maxWidth: "100%" }}
        >
          {[
            { key: "dashboard", label: "Dashboard & Peta Kecamatan", icon: "chart" },
            { key: "capaian",   label: "Tabel Capaian SPM",          icon: "layers" },
            { key: "referensi", label: "6 Urusan & 29 Layanan",      icon: "folder" },
            { key: "dokumen",   label: `Dokumen SPM (${dokumens.length})`, icon: "file" },
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
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: isMobile ? "wrap" : "nowrap", alignItems: "center" }}>
          <Select
            value={filterTahun}
            onChange={v => setFilterTahun(v)}
            style={{ width: isMobile ? "100%" : 145, minWidth: 135, flex: "0 0 auto" }}
            options={[
              { value: "SEMUA", label: "Semua Tahun" },
              { value: "2026", label: "Tahun 2026" },
              { value: "2025", label: "Tahun 2025" },
              { value: "2024", label: "Tahun 2024" },
            ]}
          />
          <Select
            value={filterUrusan}
            onChange={v => setFilterUrusan(v)}
            style={{ width: isMobile ? "100%" : 240, minWidth: 210, flex: "0 0 auto" }}
            options={[
              { value: "SEMUA", label: "Semua Urusan Wajib SPM" },
              ...urusans.map(u => ({ value: String(u.id), label: `${u.kode} - ${u.nama}` })),
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Memuat data Standar Pelayanan Minimal...</div>
      ) : (
        <>
          {/* TAB 1: DASHBOARD & PETA KECAMATAN */}
          {tab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* 6 Kartu Urusan Wajib SPM */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
                {ringkasanUrusan.map(u => {
                  const st = statusCapaianSpm(u.avg);
                  return (
                    <div
                      key={u.id}
                      onClick={() => setFilterUrusan(filterUrusan === String(u.id) ? "SEMUA" : String(u.id))}
                      style={{
                        background: T.card, borderRadius: 12, padding: 16,
                        border: filterUrusan === String(u.id) ? `2px solid ${u.warna || T.primary}` : `1px solid ${T.border}`,
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: u.warna || T.primary, textTransform: "uppercase" }}>
                            Urusan {u.kode}
                          </span>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 2 }}>{u.nama}</div>
                        </div>
                        <div style={{
                          fontSize: 20, fontWeight: 800, color: st.color,
                          background: st.bg, padding: "4px 10px", borderRadius: 8,
                        }}>
                          {u.avg}%
                        </div>
                      </div>
                      <div style={{ marginTop: 12, height: 7, background: T.bgAlt, borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, u.avg)}%`, height: "100%", background: st.color }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted, marginTop: 8 }}>
                        <span>{u.jmlLayanan} Jenis Layanan</span>
                        <span style={{ color: st.color, fontWeight: 700 }}>{st.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Peta GeoJSON Interaktif Kabupaten Sumba Barat (5312.min.geojson) */}
              <SumbaBaratMap
                mode="spm"
                title={`Peta Standar Pelayanan Minimal Kabupaten Sumba Barat (${filterTahun === "SEMUA" ? "Semua Tahun" : filterTahun})`}
                subtitle="Kanvas GeoJSON 6 Kecamatan Kab. Sumba Barat — Klik poligon kecamatan untuk menyaring rincian capaian SPM"
                items={ringkasanKecamatan.map(k => ({
                  kode: k.kode_wilayah,
                  nama: k.nama_wilayah,
                  nilai: k.avg,
                }))}
                selectedKode={filterWilayah !== "SEMUA" ? filterWilayah : null}
                onSelectKecamatan={(kode) => {
                  setFilterWilayah(kode || "SEMUA");
                  if (kode) setTab("capaian");
                }}
                height={420}
              />

              {/* Peta Choropleth Visual & Grafik Perbandingan Kecamatan */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr", gap: 16 }}>
                {/* Peta Visual Kecamatan Kab. Sumba Barat */}
                <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>
                        Peta Sebaran Capaian SPM per Kecamatan
                      </div>
                      <div style={{ fontSize: 12, color: T.textSecondary }}>
                        Kabupaten Sumba Barat (6 Kecamatan) — Klik kartu kecamatan untuk menyaring
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 11, fontWeight: 600 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: "#16A34A" }} /> ≥80% Baik
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: "#D97706" }} /> 60–79% Cukup
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: "#DC2626" }} /> &lt;60% Perhatian
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 10 }}>
                    {ringkasanKecamatan.map(k => (
                      <div
                        key={k.kode_wilayah}
                        onClick={() => {
                          setFilterWilayah(k.kode_wilayah);
                          setTab("capaian");
                        }}
                        style={{
                          padding: 14, borderRadius: 10,
                          background: k.status.bg,
                          border: `1.5px solid ${k.status.border}`,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 10, fontFamily: "monospace", color: "#475569", fontWeight: 700 }}>
                              {k.kode_wilayah}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                              Kec. {k.nama_wilayah}
                            </div>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: k.status.color }}>
                            {k.avg}%
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#334155", marginTop: 8 }}>
                          <span>Penerima: <b>{k.totalPenerima.toLocaleString("id-ID")}</b> jiwa</span>
                          <span style={{ fontWeight: 700, color: k.status.color }}>{k.status.label.split(" ")[0]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grafik BarChart Capaian Antar Kecamatan */}
                <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 4 }}>
                    Grafik Perbandingan Capaian SPM Kecamatan (%)
                  </div>
                  <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 14 }}>
                    Standar Nasional SPM = 100%
                  </div>
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ringkasanKecamatan} margin={{ top: 10, right: 16, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis dataKey="nama_wilayah" tick={{ fill: T.textSecondary, fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: T.textSecondary, fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8 }}
                          formatter={(val) => [`${val}%`, "Rata-rata Capaian SPM"]}
                        />
                        <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                          {ringkasanKecamatan.map((entry, idx) => (
                            <Cell key={idx} fill={entry.status.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TABEL CAPAIAN SPM */}
          {tab === "capaian" && (
            <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <div style={{ padding: 12, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Select
                    value={filterWilayah}
                    onChange={v => setFilterWilayah(v)}
                    style={{ minWidth: 220 }}
                    options={[
                      { value: "SEMUA", label: "Semua Wilayah (Kab & Kec)" },
                      ...wilayahs.map(w => ({ value: w.kode_wilayah, label: `${w.kode_wilayah} - ${w.nama_wilayah}` })),
                    ]}
                  />
                  {isAdmin && (
                    <Button size="sm" variant="ghost" icon="download" onClick={unduhTemplateSpm}>
                      Unduh Template Impor Excel
                    </Button>
                  )}
                </div>
                <span style={{ fontSize: 12, color: T.textMuted }}>
                  Menampilkan <b>{filteredCapaian.length}</b> baris capaian
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Tahun</th>
                      <th style={thStyle}>Urusan</th>
                      <th style={thStyle}>Jenis Layanan Dasar SPM</th>
                      <th style={thStyle}>Wilayah</th>
                      <th style={thStyle}>Target</th>
                      <th style={thStyle}>Realisasi</th>
                      <th style={thStyle}>Capaian (%)</th>
                      <th style={thStyle}>Penerima</th>
                      <th style={thStyle}>Anggaran (Rp)</th>
                      {isAdmin && <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCapaian.map(c => {
                      const st = statusCapaianSpm(c.capaian_persen);
                      return (
                        <tr key={c.id}>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{c.tahun}</td>
                          <td style={{ ...tdStyle, fontSize: 12, fontWeight: 600, color: c.warna || T.primary }}>
                            {c.kode_urusan} - {c.nama_urusan}
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{c.nama_layanan}</td>
                          <td style={tdStyle}>{c.nama_wilayah}</td>
                          <td style={tdStyle}>{Number(c.target || 0).toLocaleString("id-ID")}</td>
                          <td style={tdStyle}>{Number(c.realisasi || 0).toLocaleString("id-ID")}</td>
                          <td style={tdStyle}>
                            <Badge label={`${c.capaian_persen}%`} colors={{ bg: st.bg, text: st.color }} />
                          </td>
                          <td style={tdStyle}>{Number(c.penerima_layanan || 0).toLocaleString("id-ID")}</td>
                          <td style={tdStyle}>Rp {Number(c.anggaran || 0).toLocaleString("id-ID")}</td>
                          {isAdmin && (
                            <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                              <Button
                                size="xs"
                                variant="ghost"
                                icon="edit"
                                onClick={() => {
                                  setForm({ ...c });
                                  setModal({ type: "capaian" });
                                }}
                              >
                                Edit
                              </Button>{" "}
                              <Button
                                size="xs"
                                variant="ghost"
                                icon="trash"
                                onClick={() => hapusItem(`/api/spm/capaian/${c.id}`, `Capaian ${c.nama_layanan}`)}
                                style={{ color: T.danger }}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: REFERENSI 6 URUSAN & 29 LAYANAN SPM */}
          {tab === "referensi" && (
            <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Kode Urusan</th>
                      <th style={thStyle}>Urusan Wajib Pelayanan Dasar</th>
                      <th style={thStyle}>Kode Layanan</th>
                      <th style={thStyle}>Jenis Layanan Dasar SPM (Permendagri 59/2021)</th>
                      <th style={thStyle}>Target Nasional</th>
                      {isAdmin && <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {layanans
                      .filter(l => filterUrusan === "SEMUA" || String(l.spm_urusan_id) === String(filterUrusan))
                      .map(l => (
                        <tr key={l.id}>
                          <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: l.warna || T.primary }}>
                            {l.kode_urusan}
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{l.nama_urusan}</td>
                          <td style={{ ...tdStyle, fontFamily: "monospace" }}>{l.kode_layanan || "—"}</td>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{l.nama_layanan}</td>
                          <td style={tdStyle}>{l.target_nasional || 100} {l.satuan || "%"}</td>
                          {isAdmin && (
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              <Button
                                size="xs"
                                variant="ghost"
                                icon="trash"
                                onClick={() => hapusItem(`/api/spm/layanan/${l.id}`, l.nama_layanan)}
                                style={{ color: T.danger }}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DOKUMEN SPM */}
          {tab === "dokumen" && (
            <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Tahun</th>
                      <th style={thStyle}>Kategori</th>
                      <th style={thStyle}>Judul Dokumen SPM</th>
                      <th style={thStyle}>Nomor Dokumen</th>
                      <th style={thStyle}>Deskripsi</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tautan / Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dokumens.map(d => (
                      <tr key={d.id}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{d.tahun}</td>
                        <td style={tdStyle}><Badge label={d.kategori} colors={{ bg: "#EFF6FF", text: "#2563EB" }} /></td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{d.judul}</td>
                        <td style={tdStyle}>{d.nomor_dokumen || "—"}</td>
                        <td style={{ ...tdStyle, color: T.textSecondary }}>{d.deskripsi || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          {d.file_url && (
                            <a href={d.file_url} target="_blank" rel="noreferrer" style={{ color: T.primary, fontWeight: 700, fontSize: 12, marginRight: 10 }}>
                              Buka Berkas
                            </a>
                          )}
                          {isAdmin && (
                            <Button
                              size="xs"
                              variant="ghost"
                              icon="trash"
                              onClick={() => hapusItem(`/api/spm/dokumen/${d.id}`, d.judul)}
                              style={{ color: T.danger }}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Input Capaian / Layanan / Dokumen SPM */}
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
              width: "100%", maxWidth: 520, padding: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {modal.type === "capaian" ? "Input / Edit Capaian SPM" : modal.type === "layanan" ? "Tambah Jenis Layanan SPM" : "Tambah Dokumen SPM"}
              </h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {modal.type === "capaian" && (
                <>
                  <div>
                    <label style={lblStyle}>Jenis Layanan Dasar SPM *</label>
                    <Select
                      fullWidth
                      value={String(form.layanan_id || "")}
                      onChange={v => setForm(f => ({ ...f, layanan_id: Number(v) }))}
                      options={layanans.map(l => ({ value: String(l.id), label: `${l.kode_urusan} - ${l.nama_layanan}` }))}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Tahun *</label>
                      <input type="number" value={form.tahun || 2025} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Wilayah (Kabupaten / Kecamatan) *</label>
                      <Select
                        fullWidth
                        value={String(form.wilayah_kode || "53.12")}
                        onChange={v => {
                          const w = wilayahs.find(x => x.kode_wilayah === v);
                          setForm(f => ({ ...f, wilayah_kode: v, nama_wilayah: w?.nama_wilayah || v }));
                        }}
                        options={wilayahs.map(w => ({ value: w.kode_wilayah, label: `${w.kode_wilayah} - ${w.nama_wilayah}` }))}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Target</label>
                      <input type="number" step="0.01" value={form.target ?? 100} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Realisasi</label>
                      <input type="number" step="0.01" value={form.realisasi ?? 0} onChange={e => setForm(f => ({ ...f, realisasi: e.target.value }))} style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Capaian (%)</label>
                      <input type="number" step="0.01" value={form.capaian_persen ?? ""} onChange={e => setForm(f => ({ ...f, capaian_persen: e.target.value }))} style={inpStyle} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Penerima Layanan (Jiwa)</label>
                      <input type="number" value={form.penerima_layanan ?? 0} onChange={e => setForm(f => ({ ...f, penerima_layanan: e.target.value }))} style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Realisasi Anggaran (Rp)</label>
                      <input type="number" value={form.anggaran ?? 0} onChange={e => setForm(f => ({ ...f, anggaran: e.target.value }))} style={inpStyle} />
                    </div>
                  </div>
                </>
              )}

              {modal.type === "layanan" && (
                <>
                  <div>
                    <label style={lblStyle}>Urusan Wajib SPM *</label>
                    <Select
                      fullWidth
                      value={String(form.spm_urusan_id || "")}
                      onChange={v => setForm(f => ({ ...f, spm_urusan_id: Number(v) }))}
                      options={urusans.map(u => ({ value: String(u.id), label: `${u.kode} - ${u.nama}` }))}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Kode Layanan</label>
                    <input value={form.kode_layanan || ""} onChange={e => setForm(f => ({ ...f, kode_layanan: e.target.value }))} placeholder="Mis: 1.01.04" style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Nama Jenis Layanan Dasar SPM *</label>
                    <input value={form.nama_layanan || ""} onChange={e => setForm(f => ({ ...f, nama_layanan: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "dokumen" && (
                <>
                  <div>
                    <label style={lblStyle}>Judul Dokumen SPM *</label>
                    <input value={form.judul || ""} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} style={inpStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Kategori</label>
                      <Select
                        fullWidth
                        value={form.kategori || "Laporan SPM"}
                        onChange={v => setForm(f => ({ ...f, kategori: v }))}
                        options={[
                          { value: "Laporan SPM", label: "Laporan SPM" },
                          { value: "Regulasi SPM", label: "Regulasi SPM" },
                          { value: "SK Tim SPM", label: "SK Tim SPM" },
                          { value: "Rencana Aksi SPM", label: "Rencana Aksi SPM" },
                        ]}
                      />
                    </div>
                    <div>
                      <label style={lblStyle}>Tahun</label>
                      <input type="number" value={form.tahun || 2025} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} style={inpStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Nomor Dokumen</label>
                    <input value={form.nomor_dokumen || ""} onChange={e => setForm(f => ({ ...f, nomor_dokumen: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>URL Berkas (Opsional)</label>
                    <input value={form.file_url || ""} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Deskripsi</label>
                    <textarea rows={2} value={form.deskripsi || ""} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} style={inpStyle} />
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
