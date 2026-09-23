import { useState, useContext, Fragment, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import useResponsive from "../useResponsive.js";
import { ThemeContext } from "../App.jsx";

const LEVEL_CONF = {
  iku:      { icon: "layers",   label: "IKU",            parentKey: "iku_id",      parentLabel: "IKU",  valA: { k: "target",  label: "Target" },  valB: { k: "capaian", label: "Capaian" } },
  ikk:      { icon: "list",     label: "IKK",            parentKey: "ikk_id",      parentLabel: "IKK",  valA: { k: "capaian", label: "Capaian" }, valB: { k: "realisasi", label: "Realisasi" } },
  sektoral: { icon: "chart",    label: "Data Sektoral",  parentKey: "sektoral_id", parentLabel: "Data Sektoral", valA: { k: "data", label: "Data" }, valB: null }
};

export default function BankData({ showToast }) {
  const { T } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();
  const { data: tree = [], isLoading } = useQuery({
    queryKey: ['bankdata'],
    queryFn: () => fetch('/api/bankdata').then(r => r.json())
  });
  const { data: tahunList = [] } = useQuery({
    queryKey: ['bankdata-tahun'],
    queryFn: () => fetch('/api/bankdata/tahun').then(r => r.json())
  });

  const [expanded, setExpanded] = useState({});
  const [activeBidang, setActiveBidang] = useState(null);
  const [newTahun, setNewTahun] = useState("");
  const [form, setForm] = useState(null); // { level, parentId, type, editId, values }
  const [ensureDone, setEnsureDone] = useState({}); // opd_id -> true setelah sektoral default dipastikan
  const [q, setQ] = useState("");

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ['bankdata'] });
    queryClient.invalidateQueries({ queryKey: ['bankdata-tahun'] });
  };

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const keys = tahunList.map(t => t.tahun);

  const addTahun = async () => {
    if (!newTahun.trim()) return showToast("Tahun wajib diisi");
    const res = await fetch('/api/bankdata/tahun', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tahun: Number(newTahun) })
    });
    if (!res.ok) return showToast((await res.json()).error);
    setNewTahun(""); reload(); showToast("Tahun ditambahkan");
  };

  const delTahun = async (t) => {
    if (!confirm(`Hapus tahun ${t.tahun} dari daftar?`)) return;
    const res = await fetch(`/api/bankdata/tahun/${t.id}`, { method: 'DELETE' });
    if (!res.ok) return showToast((await res.json()).error);
    reload(); showToast("Tahun dihapus");
  };

  const openForm = (level, parentId, editId = null, values = {}) => setForm({ level, parentId, editId, values });
  const cancelForm = () => setForm(null);
  const submitIndikator = async () => {
    if (!form) return;
    const body = { indikator: (form.values.indikator || "").trim(), sumber_data: (form.values.sumber_data || "").trim() || null, aspek: (form.values.aspek || "").trim() || null };
    if (!body.indikator) return showToast("Nama indikator wajib diisi");
    if (!form.editId) body[LEVEL_CONF[form.level].parentKey] = form.parentId;
    const url = `/api/bankdata/indikator/${form.level}${form.editId ? `/${form.editId}` : ""}`;
    const res = await fetch(url, {
      method: form.editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!res.ok) return showToast((await res.json()).error);
    setForm(null); reload(); showToast(form.editId ? "Indikator diperbarui" : "Indikator ditambahkan");
  };

  const saveNilai = async (level, targetId, tahun, valA, valB) => {
    const res = await fetch(`/api/bankdata/nilai/${level}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId, tahun, valA, valB })
    });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
  };

  const saveTriwulan = async (level, targetId, tahun, tw) => {
    const res = await fetch(`/api/bankdata/triwulan/${level}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId, tahun, tw })
    });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
  };

  const delEntity = async (level, id, nama, parentLabel) => {
    if (!confirm(`Hapus ${parentLabel} "${nama}" beserta seluruh isinya?`)) return;
    const res = await fetch(`/api/bankdata/${level}/${id}`, { method: 'DELETE' });
    if (!res.ok) return showToast((await res.json()).error);
    reload(); showToast(`${parentLabel} dihapus`);
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Memuat data...</div>;

  const ikusDesc = (iku) => `${(iku.ikks || []).length} IKK`;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Bank Data</div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>Hierarki: Bidang → OPD → IKU (target/capaian) → IKK (capaian/realisasi), dan Data Sektoral per OPD</div>
      </div>

      {/* Pencarian */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Icon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Cari nama IKU, IKK, Data Sektoral, atau aspek... (kosongkan untuk kembali ke daftar)"
          style={{ width: "100%", padding: "10px 12px 10px 36px", border: `1.5px solid ${T.primary}`, borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", background: T.card, color: T.text, boxShadow: T.shadowSm }} />
      </div>

      {/* Tahun global */}
      <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>Daftar Tahun</div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 10 }}>
          Tahun dipakai untuk semua data (IKU target/capaian, IKK capaian/realisasi baik tahunan maupun triwulan, dan data sektoral).
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {tahunList.map(t => (
            <span key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, background: T.primaryLight, color: T.primary, padding: "5px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>
              {t.tahun}
              <button onClick={() => delTahun(t)} style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex", padding: 0 }}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}
          {tahunList.length === 0 && <span style={{ fontSize: 12, color: T.textMuted }}>Belum ada tahun. Tambahkan di bawah.</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={newTahun} onChange={e => setNewTahun(e.target.value)} type="number" placeholder="Contoh: 2026"
            style={{ width: 130, padding: "8px 11px", border: `1px solid ${T.inputBorder}`, borderRadius: 8, fontSize: 13, outline: "none", background: T.inputBg, color: T.text }} />
          <button onClick={addTahun} style={{ padding: "8px 14px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            + Tambah Tahun
          </button>
        </div>
      </div>

      {q.trim() ? (
        <SearchResults tree={tree} q={q} T={T} />
      ) : !activeBidang ? (
        <BidangList tree={tree} onSelect={setActiveBidang} icons={{ building: "building" }} T={T} />
      ) : (
        <BidangDetail
          bidang={tree.find(b => String(b.id) === String(activeBidang))}
          onBack={() => setActiveBidang(null)}
          form={form} setForm={setForm} expanded={expanded} toggle={toggle}
          ikusDesc={ikusDesc} openForm={openForm} cancelForm={cancelForm} submitIndikator={submitIndikator}
          reload={reload} setEnsureDone={setEnsureDone} ensureDone={ensureDone}
          saveNilai={saveNilai} saveTriwulan={saveTriwulan}
          delEntity={delEntity} delIndikator={delIndikator} openFormForEntity={openFormForEntity}
          tahunList={keys} showToast={showToast} T={T}
        />
      )}

      {tree.length === 0 && (
        <div style={{ background: T.card, borderRadius: 12, padding: 40, border: `1px solid ${T.border}`, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
          Belum ada data. Pastikan bidang BAPPERIDA tersedia di master Bidang.
        </div>
      )}
    </div>
  );

  function openFormForEntity(level, parentId, editId = null, values = {}) {
    setForm({ level, parentId, editId, values });
  }

  async function delIndikator(level, id, nama) {
    if (!confirm(`Hapus indikator "${nama}" beserta semua nilainya?`)) return;
    const res = await fetch(`/api/bankdata/indikator/${level}/${id}`, { method: 'DELETE' });
    if (!res.ok) return showToast((await res.json()).error);
    reload(); showToast("Indikator dihapus");
  }
}

/* ── Entity header (OPD / IKU / IKK / Data Sektoral) ───────────────────── */
function EntityHead({ level, node, expandedKey, expanded, onToggle, extraCount, onEdit, onDel, T }) {
  const meta = level === "sektoral" ? LEVEL_CONF.sektoral : level === "opd" ? { icon: "building", label: "OPD" } : LEVEL_CONF[level];
  const icon = meta.icon || "building";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: T.surfaceHover, borderRadius: 10, border: `1px solid ${T.border}`, cursor: "pointer" }}
      onClick={onToggle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Icon name={icon} size={14} style={{ color: T.primary, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.nama}</span>
        {extraCount && <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>({extraCount})</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}>
          <Icon name="edit" size={13} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDel(); }} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex" }}>
          <Icon name="trash" size={13} />
        </button>
        <Icon name="chevronRight" size={13} style={{ color: T.textMuted, transform: expanded ? "rotate(90deg)" : "", transition: "transform .2s" }} />
      </div>
    </div>
  );
}

/* ── Inline add form untuk entity (OPD/IKU/IKK/Data Sektoral) ──────────── */
function InlineEntityAdd({ label, show, onOpen, onCancel, T, form, setVal, title, fields, submit }) {
  if (!show) {
    return (
      <button onClick={onOpen} style={{ margin: "2px 0 8px", padding: "6px 10px", background: "none", border: `1px dashed ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.primary, cursor: "pointer" }}>
        + {label}
      </button>
    );
  }
  return (
    <div style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: 12, margin: "2px 0 10px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>{title}</div>
      {fields.map(f => (
        <label key={f.k} style={{ display: "block", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: T.textSecondary, marginBottom: 3, display: "block" }}>{f.label}</span>
          <input value={form.values[f.k] || ""} onChange={e => setVal(f.k, e.target.value)} style={{ width: "100%", padding: "8px 11px", border: `1px solid ${T.inputBorder}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: T.inputBg, color: T.text }} />
        </label>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} style={{ padding: "7px 14px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Simpan</button>
        <button onClick={onCancel} style={{ padding: "7px 12px", background: T.surfaceHover, color: T.textSecondary, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Batal</button>
      </div>
    </div>
  );
}

/* ── Panel daftar indikator + input nilai per tahun ────────────────────── */
function IndikatorPanel({ level, parentId, parentLabel, list, tahunList, form, setForm, openForm, cancelForm, submitIndikator, onSaveNilai, onSaveTw, onDelInd, T }) {
  const conf = LEVEL_CONF[level];
  const showAddForm = form && form.level === level && form.parentId === parentId && !form.editId;
  const editForm = form && form.level === level && form.parentId === parentId && form.editId;

  const setValue = (k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p);

  return (
    <div>
      {!showAddForm && (
        <button onClick={() => openForm(level, parentId)} style={{ margin: "2px 0 8px", padding: "6px 10px", background: "none", border: `1px dashed ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.primary, cursor: "pointer" }}>
          + Tambah Indikator
        </button>
      )}
      {showAddForm && (
        <IndikatorForm title={`Tambah Indikator ${parentLabel}`} values={form.values} setVal={setValue}
          submit={submitIndikator} cancel={cancelForm} T={T} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map(ind => {
          if (editForm && editForm.editId === ind.id) {
            return <IndikatorForm key={ind.id} title="Edit Indikator" values={form.values} setVal={setValue} submit={submitIndikator} cancel={cancelForm} T={T} />;
          }
          return (
            <div key={ind.id} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, background: T.surfaceHover }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ind.indikator}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {ind.sumber_data ? `Sumber: ${ind.sumber_data}` : "" || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => openForm(level, parentId, ind.id, { indikator: ind.indikator, sumber_data: ind.sumber_data || "" })}
                    style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}>
                    <Icon name="edit" size={13} />
                  </button>
                  <button onClick={() => onDelInd(ind.id, ind.indikator)} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex" }}>
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
              <NilaiTable level={level} ind={ind} conf={conf} tahunList={tahunList} onSave={onSaveNilai} onSaveTw={onSaveTw} T={T} />
            </div>
          );
        })}
      </div>

      {list.length === 0 && <div style={{ fontSize: 12, color: T.textMuted, padding: "4px 2px" }}>Belum ada indikator.</div>}
    </div>
  );
}

/* ── Form indikator (tambah/edit) ──────────────────────────────────────── */
function IndikatorForm({ title, values, setVal, submit, cancel, T }) {
  return (
    <div style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: 12, margin: "2px 0 10px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>{title}</div>
      {[
        { k: "indikator", label: "Indikator" },
        { k: "sumber_data", label: "Sumber Data" }
      ].map(f => (
        <label key={f.k} style={{ display: "block", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: T.textSecondary, marginBottom: 3, display: "block" }}>{f.label}</span>
          <input value={values[f.k] || ""} onChange={e => setVal(f.k, e.target.value)}
            style={{ width: "100%", padding: "8px 11px", border: `1px solid ${T.inputBorder}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: T.inputBg, color: T.text }} />
        </label>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} style={{ padding: "7px 14px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Simpan</button>
        <button onClick={cancel} style={{ padding: "7px 12px", background: T.surfaceHover, color: T.textSecondary, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Batal</button>
      </div>
    </div>
  );
}

/* ── Tabel input nilai per tahun + detail triwulan ─────────────────────── */
function NilaiTable({ level, ind, conf, tahunList, onSave, onSaveTw, T }) {
  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState({});
  const [twOpen, setTwOpen] = useState({});       // {tahun: true}
  const [twDraft, setTwDraft] = useState({});     // {tahun:twN:key: value}
  const [twSaved, setTwSaved] = useState({});     // {tahun: true}

  const getVal = (tahun, k) => {
    if (draft[`${tahun}:${k}`] !== undefined) return draft[`${tahun}:${k}`];
    const row = ind.nilai.find(n => n.tahun === tahun);
    return row && row[k] !== undefined && row[k] !== null ? row[k] : "";
  };

  const setVal = (tahun, k, v) => setDraft(d => ({ ...d, [`${tahun}:${k}`]: v }));

  const saveRow = (tahun) => {
    const valA = getVal(tahun, conf.valA.k) === "" ? null : String(getVal(tahun, conf.valA.k));
    const valB = conf.valB ? (getVal(tahun, conf.valB.k) === "" ? null : String(getVal(tahun, conf.valB.k))) : null;
    setSaved(s => ({ ...s, [tahun]: true }));
    onSave(ind.id, tahun, valA, valB);
    setTimeout(() => setSaved(s => ({ ...s, [tahun]: false })), 1500);
  };

  const getTw = (tahun, twN, k) => {
    const dk = `${tahun}:${twN}:${k}`;
    if (twDraft[dk] !== undefined) return twDraft[dk];
    const row = ind.nilai.find(n => n.tahun === tahun);
    const cell = row && row.tw && row.tw[twN];
    return cell && cell[k] !== undefined && cell[k] !== null ? cell[k] : "";
  };

  const setTw = (tahun, twN, k, v) => setTwDraft(d => ({ ...d, [`${tahun}:${twN}:${k}`]: v }));

  const saveTwRow = (tahun) => {
    const tw = {};
    for (let i = 1; i <= 4; i++) {
      const a = getTw(tahun, `tw${i}`, conf.valA.k);
      const cell = { [conf.valA.k]: a === "" ? null : String(a) };
      if (conf.valB) {
        const b = getTw(tahun, `tw${i}`, conf.valB.k);
        cell[conf.valB.k] = b === "" ? null : String(b);
      }
      if (cell[conf.valA.k] !== null || (conf.valB && cell[conf.valB.k] !== null)) tw[`tw${i}`] = cell;
    }
    if (Object.keys(tw).length === 0) return;
    setTwSaved(s => ({ ...s, [tahun]: true }));
    onSaveTw(ind.id, tahun, tw);
    setTimeout(() => setTwSaved(s => ({ ...s, [tahun]: false })), 1500);
  };

  if (tahunList.length === 0) {
    return <div style={{ fontSize: 11, color: T.textMuted }}>Tambahkan tahun di bagian Daftar Tahun terlebih dahulu.</div>;
  }

  const nCols = 3 + (conf.valB ? 1 : 0);

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "4px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Tahun</th>
          <th style={{ textAlign: "left", padding: "4px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{conf.valA.label}{conf.valB ? " (Total)" : ""}</th>
          {conf.valB && <th style={{ textAlign: "left", padding: "4px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{conf.valB.label}{" (Total)"}</th>}
          <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: `1px solid ${T.border}` }}></th>
        </tr>
      </thead>
      <tbody>
        {tahunList.map(t => (
          <Fragment key={t}>
            <tr>
              <td style={{ padding: "4px 6px", fontWeight: 600, color: T.text }}>
                <button onClick={() => setTwOpen(o => ({ ...o, [t]: !o[t] }))}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4, color: T.primary, fontWeight: 700, fontSize: 12 }}>
                  <Icon name="chevronRight" size={11} style={{ transform: twOpen[t] ? "rotate(90deg)" : "", transition: "transform .2s" }} />
                  {t}
                </button>
              </td>
              <td style={{ padding: "4px 6px" }}>
                <input value={getVal(t, conf.valA.k)} onChange={e => setVal(t, conf.valA.k, e.target.value)}
                  style={{ width: "100%", minWidth: 80, padding: "5px 8px", border: `1px solid ${T.inputBorder}`, borderRadius: 6, fontSize: 12, outline: "none", background: T.inputBg, color: T.text, boxSizing: "border-box" }} />
              </td>
              {conf.valB && (
                <td style={{ padding: "4px 6px" }}>
                  <input value={getVal(t, conf.valB.k)} onChange={e => setVal(t, conf.valB.k, e.target.value)}
                    style={{ width: "100%", minWidth: 80, padding: "5px 8px", border: `1px solid ${T.inputBorder}`, borderRadius: 6, fontSize: 12, outline: "none", background: T.inputBg, color: T.text, boxSizing: "border-box" }} />
                </td>
              )}
              <td style={{ padding: "4px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                <button onClick={() => saveRow(t)} disabled={!!saved[t]}
                  style={{ padding: "5px 10px", background: saved[t] ? "#16a34a" : T.primary, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {saved[t] ? "✓" : "Simpan"}
                </button>
              </td>
            </tr>

            {twOpen[t] && (
              <tr>
                <td colSpan={nCols} style={{ padding: "2px 6px 8px" }}>
                  <div style={{ background: T.surfaceHover, border: `1px solid ${T.inputBorder}`, borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 6 }}>
                      Detail Triwulan {t} — {conf.valA.label}{conf.valB ? ` & ${conf.valB.label}` : ""}
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "3px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Triwulan</th>
                          <th style={{ textAlign: "left", padding: "3px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{conf.valA.label}</th>
                          {conf.valB && <th style={{ textAlign: "left", padding: "3px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>{conf.valB.label}</th>}
                          <th style={{ textAlign: "left", padding: "3px 6px", color: T.textMuted, fontWeight: 600, borderBottom: `1px solid ${T.border}` }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {["tw1", "tw2", "tw3", "tw4"].map((twN, i) => (
                          <tr key={twN}>
                            <td style={{ padding: "3px 6px", fontWeight: 600, color: T.text }}>TW{i + 1}</td>
                            <td style={{ padding: "3px 6px" }}>
                              <input value={getTw(t, twN, conf.valA.k)} onChange={e => setTw(t, twN, conf.valA.k, e.target.value)}
                                style={{ width: "100%", minWidth: 70, padding: "4px 7px", border: `1px solid ${T.inputBorder}`, borderRadius: 6, fontSize: 12, outline: "none", background: T.inputBg, color: T.text, boxSizing: "border-box" }} />
                            </td>
                            {conf.valB && (
                              <td style={{ padding: "3px 6px" }}>
                                <input value={getTw(t, twN, conf.valB.k)} onChange={e => setTw(t, twN, conf.valB.k, e.target.value)}
                                  style={{ width: "100%", minWidth: 70, padding: "4px 7px", border: `1px solid ${T.inputBorder}`, borderRadius: 6, fontSize: 12, outline: "none", background: T.inputBg, color: T.text, boxSizing: "border-box" }} />
                              </td>
                            )}
                            <td style={{ padding: "3px 6px", color: getTw(t, twN, conf.valA.k) ? T.text : T.textMuted }}>
                              {getTw(t, twN, conf.valA.k) ? (getTw(t, twN, conf.valA.k) + (conf.valB && getTw(t, twN, conf.valB.k) ? ` / ${getTw(t, twN, conf.valB.k)}` : "")) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                      <button onClick={() => saveTwRow(t)} disabled={!!twSaved[t]}
                        style={{ padding: "5px 12px", background: twSaved[t] ? "#16a34a" : T.primary, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        {twSaved[t] ? "✓" : "Simpan Triwulan"}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

/* ── Daftar bidang koordinasi (drill-down admin) ───────────────────────── */
function BidangList({ tree, onSelect, T }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 12 }}>
      {tree.map(b => {
        const indCount = b.opds.reduce((s, o) =>
          s + o.sektorals.reduce((x, q) => x + q.indikator.length, 0) +
          o.ikus.reduce((x, i) => x + (i.ikks || []).reduce((y, k) => y + (k.nilai ? k.nilai.length : 0), 0), 0), 0);
        return (
          <button key={b.id} onClick={() => onSelect(b.id)} style={{
            textAlign: "left", background: T.card, borderRadius: 12, border: `1px solid ${T.border}`,
            padding: 16, cursor: "pointer", transition: "border-color .15s",
          }} onMouseEnter={e => e.currentTarget.style.borderColor = T.primary}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon name="building" size={16} style={{ color: T.primary }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{b.nama}</span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary }}>
              {b.opds.length} OPD · {indCount} indikator
            </div>
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: T.primary }}>Kelola →</div>
          </button>
        );
      })}
      {tree.length === 0 && (
        <div style={{ background: T.card, borderRadius: 12, padding: 24, color: T.textMuted, fontSize: 13, border: `1px solid ${T.border}` }}>
          Belum ada bidang koordinasi.
        </div>
      )}
    </div>
  );
}

/* ── Detail satu bidang (isi OPD + IKU/IKK + Data Sektoral flat) ───────── */
function BidangDetail(props) {
  const {
    bidang, onBack, form, setForm, expanded, toggle, ikusDesc,
    openForm, cancelForm, submitIndikator, reload, setEnsureDone, ensureDone,
    saveNilai, saveTriwulan, delEntity, delIndikator, openFormForEntity,
    tahunList, showToast, T,
  } = props;

  if (!bidang) {
    return (
      <div style={{ background: T.card, borderRadius: 12, padding: 24, color: T.textMuted, fontSize: 13, border: `1px solid ${T.border}` }}>
        Bidang tidak ditemukan. <button onClick={onBack} style={{ color: T.primary, background: "none", border: "none", cursor: "pointer" }}>Kembali</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: T.surfaceHover, border: `1px solid ${T.border}`, color: T.textSecondary, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} /> Kembali ke Bidang
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="building" size={18} style={{ color: T.primary }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{bidang.nama}</div>
          <div style={{ fontSize: 12, color: T.textSecondary }}>{bidang.opds.length} OPD pada bidang koordinasi ini</div>
        </div>
      </div>

      <InlineEntityAdd label="Tambah OPD" show={form && form.level === "opd" && form.parentId === bidang.id && !form.editId}
        onOpen={() => openFormForEntity("opd", bidang.id)} onCancel={cancelForm} T={T} form={form} setVal={(k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p)}
        title="OPD baru" fields={[{ k: "nama", label: "Nama OPD" }]} submit={async () => {
          const body = { bidang_id: bidang.id, nama: (form.values.nama || "").trim() };
          if (!body.nama) return showToast("Nama OPD wajib diisi");
          const res = await fetch('/api/bankdata/opd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!res.ok) return showToast((await res.json()).error);
          setForm(null); reload(); showToast("OPD ditambahkan");
        }} />

      {bidang.opds.map(o => (
        <div key={o.id} style={{ marginBottom: 8 }}>
          <EntityHead level="opd" node={o} expandedKey={`o${o.id}`} expanded={expanded[`o${o.id}`]} onToggle={() => toggle(`o${o.id}`)}
            extraCount={`${o.ikus.length} IKU · ${o.sektorals.length} DS`}
            onEdit={() => openFormForEntity("opd", bidang.id, o.id, { nama: o.nama })}
            onDel={() => delEntity("opd", o.id, o.nama, "OPD")} T={T} />

          {expanded[`o${o.id}`] && (
            <OpdContent
              o={o} form={form} setForm={setForm} expanded={expanded} toggle={toggle}
              ikusDesc={ikusDesc} openForm={openForm} cancelForm={cancelForm} submitIndikator={submitIndikator}
              reload={reload} ensureDone={ensureDone} setEnsureDone={setEnsureDone} saveNilai={saveNilai} saveTriwulan={saveTriwulan}
              delEntity={delEntity} delIndikator={delIndikator} openFormForEntity={openFormForEntity}
              tahunList={tahunList} showToast={showToast} T={T}
            />
          )}
        </div>
      ))}

      {bidang.opds.length === 0 && (
        <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 2px" }}>Belum ada OPD pada bidang ini.</div>
      )}
    </div>
  );
}

/* ── Isi OPD: Data Sektoral (flat) + IKU/IKK ───────────────────────────── */
function OpdContent(props) {
  const {
    o, form, setForm, expanded, toggle, ikusDesc,
    openForm, cancelForm, submitIndikator, reload, ensureDone, setEnsureDone,
    saveNilai, saveTriwulan, delEntity, delIndikator, openFormForEntity,
    tahunList, showToast, T,
  } = props;

  const ds = o.sektorals[0];

  const submitIkuEdit = (id) => async () => {
    const body = { nama: (form.values.nama || "").trim(), sumber_data: (form.values.sumber_data || "").trim() || null, aspek: (form.values.aspek || "").trim() || null };
    if (!body.nama) return showToast("Nama IKU wajib diisi");
    const res = await fetch(`/api/bankdata/iku/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return showToast((await res.json()).error);
    setForm(null); reload(); showToast("IKU diperbarui");
  };

  useEffect(() => {
    if (o.sektorals.length === 0) { ensureSektoralNow(o.id, ensureDone, setEnsureDone, reload, showToast); }
  }, [o.id]);

  return (
    <div style={{ padding: "4px 0 8px 18px", borderLeft: `1px solid ${T.border}`, marginLeft: 18 }}>
      {/* Data Sektoral — flat, indikator langsung */}
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, margin: "10px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="chart" size={13} style={{ color: T.primary }} /> DATA SEKTORAL
        <span style={{ fontSize: 10, fontWeight: 400, color: T.textMuted }}>(indikator langsung di OPD)</span>
      </div>
      {ds ? (
        <IndikatorPanel level="sektoral" parentId={ds.id} parentLabel="Data Sektoral"
          list={ds.indikator} tahunList={tahunList} form={form} setForm={setForm} openForm={openForm} cancelForm={cancelForm} submitIndikator={submitIndikator}
          onSaveNilai={(indId, tahun, valA, valB) => saveNilai("sektoral", indId, tahun, valA, valB)}
          onSaveTw={(indId, tahun, tw) => saveTriwulan("sektoral", indId, tahun, tw)}
          onDelInd={(id, nama) => delIndikator("sektoral", id, nama)} T={T} />
      ) : (
        <div style={{ fontSize: 12, color: T.textMuted, padding: "4px 2px 8px" }}>Menyiapkan Data Sektoral...</div>
      )}

      {/* IKU */}
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, margin: "10px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="layers" size={13} style={{ color: T.primary }} /> IKU (INDIKATOR KINERJA UTAMA) — punya Target/Capaian sendiri per tahun
      </div>
      <InlineEntityAdd label="Tambah IKU" show={form && form.level === "iku" && form.parentId === o.id && !form.editId}
        onOpen={() => openFormForEntity("iku", o.id)} onCancel={cancelForm} T={T} form={form} setVal={(k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p)}
        title="IKU baru" fields={[{ k: "nama", label: "Nama IKU" }, { k: "sumber_data", label: "Sumber Data" }, { k: "aspek", label: "Aspek" }]} submit={async () => {
          const body = { opd_id: o.id, nama: (form.values.nama || "").trim(), sumber_data: (form.values.sumber_data || "").trim() || null, aspek: (form.values.aspek || "").trim() || null };
          if (!body.nama) return showToast("Nama IKU wajib diisi");
          const res = await fetch('/api/bankdata/iku', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!res.ok) return showToast((await res.json()).error);
          setForm(null); reload(); showToast("IKU ditambahkan");
        }} />

      {o.ikus.map(iku => (
        <div key={iku.id} style={{ marginBottom: 8 }}>
          <EntityHead level="iku" node={iku} expandedKey={`i${iku.id}`} expanded={expanded[`i${iku.id}`]} onToggle={() => toggle(`i${iku.id}`)}
            extraCount={ikusDesc(iku)}
            onEdit={() => { if (!expanded[`i${iku.id}`]) toggle(`i${iku.id}`); openFormForEntity("iku", o.id, iku.id, { nama: iku.nama, sumber_data: iku.sumber_data || "", aspek: iku.aspek || "" }); }}
            onDel={() => delEntity("iku", iku.id, iku.nama, "IKU")} T={T} />

          {expanded[`i${iku.id}`] && (
            <div style={{ padding: "4px 0 8px 18px", borderLeft: `1px solid ${T.border}`, marginLeft: 18 }}>
              {form && form.level === "iku" && form.editId === iku.id ? (
                <IkuEdit iku={iku} values={form.values} setVal={(k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p)}
                  submit={submitIkuEdit(iku.id)} cancel={cancelForm} T={T} />
              ) : (
                <>
                  <IkuDataRow iku={iku} tahunList={tahunList}
                    saveNilai={(id, tahun, valA, valB) => saveNilai("iku", id, tahun, valA, valB)}
                    saveTriwulan={(id, tahun, tw) => saveTriwulan("iku", id, tahun, tw)} T={T} />

                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, margin: "10px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="list" size={13} style={{ color: T.primary }} /> IKK (INDIKATOR KINERJA KUNCI) — diisi nilainya langsung per tahun
                  </div>
                  <InlineEntityAdd label="Tambah IKK" show={form && form.level === "ikk" && form.parentId === iku.id && !form.editId}
                    onOpen={() => openFormForEntity("ikk", iku.id)} onCancel={cancelForm} T={T} form={form} setVal={(k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p)}
                    title="IKK baru" fields={[{ k: "nama", label: "Nama IKK" }, { k: "sumber_data", label: "Sumber Data" }, { k: "aspek", label: "Aspek" }]} submit={async () => {
                      const body = { iku_id: iku.id, nama: (form.values.nama || "").trim(), sumber_data: (form.values.sumber_data || "").trim() || null, aspek: (form.values.aspek || "").trim() || null };
                      if (!body.nama) return showToast("Nama IKK wajib diisi");
                      const res = await fetch('/api/bankdata/ikk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                      if (!res.ok) return showToast((await res.json()).error);
                      setForm(null); reload(); showToast("IKK ditambahkan");
                    }} />

                  {(iku.ikks || []).map(ikk => (
                    <IkkRow key={ikk.id} ikk={ikk} ikuId={iku.id}
                      form={form} setForm={setForm} cancelForm={cancelForm} openFormForEntity={openFormForEntity}
                      reload={reload} delEntity={delEntity}
                      tahunList={tahunList} saveNilai={saveNilai} saveTriwulan={saveTriwulan}
                      showToast={showToast} T={T} />
                  ))}
                  {(iku.ikks || []).length === 0 && <div style={{ fontSize: 12, color: T.textMuted, padding: "4px 2px 8px" }}>Belum ada IKK. Tambahkan IKK lalu isi nilainya per tahun.</div>}
                </>
              )}
            </div>
          )}
        </div>
      ))}
      {o.ikus.length === 0 && <div style={{ fontSize: 12, color: T.textMuted, padding: "4px 2px 8px" }}>Belum ada IKU.</div>}
    </div>
  );
}

async function ensureSektoralNow(opdId, ensureDone, setEnsureDone, reload, showToast) {
  if (ensureDone[opdId]) return;
  const res = await fetch('/api/bankdata/sektoral/ensure', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opd_id: opdId })
  });
  if (res.ok) {
    setEnsureDone(d => ({ ...d, [opdId]: true }));
    reload();
  } else if (showToast) {
    showToast((await res.json()).error);
  }
}

/* ── Baris IKK: nama + sumber/aspek + tabel nilai langsung per tahun ────── */
function IkkRow({ ikk, ikuId, form, setForm, cancelForm, openFormForEntity, reload, delEntity, tahunList, saveNilai, saveTriwulan, showToast, T }) {
  const isEdit = form && form.level === "ikk" && form.editId === ikk.id;
  const setVal = (k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p);

  const submitEdit = async () => {
    const body = { nama: (form.values.nama || "").trim(), sumber_data: (form.values.sumber_data || "").trim() || null, aspek: (form.values.aspek || "").trim() || null };
    if (!body.nama) return showToast("Nama IKK wajib diisi");
    const res = await fetch(`/api/bankdata/ikk/${ikk.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return showToast((await res.json()).error);
    setForm(null); reload(); showToast("IKK diperbarui");
  };

  if (isEdit) {
    return (
      <div style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: 12, margin: "2px 0 10px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>Edit IKK</div>
        {[
          { k: "nama", label: "Nama IKK" },
          { k: "sumber_data", label: "Sumber Data" },
          { k: "aspek", label: "Aspek" }
        ].map(f => (
          <label key={f.k} style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: T.textSecondary, marginBottom: 3, display: "block" }}>{f.label}</span>
            <input value={form.values[f.k] || ""} onChange={e => setVal(f.k, e.target.value)}
              style={{ width: "100%", padding: "8px 11px", border: `1px solid ${T.inputBorder}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: T.inputBg, color: T.text }} />
          </label>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submitEdit} style={{ padding: "7px 14px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Simpan</button>
          <button onClick={cancelForm} style={{ padding: "7px 12px", background: T.surfaceHover, color: T.textSecondary, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Batal</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: T.surfaceHover }}>
        <Icon name="list" size={14} style={{ color: T.primary, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ikk.nama}</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>
            {[ikk.sumber_data ? `Sumber: ${ikk.sumber_data}` : "", ikk.aspek ? `Aspek: ${ikk.aspek}` : ""].filter(Boolean).join(" · ") || "Isi Capaian/Realisasi per tahun di bawah"}
          </div>
        </div>
        <button onClick={() => openFormForEntity("ikk", ikuId, ikk.id, { nama: ikk.nama, sumber_data: ikk.sumber_data || "", aspek: ikk.aspek || "" })}
          style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}>
          <Icon name="edit" size={13} />
        </button>
        <button onClick={() => delEntity("ikk", ikk.id, ikk.nama, "IKK")} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex" }}>
          <Icon name="trash" size={13} />
        </button>
      </div>
      <div style={{ padding: "8px 10px", background: T.card }}>
        <NilaiTable level="ikk" ind={ikk} conf={LEVEL_CONF.ikk} tahunList={tahunList}
          onSave={(id, tahun, valA, valB) => saveNilai("ikk", id, tahun, valA, valB)}
          onSaveTw={(id, tahun, tw) => saveTriwulan("ikk", id, tahun, tw)} T={T} />
      </div>
    </div>
  );
}

/* ── Baris data IKU: nilai target/capaian sendiri + sumber/aspek ───────── */
function IkuDataRow({ iku, tahunList, saveNilai, saveTriwulan, T }) {
  return (
    <div style={{ marginBottom: 8, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: T.surfaceHover }}>
        <Icon name="chart" size={14} style={{ color: T.primary, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>Data IKU — Target/Capaian per tahun</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>
            {[iku.sumber_data ? `Sumber: ${iku.sumber_data}` : "", iku.aspek ? `Aspek: ${iku.aspek}` : ""].filter(Boolean).join(" · ") || "Isi Target/Capaian IKU per tahun di bawah"}
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 10px", background: T.card }}>
        <NilaiTable level="iku" ind={iku} conf={LEVEL_CONF.iku} tahunList={tahunList}
          onSave={saveNilai} onSaveTw={saveTriwulan} T={T} />
      </div>
    </div>
  );
}

/* ── Form edit IKU (nama + sumber_data/aspek) ──────────────────────────── */
function IkuEdit({ iku, values, setVal, submit, cancel, T }) {
  return (
    <div style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: 12, margin: "2px 0 10px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>Edit IKU</div>
      {[
        { k: "nama", label: "Nama IKU" },
        { k: "sumber_data", label: "Sumber Data" },
        { k: "aspek", label: "Aspek" }
      ].map(f => (
        <label key={f.k} style={{ display: "block", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: T.textSecondary, marginBottom: 3, display: "block" }}>{f.label}</span>
          <input value={values[f.k] || ""} onChange={e => setVal(f.k, e.target.value)}
            style={{ width: "100%", padding: "8px 11px", border: `1px solid ${T.inputBorder}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: T.inputBg, color: T.text }} />
        </label>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} style={{ padding: "7px 14px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Simpan</button>
        <button onClick={cancel} style={{ padding: "7px 12px", background: T.surfaceHover, color: T.textSecondary, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Batal</button>
      </div>
    </div>
  );
}

/* ── Pencarian global: nama IKU/IKK/Data Sektoral + aspek ──────────────── */
const KIND_META = {
  iku:      { label: "IKU",           icon: "layers", conf: LEVEL_CONF.iku },
  ikk:      { label: "IKK",           icon: "list",   conf: LEVEL_CONF.ikk },
  sektoral: { label: "Data Sektoral", icon: "chart",  conf: LEVEL_CONF.sektoral }
};

function SearchResults({ tree, q, T }) {
  const nq = q.trim().toLowerCase();
  const hits = [];
  for (const b of tree) for (const o of b.opds) {
    const path = `${b.nama} → ${o.nama}`;
    for (const s of o.sektorals) for (const ind of s.indikator) {
      if (`${ind.indikator} ${ind.aspek || ""}`.toLowerCase().includes(nq)) {
        hits.push({ kind: "sektoral", path, name: ind.indikator, meta: ind.sumber_data ? `Sumber: ${ind.sumber_data}` : "", rows: ind.nilai, id: `s${ind.id}` });
      }
    }
    for (const iku of o.ikus) {
      if (`${iku.nama} ${iku.aspek || ""} ${iku.sumber_data || ""}`.toLowerCase().includes(nq)) {
        hits.push({
          kind: "iku", path, name: iku.nama, id: `i${iku.id}`,
          meta: [iku.sumber_data ? `Sumber: ${iku.sumber_data}` : "", iku.aspek ? `Aspek: ${iku.aspek}` : ""].filter(Boolean).join(" · "),
          rows: iku.nilai, ikks: iku.ikks
        });
      }
      for (const ikk of (iku.ikks || [])) {
        if (`${ikk.nama} ${ikk.aspek || ""} ${ikk.sumber_data || ""}`.toLowerCase().includes(nq)) {
          hits.push({
            kind: "ikk", path: `${path} → ${iku.nama}`, name: ikk.nama, id: `k${ikk.id}`,
            meta: [ikk.sumber_data ? `Sumber: ${ikk.sumber_data}` : "", ikk.aspek ? `Aspek: ${ikk.aspek}` : ""].filter(Boolean).join(" · "),
            rows: ikk.nilai
          });
        }
      }
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>
        Hasil pencarian "<span style={{ color: T.primary }}>{q.trim()}</span>" · {hits.length} hasil
      </div>
      {hits.length === 0 && (
        <div style={{ background: T.card, borderRadius: 12, padding: 24, color: T.textMuted, fontSize: 13, border: `1px solid ${T.border}` }}>
          Tidak ada hasil. Coba nama IKU / IKK / Data Sektoral lain, atau aspek.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hits.map((h, i) => (
          <div key={h.id + i} style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.primaryLight, color: T.primary, borderRadius: 99, padding: "3px 9px", fontSize: 10, fontWeight: 700 }}>
                <Icon name={KIND_META[h.kind].icon} size={11} /> {KIND_META[h.kind].label}
              </span>
              <span style={{ fontSize: 11, color: T.textMuted }}>{h.path}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>{h.name}</div>
            {h.meta && <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>{h.meta}</div>}
            {h.kind === "iku" ? (
              <>
                <ValueSummary rows={h.rows} conf={KIND_META.iku.conf} T={T} />
                <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 6 }}>
                  {h.ikks && h.ikks.length ? h.ikks.map(k => k.nama).join(" · ") : "Belum ada IKK."}
                </div>
              </>
            ) : (
              <ValueSummary rows={h.rows} conf={KIND_META[h.kind].conf} T={T} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueSummary({ rows, conf, T }) {
  if (!rows || rows.length === 0) return <span style={{ fontSize: 11, color: T.textMuted }}>Belum ada nilai.</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {rows.map(r => (
        <span key={r.id} style={{ background: T.surfaceHover, borderRadius: 99, padding: "3px 9px", fontSize: 11, color: T.text }}>
          <b>{r.tahun}·</b> {r[conf.valA.k] ?? "—"}{conf.valB && r[conf.valB.k] != null ? ` / ${r[conf.valB.k]}` : ""}
        </span>
      ))}
    </div>
  );
}