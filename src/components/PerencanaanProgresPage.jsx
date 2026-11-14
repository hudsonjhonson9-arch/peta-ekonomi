import React, { useContext, useEffect, useMemo, useState } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon, useIsDark } from "./ui.jsx";

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

const toYMD = (d) => (d ? String(d).slice(0, 10) : "");

function ganttSpan(tglMulai, tglSelesai, year) {
  const yStart = new Date(`${year}-01-01T00:00:00`).getTime();
  const yEnd = new Date(`${year}-12-31T23:59:59`).getTime();
  const total = yEnd - yStart;
  const s = new Date(`${toYMD(tglMulai)}T00:00:00`).getTime();
  const e = new Date(`${toYMD(tglSelesai)}T23:59:59`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return { left: 0, width: 8, preYear: false };
  const preYear = s < yStart;
  const cs = Math.max(yStart, Math.min(yEnd, s));
  const ce = Math.max(cs + 86400000, Math.min(yEnd, e));
  const left = ((cs - yStart) / total) * 100;
  const width = Math.max(2.5, ((ce - cs) / total) * 100);
  return { left, width, preYear };
}

export default function PerencanaanProgresPage({ user }) {
  const T = useContext(ThemeContext);
  const isDark = useIsDark();
  const curYear = new Date().getFullYear();
  const [tahun, setTahun] = useState(curYear);
  const [dokumenJenis, setDokumenJenis] = useState("RKPD");
  const [viewMode, setViewMode] = useState("gantt"); // "gantt" | "kanban"
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [modal, setModal] = useState(null); // { mode: "add" | "edit", data: {...} }
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState(null);

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

  const seedTemplate = async () => {
    setSeeding(true);
    try {
      const r = await fetch("/api/perencanaan/progres/seed-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tahun, dokumen_jenis: dokumenJenis }),
      });
      const d = await r.json();
      if (d?.ok) await loadData();
    } finally {
      setSeeding(false);
    }
  };

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
  const cardBg = T.cardBg || T.card;
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
    <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
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
          <select
            aria-label="Jenis Dokumen Perencanaan"
            value={dokumenJenis}
            onChange={(e) => setDokumenJenis(e.target.value)}
            style={{ ...inputStyle, width: "auto", fontWeight: 600 }}
          >
            {DOKUMEN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            aria-label="Tahun Perencanaan"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value))}
            style={{ ...inputStyle, width: 92, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
          >
            {[curYear - 1, curYear, curYear + 1, curYear + 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

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

      {/* Search Bar */}
      {items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Cari tahapan, pasal Permendagri, PIC, atau bidang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, maxWidth: 360 }}
          />
          <div style={{ fontSize: 12, color: T.textMuted }}>
            Menampilkan {filtered.length} dari {items.length} tahapan • Klik item untuk memperbarui progres
          </div>
        </div>
      )}

      {/* Loading / Empty State */}
      {loading ? (
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: 32, textAlign: "center", color: T.textSecondary, fontSize: 13 }}>
          Memuat tahapan perencanaan {dokumenJenis} {tahun}...
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "36px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
            Belum ada tahapan {dokumenJenis} Tahun {tahun}
          </div>
          <p style={{ fontSize: 13, color: T.textSecondary, maxWidth: 520, margin: "6px auto 18px", lineHeight: 1.55 }}>
            Anda dapat memuat tahapan resmi sesuai <b>Permendagri No. 86 Tahun 2017</b> secara otomatis atau menambahkan tahapan secara manual.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={seeding}
              onClick={seedTemplate}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 8,
                border: "none",
                background: T.primary,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {seeding ? "Memuat Template..." : `Muat Template ${dokumenJenis} (Permendagri 86/2017)`}
            </button>
            <button
              type="button"
              onClick={openAdd}
              style={{
                height: 38,
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
              + Tambah Manual
            </button>
          </div>
        </div>
      ) : viewMode === "gantt" ? (
        /* ── TABEL GANTT ── */
        <div style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 1060, borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC", borderBottom: `1px solid ${T.border}` }}>
                <th style={{ textAlign: "left", padding: "10px 12px", width: 290, fontWeight: 700, color: T.textSecondary }}>Tahapan &amp; Dasar Pasal</th>
                <th style={{ textAlign: "left", padding: "10px 8px", width: 130, fontWeight: 700, color: T.textSecondary }}>PIC / Bidang</th>
                <th style={{ textAlign: "left", padding: "10px 8px", width: 115, fontWeight: 700, color: T.textSecondary }}>Status</th>
                <th style={{ textAlign: "right", padding: "10px 10px", width: 64, fontWeight: 700, color: T.textSecondary }}>Progres</th>
                <th style={{ padding: 0, borderLeft: `1px solid ${T.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", textAlign: "center", fontSize: 11, fontWeight: 700, color: T.textSecondary }}>
                    {MONTHS.map((m) => (
                      <div key={m} style={{ padding: "10px 2px", borderRight: `1px solid ${T.border}` }}>{m}</div>
                    ))}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const meta = colMeta(it.status);
                const span = ganttSpan(it.tgl_mulai, it.tgl_selesai, tahun);
                const pct = Number(it.progres_persen) || 0;
                return (
                  <tr
                    key={it.id}
                    onClick={() => openEdit(it)}
                    style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
                  >
                    <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 600, color: T.text, lineHeight: 1.35 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: T.textMuted, marginRight: 6 }}>{it.tahap_kode}</span>
                        {it.nama_tahapan}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        {it.dasar_pasal} • <span style={{ fontVariantNumeric: "tabular-nums" }}>{toYMD(it.tgl_mulai)} s.d. {toYMD(it.tgl_selesai)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", color: T.textSecondary, verticalAlign: "middle" }}>
                      <div style={{ fontWeight: 500, color: T.text }}>{it.pic_nama || "—"}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{it.pic_bidang || "—"}</div>
                    </td>
                    <td style={{ padding: "10px 8px", verticalAlign: "middle" }}>
                      <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: meta.color, verticalAlign: "middle" }}>
                      {pct}%
                    </td>
                    <td style={{ padding: "8px 0", borderLeft: `1px solid ${T.border}`, position: "relative", verticalAlign: "middle" }}>
                      {/* Month grid background */}
                      <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", pointerEvents: "none" }}>
                        {MONTHS.map((m) => (
                          <div key={m} style={{ borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "#F1F5F9"}` }} />
                        ))}
                      </div>
                      {/* Gantt bar */}
                      <div style={{ position: "relative", height: 22, width: "100%" }} title={`${toYMD(it.tgl_mulai)} s.d. ${toYMD(it.tgl_selesai)} (${pct}%)`}>
                        <div
                          style={{
                            position: "absolute",
                            left: `${span.left}%`,
                            width: `${span.width}%`,
                            top: 2,
                            height: 18,
                            borderRadius: 5,
                            background: isDark ? "rgba(255,255,255,0.12)" : "#E2E8F0",
                            border: `1px solid ${meta.color}`,
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ width: `${pct}%`, height: "100%", background: meta.color, opacity: 0.85 }} />
                          {span.preYear && (
                            <span style={{ position: "relative", zIndex: 1, fontSize: 9.5, fontWeight: 700, paddingLeft: 4, color: T.text }}>
                              ← {tahun - 1}
                            </span>
                          )}
                        </div>
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

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2, fontSize: 11, color: T.textSecondary }}>
                          <span>{it.pic_bidang || it.pic_nama || "—"}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>{toYMD(it.tgl_selesai)}</span>
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

      {/* Modal Tambah / Edit Tahapan */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveModal}
            style={{ background: cardBg, border: `1px solid ${T.border}`, borderRadius: 12, width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>
                {modal.mode === "edit" ? "Perbarui Progres Tahapan" : "Tambah Tahapan Perencanaan"}
              </h2>
              <button type="button" onClick={() => setModal(null)} style={{ background: "none", border: "none", color: T.textSecondary, cursor: "pointer" }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Kode Tahap</label>
                <input type="text" value={modal.data.tahap_kode || ""} onChange={(e) => setModal({ ...modal, data: { ...modal.data, tahap_kode: e.target.value } })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Nama Tahapan *</label>
                <input type="text" required value={modal.data.nama_tahapan || ""} onChange={(e) => setModal({ ...modal, data: { ...modal.data, nama_tahapan: e.target.value } })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Dasar Pasal (Permendagri 86/2017)</label>
                <input type="text" value={modal.data.dasar_pasal || ""} onChange={(e) => setModal({ ...modal, data: { ...modal.data, dasar_pasal: e.target.value } })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Target Keluaran / Output</label>
                <input type="text" value={modal.data.target_keluaran || ""} onChange={(e) => setModal({ ...modal, data: { ...modal.data, target_keluaran: e.target.value } })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Tanggal Mulai *</label>
                <input type="date" required value={modal.data.tgl_mulai || ""} onChange={(e) => setModal({ ...modal, data: { ...modal.data, tgl_mulai: e.target.value } })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Tanggal Selesai *</label>
                <input type="date" required value={modal.data.tgl_selesai || ""} onChange={(e) => setModal({ ...modal, data: { ...modal.data, tgl_selesai: e.target.value } })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Penanggung Jawab (PIC)</label>
                <input type="text" value={modal.data.pic_nama || ""} onChange={(e) => setModal({ ...modal, data: { ...modal.data, pic_nama: e.target.value } })} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Bidang</label>
                <input type="text" value={modal.data.pic_bidang || ""} onChange={(e) => setModal({ ...modal, data: { ...modal.data, pic_bidang: e.target.value } })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Status</label>
                <select
                  value={modal.data.status || "todo"}
                  onChange={(e) => {
                    const st = e.target.value;
                    const pct = st === "done" ? 100 : (st === "todo" ? 0 : modal.data.progres_persen);
                    setModal({ ...modal, data: { ...modal.data, status: st, progres_persen: pct } });
                  }}
                  style={inputStyle}
                >
                  {KANBAN_COLS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>
                  Progres ({modal.data.progres_persen || 0}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={modal.data.progres_persen || 0}
                  onChange={(e) => setModal({ ...modal, data: { ...modal.data, progres_persen: Number(e.target.value) } })}
                  style={{ width: "100%", marginTop: 8 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Tautan Bukti / Dokumen (Opsional)</label>
              <input type="url" placeholder="https://..." value={modal.data.dokumen_url || ""} onChange={(e) => setModal({ ...modal, data: { ...modal.data, dokumen_url: e.target.value } })} style={inputStyle} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Catatan / Kendala</label>
              <textarea
                rows={2}
                value={modal.data.catatan || ""}
                onChange={(e) => setModal({ ...modal, data: { ...modal.data, catatan: e.target.value } })}
                style={{ ...inputStyle, height: "auto", padding: "8px 10px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              {modal.mode === "edit" ? (
                <button
                  type="button"
                  onClick={() => deleteItem(modal.data.id)}
                  style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "none", background: "rgba(239,68,68,0.12)", color: "#DC2626", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                >
                  Hapus
                </button>
              ) : <div />}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  style={{ height: 34, padding: "0 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: cardBg, color: T.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
