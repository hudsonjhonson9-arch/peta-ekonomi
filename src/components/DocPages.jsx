import { useState, useMemo } from "react";
import { Icon, Badge, GoogleDriveEmbed, isGDriveUrl } from "./ui.jsx";
import { YEARS, STATUS_LIST, STATUS_COLOR } from "../data.js";
import useResponsive from "../useResponsive.js";

// ─── DAFTAR DOKUMEN ───────────────────────────────────────────────────────────
export function DocList({ docs, onView, categories = [], sectors = [] }) {
  const { isMobile } = useResponsive();
  const [showFilter, setShowFilter] = useState(!isMobile);
  const [search,       setSearch]       = useState("");
  const [filterType,   setFilterType]   = useState("Semua Jenis");
  const [filterSector, setFilterSector] = useState("Semua Sektor");
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
        (filterYear   === "Semua Tahun"   || d.year   === filterYear)   &&
        (filterStatus === "Semua Status"  || d.status === filterStatus)
      );
    });
  }, [docs, search, filterType, filterSector, filterYear, filterStatus]);

  const selStyle = {
    fontSize: 12, padding: "7px 10px",
    border: "1.5px solid #e0e0e0", borderRadius: 8,
    background: "#fff", color: "#333", cursor: "pointer", outline: "none",
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Dokumen</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{filtered.length} dokumen ditemukan</div>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 12 : 16, border: "1px solid #e8e8e8", marginBottom: 16 }}>
        {isMobile && (
          <div
            onClick={() => setShowFilter(v => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: showFilter ? 10 : 0 }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#444" }}>Filter Pencarian</span>
            <Icon name={showFilter ? "x" : "filter"} size={16} style={{ color: "#999" }} />
          </div>
        )}
        <div style={{ display: isMobile ? (showFilter ? "flex" : "none") : "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 0 }}>
            <Icon name="search" size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari judul..."
              style={{ width: "100%", padding: "8px 10px 8px 30px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: isMobile ? 16 : 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {(!isMobile || showFilter) && (
            <>
              <select value={filterType}   onChange={e => setFilterType(e.target.value)}   style={selStyle}>
                <option value="Semua Jenis">Jenis</option>
                {categories.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
              </select>
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)} style={selStyle}>
                <option value="Semua Sektor">Semua Sektor</option>
                {sectors.map(s => <option key={s.id} value={s.nama}>{s.nama}</option>)}
              </select>
              <select value={filterYear}   onChange={e => setFilterYear(e.target.value)}   style={selStyle}>{YEARS.map(y     => <option key={y}>{y}</option>)}</select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selStyle}>{STATUS_LIST.map(s => <option key={s}>{s}</option>)}</select>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#999", background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8" }}>
            <Icon name="search" size={32} style={{ color: "#ccc", marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Tidak ada dokumen ditemukan</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Coba ubah kata kunci atau filter</div>
          </div>
        )}
        {filtered.map(d => (
          <div
            key={d.id}
            onClick={() => onView(d)}
            style={{ background: "#fff", borderRadius: 12, padding: isMobile ? "12px 14px" : "16px 18px", border: "1px solid #e8e8e8", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "box-shadow .15s" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
          >
            <div style={{ width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, background: "#EFF6FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="file" size={isMobile ? 16 : 20} style={{ color: "#2563EB" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: "#0F172A" }}>{d.title}</span>
                <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
              </div>
              <div style={{ fontSize: isMobile ? 11 : 12, color: "#888" }}>
                {d.type} · {d.sector} · {d.year} · {d.size} · <b>{d.uploader}</b>
              </div>
            </div>
            <Icon name="chevronRight" size={isMobile ? 14 : 16} style={{ color: "#ccc", flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DETAIL DOKUMEN ───────────────────────────────────────────────────────────
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
  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  surfaceHover: "#F8FAFC",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  successHover: "#D1FAE5",
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

const cardStyle = {
  background: T.card,
  borderRadius: T.radiusLg,
  border: `1px solid ${T.border}`,
  boxShadow: T.shadowSm,
};

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
      <button onClick={onBack} style={{ ...btnBase, background: "transparent", color: T.primary, fontSize: 13, padding: "6px 0", marginBottom: 20 }}
        onMouseEnter={e => e.currentTarget.style.color = T.primaryHover}
        onMouseLeave={e => e.currentTarget.style.color = T.primary}>
        ← Kembali ke Daftar
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
