import { useState, useMemo } from "react";
import { Icon, Badge, GoogleDriveEmbed, isGDriveUrl, formatBytes, extractGDriveFileId, extractGDriveFolderId, gdriveDirectUrl, isImageFile, isOfficeFile, isPdfFile, getUniversalPreviewUrl } from "./ui.jsx";
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

const BIDANG_COLORS = {
  "Sekretariat":                                    { bg: "#F1F5F9", text: "#475569" },
  "Bidang Perencanaan":                             { bg: "#EFF6FF", text: "#2563EB" },
  "Bidang Ekonomi dan SDA":                         { bg: "#ECFDF5", text: "#059669" },
  "Bidang Pemerintahan dan Pembangunan Manusia":    { bg: "#FEF3C7", text: "#D97706" },
  "Bidang Infrastruktur dan Kewilayahan":           { bg: "#F3E8FF", text: "#9333EA" },
  "Bidang Riset dan Inovasi Daerah":                { bg: "#FFF1F2", text: "#E11D48" },
};
function getBidangColor(bidang) { return BIDANG_COLORS[bidang] || { bg: "#F1F5F9", text: "#64748B" }; }

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
  const [selectedBidang, setSelectedBidang] = useState(null); // null = show folders

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

  const tanpaBidangDocs = useMemo(() => {
    return filtered.filter(d => !d.bidang || d.bidang === "Umum");
  }, [filtered]);

  const bidangFolders = useMemo(() => {
    const map = {};
    docs.forEach(d => {
      if (d.bidang && d.bidang !== "Umum") map[d.bidang] = (map[d.bidang] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [docs]);

  const folderDocs = useMemo(() => {
    if (!selectedBidang) return [];
    return filtered.filter(d => d.bidang === selectedBidang);
  }, [filtered, selectedBidang]);

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {selectedBidang && (
            <button onClick={() => setSelectedBidang(null)} style={{ ...btnBase, background: T.card, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "8px 12px", fontSize: 13, color: T.primary, boxShadow: T.shadowSm }}>
              <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
            </button>
          )}
          <div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: T.text }}>
              {selectedBidang || "Dokumen"}
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
              {selectedBidang ? `${folderDocs.length} dokumen` : `${bidangFolders.length} bidang · ${docs.length} dokumen`}
            </div>
          </div>
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
                <option value="Umum">Umum</option>
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

      {/* ── GRID: Tanpa Bidang (direct docs) ── */}
      {viewMode === "grid" && !selectedBidang && tanpaBidangDocs.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary, marginBottom: 10, marginTop: 8 }}>Tanpa Bidang</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`,
            gap: 10,
            marginBottom: 20,
          }}>
            {tanpaBidangDocs.map((d, i) => {
              const isFolder = Array.isArray(d.files) && d.files.length > 0;
              return (
                <div
                  key={d.id}
                  onClick={() => onView(d)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView(d); }}}
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
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                    e.currentTarget.style.borderColor = T.borderHover;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = T.shadowSm;
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${T.primaryRing}`; }}
                  onBlur={e => { e.currentTarget.style.boxShadow = T.shadowSm; }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: T.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name={isFolder ? "folder" : "file"} size={18} style={{ color: T.primary }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: T.text, lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {d.title}
                      </div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>
                        {isFolder ? `${d.files.length} file dalam folder` : d.type}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── GRID: Folder Level ── */}
      {viewMode === "grid" && !selectedBidang && bidangFolders.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`,
          gap: 12,
        }}>
          {bidangFolders.map(([nama, count], i) => {
            const bc = getBidangColor(nama);
            return (
              <div
                key={nama}
                onClick={() => setSelectedBidang(nama)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedBidang(nama); }}}
                style={{
                  ...cardStyle,
                  padding: isMobile ? 20 : 24,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  animation: "fadeIn 0.3s ease forwards",
                  animationDelay: `${i * 40}ms`,
                  opacity: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 14,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = bc.text;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = T.shadowSm;
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${T.primaryRing}`; }}
                onBlur={e => { e.currentTarget.style.boxShadow = T.shadowSm; }}
              >
                {/* Folder Icon */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: bc.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Icon name="folder" size={22} style={{ color: bc.text }} />
                </div>
                {/* Name + Count */}
                <div>
                  <div style={{
                    fontSize: isMobile ? 13 : 14,
                    fontWeight: 600,
                    color: T.text,
                    lineHeight: 1.3,
                    marginBottom: 4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {nama}
                  </div>
                  <div style={{ fontSize: 12, color: T.textSecondary }}>
                    {count} dokumen
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── GRID: Document Level (inside folder) ── */}
      {viewMode === "grid" && selectedBidang && folderDocs.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : `repeat(auto-fill, minmax(${gridSize}px, 1fr))`,
          gap: 10,
        }}>
          {folderDocs.map((d, i) => {
            const isFolder = Array.isArray(d.files) && d.files.length > 0;
            return (
              <div
                key={d.id}
                onClick={() => onView(d)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView(d); }}}
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
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = T.borderHover;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = T.shadowSm;
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${T.primaryRing}`; }}
                onBlur={e => { e.currentTarget.style.boxShadow = T.shadowSm; }}
              >
                {/* File Icon */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: getBidangColor(d.bidang).bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}>
                  <Icon name={isFolder ? "folder" : "file"} size={16} style={{ color: getBidangColor(d.bidang).text }} />
                </div>
                {/* Title */}
                <div style={{
                  fontSize: isMobile ? 12 : 13,
                  fontWeight: 700,
                  color: T.text,
                  marginBottom: 6,
                  lineHeight: 1.3,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  minHeight: 34,
                }}>
                  {d.title}
                </div>
                {/* Meta */}
                <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>
                  {isFolder ? `${d.files.length} file · ${d.sector} · ${d.year}` : `${d.sector} · ${d.year}`}
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

      {/* ── GRID: Empty inside folder ── */}
      {viewMode === "grid" && selectedBidang && folderDocs.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}>
          <Icon name="search" size={28} style={{ color: T.primary }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 12, marginBottom: 4 }}>Tidak ada dokumen</div>
          <div style={{ fontSize: 13, color: T.textSecondary }}>di bidang ini</div>
        </div>
      )}

      {/* ── LIST: Tanpa Bidang (direct docs) ── */}
      {viewMode === "list" && !selectedBidang && tanpaBidangDocs.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary, marginBottom: 6, marginTop: 8 }}>Tanpa Bidang</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {tanpaBidangDocs.map((d, i) => {
              return (
                <div
                  key={d.id}
                  onClick={() => onView(d)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView(d); }}}
                  style={{
                    ...cardStyle,
                    padding: isMobile ? "12px 14px" : "14px 18px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    animation: "fadeIn 0.3s ease forwards",
                    animationDelay: `${i * 30}ms`,
                    opacity: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                    e.currentTarget.style.borderColor = T.borderHover;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = T.shadowSm;
                    e.currentTarget.style.borderColor = T.border;
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${T.primaryRing}`; }}
                  onBlur={e => { e.currentTarget.style.boxShadow = T.shadowSm; }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: T.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="file" size={18} style={{ color: T.primary }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{d.type} · {d.sector}</div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── LIST: Folder Level ── */}
      {viewMode === "list" && !selectedBidang && bidangFolders.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {bidangFolders.map(([nama, count], i) => {
            const bc = getBidangColor(nama);
            return (
              <div
                key={nama}
                onClick={() => setSelectedBidang(nama)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedBidang(nama); }}}
                style={{
                  ...cardStyle,
                  padding: isMobile ? "12px 14px" : "14px 18px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  animation: "fadeIn 0.3s ease forwards",
                  animationDelay: `${i * 30}ms`,
                  opacity: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = bc.text;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = T.shadowSm;
                  e.currentTarget.style.borderColor = T.border;
                }}
                onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${T.primaryRing}`; }}
                onBlur={e => { e.currentTarget.style.boxShadow = T.shadowSm; }}
              >
                {/* Folder Icon */}
                <div style={{
                  width: isMobile ? 40 : 44,
                  height: isMobile ? 40 : 44,
                  borderRadius: 10,
                  background: bc.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon name="folder" size={isMobile ? 18 : 20} style={{ color: bc.text }} />
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: T.text }}>{nama}</div>
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{count} dokumen</div>
                </div>
                <Icon name="chevronRight" size={16} style={{ color: T.textMuted, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST: Document Level (inside folder) ── */}
      {viewMode === "list" && selectedBidang && folderDocs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {folderDocs.map((d, i) => {
            return (
              <div
                key={d.id}
                onClick={() => onView(d)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView(d); }}}
                style={{
                  ...cardStyle,
                  padding: isMobile ? "10px 12px" : "12px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  animation: "fadeIn 0.3s ease forwards",
                  animationDelay: `${i * 20}ms`,
                  opacity: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                  e.currentTarget.style.borderColor = T.borderHover;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = T.shadowSm;
                  e.currentTarget.style.borderColor = T.border;
                }}
                onFocus={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${T.primaryRing}`; }}
                onBlur={e => { e.currentTarget.style.boxShadow = T.shadowSm; }}
              >
                {/* File Icon */}
                <div style={{
                  width: isMobile ? 36 : 40,
                  height: isMobile ? 36 : 40,
                  borderRadius: 10,
                  background: getBidangColor(d.bidang).bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon name="file" size={isMobile ? 16 : 18} style={{ color: getBidangColor(d.bidang).text }} />
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: isMobile ? 11 : 12, color: T.textSecondary }}>
                    <span>{d.type}</span>
                    <span>·</span>
                    <span>{d.sector}</span>
                    <span>·</span>
                    <span>{d.year}</span>
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

      {/* ── LIST: Empty inside folder ── */}
      {viewMode === "list" && selectedBidang && folderDocs.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}>
          <Icon name="search" size={28} style={{ color: T.primary }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginTop: 12, marginBottom: 4 }}>Tidak ada dokumen</div>
          <div style={{ fontSize: 13, color: T.textSecondary }}>di bidang ini</div>
        </div>
      )}
    </div>
  );
}

