import { useState, useMemo } from "react";
import { Icon, Badge, GoogleDriveEmbed, isGDriveUrl } from "./ui.jsx";
import { YEARS, STATUS_LIST, STATUS_COLOR } from "../data.js";
import useResponsive from "../useResponsive.js";

// ─── DAFTAR DOKUMEN ───────────────────────────────────────────────────────────
// ── Shared Design Tokens ────────────────────────────────────────────────────
const T = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E4ECFC",
  borderHover: "#C7D7FC",
  primary: "#2563EB",
  primaryHover: "#1D4ED8",
  primaryLight: "#EFF6FF",
  primaryRing: "rgba(37,99,235,0.15)",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  dangerHover: "#FEE2E2",
  dangerRing: "rgba(220,38,38,0.15)",
  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  surfaceHover: "#F8FAFC",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  focusRing: "0 0 0 3px rgba(37,99,235,0.15)",
  shadowSm: "0 1px 2px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
  shadowLg: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)",
  radius: "10px",
  radiusLg: "14px",
  font: "'Lexend', 'Source Sans 3', system-ui, -apple-system, sans-serif",
};

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
  padding: "10px 18px",
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
  padding: "10px 14px 10px 36px",
  fontFamily: T.font,
  border: `1.5px solid ${T.border}`,
  borderRadius: T.radius,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
  color: T.text,
  background: "#fff",
};

const selStyle = {
  fontFamily: T.font,
  fontSize: 13,
  padding: "8px 12px",
  border: `1.5px solid ${T.border}`,
  borderRadius: T.radius,
  background: "#fff",
  color: T.text,
  cursor: "pointer",
  outline: "none",
  transition: "border-color 0.15s",
  minWidth: 120,
};

const FILE_TYPE_COLORS = {
  "Laporan": { bg: "#EFF6FF", text: "#2563EB" },
  "Peraturan": { bg: "#FEF3C7", text: "#D97706" },
  "Keputusan": { bg: "#F3E8FF", text: "#9333EA" },
  "Notulis": { bg: "#ECFDF5", text: "#059669" },
  "Data": { bg: "#FFF1F2", text: "#E11D48" },
};

function getFileTypeColor(type) {
  return FILE_TYPE_COLORS[type] || { bg: "#F1F5F9", text: "#64748B" };
}

