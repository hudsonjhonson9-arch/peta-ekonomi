import { useState, useContext, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";
import {
  api, usePksTree, usePksTahun, usePksRingkasan, usePksDeadlineTerdekat,
} from "../hooks.js";
import {
  FREKUENSI, DEADLINE_PRESET, DEADLINE_DEFAULT, canManageOutput,
  labelDeadline, statusPeriode, progresOutput, sisaHari, formatTanggal,
  frekuensiDariTarget, jumlahPeriode,
  STATUS_PERIODE,
} from "../data.js";
import PksAdmin, { pesanError, btn } from "./PksAdmin.jsx";

export default function KertasKerja({ user, showToast, onMulaiUpload }) {
  const { T } = useContext(ThemeContext);
  const qc = useQueryClient();
  const [tahun, setTahun] = useState(null);
  const [tab, setTab] = useState("kerja"); // kerja | pohon
  const [q, setQ] = useState("");
  const [hanyaTerlambat, setHanyaTerlambat] = useState(false);
  const [buka, setBuka] = useState(() => muatBuka("kk-buka"));
  const [formOutput, setFormOutput] = useState(null);
  const [formPeriode, setFormPeriode] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  const admin = canManageOutput(user.role);
  const { data: tahunList = [] } = usePksTahun();
  const { data: tree, isLoading, isError } = usePksTree(tahun);
  const { data: ringkasan } = usePksRingkasan(tahun);
  const { data: deadline = [] } = usePksDeadlineTerdekat();

  // Default ke tahun terbaru yang benar-benar punya data. Server mengurutkan
  // tahun terisi lebih dulu, jadi elemen pertama adalah kandidat terbaik.
  useEffect(() => {
    if (tahun == null && tahunList.length) setTahun(tahunList[0]);
  }, [tahunList, tahun]);

  const reload = () => {
    qc.invalidateQueries({ queryKey: ["pks-tree", tahun] });
    qc.invalidateQueries({ queryKey: ["pks-ringkasan", tahun] });
    qc.invalidateQueries({ queryKey: ["pks-deadline"] });
  };

  const toggle = key => setBuka(prev => {
    const next = { ...prev, [key]: !prev[key] };
    try { localStorage.setItem("kk-buka", JSON.stringify(next)); } catch { /* kuota penuh */ }
    return next;
  });

  const cari = q.trim().toLowerCase();
  const PROGRAM = (tree?.tree || []).filter(p => {
    if (!cari) return true;
    if (p.nama.toLowerCase().includes(cari) || String(p.kode).includes(cari)) return true;
    return (p.kegiatan || []).some(k =>
      k.nama.toLowerCase().includes(cari) || String(k.kode).includes(cari) ||
      (k.subkegiatan || []).some(s =>
        s.nama.toLowerCase().includes(cari) || String(s.kode).includes(cari) ||
        (s.indikator || "").toLowerCase().includes(cari) ||
        s.outputs.some(o => o.nama.toLowerCase().includes(cari))
      )
    );
  });

  const totalOutput = useMemo(
    () => (tree?.tree || []).reduce((a, p) =>
      a + p.kegiatan.reduce((b, k) => b + k.subkegiatan.reduce((c, s) => c + s.outputs.length, 0), 0), 0),
    [tree]
  );

  const belumUpload = useMemo(() => (tree?.tree || []).reduce((a, p) =>
    a + p.kegiatan.reduce((b, k) => b + k.subkegiatan.reduce((c, s) =>
      c + s.outputs.reduce((d, o) => {
        const pr = progresOutput(o);
        return d + Math.max(0, pr.total - pr.terisi);
      }, 0), 0), 0), 0
  ), [tree]);

  return (
    <div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="checkCircle" size={14} style={{ color: T.primary }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Kertas Kerja</span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
              Program → Kegiatan → Sub Kegiatan → Output · {totalOutput} output, {belumUpload} periode wajib belum terisi
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={tahun ?? ""} onChange={e => setTahun(parseInt(e.target.value, 10))}
              style={{
                padding: "6px 9px", border: `1px solid ${T.inputBorder}`, borderRadius: 8,
                fontSize: 12, background: T.inputBg, color: T.text, fontFamily: "inherit",
              }}>
              {[...new Set([tahun, ...tahunList].filter(Boolean))].sort((a, b) => b - a).map(y =>
                <option key={y} value={y}>{y}</option>
              )}
            </select>
            {admin && (
              <div style={{ display: "flex", background: T.surfaceHover, borderRadius: 8, padding: 2, border: `1px solid ${T.border}` }}>
                {[["kerja", "Kertas Kerja"], ["pohon", "Struktur"]].map(([v, l]) => (
                  <button key={v} onClick={() => setTab(v)} style={{
                    padding: "5px 10px", fontSize: 11.5, fontWeight: 600, fontFamily: "inherit",
                    border: "none", borderRadius: 6, cursor: "pointer",
                    background: tab === v ? T.primary : "transparent",
                    color: tab === v ? "#fff" : T.textSecondary,
                  }}>{l}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {tab === "pohon" && admin
        ? <PksAdmin tahun={tahun} showToast={showToast} />
        : (
        <>
          <Ringkasan T={T} r={ringkasan} tahun={tahun} isLoading={isLoading} />

          {deadline.length > 0 && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Icon name="clock" size={14} style={{ color: "#EA580C" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Deadline 14 hari ke depan</span>
                <span style={{ fontSize: 11, color: T.textMuted }}>({deadline.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {deadline.slice(0, 6).map(d => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", color: T.textMuted, fontSize: 11, flexShrink: 0 }}>{d.sub_kode}</span>
                    <span style={{ color: T.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.output}</span>
                    <span style={{ color: T.textSecondary, fontSize: 11, flexShrink: 0 }}>{d.periode_label}</span>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, flexShrink: 0,
                      color: d.lewat ? "#DC2626" : "#EA580C",
                      background: d.lewat ? "#FEF2F2" : "#FFF7ED",
                    }}>
                      {d.lewat ? `lewat ${Math.abs(sisaHari(d.deadline))} hari` : `${sisaHari(d.deadline)} hari lagi`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
              <Icon name="search" size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
              <input value={q} onChange={e => setQ(e.target.value)}
                placeholder="Cari kode atau nama program, kegiatan, sub kegiatan, output…"
                style={{
                  width: "100%", padding: "8px 12px 8px 32px", border: `1px solid ${T.inputBorder}`,
                  borderRadius: 8, fontSize: 12.5, outline: "none", boxSizing: "border-box",
                  background: T.inputBg, color: T.text, fontFamily: "inherit",
                }} />
            </div>
            <button onClick={() => setHanyaTerlambat(v => !v)} style={{
              ...btn(T, hanyaTerlambat ? T.primary : T.card, hanyaTerlambat ? "#fff" : T.textSecondary, false, T.inputBorder),
            }}>
              <Icon name="alert" size={13} /> Belum terisi
            </button>
          </div>

          {isError && (
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
              <Icon name="alert" size={20} style={{ color: "#DC2626" }} />
              <div style={{ marginTop: 8 }}>Tidak bisa memuat data Kertas Kerja. Pastikan migration <code>tahap_2.sql</code> sudah dijalankan.</div>
            </div>
          )}

          {(tahun == null || isLoading) && <div style={{ fontSize: 13, color: T.textMuted, padding: 12 }}>Memuat data…</div>}

          {tahun != null && !isLoading && !isError && PROGRAM.length === 0 && (
            <div style={{ background: T.card, border: `1px dashed ${T.inputBorder}`, borderRadius: 12, padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
              {cari
                ? "Tidak ada yang cocok dengan pencarian."
                : admin
                  ? `Belum ada struktur PKS untuk ${tahun}. Buat dulu di tab Struktur.`
                  : `Belum ada data Kertas Kerja untuk ${tahun}. Hubungi Admin.`}
            </div>
          )}

          {PROGRAM.map(p => (
            <Panel key={`p${p.id}`} T={T} buka={!!buka[`p${p.id}`]} onToggle={() => toggle(`p${p.id}`)}
              force={!!cari} ikon="layers" kode={p.kode} nama={p.nama}>
              {p.kegiatan.map(k => (
                <Panel key={`k${k.id}`} T={T} buka={!!buka[`k${k.id}`]} onToggle={() => toggle(`k${k.id}`)}
                  force={!!cari} ikon="list" kode={k.kode} nama={k.nama} indent>
                  {k.subkegiatan.map(s => (
                    <SubKey
                      key={`s${s.id}`} T={T} sub={s} tahun={tahun} admin={admin} user={user}
                      buka={!!buka[`s${s.id}`]} onToggle={() => toggle(`s${s.id}`)} force={!!cari}
                      hanyaTerlambat={hanyaTerlambat} cari={cari}
                      onTambahOutput={() => setFormOutput({ mode: "tambah", output: null, sub: s, tahun })}
                      onEditOutput={o => setFormOutput({ mode: "edit", output: o, sub: s, tahun })}
                      onEditPeriode={(o, p) => setFormPeriode({ output: o, periode: p, tahun })}
                      onMulaiUpload={onMulaiUpload} showToast={showToast}
                      reload={reload} sibuk={sibuk} setSibuk={setSibuk}
                    />
                  ))}
                </Panel>
              ))}
            </Panel>
          ))}
        </>
      )}

      {formOutput && (
        <FormOutput form={formOutput} admin={admin} user={user} sibuk={sibuk} setSibuk={setSibuk}
          onTutup={() => setFormOutput(null)}
          onSelesai={() => { setFormOutput(null); reload(); }}
          showToast={showToast} />
      )}

      {formPeriode && (
        <FormPeriode form={formPeriode} sibuk={sibuk} setSibuk={setSibuk}
          onTutup={() => setFormPeriode(null)}
          onSelesai={() => { setFormPeriode(null); reload(); }}
          showToast={showToast} />
      )}
    </div>
  );
}

function muatBuka(kunci) {
  try { return JSON.parse(localStorage.getItem(kunci)) || {}; } catch { return {}; }
}

// ── Ringkasan angka (COUNT dari Postgres datang sebagai string) ───────────
function Ringkasan({ T, r, tahun, isLoading }) {
  const wajib = Number(r?.wajib || 0);
  const terisi = Number(r?.terisi || 0);
  const terlambat = Number(r?.terlambat || 0);
  const mauDeadline = Number(r?.mauDeadline || 0);
  const persen = wajib ? Math.round((terisi / wajib) * 100) : 0;

  const kartu = [
    { label: "Output", nilai: Number(r?.output || 0), warna: T.text, ikon: "file" },
    { label: "Sub kegiatan", nilai: Number(r?.subkegiatan || 0), warna: T.text, ikon: "layers" },
    { label: "Terlambat", nilai: terlambat, warna: "#DC2626", ikon: "alert" },
    { label: "Jatuh tempo ≤3 hari", nilai: mauDeadline, warna: "#EA580C", ikon: "clock" },
  ];

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: T.textSecondary }}>Kelengkapan periode wajib {tahun}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 2 }}>
            {terisi} <span style={{ fontSize: 13, fontWeight: 500, color: T.textMuted }}>/ {wajib} terisi ({persen}%)</span>
          </div>
        </div>
        {isLoading && <span style={{ fontSize: 11.5, color: T.textMuted }}>memuat…</span>}
      </div>

      <div style={{ height: 7, background: T.surfaceHover, borderRadius: 999, margin: "10px 0 14px", overflow: "hidden" }}>
        <div style={{ width: `${persen}%`, height: "100%", background: persen >= 100 ? "#16A34A" : T.primary, borderRadius: 999, transition: "width .3s" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
        {kartu.map(k => (
          <div key={k.label} style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name={k.ikon} size={12} style={{ color: k.warna === T.text ? T.textMuted : k.warna }} />
              <span style={{ fontSize: 10.5, color: T.textMuted }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: k.warna, marginTop: 2 }}>{k.nilai}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Panel rekursif (program / kegiatan) ──────────────────────────────────
function Panel({ T, buka, onToggle, force, ikon, kode, nama, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 13px",
        border: `1px solid ${T.border}`, borderRadius: 10, cursor: "pointer",
        background: T.surfaceHover,
      }}>
        <Icon name="chevronRight" size={13} style={{ color: T.textMuted, transform: buka ? "rotate(90deg)" : "", transition: "transform .2s" }} />
        <Icon name={ikon} size={14} style={{ color: T.primary, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: T.textMuted, flexShrink: 0 }}>{kode}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1, minWidth: 0 }}>{nama}</span>
      </div>
      {(buka || force) && (
        <div style={{ margin: "6px 0 0 20px", paddingLeft: 10, borderLeft: `1px solid ${T.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Sub kegiatan + daftar output ─────────────────────────────────────────
function SubKey({ T, sub, tahun, admin, user, buka, onToggle, force, hanyaTerlambat, cari,
                  onTambahOutput, onEditOutput, onEditPeriode, onMulaiUpload, showToast, reload, sibuk, setSibuk }) {
  const outputs = sub.outputs.filter(o => {
    if (cari) return true;
    if (!hanyaTerlambat) return true;
    const pr = progresOutput(o);
    return pr.total > pr.terisi;
  });

  const lengkap = sub.outputs.length > 0 && sub.outputs.every(o => {
    const pr = progresOutput(o);
    return pr.total > 0 && pr.terisi >= pr.total;
  });

  const generateSemua = async () => {
    if (!window.confirm(
      `Buat periode untuk ${sub.outputs.length} output di sub kegiatan ini (tahun ${tahun})?\n\n` +
      `Periode yang sudah ada tidak akan diduplikasi, dan deadline yang sudah terisi dokumen tidak berubah.`
    )) return;
    setSibuk(true);
    let dibuat = 0, gagal = 0;
    for (const o of sub.outputs) {
      try {
        const r = await api(`/api/kertas-kerja/${o.id}/generate`, "POST", { tahun });
        dibuat += r.dibuat || 0;
      } catch {
        gagal += 1;
      }
    }
    setSibuk(false);
    reload();
    showToast(gagal === 0
      ? `${dibuat} periode dibuat untuk ${tahun}.`
      : `${dibuat} periode dibuat, ${gagal} output gagal.`);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
        border: `1px solid ${T.border}`, borderRadius: 9, cursor: "pointer",
      }}>
        <Icon name="chevronRight" size={12} style={{ color: T.textMuted, transform: buka ? "rotate(90deg)" : "", transition: "transform .2s" }} />
        <Icon name="file" size={13} style={{ color: T.textSecondary, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: T.textMuted, flexShrink: 0 }}>{sub.kode}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text, flex: 1, minWidth: 0 }}>{sub.nama}</span>

        {sub.indikator && (
          <span style={{ fontSize: 10.5, color: T.textMuted, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub.indikator}{sub.target ? ` · ${sub.target}` : ""}
          </span>
        )}

        {sub.outputs.length > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, flexShrink: 0,
            color: lengkap ? "#16A34A" : T.textMuted,
            background: lengkap ? "#F0FDF4" : T.surfaceHover,
            border: `1px solid ${lengkap ? "#BBF7D0" : T.border}`,
          }}>
            {sub.outputs.length} output
          </span>
        )}

        {admin && (
          <span onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={generateSemua} disabled={sibuk} title="Buat periode untuk tahun ini" style={iconBtn(T)}>
              <Icon name="calendar" size={12} />
            </button>
            <button onClick={onTambahOutput} title="Tambah output" style={iconBtn(T)}>
              <Icon name="plus" size={12} />
            </button>
          </span>
        )}
      </div>

      {(buka || force) && (
        <div style={{ margin: "6px 0 0 18px", paddingLeft: 10, borderLeft: `1px solid ${T.border}` }}>
          {sub.outputs.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 0" }}>
              Belum ada output.{admin ? ' Klik ikon "+" untuk menambah.' : " Hubungi Admin."}
            </div>
          ) : outputs.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 0" }}>
              Semua periode wajib sudah terisi.
            </div>
          ) : outputs.map(o => (
            <Output key={o.id} T={T} output={o} admin={admin} user={user} tahun={tahun}
              onEdit={() => onEditOutput(o)}
              onEditPeriode={p => onEditPeriode(o, p)}
              onMulaiUpload={onMulaiUpload}
              showToast={showToast} reload={reload} sibuk={sibuk} setSibuk={setSibuk} />
          ))}
        </div>
      )}
    </div>
  );
}

const iconBtn = T => ({
  background: "none", border: `1px solid ${T.inputBorder}`, color: T.textSecondary,
  borderRadius: 6, padding: "3px 5px", cursor: "pointer", display: "flex", fontFamily: "inherit",
});

// ── Satu output + tabel periodenya ───────────────────────────────────────
function Output({ T, output, admin, user, tahun, onEdit, onEditPeriode, onMulaiUpload, showToast, reload, sibuk, setSibuk }) {
  const pr = progresOutput(output);
  const [bukaPeriode, setBukaPeriode] = useState(true);

  const hapusOutput = async () => {
    if (!window.confirm(
      `Hapus output "${output.nama}" beserta seluruh periodenya?\n\n` +
      `Dokumen yang sudah terlanjur diunggah tidak ikut terhapus dari arsip, hanya tautan periodenya yang hilang.`
    )) return;
    try {
      await api(`/api/kertas-kerja/${output.id}`, "DELETE");
      reload();
      showToast(`Output "${output.nama}" dihapus.`);
    } catch (err) {
      showToast(await pesanError(err, "Gagal menghapus output"));
    }
  };

  const sinkronWajib = async () => {
    if (!window.confirm("Tandai ulang periode wajib berdasarkan kolom bulan wajib? Periode yang sudah terisi dokumen tidak disentuh.")) return;
    setSibuk(true);
    try {
      const r = await api(`/api/kertas-kerja/${output.id}/sinkron-wajib`, "POST", { tahun });
      reload();
      showToast(`${r.diubah} periode ditandai wajib untuk ${tahun}.`);
    } catch (err) {
      showToast(await pesanError(err, "Gagal menyinkronkan"));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 10, marginBottom: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text, flex: 1, minWidth: 180 }}>{output.nama}</span>

        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: T.surfaceHover, color: T.textSecondary, border: `1px solid ${T.border}` }}>
          {output.frekuensi}
        </span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: T.surfaceHover, color: T.textSecondary, border: `1px solid ${T.border}` }}>
          target {output.target_per_tahun}
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 110 }}>
          <div style={{ flex: 1, height: 5, background: T.surfaceHover, borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${pr.persen}%`, height: "100%", background: pr.persen >= 100 ? "#16A34A" : T.primary }} />
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: pr.persen >= 100 ? "#16A34A" : T.textMuted }}>
            {pr.terisi}/{pr.total}
          </span>
        </span>

        <button onClick={() => setBukaPeriode(b => !bukaPeriode)} style={{ ...iconBtn(T), padding: "3px 6px" }} title="Sembunyikan periode">
          <Icon name="chevronDown" size={12} style={{ transform: bukaPeriode ? "" : "rotate(-90deg)", transition: "transform .2s" }} />
        </button>

        {admin && (
          <span style={{ display: "flex", gap: 4 }}>
            <button onClick={sinkronWajib} disabled={sibuk} title="Sinkronkan periode wajib" style={iconBtn(T)}>
              <Icon name="refresh" size={12} />
            </button>
            <button onClick={onEdit} title="Ubah output" style={iconBtn(T)}>
              <Icon name="edit" size={12} />
            </button>
            <button onClick={hapusOutput} title="Hapus output" style={iconBtn(T)}>
              <Icon name="trash" size={12} />
            </button>
          </span>
        )}
      </div>

      {output.indikator && (
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{output.indikator}</div>
      )}

      {output.periods.length === 0 ? (
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 7, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="alert" size={12} style={{ color: "#D97706" }} />
          Belum ada periode {tahun}.{admin ? ' Klik ikon kalender di sub kegiatan untuk membuahkannya.' : ""}
        </div>
      ) : bukaPeriode && (
        <div style={{ marginTop: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 460 }}>
            <thead>
              <tr>
                {["Periode", "Deadline", "Status", "Dokumen", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {output.periods.map(p => <BarisPeriode key={p.id} T={T} p={p} admin={admin} reload={reload}
                judul={`${output.nama} — ${p.periode_label}`} tahun={tahun}
                onEdit={() => onEditPeriode(p)} onMulaiUpload={onMulaiUpload} showToast={showToast} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BarisPeriode({ T, p, admin, onEdit, onMulaiUpload, reload, showToast, judul, tahun }) {
  const ref = useRef(null);
  const st = statusPeriode(p);
  const meta = STATUS_PERIODE[st];
  const sisa = sisaHari(p.deadline);

  const pilihDanUnggah = e => {
    const files = e.target.files;
    if (!files || !files.length) return;
    const f = files[0];
    onMulaiUpload({ file: f, periodeId: p.id, title: judul, tahun });
    e.target.value = "";
  };

  const lepaskan = async () => {
    if (!window.confirm(`Lepas dokumen dari periode ${p.periode_label}? Dokumen tetap ada di arsip.`)) return;
    try {
      await api(`/api/kertas-kerja/periode/${p.id}`, "PATCH", { doc_id: null });
      reload();
    } catch (err) {
      showToast(await pesanError(err, "Gagal melepas dokumen"));
    }
  };

  return (
    <tr>
      <td style={{ padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.text, fontWeight: 500, whiteSpace: "nowrap" }}>
        {p.periode_label}
        {!p.is_wajib && <span style={{ fontSize: 9.5, color: T.textMuted, marginLeft: 4 }}>(opsional)</span>}
      </td>
      <td style={{ padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary, whiteSpace: "nowrap" }}>
        {formatTanggal(p.deadline)}
        {p.is_wajib && st !== "Selesai" && (
          <span style={{ fontSize: 9.5, marginLeft: 4, color: sisa < 0 ? "#DC2626" : sisa <= 3 ? "#EA580C" : T.textMuted }}>
            {sisa < 0 ? `lewat ${Math.abs(sisa)}h` : `${sisa}h`}
          </span>
        )}
      </td>
      <td style={{ padding: "5px 7px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700,
          padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap",
          color: meta.color, background: meta.color + "14",
        }}>
          <Icon name={meta.icon} size={10} style={{ color: meta.color }} />
          {meta.label}
        </span>
      </td>
      <td style={{ padding: "5px 7px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary, minWidth: 150 }}>
        {p.doc_id
          ? <span title={p.doc_judul || ""} style={{ color: T.text }}>{p.doc_judul || `Dokumen #${p.doc_id}`}</span>
          : <span style={{ color: T.textMuted }}>—</span>}
      </td>
      <td style={{ padding: "5px 7px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" }}>
        <span style={{ display: "flex", gap: 4 }}>
          {p.doc_id ? (
            <button onClick={lepaskan} title="Lepas dokumen dari periode ini" style={iconBtn(T)}>
              <Icon name="x" size={11} />
            </button>
          ) : (
            <>
              <input ref={ref} type="file" onChange={pilihDanUnggah} style={{ display: "none" }} />
              <button onClick={() => ref.current?.click()} title="Unggah dokumen untuk periode ini" style={iconBtn(T)}>
                <Icon name="upload" size={11} />
              </button>
            </>
          )}
          {admin && p.doc_id == null && (
            <button onClick={onEdit} title="Ubah deadline / catatan" style={iconBtn(T)}>
              <Icon name="clock" size={11} />
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}

// ── Form output (tambah / ubah) ──────────────────────────────────────────
function FormOutput({ form, admin, user, sibuk, setSibuk, onTutup, onSelesai, showToast }) {
  const { T } = useContext(ThemeContext);
  const o = form.output;
  const [nama, setNama] = useState(o?.nama || "");
  const [indikator, setIndikator] = useState(o?.indikator || "");
  const [frekuensi, setFrekuensi] = useState(o?.frekuensi || "Tahunan");
  const [target, setTarget] = useState(o?.target_per_tahun || 1);
  const [bulanWajib, setBulanWajib] = useState(o?.bulan_wajib || "*");
  const [deadlineRule, setDeadlineRule] = useState(o?.deadline_rule || DEADLINE_DEFAULT.Tahunan);
  const [pic, setPic] = useState(o?.pic_id || "");
  const [keterangan, setKeterangan] = useState(o?.keterangan || "");
  const [nya, setNya] = useState(false);

  const totalPeriode = jumlahPeriode(target);

  // Ganti frekuensi → ikut sesuaikan pilihan deadline yang valid.
  const gantiFrekuensi = v => {
    setFrekuensi(v);
    const opsi = DEADLINE_PRESET[v] || [];
    if (!opsi.some(d => d.value === deadlineRule)) setDeadlineRule(DEADLINE_DEFAULT[v]);
  };

  // Target = jumlah dokumen setahun, jadi frekuensi harus ikut menyesuaikan.
  const gantiTarget = v => {
    setTarget(v);
    gantiFrekuensi(frekuensiDariTarget(v));
  };

  const submit = async ev => {
    ev.preventDefault();
    if (sibuk) return;
    if (!nama.trim()) return showToast("Nama output wajib diisi.");

    setSibuk(true);
    const body = {
      nama: nama.trim(),
      indikator: indikator.trim(),
      frekuensi,
      target_per_tahun: parseInt(target, 10) || 1,
      bulan_wajib: bulanWajib.trim() || "*",
      deadline_rule: deadlineRule,
      pic_id: pic.trim() || null,
      keterangan: keterangan.trim() || null,
    };

    try {
      if (form.mode === "tambah") {
        body.subkegiatan_id = form.sub.id;
        body.tahun = form.tahun;
        body.created_by = user.name;
        const res = await api("/api/kertas-kerja", "POST", body);
        if (nya) {
          const g = await api(`/api/kertas-kerja/${res.row.id}/generate`, "POST", { tahun: form.tahun });
          showToast(`Output "${body.nama}" ditambahkan dengan ${g.dibuat} periode ${form.tahun}.`);
        } else {
          showToast(`Output "${body.nama}" ditambahkan.Buat periodenya lewat ikon kalender.`);
        }
      } else {
        await api(`/api/kertas-kerja/${o.id}`, "PUT", body);
        showToast(`Output "${body.nama}" diperbarui.`);
      }
      onSelesai();
    } catch (err) {
      showToast(await pesanError(err, "Gagal menyimpan output"));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ background: T.card, border: `1px solid ${T.primary}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>
        {form.mode === "tambah" ? "Tambah Output" : "Ubah Output"}
      </div>
      <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 12 }}>
        Sub kegiatan {form.sub.kode} · {form.sub.nama}
      </div>

      <label style={wrap}>
        <span style={lbl(T)}>Nama output / dokumen *</span>
        <input value={nama} onChange={e => setNama(e.target.value)}
          placeholder="mis. Laporan Kinerja Triwulan I" style={inp(T)} />
      </label>

      <label style={{ ...wrap, marginTop: 10 }}>
        <span style={lbl(T)}>Indikator</span>
        <input value={indikator} onChange={e => setIndikator(e.target.value)}
          placeholder="opsional" style={inp(T)} />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 10 }}>
        <label style={wrap}>
          <span style={lbl(T)}>Frekuensi</span>
          <select value={frekuensi} onChange={e => gantiFrekuensi(e.target.value)} style={inp(T)}>
            {FREKUENSI.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <label style={wrap}>
          <span style={lbl(T)}>Target per tahun</span>
          <input type="number" min="1" value={target} onChange={e => gantiTarget(e.target.value)} style={inp(T)} />
        </label>
        <label style={wrap}>
          <span style={lbl(T)}>PIC</span>
          <input value={pic} onChange={e => setPic(e.target.value)} placeholder="NIP atau nama" style={inp(T)} />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 10 }}>
        <label style={wrap}>
          <span style={lbl(T)}>Periode wajib</span>
          <input value={bulanWajib} onChange={e => setBulanWajib(e.target.value)}
            placeholder="* atau 1,3,5,7,9,11" style={inp(T)} />
          <span style={{ fontSize: 10.5, color: T.textMuted, display: "block", marginTop: 3 }}>
            * = semua {totalPeriode} periode wajib. Angka = nomor periode (1 = Januari/Bulan I).
          </span>
        </label>
        <label style={wrap}>
          <span style={lbl(T)}>Aturan deadline</span>
          <select value={deadlineRule} onChange={e => setDeadlineRule(e.target.value)} style={inp(T)}>
            {(DEADLINE_PRESET[frekuensi] || []).map(d =>
              <option key={d.value} value={d.value}>{d.label}</option>
            )}
          </select>
          <span style={{ fontSize: 10.5, color: T.textMuted, display: "block", marginTop: 3 }}>
            Sekarang: {labelDeadline(frekuensi, deadlineRule)}
          </span>
        </label>
      </div>

      <label style={{ ...wrap, marginTop: 10 }}>
        <span style={lbl(T)}>Keterangan</span>
        <input value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="opsional" style={inp(T)} />
      </label>

      {form.mode === "tambah" && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12 }}>
          <input type="checkbox" id="kk-otomatis" checked={nya} onChange={e => setNya(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: T.primary, cursor: "pointer" }} />
          <label htmlFor="kk-otomatis" style={{ fontSize: 11.5, color: T.textSecondary, cursor: "pointer" }}>
            Langsung buat {totalPeriode} periode untuk tahun {form.tahun} setelah disimpan
          </label>
        </div>
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

// ── Form deadline periode (khusus Admin) ────────────────────────────────
function FormPeriode({ form, sibuk, setSibuk, onTutup, onSelesai, showToast }) {
  const { T } = useContext(ThemeContext);
  const p = form.periode;
  const [deadline, setDeadline] = useState(p.deadline || "");
  const [isWajib, setIsWajib] = useState(!!p.is_wajib);
  const [catatan, setCatatan] = useState(p.catatan || "");

  const submit = async ev => {
    ev.preventDefault();
    if (sibuk) return;
    if (!deadline) return showToast("Deadline wajib diisi.");
    setSibuk(true);
    try {
      await api(`/api/kertas-kerja/periode/${p.id}`, "PATCH", {
        deadline, is_wajib: isWajib, catatan: catatan.trim() || null,
      });
      showToast(`Periode ${p.periode_label} diperbarui.`);
      onSelesai();
    } catch (err) {
      showToast(await pesanError(err, "Gagal menyimpan periode"));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ background: T.card, border: `1px solid ${T.primary}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>
        Ubah Periode {p.periode_label}
      </div>
      <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 12 }}>
        {form.output.nama} · tahun {form.tahun}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <label style={wrap}>
          <span style={lbl(T)}>Deadline</span>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inp(T)} />
        </label>
        <label style={wrap}>
          <span style={lbl(T)}>Status periode</span>
          <select value={isWajib ? "1" : "0"} onChange={e => setIsWajib(e.target.value === "1")} style={inp(T)}>
            <option value="1">Wajib</option>
            <option value="0">Opsional</option>
          </select>
        </label>
      </div>

      <label style={{ ...wrap, marginTop: 10 }}>
        <span style={lbl(T)}>Catatan</span>
        <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="opsional" style={inp(T)} />
      </label>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="submit" disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </button>
        <button type="button" onClick={onTutup} style={btn(T, "transparent", T.text, false, T.inputBorder)}>Batal</button>
      </div>
    </form>
  );
}

const wrap = { display: "block" };
const lbl = T => ({ display: "block", fontSize: 11, fontWeight: 600, color: T.textSecondary, marginBottom: 4 });
const inp = T => ({
  width: "100%", padding: "7px 10px", border: `1px solid ${T.inputBorder}`,
  borderRadius: 8, fontSize: 12.5, outline: "none", background: T.inputBg,
  color: T.text, fontFamily: "inherit", boxSizing: "border-box",
});
