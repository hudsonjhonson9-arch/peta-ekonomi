import { useState, useMemo } from "react";
import { Icon, Badge } from "./ui.jsx";
import { DOC_TYPES, SECTORS, YEARS, STATUS_LIST, STATUS_COLOR } from "../data.js";

// ─── DAFTAR DOKUMEN ───────────────────────────────────────────────────────────
export function DocList({ docs, onView }) {
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
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Dokumen</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{filtered.length} dokumen ditemukan</div>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e8e8e8", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <Icon name="search" size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari judul, jenis, atau tag..."
              style={{ width: "100%", padding: "8px 10px 8px 30px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <select value={filterType}   onChange={e => setFilterType(e.target.value)}   style={selStyle}>{DOC_TYPES.map(t  => <option key={t}>{t}</option>)}</select>
          <select value={filterSector} onChange={e => setFilterSector(e.target.value)} style={selStyle}>{SECTORS.map(s   => <option key={s}>{s}</option>)}</select>
          <select value={filterYear}   onChange={e => setFilterYear(e.target.value)}   style={selStyle}>{YEARS.map(y     => <option key={y}>{y}</option>)}</select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selStyle}>{STATUS_LIST.map(s => <option key={s}>{s}</option>)}</select>
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
            style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", border: "1px solid #e8e8e8", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "box-shadow .15s" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
          >
            <div style={{ width: 44, height: 44, background: "#f0f7f2", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="file" size={20} style={{ color: "#1a7a4a" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a" }}>{d.title}</span>
                <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
              </div>
              <div style={{ fontSize: 12, color: "#888" }}>
                {d.type} · {d.sector} · {d.year} · {d.size} · {d.pages} hal. · <b>{d.uploader}</b> · {d.uploadDate}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                {d.tags.map(t => (
                  <span key={t} style={{ fontSize: 10, color: "#1a7a4a", background: "#e8f5e9", padding: "2px 7px", borderRadius: 99 }}>{t}</span>
                ))}
              </div>
            </div>
            <Icon name="chevronRight" size={16} style={{ color: "#ccc", flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DETAIL DOKUMEN ───────────────────────────────────────────────────────────
export function DocDetail({ doc, onBack, onApprove, onReject, onDownload, user }) {
  const [catatan, setCatatan] = useState("");

  const canApprove =
    (user.role === "Reviewer" || user.role === "Admin") &&
    (doc.status === "Menunggu Review" || doc.status === "Menunggu Persetujuan");

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
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#1a7a4a", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 20, padding: 0 }}
      >
        ← Kembali ke Daftar Dokumen
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>
        {/* Left column */}
        <div>
          {/* Header */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1a3a2a", marginBottom: 8 }}>{doc.title}</div>
                <Badge label={doc.status} colors={STATUS_COLOR[doc.status]} />
              </div>
              <div style={{ width: 52, height: 52, background: "#f0f7f2", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="file" size={24} style={{ color: "#1a7a4a" }} />
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, marginBottom: 14 }}>{doc.desc}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {doc.tags.map(t => (
                <span key={t} style={{ fontSize: 11, color: "#1a7a4a", background: "#e8f5e9", padding: "3px 9px", borderRadius: 99 }}>
                  <Icon name="tag" size={10} style={{ marginRight: 3, verticalAlign: "middle" }} />{t}
                </span>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a", marginBottom: 16 }}>Metadata Dokumen</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a", marginBottom: 12 }}>Tindakan Persetujuan</div>
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
                  style={{ flex: 1, padding: 10, background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
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
          <div style={{ background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #e8e8e8" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a3a2a", marginBottom: 12 }}>Aksi</div>
            <button
              onClick={() => onDownload(doc)}
              style={{ width: "100%", padding: "10px 12px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 8, justifyContent: "center" }}
            >
              <Icon name="download" size={14} /> Unduh Dokumen
            </button>
            <button
              style={{ width: "100%", padding: "10px 12px", background: "#f5f5f5", color: "#444", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
            >
              <Icon name="eye" size={14} /> Preview Online
            </button>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #e8e8e8" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a3a2a", marginBottom: 12 }}>Riwayat Status</div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: 50, background: s.done ? "#1a7a4a" : "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {s.done && <Icon name="check" size={10} style={{ color: "#fff" }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: s.done ? "#1a3a2a" : "#aaa" }}>{s.label}</div>
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
