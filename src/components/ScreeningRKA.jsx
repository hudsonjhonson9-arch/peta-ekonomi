import { useState, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Icon } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";
import { api, usePksTree, usePksTahun, useStandarHarga, useDraftRincian, usePerubahan } from "../hooks.js";
import { canManageOutput } from "../data.js";
import { btn } from "./PksAdmin.jsx";
import { parseRows } from "../uploadStandarHarga.js";

// Format rupiah lokal — sengaja tidak dibagi ke data.js: hanya dipakai di sini
// (Task 5 bisa memakai sendiri bila perlu).
const rupiah = n => (n == null ? "—" : "Rp " + Math.round(n).toLocaleString("id-ID"));

// Tanggal riwayat perubahan — ringkas, tanpa jam.
const tgl = t => new Date(t).toLocaleDateString("id-ID",
  { day: "2-digit", month: "short", year: "numeric" });

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

  // Inisiasi perubahan anggaran (Admin, tahun aktif): form inline di header.
  const { data: perubahan } = usePerubahan(tahun);
  const [bukaPerubahan, setBukaPerubahan] = useState(false);
  const [catatanPerubahan, setCatatanPerubahan] = useState("");
  const [sibukPerubahan, setSibukPerubahan] = useState(false);

  const inisiasi = async () => {
    setSibukPerubahan(true);
    try {
      const r = await api("/api/screening/perubahan", "POST",
        { tahun, catatan: catatanPerubahan });
      showToast(`Perubahan ${tahun} diinisiasi — ${r.n} sub kegiatan disnapshot.`);
      setBukaPerubahan(false);
      setCatatanPerubahan("");
      qc.invalidateQueries({ queryKey: ["screening-perubahan", tahun] });
    } catch (e) {
      showToast(`Gagal menginisiasi: ${e.message}`);
    } finally {
      setSibukPerubahan(false);
    }
  };

  const riwayat = perubahan?.riwayat || [];

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

          {admin && tahun != null && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={() => setBukaPerubahan(v => !v)}
                disabled={sibukPerubahan}
                style={btn(T, T.primary, "#fff", sibukPerubahan)}
              >
                <Icon name="history" size={13} /> Inisiasi Perubahan
              </button>
              {riwayat.length > 0 && (
                <span style={{
                  fontSize: 11, color: T.textSecondary, fontFamily: "ui-monospace, monospace",
                }}>
                  {riwayat.length}× · terakhir {tgl(riwayat[0].created_at)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Form inisiasi + riwayat perubahan tahun aktif */}
        {bukaPerubahan && tahun != null && (
          <div style={{
            marginTop: 12, padding: 10, borderRadius: 8,
            border: `1px solid ${T.inputBorder}`, background: T.surfaceHover,
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text, marginBottom: 6 }}>
              Inisiasi perubahan anggaran {tahun}
            </div>
            <div style={{ fontSize: 11.5, color: T.textSecondary, marginBottom: 8 }}>
              Snapshot pagu + total rencana tiap sub kegiatan disimpan sebagai nilai
              "sebelum perubahan". Kolom sebelum/sesudah muncul di detail sub
              kegiatan setelah inisiasi.
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={catatanPerubahan}
                onChange={e => setCatatanPerubahan(e.target.value)}
                placeholder="Catatan perubahan (opsional)"
                style={{ ...inputStyle(T), maxWidth: 340 }}
                onKeyDown={e => { if (e.key === "Enter") inisiasi(); }}
              />
              <button onClick={inisiasi} disabled={sibukPerubahan}
                style={btn(T, T.primary, "#fff", sibukPerubahan)}>
                Simpan inisiasi
              </button>
              <button onClick={() => setBukaPerubahan(false)}
                style={btn(T, T.surfaceHover, T.textSecondary, false, T.inputBorder)}>
                Batal
              </button>
            </div>
          </div>
        )}

        {riwayat.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {riwayat.slice(0, 3).map(r => (
              <div key={r.id} style={{ fontSize: 11, color: T.textMuted }}>
                <b style={{ color: T.textSecondary, fontFamily: "ui-monospace, monospace" }}>
                  {tgl(r.created_at)}
                </b>
                {" · "}{r.oleh || "Admin"}
                {r.catatan ? ` · ${r.catatan}` : ""}
              </div>
            ))}
          </div>
        )}
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
                <SubRow key={`s${s.id}`} T={T} sub={s} admin={admin} tahun={tahun}
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
function SubRow({ T, sub, admin, tahun, buka, onToggle, showToast, reload }) {
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
          <DetailSub T={T} sub={sub} admin={admin} tahun={tahun} showToast={showToast} onSave={reload} />
        </div>
      )}
    </div>
  );
}

