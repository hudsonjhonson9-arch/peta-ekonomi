import { useState, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";

export default function BankDataDashboard() {
  const { T } = useContext(ThemeContext);
  const { data: bidang = [] } = useQuery({
    queryKey: ['bankdata-dashboard'],
    queryFn: () => fetch('/api/bankdata').then(r => r.json())
  });
  const [expanded, setExpanded] = useState({});

  if (bidang.length === 0) return null;

  const totalDetail = bidang.reduce((s, b) =>
    s + b.opds.reduce((s2, o) =>
      s2 + o.ikus.reduce((s3, i) =>
        s3 + i.ikks.reduce((s4, k) => s4 + k.details.length, 0), 0), 0), 0);

  if (totalDetail === 0) return null;

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}`, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name="chart" size={14} style={{ color: T.primary }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Bank Data</span>
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 14 }}>Data per Bidang → OPD → IKU → IKK → Indikator</div>

      {bidang.map(b => (
        <div key={b.id} style={{ border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: T.surfaceHover, cursor: "pointer" }}
            onClick={() => toggle(`b${b.id}`)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="building" size={14} style={{ color: T.primary }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{b.nama}</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>({b.opds.length} OPD)</span>
            </div>
            <Icon name="chevronRight" size={13} style={{ color: T.textMuted, transform: expanded[`b${b.id}`] ? "rotate(90deg)" : "", transition: "transform .2s" }} />
          </div>

          {expanded[`b${b.id}`] && (
            <div style={{ padding: "8px 12px" }}>
              {b.opds.map(o => (
                <div key={o.id} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <Icon name="building" size={13} style={{ color: T.textMuted }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{o.nama}</span>
                  </div>
                  {o.ikus.map(i => (
                    <div key={i.id} style={{ margin: "6px 0 0 16px", borderLeft: `1px solid ${T.border}`, paddingLeft: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>IKU · {i.nama}</div>
                      {i.ikks.map(k => (
                        <div key={k.id} style={{ margin: "6px 0 0 14px", borderLeft: `1px solid ${T.border}`, paddingLeft: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>IKK · {k.nama}</div>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 8 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Indikator</th>
                                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Data</th>
                                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Aspek</th>
                                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Sumber Data</th>
                              </tr>
                            </thead>
                            <tbody>
                              {k.details.map(d => (
                                <tr key={d.id}>
                                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, fontWeight: 500, color: T.text }}>{d.indikator}</td>
                                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>{d.data ?? "—"}</td>
                                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>{d.aspek ?? "—"}</td>
                                  <td style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>{d.sumber_data ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}