// ─── DETAIL DOKUMEN ───────────────────────────────────────────────────────────

export function DocDetail({ doc, onBack, onApprove, onReject, onDownload, onPreview, onTogglePublik, onDelete, onEdit, user, categories = [], sectors = [], bidangs = [], docs = [] }) {
  const { isMobile } = useResponsive();
  const [catatan, setCatatan] = useState("");
  const [showEmbed, setShowEmbed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ judul: "", kategori: "", tipe: "", bidang: "" });
  const [activeFile, setActiveFile] = useState(null);

  const canApprove =
    (user.role === "Reviewer" || user.role === "Admin") &&
    (doc.status === "Menunggu Review" || doc.status === "Menunggu Persetujuan");

  const canEdit = user.role === "Admin" || doc.status !== "Diarsipkan";

  const files = Array.isArray(doc.files) && doc.files.length ? doc.files : null;
  const active = activeFile || (files && files[0]) || {};
  const pUrl = active.url || doc.url;
  const pTitle = active.name || doc.title;
  const isImage = isImageFile(pUrl, pTitle);
  const isOffice = isOfficeFile(pUrl, pTitle);
  const isPdf = isPdfFile(pUrl, pTitle);
  const canEmbed = isGDriveUrl(pUrl);
  // Any file with a URL can be shown inline: Drive files/folders render
  // natively (PDF, DOCX, XLSX, PPTX, images); non-Drive files with a
  // public URL route through Google Docs Viewer as a fallback.
  const previewUrl = getUniversalPreviewUrl(pUrl);
  const canPreviewInline = !!previewUrl;

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

      {/* Title Card */}
      <div style={{ ...cardStyle, padding: isMobile ? 20 : 28, marginBottom: 16 }}>
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

      {/* Action Bar */}
      <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => onDownload(doc)} style={{ ...btnBase, padding: "10px 16px", background: T.primary, color: "#fff", fontSize: 13, boxShadow: "0 1px 3px rgba(37,99,235,0.3)" }}
            onMouseEnter={e => { e.currentTarget.style.background = T.primaryHover; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.primary; e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.3)"; }}>
            <Icon name="download" size={15} /> Unduh
          </button>
          {doc.url && (
            <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ ...btnBase, padding: "10px 16px", background: T.successBg, color: T.success, fontSize: 13, fontWeight: 600, border: `1.5px solid ${T.successBorder}`, textDecoration: "none" }}
              onMouseEnter={e => { e.currentTarget.style.background = T.successHover; e.currentTarget.style.borderColor = "#6EE7B7"; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.successBg; e.currentTarget.style.borderColor = T.successBorder; }}>
              <Icon name="external-link" size={14} /> Tab Baru
            </a>
          )}
          {!canPreviewInline && (
            <button onClick={() => onPreview && onPreview(doc)} style={{ ...btnBase, padding: "10px 16px", background: "#F1F5F9", color: T.textSecondary, fontSize: 13 }}>
              <Icon name="eye" size={14} /> Preview Online
            </button>
          )}
          {doc.status === "Diarsipkan" && (
            <button onClick={() => onTogglePublik && onTogglePublik(doc)}
              style={{ ...btnBase, padding: "10px 16px", fontSize: 13,
                background: doc.publik ? T.successBg : T.primaryLight,
                color: doc.publik ? T.success : T.primary,
                border: `1.5px solid ${doc.publik ? T.successBorder : T.border}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = doc.publik ? T.successHover : "#DBEAFE"; }}
              onMouseLeave={e => { e.currentTarget.style.background = doc.publik ? T.successBg : T.primaryLight; }}>
              <Icon name="world" size={14} /> {doc.publik ? "✓ Dipublikasikan" : "Publikasikan"}
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => {
                setEditForm({ judul: doc.title || doc.judul, kategori: doc.sector || doc.kategori, tipe: doc.type || doc.tipe, bidang: doc.bidang || "" });
                setEditing(true);
              }} style={{ ...btnBase, padding: "10px 16px", fontSize: 13, background: "#F1F5F9", color: T.textSecondary, border: `1.5px solid ${T.border}` }}
                onMouseEnter={e => { e.currentTarget.style.background = "#E2E8F0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#F1F5F9"; }}>
                <Icon name="edit" size={14} /> Edit
              </button>
              <button onClick={() => onDelete && onDelete(doc)} style={{ ...btnBase, padding: "10px 16px", fontSize: 13, background: T.dangerBg, color: T.danger, border: `1.5px solid ${T.dangerBorder}` }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.dangerBg; }}>
                <Icon name="trash" size={14} /> Hapus
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content: Preview + Metadata */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 20, alignItems: "stretch" }}>
        {/* ── Preview Pane ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {files && files.length > 1 && (
            <div style={{ ...cardStyle, padding: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {files.map(f => (
                <button key={f.url} onClick={() => setActiveFile(f)}
                  style={{
                    ...btnBase, padding: "8px 14px", fontSize: 12, borderRadius: 99,
                    background: active === f ? T.primary : T.bg,
                    color: active === f ? "#fff" : T.textSecondary,
                    border: `1.5px solid ${active === f ? T.primary : T.border}`,
                  }}
                  title={f.name}>
                  <Icon name="file" size={12} />
                  <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {isImage && pUrl && (
            <div style={{ ...cardStyle, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, minHeight: 400 }}>
              <img
                src={pUrl}
                alt={pTitle}
                style={{ maxWidth: "100%", maxHeight: 600, borderRadius: T.radius, objectFit: "contain" }}
              />
            </div>
          )}

          {!isImage && canPreviewInline && (
            <div style={{ ...cardStyle, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <iframe
                key={active.url || doc.url}
                src={previewUrl}
                title={pTitle}
                style={{ width: "100%", flex: 1, minHeight: 600, border: "none", borderRadius: `${T.radius}px ${T.radius}px 0 0` }}
                allow="autoplay"
              />
              {!canEmbed && (isOffice || isPdf) && (
                <div style={{ padding: "8px 14px", fontSize: 11, color: T.textMuted, borderTop: `1px solid ${T.border}` }}>
                  Pratinjau via Google Docs Viewer — memerlukan URL file yang dapat diakses publik.
                </div>
              )}
            </div>
          )}

          {!isImage && !canPreviewInline && (
            <div style={{ ...cardStyle, padding: 40, textAlign: "center" }}>
              <Icon name="file" size={32} style={{ color: T.textMuted }} />
              <div style={{ fontSize: 14, color: T.textSecondary, marginTop: 12 }}>
                Preview tidak tersedia untuk dokumen ini
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Metadata + Status ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: isMobile ? "static" : "sticky", top: 20 }}>
          {/* Metadata Card */}
          <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 16px" }}>Metadata Dokumen</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                <div key={k} style={{ padding: "10px 14px", background: T.bg, borderRadius: T.radius, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* File dalam Folder */}
          {Array.isArray(doc.files) && doc.files.length > 0 && (
            <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="folder" size={16} style={{ color: T.primary }} />
                File dalam Folder
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {doc.files.map(f => (
                  <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: T.bg, borderRadius: T.radius, border: `1px solid ${T.border}`, textDecoration: "none", color: "inherit", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = T.focusRing; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}>
                    <Icon name="file" size={15} style={{ color: T.primary, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>{formatBytes(f.size)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Approval Panel */}
          {canApprove && (
            <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 14px" }}>Tindakan Persetujuan</h2>
              <textarea
                value={catatan} onChange={e => setCatatan(e.target.value)}
                placeholder="Catatan review (opsional)..." rows={3}
                style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radius, fontSize: 14, fontFamily: T.font, resize: "vertical", boxSizing: "border-box", outline: "none", color: T.text }}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                <button onClick={() => onApprove(doc)} style={{ ...btnBase, width: "100%", padding: "11px 16px", background: T.primary, color: "#fff", fontSize: 13, boxShadow: "0 1px 3px rgba(37,99,235,0.3)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.primaryHover; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.primary; e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.3)"; }}>
                  <Icon name="check" size={14} /> Setujui & Arsipkan
                </button>
                <button onClick={() => onReject(doc)} style={{ ...btnBase, width: "100%", padding: "11px 16px", background: T.dangerBg, color: T.danger, fontSize: 13, border: `1px solid ${T.dangerBorder}` }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.dangerHover; e.currentTarget.style.borderColor = "#F87171"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.dangerBg; e.currentTarget.style.borderColor = T.dangerBorder; }}>
                  <Icon name="x" size={14} /> Tolak Dokumen
                </button>
              </div>
            </div>
          )}

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

      {/* Edit Modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(false); }}>
          <div style={{ background: T.card, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: 440, padding: isMobile ? 20 : 28, fontFamily: T.font }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: "0 0 20px" }}>Edit Dokumen</h3>
            {[
              { key: "judul", label: "Judul Dokumen", type: "text" },
              { key: "kategori", label: "Sektor", type: "select", opts: sectors.map(s => s.nama || s.name || s) },
              { key: "tipe", label: "Jenis Dokumen", type: "select", opts: categories.map(c => c.nama || c.name || c) },
              { key: "bidang", label: "Bidang", type: "select", opts: ["Umum", ...bidangs.map(b => b.nama || b.name || b)] },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, display: "block", marginBottom: 6 }}>{f.label}</label>
                {f.type === "text" ? (
                  <input value={editForm[f.key]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: T.bg, color: T.text, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = T.primary}
                    onBlur={e => e.target.style.borderColor = T.border} />
                ) : (
                  <select value={editForm[f.key]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: T.bg, color: T.text, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = T.primary}
                    onBlur={e => e.target.style.borderColor = T.border}>
                    <option value="">Pilih {f.label}</option>
                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "10px 16px", fontSize: 14, fontWeight: 600, borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: T.bg, color: T.textSecondary, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "#E2E8F0"}
                onMouseLeave={e => e.currentTarget.style.background = T.bg}>Batal</button>
              <button onClick={async () => {
                const ok = await onEdit(doc, editForm);
                if (ok) setEditing(false);
              }} style={{ flex: 1, padding: "10px 16px", fontSize: 14, fontWeight: 600, borderRadius: T.radius, border: "none", background: T.primary, color: "#fff", cursor: "pointer", boxShadow: "0 1px 3px rgba(37,99,235,0.3)" }}
                onMouseEnter={e => e.currentTarget.style.background = T.primaryHover}
                onMouseLeave={e => e.currentTarget.style.background = T.primary}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
