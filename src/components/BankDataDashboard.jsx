import { useState } from "react";
import { Icon } from "./ui.jsx";

export default function BankDataDashboard() {
  const [data, setData] = useState(null);

  if (!data) {
    fetch('/api/indikator/tampil').then(r => r.json()).then(setData).catch(() => {});
    return null;
  }

  if (data.length === 0) return null;

  const allYears = [...new Set(data.flatMap(i => i.nilai.map(n => n.tahun)))].sort();

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e8e8e8", marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <Icon name="chart" size={14} style={{ color: "#2563EB" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Bank Data</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e8e8e8", color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>Indikator</th>
              <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e8e8e8", color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>Satuan</th>
              {allYears.map(y => (
                <th key={y} style={{ textAlign: "right", padding: "8px 10px", borderBottom: "2px solid #e8e8e8", color: "#555", fontWeight: 600, whiteSpace: "nowrap" }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(i => (
              <tr key={i.id}>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f5f5f5", fontWeight: 500, color: "#0F172A" }}>{i.nama}</td>
                <td style={{ padding: "8px 10px", borderBottom: "1px solid #f5f5f5", color: "#888", fontSize: 12 }}>{i.satuan}</td>
                {allYears.map(y => {
                  const n = i.nilai.find(v => v.tahun === y);
                  return (
                    <td key={y} style={{ padding: "8px 10px", borderBottom: "1px solid #f5f5f5", textAlign: "right", fontWeight: 600, color: "#2563EB" }}>
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
