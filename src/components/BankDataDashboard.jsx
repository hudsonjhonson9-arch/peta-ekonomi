import { useState, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";

export default function BankDataDashboard({ emptyMessage = null }) {
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
  const [q, setQ] = useState("");

  const searching = q.trim().length > 0;
  const nq = q.trim().toLowerCase();

  const hitIku = (i) => `${i.nama} ${i.aspek || ""} ${i.sumber_data || ""}`.toLowerCase().includes(nq);
  const hitIkk = (k) => `${k.nama} ${k.aspek || ""}`.toLowerCase().includes(nq);
  const hitSekt = (ind) => `${ind.indikator} ${ind.aspek || ""}`.toLowerCase().includes(nq);

  const shown = searching ? tree.map(b => {
    const opds = b.opds.map(o => {
      const ikus = o.ikus.map(i => {
        const ikks = (i.ikks || []).filter(hitIkk);
        if (hitIku(i)) return i;
        if (ikks.length) return { ...i, ikks };
        return null;
      }).filter(Boolean);
      const sektorals = o.sektorals.map(s => {
        const inds = s.indikator.filter(hitSekt);
        if (inds.length) return { ...s, indikator: inds };
        return null;
      }).filter(Boolean);
      if (ikus.length || sektorals.length) return { ...o, ikus, sektorals };
      return null;
    }).filter(Boolean);
    if (opds.length) return { ...b, opds };
    return null;
  }).filter(Boolean) : tree;

  const hasData = shown.some(b => b.opds.some(o =>
    o.sektorals.some(s => s.indikator.length) ||
    o.ikus.some(i => (i.ikks || []).length || (i.nilai && i.nilai.length))
  ));
  if (!hasData) {
    return emptyMessage ? (
      <div style={{ background: T.card, borderRadius: 12, padding: 40, border: `1px solid ${T.border}`, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
        {emptyMessage}
      </div>
    ) : null;
  }

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  const isOpen = (key) => searching || !!expanded[key];

  return (
    <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}`, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon name="chart" size={14} style={{ color: T.primary }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Bank Data</span>
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12 }}>Bidang → OPD → IKU (Target/Capaian) → IKK · Data Sektoral</div>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <Icon name="search" size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Cari IKU, IKK, Data Sektoral, atau aspek..."
          style={{ width: "100%", padding: "8px 12px 8px 32px", border: `1px solid ${T.inputBorder}`, borderRadius: 8, fontSize: 12.5, outline: "none", boxSizing: "border-box", background: T.inputBg, color: T.text }} />
      </div>

      {shown.map(b => (
        <div key={b.id} style={{ border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", background: T.surfaceHover, cursor: "pointer" }}
            onClick={() => toggle(`b${b.id}`)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="building" size={14} style={{ color: T.primary }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{b.nama}</span>
              <span style={{ fontSize: 11, color: T.textMuted }}>({b.opds.length} OPD)</span>
            </div>
            <Icon name="chevronRight" size={13} style={{ color: T.textMuted, transform: isOpen(`b${b.id}`) ? "rotate(90deg)" : "", transition: "transform .2s" }} />
          </div>

          {isOpen(`b${b.id}`) && (
            <div style={{ padding: "8px 12px" }}>
              {b.opds.map(o => (
                <OPDView key={o.id} o={o} tahunList={tahunList} forceOpen={searching} T={T} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OPDView({ o, tahunList, forceOpen, T }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const isOpen = (k) => forceOpen || !!expanded[k];
  const tahunList2 = tahunList.map(t => t.tahun);

  const oHas = o.sektorals.some(s => s.indikator.length) || o.ikus.some(i => (i.ikks || []).length || (i.nilai && i.nilai.length));
  if (!oHas) return null;

  // IKK kini langsung menjadi baris nilai (nama = label baris)
  const asIkkRows = (ikks) => ikks.map(k => ({ id: k.id, indikator: k.nama, aspek: k.aspek, sumber_data: k.sumber_data, nilai: k.nilai }));

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
            <SubHeader icon="chart" label="DATA SEKTORAL" name={s.nama} expanded={isOpen(`ds${s.id}`)} onToggle={() => toggle(`ds${s.id}`)} T={T} />
            {isOpen(`ds${s.id}`) && <ValueTable rows={s.indikator} tahunList={tahunList2} conf="sektoral" hideAspek T={T} />}
          </div>
        )
      ))}

      {/* IKU: nilai sendiri (target/capaian) + IKK langsung jadi baris */}
      {o.ikus.map(iku => (
        <div key={`iku${iku.id}`} style={{ margin: "6px 0 0 16px", borderLeft: `1px solid ${T.border}`, paddingLeft: 12 }}>
          <SubHeader icon="layers" label="IKU" name={iku.nama} expanded={isOpen(`iku${iku.id}`)} onToggle={() => toggle(`iku${iku.id}`)} T={T} />
          {isOpen(`iku${iku.id}`) && (
            <>
              <ValueTable rows={[{ id: iku.id, indikator: iku.nama, aspek: iku.aspek, sumber_data: iku.sumber_data, nilai: iku.nilai }]}
                tahunList={tahunList2} conf="iku" T={T} />
              {iku.ikks && iku.ikks.length > 0 && <ValueTable rows={asIkkRows(iku.ikks)} tahunList={tahunList2} conf="ikk" T={T} />}
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

function ValueTable({ rows, tahunList, conf, hideAspek, T }) {
  const confA = conf === "iku" ? { k: "target", label: "Target" } : conf === "ikk" ? { k: "capaian", label: "Capaian" } : { k: "data", label: "Data" };
  const confB = conf === "iku" ? { k: "capaian", label: "Capaian" } : conf === "ikk" ? { k: "realisasi", label: "Realisasi" } : null;
  const years = tahunList.length > 0 ? tahunList : [...new Set(rows.flatMap(r => r.nilai.map(n => n.tahun)))].sort();
  const [detail, setDetail] = useState(null); // { ind, tahun }

  if (years.length === 0) return null;

  const openDetail = (ind, tahun) => setDetail(d => (d && d.ind.id === ind.id && d.tahun === tahun ? null : { ind, tahun }));

  return (
    <div style={{ overflowX: "auto", margin: "4px 0 8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 420 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Indikator</th>
            {!hideAspek && <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Aspek</th>}
            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>Sumber</th>
            {years.map(y => (
              <th key={y} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600, cursor: "pointer" }} onClick={() => setDetail(null)}>
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
              {!hideAspek && <td style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>{r.aspek ?? "—"}</td>}
              <td style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>{r.sumber_data ?? "—"}</td>
              {years.map(y => {
                const n = r.nilai.find(v => v.tahun === y);
                const a = n && n[confA.k] !== undefined && n[confA.k] !== null ? n[confA.k] : "—";
                const b = confB && n && n[confB.k] !== undefined && n[confB.k] !== null ? n[confB.k] : null;
                const hasTw = n && n.tw && Object.keys(n.tw).length > 0;
                const isOpen = detail && detail.ind.id === r.id && detail.tahun === y;
                return (
                  <td key={y} style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}`, color: T.text }}>
                    <button onClick={() => openDetail(r, y)}
                      style={{ background: "none", border: hasTw ? `1px solid ${T.inputBorder}` : "none", cursor: hasTw || n ? "pointer" : "default", padding: hasTw ? "3px 8px" : 0, borderRadius: 6, color: T.text, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span>{a}</span>
                      {b !== null && <span style={{ color: T.textMuted, marginLeft: 2 }}> / {b}</span>}
                      {hasTw && <Icon name="chevronRight" size={11} style={{ color: T.primary, transform: isOpen ? "rotate(90deg)" : "", transition: "transform .2s" }} />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {detail && (
        <TriwulanDetail detail={detail} confA={confA} confB={confB} T={T} />
      )}
    </div>
  );
}

function TriwulanDetail({ detail, confA, confB, T }) {
  const { ind, tahun } = detail;
  const n = ind.nilai.find(v => v.tahun === tahun);
  const tw = (n && n.tw) || {};
  const footerA = n && n[confA.k] !== undefined && n[confA.k] !== null ? n[confA.k] : "—";
  const footerB = confB && n && n[confB.k] !== undefined && n[confB.k] !== null ? n[confB.k] : "—";

  return (
    <div style={{ marginTop: 6, background: T.surfaceHover, border: `1px solid ${T.inputBorder}`, borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 8 }}>
        Detail Triwulan {tahun} — {ind.indikator}
      </div>
      {Object.keys(tw).length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMuted }}>Belum ada data triwulan.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Triwulan</th>
              <th style={{ textAlign: "left", padding: "4px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{confA.label}</th>
              {confB && <th style={{ textAlign: "left", padding: "4px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{confB.label}</th>}
              <th style={{ textAlign: "left", padding: "4px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {["tw1", "tw2", "tw3", "tw4"].map((twN, i) => {
              const cell = tw[twN] || {};
              const a = cell[confA.k] !== undefined ? cell[confA.k] : "—";
              const b = confB ? (cell[confB.k] !== undefined ? cell[confB.k] : "—") : null;
              const any = cell[confA.k] !== undefined || (confB && cell[confB.k] !== undefined);
              return (
                <tr key={twN}>
                  <td style={{ padding: "4px 6px", fontWeight: 600, color: T.text }}>TW{i + 1}</td>
                  <td style={{ padding: "4px 6px", color: a === "—" ? T.textMuted : T.text }}>{a}</td>
                  {confB && <td style={{ padding: "4px 6px", color: b === "—" ? T.textMuted : T.text }}>{b}</td>}
                  <td style={{ padding: "4px 6px", color: T.textMuted }}>{any ? (a !== "—" ? a : "") + (confB && b !== "—" ? ` / ${b}` : "") : "—"}</td>
                </tr>
              );
            })}
            <tr>
              <td style={{ padding: "4px 6px", fontWeight: 700, color: T.text, borderTop: `1px solid ${T.border}` }}>Total (Tahunan)</td>
              <td style={{ padding: "4px 6px", fontWeight: 600, color: T.text, borderTop: `1px solid ${T.border}` }}>{footerA}</td>
              {confB && <td style={{ padding: "4px 6px", fontWeight: 600, color: T.text, borderTop: `1px solid ${T.border}` }}>{footerB}</td>}
              <td style={{ padding: "4px 6px", borderTop: `1px solid ${T.border}` }}></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}