import { useState, useContext, Fragment } from "react";
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
  const [newTahun, setNewTahun] = useState("");
  const [form, setForm] = useState(null); // { level, parentId, type, editId, values }

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

  const saveNilai = async (level, indikatorId, tahun, valA, valB) => {
    const res = await fetch(`/api/bankdata/nilai/${level}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indikator_id: indikatorId, tahun, valA, valB })
    });
    if (!res.ok) return showToast((await res.json()).error);
    reload();
  };

  const saveTriwulan = async (level, indikatorId, tahun, tw) => {
    const res = await fetch(`/api/bankdata/triwulan/${level}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indikator_id: indikatorId, tahun, tw })
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

  const ikusDesc = (iku) => `${iku.indikator.length} indikator${iku.ikks.some(k => k.indikator.length) ? `, ${iku.ikks.reduce((s, k) => s + k.indikator.length, 0)} IKK` : ""}`;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Bank Data</div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>Input terarah: Bidang → OPD → IKU → IKK, dan Data Sektoral per OPD</div>
      </div>

      {/* Tahun global */}
      <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>Daftar Tahun</div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 10 }}>
          Tahun dipakai untuk semua indikator (target, capaian, realisasi, dan data sektoral).
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

      {/* Tree */}
      {tree.map(b => (
        <div key={b.id} style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, marginBottom: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}
            onClick={() => toggle(`b${b.id}`)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="building" size={16} style={{ color: T.primary }} />
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{b.nama}</span>
                <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{b.opds.length} OPD</span>
              </div>
            </div>
            <Icon name="chevronRight" size={14} style={{ color: T.textMuted, transform: expanded[`b${b.id}`] ? "rotate(90deg)" : "", transition: "transform .2s" }} />
          </div>

          {expanded[`b${b.id}`] && (
            <div style={{ borderTop: `1px solid ${T.border}`, padding: 12 }}>
              {/* Tambah OPD */}
              <InlineEntityAdd label="Tambah OPD" show={form && form.level === "opd" && form.parentId === b.id && !form.editId}
                onOpen={() => openFormForEntity("opd", b.id)} onCancel={cancelForm} T={T} form={form} setVal={(k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p)}
                title="OPD baru" fields={[{ k: "nama", label: "Nama OPD" }]} submit={async () => {
                  const body = { bidang_id: b.id, nama: (form.values.nama || "").trim() };
                  if (!body.nama) return showToast("Nama OPD wajib diisi");
                  const res = await fetch('/api/bankdata/opd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                  if (!res.ok) return showToast((await res.json()).error);
                  setForm(null); reload(); showToast("OPD ditambahkan");
                }} />

              {b.opds.map(o => (
                <div key={o.id} style={{ marginBottom: 8 }}>
                  <EntityHead level="opd" node={o} expandedKey={`o${o.id}`} expanded={expanded[`o${o.id}`]} onToggle={() => toggle(`o${o.id}`)}
                    extraCount={`${o.ikus.length} IKU · ${o.sektorals.length} DS`}
                    onEdit={() => openFormForEntity("opd", b.id, o.id, { nama: o.nama })}
                    onDel={() => delEntity("opd", o.id, o.nama, "OPD")} T={T} />

                  {expanded[`o${o.id}`] && (
                    <div style={{ padding: "4px 0 8px 18px", borderLeft: `1px solid ${T.border}`, marginLeft: 18 }}>
                      {/* Data Sektoral */}
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, margin: "10px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="chart" size={13} style={{ color: T.primary }} /> DATA SEKTORAL
                      </div>
                      <InlineEntityAdd label="Tambah Data Sektoral" show={form && form.level === "sektoral-ent" && form.parentId === o.id && !form.editId}
                        onOpen={() => openFormForEntity("sektoral-ent", o.id)} onCancel={cancelForm} T={T} form={form} setVal={(k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p)}
                        title="Data Sektoral baru" fields={[{ k: "nama", label: "Nama Data Sektoral" }]} submit={async () => {
                          const body = { opd_id: o.id, nama: (form.values.nama || "").trim() };
                          if (!body.nama) return showToast("Nama wajib diisi");
                          const res = await fetch('/api/bankdata/sektoral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                          if (!res.ok) return showToast((await res.json()).error);
                          setForm(null); reload(); showToast("Data Sektoral ditambahkan");
                        }} />
                      {o.sektorals.map(s => (
                        <div key={s.id} style={{ marginBottom: 8 }}>
                          <EntityHead level="sektoral" node={s} expandedKey={`s${s.id}`} expanded={expanded[`s${s.id}`]} onToggle={() => toggle(`s${s.id}`)}
                            extraCount={`${s.indikator.length} indikator`}
                            onEdit={() => openFormForEntity("sektoral-ent", o.id, s.id, { nama: s.nama })}
                            onDel={() => delEntity("sektoral", s.id, s.nama, "Data Sektoral")} T={T} />
                          {expanded[`s${s.id}`] && (
                            <div style={{ padding: "4px 0 8px 18px", borderLeft: `1px solid ${T.border}`, marginLeft: 18 }}>
                              <IndikatorPanel level="sektoral" parentId={s.id} parentLabel="Data Sektoral"
                                list={s.indikator} tahunList={keys} form={form} setForm={setForm} openForm={openForm} cancelForm={cancelForm} submitIndikator={submitIndikator}
                                onSaveNilai={(indId, tahun, valA, valB) => saveNilai("sektoral", indId, tahun, valA, valB)}
                                onSaveTw={(indId, tahun, tw) => saveTriwulan("sektoral", indId, tahun, tw)}
                                onDelInd={(id, nama) => delIndikator("sektoral", id, nama)} T={T} />
                            </div>
                          )}
                        </div>
                      ))}
                      {o.sektorals.length === 0 && <div style={{ fontSize: 12, color: T.textMuted, padding: "4px 2px 8px" }}>Belum ada data sektoral.</div>}

                      {/* IKU */}
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, margin: "10px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="layers" size={13} style={{ color: T.primary }} /> IKU (INDIKATOR KINERJA UTAMA)
                      </div>
                      <InlineEntityAdd label="Tambah IKU" show={form && form.level === "iku" && form.parentId === o.id && !form.editId}
                        onOpen={() => openFormForEntity("iku", o.id)} onCancel={cancelForm} T={T} form={form} setVal={(k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p)}
                        title="IKU baru" fields={[{ k: "nama", label: "Nama IKU" }]} submit={async () => {
                          const body = { opd_id: o.id, nama: (form.values.nama || "").trim() };
                          if (!body.nama) return showToast("Nama IKU wajib diisi");
                          const res = await fetch('/api/bankdata/iku', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                          if (!res.ok) return showToast((await res.json()).error);
                          setForm(null); reload(); showToast("IKU ditambahkan");
                        }} />

                      {o.ikus.map(iku => (
                        <div key={iku.id} style={{ marginBottom: 8 }}>
                          <EntityHead level="iku" node={iku} expandedKey={`i${iku.id}`} expanded={expanded[`i${iku.id}`]} onToggle={() => toggle(`i${iku.id}`)}
                            extraCount={ikusDesc(iku)}
                            onEdit={() => openFormForEntity("iku", o.id, iku.id, { nama: iku.nama })}
                            onDel={() => delEntity("iku", iku.id, iku.nama, "IKU")} T={T} />

                          {expanded[`i${iku.id}`] && (
                            <div style={{ padding: "4px 0 8px 18px", borderLeft: `1px solid ${T.border}`, marginLeft: 18 }}>
                              {/* Indikator IKU */}
                              <IndikatorPanel level="iku" parentId={iku.id} parentLabel="IKU"
                                list={iku.indikator} tahunList={keys} form={form} setForm={setForm} openForm={openForm} cancelForm={cancelForm} submitIndikator={submitIndikator}
                                onSaveNilai={(indId, tahun, valA, valB) => saveNilai("iku", indId, tahun, valA, valB)}
                                onSaveTw={(indId, tahun, tw) => saveTriwulan("iku", indId, tahun, tw)}
                                onDelInd={(id, nama) => delIndikator("iku", id, nama)} T={T} />

                              {/* IKK di bawah IKU */}
                              <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, margin: "10px 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
                                <Icon name="list" size={13} style={{ color: T.primary }} /> IKK (INDIKATOR KINERJA KUNCI)
                              </div>
                              <InlineEntityAdd label="Tambah IKK" show={form && form.level === "ikk" && form.parentId === iku.id && !form.editId}
                                onOpen={() => openFormForEntity("ikk", iku.id)} onCancel={cancelForm} T={T} form={form} setVal={(k, v) => setForm(p => p ? { ...p, values: { ...p.values, [k]: v } } : p)}
                                title="IKK baru" fields={[{ k: "nama", label: "Nama IKK" }]} submit={async () => {
                                  const body = { iku_id: iku.id, nama: (form.values.nama || "").trim() };
                                  if (!body.nama) return showToast("Nama IKK wajib diisi");
                                  const res = await fetch('/api/bankdata/ikk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                                  if (!res.ok) return showToast((await res.json()).error);
                                  setForm(null); reload(); showToast("IKK ditambahkan");
                                }} />

                              {iku.ikks.map(ikk => (
                                <div key={ikk.id} style={{ marginBottom: 8 }}>
                                  <EntityHead level="ikk" node={ikk} expandedKey={`k${ikk.id}`} expanded={expanded[`k${ikk.id}`]} onToggle={() => toggle(`k${ikk.id}`)}
                                    extraCount={`${ikk.indikator.length} indikator`}
                                    onEdit={() => openFormForEntity("ikk", iku.id, ikk.id, { nama: ikk.nama })}
                                    onDel={() => delEntity("ikk", ikk.id, ikk.nama, "IKK")} T={T} />
                                  {expanded[`k${ikk.id}`] && (
                                    <div style={{ padding: "4px 0 8px 18px", borderLeft: `1px solid ${T.border}`, marginLeft: 18 }}>
                                      <IndikatorPanel level="ikk" parentId={ikk.id} parentLabel="IKK"
                                        list={ikk.indikator} tahunList={keys} form={form} setForm={setForm} openForm={openForm} cancelForm={cancelForm} submitIndikator={submitIndikator}
                                        onSaveNilai={(indId, tahun, valA, valB) => saveNilai("ikk", indId, tahun, valA, valB)}
                                        onSaveTw={(indId, tahun, tw) => saveTriwulan("ikk", indId, tahun, tw)}
                                        onDelInd={(id, nama) => delIndikator("ikk", id, nama)} T={T} />
                                    </div>
                                  )}
                                </div>
                              ))}
                              {iku.ikks.length === 0 && <div style={{ fontSize: 12, color: T.textMuted, padding: "4px 2px 8px" }}>Belum ada IKK.</div>}
                            </div>
                          )}
                        </div>
                      ))}
                      {o.ikus.length === 0 && <div style={{ fontSize: 12, color: T.textMuted, padding: "4px 2px 8px" }}>Belum ada IKU.</div>}
                    </div>
                  )}
                </div>
              ))}
              {b.opds.length === 0 && <div style={{ fontSize: 12, color: T.textMuted, padding: "4px 2px 8px" }}>Belum ada OPD.</div>}
            </div>
          )}
        </div>
      ))}

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
                    {[ind.sumber_data ? `Sumber: ${ind.sumber_data}` : "", ind.aspek ? `Aspek: ${ind.aspek}` : ""].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => openForm(level, parentId, ind.id, { indikator: ind.indikator, sumber_data: ind.sumber_data || "", aspek: ind.aspek || "" })}
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