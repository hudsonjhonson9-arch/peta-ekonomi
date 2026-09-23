import { useState, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import useResponsive from "../useResponsive.js";
import { ThemeContext } from "../App.jsx";

const LEVELS = {
  opd:    { icon: "building", label: "OPD",     parentKey: "bidang_id", end: "/api/bankdata/opd",    fields: ["nama"] },
  iku:    { icon: "layers",   label: "IKU",     parentKey: "opd_id",    end: "/api/bankdata/iku",    fields: ["nama"] },
  ikk:    { icon: "list",     label: "IKK",     parentKey: "iku_id",    end: "/api/bankdata/ikk",    fields: ["nama"] },
  detail: { icon: "file",     label: "Detail",  parentKey: "ikk_id",    end: "/api/bankdata/detail", fields: ["indikator", "data", "sumber_data", "aspek", "tahun"] }
};

const FIELDS = {
  nama:         { label: "Nama",  ph: "Nama..." },
  indikator:    { label: "Indikator", ph: "Nama indikator" },
  data:         { label: "Data",  ph: "Nilai / data" },
  sumber_data:  { label: "Sumber Data", ph: "Contoh: BPS, Dinas..." },
  aspek:        { label: "Aspek", ph: "Aspek penilaian" },
  tahun:        { label: "Tahun", ph: "2024" }
};

export default function BankData({ showToast }) {
  const { T } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();
  const { data: bidang = [], isLoading } = useQuery({
    queryKey: ['bankdata'],
    queryFn: () => fetch('/api/bankdata').then(r => r.json())
  });

  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState(null); // { level, parentId, editId, values }
  const [savedKey, setSavedKey] = useState(null);

  const reload = () => queryClient.invalidateQueries({ queryKey: ['bankdata'] });

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const openAdd = (level, parentId) => {
    setForm({ level, parentId, editId: null, values: {} });
    setSavedKey(null);
  };
  const openEdit = (level, node, parentId) => {
    const values = {};
    for (const f of LEVELS[level].fields) values[f] = node[f] ?? "";
    setForm({ level, parentId, editId: node.id, values });
    setSavedKey(null);
  };
  const cancelForm = () => setForm(null);

  const setValue = (key, val) => setForm(prev => prev ? { ...prev, values: { ...prev.values, [key]: val } } : prev);

  const activeLevel = form && LEVELS[form.level];

  const submit = async () => {
    if (!form) return;
    const required = form.level === "detail" ? ["indikator"] : ["nama"];
    for (const f of required) {
      if (!String(form.values[f] ?? "").trim()) return showToast(`${FIELDS[f].label} wajib diisi`);
    }
    const body = { ...form.values, [LEVELS[form.level].parentKey]: form.parentId };
    const url = LEVELS[form.level].end + (form.editId ? `/${form.editId}` : "");
    const res = await fetch(url, {
      method: form.editId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) return showToast(json.error || "Gagal menyimpan");
    setSavedKey(`${form.level}:${form.parentId}`);
    setForm(null);
    reload();
    showToast(json.message || "Berhasil disimpan");
  };

  const remove = async (level, node, parentId) => {
    if (!confirm(`Hapus ${LEVELS[level].label} "${node.nama}"? Semua data di bawahnya ikut terhapus.`)) return;
    const res = await fetch(`${LEVELS[level].end}/${node.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) return showToast(json.error || "Gagal menghapus");
    reload();
    showToast(json.message || "Berhasil dihapus");
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>Memuat data...</div>;

  const keyFor = (level, id) => `${level}:${id}`;
  const isForm = (level, parentId, editId = null) =>
    form && form.level === level && form.parentId === parentId && (form.editId ?? null) === editId;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Bank Data</div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>Kelola data per Bidang → OPD → IKU → IKK → Indikator</div>
        </div>
      </div>

      {bidang.map(b => (
        <div key={b.id} style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, marginBottom: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}
            onClick={() => toggle(keyFor("bidang", b.id))}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="building" size={16} style={{ color: T.primary }} />
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{b.nama}</span>
                <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>{b.opds.length} OPD</span>
              </div>
            </div>
            <Icon name="chevronRight" size={14} style={{ color: T.textMuted, transform: expanded[keyFor("bidang", b.id)] ? "rotate(90deg)" : "", transition: "transform .2s" }} />
          </div>

          {expanded[keyFor("bidang", b.id)] && (
            <div style={{ borderTop: `1px solid ${T.border}`, padding: 12 }}>
              <InlineAdd label="Tambah OPD" onClick={() => openAdd("opd", b.id)} show={isForm("opd", b.id)} onCancel={cancelForm}
                fields={[["nama", {}]]} values={form?.level === "opd" && form.parentId === b.id ? form.values : {}} setValue={setValue} submit={submit} saved={savedKey === `opd:${b.id}`} T={T} />

              {b.opds.map(opd => (
                <div key={opd.id} style={{ marginBottom: 8 }}>
                  <NodeHeader key={keyFor("opd", opd.id)}
                    level="opd" node={opd} count={opd.ikus.length} countLabel="IKU"
                    expanded={expanded[keyFor("opd", opd.id)]}
                    onToggle={() => toggle(keyFor("opd", opd.id))}
                    onAdd={() => openAdd("iku", opd.id)}
                    onEdit={() => openEdit("opd", opd, b.id)}
                    onDel={() => remove("opd", opd, b.id)}
                    T={T} />

                  {expanded[keyFor("opd", opd.id)] && (
                    <div style={{ padding: "4px 0 8px 18px", borderLeft: `1px solid ${T.border}`, marginLeft: 18 }}>
                      <InlineAdd label="Tambah IKU" onClick={() => openAdd("iku", opd.id)} show={isForm("iku", opd.id)} onCancel={cancelForm}
                        fields={[["nama", {}]]} values={form?.level === "iku" && form.parentId === opd.id ? form.values : {}} setValue={setValue} submit={submit} saved={savedKey === `iku:${opd.id}`} T={T} />

                      {opd.ikus.map(iku => (
                        <div key={iku.id} style={{ marginBottom: 8 }}>
                          <NodeHeader level="iku" node={iku} count={iku.ikks.length} countLabel="IKK"
                            expanded={expanded[keyFor("iku", iku.id)]}
                            onToggle={() => toggle(keyFor("iku", iku.id))}
                            onAdd={() => openAdd("ikk", iku.id)}
                            onEdit={() => openEdit("iku", iku, opd.id)}
                            onDel={() => remove("iku", iku, opd.id)}
                            T={T} />

                          {expanded[keyFor("iku", iku.id)] && (
                            <div style={{ padding: "4px 0 8px 18px", borderLeft: `1px solid ${T.border}`, marginLeft: 18 }}>
                              <InlineAdd label="Tambah IKK" onClick={() => openAdd("ikk", iku.id)} show={isForm("ikk", iku.id)} onCancel={cancelForm}
                                fields={[["nama", {}]]} values={form?.level === "ikk" && form.parentId === iku.id ? form.values : {}} setValue={setValue} submit={submit} saved={savedKey === `ikk:${iku.id}`} T={T} />

                              {iku.ikks.map(ikk => (
                                <div key={ikk.id} style={{ marginBottom: 8 }}>
                                  <NodeHeader level="ikk" node={ikk} count={ikk.details.length} countLabel="Detail"
                                    expanded={expanded[keyFor("ikk", ikk.id)]}
                                    onToggle={() => toggle(keyFor("ikk", ikk.id))}
                                    onAdd={() => openAdd("detail", ikk.id)}
                                    onEdit={() => openEdit("ikk", ikk, iku.id)}
                                    onDel={() => remove("ikk", ikk, iku.id)}
                                    T={T} />

                                  {expanded[keyFor("ikk", ikk.id)] && (
                                    <div style={{ padding: "4px 0 8px 18px", borderLeft: `1px solid ${T.border}`, marginLeft: 18 }}>
                                      <InlineAdd label="Tambah Detail" onClick={() => openAdd("detail", ikk.id)} show={isForm("detail", ikk.id)} onCancel={cancelForm}
                                        fields={[["indikator", {}], ["data", {}], ["sumber_data", {}], ["aspek", {}], ["tahun", { type: "number" }]]}
                                        values={form?.level === "detail" && form.parentId === ikk.id ? form.values : {}} setValue={setValue} submit={submit} saved={savedKey === `detail:${ikk.id}`} T={T} />

                                      {ikk.details.length === 0 && (
                                        <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 2px" }}>Belum ada detail indikator.</div>
                                      )}

                                      {ikk.details.map((d, idx) => (
                                        <DetailRow key={d.id} d={d} idx={idx}
                                          isForm={isForm("detail", ikk.id, d.id)}
                                          onEdit={() => openEdit("detail", d, ikk.id)}
                                          onDel={() => remove("detail", d, ikk.id)}
                                          values={form?.level === "detail" && form.parentId === ikk.id ? form.values : {}}
                                          setValue={setValue} submit={submit} cancel={cancelForm} T={T} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}

                              {iku.ikks.length === 0 && (
                                <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 2px" }}>Belum ada IKK.</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {opd.ikus.length === 0 && (
                        <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 2px" }}>Belum ada IKU.</div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {b.opds.length === 0 && (
                <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 2px" }}>Belum ada OPD.</div>
              )}
            </div>
          )}
        </div>
      ))}

      {bidang.length === 0 && (
        <div style={{ background: T.card, borderRadius: 12, padding: 40, border: `1px solid ${T.border}`, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
          Belum ada data. Pastikan bidang BAPPERIDA tersedia di master Bidang.
        </div>
      )}
    </div>
  );
}

function NodeHeader({ level, node, count, countLabel, expanded, onToggle, onAdd, onEdit, onDel, T }) {
  const meta = LEVELS[level];
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", background: T.surfaceHover, borderRadius: 10, border: `1px solid ${T.border}`, cursor: "pointer" }}
      onClick={onToggle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Icon name={meta.icon} size={14} style={{ color: T.primary, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.nama}</span>
        {count > 0 && <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>({count} {countLabel})</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); onAdd(); }}
          style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}>
          <Icon name="plus" size={13} />
        </button>
        <button onClick={e => { e.stopPropagation(); onEdit(); }}
          style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}>
          <Icon name="edit" size={13} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDel(); }}
          style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex" }}>
          <Icon name="trash" size={13} />
        </button>
        <Icon name="chevronRight" size={13} style={{ color: T.textMuted, transform: expanded ? "rotate(90deg)" : "", transition: "transform .2s" }} />
      </div>
    </div>
  );
}

function InlineAdd({ label, onClick, show, onCancel, fields, values, setValue, submit, saved, T }) {
  if (!show) {
    return (
      <button onClick={onClick}
        style={{ margin: "2px 0 8px", padding: "6px 10px", background: "none", border: `1px dashed ${T.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: T.primary, cursor: "pointer" }}>
        + {label}
      </button>
    );
  }
  return (
    <div style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: 12, margin: "2px 0 10px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 8 }}>
        {fields.map(([key, opts]) => (
          <FieldInput key={key} fieldKey={key} opts={opts} value={values[key] ?? ""} setValue={setValue} T={T} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={submit} style={{ padding: "7px 14px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {saved ? "✓ Tersimpan" : "Simpan"}
        </button>
        <button onClick={onCancel} style={{ padding: "7px 12px", background: T.surfaceHover, color: T.textSecondary, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
          Batal
        </button>
      </div>
    </div>
  );
}

function DetailRow({ d, idx, isForm, onEdit, onDel, values, setValue, submit, cancel, T }) {
  if (isForm) {
    return (
      <div style={{ background: T.card, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>Edit Detail #{idx + 1}</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 8 }}>
          {Object.keys(FIELDS).map(key => (
            <FieldInput key={key} fieldKey={key} opts={key === "tahun" ? { type: "number" } : {}} value={values[key] ?? ""} setValue={setValue} T={T} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={submit} style={{ padding: "7px 14px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Simpan</button>
          <button onClick={cancel} style={{ padding: "7px 12px", background: T.surfaceHover, color: T.textSecondary, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Batal</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceHover, marginBottom: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.indikator}</div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
          {[d.data, d.sumber_data ? `Sumber: ${d.sumber_data}` : "", d.aspek ? `Aspek: ${d.aspek}` : "", d.tahun ? `Tahun ${d.tahun}` : ""].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        <button onClick={onEdit} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.textMuted, display: "flex" }}>
          <Icon name="edit" size={13} />
        </button>
        <button onClick={onDel} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: T.danger, display: "flex" }}>
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
}

function FieldInput({ fieldKey, opts, value, setValue, T }) {
  const meta = FIELDS[fieldKey];
  const isTextarea = fieldKey === "data" || fieldKey === "sumber_data" || fieldKey === "aspek";
  const common = {
    width: "100%",
    padding: "8px 11px",
    border: `1px solid ${T.inputBorder}`,
    borderRadius: 8,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    background: T.inputBg,
    color: T.text,
    fontFamily: "inherit"
  };
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 11, color: T.textSecondary, marginBottom: 3, display: "block" }}>{meta.label}</span>
      {isTextarea ? (
        <textarea value={value} onChange={e => setValue(fieldKey, e.target.value)} placeholder={meta.ph} rows={2} style={common} />
      ) : (
        <input value={value} onChange={e => setValue(fieldKey, e.target.value)} type={opts.type || "text"} placeholder={meta.ph} style={common} />
      )}
    </label>
  );
}