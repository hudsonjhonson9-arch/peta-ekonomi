import { useState, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";
import { api, usePksTree, usePksTahun } from "../hooks.js";
import { canManageOutput } from "../data.js";
import { btn } from "./PksAdmin.jsx";

// Format rupiah lokal — sengaja tidak dibagi ke data.js: hanya dipakai di sini
// (Task 5 bisa memakai sendiri bila perlu).
const rupiah = n => (n == null ? "—" : "Rp " + Math.round(n).toLocaleString("id-ID"));

const inputStyle = T => ({
  padding: "7px 10px", border: `1px solid ${T.inputBorder}`, borderRadius: 8,
  fontSize: 12.5, outline: "none", background: T.inputBg, color: T.text,
  fontFamily: "inherit", width: "100%", boxSizing: "border-box",
});

// Fork struktur Panel/SubKey dari KertasKerja.jsx (Panel:274, SubKey:297) —
// KertasKerja tidak diubah dan tidak diekspor, jadi polanya disalin lalu
// disederhanakan: tanpa output/periode, tanpa pencarian.
export default function ScreeningRKA({ user, showToast }) {
  const { T } = useContext(ThemeContext);
  const qc = useQueryClient();
  const [tahun, setTahun] = useState(null);
  const [buka, setBuka] = useState({});

  const admin = canManageOutput(user.role);
  const { data: tahunList = [] } = usePksTahun();
  const { data: tree, isLoading, isError } = usePksTree(tahun);

  // Default ke tahun terbaru yang punya data, sama seperti KertasKerja.
  useEffect(() => {
    if (tahun == null && tahunList.length) setTahun(tahunList[0]);
  }, [tahunList, tahun]);

  const reload = () => qc.invalidateQueries({ queryKey: ["pks-tree", tahun] });
  const toggle = key => setBuka(prev => ({ ...prev, [key]: !prev[key] }));

  const programs = tree?.tree || [];

  return (
    <div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="filter" size={14} style={{ color: T.primary }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Screening RKA</span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
              Program → Kegiatan → Sub Kegiatan · pagu &amp; kode rekening{admin ? "" : " (lihat saja)"}
            </div>
          </div>
          <select value={tahun ?? ""} onChange={e => setTahun(parseInt(e.target.value, 10))}
            style={{
              padding: "6px 9px", border: `1px solid ${T.inputBorder}`, borderRadius: 8,
              fontSize: 12, background: T.inputBg, color: T.text, fontFamily: "inherit",
            }}>
            {[...new Set([tahun, ...tahunList].filter(Boolean))].sort((a, b) => b - a).map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
        </div>
      </div>

      {isError && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
          <Icon name="alert" size={20} style={{ color: "#DC2626" }} />
          <div style={{ marginTop: 8 }}>Tidak bisa memuat pohon PKS. Muat ulang halaman.</div>
        </div>
      )}

      {(tahun == null || isLoading) && <div style={{ fontSize: 13, color: T.textMuted, padding: 12 }}>Memuat data…</div>}

      {tahun != null && !isLoading && !isError && programs.length === 0 && (
        <div style={{ background: T.card, border: `1px dashed ${T.inputBorder}`, borderRadius: 12, padding: 40, textAlign: "center", color: T.textMuted, fontSize: 13 }}>
          Belum ada struktur PKS untuk {tahun}.
        </div>
      )}

      {programs.map(p => (
        <Panel key={`p${p.id}`} T={T} buka={!!buka[`p${p.id}`]} onToggle={() => toggle(`p${p.id}`)}
          ikon="layers" kode={p.kode} nama={p.nama}>
          {p.kegiatan.map(k => (
            <Panel key={`k${k.id}`} T={T} buka={!!buka[`k${k.id}`]} onToggle={() => toggle(`k${k.id}`)}
              ikon="list" kode={k.kode} nama={k.nama}>
              {k.subkegiatan.map(s => (
                <SubRow key={`s${s.id}`} T={T} sub={s} admin={admin}
                  buka={!!buka[`s${s.id}`]} onToggle={() => toggle(`s${s.id}`)}
                  showToast={showToast} reload={reload} />
              ))}
            </Panel>
          ))}
        </Panel>
      ))}
    </div>
  );
}

// ── Panel rekursif (program / kegiatan) ──────────────────────────────────
function Panel({ T, buka, onToggle, ikon, kode, nama, children }) {
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
      {buka && (
        <div style={{ margin: "6px 0 0 20px", paddingLeft: 10, borderLeft: `1px solid ${T.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Baris sub kegiatan + panel detailnya ─────────────────────────────────
function SubRow({ T, sub, admin, buka, onToggle, showToast, reload }) {
  const chips = sub.kode_rekening || [];
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

        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, flexShrink: 0,
          fontFamily: "ui-monospace, monospace",
          color: sub.pagu == null ? T.textMuted : T.text,
          background: T.surfaceHover, border: `1px solid ${T.border}`,
        }}>
          {rupiah(sub.pagu)}
        </span>

        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, flexShrink: 0,
          color: chips.length ? T.textSecondary : T.textMuted,
          background: chips.length ? T.surfaceHover : "transparent",
          border: `1px solid ${T.border}`,
        }}>
          {chips.length ? `${chips.length} rekening` : "semua rekening"}
        </span>
      </div>

      {buka && (
        <div style={{ margin: "6px 0 0 18px", paddingLeft: 10, borderLeft: `1px solid ${T.border}` }}>
          <DetailSub T={T} sub={sub} admin={admin} showToast={showToast} onSave={reload} />
        </div>
      )}
    </div>
  );
}

// ── Detail sub kegiatan: pagu + chips kode rekening ──────────────────────
// Tabel standar harga menyusul di Task 5; panel ini sengaja hanya berisi dua
// hal itu sesuai brief.
function DetailSub({ T, sub, admin, showToast, onSave }) {
  const [paguTeks, setPaguTeks] = useState(() => (sub.pagu ?? "").toString());
  const [chips, setChips] = useState(() => sub.kode_rekening || []);
  const [teks, setTeks] = useState("");
  const [sibuk, setSibuk] = useState(false);

  // Sinkronkan draft dengan data server HANYA bila isinya berubah — dependensi
  // berupa string, bukan array, supaya refetch polling (30 dtk) tidak
  // menimpa input yang sedang diketik selama nilainya sama.
  const kunciChips = (sub.kode_rekening || []).join("\u0001");
  useEffect(() => {
    setPaguTeks((sub.pagu ?? "").toString());
    setChips(sub.kode_rekening || []);
  }, [sub.pagu, kunciChips]);

  const simpan = async (body, pesan) => {
    setSibuk(true);
    try {
      // PUT lama mewajibkan kode+nama, jadi ikut dikirim walau tidak berubah.
      await api(`/api/pks/subkegiatan/${sub.id}`, "PUT", { kode: sub.kode, nama: sub.nama, ...body });
      showToast(pesan);
      onSave();
    } catch (err) {
      // Gagal → draft dibiarkan apa adanya supaya bisa diperbaiki/diulang;
      // jangan dianggap tersimpan.
      showToast(`Gagal menyimpan: ${err.message}`);
    } finally {
      setSibuk(false);
    }
  };

  const simpanPagu = () => {
    const n = paguTeks.trim() === "" ? null : Number(paguTeks);
    if (paguTeks.trim() !== "" && (!Number.isFinite(n) || n < 0)) {
      showToast("Pagu harus angka nol atau lebih.");
      return;
    }
    return simpan({ pagu: n }, "Pagu disimpan.");
  };

  const tambahChip = () => {
    const bagian = teks.split(",").map(x => x.trim()).filter(Boolean);
    if (!bagian.length) return;
    setChips(prev => [...prev, ...bagian.filter(c => !prev.includes(c))]);
    setTeks("");
  };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>
        {sub.kode} · {sub.nama}
      </div>

      {/* Pagu */}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text, marginBottom: 5 }}>Pagu</div>
      {admin ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number" min="0" step="any" inputMode="decimal"
            value={paguTeks} onChange={e => setPaguTeks(e.target.value)}
            placeholder="0" style={{ ...inputStyle(T), maxWidth: 220 }}
            onKeyDown={e => { if (e.key === "Enter") simpanPagu(); }}
          />
          <button onClick={simpanPagu} disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
            Simpan
          </button>
          <span style={{ fontSize: 11.5, color: T.textMuted }}>{rupiah(sub.pagu)}</span>
        </div>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{rupiah(sub.pagu)}</div>
      )}

      {/* Chips kode rekening */}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text, margin: "12px 0 5px" }}>Kode Rekening</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {chips.length === 0 && (
          <span style={{ fontSize: 12, color: T.textMuted }}>Kosong = semua rekening.</span>
        )}
        {chips.map(c => (
          <span key={c} style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5,
            fontFamily: "ui-monospace, monospace", padding: "3px 8px", borderRadius: 999,
            background: T.surfaceHover, border: `1px solid ${T.border}`, color: T.text,
          }}>
            {c}
            {admin && (
              <button onClick={() => setChips(prev => prev.filter(x => x !== c))}
                title={`Hapus ${c}`} aria-label={`Hapus kode rekening ${c}`}
                style={{
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: T.textMuted, fontWeight: 700, fontSize: 13, lineHeight: 1,
                  fontFamily: "inherit",
                }}>×</button>
            )}
          </span>
        ))}
      </div>

      {admin && (
        <>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              value={teks} onChange={e => setTeks(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); tambahChip(); }
              }}
              placeholder="Ketik kode rekening — Enter atau koma untuk menambah"
              style={inputStyle(T)}
            />
            <button onClick={tambahChip} style={btn(T, T.surfaceHover, T.textSecondary, false, T.inputBorder)}>
              Tambah
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => simpan({ kode_rekening: chips }, "Kode rekening disimpan.")}
              disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
              Simpan rekening
            </button>
          </div>
        </>
      )}
    </div>
  );
}
