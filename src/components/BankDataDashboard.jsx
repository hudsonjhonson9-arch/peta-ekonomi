import { useState, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon, CariPilih } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";

export default function BankDataDashboard({ emptyMessage = null }) {
  const { T } = useContext(ThemeContext);

  // Response tidak pernah dijamin array: endpoint yang menolak atau sedang
  // salah akan membalas { error: ... }, dan `data` lalu berisi objek. Karena
  // `= []` hanya berlaku untuk undefined, objek itu lolos ke pemanggil dan
  // .some() di bawah melempar TypeError yang menggagalkan seluruh halaman. Jadi
  // bentuknya dinormalkan di satu tempat.
  const ambilArray = d => (Array.isArray(d) ? d : []);
  const { data: tree } = useQuery({
    queryKey: ['bankdata-dashboard'],
    queryFn: () => fetch('/api/bankdata').then(r => r.json())
  });
  const { data: tahunList } = useQuery({
    queryKey: ['bankdata-tahun'],
    queryFn: () => fetch('/api/bankdata/tahun').then(r => r.json())
  });
  const data = ambilArray(tree);
  const tahun = ambilArray(tahunList);
  const [expanded, setExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bd-dashboard-open")) || {}; } catch { return {}; }
  });
  const [q, setQ] = useState("");

  const searching = q.trim().length > 0;
  const nq = q.trim().toLowerCase();

  // Opsi dropdown pencarian: daftar aspek unik dari seluruh data
  // (IKU, IKK, dan indikator sektoral), plus "Semua" untuk menghapus filter.
  const aspekOpsi = useMemo(() => {
    const set = new Set();
    data.forEach(b => ambilArray(b.opds).forEach(o => {
      ambilArray(o.ikus).forEach(i => {
        if (i.aspek) set.add(i.aspek);
        ambilArray(i.ikks).forEach(k => { if (k.aspek) set.add(k.aspek); });
      });
      ambilArray(o.sektorals).forEach(s =>
        ambilArray(s.indikator).forEach(ind => { if (ind.aspek) set.add(ind.aspek); })
      );
    }));
    return [
      { label: "Semua aspek", value: "", hint: "Tampilkan semua data" },
      ...[...set].sort((a, b) => a.localeCompare(b, "id")).map(a => ({ label: a, value: a })),
    ];
  }, [data]);

  const hitIku = (i) => `${i.nama} ${i.aspek || ""} ${i.sumber_data || ""}`.toLowerCase().includes(nq);
  const hitIkk = (k) => `${k.nama} ${k.aspek || ""}`.toLowerCase().includes(nq);
  const hitSekt = (ind) => `${ind.indikator} ${ind.aspek || ""}`.toLowerCase().includes(nq);

  const shown = searching ? data.map(b => {
    const opds = ambilArray(b.opds).map(o => {
      const ikus = ambilArray(o.ikus).map(i => {
        const ikks = ambilArray(i.ikks).filter(hitIkk);
        if (hitIku(i)) return i;
        if (ikks.length) return { ...i, ikks };
        return null;
      }).filter(Boolean);
      const sektorals = ambilArray(o.sektorals).map(s => {
        const inds = ambilArray(s.indikator).filter(hitSekt);
        if (inds.length) return { ...s, indikator: inds };
        return null;
      }).filter(Boolean);
      if (ikus.length || sektorals.length) return { ...o, ikus, sektorals };
      return null;
    }).filter(Boolean);
    if (opds.length) return { ...b, opds };
    return null;
  }).filter(Boolean) : data;

  // Harus dihitung dari data mentah, BUKAN dari shown. Kalau dari shown, hasil
  // pencarian yang tidak cocok (atau cocok tapi lemah) membuat hasData false dan
  // seluruh komponen — termasuk kotak pencariannya — hilang dari layar.
  const hasData = data.some(b => ambilArray(b.opds).some(o =>
    ambilArray(o.sektorals).some(s => ambilArray(s.indikator).length) ||
    ambilArray(o.ikus).some(i => ambilArray(i.ikks).length || (i.nilai && i.nilai.length))
  ));
  if (!hasData) {
    return emptyMessage ? (
      <div style={{ background: T.card, borderRadius: 12, padding: 40, border: `1px solid ${T.border}`, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
        {emptyMessage}
      </div>
    ) : null;
  }

  const toggle = (key) => setExpanded(prev => {
    const next = { ...prev, [key]: !prev[key] };
    localStorage.setItem("bd-dashboard-open", JSON.stringify(next));
    return next;
  });
  const isOpen = (key) => searching || !!expanded[key];

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Judul di luar card, sama seperti Kertas Kerja di dashboard. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <Icon name="chart" size={15} style={{ color: T.primary, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Bank Data</span>
      </div>
      <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12 }}>Bidang → OPD → IKU (Target/Capaian) → IKK · Data Sektoral</div>

        <div style={{ marginBottom: 12 }}>
          <CariPilih
            value={q}
            onChange={setQ}
            opsi={aspekOpsi}
            placeholder="Pilih aspek, atau ketik kata kunci…"
          />
        </div>

        {searching && shown.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 8px", fontSize: 13, color: T.textMuted }}>
            Tidak ada hasil untuk “{q.trim()}”. Coba pilih aspek lain.
          </div>
        ) : shown.map(b => (
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
                  <OPDView key={o.id} o={o} tahunList={tahun} forceOpen={searching} expanded={expanded} toggle={toggle} T={T} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OPDView({ o, tahunList, forceOpen, expanded, toggle, T }) {
  const isOpen = (k) => forceOpen || !!expanded[k];
  const tahunList2 = tahunList.map(t => t.tahun);

  const oHas = o.sektorals.some(s => s.indikator.length) || o.ikus.some(i => (i.ikks || []).length || (i.nilai && i.nilai.length));
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
              {(iku.ikks || []).map(k => (
                <div key={`ikk${iku.id}-${k.id}`} style={{ margin: "4px 0 0 12px", borderLeft: `1px solid ${T.border}`, paddingLeft: 10 }}>
                  <SubHeader icon="list" label="IKK" name={k.nama} expanded={isOpen(`ikk${iku.id}-${k.id}`)} onToggle={() => toggle(`ikk${iku.id}-${k.id}`)} T={T} />
                  {isOpen(`ikk${iku.id}-${k.id}`) && (
                    <ValueTable rows={[{ id: k.id, indikator: k.nama, aspek: k.aspek, sumber_data: k.sumber_data, nilai: k.nilai }]}
                      tahunList={tahunList2} conf="ikk" T={T} />
                  )}
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

function ValueTable({ rows, tahunList, conf, hideAspek, T }) {
  const confA = conf === "iku" ? { k: "target", label: "Target" } : conf === "ikk" ? { k: "target", label: "Target" } : { k: "data", label: "Data" };
  const confB = conf === "iku" ? { k: "capaian", label: "Capaian" } : conf === "ikk" ? { k: "capaian", label: "Capaian" } : null;
  const years = tahunList.length > 0 ? tahunList : [...new Set(rows.flatMap(r => (Array.isArray(r.nilai) ? r.nilai : []).map(n => n.tahun)))].sort();
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