import { Icon, Badge } from "./ui.jsx";
import { DOC_TYPES, SECTORS, STATUS_COLOR } from "../data.js";

export default function Dashboard({ docs, onNav }) {
  const archived  = docs.filter(d => d.status === "Diarsipkan").length;
  const pending   = docs.filter(d => d.status !== "Diarsipkan" && d.status !== "Ditolak").length;
  const rejected  = docs.filter(d => d.status === "Ditolak").length;

  const byType = DOC_TYPES.slice(1)
    .map(t => ({ type: t, count: docs.filter(d => d.type === t).length }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const bySector = SECTORS.slice(1)
    .map(s => ({ sector: s, count: docs.filter(d => d.sector === s).length }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const recent = [...docs].sort((a, b) => b.id - a.id).slice(0, 5);

  const maxType   = Math.max(...byType.map(x => x.count), 1);
  const maxSector = Math.max(...bySector.map(x => x.count), 1);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Dashboard</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
          Ringkasan arsip dokumen perencanaan bidang ekonomi
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Dokumen",    value: docs.length, color: "#1a7a4a", icon: "archive" },
          { label: "Diarsipkan",       value: archived,    color: "#2e7d32", icon: "check"   },
          { label: "Menunggu Proses",  value: pending,     color: "#f57f17", icon: "bell"    },
          { label: "Ditolak",          value: rejected,    color: "#c62828", icon: "x"       },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e8e8e8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>{s.label}</div>
              <div style={{ width: 32, height: 32, background: s.color + "18", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={s.icon} size={15} style={{ color: s.color }} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a", marginBottom: 14 }}>Dokumen per Jenis</div>
          {byType.map((x, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#444" }}>{x.type}</span>
                <span style={{ fontWeight: 600, color: "#1a7a4a" }}>{x.count}</span>
              </div>
              <div style={{ height: 6, background: "#f0f0f0", borderRadius: 99 }}>
                <div style={{ height: "100%", background: "#1a7a4a", borderRadius: 99, width: `${(x.count / maxType) * 100}%`, transition: "width .5s" }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a", marginBottom: 14 }}>Dokumen per Sektor</div>
          {bySector.map((x, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#444" }}>{x.sector}</span>
                <span style={{ fontWeight: 600, color: "#0d5c2e" }}>{x.count}</span>
              </div>
              <div style={{ height: 6, background: "#f0f0f0", borderRadius: 99 }}>
                <div style={{ height: "100%", background: "#0d5c2e", borderRadius: 99, width: `${(x.count / maxSector) * 100}%`, transition: "width .5s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent docs */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a" }}>Dokumen Terbaru</div>
          <button onClick={() => onNav("dokumen")} style={{ fontSize: 12, color: "#1a7a4a", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Lihat semua →
          </button>
        </div>
        {recent.map((d, i) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < recent.length - 1 ? "1px solid #f5f5f5" : "none" }}>
            <div style={{ width: 36, height: 36, background: "#f0f7f2", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="file" size={16} style={{ color: "#1a7a4a" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a3a2a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{d.type} · {d.year} · {d.uploader}</div>
            </div>
            <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
          </div>
        ))}
      </div>
    </div>
  );
}