export function DocList({ docs, onView, categories = [], sectors = [], bidangs = [] }) {
  const { isMobile } = useResponsive();
  const [showFilter, setShowFilter] = useState(!isMobile);
  const [viewMode, setViewMode] = useState("grid");
  const [gridSize, setGridSize] = useState(240);
  const [search,       setSearch]       = useState("");
  const [filterType,   setFilterType]   = useState("Semua Jenis");
  const [filterSector, setFilterSector] = useState("Semua Sektor");
  const [filterBidang, setFilterBidang] = useState("Semua Bidang");
  const [filterYear,   setFilterYear]   = useState("Semua Tahun");
  const [filterStatus, setFilterStatus] = useState("Semua Status");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return docs.filter(d => {
      const matchQ = !q || d.title.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) || d.tags.some(t => t.includes(q));
      return (
        matchQ &&
        (filterType   === "Semua Jenis"   || d.type   === filterType)   &&
        (filterSector === "Semua Sektor"  || d.sector === filterSector) &&
        (filterBidang === "Semua Bidang"  || d.bidang === filterBidang) &&
        (filterYear   === "Semua Tahun"   || d.year   === filterYear)   &&
        (filterStatus === "Semua Status"  || d.status === filterStatus)
      );
    });
  }, [docs, search, filterType, filterSector, filterBidang, filterYear, filterStatus]);

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: T.text }}>Dokumen</div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>{filtered.length} dokumen ditemukan</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Grid Size Slider */}
          {viewMode === "grid" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: "6px 10px" }}>
              <Icon name="grid" size={12} style={{ color: T.textMuted }} />
              <input
                type="range"
                min={160}
                max={400}
                value={gridSize}
                onChange={e => setGridSize(Number(e.target.value))}
                style={{ width: 60, height: 4, accentColor: T.primary, cursor: "pointer" }}
              />
            </div>
          )}
          {/* View Toggle */}
          <div style={{ display: "flex", background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden" }}>
            <button
              onClick={() => setViewMode("grid")}
              style={{
                ...btnBase,
                padding: "8px 12px",
                fontSize: 12,
                background: viewMode === "grid" ? T.primary : "transparent",
                color: viewMode === "grid" ? "#fff" : T.textSecondary,
                borderRadius: 0,
                borderRight: `1px solid ${T.border}`,
              }}
              title="Grid View"
            >
              <Icon name="grid" size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              style={{
                ...btnBase,
                padding: "8px 12px",
                fontSize: 12,
                background: viewMode === "list" ? T.primary : "transparent",
                color: viewMode === "list" ? "#fff" : T.textSecondary,
                borderRadius: 0,
              }}
              title="List View"
            >
              <Icon name="list" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ ...cardStyle, padding: isMobile ? 12 : 16, marginBottom: 16 }}>
        {isMobile && (
          <div
            onClick={() => setShowFilter(v => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: showFilter ? 10 : 0 }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary }}>Filter Pencarian</span>
            <Icon name={showFilter ? "x" : "filter"} size={16} style={{ color: T.textMuted }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
            <Icon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari judul, jenis, atau tag..."
              style={{
                ...inputStyle,
                background: T.bg,
              }}
              onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
              onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
            />
          </div>
          {(!isMobile || showFilter) && (
            <>
              <select value={filterType}   onChange={e => setFilterType(e.target.value)}   style={selStyle}>
                <option value="Semua Jenis">Semua Jenis</option>
                {categories.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
              </select>
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)} style={selStyle}>
                <option value="Semua Sektor">Semua Sektor</option>
                {sectors.map(s => <option key={s.id} value={s.nama}>{s.nama}</option>)}
              </select>
              <select value={filterBidang} onChange={e => setFilterBidang(e.target.value)} style={selStyle}>
                <option value="Semua Bidang">Semua Bidang</option>
                {bidangs.map(b => <option key={b.id} value={b.nama}>{b.nama}</option>)}
              </select>
              <select value={filterYear}   onChange={e => setFilterYear(e.target.value)}   style={selStyle}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selStyle}>
                {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}>
          <div style={{ width: 64, height: 64, background: T.primaryLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Icon name="search" size={28} style={{ color: T.primary }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>Tidak ada dokumen ditemukan</div>
          <div style={{ fontSize: 13, color: T.textSecondary }}>Coba ubah kata kunci atau filter pencarian</div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && filtered.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`,
          gap: 10,
        }}>
          {filtered.map((d, i) => {
            const typeColor = getFileTypeColor(d.type);
            return (
              <div
                key={d.id}
                onClick={() => onView(d)}
                style={{
                  ...cardStyle,
                  padding: isMobile ? 12 : 14,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  animation: "fadeIn 0.3s ease forwards",
                  animationDelay: `${i * 30}ms`,
                  opacity: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = T.shadowMd;
                  e.currentTarget.style.borderColor = T.borderHover;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = T.shadowSm;
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* File Type Icon */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: typeColor.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}>
                  <Icon name="file" size={16} style={{ color: typeColor.text }} />
                </div>

                {/* Title */}
                <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: T.text, marginBottom: 6, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34 }}>
                  {d.title}
                </div>

                {/* Meta */}
                <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>
                  {d.sector} · {d.year}{d.bidang ? <> · <span style={{ color: T.primary, fontWeight: 500 }}>{d.bidang}</span></> : null}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                  <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
                  <span style={{ fontSize: 10, color: T.textMuted }}>{d.size}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((d, i) => {
            const typeColor = getFileTypeColor(d.type);
            return (
              <div
                key={d.id}
                onClick={() => onView(d)}
                style={{
                  ...cardStyle,
                  padding: isMobile ? "10px 12px" : "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  animation: "fadeIn 0.3s ease forwards",
                  animationDelay: `${i * 20}ms`,
                  opacity: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = T.shadowMd;
                  e.currentTarget.style.borderColor = T.borderHover;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = T.shadowSm;
                  e.currentTarget.style.borderColor = T.border;
                }}
              >
                {/* File Type Icon */}
                <div style={{
                  width: isMobile ? 36 : 40,
                  height: isMobile ? 36 : 40,
                  borderRadius: 10,
                  background: typeColor.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon name="file" size={isMobile ? 16 : 18} style={{ color: typeColor.text }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: isMobile ? 11 : 12, color: T.textSecondary }}>
                    <span>{d.type}</span>
                    <span>·</span>
                    <span>{d.sector}</span>
                    <span>·</span>
                    <span>{d.year}</span>
                    {d.bidang ? <><span>·</span><span style={{ color: T.primary, fontWeight: 500 }}>{d.bidang}</span></> : null}
                    <span>·</span>
                    <span>{d.size}</span>
                  </div>
                </div>

                {/* Status + Arrow */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
                  <Icon name="chevronRight" size={14} style={{ color: T.textMuted }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DETAIL DOKUMEN ───────────────────────────────────────────────────────────

export function DocDetail({ doc, onBack, onApprove, onReject, onDownload, onPreview, onTogglePublik, user }) {
  const { isMobile } = useResponsive();
  const [catatan, setCatatan] = useState("");
  const [showEmbed, setShowEmbed] = useState(false);

  const canApprove =
    (user.role === "Reviewer" || user.role === "Admin") &&
    (doc.status === "Menunggu Review" || doc.status === "Menunggu Persetujuan");

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.title) || (doc.url && /\.(jpg|jpeg|png|gif|webp)/i.test(doc.url));
  const canEmbed = isGDriveUrl(doc.url);

  const steps = [
    { label: "Diunggah",               done: true,                        date: doc.uploadDate },
    { label: "Review Kabid",           done: doc.reviewedBy !== "—",      date: doc.reviewedBy !== "—" ? "Selesai" : "Menunggu" },
    { label: "Persetujuan Kepala",     done: doc.status === "Diarsipkan", date: doc.status === "Diarsipkan" ? "Disetujui" : doc.status === "Ditolak" ? "Ditolak" : "Menunggu" },
    { label: "Diarsipkan",             done: doc.status === "Diarsipkan", date: doc.status === "Diarsipkan" ? "✓" : "—" },
  ];

  return (
    <div style={{ padding: isMobile ? 16 : "28px 36px", fontFamily: T.font, background: T.bg, minHeight: "100%" }}>
      {/* Back Button */}
      <button onClick={onBack} style={{
        ...btnBase,
        background: T.card,
        color: T.primary,
        fontSize: 14,
        fontWeight: 600,
        padding: "10px 18px",
        marginBottom: 20,
        border: `1.5px solid ${T.border}`,
        borderRadius: T.radius,
        boxShadow: T.shadowSm,
        transition: "all 0.15s ease",
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = T.focusRing; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = T.shadowSm; }}>
        <Icon name="chevronRight" size={16} style={{ transform: "rotate(180deg)", marginRight: 4 }} />
        Kembali ke Daftar
      </button>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* ── Left Column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Title Card */}
          <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.3, letterSpacing: "-0.02em" }}>{doc.title}</h1>
                <div style={{ marginTop: 10 }}>
                  <Badge label={doc.status} colors={STATUS_COLOR[doc.status]} />
                </div>
              </div>
              <div style={{ width: 52, height: 52, background: T.primaryLight, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 16 }}>
                <Icon name="file" size={24} style={{ color: T.primary }} />
              </div>
            </div>
            <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.7, margin: 0 }}>{doc.desc}</p>
            {doc.tags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                {doc.tags.map(t => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 500, color: T.primary, background: T.primaryLight, padding: "4px 10px", borderRadius: 99 }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Metadata Card */}
          <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 16px" }}>Metadata Dokumen</h2>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
              {[
                ["Jenis Dokumen", doc.type],
                ["Sektor",        doc.sector],
                ["Bidang",        doc.bidang || "—"],
                ["Tahun",         doc.year],
                ["Ukuran File",   doc.size],
                ["Jumlah Halaman",`${doc.pages} halaman`],
                ["Tanggal Upload", doc.uploadDate],
                ["Diunggah oleh", doc.uploader],
                ["Di-review oleh",doc.reviewedBy],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: "12px 14px", background: T.bg, borderRadius: T.radius, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Approval Panel */}
          {canApprove && (
            <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 14px" }}>Tindakan Persetujuan</h2>
              <textarea
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Catatan review (opsional)..."
                rows={3}
                style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radius, fontSize: 14, fontFamily: T.font, resize: "vertical", boxSizing: "border-box", outline: "none", color: T.text }}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <button onClick={() => onApprove(doc)} style={{ ...btnBase, flex: 1, padding: "11px 16px", background: T.primary, color: "#fff", fontSize: 13, boxShadow: "0 1px 3px rgba(37,99,235,0.3)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.primaryHover; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.primary; e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.3)"; }}>
                  <Icon name="check" size={14} /> Setujui & Arsipkan
                </button>
                <button onClick={() => onReject(doc)} style={{ ...btnBase, flex: 1, padding: "11px 16px", background: T.dangerBg, color: T.danger, fontSize: 13, border: `1px solid ${T.dangerBorder}` }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.dangerHover; e.currentTarget.style.borderColor = "#F87171"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.dangerBg; e.currentTarget.style.borderColor = T.dangerBorder; }}>
                  <Icon name="x" size={14} /> Tolak Dokumen
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: isMobile ? "static" : "sticky", top: 20 }}>
          {/* Image Preview */}
          {isImage && doc.url && (
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <img src={doc.url} alt={doc.title} style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "contain", background: T.bg }} />
            </div>
          )}

          {/* Actions Card */}
          <div style={{ ...cardStyle, padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Aksi</h3>

            {/* Download Button */}
            <button onClick={() => onDownload(doc)} style={{ ...btnBase, width: "100%", padding: "12px 16px", background: T.primary, color: "#fff", fontSize: 14, boxShadow: "0 1px 3px rgba(37,99,235,0.3)", marginBottom: 10 }}
              onMouseEnter={e => { e.currentTarget.style.background = T.primaryHover; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.primary; e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.3)"; }}>
              <Icon name="download" size={16} /> Unduh Dokumen
            </button>

            {/* Embed / Preview Button — PROMINENT */}
            {canEmbed && (
              <>
                <button onClick={() => setShowEmbed(true)} style={{ ...btnBase, width: "100%", padding: "12px 16px", background: T.success, color: "#fff", fontSize: 14, fontWeight: 700, boxShadow: "0 1px 3px rgba(5,150,105,0.3)", marginBottom: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#047857"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(5,150,105,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.success; e.currentTarget.style.boxShadow = "0 1px 3px rgba(5,150,105,0.3)"; }}>
                  <Icon name="eye" size={16} /> Lihat Dokumen
                </button>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ ...btnBase, width: "100%", padding: "12px 16px", background: T.successBg, color: T.success, fontSize: 14, fontWeight: 600, border: `1.5px solid ${T.successBorder}`, textDecoration: "none", marginBottom: 10 }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.successHover; e.currentTarget.style.borderColor = "#6EE7B7"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.successBg; e.currentTarget.style.borderColor = T.successBorder; }}>
                  <Icon name="external-link" size={15} /> Buka di Tab Baru
                </a>
              </>
            )}

            {!canEmbed && (
              <button onClick={() => onPreview && onPreview(doc)} style={{ ...btnBase, width: "100%", padding: "12px 16px", background: "#F1F5F9", color: T.textSecondary, fontSize: 14, marginBottom: 10 }}>
                <Icon name="eye" size={15} /> Preview Online
              </button>
            )}

            {/* Publish Button */}
            {doc.status === "Diarsipkan" && (
              <button onClick={() => onTogglePublik && onTogglePublik(doc)}
                style={{ ...btnBase, width: "100%", padding: "12px 16px", fontSize: 14, marginBottom: 0,
                  background: doc.publik ? T.successBg : T.primaryLight,
                  color: doc.publik ? T.success : T.primary,
                  border: `1.5px solid ${doc.publik ? T.successBorder : T.border}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = doc.publik ? T.successHover : "#DBEAFE"; }}
                onMouseLeave={e => { e.currentTarget.style.background = doc.publik ? T.successBg : T.primaryLight; }}>
                <Icon name="world" size={15} /> {doc.publik ? "✓ Dipublikasikan" : "Publikasikan ke Publik"}
              </button>
            )}
          </div>

          {/* Status History */}
          <div style={{ ...cardStyle, padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Riwayat Status</h3>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < steps.length - 1 ? 14 : 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: 99, background: s.done ? T.primary : T.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {s.done && <Icon name="check" size={11} style={{ color: "#fff" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.done ? T.text : T.textMuted }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{s.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Embed Modal */}
      {showEmbed && (
        <GoogleDriveEmbed
          url={doc.url}
          title={doc.title}
          onClose={() => setShowEmbed(false)}
        />
      )}
    </div>
  );
}
