import { useState, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { ThemeContext } from "../App.jsx";
import useResponsive from "../useResponsive.js";
import { POLLING } from "../hooks.js";
import { Icon, Select, DatePicker, Button, Badge } from "./ui.jsx";
import BankData from "./BankData.jsx";
import BankDataDashboard from "./BankDataDashboard.jsx";
import GrafikDataset from "./GrafikDataset.jsx";

function BankDataReadOnly() {
  const { T } = useContext(ThemeContext);
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Bank Data Kinerja & Sektoral</div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
          Data sektoral dan indikator kinerja per OPD di BAPPERIDA
        </div>
      </div>
      <BankDataDashboard emptyMessage="Belum ada data bank data. Hubungi admin atau operator OPD untuk melengkapi data." />
    </div>
  );
}

const STATUS_DATASET_META = {
  draft:           { label: "Draft",            bg: "#F1F5F9", text: "#475569", darkBg: "#1E293B", darkText: "#94A3B8" },
  diajukan:        { label: "Menunggu Verifikasi", bg: "#FEF3C7", text: "#D97706", darkBg: "#451A03", darkText: "#FBBF24" },
  disetujui:       { label: "Disetujui",        bg: "#DCFCE7", text: "#15803D", darkBg: "#052E16", darkText: "#4ADE80" },
  perlu_perbaikan: { label: "Perlu Perbaikan",  bg: "#FFEDD5", text: "#C2410C", darkBg: "#431407", darkText: "#FB923C" },
  ditolak:         { label: "Ditolak",          bg: "#FEE2E2", text: "#B91C1C", darkBg: "#450A0A", darkText: "#F87171" },
};

const KLASIFIKASI_META = {
  terbuka:  { label: "Terbuka (Publik)", bg: "#EFF6FF", text: "#2563EB" },
  terbatas: { label: "Terbatas (Internal)", bg: "#FEF3C7", text: "#D97706" },
  tertutup: { label: "Tertutup (Rahasia)", bg: "#FEE2E2", text: "#DC2626" },
};

export function unduhDatasetExcel(dataset, fields = [], rows = []) {
  const header = ["tahun", "periode", "wilayah_kode", ...fields.map(f => f.label)];
  const body = rows.map(r => [
    r.tahun,
    r.periode || "Tahunan",
    r.wilayah_kode || "",
    ...fields.map(f => r.data?.[f.nama_field] ?? ""),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  const safeName = String(dataset?.nama || dataset?.judul || "Dataset")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 50);
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}

export function unduhTemplateDatasetExcel(dataset, fields = []) {
  const header = ["tahun", "periode", "wilayah_kode", ...fields.map(f => f.label)];
  const contoh = [
    new Date().getFullYear(),
    dataset?.frekuensi || "Tahunan",
    "Sumba Barat",
    ...fields.map(f => (f.tipe_data === "angka" ? 100 : f.tipe_data === "desimal" ? 12.5 : f.tipe_data === "pilihan" ? (f.pilihan?.[0] || "") : "Contoh")),
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, contoh]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  const safeName = String(dataset?.nama || dataset?.judul || "Dataset")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 45);
  XLSX.writeFile(wb, `Template_${safeName}.xlsx`);
}

