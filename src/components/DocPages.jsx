import { useState, useMemo, useRef, useEffect, useContext } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Icon, Badge, GoogleDriveEmbed, isGDriveUrl, formatBytes, extractGDriveFileId, extractGDriveFolderId, gdriveDirectUrl, isImageFile, isOfficeFile, isPdfFile, getUniversalPreviewUrl } from "./ui.jsx";
import { YEARS, STATUS_LIST, STATUS_COLOR } from "../data.js";
import useResponsive from "../useResponsive.js";
import { ThemeContext } from "../App.jsx";
import { queryClient } from "../main.jsx";
import HighlightText from "./HighlightText.jsx";

// ── Shared Design Token Helpers (derived from theme T) ─────────────────────
function makeBtnBase(T) {
  return {
    fontFamily: "'Lexend', 'Source Sans 3', system-ui, -apple-system, sans-serif",
    fontWeight: 600,
    borderRadius: "10px",
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
}
function makeCardStyle(T) {
  return { background: T.card, borderRadius: "14px", border: `1px solid ${T.border}`, boxShadow: T.shadowSm };
}
function makeInputStyle(T) {
  return {
    width: "100%", padding: "10px 14px 10px 36px",
    fontFamily: "'Lexend', 'Source Sans 3', system-ui, -apple-system, sans-serif",
    border: `1.5px solid ${T.border}`, borderRadius: "10px", fontSize: 14,
    outline: "none", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s",
    color: T.text, background: T.inputBg,
  };
}
function makeSelStyle(T) {
  return {
    fontFamily: "'Lexend', 'Source Sans 3', system-ui, -apple-system, sans-serif",
    fontSize: 13, padding: "8px 12px", border: `1.5px solid ${T.border}`, borderRadius: "10px",
    background: T.inputBg, color: T.text, cursor: "pointer", outline: "none",
    transition: "border-color 0.15s", minWidth: 120,
  };
}

// ponytail: dark-mode flag set by DocList each render; adapt() derives dark tints
// from the accent color so every color map below works in both themes.
let _dark = false;
function adapt(c) {
  if (!_dark) return c;
  const fg = c.color || c.text;
  const bg = `color-mix(in srgb, ${fg} 22%, transparent)`;
  const nf = `color-mix(in srgb, ${fg} 60%, white)`;
  return c.color ? { ...c, bg, color: nf } : { ...c, bg, text: nf };
}

const FILE_TYPE_COLORS = {
  "Laporan": { bg: "#EFF6FF", text: "#2563EB" },
  "Peraturan": { bg: "#FEF3C7", text: "#D97706" },
  "Keputusan": { bg: "#F3E8FF", text: "#9333EA" },
  "Notulis": { bg: "#ECFDF5", text: "#059669" },
  "Data": { bg: "#FFF1F2", text: "#E11D48" },
};

function getFileTypeColor(type) {
  return adapt(FILE_TYPE_COLORS[type] || { bg: "#F1F5F9", text: "#64748B" });
}

const BIDANG_COLORS = {
  "Sekretariat":                                    { bg: "#F1F5F9", text: "#475569" },
  "Bidang Perencanaan":                             { bg: "#EFF6FF", text: "#2563EB" },
  "Bidang Ekonomi dan SDA":                         { bg: "#ECFDF5", text: "#059669" },
  "Bidang Pemerintahan dan Pembangunan Manusia":    { bg: "#FEF3C7", text: "#D97706" },
  "Bidang Infrastruktur dan Kewilayahan":           { bg: "#F3E8FF", text: "#9333EA" },
  "Bidang Riset dan Inovasi Daerah":                { bg: "#FFF1F2", text: "#E11D48" },
};
function getBidangColor(bidang) { return adapt(BIDANG_COLORS[bidang] || { bg: "#F1F5F9", text: "#64748B" }); }

// ── File Type Icon & Color ──────────────────────────────────────────────────
const EXT_MAP = {
  pdf:  { icon: "file",     bg: "#FEF2F2", color: "#DC2626", label: "PDF" },
  doc:  { icon: "file",     bg: "#EFF6FF", color: "#2563EB", label: "Word" },
  docx: { icon: "file",     bg: "#EFF6FF", color: "#2563EB", label: "Word" },
  xls:  { icon: "file",     bg: "#ECFDF5", color: "#059669", label: "Excel" },
  xlsx: { icon: "file",     bg: "#ECFDF5", color: "#059669", label: "Excel" },
  ppt:  { icon: "file",     bg: "#FEF3C7", color: "#D97706", label: "PPT" },
  pptx: { icon: "file",     bg: "#FEF3C7", color: "#D97706", label: "PPT" },
  jpg:  { icon: "file",     bg: "#F5F3FF", color: "#7C3AED", label: "Gambar" },
  jpeg: { icon: "file",     bg: "#F5F3FF", color: "#7C3AED", label: "Gambar" },
  png:  { icon: "file",     bg: "#F5F3FF", color: "#7C3AED", label: "Gambar" },
  gif:  { icon: "file",     bg: "#F5F3FF", color: "#7C3AED", label: "Gambar" },
  csv:  { icon: "file",     bg: "#ECFDF5", color: "#059669", label: "CSV" },
  zip:  { icon: "file",     bg: "#F1F5F9", color: "#64748B", label: "ZIP" },
};
// ponytail: map kategori dokumen → warna (fallback when no file ext)
const TYPE_COLORS = {
  "Perencanaan":             { bg: "#ECFDF5", color: "#059669" },
  "Perencanaan Tahunan (RKPD)": { bg: "#ECFDF5", color: "#059669" },
  "RKPD":                    { bg: "#ECFDF5", color: "#059669" },
  "Renstra":                 { bg: "#ECFDF5", color: "#059669" },
  "Renja":                   { bg: "#FEF3C7", color: "#D97706" },
  "RKA":                     { bg: "#FEF3C7", color: "#D97706" },
  "Laporan Evaluasi":        { bg: "#EFF6FF", color: "#2563EB" },
  "Evaluasi & Pelaporan":    { bg: "#EFF6FF", color: "#2563EB" },
  "Kajian Ekonomi":          { bg: "#F5F3FF", color: "#7C3AED" },
  "Forum Perencanaan":       { bg: "#FDF2F8", color: "#DB2777" },
  "Administrasi Umum":       { bg: "#F1F5F9", color: "#475569" },
  "Administrasi":            { bg: "#F1F5F9", color: "#475569" },
};
const DEFAULT_TYPE_COLOR = { bg: "#F1F5F9", color: "#64748B" };
function getFileExtInfo(name) {
  if (!name) return adapt({ icon: "file", bg: "#F1F5F9", color: "#64748B", label: "File" });
  const ext = name.split(".").pop().toLowerCase();
  return adapt(EXT_MAP[ext] || { icon: "file", bg: "#F1F5F9", color: "#64748B", label: ext.toUpperCase() });
}
// ponytail: guess file type from title if no files array
function getDocFileInfo(d) {
  if (Array.isArray(d.files) && d.files.length > 0) {
    return getFileExtInfo(d.files[0].name || d.files[0]);
  }
  // fallback: use kategori dokumen color
  return { icon: "file", ...adapt(TYPE_COLORS[d.type] || DEFAULT_TYPE_COLOR), label: d.type || "File" };
}

// ── Hover Tooltip ──────────────────────────────────────────────────────────
function DocTooltip({ doc, children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef(null);
  const fi = getDocFileInfo(doc);

  const onEnter = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setShow(true);
  };

  return (
    <div
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={() => setShow(false)}
      style={{ position: "relative" }}
    >
      {children}
      {show && (
        <div style={{
          position: "fixed",
          left: pos.x,
          top: pos.y - 8,
          transform: "translate(-50%, -100%)",
          background: "#0F172A",
          color: "#F8FAFC",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12,
          lineHeight: 1.5,
          zIndex: 9999,
          pointerEvents: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          maxWidth: 280,
          minWidth: 180,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: fi.bg, color: fi.color, borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700 }}>{fi.label}</span>
            {doc.title}
          </div>
          <div style={{ color: "#94A3B8", fontSize: 11 }}>
            {doc.type} · {doc.sector} · {doc.year}
          </div>
          <div style={{ color: "#94A3B8", fontSize: 11, marginTop: 2 }}>
            {doc.size} · {doc.status}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skeleton Loader ────────────────────────────────────────────────────────
function SkeletonGrid({ count = 8, gridSize = 240 }) {
  const { T } = useContext(ThemeContext);
  const cardStyle = makeCardStyle(T);
  const shimmer = {
    background: `linear-gradient(90deg, ${T.border} 25%, ${T.borderHover} 50%, ${T.border} 75%)`,
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    borderRadius: 8,
  };
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize}px, 1fr))`, gap: 12 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ ...cardStyle, padding: 14 }}>
            <div style={{ ...shimmer, width: 36, height: 36, borderRadius: 8, marginBottom: 10 }} />
            <div style={{ ...shimmer, height: 14, borderRadius: 4, marginBottom: 6, width: "80%" }} />
            <div style={{ ...shimmer, height: 11, borderRadius: 4, width: "60%" }} />
          </div>
        ))}
      </div>
    </>
  );
}

function SkeletonList({ count = 8 }) {
  const { T } = useContext(ThemeContext);
  const cardStyle = makeCardStyle(T);
  const shimmer = {
    background: `linear-gradient(90deg, ${T.border} 25%, ${T.borderHover} 50%, ${T.border} 75%)`,
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    borderRadius: 8,
  };
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ ...cardStyle, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ ...shimmer, width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...shimmer, height: 14, borderRadius: 4, marginBottom: 6, width: "70%" }} />
              <div style={{ ...shimmer, height: 11, borderRadius: 4, width: "40%" }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function DocList({ docs, onView, onNav, categories = [], sectors = [], bidangs = [], loading = false, onBulkAction }) {
  const { T, isDark } = useContext(ThemeContext);
  _dark = !!isDark;
  const { isMobile } = useResponsive();
  const cardStyle = useMemo(() => makeCardStyle(T), [T]);
  const inputStyle = useMemo(() => makeInputStyle(T), [T]);
  const selStyle = useMemo(() => makeSelStyle(T), [T]);
  const btnBase = useMemo(() => makeBtnBase(T), [T]);
  const [showFilter, setShowFilter] = useState(!isMobile);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("doc_viewMode") || "grid");
  const [gridSize, setGridSize] = useState(() => Number(localStorage.getItem("doc_gridSize")) || 240);
  const [dragOver, setDragOver] = useState(false);

  // persist viewMode & gridSize
  const setViewModePersist = (v) => { localStorage.setItem("doc_viewMode", v); setViewMode(v); };
  const setGridSizePersist = (v) => { localStorage.setItem("doc_gridSize", String(v)); setGridSize(v); };

  // drag & drop → buka upload form
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files?.length > 0 && onNav) {
      // ponytail: simpan File objects di window supaya UploadForm bisa ambil
      window.__droppedFiles = Array.from(files);
      onNav("upload");
    }
  };
  const [search,       setSearch]       = useState("");
  const [filterType,   setFilterType]   = useState("Semua Jenis");
  const [filterSector, setFilterSector] = useState("Semua Sektor");
  const [filterBidang, setFilterBidang] = useState("Semua Bidang");
  const [filterYear,   setFilterYear]   = useState("Semua Tahun");
  const [filterStatus, setFilterStatus] = useState("Semua Status");
  const [sortOpt, setSortOpt] = useState("date-desc");
  const [selectedBidang, setSelectedBidang] = useState(null); // null = show folders
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const toggleSelect = (e, id) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const Checkbox = ({ id }) => (
    <div
      onClick={e => toggleSelect(e, id)}
      style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
        border: selectedIds.has(id) ? "none" : `2px solid ${T.borderHover}`,
        background: selectedIds.has(id) ? T.primary : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      {selectedIds.has(id) && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );

  const selectBidang = (b) => {
    setSelectedBidang(b);
    if (b) history.pushState({ folder: b }, "", `#folder-${b}`);
  };
  const clearBidang = () => {
    setSelectedBidang(null);
    history.pushState({ page: "dokumen" }, "", "#dokumen");
  };

  // keyboard shortcuts: Ctrl+K = focus search, Esc = clear folder, ArrowLeft = back
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById("doc-search")?.focus();
      }
      if (e.key === "Escape") {
        if (selectedBidang) clearBidang();
      }
      if (e.key === "ArrowLeft" && selectedBidang) {
        clearBidang();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedBidang]);

  // browser back from folder → clear selectedBidang
  useEffect(() => {
    const onPop = () => {
      const h = location.hash;
      if (!h.startsWith("#folder-")) setSelectedBidang(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortOpt) {
      case "date-desc": return arr.sort((a, b) => b.id - a.id);
      case "date-asc": return arr.sort((a, b) => a.id - b.id);
      case "title-asc": return arr.sort((a, b) => a.title.localeCompare(b.title));
      case "title-desc": return arr.sort((a, b) => b.title.localeCompare(a.title));
      case "size-desc": return arr.sort((a, b) => (b.ukuran || 0) - (a.ukuran || 0));
      case "size-asc": return arr.sort((a, b) => (a.ukuran || 0) - (b.ukuran || 0));
      default: return arr;
    }
  }, [filtered, sortOpt]);

  const tanpaBidangDocs = useMemo(() => {
    return sorted.filter(d => !d.bidang || d.bidang === "Umum");
  }, [sorted]);

  const bidangFolders = useMemo(() => {
    const map = {};
    docs.forEach(d => {
      if (d.bidang && d.bidang !== "Umum") map[d.bidang] = (map[d.bidang] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [docs]);

  const folderDocs = useMemo(() => {
    if (!selectedBidang) return [];
    return sorted.filter(d => d.bidang === selectedBidang);
  }, [sorted, selectedBidang]);

  return (
    <div
      style={{ fontFamily: T.font, background: dragOver ? "#EFF6FF" : T.bg, minHeight: "100vh", transition: "background 0.2s" }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {selectedBidang && (
            <button onClick={clearBidang} style={{ ...btnBase, background: T.card, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "8px 12px", fontSize: 13, color: T.primary, boxShadow: T.shadowSm }}>
              <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
            </button>
          )}
          <div>
            {/* Breadcrumb */}
            {selectedBidang && (
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ cursor: "pointer", color: T.primary }} onClick={clearBidang}>Dokumen</span>
                <Icon name="chevronRight" size={10} style={{ color: T.textMuted }} />
                <span style={{ color: T.text }}>{selectedBidang}</span>
              </div>
            )}
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
                onChange={e => setGridSizePersist(Number(e.target.value))}
                style={{ width: 60, height: 4, accentColor: T.primary, cursor: "pointer" }}
              />
            </div>
          )}
          {/* View Toggle */}
          <div style={{ display: "flex", background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden" }}>
            <button
              onClick={() => setViewModePersist("grid")}
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
              onClick={() => setViewModePersist("list")}
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

      {/* Drag Overlay */}
      {dragOver && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(37,99,235,0.1)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            background: T.card, borderRadius: 16, padding: "32px 48px",
            boxShadow: T.shadowLg, border: `2px dashed ${T.primary}`,
            textAlign: "center",
          }}>
            <Icon name="upload" size={40} style={{ color: T.primary, marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Lepas file untuk upload</div>
          </div>
        </div>
      )}

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
              id="doc-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari judul, jenis, atau tag... (Ctrl+K)"
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
              <select value={sortOpt} onChange={e => setSortOpt(e.target.value)} style={{ ...selStyle, minWidth: 130 }}>
                <option value="date-desc">Terbaru ↓</option>
                <option value="date-asc">Terlama ↑</option>
                <option value="title-asc">Judul A-Z</option>
                <option value="title-desc">Judul Z-A</option>
                <option value="size-desc">Ukuran ↓</option>
                <option value="size-asc">Ukuran ↑</option>
              </select>
              <button
                onClick={() => { setSelectionMode(v => !v); setSelectedIds(new Set()); }}
                style={{ ...btnBase, padding: "8px 14px", fontSize: 13, background: selectionMode ? T.primary : T.card, color: selectionMode ? "#fff" : T.textSecondary, border: `1.5px solid ${selectionMode ? T.primary : T.border}`, borderRadius: 10 }}
              >
                <Icon name={selectionMode ? "x" : "check"} size={14} />
                {selectionMode ? "Batal" : "Pilih"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Skeleton Loading */}
      {loading && (
        viewMode === "grid"
          ? <SkeletonGrid count={8} gridSize={gridSize} />
          : <SkeletonList count={8} />
      )}

      {/* Empty State */}
      {!loading && sorted.length === 0 && (
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
              const fi = isFolder ? { bg: T.primaryLight, color: T.primary, label: "Folder" } : getDocFileInfo(d);
              return (
                <DocTooltip key={d.id} doc={d}>
                  <div
                    onClick={() => { if (!selectionMode) onView(d); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!selectionMode) onView(d); }}}
                    style={{
                      ...cardStyle,
                      padding: isMobile ? 12 : 14,
                      cursor: selectionMode ? "default" : "pointer",
                      transition: "all 0.2s ease",
                      animation: "fadeIn 0.3s ease forwards",
                      animationDelay: `${i * 30}ms`,
                      opacity: 0,
                      position: "relative",
                      background: selectedIds.has(d.id) ? T.primaryLight : T.card,
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
                    {selectionMode && (
                      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
                        <Checkbox id={d.id} />
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: fi.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon name={isFolder ? "folder" : "file"} size={18} style={{ color: fi.color }} />
                      </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: T.text, lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        <HighlightText text={d.title} query={search} />
                      </div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>
                        {isFolder ? `${d.files.length} file dalam folder` : d.type}
                      </div>
                    </div>
                  </div>
                </div>
                </DocTooltip>
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
                onClick={() => selectBidang(nama)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectBidang(nama); }}}
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
                  position: "relative",
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
            const fi = isFolder ? { bg: getBidangColor(d.bidang).bg, color: getBidangColor(d.bidang).text, label: "Folder" } : getDocFileInfo(d);
            return (
              <DocTooltip key={d.id} doc={d}>
                <div
                  onClick={() => { if (!selectionMode) onView(d); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!selectionMode) onView(d); }}}
                  style={{
                    ...cardStyle,
                    padding: isMobile ? 12 : 14,
                    cursor: selectionMode ? "default" : "pointer",
                    transition: "all 0.2s ease",
                    animation: "fadeIn 0.3s ease forwards",
                    animationDelay: `${i * 30}ms`,
                    opacity: 0,
                    position: "relative",
                    background: selectedIds.has(d.id) ? T.primaryLight : T.card,
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
                  {selectionMode && (
                    <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
                      <Checkbox id={d.id} />
                    </div>
                  )}
                  {/* File Icon */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: fi.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}>
                    <Icon name={isFolder ? "folder" : "file"} size={16} style={{ color: fi.color }} />
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
                  <HighlightText text={d.title} query={search} />
                </div>
                {/* Meta */}
                <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>
                  {isFolder ? `${d.files.length} file · ${d.sector} · ${d.year}` : `${d.sector} · ${d.year}`}
                </div>
                {/* Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                  {d.versi > 1 && <span style={{ fontSize: 10, fontWeight: 700, color: T.primary, background: T.primaryLight, border: `1px solid ${T.primaryRing}`, borderRadius: 4, padding: "1px 5px" }}>v{d.versi}</span>}
                  <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
                  <span style={{ fontSize: 10, color: T.textMuted }}>{d.size}</span>
                </div>
              </div>
              </DocTooltip>
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
              const fi = getDocFileInfo(d);
              return (
                <DocTooltip key={d.id} doc={d}>
                  <div
                    onClick={() => { if (!selectionMode) onView(d); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!selectionMode) onView(d); }}}
                    style={{
                      ...cardStyle,
                      padding: isMobile ? "12px 14px" : "14px 18px",
                      cursor: selectionMode ? "default" : "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      animation: "fadeIn 0.3s ease forwards",
                      animationDelay: `${i * 30}ms`,
                      opacity: 0,
                      background: selectedIds.has(d.id) ? T.primaryLight : T.card,
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
                    {selectionMode && <Checkbox id={d.id} />}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: fi.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="file" size={18} style={{ color: fi.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><HighlightText text={d.title} query={search} /></div>
                      <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{d.type} · {d.sector}</div>
                    </div>
                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      {d.versi > 1 && <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, background: T.primaryLight, border: `1px solid ${T.primaryRing}`, borderRadius: 4, padding: "2px 6px" }}>v{d.versi}</span>}
                      <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
                    </div>
                  </div>
                </DocTooltip>
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
                onClick={() => selectBidang(nama)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectBidang(nama); }}}
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
            const fi = getDocFileInfo(d);
            return (
              <DocTooltip key={d.id} doc={d}>
                <div
                  onClick={() => { if (!selectionMode) onView(d); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!selectionMode) onView(d); }}}
                  style={{
                    ...cardStyle,
                    padding: isMobile ? "10px 12px" : "12px 16px",
                    cursor: selectionMode ? "default" : "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    animation: "fadeIn 0.3s ease forwards",
                    animationDelay: `${i * 20}ms`,
                    opacity: 0,
                    background: selectedIds.has(d.id) ? T.primaryLight : T.card,
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
                  {selectionMode && <Checkbox id={d.id} />}
                  {/* File Icon */}
                  <div style={{
                    width: isMobile ? 36 : 40,
                    height: isMobile ? 36 : 40,
                    borderRadius: 10,
                    background: fi.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon name="file" size={isMobile ? 16 : 18} style={{ color: fi.color }} />
                  </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                    <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><HighlightText text={d.title} query={search} /></span>
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
              </DocTooltip>
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

      {/* ── Floating Action Bar (Bulk Selection) ── */}
      {selectionMode && selectedIds.size > 0 && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: T.card, borderRadius: 16, padding: "12px 20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)", border: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 12, zIndex: 1000,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text, marginRight: 4, whiteSpace: "nowrap" }}>
            {selectedIds.size} dipilih
          </span>
          {onBulkAction && (
            <>
              <button onClick={() => onBulkAction("archive", [...selectedIds])} style={{
                ...btnBase, padding: "8px 14px", fontSize: 13,
                background: T.warningBg, color: T.warning, border: `1px solid ${T.warningBorder}`, borderRadius: 10,
              }}>
                <Icon name="archive" size={14} /> Arsipkan
              </button>
              <button onClick={() => onBulkAction("publish", [...selectedIds])} style={{
                ...btnBase, padding: "8px 14px", fontSize: 13,
                background: T.successBg, color: T.success, border: `1px solid ${T.successBorder}`, borderRadius: 10,
              }}>
                <Icon name="world" size={14} /> Publikasikan
              </button>
              <button onClick={() => onBulkAction("delete", [...selectedIds])} style={{
                ...btnBase, padding: "8px 14px", fontSize: 13,
                background: T.dangerBg, color: T.danger, border: `1px solid ${T.dangerBorder}`, borderRadius: 10,
              }}>
                <Icon name="trash" size={14} /> Hapus
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DETAIL DOKUMEN ───────────────────────────────────────────────────────────

export function DocDetail({ doc, onBack, onApprove, onReject, onDownload, onPreview, onTogglePublik, onDelete, onEdit, user, categories = [], sectors = [], bidangs = [], docs = [], showToast }) {
  const { T } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const cardStyle = useMemo(() => makeCardStyle(T), [T]);
  const btnBase = useMemo(() => makeBtnBase(T), [T]);
  const [catatan, setCatatan] = useState("");
  const [showEmbed, setShowEmbed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ judul: "", kategori: "", tipe: "", bidang: "", desc: "", tags: "", nomor: "", tanggal: "", fileType: "" });
  const [activeFile, setActiveFile] = useState(null);
  const [history, setHistory] = useState([]);
  const [versions, setVersions] = useState([]);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionFile, setVersionFile] = useState(null);
  const [versionNote, setVersionNote] = useState("");
  const [versionProgress, setVersionProgress] = useState(0);
  const [versionUploading, setVersionUploading] = useState(false);
  const sidebarRef = useRef(null);
  const [sidebarH, setSidebarH] = useState(0);

  useEffect(() => {
    if (!sidebarRef.current) return;
    const ro = new ResizeObserver(([e]) => setSidebarH(e.contentRect.height));
    ro.observe(sidebarRef.current);
    return () => ro.disconnect();
  }, []);

  // Fetch history
  useEffect(() => {
    if (!doc?.id) return;
    fetch(`/api/docs/${doc.id}/history`)
      .then(r => r.ok ? r.json() : [])
      .then(setHistory)
      .catch(() => {});
  }, [doc?.id]);

  // Fetch versions
  useEffect(() => {
    if (!doc?.id) return;
    fetch(`/api/docs/${doc.id}/versions`)
      .then(r => r.ok ? r.json() : { versions: [] })
      .then(d => setVersions(d.versions || []))
      .catch(() => {});
  }, [doc?.id]);

  const handleRestoreVersion = async (versionNo) => {
    if (!window.confirm(`Pulihkan ke v${versionNo}?`)) return;
    try {
      const r = await fetch(`/api/docs/${doc.id}/versions/${versionNo}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_id: user?.nip || "", actor_name: user?.name || "" }),
      });
      if (!r.ok) throw new Error();
      const d = await r.json();
      showToast(d.message);
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      onBack();
    } catch { showToast("Gagal memulihkan versi"); }
  };

  const handleUploadVersion = async () => {
    if (!versionFile || !doc?.id) return;
    setVersionUploading(true);
    setVersionProgress(10);
    try {
      var GAS_URL = "https://script.google.com/macros/s/AKfycbyjrDE_5NnsTsKSyRvEwLLMJH3lWeGsg7jpM44btardExAFX1Vxvp246pazjQdH4UL5/exec";
      var isSmall = versionFile.size <= 30 * 1024 * 1024;
      var pageCount = 0;
      if (/\.pdf$/i.test(versionFile.name)) {
        try {
          var d = await versionFile.arrayBuffer();
          var pdfDoc = await pdfjsLib.getDocument({ data: d }).promise;
          pageCount = pdfDoc.numPages;
          pdfDoc.destroy();
        } catch { /* ignore */ }
      }

      var fileUrl;
      if (isSmall) {
        var base64 = await new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(reader.result.split(",")[1]); };
          reader.onerror = function () { reject(new Error("Gagal baca file")); };
          reader.readAsDataURL(versionFile);
        });
        var res = await new Promise(function (resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open("POST", GAS_URL); xhr.timeout = 300000;
          xhr.onload = function () { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Response bukan JSON")); } };
          xhr.onerror = function () { reject(new Error("Network error")); };
          xhr.send(JSON.stringify({ action: "direct", file: base64, filename: versionFile.name, mimeType: versionFile.type, title: doc.title + " v" + ((doc.versi||1)+1), type: doc.type, sector: doc.sector, year: doc.year, uploader: user.name, group: true }));
        });
        fileUrl = res.fileUrl;
      } else {
        // Resumable — use same flow as upload
        var initRes = await new Promise(function (resolve, reject) {
          var xhr = new XMLHttpRequest(); xhr.open("POST", GAS_URL); xhr.timeout = 30000;
          xhr.onload = function () { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Init failed")); } };
          xhr.onerror = function () { reject(new Error("Network error")); };
          xhr.send(JSON.stringify({ action: "initiate", filename: versionFile.name, mimeType: versionFile.type, fileSize: versionFile.size }));
        });
        var uploadUrl = initRes.uploadUrl;
        var CHUNK = 5 * 1024 * 1024, start = 0, fid = null;
        while (start < versionFile.size) {
          var end = Math.min(start + CHUNK, versionFile.size);
          var chunk = versionFile.slice(start, end);
          var cb64 = await new Promise(function (r, j) { var rd = new FileReader(); rd.onload = function () { r(rd.result.split(",")[1]); }; rd.onerror = j; rd.readAsDataURL(chunk); });
          var cr = await new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest(); xhr.open("POST", GAS_URL); xhr.timeout = 300000;
            xhr.onload = function () { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Chunk failed")); } };
            xhr.onerror = function () { reject(new Error("Network error")); };
            xhr.send(JSON.stringify({ action: "chunk", uploadUrl: uploadUrl, chunkBase64: cb64, start: start, end: end, totalSize: versionFile.size, mimeType: versionFile.type }));
          });
          if (cr.status === 200 || cr.status === 201) { fid = cr.fileId; break; }
          setVersionProgress(Math.round((end / versionFile.size) * 80));
          start = end;
        }
        var finRes = await new Promise(function (resolve, reject) {
          var xhr = new XMLHttpRequest(); xhr.open("POST", GAS_URL); xhr.timeout = 30000;
          xhr.onload = function () { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Finalize failed")); } };
          xhr.onerror = function () { reject(new Error("Network error")); };
          xhr.send(JSON.stringify({ action: "finalize", fileId: fid, title: doc.title + " v" + ((doc.versi||1)+1), type: doc.type, sector: doc.sector, year: doc.year, uploader: user.name, group: true }));
        });
        fileUrl = finRes.fileUrl;
      }

      setVersionProgress(90);
      var vr = await fetch(`/api/docs/${doc.id}/versions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fileUrl, ukuran: formatBytes(versionFile.size), pages: pageCount, note: versionNote, uploader_name: user.name, uploader_id: user.nip || "" }),
      });
      if (!vr.ok) throw new Error();
      var vd = await vr.json();
      showToast(vd.message);
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      setShowVersionModal(false);
      setVersionFile(null); setVersionNote(""); setVersionProgress(0);
      onBack();
    } catch (e) { showToast("Gagal mengunggah versi baru"); }
    setVersionUploading(false);
  };

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.3, letterSpacing: "-0.02em" }}><HighlightText text={doc.title} query={""} /></h1>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <Badge label={doc.status} colors={STATUS_COLOR[doc.status]} />
              {doc.versi > 1 && <span style={{ fontSize: 12, fontWeight: 700, color: T.primary, background: T.primaryLight, border: `1px solid ${T.primaryRing}`, borderRadius: 4, padding: "2px 8px" }}>v{doc.versi}</span>}
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
            <button onClick={() => onPreview && onPreview(doc)} style={{ ...btnBase, padding: "10px 16px", background: T.card, color: T.textSecondary, fontSize: 13 }}>
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
              onMouseEnter={e => { e.currentTarget.style.background = doc.publik ? T.successHover : T.primaryLight; }}
              onMouseLeave={e => { e.currentTarget.style.background = doc.publik ? T.successBg : T.primaryLight; }}>
              <Icon name="world" size={14} /> {doc.publik ? "✓ Dipublikasikan" : "Publikasikan"}
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={() => {
                setEditForm({ judul: doc.title || doc.judul, kategori: doc.sector || doc.kategori, tipe: doc.type || doc.tipe, bidang: doc.bidang || "", desc: doc.desc || "", tags: Array.isArray(doc.tags) ? doc.tags.join(", ") : (doc.tags || ""), nomor: doc.nomorDokumen || "", tanggal: doc.tanggalDokumen || "", fileType: doc.fileType || "" });
                setEditing(true);
              }} style={{ ...btnBase, padding: "10px 16px", fontSize: 13, background: T.card, color: T.textSecondary, border: `1.5px solid ${T.border}` }}
                onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.card; }}>
                <Icon name="edit" size={14} /> Edit
              </button>
              <button onClick={() => onDelete && onDelete(doc)} style={{ ...btnBase, padding: "10px 16px", fontSize: 13, background: T.dangerBg, color: T.danger, border: `1.5px solid ${T.dangerBorder}` }}
                onMouseEnter={e => { e.currentTarget.style.background = T.dangerHover; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.dangerBg; }}>
                <Icon name="trash" size={14} /> Hapus
              </button>
            </>
          )}
        </div>
      </div>

      {/* Rejected Banner */}
      {doc.status === "Ditolak" && doc.reviewNote && (
        <div style={{ ...cardStyle, padding: isMobile ? 16 : 20, background: T.dangerBg, border: `1.5px solid ${T.dangerBorder}`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <Icon name="x" size={18} style={{ color: T.danger, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.danger, marginBottom: 4 }}>Dokumen Ditolak</div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{doc.reviewNote}</div>
              {(user.role === "Uploader" || user.role === "Admin") && (
                <button onClick={() => { fetch(`/api/docs/${doc.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Menunggu Review", note: "Diajukan ulang", actor_id: user.nip || "", actor_name: user.name }) }).then(r => r.ok ? r.json() : Promise.reject()).then(() => { queryClient.invalidateQueries({ queryKey: ['docs'] }); showToast("Berhasil diajukan ulang"); onBack(); }).catch(() => showToast("Gagal mengajukan ulang")); }}
                  style={{ ...btnBase, marginTop: 12, padding: "8px 16px", fontSize: 13, background: T.primary, color: "#fff" }}>
                  <Icon name="refresh" size={13} /> Ajukan Ulang
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Preview + Metadata */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 20, alignItems: "stretch" }}>
        {/* ── Preview Pane ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, height: sidebarH || 500, overflow: "hidden" }}>
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
                style={{ maxWidth: "100%", maxHeight: 500, borderRadius: T.radius, objectFit: "contain" }}
              />
            </div>
          )}

          {!isImage && canPreviewInline && (
            <div style={{ ...cardStyle, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <iframe
                key={active.url || doc.url}
                src={previewUrl}
                title={pTitle}
                style={{ width: "100%", flex: 1, border: "none", borderRadius: `${T.radius}px ${T.radius}px 0 0` }}
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
        <div ref={sidebarRef} style={{ display: "flex", flexDirection: "column", gap: 14, position: isMobile ? "static" : "sticky", top: 20 }}>
          {/* Metadata Card */}
          <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 16px" }}>Metadata Dokumen</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Jenis Dokumen", doc.type],
                ["Tipe File",     doc.fileType || "—"],
                ["Sektor",        doc.sector],
                ["Bidang",        doc.bidang || "—"],
                ["Tahun",         doc.year],
                ["Nomor Dokumen", doc.nomorDokumen || "—"],
                ["Tanggal Dokumen", doc.tanggalDokumen || "—"],
                ["Versi",         doc.versi > 1 ? `v${doc.versi}` : "—"],
                ["Ukuran File",   doc.size],
                ["Jumlah Halaman",`${doc.pages} halaman`],
                ["Tanggal Upload", doc.uploadDate],
                ["Diunggah oleh", doc.uploader],
                ["Di-review oleh",doc.reviewedBy],
                ["Status Indeks", doc.indexStatus === "ok" ? "Terindeks" : doc.indexStatus === "needs_ocr" ? "PDF hasil pindai" : doc.indexStatus === "unsupported" ? "Tidak didukung" : "Belum diindeks"],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: "10px 14px", background: T.bg, borderRadius: T.radius, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: k === "Status Indeks" && doc.indexStatus === "ok" ? "#16a34a" : k === "Status Indeks" && doc.indexStatus === "needs_ocr" ? "#d97706" : T.text }}>{v}</div>
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
                <button onClick={() => { if (!catatan.trim()) { showToast("Catatan wajib diisi untuk persetujuan"); return; } onApprove(doc, catatan); setCatatan(""); }} style={{ ...btnBase, width: "100%", padding: "11px 16px", background: T.primary, color: "#fff", fontSize: 13, boxShadow: "0 1px 3px rgba(37,99,235,0.3)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.primaryHover; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.primary; e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.3)"; }}>
                  <Icon name="check" size={14} /> Setujui & Arsipkan
                </button>
                <button onClick={() => { if (!catatan.trim() || catatan.trim().length < 5) { showToast("Penolakan wajib diisi catatan (minimal 5 karakter)"); return; } onReject(doc, catatan); setCatatan(""); }} style={{ ...btnBase, width: "100%", padding: "11px 16px", background: T.dangerBg, color: T.danger, fontSize: 13, border: `1px solid ${T.dangerBorder}` }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.dangerHover; e.currentTarget.style.borderColor = "#F87171"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.dangerBg; e.currentTarget.style.borderColor = T.dangerBorder; }}>
                  <Icon name="x" size={14} /> Tolak Dokumen
                </button>
              </div>
            </div>
          )}

          {/* Version History */}
          {versions.length > 0 && (
            <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 14px" }}>Riwayat Versi</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {versions.map((v, i) => (
                  <div key={v.version_no} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: v.active ? T.primaryLight : T.bg, borderRadius: T.radius, border: `1px solid ${v.active ? T.primary + "30" : T.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: v.active ? T.primary : T.text, minWidth: 28 }}>v{v.version_no}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.uploader_name || "—"} · {v.note || "—"}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{v.created_at || "Aktif"}</div>
                    </div>
                    {v.active && <span style={{ fontSize: 10, fontWeight: 600, color: T.primary, background: "#fff", border: `1px solid ${T.primary}30`, borderRadius: 4, padding: "2px 6px" }}>AKTIF</span>}
                    {!v.active && (user?.role === "Admin" || user?.nip === doc.uploaderId) && (
                      <button onClick={() => handleRestoreVersion(v.version_no)} style={{ fontSize: 11, padding: "4px 10px", background: T.bg, color: T.primary, border: `1px solid ${T.border}`, borderRadius: 6, cursor: "pointer" }}>Pulihkan</button>
                    )}
                  </div>
                ))}
              </div>
              {/* Upload New Version Button */}
              {(user?.role === "Admin" || user?.nip === doc.uploaderId) && !Array.isArray(doc.files) && (
                <button onClick={() => setShowVersionModal(true)} style={{ ...btnBase, width: "100%", padding: "10px 16px", background: T.bg, color: T.primary, border: `1.5px dashed ${T.primary}`, fontSize: 13, marginTop: 12 }}>
                  <Icon name="upload" size={14} /> Unggah Versi Baru
                </button>
              )}
            </div>
          )}

          {/* Status History */}
          <div style={{ ...cardStyle, padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Riwayat Status</h3>
            {history.length === 0 ? (
              <div style={{ fontSize: 13, color: T.textMuted }}>Belum ada riwayat</div>
            ) : history.map((h, i) => (
              <div key={h.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < history.length - 1 ? 14 : 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: 99, background: h.action === 'upload' ? T.primaryLight : h.action === 'approve' ? T.primary : h.action === 'reject' ? T.danger : T.warningBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Icon name={h.action === 'upload' ? 'upload' : h.action === 'approve' ? 'check' : h.action === 'reject' ? 'x' : 'refresh'} size={11} style={{ color: "#fff" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                    {h.action === 'upload' ? 'Diunggah' : h.action === 'approve' ? 'Disetujui' : h.action === 'reject' ? 'Ditolak' : h.action === 'resubmit' ? 'Diajukan Ulang' : h.action === 'version' ? 'Versi Baru' : h.action}
                    {h.actor_name && <span style={{ fontWeight: 400, color: T.textMuted }}> oleh {h.actor_name}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{h.created_at}</div>
                  {h.note && <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2, fontStyle: "italic" }}>"{h.note}"</div>}
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
              { key: "fileType", label: "Tipe File", type: "select", opts: ["PDF", "Word", "Excel", "PowerPoint", "Lainnya"] },
              { key: "bidang", label: "Bidang", type: "select", opts: ["Umum", ...bidangs.map(b => b.nama || b.name || b)] },
              { key: "nomor", label: "Nomor Dokumen", type: "text" },
              { key: "tanggal", label: "Tanggal Dokumen", type: "date" },
              { key: "desc", label: "Deskripsi", type: "textarea" },
              { key: "tags", label: "Tags (pisah koma)", type: "text" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, display: "block", marginBottom: 6 }}>{f.label}</label>
                {f.type === "select" ? (
                  <select value={editForm[f.key]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: T.bg, color: T.text, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = T.primary}
                    onBlur={e => e.target.style.borderColor = T.border}>
                    <option value="">Pilih {f.label}</option>
                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea value={editForm[f.key]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    rows={3}
                    style={{ width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: T.bg, color: T.text, outline: "none", boxSizing: "border-box", resize: "vertical" }}
                    onFocus={e => e.target.style.borderColor = T.primary}
                    onBlur={e => e.target.style.borderColor = T.border} />
                ) : (
                  <input type={f.type === "date" ? "date" : "text"} value={editForm[f.key]} onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", fontSize: 14, borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: T.bg, color: T.text, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = T.primary}
                    onBlur={e => e.target.style.borderColor = T.border} />
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "10px 16px", fontSize: 14, fontWeight: 600, borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: T.bg, color: T.textSecondary, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
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

      {/* Version Upload Modal */}
      {showVersionModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowVersionModal(false); setVersionFile(null); setVersionNote(""); } }}>
          <div style={{ background: T.card, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", width: "100%", maxWidth: 440, padding: isMobile ? 20 : 28, fontFamily: T.font }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: "0 0 20px" }}>Unggah Versi Baru</h3>
            <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 14 }}>
              Versi aktif saat ini: <b>v{doc.versi || 1}</b>. File versi baru akan menggantikan file aktif, versi lama tetap tersimpan di riwayat.
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Pilih File</label>
              <input type="file" onChange={e => setVersionFile(e.target.files?.[0] || null)}
                style={{ width: "100%", fontSize: 13, color: T.text }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Catatan Revisi</label>
              <textarea value={versionNote} onChange={e => setVersionNote(e.target.value)} rows={3} placeholder="Jelaskan perubahan pada versi ini..."
                style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${T.border}`, borderRadius: T.radius, fontSize: 13, fontFamily: T.font, resize: "vertical", boxSizing: "border-box", outline: "none", color: T.text }} />
            </div>
            {versionUploading && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 6, background: T.border, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${versionProgress}%`, background: T.primary, borderRadius: 99, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, textAlign: "center" }}>{versionProgress}%</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowVersionModal(false); setVersionFile(null); setVersionNote(""); }} style={{ flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600, borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer" }}>Batal</button>
              <button onClick={handleUploadVersion} disabled={!versionFile || versionUploading} style={{ flex: 1, padding: "10px 16px", fontSize: 13, fontWeight: 600, borderRadius: T.radius, border: "none", background: (!versionFile || versionUploading) ? T.border : T.primary, color: "#fff", cursor: (!versionFile || versionUploading) ? "default" : "pointer" }}>
                {versionUploading ? "Mengunggah..." : "Unggah"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
