import { useState, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";
import { api, usePksTree, usePksTahun } from "../hooks.js";

const LEVELS = {
  program:     { label: "Program",     parent: null,          kunci: "program_id" },
  kegiatan:    { label: "Kegiatan",    parent: "program",     kunci: "kegiatan_id" },
  subkegiatan: { label: "Sub Kegiatan", parent: "kegiatan",    kunci: "kegiatan_id" },
};

export default function PksAdmin({ tahun, showToast }) {
  const { T } = useContext(ThemeContext);
  const qc = useQueryClient();
  const { data: tree, isLoading, isError } = usePksTree(tahun);
  const { data: tahunList = [] } = usePksTahun();
  const [form, setForm] = useState(null); // { level, mode, row, parentId, parentLabel }
  const [sibuk, setSibuk] = useState(false);

  const reload = () => {
    qc.invalidateQueries({ queryKey: ["pks-tree", tahun] });
    qc.invalidateQueries({ queryKey: ["pks-ringkasan", tahun] });
  };

  const bukaTambah = (level, parentId, parentLabel) =>
    setForm({ level, mode: "tambah", row: null, parentId, parentLabel });

  const bukaEdit = (level, row) =>
    setForm({ level, mode: "edit", row, parentId: row[LEVELS[level].kunci] ?? null });

  const tutup = () => setForm(null);

  const hapus = async (level, row) => {
    const konfirm = window.confirm(
      `Hapus ${LEVELS[level].label} "${row.nama}"?\n\n` +
      `Kalau masih ada data di bawahnya, server akan menolak dan Anda harus hapus yang paling bawah dulu.`
    );
    if (!konfirm) return;
    try {
      await api(`/api/pks/${level}/${row.id}`, "DELETE");
      reload();
      showToast(`${LEVELS[level].label} "${row.nama}" dihapus.`);
    } catch (err) {
      showToast(await pesanError(err, "Gagal menghapus"));
    }
  };

  if (isError) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
        <Icon name="alert" size={20} style={{ color: "#DC2626" }} />
        <div style={{ marginTop: 8 }}>Tidak bisa memuat struktur PKS. Pastikan migration <code>tahap_2.sql</code> sudah jalan.</div>
      </div>
    );
  }

  const total = hitungTotal(tree?.tree || []);

  return (
    <div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="layers" size={14} style={{ color: T.primary }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Struktur PKS {tahun}</span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
              {total.program} program · {total.kegiatan} kegiatan · {total.sub} sub kegiatan
              {tahunList.length > 0 && ` · tahun tersedia: ${tahunList.join(", ")}`}
            </div>
          </div>
          <button onClick={() => bukaTambah("program", null, null)} style={btn(T, T.primary, "#fff")}>
            <Icon name="plus" size={13} /> Tambah Program
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 10, lineHeight: 1.6 }}>
          Kode rekening/sub kegiatan mengikuti format resmi. Sistem mengurutkan dengan kolom
          <b> urutan</b> (isi otomatis), bukan urutan teks, supaya kode seperti 5.10 tetap muncul
          setelah 5.09. Menambah tahun baru cukup lewat &ldquo;Tambah Program&rdquo; — tahun
          didaftarkan otomatis.
        </div>
      </div>

      {form && (
        <FormPois
          form={form}
          tahun={tahun}
          tree={tree?.tree || []}
          sibuk={sibuk}
          setSibuk={setSibuk}
          onTutup={tutup}
          onSelesai={() => { tutup(); reload(); }}
          showToast={showToast}
        />
      )}

      {isLoading && <div style={{ fontSize: 13, color: T.textMuted, padding: 12 }}>Memuat struktur…</div>}

      {!isLoading && (tree?.tree || []).length === 0 && (
        <div style={{ background: T.card, border: `1px dashed ${T.inputBorder}`, borderRadius: 12, padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
          Belum ada program untuk {tahun}. Mulai dengan &ldquo;Tambah Program&rdquo;.
        </div>
      )}

      {(tree?.tree || []).map(p => (
        <Node key={p.id} T={T} level="program" row={p} canEdit={true}
          onTambah={(lvl, pid, label) => bukaTambah(lvl, pid, label)}
          onEdit={lvl => bukaEdit(lvl, p)}
          onHapus={lvl => hapus(lvl, p)}>
          {p.kegiatan.map(k => (
            <Node key={k.id} T={T} level="kegiatan" row={k} kodeKonteks={p.kode}
              onTambah={(lvl, pid, label) => bukaTambah(lvl, pid, label)}
              onEdit={lvl => bukaEdit(lvl, k)}
              onHapus={lvl => hapus(lvl, k)}>
              {k.subkegiatan.map(s => (
                <Node key={s.id} T={T} level="subkegiatan" row={s} kodeKonteks={k.kode}
                  onTambah={(lvl, pid, label) => bukaTambah(lvl, pid, label)}
                  onEdit={lvl => bukaEdit(lvl, s)}
                  onHapus={lvl => hapus(lvl, s)}>
                  {s.outputs.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {s.outputs.map(o => (
                        <span key={o.id} style={{
                          fontSize: 10.5, padding: "2px 7px", borderRadius: 999,
                          background: T.surfaceHover, color: T.textSecondary, border: `1px solid ${T.border}`,
                        }}>
                          {o.nama} <span style={{ opacity: 0.6 }}>· {o.frekuensi} · target {o.target_per_tahun}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </Node>
              ))}
            </Node>
          ))}
        </Node>
      ))}
    </div>
  );
}

function hitungTotal(tree) {
  let program = 0, kegiatan = 0, sub = 0;
  for (const p of tree) {
    program++;
    for (const k of p.kegiatan || []) {
      kegiatan++;
      sub += (k.subkegiatan || []).length;
    }
  }
  return { program, kegiatan, sub };
}

function Node({ T, level, row, kodeKonteks, children, onTambah, onEdit, onHapus }) {
  const cfg = LEVELS[level];
  const [buka, setBuka] = useState(level === "program");
  const ICON = { program: "layers", kegiatan: "list", subkegiatan: "file" }[level];
  const punyaAnak = (row.kegiatan || []).length > 0 || (row.subkegiatan || []).length > 0;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
        border: `1px solid ${T.border}`, borderRadius: 8, background: T.surfaceHover,
      }}>
        {punyaAnak ? (
          <button onClick={() => setBuka(b => !b)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: T.textMuted }}>
            <Icon name="chevronRight" size={12} style={{ transform: buka ? "rotate(90deg)" : "", transition: "transform .2s" }} />
          </button>
        ) : <span style={{ width: 12 }} />}

        <Icon name={ICON} size={13} style={{ color: T.primary, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: T.textMuted, flexShrink: 0 }}>{row.kode}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text, flex: 1, minWidth: 0 }}>{row.nama}</span>

        {level === "subkegiatan" && (row.indikator || row.target) && (
          <span style={{ fontSize: 10.5, color: T.textMuted, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.indikator}{row.target ? ` · ${row.target}` : ""}
          </span>
        )}

        <span style={{ display: "flex", gap: 4 }}>
          {cfg.parent && (
            <button onClick={() => onTambah(cfg.parent, row.id, row.nama)} title={`Tambah ${LEVELS[cfg.parent].label}`} style={btnIcon(T)}>
              <Icon name="plus" size={12} />
            </button>
          )}
          <button onClick={() => onEdit(level)} title="Ubah" style={btnIcon(T)}>
            <Icon name="edit" size={12} />
          </button>
          <button onClick={() => onHapus(level)} title="Hapus" style={btnIcon(T)}>
            <Icon name="trash" size={12} />
          </button>
        </span>
      </div>

      {buka && children && (
        <div style={{ margin: "6px 0 0 20px", paddingLeft: 10, borderLeft: `1px solid ${T.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FormPois({ form, tahun, tree, sibuk, setSibuk, onTutup, onSelesai, showToast }) {
  const { T } = useContext(ThemeContext);
  const cfg = LEVELS[form.level];
  const [nama, setNama] = useState(form.row?.nama || "");
  const [kode, setKode] = useState(form.row?.kode || "");
  const [indikator, setIndikator] = useState(form.row?.indikator || "");
  const [target, setTarget] = useState(form.row?.target || "");
  const [parentId, setParentId] = useState(String(form.parentId || ""));

  useEffect(() => {
    setNama(form.row?.nama || "");
    setKode(form.row?.kode || "");
    setIndikator(form.row?.indikator || "");
    setTarget(form.row?.target || "");
    setParentId(String(form.parentId || ""));
  }, [form.level, form.row?.id, form.parentId]);

  const opsiParent = opsiUntuk(form.level, form.parentId, tree);

  const submit = async e => {
    e.preventDefault();
    if (sibuk) return;
    if (!nama.trim()) return showToast("Nama wajib diisi.");
    if (!kode.trim()) return showToast("Kode wajib diisi.");
    if (cfg.parent && !parentId) return showToast(`${cfg.label} induk wajib dipilih.`);

    setSibuk(true);
    const body = { kode: kode.trim(), nama: nama.trim() };
    if (cfg.parent) body.parent_id = parseInt(parentId, 10);
    if (form.level === "subkegiatan") {
      body.indikator = indikator.trim();
      body.target = target.trim();
    }
    if (form.mode === "tambah") body.tahun = parseInt(tahun, 10);

    try {
      const url = form.mode === "tambah"
        ? `/api/pks/${form.level}`
        : `/api/pks/${form.level}/${form.row.id}`;
      await api(url, form.mode === "tambah" ? "POST" : "PUT", body);
      showToast(form.mode === "tambah" ? `${cfg.label} ditambahkan.` : `${cfg.label} diperbarui.`);
      onSelesai();
    } catch (err) {
      showToast(await pesanError(err, "Gagal menyimpan"));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <form onSubmit={submit} style={{
      background: T.card, border: `1px solid ${T.primary}`, borderRadius: 12,
      padding: 16, marginBottom: 14,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>
        {form.mode === "tambah" ? "Tambah" : "Ubah"} {cfg.label}
        {form.parentLabel && <span style={{ fontWeight: 400, color: T.textMuted }}> — induk: {form.parentLabel}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
        <label style={labelWrap(T)}>
          <span style={labelStyle(T)}>Kode {cfg.label} *</span>
          <input value={kode} onChange={e => setKode(e.target.value)} placeholder="mis. 5.01.01.2.01.006"
            style={inputStyle(T)} />
        </label>
        <label style={labelWrap(T)}>
          <span style={labelStyle(T)}>Nama {cfg.label} *</span>
          <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama lengkap output"
            style={inputStyle(T)} />
        </label>
      </div>

      {cfg.parent && (
        <label style={{ ...labelWrap(T), marginTop: 10, display: "block" }}>
          <span style={labelStyle(T)}>{LEVELS[cfg.parent].label} induk *</span>
          <select value={parentId} onChange={e => setParentId(e.target.value)} style={inputStyle(T)}>
            <option value="">— pilih —</option>
            {opsiParent.map(o => <option key={o.id} value={o.id}>{o.kode} · {o.nama}</option>)}
          </select>
        </label>
      )}

      {form.level === "subkegiatan" && (
        <>
          <label style={{ ...labelWrap(T), marginTop: 10, display: "block" }}>
            <span style={labelStyle(T)}>Indikator</span>
            <input value={indikator} onChange={e => setIndikator(e.target.value)} placeholder="mis. Persentaseknota desa (opsional)"
              style={inputStyle(T)} />
          </label>
          <label style={{ ...labelWrap(T), marginTop: 10, display: "block" }}>
            <span style={labelStyle(T)}>Target</span>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="mis. 1 Dokumen / 12 Bulanan"
              style={inputStyle(T)} />
          </label>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="submit" disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </button>
        <button type="button" onClick={onTutup} style={btn(T, "transparent", T.text, false, T.inputBorder)}>Batal</button>
      </div>
    </form>
  );
}

function opsiUntuk(level, parentId, tree) {
  const out = [];
  if (level === "kegiatan") {
    for (const p of tree) out.push({ id: p.id, kode: p.kode, nama: p.nama });
  } else if (level === "subkegiatan") {
    for (const p of tree) for (const k of p.kegiatan || []) out.push({ id: k.id, kode: k.kode, nama: k.nama });
  }
  return out;
}

export async function pesanError(err, awalan = "Gagal") {
  try {
    const res = await err.json();
    return res.error || `${awalan}.`;
  } catch {
    return `${awalan} (kode ${err.message || "?"}).`;
  }
}

export const btn = (T, bg, color, disable = false, border = "none") => ({
  display: "inline-flex", alignItems: "center", gap: 5,
  background: bg, color, border, borderRadius: 8,
  padding: "6px 11px", fontSize: 12, fontWeight: 600,
  cursor: disable ? "not-allowed" : "pointer", opacity: disable ? 0.6 : 1,
  fontFamily: "inherit",
});

const btnIcon = T => ({
  background: "none", border: `1px solid ${T.inputBorder}`, color: T.textSecondary,
  borderRadius: 6, padding: "3px 5px", cursor: "pointer", display: "flex",
});

const labelWrap = T => ({ display: "block" });
const labelStyle = T => ({ display: "block", fontSize: 11, fontWeight: 600, color: T.textSecondary, marginBottom: 4 });
const inputStyle = T => ({
  width: "100%", padding: "7px 10px", border: `1px solid ${T.inputBorder}`,
  borderRadius: 8, fontSize: 12.5, outline: "none", background: T.inputBg,
  color: T.text, fontFamily: "inherit", boxSizing: "border-box",
});
