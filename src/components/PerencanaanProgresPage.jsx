import React, { useContext, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon, Select, MultiSelect, parseMultiValue, DateRangePicker } from "./ui.jsx";
import UploadForm from "./UploadForm.jsx";

const DOKUMEN_OPTIONS = [
  { value: "RKPD", label: "RKPD (Tahunan)" },
  { value: "RPJMD", label: "RPJMD (5 Tahunan)" },
  { value: "RPJPD", label: "RPJPD (20 Tahunan)" },
  { value: "RENJA", label: "Renja PD (Tahunan)" },
  { value: "RENSTRA", label: "Renstra PD (5 Tahunan)" },
];

const KANBAN_COLS = [
  { key: "todo", label: "Belum Mulai", color: "#64748B", bg: "rgba(100,116,139,0.10)" },
  { key: "in_progress", label: "Sedang Berjalan", color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  { key: "review", label: "Review / Konsultasi", color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  { key: "done", label: "Selesai", color: "#059669", bg: "rgba(5,150,105,0.10)" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ZOOM_LEVELS = [
  { id: "fit", label: "Ringkas", dayW: 6 },
  { id: "week", label: "Sedang", dayW: 12 },
  { id: "day", label: "Harian", dayW: 22 },
  { id: "detail", label: "Detail", dayW: 32 },
];

const toYMD = (d) => (d ? String(d).slice(0, 10) : "");

function buildDayTimeline(startStr, endStr) {
  const sDate = new Date(`${startStr}T00:00:00`);
  const eDate = new Date(`${endStr}T00:00:00`);
  if (Number.isNaN(sDate.getTime()) || Number.isNaN(eDate.getTime()) || eDate < sDate) {
    return { months: [], days: [], startStr, endStr };
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthsMap = new Map();
  const days = [];
  const cur = new Date(sDate);
  let guard = 0;
  while (cur <= eDate && guard < 1100) {
    guard++;
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const d = cur.getDate();
    const dow = cur.getDay();
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const obj = { dateStr, day: d, isWeekend: dow === 0 || dow === 6, isToday: dateStr === todayStr };
    days.push(obj);
    const mKey = `${y}-${m}`;
    if (!monthsMap.has(mKey)) {
      monthsMap.set(mKey, { key: mKey, label: `${MONTHS[m]} ${y}`, days: [] });
    }
    monthsMap.get(mKey).days.push(obj);
    cur.setDate(cur.getDate() + 1);
  }
  return { months: [...monthsMap.values()], days, startStr, endStr };
}

function ganttDayRect(tglMulai, tglSelesai, startStr, totalDays, dayW) {
  const s0 = new Date(`${startStr}T00:00:00`).getTime();
  const s = new Date(`${toYMD(tglMulai)}T00:00:00`).getTime();
  const e = new Date(`${toYMD(tglSelesai)}T00:00:00`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || Number.isNaN(s0) || totalDays === 0) return { leftPx: 0, widthPx: dayW * 5 };
  const startIdx = Math.max(0, Math.min(totalDays - 1, Math.round((s - s0) / 86400000)));
  const endIdx = Math.max(startIdx, Math.min(totalDays - 1, Math.round((e - s0) / 86400000)));
  return {
    leftPx: startIdx * dayW,
    widthPx: Math.max(dayW, (endIdx - startIdx + 1) * dayW),
  };
}

export default function PerencanaanProgresPage({
  user,
  users = [],
  bidangs = [],
  categories = [],
  sectors = [],
  showToast,
  onUnggahDokumen,
}) {
  const { T, isDark } = useContext(ThemeContext);
  const curYear = new Date().getFullYear();
  const [tahun, setTahun] = useState(curYear);
  const [dokumenJenis, setDokumenJenis] = useState("RKPD");
  const [viewMode, setViewMode] = useState("gantt"); // "gantt" | "kanban"
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // { mode: "add" | "edit", data: {...} }
  const [showUpload, setShowUpload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [zoomIdx, setZoomIdx] = useState(2); // default "Harian" (22px)
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dayW = ZOOM_LEVELS[zoomIdx]?.dayW || 22;

  const userOptions = useMemo(() => {
    const list = (Array.isArray(users) ? users : [])
      .map((u) => ({
        value: u.nama || u.name || u.username || "",
        label: `${u.nama || u.name || u.username || ""}${u.bidang ? ` · ${u.bidang}` : ""}`,
        bidang: u.bidang || "",
      }))
      .filter((o) => o.value);
    const curPICS = parseMultiValue(modal?.data?.pic_nama, list);
    for (const cur of curPICS) {
      if (cur && !list.some((o) => o.value.toLowerCase() === cur.toLowerCase())) {
        list.unshift({ value: cur, label: cur, bidang: "" });
      }
    }
    return list;
  }, [users, modal?.data?.pic_nama]);

  const bidangOptions = useMemo(() => {
    const defaultBidang = [
      "Bidang Perencanaan, Pengendalian dan Evaluasi Pembangunan Daerah",
      "Bidang Perekonomian, Sumber Daya Alam, Infrastruktur dan Kewilayahan",
      "Bidang Pemerintahan dan Pembangunan Manusia",
      "Bidang Riset dan Inovasi Daerah",
      "Sekretariat",
    ];
    const seen = new Set(["semua bidang"]);
    const list = [];
    const sourceList = Array.isArray(bidangs) && bidangs.length > 0 ? bidangs : defaultBidang;
    for (const b of sourceList) {
      const val = typeof b === "string" ? b : (b?.nama || b?.name || b?.label || "");
      if (val && !seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        list.push({ value: val, label: val });
      }
    }
    const curBidangs = parseMultiValue(modal?.data?.pic_bidang, list);
    for (const cur of curBidangs) {
      if (cur && !seen.has(cur.toLowerCase())) {
        seen.add(cur.toLowerCase());
        list.push({ value: cur, label: cur });
      }
    }
    return list;
  }, [bidangs, modal?.data?.pic_bidang]);

  const loadData = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/perencanaan/progres?tahun=${tahun}&dokumen_jenis=${dokumenJenis}`);
      const d = await r.json();
      if (d?.ok) setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      console.error("[Perencanaan] load:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tahun, dokumenJenis]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.tahap_kode, it.nama_tahapan, it.dasar_pasal, it.pic_nama, it.pic_bidang, it.target_keluaran]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === "done").length;
    const active = items.filter((i) => i.status === "in_progress" || i.status === "review").length;
    const avg = total ? Math.round(items.reduce((a, b) => a + (Number(b.progres_persen) || 0), 0) / total) : 0;
    return { total, done, active, avg };
  }, [items]);

  const defaultRange = useMemo(() => {
    const valid = filtered.filter((i) => toYMD(i.tgl_mulai) && toYMD(i.tgl_selesai));
    if (!valid.length) return { start: `${tahun}-01-01`, end: `${tahun}-12-31` };
    let minS = toYMD(valid[0].tgl_mulai);
    let maxE = toYMD(valid[0].tgl_selesai);
    for (const it of valid) {
      const s = toYMD(it.tgl_mulai);
      const e = toYMD(it.tgl_selesai);
      if (s < minS) minS = s;
      if (e > maxE) maxE = e;
    }
    return { start: minS, end: maxE };
  }, [filtered, tahun]);

  const activeStart = customStart || defaultRange.start;
  const activeEnd = customEnd || defaultRange.end;

  const timeline = useMemo(() => {
    return buildDayTimeline(activeStart, activeEnd);
  }, [activeStart, activeEnd]);

  const openAdd = () => {
    setModal({
      mode: "add",
      data: {
        tahun,
        dokumen_jenis: dokumenJenis,
        tahap_kode: `${dokumenJenis}-${String(items.length + 1).padStart(2, "0")}`,
        urutan: items.length + 1,
        nama_tahapan: "",
        dasar_pasal: "Permendagri 86/2017",
        pic_nama: user?.nama || user?.name || "",
        pic_bidang: "Bidang PPEP",
        tgl_mulai: `${tahun}-01-02`,
        tgl_selesai: `${tahun}-01-31`,
        status: "todo",
        progres_persen: 0,
        target_keluaran: "",
        dokumen_url: "",
        catatan: "",
      },
    });
  };

  const openEdit = (it) => {
    setModal({
      mode: "edit",
      data: {
        ...it,
        tgl_mulai: toYMD(it.tgl_mulai),
        tgl_selesai: toYMD(it.tgl_selesai),
      },
    });
  };

  const saveModal = async (e) => {
    e.preventDefault();
    if (!modal?.data) return;
    setSaving(true);
    try {
      const isEdit = modal.mode === "edit";
      const url = isEdit ? `/api/perencanaan/progres/${modal.data.id}` : "/api/perencanaan/progres";
      const r = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modal.data),
      });
      const d = await r.json();
      if (d?.ok) {
        setModal(null);
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Hapus tahapan ini?")) return;
    const r = await fetch(`/api/perencanaan/progres/${id}`, { method: "DELETE" });
    const d = await r.json();
    if (d?.ok) {
      setModal(null);
      await loadData();
    }
  };

  const moveKanban = async (item, targetStatus) => {
    if (item.status === targetStatus) return;
    let nextPct = Number(item.progres_persen) || 0;
    if (targetStatus === "done") nextPct = 100;
    else if (targetStatus === "todo") nextPct = 0;
    else if (targetStatus === "in_progress" && (nextPct === 0 || nextPct === 100)) nextPct = 25;
    else if (targetStatus === "review" && nextPct < 75) nextPct = 80;

    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: targetStatus, progres_persen: nextPct } : x)));
    await fetch(`/api/perencanaan/progres/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetStatus, progres_persen: nextPct }),
    });
  };

  const colMeta = (k) => KANBAN_COLS.find((c) => c.key === k) || KANBAN_COLS[0];
  const cardBg = T.card;
  const inputStyle = {
    width: "100%",
    height: 36,
    padding: "0 10px",
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    background: T.inputBg || cardBg,
    color: T.text,
    fontSize: 13,
    outline: "none",
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header & Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.text, letterSpacing: "-0.015em" }}>
            Progres Pekerjaan Perencanaan
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textSecondary }}>
            Pelacakan tahapan penyusunan dokumen perencanaan daerah berdasarkan Permendagri No. 86 Tahun 2017
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Select
            value={dokumenJenis}
            onChange={(v) => setDokumenJenis(v)}
            options={DOKUMEN_OPTIONS}
            searchable={false}
            minWidth={190}
            size="md"
          />

          <Select
            value={String(tahun)}
            onChange={(v) => setTahun(Number(v))}
            options={[curYear - 1, curYear, curYear + 1, curYear + 2].map((y) => ({ value: String(y), label: String(y) }))}
            searchable={false}
            minWidth={96}
            size="md"
          />

          <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", background: cardBg }}>
            {[
              { id: "gantt", label: "Tabel Gantt" },
              { id: "kanban", label: "Kanban Board" },
            ].map((v) => {
              const active = viewMode === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewMode(v.id)}
                  style={{
                    height: 34,
                    padding: "0 12px",
                    border: "none",
                    background: active ? T.primary : "transparent",
                    color: active ? "#fff" : T.textSecondary,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={openAdd}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: "none",
              background: T.primary,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="plus" size={14} /> Tambah Tahapan
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Tahapan", value: stats.total, color: T.text },
          { label: "Selesai", value: stats.done, color: "#059669" },
          { label: "Aktif / Review", value: stats.active, color: "#2563EB" },
          { label: "Rata-rata Progres", value: `${stats.avg}%`, color: T.primary },
        ].map((k) => (
          <div key={k.label} style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search & Gantt Controls Bar */}
      {items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Cari tahapan, pasal Permendagri, PIC, atau bidang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, maxWidth: 320 }}
          />
          {viewMode === "gantt" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <DateRangePicker
                size="sm"
                start={activeStart}
                end={activeEnd}
                isCustom={Boolean(customStart || customEnd)}
                onChange={({ start, end }) => {
                  setCustomStart(start);
                  setCustomEnd(end);
                }}
                onReset={() => {
                  setCustomStart("");
                  setCustomEnd("");
                }}
              />

              <div style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${T.border}`, borderRadius: 8, background: cardBg, overflow: "hidden" }}>
                <button
                  type="button"
                  title="Perkecil timeline (Zoom Out)"
                  disabled={zoomIdx <= 0}
                  onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
                  style={{ height: 32, width: 30, border: "none", background: "transparent", color: zoomIdx <= 0 ? T.textMuted : T.text, fontWeight: 700, fontSize: 14, cursor: zoomIdx <= 0 ? "default" : "pointer" }}
                >
                  −
                </button>
                <span style={{ padding: "0 8px", fontSize: 11.5, fontWeight: 600, color: T.textSecondary, borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>
                  {ZOOM_LEVELS[zoomIdx]?.label}
                </span>
                <button
                  type="button"
                  title="Perbesar timeline (Zoom In)"
                  disabled={zoomIdx >= ZOOM_LEVELS.length - 1}
                  onClick={() => setZoomIdx((z) => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
                  style={{ height: 32, width: 30, border: "none", background: "transparent", color: zoomIdx >= ZOOM_LEVELS.length - 1 ? T.textMuted : T.text, fontWeight: 700, fontSize: 14, cursor: zoomIdx >= ZOOM_LEVELS.length - 1 ? "default" : "pointer" }}
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: T.textMuted }}>
              Menampilkan {filtered.length} dari {items.length} tahapan • Klik item untuk memperbarui progres
            </div>
          )}
        </div>
      )}

      {/* Loading / Content */}
      {loading ? (
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 32, textAlign: "center", color: T.textSecondary, fontSize: 13 }}>
          Memuat tahapan perencanaan {dokumenJenis} {tahun}...
        </div>
      ) : viewMode === "gantt" ? (
        /* ── TABEL GANTT (Detail Per Tanggal & Bulan, Horizontal Scroll + Sticky Kolom Kiri) ── */
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 10, overflowX: "auto", boxShadow: T.shadowSm }}>
          <table style={{ width: 606 + timeline.days.length * dayW, borderCollapse: "collapse", fontSize: 12.5, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: isDark ? "#1E293B" : "#F8FAFC", borderBottom: `1px solid ${T.border}` }}>
                <th rowSpan={2} style={{ position: "sticky", left: 0, zIndex: 3, background: isDark ? "#1E293B" : "#F8FAFC", textAlign: "left", padding: "10px 12px", width: 290, fontWeight: 700, color: T.textSecondary, borderRight: `1px solid ${T.border}` }}>
                  Tahapan &amp; Dasar Pasal
                </th>
                <th rowSpan={2} style={{ position: "sticky", left: 290, zIndex: 3, background: isDark ? "#1E293B" : "#F8FAFC", textAlign: "left", padding: "10px 8px", width: 130, fontWeight: 700, color: T.textSecondary, borderRight: `1px solid ${T.border}` }}>
                  PIC / Bidang
                </th>
                <th rowSpan={2} style={{ position: "sticky", left: 420, zIndex: 3, background: isDark ? "#1E293B" : "#F8FAFC", textAlign: "left", padding: "10px 8px", width: 110, fontWeight: 700, color: T.textSecondary, borderRight: `1px solid ${T.border}` }}>
                  Status
                </th>
                <th rowSpan={2} style={{ position: "sticky", left: 530, zIndex: 3, background: isDark ? "#1E293B" : "#F8FAFC", textAlign: "right", padding: "10px 10px", width: 76, whiteSpace: "nowrap", fontWeight: 700, color: T.textSecondary, borderRight: `2px solid ${T.border}` }}>
                  Progres
                </th>
                {timeline.months.map((m) => (
                  <th
                    key={m.key}
                    colSpan={m.days.length}
                    style={{
                      textAlign: "center",
                      padding: "6px 4px",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: T.text,
                      borderRight: `1px solid ${T.border}`,
                      borderBottom: `1px solid ${T.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
              <tr style={{ background: isDark ? "#1E293B" : "#F8FAFC", borderBottom: `1px solid ${T.border}` }}>
                {timeline.days.map((d) => {
                  const showNum = dayW >= 16 || d.day === 1 || d.day % 5 === 0;
                  return (
                    <th
                      key={d.dateStr}
                      style={{
                        width: dayW,
                        padding: "4px 0",
                        textAlign: "center",
                        fontSize: 10,
                        fontWeight: d.isToday ? 800 : 600,
                        fontVariantNumeric: "tabular-nums",
                        color: d.isToday ? "#fff" : (d.isWeekend ? T.textMuted : T.textSecondary),
                        background: d.isToday ? T.primary : (d.isWeekend ? (isDark ? "rgba(255,255,255,0.03)" : "#F1F5F9") : "transparent"),
                        borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "#E2E8F0"}`,
                      }}
                    >
                      {showNum ? d.day : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const meta = colMeta(it.status);
                const rect = ganttDayRect(it.tgl_mulai, it.tgl_selesai, timeline.startStr, timeline.days.length, dayW);
                const pct = Number(it.progres_persen) || 0;
                const stickyBg = cardBg;
                return (
                  <tr
                    key={it.id}
                    onClick={() => openEdit(it)}
                    style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
                  >
                    <td style={{ position: "sticky", left: 0, zIndex: 2, background: stickyBg, padding: "10px 12px", verticalAlign: "top", borderRight: `1px solid ${T.border}` }}>
                      <div style={{ fontWeight: 600, color: T.text, lineHeight: 1.35 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: T.textMuted, marginRight: 6 }}>{it.tahap_kode}</span>
                        {it.nama_tahapan}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        {it.dasar_pasal} • <span style={{ fontVariantNumeric: "tabular-nums" }}>{toYMD(it.tgl_mulai)} s.d. {toYMD(it.tgl_selesai)}</span>
                      </div>
                    </td>
                    <td style={{ position: "sticky", left: 290, zIndex: 2, background: stickyBg, padding: "8px", verticalAlign: "middle", borderRight: `1px solid ${T.border}`, width: 130 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {it.pic_nama ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                            {parseMultiValue(it.pic_nama, userOptions).map((p, idx) => (
                              <span key={idx} style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: isDark ? "#93C5FD" : "#1D4ED8",
                                background: isDark ? "rgba(37,99,235,0.18)" : "#EFF6FF",
                                border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "#BFDBFE"}`,
                                padding: "1px 5px",
                                borderRadius: 4,
                                lineHeight: 1.25,
                                maxWidth: "100%",
                                wordBreak: "break-word",
                              }}>
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {it.pic_bidang ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                            {parseMultiValue(it.pic_bidang, bidangOptions).map((b, idx) => (
                              <span key={idx} style={{
                                fontSize: 10,
                                color: isDark ? "#CBD5E1" : "#475569",
                                background: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9",
                                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#E2E8F0"}`,
                                padding: "1px 4px",
                                borderRadius: 3,
                                lineHeight: 1.2,
                                maxWidth: "100%",
                                wordBreak: "break-word",
                              }}>
                                {b}
                              </span>
                            ))}
                          </div>
                        ) : (!it.pic_nama ? <span style={{ color: T.textMuted, fontSize: 11 }}>—</span> : null)}
                      </div>
                    </td>
                    <td style={{ position: "sticky", left: 420, zIndex: 2, background: stickyBg, padding: "10px 8px", verticalAlign: "middle", borderRight: `1px solid ${T.border}` }}>
                      <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, whiteSpace: "nowrap" }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ position: "sticky", left: 530, zIndex: 2, background: stickyBg, padding: "10px 10px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: meta.color, verticalAlign: "middle", borderRight: `2px solid ${T.border}` }}>
                      {pct}%
                    </td>
                    <td
                      colSpan={timeline.days.length}
                      style={{ padding: 0, position: "relative", verticalAlign: "middle", height: 52 }}
                    >
                      {/* Daily grid background */}
                      <div style={{ position: "absolute", inset: 0, display: "flex", pointerEvents: "none" }}>
                        {timeline.days.map((d) => (
                          <div
                            key={d.dateStr}
                            style={{
                              width: dayW,
                              flexShrink: 0,
                              background: d.isToday ? "rgba(37,99,235,0.08)" : (d.isWeekend ? (isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC") : "transparent"),
                              borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.03)" : "#F1F5F9"}`,
                            }}
                          />
                        ))}
                      </div>
                      {/* Gantt bar */}
                      <div
                        title={`${it.nama_tahapan}: ${toYMD(it.tgl_mulai)} s.d. ${toYMD(it.tgl_selesai)} (${pct}%)`}
                        style={{
                          position: "absolute",
                          left: rect.leftPx,
                          width: rect.widthPx,
                          top: "50%",
                          transform: "translateY(-50%)",
                          height: 20,
                          borderRadius: 5,
                          background: isDark ? "rgba(255,255,255,0.12)" : "#E2E8F0",
                          border: `1px solid ${meta.color}`,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ width: `${pct}%`, height: "100%", background: meta.color, opacity: 0.85 }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── KANBAN BOARD ── */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, alignItems: "start" }}>
          {KANBAN_COLS.map((col, colIdx) => {
            const colItems = filtered.filter((i) => i.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const found = items.find((x) => x.id === dragId);
                  if (found) moveKanban(found, col.key);
                  setDragId(null);
                }}
                style={{
                  background: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC",
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  padding: 10,
                  minHeight: 280,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${col.color}` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{col.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.color, fontVariantNumeric: "tabular-nums" }}>{colItems.length}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {colItems.map((it) => {
                    const pct = Number(it.progres_persen) || 0;
                    return (
                      <div
                        key={it.id}
                        draggable
                        onDragStart={() => setDragId(it.id)}
                        onClick={() => openEdit(it)}
                        style={{
                          background: cardBg,
                          border: `1px solid ${T.border}`,
                          borderRadius: 8,
                          padding: 10,
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: col.color }}>{it.tahap_kode}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: T.textSecondary }}>{pct}%</span>
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>{it.nama_tahapan}</div>

                        {it.dasar_pasal && (
                          <div style={{ fontSize: 11, color: T.textMuted }}>{it.dasar_pasal}</div>
                        )}

                        <div style={{ height: 5, borderRadius: 4, background: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: col.color }} />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                          {it.pic_nama && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {parseMultiValue(it.pic_nama, userOptions).map((p, idx) => (
                                <span key={idx} style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  color: isDark ? "#93C5FD" : "#1D4ED8",
                                  background: isDark ? "rgba(37,99,235,0.16)" : "#EFF6FF",
                                  border: `1px solid ${isDark ? "rgba(59,130,246,0.3)" : "#BFDBFE"}`,
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                }}>
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: T.textSecondary }}>
                            <span style={{ fontSize: 10.5, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }} title={it.pic_bidang}>
                              {it.pic_bidang || "—"}
                            </span>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>{toYMD(it.tgl_selesai)}</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 2 }} onClick={(e) => e.stopPropagation()}>
                          {colIdx > 0 && (
                            <button
                              type="button"
                              title={`Pindah ke ${KANBAN_COLS[colIdx - 1].label}`}
                              onClick={() => moveKanban(it, KANBAN_COLS[colIdx - 1].key)}
                              style={{ padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: cardBg, color: T.textSecondary, fontSize: 11, cursor: "pointer" }}
                            >
                              ←
                            </button>
                          )}
                          {colIdx < KANBAN_COLS.length - 1 && (
                            <button
                              type="button"
                              title={`Pindah ke ${KANBAN_COLS[colIdx + 1].label}`}
                              onClick={() => moveKanban(it, KANBAN_COLS[colIdx + 1].key)}
                              style={{ padding: "2px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: cardBg, color: T.textSecondary, fontSize: 11, cursor: "pointer" }}
                            >
                              →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tambah / Edit Tahapan (UI/UX Pro Max Anti-Slop) */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveModal}
            style={{
              background: cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              width: "100%",
              maxWidth: 640,
              maxHeight: "92vh",
              overflowY: "auto",
              padding: 22,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>
                  {modal.mode === "edit" ? "Perbarui Progres Tahapan" : "Tambah Tahapan Perencanaan"}
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: T.textSecondary }}>
                  {modal.data.dokumen_jenis} Tahun {modal.data.tahun}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                style={{
                  background: "transparent",
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.textSecondary,
                  cursor: "pointer",
                }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Kode Tahap</label>
                <input
                  type="text"
                  value={modal.data.tahap_kode || ""}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, tahap_kode: e.target.value } })}
                  style={{ ...inputStyle, fontFamily: "monospace", fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Nama Tahapan *</label>
                <input
                  type="text"
                  required
                  value={modal.data.nama_tahapan || ""}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, nama_tahapan: e.target.value } })}
                  style={inputStyle}
                  placeholder="Nama tahapan perencanaan..."
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Dasar Pasal (Permendagri 86/2017)</label>
                <input
                  type="text"
                  value={modal.data.dasar_pasal || ""}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, dasar_pasal: e.target.value } })}
                  style={inputStyle}
                  placeholder="Mis. Permendagri 86/2017 Pasal 73-76"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Target Keluaran / Output</label>
                <input
                  type="text"
                  value={modal.data.target_keluaran || ""}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, target_keluaran: e.target.value } })}
                  style={inputStyle}
                  placeholder="Mis. SK Tim Penyusun RKPD"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Tanggal Mulai *</label>
                <input
                  type="date"
                  required
                  value={modal.data.tgl_mulai || ""}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, tgl_mulai: e.target.value } })}
                  style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Tanggal Selesai *</label>
                <input
                  type="date"
                  required
                  value={modal.data.tgl_selesai || ""}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, tgl_selesai: e.target.value } })}
                  style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }}
                />
              </div>
            </div>

            {/* Penanggung Jawab (PIC) & Bidang - MultiSelect (Bisa Lebih dari 1) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary }}>Penanggung Jawab (PIC)</label>
                  <span style={{ fontSize: 11, color: T.textMuted }}>Bisa &gt; 1</span>
                </div>
                <MultiSelect
                  values={modal.data.pic_nama}
                  onChange={(nextArr) => setModal({ ...modal, data: { ...modal.data, pic_nama: nextArr.join("; ") } })}
                  onItemAdd={(val, opt) => {
                    if (opt?.bidang) {
                      const curBid = parseMultiValue(modal.data.pic_bidang, bidangOptions);
                      if (!curBid.some((b) => b.toLowerCase() === opt.bidang.toLowerCase())) {
                        setModal((prev) => ({
                          ...prev,
                          data: { ...prev.data, pic_bidang: [...curBid, opt.bidang].join("; ") },
                        }));
                      }
                    }
                  }}
                  options={userOptions}
                  placeholder="Pilih atau ketik nama PIC..."
                  badgeVariant="primary"
                />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary }}>Bidang Penanggung Jawab</label>
                  <span style={{ fontSize: 11, color: T.textMuted }}>Bisa &gt; 1</span>
                </div>
                <MultiSelect
                  values={modal.data.pic_bidang}
                  onChange={(nextArr) => setModal({ ...modal, data: { ...modal.data, pic_bidang: nextArr.join("; ") } })}
                  options={bidangOptions}
                  placeholder="Pilih atau ketik bidang..."
                  badgeVariant="neutral"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Status</label>
                <Select
                  fullWidth
                  searchable={false}
                  size="md"
                  value={modal.data.status || "todo"}
                  onChange={(st) => {
                    const pct = st === "done" ? 100 : (st === "todo" ? 0 : modal.data.progres_persen);
                    setModal({ ...modal, data: { ...modal.data, status: st, progres_persen: pct } });
                  }}
                  options={KANBAN_COLS.map((c) => ({ value: c.key, label: c.label }))}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>
                  Progres (%)
                </label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "inline-flex", border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", background: cardBg, flexShrink: 0 }}>
                    {[0, 25, 50, 75, 100].map((v) => {
                      const active = Number(modal.data.progres_persen || 0) === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            const nextStatus = v === 100 ? "done" : (v === 0 ? "todo" : (modal.data.status === "todo" || modal.data.status === "done" ? "in_progress" : modal.data.status));
                            setModal({ ...modal, data: { ...modal.data, progres_persen: v, status: nextStatus } });
                          }}
                          style={{
                            height: 36,
                            padding: "0 9px",
                            border: "none",
                            borderRight: v !== 100 ? `1px solid ${T.border}` : "none",
                            background: active ? T.primary : "transparent",
                            color: active ? "#fff" : T.textSecondary,
                            fontSize: 11.5,
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            cursor: "pointer",
                          }}
                        >
                          {v}%
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ position: "relative", flex: 1, minWidth: 64 }}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={modal.data.progres_persen ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                        setModal({ ...modal, data: { ...modal.data, progres_persen: v } });
                      }}
                      style={{ ...inputStyle, paddingRight: 22, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                    />
                    <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: T.textMuted, pointerEvents: "none" }}>%</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Dokumen Bukti (Upload ke Arsip / Google Drive)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  style={{
                    height: 36,
                    padding: "0 14px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
                    color: T.primary,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon name="upload" size={14} /> {modal.data.dokumen_url ? "Ganti Dokumen" : "Unggah Dokumen"}
                </button>
                {modal.data.dokumen_url ? (
                  <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: isDark ? "rgba(16,185,129,0.08)" : "#ECFDF5" }}>
                    <a
                      href={modal.data.dokumen_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, fontWeight: 600, color: "#059669", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      Dokumen terlampir (Buka)
                    </a>
                    <button
                      type="button"
                      title="Hapus lampiran"
                      onClick={() => setModal({ ...modal, data: { ...modal.data, dokumen_url: "" } })}
                      style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 2 }}
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: T.textMuted }}>Belum ada dokumen diunggah</span>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 5 }}>Catatan / Kendala</label>
              <textarea
                rows={2}
                value={modal.data.catatan || ""}
                onChange={(e) => setModal({ ...modal, data: { ...modal.data, catatan: e.target.value } })}
                style={{ ...inputStyle, height: "auto", padding: "8px 10px" }}
                placeholder="Catatan pelaksanaan atau kendala..."
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              {modal.mode === "edit" ? (
                <button
                  type="button"
                  onClick={() => deleteItem(modal.data.id)}
                  style={{
                    height: 36,
                    padding: "0 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(239,68,68,0.25)",
                    background: isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)",
                    color: "#DC2626",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Hapus Tahapan
                </button>
              ) : <div />}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  style={{
                    height: 36,
                    padding: "0 16px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: cardBg,
                    color: T.text,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    height: 36,
                    padding: "0 20px",
                    borderRadius: 8,
                    border: "none",
                    background: T.primary,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showUpload && modal && onUnggahDokumen && (
        <UploadForm
          dalamModal
          satuFile
          onTutup={() => setShowUpload(false)}
          onSubmit={async (payload, onProgress) => {
            let uploadedUrl = "";
            const sukses = await onUnggahDokumen(payload, onProgress, {
              onUploaded: (docsBaru) => {
                const first = Array.isArray(docsBaru) ? docsBaru[0] : null;
                if (first) uploadedUrl = first.url || first.fileUrl || "";
              },
            });
            if (sukses) {
              if (uploadedUrl) {
                setModal((prev) => (prev ? { ...prev, data: { ...prev.data, dokumen_url: uploadedUrl } } : prev));
              }
              setShowUpload(false);
            }
            return sukses;
          }}
          user={user}
          categories={categories}
          sectors={sectors}
          bidangs={bidangs}
          initialTitle={`${modal.data.tahap_kode || ""} ${modal.data.nama_tahapan || ""}`.trim()}
          initialYear={tahun}
          judul="Unggah Dokumen Bukti Tahapan"
        />
      )}
    </div>
  );
}
