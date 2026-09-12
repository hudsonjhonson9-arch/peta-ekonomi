import { useState, useMemo } from "react";
import { Icon, Badge } from "./ui.jsx";
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
export function DocDetail({ doc, onBack, onApprove, onReject, onDownload, onPreview, onTogglePublik, user }) {
  const { isMobile } = useResponsive();
  const [catatan, setCatatan] = useState("");

  const canApprove =
    (user.role === "Reviewer" || user.role === "Admin") &&
    (doc.status === "Menunggu Review" || doc.status === "Menunggu Persetujuan");

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.title) || (doc.url && /\.(jpg|jpeg|png|gif|webp)/i.test(doc.url));

  const steps = [
    { label: "Diunggah",               done: true,                        date: doc.uploadDate },
    { label: "Review Kabid",           done: doc.reviewedBy !== "—",      date: doc.reviewedBy !== "—" ? "Selesai" : "Menunggu" },
    { label: "Persetujuan Kepala",     done: doc.status === "Diarsipkan", date: doc.status === "Diarsipkan" ? "Disetujui" : doc.status === "Ditolak" ? "Ditolak" : "Menunggu" },
    { label: "Diarsipkan",             done: doc.status === "Diarsipkan", date: doc.status === "Diarsipkan" ? "✓" : "—" },
  ];

  return (
    <div>
      <button
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#2563EB", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0 }}
      >
        ← Kembali ke Daftar Dokumen
      </button>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 16, alignItems: "start" }}>
        {/* Left column */}
        <div>
          {/* Header */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>{doc.title}</div>
                <Badge label={doc.status} colors={STATUS_COLOR[doc.status]} />
              </div>
              <div style={{ width: 52, height: 52, background: "#EFF6FF", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="file" size={24} style={{ color: "#2563EB" }} />
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, marginBottom: 14 }}>{doc.desc}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {doc.tags.map(t => (
                <span key={t} style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", padding: "3px 9px", borderRadius: 99 }}>
                  <Icon name="tag" size={10} style={{ marginRight: 3, verticalAlign: "middle" }} />{t}
                </span>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>Metadata Dokumen</div>
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
                <div key={k} style={{ padding: "10px 12px", background: "#f9f9f9", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Approval panel */}
          {canApprove && (
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Tindakan Persetujuan</div>
              <textarea
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Catatan review (opsional)..."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none", marginBottom: 12 }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => onApprove(doc)}
                  style={{ flex: 1, padding: 10, background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Icon name="check" size={14} /> Setujui & Arsipkan
                </button>
                <button
                  onClick={() => onReject(doc)}
                  style={{ flex: 1, padding: 10, background: "#fff", color: "#c62828", border: "1.5px solid #c62828", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Icon name="x" size={14} /> Tolak Dokumen
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {isImage && doc.url && (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
              <img src={doc.url} alt={doc.title} style={{ width: "100%", display: "block", maxHeight: 300, objectFit: "contain", background: "#f9f9f9" }} />
            </div>
          )}
          <div style={{ background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #e8e8e8" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Aksi</div>
            <button
              onClick={() => onDownload(doc)}
              style={{ width: "100%", padding: "10px 12px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 8, justifyContent: "center" }}
            >
              <Icon name="download" size={14} /> Unduh Dokumen
            </button>
            <button
              onClick={() => onPreview && onPreview(doc)}
              style={{ width: "100%", padding: "10px 12px", background: "#f5f5f5", color: "#444", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 8 }}
            >
              <Icon name="eye" size={14} /> Preview Online
            </button>
            {doc.status === "Diarsipkan" && (
              <button
                onClick={() => onTogglePublik && onTogglePublik(doc)}
                style={{ width: "100%", padding: "10px 12px", background: doc.publik ? "#EFF6FF" : "#fff", color: doc.publik ? "#2e7d32" : "#1565c0", border: doc.publik ? "1.5px solid #2e7d32" : "1.5px solid #1565c0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
              >
                <Icon name="world" size={14} /> {doc.publik ? "✓ Dipublikasikan ke Publik" : "Publikasikan ke Publik"}
              </button>
            )}
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #e8e8e8" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Riwayat Status</div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: 50, background: s.done ? "#2563EB" : "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {s.done && <Icon name="check" size={10} style={{ color: "#fff" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: s.done ? "#0F172A" : "#aaa" }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "#bbb" }}>{s.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