// ── Detail sub kegiatan: pagu + chips kode rekening + tabel standar harga ─
function DetailSub({ T, sub, admin, tahun, showToast, onSave }) {
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

      <RingkasanPagu T={T} sub={sub} tahun={tahun} admin={admin}
        showToast={showToast} onSave={onSave} />

      <DraftRincian T={T} tahun={tahun} sub={sub} showToast={showToast} />

      <TabelStandarHarga T={T} tahun={tahun} sub={sub} admin={admin} showToast={showToast} />
    </div>
  );
}

// ── Ringkasan rencana vs pagu (Task 10) ───────────────────────────────────
// useDraftRincian(sub.id) = key yang sama dengan DraftRincian → react-query
// dedup, tidak dobel fetch. totalRencana = Σ jumlahItem (dihitung server).
//
// Perubahan anggaran: setelah Admin menginisiasi perubahan untuk tahun aktif,
// snapshot inisiasi terakhir (usePerubahan — key sama antar sub, dedup)
// menampilkan kolom "Sebelum perubahan"; nilai live = "Sesudah perubahan".
// Realisasi selalu tampil (disimpan Admin via PUT pks subkegiatan).
function RingkasanPagu({ T, sub, tahun, admin, showToast, onSave }) {
  const { data } = useDraftRincian(sub.id);
  const { data: perubahan } = usePerubahan(tahun);
  const totalRencana = data ? data.total : 0;
  const pagu = sub.pagu;
  // ponytail: pagu 0 = praktis "belum diisi" — juga menghindari 0-division
  const adaPagu = pagu != null && pagu > 0;
  const sisa = adaPagu ? pagu - totalRencana : null;
  const persen = adaPagu ? (totalRencana / pagu) * 100 : null;

  // Status klien: <90% Aman · 90–100% Mendekati (inklusif) · >100% Melebihi
  const badge = !adaPagu
    ? { label: "Pagu belum diisi", warna: T.textMuted }
    : persen < 90
      ? { label: "Aman", warna: "#16A34A" }
      : persen <= 100
        ? { label: "Mendekati", warna: "#CA8A04" }
        : { label: "Melebihi", warna: "#DC2626" };

  const item = (label, nilai, warna) => (
    <span style={{ fontSize: 12, color: T.textSecondary }}>
      {label}:{" "}
      <b style={{ color: warna || T.text, fontFamily: "ui-monospace, monospace" }}>
        {nilai}
      </b>
    </span>
  );

  // Snapshot inisiasi terakhir untuk sub ini (bila tahun sudah diinisiasi).
  const snap = (perubahan?.item || [])
    .find(i => Number(i.subkegiatan_id) === Number(sub.id));
  const inisiasi = perubahan?.riwayat?.[0];

  // Realisasi: draft disinkronkan dengan data server hanya saat nilainya
  // berubah (pola pagu di DetailSub) supaya refetch polling tidak menimpa
  // input yang sedang diketik.
  const [realTeks, setRealTeks] = useState(() => (sub.realisasi ?? "").toString());
  const [sibukReal, setSibukReal] = useState(false);
  useEffect(() => {
    setRealTeks((sub.realisasi ?? "").toString());
  }, [sub.realisasi]);

  const simpanRealisasi = async () => {
    const n = realTeks.trim() === "" ? null : Number(realTeks);
    if (realTeks.trim() !== "" && (!Number.isFinite(n) || n < 0)) {
      showToast("Realisasi harus angka nol atau lebih.");
      return;
    }
    setSibukReal(true);
    try {
      // PUT pks mewajibkan kode+nama, ikut dikirim walau tidak berubah.
      await api(`/api/pks/subkegiatan/${sub.id}`, "PUT",
        { kode: sub.kode, nama: sub.nama, realisasi: n });
      showToast("Realisasi disimpan.");
      onSave && onSave();
    } catch (e) {
      showToast(`Gagal menyimpan: ${e.message}`);
    } finally {
      setSibukReal(false);
    }
  };

  const selisih = snap ? totalRencana - Number(snap.sebelum_rencana || 0) : null;

  return (
    <div>
      <div style={{ marginTop: 14, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: "8px 10px", background: T.surfaceHover, display: "flex",
        flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary }}>
          Rencana vs Pagu
        </span>
        {adaPagu && item("Pagu", rupiah(pagu))}
        {item("Total rencana", rupiah(totalRencana))}
        {adaPagu && item("Sisa", rupiah(sisa))}
        {adaPagu && item("Terpakai", `${persen.toFixed(1)}%`)}
        <span style={{ fontSize: 11, fontWeight: 700, color: badge.warna,
          background: `${badge.warna}1A`, border: `1px solid ${badge.warna}4D`,
          borderRadius: 999, padding: "2px 8px" }}>
          {badge.label}
        </span>
      </div>

      {/* Perubahan anggaran + realisasi */}
      <div style={{ marginTop: 8, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: "8px 10px", background: T.surfaceHover }}>
        {snap ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary }}>
              Perubahan Anggaran {tahun}
              {inisiasi && (
                <span style={{ fontWeight: 400, color: T.textMuted }}>
                  {" "}· diinisiasi {tgl(inisiasi.created_at)}
                </span>
              )}
            </span>
            {item("Sebelum perubahan", rupiah(Number(snap.sebelum_rencana || 0)))}
            {item("Sesudah perubahan", rupiah(totalRencana))}
            {item("Selisih",
              `${selisih > 0 ? "+" : selisih < 0 ? "−" : ""}${rupiah(Math.abs(selisih))}`,
              selisih > 0 ? "#DC2626" : selisih < 0 ? "#16A34A" : T.textSecondary)}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: T.textMuted }}>
            Belum ada inisiasi perubahan untuk {tahun ?? "tahun ini"}
            {admin ? " — gunakan tombol \"Inisiasi Perubahan\"." : "."}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, alignItems: "center",
          marginTop: snap ? 8 : 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary }}>
            Realisasi
          </span>
          {admin ? (
            <>
              <input
                type="number" min="0" step="any" inputMode="decimal"
                value={realTeks} onChange={e => setRealTeks(e.target.value)}
                placeholder="0"
                style={{ ...inputStyle(T), maxWidth: 170, padding: "4px 8px", fontSize: 12 }}
                onKeyDown={e => { if (e.key === "Enter") simpanRealisasi(); }}
              />
              <button onClick={simpanRealisasi} disabled={sibukReal}
                style={btn(T, T.primary, "#fff", sibukReal)}>
                Simpan
              </button>
              <span style={{ fontSize: 11.5, color: T.textMuted }}>
                {rupiah(sub.realisasi ?? null)}
              </span>
            </>
          ) : (
            <b style={{ fontSize: 12, color: T.text, fontFamily: "ui-monospace, monospace" }}>
              {rupiah(sub.realisasi ?? null)}
            </b>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Draft Rincian: rencana belanja per sub kegiatan (Task 9) ──────────────
// Semua staf boleh CRUD — kebijakan LOGIN (keputusan 2026-10-06) — jadi tidak
// ada pintu admin di sini, berbeda dengan blok pagu/chips di atasnya.
// 3 patch plan: (1) tombol Cocokkan di baris harus masuk mode edit dulu
// karena panel cocok ada di FormBaris; (2) key form = init.id ?? "baru"
// (bukan init.id != null) — form baru juga boleh cocok; (3) tampil null pakai
// cek eksplisit, bukan rupiah(x) || "—".
function DraftRincian({ T, tahun, sub, showToast }) {
  const qc = useQueryClient();
  const { data, isLoading } = useDraftRincian(sub.id);
  const items = (data && data.items) || [];

  const [editId, setEditId] = useState(null);   // null | id baris yang diedit
  const [form, setForm] = useState(null);       // null | salinan item (kerja)
  const [tambahBuka, setTambahBuka] = useState(false);
  const [cocok, setCocok] = useState(null);     // null | {key, q}
  const [sibuk, setSibuk] = useState(false);

  const tutup = () => {
    setEditId(null); setTambahBuka(false); setForm(null); setCocok(null);
  };
  const muatUlang = () =>
    qc.invalidateQueries({ queryKey: ["draft-rincian", sub.id] });

  const tambah = () => {
    setEditId(null);
    setForm({
      uraian: "", spesifikasi: "", satuan: "", volume: "", harga_satuan: "",
      kode_rekening: "", catatan: "", standar_harga_id: null, harga_standar: null,
    });
    setCocok(null);
    setTambahBuka(true);
  };

  const edit = (it) => {
    setEditId(it.id); setForm({ ...it }); setTambahBuka(false); setCocok(null);
  };

  // PATCH-1: panel cocok ada di FormBaris → dari baris, wajib masuk mode edit
  // (salinan item masuk `form`) dulu, baru state cocok diset.
  const cocokkan = (it) => {
    setEditId(it.id);
    setForm({ ...it });
    setTambahBuka(false);
    setCocok({ key: it.id, q: it.uraian });
  };

  // PATCH-2 (bagian Simpan): init.id ada → PUT (editId terisi), tidak ada →
  // POST. Muat ulang key yang sama persis: ['draft-rincian', sub.id].
  const simpan = async () => {
    if (!form) return;
    const isi = {
      uraian: form.uraian, spesifikasi: form.spesifikasi, satuan: form.satuan,
      volume: form.volume, harga_satuan: form.harga_satuan,
      kode_rekening: form.kode_rekening, catatan: form.catatan,
      standar_harga_id: form.standar_harga_id, harga_standar: form.harga_standar,
    };
    setSibuk(true);
    try {
      if (editId != null) await api(`/api/draft-rincian/${editId}`, "PUT", isi);
      else await api("/api/draft-rincian", "POST", { subkegiatan_id: sub.id, ...isi });
      showToast("Baris rencana disimpan.");
      tutup();
      muatUlang();
    } catch (e) {
      showToast(`Gagal menyimpan: ${e.message}`);
    } finally {
      setSibuk(false);
    }
  };

  const hapus = async (it) => {
    if (!window.confirm(`Hapus baris "${it.uraian}"?`)) return;
    setSibuk(true);
    try {
      await api(`/api/draft-rincian/${it.id}`, "DELETE");
      showToast("Baris dihapus.");
      muatUlang();
    } catch (e) {
      showToast(`Gagal menghapus: ${e.message}`);
    } finally {
      setSibuk(false);
    }
  };

  // init = salinan ASLI baris yang diedit (untuk key form); {} saat tambah.
  const init = editId != null ? (items.find(i => i.id === editId) || {}) : {};

  const th = {
    padding: "6px 8px", fontSize: 11, fontWeight: 700,
    color: T.textSecondary, textAlign: "left", whiteSpace: "nowrap",
  };

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text }}>
          Rencana Belanja
        </span>
        <button onClick={tambah} disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
          + Tambah baris
        </button>
      </div>

      {form && (
        <FormBaris T={T} tahun={tahun} sub={sub} form={form} setForm={setForm}
          init={init} cocok={cocok} setCocok={setCocok}
          onSimpan={simpan} onBatal={tutup} sibuk={sibuk} />
      )}

      {isLoading ? (
        <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 4px" }}>
          Memuat rencana…
        </div>
      ) : items.length === 0 && !form ? (
        <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 4px" }}>
          Belum ada rencana belanja
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.surfaceHover }}>
                <th style={th}>Uraian</th>
                <th style={th}>Spesifikasi</th>
                <th style={th}>Volume</th>
                <th style={{ ...th, textAlign: "right" }}>Harga</th>
                <th style={th}>Rekening</th>
                <th style={{ ...th, textAlign: "right" }}>Total</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                // PATCH-3: cek null eksplisit sebelum rupiah(), jangan || "—".
                const total = it.volume == null || it.harga_satuan == null
                  ? null
                  : Math.round(Number(it.volume) * Number(it.harga_satuan));
                return (
                  <tr key={it.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "6px 8px", color: T.text, minWidth: 180 }}>
                      {it.uraian}
                    </td>
                    <td style={{ padding: "6px 8px", color: T.textSecondary, maxWidth: 180,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.spesifikasi || "—"}
                    </td>
                    <td style={{ padding: "6px 8px", color: T.textSecondary, whiteSpace: "nowrap" }}>
                      {Number(it.volume)} {it.satuan}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap",
                      fontFamily: "ui-monospace, monospace", color: T.text }}>
                      {it.harga_satuan == null ? "—" : rupiah(it.harga_satuan)}
                    </td>
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap",
                      fontFamily: "ui-monospace, monospace", color: T.textMuted }}>
                      {it.kode_rekening || "—"}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap",
                      fontFamily: "ui-monospace, monospace", fontWeight: 700, color: T.text }}>
                      {total == null ? "—" : rupiah(total)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button onClick={() => cocokkan(it)} disabled={sibuk}
                          style={btn(T, T.surfaceHover, T.textSecondary, sibuk, T.inputBorder)}>
                          Cocokkan
                        </button>
                        <button onClick={() => edit(it)} disabled={sibuk}
                          style={btn(T, T.surfaceHover, T.textSecondary, sibuk, T.inputBorder)}>
                          Edit
                        </button>
                        <button onClick={() => hapus(it)} disabled={sibuk}
                          style={btn(T, "#DC2626", "#fff", sibuk)}>
                          Hapus
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// FormBaris: shared tambah & edit. Total live = rumus identik dengan server
// (jumlahItem): Math.round(volume * harga).
function FormBaris({ T, tahun, sub, form, setForm, init, cocok, setCocok,
                     onSimpan, onBatal, sibuk }) {
  // PATCH-2: key = init.id ?? "baru" — form baru (init tanpa id) tetap bisa
  // buka panel cocok; jangan pakai init.id != null sebagai syarat aktifCocok.
  const key = (init && init.id) ?? "baru";
  const aktifCocok = cocok != null && cocok.key === key;
  const qCocok = aktifCocok ? cocok.q : "";
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const volume = Number(form.volume) || 0;
  const harga = Number(form.harga_satuan) || 0;
  const total = Math.round(volume * harga);

  const inp = inputStyle(T);
  const lb = {
    fontSize: 10.5, fontWeight: 700, color: T.textSecondary,
    display: "block", marginBottom: 2,
  };
  const kolom = flex => ({
    flex, minWidth: 0,
  });
  const field = { ...inp, width: "100%" };

  const daftar = [
    ["Uraian", "uraian", "Uraian belanja", "2 1 220px"],
    ["Spesifikasi", "spesifikasi", "", "2 1 180px"],
    ["Satuan", "satuan", "sak", "1 1 90px"],
    ["Volume", "volume", "0", "1 1 90px"],
    ["Harga satuan", "harga_satuan", "0", "1 1 130px"],
    ["Kode rekening", "kode_rekening", "5.1.02.01", "1 1 130px"],
    ["Catatan", "catatan", "", "2 1 160px"],
  ];

  return (
    <div style={{ border: `1px solid ${T.inputBorder}`, borderRadius: 8,
      padding: 10, background: T.surfaceHover, marginBottom: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {daftar.map(([label, k, ph, flex]) => (
          <label key={k} style={kolom(flex)}>
            <span style={lb}>{label}</span>
            <input value={form[k] == null ? "" : form[k]} onChange={set(k)}
              placeholder={ph} inputMode={k === "volume" || k === "harga_satuan" ? "decimal" : undefined}
              style={field} />
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center",
        marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: T.textSecondary }}>
          Total:{" "}
          <b style={{ color: T.text, fontFamily: "ui-monospace, monospace" }}>
            {rupiah(total)}
          </b>
        </span>
        <span style={{ fontSize: 11, color: form.standar_harga_id != null ? T.primary : T.textMuted }}>
          {form.standar_harga_id != null ? "✓ cocok standar harga" : "tanpa standar harga"}
        </span>
        <button onClick={() => setCocok({ key, q: form.uraian || "" })}
          disabled={sibuk} style={btn(T, T.surfaceHover, T.textSecondary, sibuk, T.inputBorder)}>
          Cocokkan
        </button>
        <button onClick={onSimpan} disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
          Simpan
        </button>
        <button onClick={onBatal} disabled={sibuk}
          style={btn(T, T.surfaceHover, T.textSecondary, sibuk, T.inputBorder)}>
          Batal
        </button>
      </div>

      {aktifCocok && (
        <PanelCocok T={T} tahun={tahun} sub={sub} form={form} setForm={setForm}
          q={qCocok} setQ={v => setCocok({ key, q: v })} />
      )}
    </div>
  );
}

// Panel pencocokan SSH (top-5). Komponen TERPISAH — hook di dalamnya hanya
// fetching saat panel terbuka (aktifCocok), bukan tiap form baris.
// rekening: kode baris diisi → kirim (filter server exact); kosong → jangan
// kirim chips[0] (melewatkan kandidat kode lain) — kirim undefined lalu
// filter lokal dengan chips; daftar sudah di tangan, cukup slice(0, 5).
function PanelCocok({ T, tahun, sub, form, setForm, q, setQ }) {
  const chips = sub.kode_rekening || [];
  const { data: kandidat = [], isLoading } = useStandarHarga({
    tahun, jenis: "SSH", q: q || undefined,
    rekening: form.kode_rekening || undefined,
  });
  const top5 = (form.kode_rekening
    ? kandidat
    : chips.length
      ? kandidat.filter(it => chips.includes(it.kode_rekening))
      : kandidat
  ).slice(0, 5);

  const pakai = it => setForm(p => ({
    ...p,
    standar_harga_id: it.id,
    harga_standar: it.harga_satuan,
    ...((p.harga_satuan == null || p.harga_satuan === "" || Number(p.harga_satuan) === 0)
      ? { harga_satuan: it.harga_satuan } : {}),
  }));
  const tanpa = () => setForm(p => ({
    ...p, standar_harga_id: null, harga_standar: null,
  }));

  return (
    <div style={{ marginTop: 8, borderTop: `1px dashed ${T.inputBorder}`, paddingTop: 8 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center",
        marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary }}>
          Cocokkan ke SSH {tahun}
        </span>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Kata kunci pencarian" style={{ ...inputStyle(T), maxWidth: 240 }} />
        <button onClick={tanpa} style={btn(T, T.surfaceHover, T.textSecondary, false, T.inputBorder)}>
          Tanpa standar
        </button>
      </div>
      {isLoading ? (
        <div style={{ fontSize: 11.5, color: T.textMuted }}>Mencari…</div>
      ) : top5.length === 0 ? (
        <div style={{ fontSize: 11.5, color: T.textMuted }}>
          Tidak ada kandidat SSH{q ? ` untuk "${q}"` : ""}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {top5.map(it => (
            <button key={it.id} onClick={() => pakai(it)}
              style={{ display: "flex", justifyContent: "space-between", gap: 8,
                alignItems: "center", padding: "5px 8px", borderRadius: 6,
                cursor: "pointer", textAlign: "left",
                border: `1px solid ${T.inputBorder}`, background: T.card,
                color: T.text, fontSize: 12, fontFamily: "inherit" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap" }}>
                {it.uraian_barang}
                {it.kode_rekening ? (
                  <span style={{ color: T.textMuted, fontFamily: "ui-monospace, monospace" }}>
                    {" · "}{it.kode_rekening}
                  </span>
                ) : null}
              </span>
              <span style={{ whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace" }}>
                {it.harga_satuan == null ? "—" : rupiah(it.harga_satuan)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tabel standar harga + panel upload Excel (Task 5) ─────────────────────
// Filter rekening memakai chips TERSIMPAN di tree (`sub.kode_rekening`),
// bukan draft yang belum ditekan "Simpan rekening". Upload = Admin saja di
// UI; server juga memagari POST /api/standar-harga/upload dengan ADMIN.
function TabelStandarHarga({ T, tahun, sub, admin, showToast }) {
  const qc = useQueryClient();
  const chips = sub.kode_rekening || [];
  const [jenis, setJenis] = useState("SSH");
  const [q, setQ] = useState("");
  const [qD, setQD] = useState("");     // debounce 300ms → state `q` hook
  const [preview, setPreview] = useState(null);  // {nama, tahun, jenis, items}
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQD(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: daftar = [], isLoading } = useStandarHarga({
    tahun,
    jenis,
    q: qD.trim() || undefined,
    rekening: chips.length ? chips.join(",") : undefined,
  });

  const bacaFile = async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";              // file sama bisa dipilih ulang
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });
      if (aoa.length < 2) { showToast("File tidak punya baris data."); return; }
      const kepala = aoa[0];
      const rows = aoa.slice(1).map(r => {
        const o = {};
        kepala.forEach((h, i) => { if (h !== "" && h != null) o[h] = r[i]; });
        return o;
      });
      // tahun/jenis ditangkap SEKARANG: ganti file → pindah select tahun/jenis
      // tidak boleh mengubah tujuan replace yang sudah dipreview.
      setPreview({ nama: f.name, tahun, jenis, items: parseRows(rows) });
    } catch (err) {
      showToast(`Gagal membaca file: ${err.message}`);
    }
  };

  const gantiData = async () => {
    if (!preview || !preview.items.length) return;
    const ok = window.confirm(
      `Ganti SEMUA standar harga ${preview.jenis} ${preview.tahun} dengan ${preview.items.length} baris dari ${preview.nama}? Data lama dihapus.`
    );
    if (!ok) return;
    setSibuk(true);
    try {
      const r = await api("/api/standar-harga/upload", "POST", {
        tahun: preview.tahun, jenis: preview.jenis, items: preview.items,
      });
      showToast(`${r.n} baris ${preview.jenis} ${preview.tahun} berhasil diganti.`);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["standar-harga"] });
    } catch (err) {
      showToast(`Gagal mengunggah: ${err.message}`);
    } finally {
      setSibuk(false);
    }
  };

  const th = { padding: "6px 8px", fontSize: 11, fontWeight: 700, color: T.textSecondary, textAlign: "left", whiteSpace: "nowrap" };

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text }}>Standar Harga</span>
        <select value={jenis} onChange={e => setJenis(e.target.value)} aria-label="Jenis standar harga"
          style={{
            padding: "6px 8px", border: `1px solid ${T.inputBorder}`, borderRadius: 8,
            fontSize: 12, background: T.inputBg, color: T.text, fontFamily: "inherit",
          }}>
          <option value="SSH">SSH</option>
          <option value="SBU">SBU</option>
        </select>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Cari uraian / spesifikasi / kode barang…"
          style={{ ...inputStyle(T), maxWidth: 260 }} />
      </div>

      {chips.length === 0 && (
        <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 6 }}>
          Belum ada rekening — menampilkan semua data.
        </div>
      )}

      {admin && (
        <div style={{
          padding: 10, background: T.surfaceHover, border: `1px dashed ${T.inputBorder}`,
          borderRadius: 8, marginBottom: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary }}>
              Unggah Excel — ganti semua data {jenis} {tahun}
            </span>
            <input type="file" accept=".xlsx,.xls" onChange={bacaFile}
              style={{ fontSize: 12, color: T.textSecondary, fontFamily: "inherit" }} />
          </div>

          {preview && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: T.text, marginBottom: 5 }}>
                {preview.nama} · {preview.items.length} baris siap mengganti{" "}
                {preview.jenis} {preview.tahun} · 5 pertama:
              </div>

              {preview.items.length === 0 ? (
                <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 6 }}>
                  Tidak ada baris valid di file ini (uraian barang &amp; harga wajib terisi).
                </div>
              ) : (
                <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: T.card }}>
                        <th style={th}>Uraian</th>
                        <th style={th}>Satuan</th>
                        <th style={{ ...th, textAlign: "right" }}>Harga</th>
                        <th style={th}>Rekening</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.slice(0, 5).map((it, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                          <td style={{ padding: "5px 8px", color: T.text }}>{it.uraian_barang}</td>
                          <td style={{ padding: "5px 8px", color: T.textSecondary, whiteSpace: "nowrap" }}>{it.satuan || "—"}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", color: T.text }}>{rupiah(it.harga_satuan)}</td>
                          <td style={{ padding: "5px 8px", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", color: T.textMuted }}>{it.kode_rekening || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={gantiData} disabled={sibuk || !preview.items.length}
                  style={btn(T, "#DC2626", "#fff", sibuk || !preview.items.length)}>
                  Ganti data (replace)
                </button>
                <button onClick={() => setPreview(null)}
                  style={btn(T, T.surfaceHover, T.textSecondary, false, T.inputBorder)}>
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div style={{ fontSize: 12, color: T.textMuted, padding: "8px 4px" }}>Memuat standar harga…</div>
      ) : daftar.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMuted, padding: "8px 4px" }}>
          {qD.trim()
            ? `Tidak ada data ${jenis} untuk pencarian "${qD.trim()}".`
            : chips.length
              ? `Belum ada data ${jenis} ${tahun} untuk rekening terpilih.`
              : `Belum ada data standar harga ${jenis} ${tahun}.`}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: T.surfaceHover }}>
                <th style={th}>Uraian</th>
                <th style={th}>Spesifikasi</th>
                <th style={th}>Satuan</th>
                <th style={{ ...th, textAlign: "right" }}>Harga</th>
                <th style={th}>Kode Rekening</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map(it => (
                <tr key={it.id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "6px 8px", color: T.text, minWidth: 220 }}>{it.uraian_barang}</td>
                  <td style={{ padding: "6px 8px", color: T.textSecondary, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.spesifikasi || "—"}</td>
                  <td style={{ padding: "6px 8px", color: T.textSecondary, whiteSpace: "nowrap" }}>{it.satuan || "—"}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", color: T.text }}>{rupiah(it.harga_satuan)}</td>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", color: T.textMuted }}>{it.kode_rekening || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
