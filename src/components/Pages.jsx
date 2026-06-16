import { useState } from "react";
import { Icon, Badge } from "./ui.jsx";
import { STATUS_COLOR, ROLE_COLOR } from "../data.js";

// ─── PENCARIAN ────────────────────────────────────────────────────────────────
export function Pencarian({ docs, onView }) {
  const [q,        setQ]        = useState("");
  const [results,  setResults]  = useState([]);
  const [searched, setSearched] = useState(false);

  const doSearch = (query = q) => {
    const ql = query.toLowerCase().trim();
    if (!ql) return;
    const r = docs.filter(d =>
      d.title.toLowerCase().includes(ql)  ||
      d.desc.toLowerCase().includes(ql)   ||
      d.type.toLowerCase().includes(ql)   ||
      d.sector.toLowerCase().includes(ql) ||
      d.tags.some(t => t.includes(ql))    ||
      d.uploader.toLowerCase().includes(ql)
    );
    setResults(r);
    setSearched(true);
  };

  const suggestions = ["RPJMD", "pariwisata", "UMKM", "kajian", "evaluasi", "pertanian", "2024"];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Pencarian Dokumen</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Cari dalam seluruh repositori dokumen</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Icon name="search" size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Ketik judul, jenis, sektor, kata kunci, atau nama pengupload..."
              style={{ width: "100%", padding: "12px 12px 12px 40px", border: "1.5px solid #1a7a4a", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            onClick={() => doSearch()}
            style={{ padding: "12px 24px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Cari
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Coba cari:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setQ(s); doSearch(s); }}
              style={{ fontSize: 12, padding: "4px 12px", background: "#f0f7f2", color: "#1a7a4a", border: "1px solid #c8e6c9", borderRadius: 99, cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {searched && (
        <div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            {results.length > 0
              ? `${results.length} dokumen ditemukan untuk "${q}"`
              : `Tidak ada dokumen untuk "${q}"`}
          </div>
          {results.map(d => (
            <div
              key={d.id}
              onClick={() => onView(d)}
              style={{ background: "#fff", borderRadius: 10, padding: 16, border: "1px solid #e8e8e8", marginBottom: 8, cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{ width: 40, height: 40, background: "#f0f7f2", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="file" size={18} style={{ color: "#1a7a4a" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a", marginBottom: 3 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{d.type} · {d.sector} · {d.year}</div>
                <div style={{ fontSize: 12, color: "#666", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.desc}</div>
              </div>
              <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", color: "#999" }}>
              <Icon name="search" size={32} style={{ color: "#ddd", marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Dokumen tidak ditemukan</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Coba kata kunci lain</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PORTAL PUBLIK ────────────────────────────────────────────────────────────
export function PortalPublik({ docs }) {
  const publik = docs.filter(d =>
    d.status === "Diarsipkan" &&
    ["RPJMD", "Renstra", "Renja", "Data Statistik", "Kajian Ekonomi"].includes(d.type)
  );

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #1a3a2a, #0d5c2e)", borderRadius: 16, padding: "32px 28px", marginBottom: 24, color: "#fff" }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Portal Dokumen Publik</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
          Akses dokumen perencanaan bidang ekonomi yang tersedia untuk publik
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
          BAPPERIDA Kabupaten Sumba Barat · NTT
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>{publik.length} dokumen tersedia untuk publik</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {publik.map(d => (
          <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #e8e8e8" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, background: "#f0f7f2", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="file" size={18} style={{ color: "#1a7a4a" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a3a2a", marginBottom: 4, lineHeight: 1.3 }}>{d.title}</div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>{d.type} · {d.year} · {d.size}</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.desc}</div>
                <button style={{ fontSize: 11, padding: "5px 12px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Icon name="download" size={11} /> Unduh
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MANAJEMEN PENGGUNA ───────────────────────────────────────────────────────
export function ManajemenPengguna({ users }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Manajemen Pengguna</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{users.length} pengguna terdaftar</div>
        </div>
        <button style={{ padding: "9px 16px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="plus" size={14} /> Tambah Pengguna
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #e8e8e8" }}>
              {["Nama", "Peran", "Unit Kerja", "Status", "Login Terakhir", "Aksi"].map(h => (
                <th key={h} style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "#666", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, background: "#f0f7f2", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1a7a4a", flexShrink: 0 }}>
                      {u.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a3a2a" }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 14px" }}><Badge label={u.role} colors={ROLE_COLOR[u.role]} /></td>
                <td style={{ padding: "12px 14px", fontSize: 12, color: "#666" }}>{u.unit}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 11, color: "#2e7d32", background: "#e8f5e9", padding: "2px 8px", borderRadius: 99 }}>{u.status}</span>
                </td>
                <td style={{ padding: "12px 14px", fontSize: 12, color: "#888" }}>{u.lastLogin}</td>
                <td style={{ padding: "12px 14px" }}>
                  <button style={{ fontSize: 11, padding: "4px 10px", background: "#f5f5f5", border: "none", borderRadius: 6, cursor: "pointer", color: "#555", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="edit" size={11} /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── AUDIT TRAIL ──────────────────────────────────────────────────────────────
const ACTION_COLOR = {
  "Upload dokumen":  "#1565c0",
  "Approve dokumen": "#2e7d32",
  "Review dokumen":  "#e65100",
  "Unduh dokumen":   "#4527a0",
  "Tolak dokumen":   "#c62828",
};

export function AuditTrail({ logs }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Audit Trail</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Riwayat semua aktivitas pada sistem</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
        {logs.map((l, i) => (
          <div key={l.id} style={{ display: "flex", gap: 14, padding: "14px 18px", borderBottom: i < logs.length - 1 ? "1px solid #f5f5f5" : "none", alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, background: "#f0f7f2", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#1a7a4a" }}>
              {l.user[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#1a3a2a", marginBottom: 3 }}>
                <b>{l.user}</b>{" "}
                <span style={{ color: ACTION_COLOR[l.action] || "#555", fontWeight: 600 }}>{l.action}</span>
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{l.doc}</div>
              <div style={{ fontSize: 11, color: "#aaa" }}>{l.time}</div>
            </div>
            <div style={{ fontSize: 11, padding: "3px 8px", background: "#f5f5f5", borderRadius: 6, color: "#888", whiteSpace: "nowrap" }}>
              {l.action.split(" ")[0]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
