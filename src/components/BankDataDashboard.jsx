import { useState, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";

export default function BankDataDashboard() {
  const { T } = useContext(ThemeContext);
  const { data: tree = [] } = useQuery({
    queryKey: ['bankdata-dashboard'],
    queryFn: () => fetch('/api/bankdata').then(r => r.json())
  });
  const { data: tahunList = [] } = useQuery({
    queryKey: ['bankdata-tahun'],
    queryFn: () => fetch('/api/bankdata/tahun').then(r => r.json())
  });
  const [expanded, setExpanded] = useState({});

  const hasData = tree.some(b => b.opds.some(o =>
    o.sektorals.some(s => s.indikator.length) ||
    o.ikus.some(i => i.indikator.length || i.ikks.some(k => k.indikator.length))
  ));
  if (!hasData) return null;

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}`, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name="chart" size={14} style={{ color: T.primary }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Bank Data</span>
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 14 }}>Bidang → OPD → IKU → IKK · Data Sektoral</div>

      {tree.map(b => (
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
                <OPDView key={o.id} o={o} tahunList={tahunList} T={T} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OPDView({ o, tahunList, T }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const tahunList2 = tahunList.map(t => t.tahun);

  const oHas = o.sektorals.some(s => s.indikator.length) || o.ikus.some(i => i.indikator.length || i.ikks.some(k => k.indikator.length));
  if (!oHas) return null;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}` }}>
        <Icon name="building" size={13} style={{ color: T.textMuted }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{o.nama}</span>
      </div>

      {/* Data Sektoral */}
      {o.sektorals.map(s => (
        s.indikator.length === 0 ? null : (
          <div key={`ds${s.id}`} style={{ margin: "6px 0 0 16px", borderLeft: `1px solid ${T.border}`, paddingLeft: 12 }}>
            <SubHeader icon="chart" label="DATA SEKTORAL" name={s.nama} expanded={expanded[`ds${s.id}`]} onToggle={() => toggle(`ds${s.id}`)} T={T} />
            {expanded[`ds${s.id}`] && <ValueTable rows={s.indikator} tahunList={tahunList2} conf="sektoral" T={T} />}
          </div>
        )
      ))}

      {/* IKU */}
      {o.ikus.map(iku => (
        <div key={`iku${iku.id}`} style={{ margin: "6px 0 0 16px", borderLeft: `1px solid ${T.border}`, paddingLeft: 12 }}>
          <SubHeader icon="layers" label="IKU" name={iku.nama} expanded={expanded[`iku${iku.id}`]} onToggle={() => toggle(`iku${iku.id}`)} T={T} />
          {expanded[`iku${iku.id}`] && (
            <>
              {iku.indikator.length > 0 && <ValueTable rows={iku.indikator} tahunList={tahunList2} conf="iku" T={T} />}
              {iku.ikks.map(ikk => (
                <div key={`ikk${ikk.id}`} style={{ margin: "6px 0 0 14px", borderLeft: `1px solid ${T.border}`, paddingLeft: 12 }}>
                  <SubHeader icon="list" label="IKK" name={ikk.nama} expanded={expanded[`ikk${ikk.id}`]} onToggle={() => toggle(`ikk${ikk.id}`)} T={T} />
                  {expanded[`ikk${ikk.id}`] && ikk.indikator.length > 0 && <ValueTable rows={ikk.indikator} tahunList={tahunList2} conf="ikk" T={T} />}
                </div>
              ))}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function SubHeader({ icon, label, name, expanded, onToggle, T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0 2px", cursor: "pointer" }} onClick={onToggle}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <Icon name={icon} size={12} style={{ color: T.primary, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary }}>{label} ·</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </div>
      <Icon name="chevronRight" size={12} style={{ color: T.textMuted, transform: expanded ? "rotate(90deg)" : "", transition: "transform .2s", flexShrink: 0 }} />
    </div>
  );
}

function ValueTable({ rows, tahunList, conf, T }) {
  const confA = conf === "iku" ? { k: "target", label: "Target" } : conf === "ikk" ? { k: "capaian", label: "Capaian" } : { k: "data", label: "Data" };
  const confB = conf === "iku" ? { k: "capaian", label: "Capaian" } : conf === "ikk" ? { k: "realisasi", label: "Realisasi" } : null;
  const years = tahunList.length > 0 ? tahunList : [...new Set(rows.flatMap(r => r.nilai.map(n => n.tahun)))].sort();

  if (years.length === 0) return null;

  return (
    <div style={{ overflowX: "auto", margin: "4px 0 8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 420 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Indikator</th>
            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Aspek</th>
            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Sumber</th>
            {years.map(y => (
              <th key={y} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>
                {y}
                <div style={{ fontSize: 10, fontWeight: 500, color: T.textMuted }}>{confA.label} {confB ? "· " + confB.label : ""}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, fontWeight: 500, color: T.text }}>{r.indikator}</td>
              <td style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>{r.aspek ?? "—"}</td>
              <td style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>{r.sumber_data ?? "—"}</td>
              {years.map(y => {
                const n = r.nilai.find(v => v.tahun === y);
                const a = n && n[confA.k] !== undefined && n[confA.k] !== null ? n[confA.k] : "—";
                const b = confB && n && n[confB.k] !== undefined && n[confB.k] !== null ? n[confB.k] : null;
                return (
                  <td key={y} style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.text }}>
                    <span style={{ fontWeight: 600 }}>{a}</span>
                    {b !== null && <span style={{ color: T.textMuted, marginLeft: 4 }}> / {b}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}