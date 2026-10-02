import { useContext } from "react";
import { Icon, Badge } from "./ui.jsx";
import { STATUS_COLOR } from "../data.js";
import useResponsive from "../useResponsive.js";
import BankDataDashboard from "./BankDataDashboard.jsx";
import { PksRingkasan, DeadlineList } from "./PksRingkasan.jsx";
import { usePksTahun, usePksRingkasan, usePksDeadlineTerdekat } from "../hooks.js";
import { ThemeContext } from "../App.jsx";

// Ringkasan Kertas Kerja untuk tahun terbaru yang punya program. Query-nya
// sama dengan halaman Kertas Kerja dan React Query memakai cache per key, jadi
// pindah ke halaman itu tidak memicu request kedua.
function InfoKertasKerja({ T, onNav }) {
  const { data: tahunList = [] } = usePksTahun();
  const tahun = tahunList[0] ?? null;
  const { data: ringkasan, isLoading } = usePksRingkasan(tahun);
  const { data: deadline = [] } = usePksDeadlineTerdekat();

  const wajib = Number(ringkasan?.wajib || 0);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="checkCircle" size={15} style={{ color: T.primary }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Kertas Kerja {tahun ?? ""}</span>
        </div>
        <button onClick={() => onNav("kertas-kerja")} style={{ fontSize: 12, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          Lihat semua →
        </button>
      </div>

      {tahun == null || isLoading ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, fontSize: 12.5, color: T.textMuted }}>
          Memuat ringkasan kertas kerja…
        </div>
      ) : wajib === 0 ? (
        // 0/0 terisi membuat progress bar kosong dan angka 0% menyesatkan,
        // jadi ditulis apa adanya bahwa belum ada data.
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, fontSize: 12.5, color: T.textMuted }}>
          Belum ada periode wajib tercatat untuk tahun {tahun}.
        </div>
      ) : (
        <>
          <PksRingkasan T={T} r={ringkasan} tahun={tahun} marginBottom={16} />
          <DeadlineList T={T} deadline={deadline} max={5} marginBottom={0} />
        </>
      )}
    </div>
  );
}

export default function Dashboard({ docs, onNav, sectors = [], categories = [] }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);
  const archived  = docs.filter(d => d.status === "Diarsipkan").length;
  const pending   = docs.filter(d => d.status !== "Diarsipkan" && d.status !== "Ditolak").length;
  const rejected  = docs.filter(d => d.status === "Ditolak").length;

  const recent = [...docs].sort((a, b) => b.id - a.id).slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Dashboard</div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
          Ringkasan arsip dokumen perencanaan pembangunan
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 8 : 12, marginBottom: 24 }}>
        {[
          { label: "Total Dokumen",    value: docs.length, color: "#2563EB", icon: "archive" },
          { label: "Diarsipkan",       value: archived,    color: "#2e7d32", icon: "check"   },
          { label: "Menunggu Proses",  value: pending,     color: "#f57f17", icon: "bell"    },
          { label: "Ditolak",          value: rejected,    color: "#c62828", icon: "x"       },
        ].map((s, i) => (
          <div key={i} style={{ background: T.card, borderRadius: 12, padding: 16, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>{s.label}</div>
              <div style={{ width: 32, height: 32, background: s.color + "18", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={s.icon} size={15} style={{ color: s.color }} />
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Kertas Kerja */}
      <InfoKertasKerja T={T} onNav={onNav} />

      {/* Bank Data */}
      <BankDataDashboard />

      {/* Recent docs */}
      <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Dokumen Terbaru</div>
          <button onClick={() => onNav("dokumen")} style={{ fontSize: 12, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Lihat semua →
          </button>
        </div>
        {recent.map((d, i) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < recent.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ width: 36, height: 36, background: T.primaryLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="file" size={16} style={{ color: T.primary }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
              <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{d.type} · {d.year} · {d.uploader}</div>
            </div>
            <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
          </div>
        ))}
      </div>
    </div>
  );
}
