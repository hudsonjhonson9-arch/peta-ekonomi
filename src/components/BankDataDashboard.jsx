import { useState, useContext } from "react";
import { Icon } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";

export default function BankDataDashboard() {
  const { T } = useContext(ThemeContext);
  const [data, setData] = useState(null);

  if (!data) {
    fetch('/api/indikator/tampil').then(r => r.json()).then(setData).catch(() => {});
    return null;
  }

  if (data.length === 0) return null;

  const allYears = [...new Set(data.flatMap(i => i.nilai.map(n => n.tahun)))].sort();

  return (
    <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}`, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <Icon name="chart" size={14} style={{ color: T.primary }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Bank Data</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `2px solid ${T.border}`, color: T.textSecondary, fontWeight: 600, whiteSpace: "nowrap" }}>Indikator</th>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `2px solid ${T.border}`, color: T.textSecondary, fontWeight: 600, whiteSpace: "nowrap" }}>Satuan</th>
              {allYears.map(y => (
                <th key={y} style={{ textAlign: "right", padding: "8px 10px", borderBottom: `2px solid ${T.border}`, color: T.textSecondary, fontWeight: 600, whiteSpace: "nowrap" }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(i => (
              <tr key={i.id}>
                <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, fontWeight: 500, color: T.text }}>{i.nama}</td>
                <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontSize: 12 }}>{i.satuan}</td>
                {allYears.map(y => {
                  const n = i.nilai.find(v => v.tahun === y);
                  return (
                    <td key={y} style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, textAlign: "right", fontWeight: 600, color: T.primary }}>
                      {n ? n.nilai : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