export default function BankDataPage({ user, showToast }) {
  const { T } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();

  const canWrite = user?.role === "Admin" || user?.role === "Operator Bank Data";
  const canVerify = user?.role === "Admin" || user?.role === "Reviewer";
  const isOperator = user?.role === "Operator Bank Data";

  const [tab, setTabState] = useState(() => {
    try {
      return localStorage.getItem("bankdata_tab") || "dataset";
    } catch {
      return "dataset";
    }
  });
  const setTab = (t) => {
    setTabState(t);
    try {
      localStorage.setItem("bankdata_tab", t);
    } catch (_) {}
  };
  const [selectedId, setSelectedIdState] = useState(() => {
    try {
      const s = sessionStorage.getItem("bankdata_selected_dataset_id");
      return s ? Number(s) || s : null;
    } catch {
      return null;
    }
  });
  const setSelectedId = (id) => {
    setSelectedIdState(id);
    try {
      if (id == null) sessionStorage.removeItem("bankdata_selected_dataset_id");
      else sessionStorage.setItem("bankdata_selected_dataset_id", String(id));
    } catch (_) {}
  };
  const [modalCreate, setModalCreate] = useState(false);
  const [filterOpd, setFilterOpdState] = useState(() => {
    try { return sessionStorage.getItem("bankdata_filter_opd") || "SEMUA"; } catch { return "SEMUA"; }
  });
  const setFilterOpd = (v) => {
    setFilterOpdState(v);
    try { sessionStorage.setItem("bankdata_filter_opd", v); } catch (_) {}
  };
  const [filterStatus, setFilterStatusState] = useState(() => {
    try { return sessionStorage.getItem("bankdata_filter_status") || "SEMUA"; } catch { return "SEMUA"; }
  });
  const setFilterStatus = (v) => {
    setFilterStatusState(v);
    try { sessionStorage.setItem("bankdata_filter_status", v); } catch (_) {}
  };
  const [searchQ, setSearchQ] = useState("");

  const { data: opdList = [] } = useQuery({
    queryKey: ["bankdata-opd"],
    queryFn: () => fetch("/api/bankdata/opd").then(r => (r.ok ? r.json() : [])),
    refetchInterval: POLLING,
  });

  const { data: datasetList = [], isLoading: loadingList } = useQuery({
    queryKey: ["bankdata-dataset"],
    queryFn: () => fetch("/api/bankdata/dataset").then(r => (r.ok ? r.json() : [])),
    refetchInterval: POLLING,
  });

  const { data: verifList = [] } = useQuery({
    queryKey: ["bankdata-dataset-verifikasi"],
    queryFn: () => fetch("/api/bankdata/dataset/verifikasi").then(r => (r.ok ? r.json() : [])),
    enabled: canVerify,
    refetchInterval: POLLING,
  });

  const pendingVerifCount = useMemo(
    () => verifList.filter(d => d.status === "diajukan").length,
    [verifList]
  );

  const reloadDatasets = () => {
    queryClient.invalidateQueries({ queryKey: ["bankdata-dataset"] });
    queryClient.invalidateQueries({ queryKey: ["bankdata-dataset-verifikasi"] });
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: ["bankdata-dataset-detail", selectedId] });
    }
  };

  const filteredDatasets = useMemo(() => {
    const source = tab === "verifikasi" ? verifList : datasetList;
    return source.filter(d => {
      if (filterOpd !== "SEMUA" && String(d.opd_id) !== String(filterOpd)) return false;
      if (filterStatus !== "SEMUA" && d.status !== filterStatus) return false;
      if (searchQ.trim()) {
        const q = searchQ.trim().toLowerCase();
        const hay = `${d.nama || ""} ${d.deskripsi || ""} ${d.opd_nama || ""} ${d.sumber_data || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tab, datasetList, verifList, filterOpd, filterStatus, searchQ]);

  return (
    <div>
      {/* Banner OPD untuk Operator Bank Data */}
      {isOperator && (
        <div style={{
          background: `linear-gradient(135deg, ${T.sidebarBg}, ${T.primary})`,
          borderRadius: 14, padding: isMobile ? "16px" : "18px 22px",
          marginBottom: 18, color: "#fff",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, opacity: 0.8 }}>
              Operator Bank Data OPD
            </div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, marginTop: 2 }}>
              {user.opd_nama || opdList[0]?.nama || "Belum Dipetakan ke OPD"}
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 99,
            background: "rgba(255,255,255,0.18)", color: "#fff",
          }}>
            Akses Terkunci 1 OPD
          </span>
        </div>
      )}

      {/* Navigasi Mode Bank Data */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20,
        borderBottom: `1px solid ${T.border}`, paddingBottom: 12,
      }}>
        {[
          { id: "dataset", label: "Dataset Satu Data", icon: "chart", count: datasetList.length },
          { id: "kinerja", label: "Indikator Kinerja (IKU / IKK & Sektoral)", icon: "layers" },
          ...(canVerify ? [{
            id: "verifikasi",
            label: "Verifikasi Dataset",
            icon: "checkCircle",
            badge: pendingVerifCount,
          }] : []),
        ].map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedId(null); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "9px 16px", borderRadius: 10,
                border: active ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                background: active ? T.primaryLight : T.card,
                color: active ? T.primary : T.textSecondary,
                fontWeight: active ? 700 : 600, fontSize: 13, cursor: "pointer",
              }}
            >
              <Icon name={t.icon} size={15} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span style={{
                  fontSize: 11, padding: "1px 7px", borderRadius: 99,
                  background: active ? T.primary : T.surfaceHover,
                  color: active ? "#fff" : T.textMuted, fontWeight: 700,
                }}>
                  {t.count}
                </span>
              )}
              {t.badge > 0 && (
                <span style={{
                  fontSize: 11, padding: "1px 7px", borderRadius: 99,
                  background: "#DC2626", color: "#fff", fontWeight: 700,
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "kinerja" ? (
        canWrite ? <BankData user={user} showToast={showToast} /> : <BankDataReadOnly />
      ) : selectedId ? (
        <DatasetDetailView
          datasetId={selectedId}
          user={user}
          opdList={opdList}
          canWrite={canWrite}
          canVerify={canVerify}
          isOperator={isOperator}
          onBack={() => setSelectedId(null)}
          onReloadList={reloadDatasets}
          showToast={showToast}
          T={T}
          isMobile={isMobile}
        />
      ) : (
        <div>
          {/* Header & Filter Bar */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-start",
            flexWrap: "wrap", gap: 12, marginBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, color: T.text }}>
                {tab === "verifikasi" ? "Antrean Verifikasi Dataset (Walidata)" : "Katalog Dataset Sektoral (Satu Data)"}
              </div>
              <div style={{ fontSize: 12.5, color: T.textSecondary, marginTop: 2 }}>
                {tab === "verifikasi"
                  ? "Periksa kelengkapan metadata, struktur kolom, dan baris data sebelum dipublikasikan ke Portal Publik."
                  : "Kelola tabel dataset dinamis, impor/ekspor Excel, visualisasi grafik Recharts, dan pengajuan publikasi terbuka."}
              </div>
            </div>
            {canWrite && tab === "dataset" && (
              <button
                onClick={() => setModalCreate(true)}
                style={{
                  padding: "10px 16px", background: T.primary, color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <Icon name="plus" size={15} /> Tambah Indikator Data
              </button>
            )}
          </div>

          {/* Filter & Pencarian */}
          <div style={{
            background: T.card, borderRadius: 12, border: `1px solid ${T.border}`,
            padding: 14, marginBottom: 16,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : (!isOperator ? "1.6fr 1fr 1fr" : "2fr 1fr"),
            gap: 10,
          }}>
            <div style={{ position: "relative" }}>
              <Icon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Cari judul dataset, OPD, atau sumber data..."
                style={{
                  width: "100%", padding: "9px 12px 9px 34px",
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  background: T.inputBg, color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            {!isOperator && (
              <Select
                fullWidth
                value={filterOpd}
                onChange={v => setFilterOpd(v)}
                options={[
                  { value: "SEMUA", label: `Semua OPD (${opdList.length})` },
                  ...opdList.map(o => ({ value: String(o.id), label: o.nama })),
                ]}
              />
            )}
            <Select
              fullWidth
              value={filterStatus}
              onChange={v => setFilterStatus(v)}
              options={[
                { value: "SEMUA", label: "Semua Status" },
                { value: "draft", label: "Draft" },
                { value: "diajukan", label: "Menunggu Verifikasi" },
                { value: "disetujui", label: "Disetujui (Terbit)" },
                { value: "perlu_perbaikan", label: "Perlu Perbaikan" },
                { value: "ditolak", label: "Ditolak" },
              ]}
            />
          </div>

          {/* Daftar Dataset */}
          {loadingList ? (
            <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
              Memuat daftar dataset...
            </div>
          ) : filteredDatasets.length === 0 ? (
            <div style={{
              background: T.card, borderRadius: 12, border: `1px solid ${T.border}`,
              padding: 40, textAlign: "center", color: T.textMuted,
            }}>
              <Icon name="chart" size={28} style={{ color: T.textMuted, marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Belum ada dataset</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>
                {canWrite
                  ? 'Klik "Buat Dataset Baru" untuk membuat tabel dataset sektoral beserta visualisasi grafiknya.'
                  : "Belum ada dataset yang sesuai dengan filter."}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              {filteredDatasets.map(d => {
                const st = STATUS_DATASET_META[d.status] || STATUS_DATASET_META.draft;
                const kl = KLASIFIKASI_META[d.klasifikasi] || KLASIFIKASI_META.terbuka;
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    style={{
                      background: T.card, borderRadius: 12, border: `1px solid ${T.border}`,
                      padding: 16, cursor: "pointer", transition: "all 0.15s",
                      display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = T.shadowSm; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                          background: st.bg, color: st.text,
                        }}>
                          {st.label}
                        </span>
                        <span style={{
                          fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                          background: kl.bg, color: kl.text,
                        }}>
                          {kl.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4, lineHeight: 1.35 }}>
                        {d.nama}
                      </div>
                      <div style={{ fontSize: 12, color: T.primary, fontWeight: 600, marginBottom: 6 }}>
                        {d.opd_nama}
                      </div>
                      {d.deskripsi && (
                        <div style={{
                          fontSize: 12, color: T.textSecondary, lineHeight: 1.45,
                          overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        }}>
                          {d.deskripsi}
                        </div>
                      )}
                    </div>

                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      paddingTop: 10, borderTop: `1px solid ${T.border}`, fontSize: 11.5, color: T.textMuted,
                      flexWrap: "wrap", gap: 6,
                    }}>
                      <span>
                        <b>{d.jumlah_field || 0}</b> kolom · <b>{d.jumlah_baris || 0}</b> baris
                        {d.tahun_min ? ` · ${d.tahun_min}${d.tahun_max && d.tahun_max !== d.tahun_min ? `–${d.tahun_max}` : ""}` : ""}
                      </span>
                      <span style={{ color: T.primary, fontWeight: 700 }}>Buka Dataset ›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modalCreate && (
        <ModalBuatDataset
          opdList={opdList}
          user={user}
          isOperator={isOperator}
          onClose={() => setModalCreate(false)}
          onCreated={ds => {
            setModalCreate(false);
            reloadDatasets();
            if (ds?.id) setSelectedId(ds.id);
            showToast("Indikator data berhasil dibuat");
          }}
          showToast={showToast}
          T={T}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

function formatTanggalIndo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${d.getDate()} ${bulan[d.getMonth()]}`;
}

function ModalBuatDataset({ opdList, user, isOperator, onClose, onCreated, showToast, T, isMobile }) {
  const defaultOpd = isOperator ? (user.opd_id || opdList[0]?.id || "") : (opdList[0]?.id || "");
  const userOpdObj = opdList.find(o => String(o.id) === String(user?.opd_id)) || (isOperator ? { nama: user?.opd_nama || "OPD Anda" } : null);

  const { data: masterData } = useQuery({
    queryKey: ["satudata-master-ringkasan"],
    queryFn: () => fetch("/api/satudata/master/ringkasan", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : {})),
  });

  const urusanList = masterData?.urusan || [];
  const bidangUrusanList = masterData?.bidangUrusan || [];
  const topikList = masterData?.topik || [];
  const subTopikList = masterData?.subTopik || [];
  const satuanList = masterData?.satuan || [];
  const templatePresets = masterData?.template_field || [];

  const [form, setForm] = useState({
    opd_id: defaultOpd,
    urusan_id: "",
    bidang_urusan_id: "",
    topik_id: "",
    sub_topik_id: "",
    satuan_id: "",
    satuan_custom: "",
    kode_sds: "",
    nama_data: "",
    definisi: "",
    sumber_referensi: user?.opd_nama || "",
    prioritas: "non_prioritas",
    klasifikasi_risiko: "terbuka",
    klasifikasi_penyajian: "",
    frekuensi_pemutakhiran: "Tahunan",
    jadwal_pemutakhiran: "",
    jadwal_pemutakhiran_akhir: "",
    tahun_mulai: new Date().getFullYear(),
  });

  const [modeRange, setModeRange] = useState(false);
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [isCustomSatuan, setIsCustomSatuan] = useState(false);

  const [fields, setFields] = useState([
    { label: "Nilai", tipe_data: "desimal", wajib: true, tampil_grafik: true, pilihan: "" },
  ]);
  const [saving, setSaving] = useState(false);

  // Cascading options
  const filteredBidangUrusan = useMemo(() => {
    if (!form.urusan_id) return [];
    return bidangUrusanList.filter(b => String(b.urusan_id) === String(form.urusan_id));
  }, [form.urusan_id, bidangUrusanList]);

  const filteredSubTopik = useMemo(() => {
    if (!form.topik_id) return [];
    return subTopikList.filter(s => String(s.topik_id) === String(form.topik_id));
  }, [form.topik_id, subTopikList]);

  const addTag = (val) => {
    const trimmed = (val || "").replace(/,/g, "").trim();
    if (!trimmed) return;
    if (!keywords.includes(trimmed)) {
      setKeywords(prev => [...prev, trimmed]);
    }
    setKeywordInput("");
  };

  const removeTag = (idx) => {
    setKeywords(prev => prev.filter((_, i) => i !== idx));
  };

  const handleKeywordKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(keywordInput);
    } else if (e.key === "Backspace" && !keywordInput && keywords.length > 0) {
      removeTag(keywords.length - 1);
    }
  };

  const addField = () => {
    setFields(prev => [...prev, { label: "", tipe_data: "angka", wajib: false, tampil_grafik: true, pilihan: "" }]);
  };

  const updateField = (idx, key, val) => {
    setFields(prev => prev.map((f, i) => (i === idx ? { ...f, [key]: val } : f)));
  };

  const removeField = idx => {
    setFields(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!form.nama_data.trim()) return showToast("Nama Data / Indikator wajib diisi");
    if (!form.opd_id) return showToast("OPD Produsen Data wajib dipilih");
    if (!form.definisi.trim()) return showToast("Definisi data wajib diisi");

    let finalSatuan = "";
    if (isCustomSatuan) {
      finalSatuan = form.satuan_custom.trim();
      if (!finalSatuan) return showToast("Satuan kustom wajib diisi");
    } else if (form.satuan_id) {
      const found = satuanList.find(s => String(s.id) === String(form.satuan_id));
      finalSatuan = found ? found.nama_satuan : "";
    }
    if (!finalSatuan && !form.satuan_id) return showToast("Satuan wajib dipilih atau diisi");

    const validFields = fields.filter(f => f.label.trim());
    if (validFields.length === 0) return showToast("Tambahkan minimal 1 kolom indikator");

    setSaving(true);
    try {
      const res = await fetch("/api/bankdata/dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opd_id: Number(form.opd_id),
          nama: form.nama_data.trim(),
          definisi: form.definisi.trim(),
          deskripsi: form.definisi.trim(),
          sumber_data: form.sumber_referensi.trim(),
          sumber_referensi: form.sumber_referensi.trim(),
          satuan: finalSatuan,
          satuan_id: form.satuan_id ? Number(form.satuan_id) : null,
          urusan_id: form.urusan_id ? Number(form.urusan_id) : null,
          bidang_urusan_id: form.bidang_urusan_id ? Number(form.bidang_urusan_id) : null,
          topik_id: form.topik_id ? Number(form.topik_id) : null,
          sub_topik_id: form.sub_topik_id ? Number(form.sub_topik_id) : null,
          keywords,
          kode_sds: form.kode_sds.trim() || null,
          prioritas: form.prioritas,
          klasifikasi: form.klasifikasi_risiko,
          klasifikasi_risiko: form.klasifikasi_risiko,
          klasifikasi_penyajian: form.klasifikasi_penyajian.trim() || null,
          frekuensi: form.frekuensi_pemutakhiran,
          frekuensi_pemutakhiran: form.frekuensi_pemutakhiran,
          jadwal_pemutakhiran: form.jadwal_pemutakhiran || null,
          jadwal_pemutakhiran_akhir: modeRange ? (form.jadwal_pemutakhiran_akhir || null) : null,
          tahun_mulai: Number(form.tahun_mulai) || new Date().getFullYear(),
          fields: validFields.map((f, idx) => ({
            label: f.label.trim(),
            tipe_data: f.tipe_data,
            wajib: f.wajib,
            tampil_grafik: f.tampil_grafik,
            pilihan: f.tipe_data === "pilihan" ? f.pilihan : [],
            urutan: idx + 1,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "Gagal membuat indikator data");
      onCreated(data.dataset);
    } catch {
      showToast("Gagal menghubungi server");
    } finally {
      setSaving(false);
    }
  };

  const inputSt = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.inputBg,
    color: T.text, fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  const labelSt = {
    fontSize: 12, fontWeight: 600, color: T.textSecondary,
    display: "block", marginBottom: 5,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1300, padding: isMobile ? 8 : 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
          padding: isMobile ? 16 : 24, width: "100%", maxWidth: 840,
          maxHeight: "92vh", overflowY: "auto", boxShadow: T.shadowLg,
        }}
      >
        {/* Header Modal */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: `1px solid ${T.border}`, paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: T.primaryLight, color: T.primary,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="layers" size={20} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Form Tambah Indikator Data</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>Standar Metadata Satu Data Indonesia (SDI)</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, padding: 4 }}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* OPD Produsen Data */}
          <div>
            <label style={labelSt}>OPD Produsen Data <span style={{ color: T.danger }}>*</span></label>
            {isOperator ? (
              <div style={{
                background: "rgba(13, 148, 136, 0.08)",
                border: "1px solid rgba(13, 148, 136, 0.25)",
                borderRadius: 8, padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <Icon name="building" size={18} style={{ color: "#0D9488", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F766E" }}>
                    {userOpdObj?.nama || user?.opd_nama || "OPD Anda"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#115E59", marginTop: 1 }}>
                    Data indikator ini akan disimpan untuk OPD Anda
                  </div>
                </div>
              </div>
            ) : (
              <Select
                fullWidth
                searchable
                value={form.opd_id}
                placeholder="— Pilih atau cari OPD Produsen Data —"
                onChange={v => setForm({ ...form, opd_id: v })}
                options={[
                  { value: "", label: "— Pilih atau cari OPD Produsen Data —" },
                  ...opdList.map(o => ({ value: String(o.id), label: o.nama })),
                ]}
              />
            )}
          </div>

          {/* Urusan & Bidang Urusan */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Urusan</label>
              <Select
                fullWidth
                searchable
                value={form.urusan_id}
                placeholder="Pilih atau cari Urusan..."
                onChange={v => setForm({ ...form, urusan_id: v, bidang_urusan_id: "" })}
                options={[
                  { value: "", label: "— Pilih Urusan (Opsional) —" },
                  ...urusanList.map(u => ({ value: String(u.id), label: `${u.kode_urusan} - ${u.nama_urusan}` })),
                ]}
              />
            </div>
            <div>
              <label style={labelSt}>Bidang Urusan</label>
              <Select
                fullWidth
                searchable
                disabled={!form.urusan_id}
                value={form.bidang_urusan_id}
                placeholder={!form.urusan_id ? "Pilih urusan terlebih dahulu..." : "Pilih atau cari Bidang Urusan..."}
                onChange={v => setForm({ ...form, bidang_urusan_id: v })}
                options={[
                  { value: "", label: !form.urusan_id ? "— Pilih urusan terlebih dahulu —" : "— Pilih Bidang Urusan (Opsional) —" },
                  ...filteredBidangUrusan.map(b => ({ value: String(b.id), label: `${b.kode_bidang} - ${b.nama_bidang}` })),
                ]}
              />
            </div>
          </div>

          {/* Topik & Sub Topik */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Topik</label>
              <Select
                fullWidth
                searchable
                value={form.topik_id}
                placeholder="Pilih atau cari Topik..."
                onChange={v => setForm({ ...form, topik_id: v, sub_topik_id: "" })}
                options={[
                  { value: "", label: "— Pilih Topik (Opsional) —" },
                  ...topikList.map(t => ({ value: String(t.id), label: t.nama_topik })),
                ]}
              />
            </div>
            <div>
              <label style={labelSt}>Sub Topik</label>
              <Select
                fullWidth
                searchable
                disabled={!form.topik_id}
                value={form.sub_topik_id}
                placeholder={!form.topik_id ? "Pilih topik terlebih dahulu..." : "Pilih atau cari Sub Topik..."}
                onChange={v => setForm({ ...form, sub_topik_id: v })}
                options={[
                  { value: "", label: !form.topik_id ? "— Pilih topik terlebih dahulu —" : "— Pilih Sub Topik (Opsional) —" },
                  ...filteredSubTopik.map(s => ({ value: String(s.id), label: s.nama_sub_topik })),
                ]}
              />
            </div>
          </div>

          {/* Keywords Tag Input */}
          <div>
            <label style={labelSt}>Keyword / Kata Kunci</label>
            <div style={{
              display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
              padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.inputBg, minHeight: 42,
            }}>
              {keywords.map((kw, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 9px", borderRadius: 6,
                    background: T.primaryLight, color: T.primary,
                    fontSize: 12, fontWeight: 600,
                  }}
                >
                  <Icon name="tag" size={11} />
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: T.primary, display: "flex", padding: 0 }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
              <input
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                onBlur={() => { if (keywordInput.trim()) addTag(keywordInput); }}
                placeholder={keywords.length === 0 ? "Ketik keyword lalu tekan Enter atau koma..." : "Tambah keyword..."}
                style={{
                  flex: 1, minWidth: 160, border: "none", outline: "none",
                  background: "transparent", color: T.text, fontSize: 13,
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
              Tekan <kbd style={{ padding: "1px 5px", fontSize: 10.5, fontFamily: "monospace", background: T.surfaceHover, borderRadius: 4, border: `1px solid ${T.border}` }}>Enter</kbd> atau <kbd style={{ padding: "1px 5px", fontSize: 10.5, fontFamily: "monospace", background: T.surfaceHover, borderRadius: 4, border: `1px solid ${T.border}` }}>,</kbd> untuk menambah keyword
            </div>
          </div>

          {/* Kode SDS & Kode Indikator */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Kode SDS</label>
              <input
                value={form.kode_sds}
                onChange={e => setForm({ ...form, kode_sds: e.target.value })}
                placeholder="Masukkan kode SDS (opsional)"
                style={inputSt}
              />
            </div>
            <div>
              <label style={labelSt}>Kode Indikator</label>
              <div style={{
                ...inputSt, background: T.surfaceHover, color: T.textMuted,
                display: "flex", alignItems: "center",
              }}>
                <Icon name="check" size={13} style={{ marginRight: 6, color: "#16A34A" }} />
                <span>Dibuat otomatis setelah disimpan</span>
              </div>
            </div>
          </div>

          {/* Nama Data / Indikator */}
          <div>
            <label style={labelSt}>Nama Data / Indikator <span style={{ color: T.danger }}>*</span></label>
            <input
              value={form.nama_data}
              onChange={e => setForm({ ...form, nama_data: e.target.value })}
              placeholder="Contoh: Jumlah Produksi Padi Sawah Menurut Kecamatan"
              style={inputSt}
            />
          </div>

          {/* Definisi */}
          <div>
            <label style={labelSt}>Definisi Data <span style={{ color: T.danger }}>*</span></label>
            <textarea
              rows={3}
              value={form.definisi}
              onChange={e => setForm({ ...form, definisi: e.target.value })}
              placeholder="Penjelasan definisi, konsep, metodologi perhitungan, atau cakupan data indikator ini..."
              style={inputSt}
            />
          </div>

          {/* Sumber Referensi */}
          <div>
            <label style={labelSt}>Sumber Referensi / Sumber Data</label>
            <textarea
              rows={2}
              value={form.sumber_referensi}
              onChange={e => setForm({ ...form, sumber_referensi: e.target.value })}
              placeholder="Contoh: Survei Pertanian BPS / Laporan Bulanan Dinas Pertanian"
              style={inputSt}
            />
          </div>

          {/* Satuan */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <label style={{ ...labelSt, marginBottom: 0 }}>Satuan <span style={{ color: T.danger }}>*</span></label>
              <button
                type="button"
                onClick={() => setIsCustomSatuan(v => !v)}
                style={{ background: "none", border: "none", color: T.primary, fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
              >
                {isCustomSatuan ? "← Pilih dari Master Satuan" : "+ Input Kustom"}
              </button>
            </div>
            {isCustomSatuan ? (
              <input
                value={form.satuan_custom}
                onChange={e => setForm({ ...form, satuan_custom: e.target.value })}
                placeholder="Contoh: Ton / Ha / Persen / Jiwa"
                style={inputSt}
              />
            ) : (
              <Select
                fullWidth
                searchable
                value={form.satuan_id}
                placeholder="Pilih atau cari satuan..."
                onChange={v => setForm({ ...form, satuan_id: v })}
                options={[
                  { value: "", label: "— Pilih Satuan —" },
                  ...satuanList.map(s => ({ value: String(s.id), label: s.nama_satuan })),
                ]}
              />
            )}
          </div>

          {/* Prioritas & Klasifikasi Risiko */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Prioritas <span style={{ color: T.danger }}>*</span></label>
              <Select
                fullWidth
                value={form.prioritas}
                onChange={v => setForm({ ...form, prioritas: v })}
                options={[
                  { value: "non_prioritas", label: "Non Prioritas" },
                  { value: "prioritas", label: "Prioritas" },
                ]}
              />
            </div>
            <div>
              <label style={labelSt}>Klasifikasi Risiko <span style={{ color: T.danger }}>*</span></label>
              <Select
                fullWidth
                value={form.klasifikasi_risiko}
                onChange={v => setForm({ ...form, klasifikasi_risiko: v })}
                options={[
                  { value: "terbuka", label: "Terbuka (Publik)" },
                  { value: "terbatas", label: "Terbatas (Internal)" },
                  { value: "tertutup", label: "Tertutup (Rahasia)" },
                ]}
              />
            </div>
          </div>

          {/* Klasifikasi Penyajian & Frekuensi Pemutakhiran */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Klasifikasi Penyajian</label>
              <input
                value={form.klasifikasi_penyajian}
                onChange={e => setForm({ ...form, klasifikasi_penyajian: e.target.value })}
                placeholder="Contoh: Angka Mutlak, Rasio, Indeks (opsional)"
                style={inputSt}
              />
            </div>
            <div>
              <label style={labelSt}>Frekuensi Pemutakhiran <span style={{ color: T.danger }}>*</span></label>
              <Select
                fullWidth
                value={form.frekuensi_pemutakhiran}
                onChange={v => setForm({ ...form, frekuensi_pemutakhiran: v })}
                options={[
                  { value: "Tahunan", label: "Tahunan" },
                  { value: "Semesteran", label: "Semesteran" },
                  { value: "Triwulan", label: "Triwulanan" },
                  { value: "Bulanan", label: "Bulanan" },
                ]}
              />
            </div>
          </div>

          {/* Jadwal Pemutakhiran (Single vs Range) */}
          <div style={{
            background: T.bg, borderRadius: 10, border: `1px solid ${T.border}`, padding: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ ...labelSt, marginBottom: 0 }}>
                Jadwal Pemutakhiran Data
              </label>
              <div style={{
                display: "inline-flex", background: T.surfaceHover,
                borderRadius: 8, padding: 3, border: `1px solid ${T.border}`,
              }}>
                <button
                  type="button"
                  onClick={() => setModeRange(false)}
                  style={{
                    padding: "4px 12px", border: "none", borderRadius: 6,
                    background: !modeRange ? T.primary : "transparent",
                    color: !modeRange ? "#fff" : T.textSecondary,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setModeRange(true)}
                  style={{
                    padding: "4px 12px", border: "none", borderRadius: 6,
                    background: modeRange ? T.primary : "transparent",
                    color: modeRange ? "#fff" : T.textSecondary,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Range
                </button>
              </div>
            </div>

            {!modeRange ? (
              <div>
                <input
                  type="date"
                  value={form.jadwal_pemutakhiran}
                  onChange={e => setForm({ ...form, jadwal_pemutakhiran: e.target.value })}
                  style={inputSt}
                />
                {form.jadwal_pemutakhiran && (
                  <div style={{ fontSize: 11.5, color: T.textSecondary, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="bell" size={13} style={{ color: T.primary }} />
                    <span>
                      Notifikasi pemutakhiran dikirim pada tanggal <b>{formatTanggalIndo(form.jadwal_pemutakhiran)}</b>, berulang <b>{form.frekuensi_pemutakhiran}</b>.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 3 }}>Tanggal Mulai</label>
                    <input
                      type="date"
                      value={form.jadwal_pemutakhiran}
                      onChange={e => setForm({ ...form, jadwal_pemutakhiran: e.target.value })}
                      style={inputSt}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, display: "block", marginBottom: 3 }}>Tanggal Akhir</label>
                    <input
                      type="date"
                      min={form.jadwal_pemutakhiran}
                      value={form.jadwal_pemutakhiran_akhir}
                      onChange={e => setForm({ ...form, jadwal_pemutakhiran_akhir: e.target.value })}
                      style={inputSt}
                    />
                  </div>
                </div>
                {form.jadwal_pemutakhiran && form.jadwal_pemutakhiran_akhir && (
                  <div style={{ fontSize: 11.5, color: T.textSecondary, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon name="bell" size={13} style={{ color: T.primary }} />
                    <span>
                      Notifikasi pemutakhiran dikirim pada <b>{formatTanggalIndo(form.jadwal_pemutakhiran)}</b> dan <b>{formatTanggalIndo(form.jadwal_pemutakhiran_akhir)}</b>, berulang <b>{form.frekuensi_pemutakhiran}</b>.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Kolom Dinamis */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Struktur Kolom Indikator</div>
                <div style={{ fontSize: 11.5, color: T.textMuted }}>Kolom Tahun, Periode, dan Wilayah sudah tersedia otomatis.</div>
              </div>
              <button
                type="button"
                onClick={addField}
                style={{
                  padding: "5px 12px", background: T.primaryLight, color: T.primary,
                  border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                + Tambah Kolom
              </button>
            </div>

            {templatePresets.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <Select
                  fullWidth
                  size="sm"
                  value=""
                  placeholder="⚡ Terapkan Template Field / Grup Kolom Siap Pakai..."
                  onChange={v => {
                    const tpl = templatePresets.find(t => String(t.id) === String(v));
                    if (tpl && Array.isArray(tpl.fields_json) && tpl.fields_json.length > 0) {
                      setFields(tpl.fields_json.map(f => ({
                        label: f.label || f.nama_field || "Nilai",
                        tipe_data: f.tipe_data || "desimal",
                        wajib: f.wajib !== false,
                        tampil_grafik: f.tampil_grafik !== false,
                        pilihan: "",
                      })));
                      showToast?.(`Template "${tpl.nama_template}" diterapkan`);
                    }
                  }}
                  options={[
                    { value: "", label: "⚡ Terapkan Template Field / Grup Kolom Siap Pakai..." },
                    ...templatePresets.map(t => ({ value: String(t.id), label: `${t.nama_template} (${(t.fields_json || []).length} kolom)` })),
                  ]}
                />
              </div>
            )}

            {fields.map((f, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1.1fr auto auto auto", gap: 8, alignItems: "center", marginBottom: 8, background: T.bg, padding: 8, borderRadius: 8 }}>
                <input
                  value={f.label}
                  onChange={e => updateField(idx, "label", e.target.value)}
                  placeholder="Label Kolom (mis: Produksi Padi)"
                  style={inputSt}
                />
                <Select
                  fullWidth
                  size="sm"
                  value={f.tipe_data}
                  onChange={v => updateField(idx, "tipe_data", v)}
                  options={[
                    { value: "desimal", label: "Angka Desimal" },
                    { value: "angka", label: "Bilangan Bulat" },
                    { value: "teks", label: "Teks" },
                    { value: "tanggal", label: "Tanggal" },
                    { value: "pilihan", label: "Pilihan" },
                  ]}
                />
                <label style={{ fontSize: 11.5, color: T.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={f.wajib} onChange={e => updateField(idx, "wajib", e.target.checked)} /> Wajib
                </label>
                <label style={{ fontSize: 11.5, color: T.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={f.tampil_grafik} disabled={f.tipe_data !== "angka" && f.tipe_data !== "desimal"} onChange={e => updateField(idx, "tampil_grafik", e.target.checked)} /> Grafik
                </label>
                {fields.length > 1 && (
                  <button type="button" onClick={() => removeField(idx)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer" }}>
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px", background: T.surfaceHover, color: T.textSecondary,
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: "9px 20px", background: T.primary, color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: "pointer", opacity: saving ? 0.7 : 1,
              display: "inline-flex", alignItems: "center", gap: 8,
            }}
          >
            {saving ? (
              <>
                <Icon name="loader" size={15} /> Menyimpan Indikator...
              </>
            ) : (
              "Simpan Indikator Data"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DatasetDetailView({ datasetId, user, canWrite, canVerify, onBack, onReloadList, showToast, T, isMobile }) {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState("data"); // 'data' | 'grafik' | 'kolom' | 'verifikasi'
  const [newRow, setNewRow] = useState({ tahun: new Date().getFullYear(), periode: "Tahunan", wilayah_kode: "Sumba Barat", data: {} });
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [verifCatatan, setVerifCatatan] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["bankdata-dataset-detail", datasetId],
    queryFn: () => fetch(`/api/bankdata/dataset/${datasetId}`).then(r => (r.ok ? r.json() : null)),
    refetchInterval: POLLING,
  });

  const reloadDetail = () => {
    queryClient.invalidateQueries({ queryKey: ["bankdata-dataset-detail", datasetId] });
    onReloadList();
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Memuat detail dataset...</div>;
  if (!detail) return <div style={{ padding: 24, color: T.danger }}>Dataset tidak ditemukan. <button onClick={onBack}>Kembali</button></div>;

  const fields = detail.fields || [];
  const rows = detail.rows || [];
  const logs = detail.logs || [];
  const editableStatus = detail.status === "draft" || detail.status === "perlu_perbaikan" || detail.status === "ditolak";
  const canEditData = canWrite && (editableStatus || user?.role === "Admin");
  const st = STATUS_DATASET_META[detail.status] || STATUS_DATASET_META.draft;
  const kl = KLASIFIKASI_META[detail.klasifikasi] || KLASIFIKASI_META.terbuka;

  const handleAddRow = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/bankdata/dataset/${datasetId}/rows/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: [newRow], replace: false }),
      });
      const d = await res.json();
      if (!res.ok) return showToast(d.error || "Gagal menyimpan baris");
      setNewRow(prev => ({ ...prev, data: {} }));
      reloadDetail();
      showToast("Baris data disimpan");
    } catch {
      showToast("Gagal menghubungi server");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRow = async rowId => {
    if (!window.confirm("Hapus baris data ini?")) return;
    const res = await fetch(`/api/bankdata/dataset/${datasetId}/rows/${rowId}`, { method: "DELETE" });
    if (!res.ok) return showToast((await res.json()).error || "Gagal menghapus baris");
    reloadDetail();
    showToast("Baris dihapus");
  };

  const handleImportExcel = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!json.length) return showToast("File Excel kosong");

      const mappedRows = json.map(item => {
        const tahun = item.tahun ?? item.Tahun ?? item.TAHUN;
        const periode = item.periode ?? item.Periode ?? item.PERIODE ?? detail.frekuensi ?? "Tahunan";
        const wilayah_kode = item.wilayah_kode ?? item.Wilayah ?? item.wilayah ?? "";
        const dataObj = {};
        for (const f of fields) {
          if (item[f.nama_field] !== undefined) dataObj[f.nama_field] = item[f.nama_field];
          else if (item[f.label] !== undefined) dataObj[f.nama_field] = item[f.label];
        }
        return { tahun, periode, wilayah_kode, data: dataObj };
      });

      setBusy(true);
      const res = await fetch(`/api/bankdata/dataset/${datasetId}/rows/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: mappedRows, replace: replaceOnImport }),
      });
      const out = await res.json();
      if (!res.ok) return showToast(out.error || "Gagal mengimpor Excel");
      reloadDetail();
      showToast(out.message || "Impor Excel berhasil");
    } catch {
      showToast("Gagal membaca file Excel");
    } finally {
      setBusy(false);
    }
  };

  const handleAjukan = async () => {
    if (!window.confirm("Ajukan dataset ini ke Reviewer/Walidata untuk diverifikasi?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bankdata/dataset/${datasetId}/ajukan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catatan: "Diajukan oleh Operator/Admin" }),
      });
      const out = await res.json();
      if (!res.ok) return showToast(out.error || "Gagal mengajukan dataset");
      reloadDetail();
      showToast("Dataset diajukan untuk verifikasi");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifikasi = async statusKeputusan => {
    if ((statusKeputusan === "perlu_perbaikan" || statusKeputusan === "ditolak") && !verifCatatan.trim()) {
      return showToast("Catatan wajib diisi saat meminta perbaikan atau menolak dataset");
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/bankdata/dataset/${datasetId}/verifikasi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusKeputusan, catatan: verifCatatan }),
      });
      const out = await res.json();
      if (!res.ok) return showToast(out.error || "Gagal menyimpan verifikasi");
      setVerifCatatan("");
      reloadDetail();
      showToast("Keputusan verifikasi disimpan");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDataset = async () => {
    if (!window.confirm(`Hapus dataset "${detail.nama}" beserta seluruh datanya?`)) return;
    const res = await fetch(`/api/bankdata/dataset/${datasetId}`, { method: "DELETE" });
    if (!res.ok) return showToast((await res.json()).error || "Gagal menghapus dataset");
    showToast("Dataset dihapus");
    onReloadList();
    onBack();
  };

  return (
    <div>
      {/* Bar Atas */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <button
          onClick={onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 13px", borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.card, color: T.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} /> Kembali ke Daftar Dataset
        </button>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => unduhDatasetExcel(detail, fields, rows)}
            style={{
              padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`,
              background: T.card, color: T.text, fontSize: 12, fontWeight: 700,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <Icon name="download" size={13} /> Unduh Excel (.xlsx)
          </button>
          {canWrite && editableStatus && (
            <button
              onClick={handleAjukan}
              disabled={busy}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#0D9488", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}
            >
              Ajukan Verifikasi ›
            </button>
          )}
          {canWrite && detail.status === "disetujui" && (
            <button
              onClick={async () => {
                const alasan = window.prompt("Masukkan alasan pengajuan buka kembali gerbang pemutakhiran (Reopen):");
                if (!alasan || !alasan.trim()) return;
                const res = await fetch("/api/satudata/reopen", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ dataset_id: datasetId, periode_tahun: new Date().getFullYear(), alasan }),
                });
                const out = await res.json().catch(() => ({}));
                if (!res.ok) return showToast(out.error || "Gagal mengajukan reopen");
                showToast(out.message || "Permintaan reopen diajukan");
              }}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "1px solid #F59E0B",
                background: "#FEF3C7", color: "#B45309", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Ajukan Buka Gerbang (Reopen)
            </button>
          )}
          {canEditData && (
            <button
              onClick={handleDeleteDataset}
              style={{
                padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.dangerBorder}`,
                background: T.dangerBg, color: T.danger, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Hapus Dataset
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Metadata */}
      <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: st.bg, color: st.text }}>
            {st.label}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: kl.bg, color: kl.text }}>
            {kl.label}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: T.surfaceHover, color: T.textSecondary }}>
            Frekuensi: {detail.frekuensi}
          </span>
          {detail.satuan && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: T.surfaceHover, color: T.textSecondary }}>
              Satuan: {detail.satuan}
            </span>
          )}
          {detail.kode_indikator && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "rgba(14, 165, 233, 0.12)", color: "#0284C7" }}>
              Kode: {detail.kode_indikator}
            </span>
          )}
          {detail.kode_sds && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: T.surfaceHover, color: T.textSecondary }}>
              SDS: {detail.kode_sds}
            </span>
          )}
          {detail.prioritas === "prioritas" && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "rgba(220, 38, 38, 0.12)", color: "#DC2626" }}>
              Prioritas
            </span>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>{detail.nama}</div>
        <div style={{ fontSize: 13, color: T.primary, fontWeight: 600, marginBottom: 6 }}>
          {detail.opd_nama} {detail.sumber_data ? `· Sumber: ${detail.sumber_data}` : ""}
        </div>
        {(detail.nama_urusan || detail.bidang_urusan_nama || detail.nama_topik) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11.5, color: T.textMuted, marginBottom: 8 }}>
            {detail.nama_urusan && <span>Urusan: <b>{detail.kode_urusan ? `${detail.kode_urusan} - ` : ""}{detail.nama_urusan}</b></span>}
            {detail.bidang_urusan_nama && <span>· Bidang: <b>{detail.bidang_urusan_nama}</b></span>}
            {detail.nama_topik && <span>· Topik: <b>{detail.nama_topik}</b></span>}
          </div>
        )}
        {detail.deskripsi && <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>{detail.deskripsi}</div>}
        {Array.isArray(detail.keywords) && detail.keywords.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: T.textMuted }}>Keywords:</span>
            {detail.keywords.map((kw, i) => (
              <span key={i} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: T.surfaceHover, color: T.textSecondary }}>
                #{kw}
              </span>
            ))}
          </div>
        )}

        {detail.catatan_verifikasi && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 8,
            background: detail.status === "disetujui" ? T.successBg : T.dangerBg,
            border: `1px solid ${detail.status === "disetujui" ? T.successBorder : T.dangerBorder}`,
            color: detail.status === "disetujui" ? T.success : T.danger, fontSize: 12.5,
          }}>
            <b>Catatan Verifikasi Walidata/Reviewer:</b> {detail.catatan_verifikasi}
          </div>
        )}
      </div>

      {/* Sub-tab Detail */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "data", label: `Tabel & Impor Data (${rows.length} baris)` },
          { id: "grafik", label: "Visualisasi Grafik" },
          { id: "kolom", label: `Struktur Kolom (${fields.length})` },
          { id: "verifikasi", label: `Verifikasi & Riwayat (${logs.length})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              border: subTab === t.id ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
              background: subTab === t.id ? T.primary : T.card,
              color: subTab === t.id ? "#fff" : T.textSecondary,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "grafik" && (
        <GrafikDataset fields={fields} rows={rows} satuanDefault={detail.satuan || ""} />
      )}

      {subTab === "data" && (
        <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 16 }}>
          {/* Toolbar Excel */}
          {canEditData && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              flexWrap: "wrap", gap: 10, paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${T.border}`,
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => unduhTemplateDatasetExcel(detail, fields)}
                  style={{
                    padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.primary}`,
                    background: T.primaryLight, color: T.primary, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Unduh Template Excel
                </button>
                <label style={{
                  padding: "7px 14px", borderRadius: 8, background: T.primary, color: "#fff",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  <Icon name="upload" size={13} /> Impor File Excel (.xlsx)
                  <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} style={{ display: "none" }} />
                </label>
                <label style={{ fontSize: 12, color: T.textSecondary, display: "flex", alignItems: "center", gap: 5 }}>
                  <input type="checkbox" checked={replaceOnImport} onChange={e => setReplaceOnImport(e.target.checked)} />
                  Ganti seluruh baris lama saat impor
                </label>
              </div>
            </div>
          )}

          {/* Tabel Data */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: T.surfaceHover, textAlign: "left" }}>
                  <th style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>Tahun</th>
                  <th style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>Periode</th>
                  <th style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>Wilayah</th>
                  {fields.map(f => (
                    <th key={f.id} style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, color: T.text }}>
                      {f.label}
                    </th>
                  ))}
                  {canEditData && <th style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, width: 80 }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {canEditData && (
                  <tr style={{ background: T.primaryLight }}>
                    <td style={{ padding: 6 }}>
                      <input
                        type="number"
                        value={newRow.tahun}
                        onChange={e => setNewRow({ ...newRow, tahun: e.target.value })}
                        style={{ width: 78, padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 12 }}
                      />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        value={newRow.periode}
                        onChange={e => setNewRow({ ...newRow, periode: e.target.value })}
                        placeholder="Tahunan/TW1"
                        style={{ width: 95, padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 12 }}
                      />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input
                        value={newRow.wilayah_kode}
                        onChange={e => setNewRow({ ...newRow, wilayah_kode: e.target.value })}
                        placeholder="Wilayah"
                        style={{ width: 110, padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 12 }}
                      />
                    </td>
                    {fields.map(f => (
                      <td key={f.id} style={{ padding: 6 }}>
                        {f.tipe_data === "tanggal" ? (
                          <DatePicker
                            size="sm"
                            value={newRow.data[f.nama_field] ?? ""}
                            onChange={v => setNewRow({ ...newRow, data: { ...newRow.data, [f.nama_field]: v } })}
                            placeholder={f.label}
                          />
                        ) : f.tipe_data === "pilihan" && Array.isArray(f.pilihan) && f.pilihan.length > 0 ? (
                          <Select
                            fullWidth
                            size="sm"
                            value={newRow.data[f.nama_field] ?? ""}
                            placeholder={f.label}
                            onChange={v => setNewRow({ ...newRow, data: { ...newRow.data, [f.nama_field]: v } })}
                            options={[{ value: "", label: `— ${f.label} —` }, ...f.pilihan.map(p => ({ value: p, label: p }))]}
                          />
                        ) : (
                          <input
                            value={newRow.data[f.nama_field] ?? ""}
                            onChange={e => setNewRow({ ...newRow, data: { ...newRow.data, [f.nama_field]: e.target.value } })}
                            placeholder={f.label}
                            style={{ width: "100%", minWidth: 90, padding: "6px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 12, boxSizing: "border-box" }}
                          />
                        )}
                      </td>
                    ))}
                    <td style={{ padding: 6 }}>
                      <button
                        onClick={handleAddRow}
                        disabled={busy}
                        style={{ padding: "6px 12px", background: T.primary, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        + Simpan
                      </button>
                    </td>
                  </tr>
                )}
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "9px 10px", fontWeight: 700, color: T.text }}>{r.tahun}</td>
                    <td style={{ padding: "9px 10px", color: T.textSecondary }}>{r.periode || "Tahunan"}</td>
                    <td style={{ padding: "9px 10px", color: T.textSecondary }}>{r.wilayah_kode || "—"}</td>
                    {fields.map(f => (
                      <td key={f.id} style={{ padding: "9px 10px", color: T.text, fontVariantNumeric: "tabular-nums" }}>
                        {r.data?.[f.nama_field] !== undefined && r.data?.[f.nama_field] !== null
                          ? (typeof r.data[f.nama_field] === "number" ? r.data[f.nama_field].toLocaleString("id-ID") : String(r.data[f.nama_field]))
                          : "—"}
                      </td>
                    ))}
                    {canEditData && (
                      <td style={{ padding: "9px 10px" }}>
                        <button
                          onClick={() => handleDeleteRow(r.id)}
                          style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 12 }}
                        >
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={fields.length + (canEditData ? 4 : 3)} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                      Belum ada baris data pada dataset ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "kolom" && (
        <PanelEditKolom
          datasetId={datasetId}
          initialFields={fields}
          canEditData={canEditData}
          onSaved={reloadDetail}
          showToast={showToast}
          T={T}
          isMobile={isMobile}
        />
      )}

      {subTab === "verifikasi" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {canVerify && (
            <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                Panel Keputusan Walidata / Reviewer
              </div>
              <div style={{ fontSize: 12.5, color: T.textSecondary, marginBottom: 12 }}>
                Dataset yang disetujui dan berklasifikasi <b>Terbuka</b> akan otomatis tampil beserta tabel dan grafik interaktif di Portal Publik.
              </div>
              <textarea
                rows={3}
                value={verifCatatan}
                onChange={e => setVerifCatatan(e.target.value)}
                placeholder="Catatan verifikasi (wajib diisi apabila meminta perbaikan atau menolak)..."
                style={{
                  width: "100%", padding: 10, borderRadius: 8, border: `1px solid ${T.border}`,
                  background: T.inputBg, color: T.text, fontSize: 13, boxSizing: "border-box", marginBottom: 10,
                }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  disabled={busy}
                  onClick={() => handleVerifikasi("disetujui")}
                  style={{ padding: "9px 16px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  ✓ Setujui & Publikasikan
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleVerifikasi("perlu_perbaikan")}
                  style={{ padding: "9px 16px", background: "#D97706", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  ↺ Minta Perbaikan
                </button>
                <button
                  disabled={busy}
                  onClick={() => handleVerifikasi("ditolak")}
                  style={{ padding: "9px 16px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                >
                  ✕ Tolak Dataset
                </button>
              </div>
            </div>
          )}

          <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10 }}>Riwayat Aktivitas Dataset</div>
            {logs.length === 0 ? (
              <div style={{ fontSize: 12.5, color: T.textMuted }}>Belum ada riwayat aktivitas.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {logs.map(l => (
                  <div key={l.id} style={{ padding: "10px 12px", borderRadius: 8, background: T.bg, border: `1px solid ${T.border}`, fontSize: 12.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: T.textSecondary, marginBottom: 3 }}>
                      <span><b style={{ color: T.text }}>{l.aktor || "Sistem"}</b> · {l.aksi.toUpperCase()}</span>
                      <span>{new Date(l.created_at).toLocaleString("id-ID")}</span>
                    </div>
                    {l.catatan && <div style={{ color: T.text }}>{l.catatan}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PanelEditKolom({ datasetId, initialFields, canEditData, onSaved, showToast, T, isMobile }) {
  const [list, setList] = useState(() =>
    initialFields.map(f => ({
      label: f.label,
      nama_field: f.nama_field,
      tipe_data: f.tipe_data,
      wajib: f.wajib,
      tampil_grafik: f.tampil_grafik,
      pilihan: Array.isArray(f.pilihan) ? f.pilihan.join(", ") : "",
    }))
  );
  const [saving, setSaving] = useState(false);

  const saveFields = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/bankdata/dataset/${datasetId}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: list.map((f, i) => ({
            ...f,
            urutan: i + 1,
          })),
        }),
      });
      const out = await res.json();
      if (!res.ok) return showToast(out.error || "Gagal menyimpan kolom");
      onSaved();
      showToast("Struktur kolom diperbarui");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Daftar Kolom Indikator Dataset</div>
        {canEditData && (
          <button
            onClick={() => setList(p => [...p, { label: "", tipe_data: "desimal", wajib: false, tampil_grafik: true, pilihan: "" }])}
            style={{ padding: "6px 12px", background: T.primaryLight, color: T.primary, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            + Tambah Kolom
          </button>
        )}
      </div>

      {list.map((f, idx) => (
        <div key={idx} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1.2fr auto auto auto", gap: 8, alignItems: "center", marginBottom: 8, padding: 8, background: T.bg, borderRadius: 8 }}>
          <input
            disabled={!canEditData}
            value={f.label}
            onChange={e => setList(p => p.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
            placeholder="Label Kolom"
            style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 12.5 }}
          />
          <Select
            fullWidth
            size="sm"
            disabled={!canEditData}
            value={f.tipe_data}
            onChange={v => setList(p => p.map((x, i) => (i === idx ? { ...x, tipe_data: v } : x)))}
            options={[
              { value: "desimal", label: "Angka Desimal" },
              { value: "angka", label: "Bilangan Bulat" },
              { value: "teks", label: "Teks" },
              { value: "tanggal", label: "Tanggal" },
              { value: "pilihan", label: "Pilihan" },
            ]}
          />
          <label style={{ fontSize: 12, color: T.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
            <input disabled={!canEditData} type="checkbox" checked={f.wajib} onChange={e => setList(p => p.map((x, i) => (i === idx ? { ...x, wajib: e.target.checked } : x)))} /> Wajib
          </label>
          <label style={{ fontSize: 12, color: T.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
            <input disabled={!canEditData || (f.tipe_data !== "angka" && f.tipe_data !== "desimal")} type="checkbox" checked={f.tampil_grafik} onChange={e => setList(p => p.map((x, i) => (i === idx ? { ...x, tampil_grafik: e.target.checked } : x)))} /> Tampil Grafik
          </label>
          {canEditData && list.length > 1 && (
            <button onClick={() => setList(p => p.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer" }}>
              <Icon name="trash" size={14} />
            </button>
          )}
        </div>
      ))}

      {canEditData && (
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={saveFields} disabled={saving} style={{ padding: "8px 16px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Menyimpan..." : "Simpan Struktur Kolom"}
          </button>
        </div>
      )}
    </div>
  );
}
