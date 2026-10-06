import { useState, useContext, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon, Modal, CariPilih } from "./ui.jsx";
import UploadForm from "./UploadForm.jsx";
import { PksRingkasan, DeadlineList } from "./PksRingkasan.jsx";
import { ThemeContext } from "../App.jsx";
import {
  api, usePksTree, usePksTahun, usePksRingkasan, usePksDeadlineTerdekat, useUsers,
} from "../hooks.js";
import {
  FREKUENSI, DEADLINE_PRESET, DEADLINE_DEFAULT, canManageOutput,
  labelDeadline, statusPeriode, progresOutput, sisaHari, formatTanggal,
  frekuensiDariTarget, jumlahPeriode,
  STATUS_PERIODE,
} from "../data.js";
import PksAdmin, { pesanError, btn } from "./PksAdmin.jsx";
// Pemuat judul bukti dukung yang sama dipakai server saat repairing tautan.
// Kalau dirakit di dua tempat, perubahan sepele di sini membuat dokumen yang
// sudah terunggah tidak pernah ditemukan kembali.
import { judulDokumenPeriode } from "../../server/tautan-periode.js";

// onUnggahPeriode dipakai dialog unggah: form-nya UploadForm yang sama dengan
// halaman Upload Dokumen, jadi GAS + Google Drive tidak punya dua implementasi.
// kategori/sektor/bidang diteruskan karena select di UploadForm membutuhkannya.
export default function KertasKerja({ user, showToast, categories = [], sectors = [], bidangs = [], onUnggahPeriode }) {
  const { T } = useContext(ThemeContext);
  const qc = useQueryClient();
  const [tahun, setTahun]             = useState(null);
  const [tab, setTab]                 = useState("kerja"); // kerja | pohon
  const [q, setQ]                     = useState("");
  const [hanyaTerlambat, setHanyaTerlambat] = useState(false);
  const [buka, setBuka]               = useState(() => muatBuka("kk-buka"));
  const [formOutput, setFormOutput]   = useState(null);
  const [formPeriode, setFormPeriode] = useState(null);
  const [uploadPeriode, setUploadPeriode] = useState(null); // { periodeId, judul, tahun }
  const [riwayatDoc, setRiwayatDoc]   = useState(null); // { docId, docJudul, periodeLabel }
  const [sibuk, setSibuk]             = useState(false);

  const admin = canManageOutput(user.role);
  const { data: tahunList = [] } = usePksTahun();
  const { data: tree, isLoading, isError } = usePksTree(tahun);
  const { data: ringkasan } = usePksRingkasan(tahun);
  const { data: deadline = [] } = usePksDeadlineTerdekat(tahun);

  // Daftar pengguna untuk dropdown PIC. Hanya diambil kalau user boleh menambah
  // output, karena /api/users restricted ke admin dan request sia-sia akan
  // berakhir 403.
  const { data: usersList = [] } = useUsers(admin);
  // Nilai yang disimpan adalah NIP kalau PIC dipilih dari daftar, supaya tetap
  // unambik meski nama orang diubah. Nama ditampilkan sebagai keterangan, dan
  // teks bebas tetap diterima karena tidak semua PIC punya akun.
  const opsiPengguna = useMemo(() => usersList.map(u => ({
    value: u.nip || u.name,
    label: u.name,
    sub: u.unit && u.unit !== "—" ? u.unit : "",
    hint: u.nip || "",
  })), [usersList]);

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
          <PksRingkasan T={T} r={ringkasan} tahun={tahun} isLoading={isLoading} />

          <DeadlineList T={T} deadline={deadline} />

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
                      onUnggah={d => setUploadPeriode(d)}
                      onLihatRiwayat={docInfo => setRiwayatDoc(docInfo)}
                      showToast={showToast}
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
          opsiPengguna={opsiPengguna}
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

      {/* Unggah dokumen untuk satu periode. Memakai UploadForm yang sama dengan
          halaman Upload, jadi tidak ada implementasi GAS kedua. */}
      {uploadPeriode && (
        <UploadForm
          dalamModal
          satuFile
          onTutup={() => setUploadPeriode(null)}
          onSubmit={async (payload, onProgress) => {
            const sukses = await onUnggahPeriode(payload, onProgress, {
              periodeId: uploadPeriode.periodeId,
              returnPage: "kertas-kerja",
            });
            if (sukses) setUploadPeriode(null);
            return sukses;
          }}
          user={user}
          categories={categories}
          sectors={sectors}
          bidangs={bidangs}
          initialTitle={uploadPeriode.judul}
          initialYear={uploadPeriode.tahun}
          judul="Unggah Dokumen untuk Periode"
          subjudul={uploadPeriode.judul}
          labelKirim="Unggah & Hubungkan ke Periode"
        />
      )}

      {riwayatDoc && (
        <RiwayatUnggahModal docInfo={riwayatDoc} onTutup={() => setRiwayatDoc(null)} />
      )}
    </div>
  );
}

function muatBuka(kunci) {
  try { return JSON.parse(localStorage.getItem(kunci)) || {}; } catch { return {}; }
}

// Ringkasan angka dan daftar deadline tinggal satu implementasi, dipakai juga
// oleh Dashboard.

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
                  onTambahOutput, onEditOutput, onEditPeriode, onUnggah, onLihatRiwayat, showToast, reload, sibuk, setSibuk }) {
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
              onUnggah={onUnggah}
              onLihatRiwayat={onLihatRiwayat}
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
function Output({ T, output, admin, user, tahun, onEdit, onEditPeriode, onUnggah, onLihatRiwayat, showToast, reload, sibuk, setSibuk }) {
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

// Unggah dari baris output, bukan dari baris periode.
//
// Dulu tombol unggah hanya ada di setiap baris periode, jadi output yang belum
// punya periode tidak punya tombol unggah sama sekali — persis keadaan setelah
// "Tambah Output". Tombol ini menutup celah itu: kalau periode belum ada, periode
// dibuat lebih dulu lalu langsung dipakai, jadi satu klik cukup dari output sampai
// dialog unggah terbuka.
const unggahOutput = async () => {
  if (sibuk) return;
  let periode = output.periods[0];

  if (!periode) {
    setSibuk(true);
    try {
      const g = await api(`/api/kertas-kerja/${output.id}/generate`, "POST", { tahun });
      const dibuat = (g.periodeBaru || [])[0];
      if (!dibuat) {
        // Periodenya sudah ada di server tapi belum di state. Muat ulang dulu,
        // lalu user coba lagi.
        reload();
        showToast(`Periode ${tahun} sudah ada. Muat ulang halaman lalu pilih baris periodenya.`);
        return;
      }
      periode = { ...dibuat, is_wajib: true };
      // Pohon dimuat ulang supaya baris periode yang baru ikut muncul di tabel.
      // Dialog unggah tetap terbuka di atasnya.
      reload();
    } catch (err) {
      showToast(await pesanError(err, "Gagal membuat periode"));
      return;
    } finally {
      setSibuk(false);
    }
  } else {
    // Prioritaskan periode yang belum terisi dokumennya.
    periode = output.periods.find(p => !p.doc_id) || periode;
  }

  onUnggah({
    periodeId: periode.id,
    // Baris periode memakai judul yang sama supaya nama file hasil upload
    // konsisten antara kedua jalur.
    judul: `${output.nama} — ${periode.label || periode.periode_label || "Periode"}`,
    tahun,
  });
};

return (
  <div style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: 10, marginBottom: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text, flex: 1, minWidth: 180 }}>{output.nama}</span>

        <button onClick={unggahOutput} disabled={sibuk}
          title="Unggah dokumen untuk output ini"
          style={{ ...iconBtn(T), display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", fontSize: 10.5, fontFamily: "inherit" }}>
          <Icon name="upload" size={11} />
          Unggah
        </button>

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

      {/* pic_nama sudah menyelesaikan NIP di server. Kalau tidak ada, tampilkan
          apa adanya: pic_id bisa berisi teks bebas untuk PIC tanpa akun. */}
      {output.pic_nama && (
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <Icon name="users" size={11} style={{ color: T.textMuted, flexShrink: 0 }} />
          <span style={{ fontWeight: 500 }}>{output.pic_nama}</span>
          {output.pic_unit && (
            <span style={{ color: T.textMuted }}>· {output.pic_unit}</span>
          )}
        </div>
      )}

      {output.periods.length === 0 ? (
        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 7, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Icon name="alert" size={12} style={{ color: "#D97706" }} />
          Belum ada periode {tahun}.
          {admin ? (
            <button onClick={unggahOutput} disabled={sibuk}
              style={{ ...iconBtn(T), display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", fontSize: 10.5, fontFamily: "inherit" }}>
              <Icon name="upload" size={11} />
              Buat periode &amp; unggah
            </button>
          ) : ""}
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
                judul={judulDokumenPeriode(output.nama, p.periode_label) || output.nama} tahun={tahun}
                onEdit={() => onEditPeriode(p)} onUnggah={onUnggah} onLihatRiwayat={onLihatRiwayat}
                showToast={showToast} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BarisPeriode({ T, p, admin, onEdit, onUnggah, onLihatRiwayat, reload, showToast, judul, tahun }) {
  const st = statusPeriode(p);
  const meta = STATUS_PERIODE[st];
  const sisa = sisaHari(p.deadline);

  const lepaskan = async () => {
    if (!window.confirm(`Lepas dokumen dari periode ${p.periode_label}? Dokumen tetap ada di arsip.`)) return;
    try {
      await api(`/api/kertas-kerja/periode/${p.id}`, "PATCH", { doc_id: null });
      reload();
    } catch (err) {
      showToast(await pesanError(err, "Gagal melepas dokumen"));
    }
  };

  // Menutup periode yang dokumennya sudah ada di arsip tapi tautannya hilang.
  // Kandidat diambil dari server dengan judul yang sama persis seperti saat
  // unggah, dan user tetap memilih sendiri: tidak ada yang ditebak otomatis.
  const [kandidat, setKandidat] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [sibukHubung, setSibukHubung] = useState(false);

  const bukaKandidat = async () => {
    setMemuat(true);
    setKandidat([]);
    try {
      const rows = await api(
        `/api/kertas-kerja/periode/${p.id}/kandidat?judul=${encodeURIComponent(judul)}`
      );
      setKandidat(rows);
    } catch (err) {
      showToast(await pesanError(err, "Gagal mencari dokumen"));
      setKandidat(null);
    } finally {
      setMemuat(false);
    }
  };

  const hubung = async doc => {
    setSibukHubung(true);
    try {
      await api(`/api/kertas-kerja/periode/${p.id}/tautan`, "POST", { doc_id: doc.id });
      setKandidat(null);
      showToast(`"${doc.judul}" terhubung ke ${p.periode_label}.`);
      reload();
    } catch (err) {
      showToast(await pesanError(err, "Gagal menghubungkan dokumen"));
    } finally {
      setSibukHubung(false);
    }
  };

  return (
    <>
    <tr key={p.id}>
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
            <>
              <button onClick={() => onLihatRiwayat({ docId: p.doc_id, docJudul: p.doc_judul || `Dokumen #${p.doc_id}`, periodeLabel: p.periode_label })}
                title="Riwayat unggah dokumen" style={iconBtn(T)}>
                <Icon name="history" size={11} />
              </button>
              <button onClick={lepaskan} title="Lepas dokumen dari periode ini" style={iconBtn(T)}>
                <Icon name="x" size={11} />
              </button>
            </>
) : (
            <>
              <button onClick={() => onUnggah({ periodeId: p.id, judul, tahun })}
                title="Unggah dokumen untuk periode ini" style={iconBtn(T)}>
                <Icon name="upload" size={11} />
              </button>
              <button onClick={bukaKandidat} disabled={memuat}
                title="Hubungkan dokumen yang sudah ada di arsip" style={iconBtn(T)}>
                <Icon name="link" size={11} />
              </button>
            </>
          )}
          {admin && (
            <button onClick={onEdit} title="Ubah deadline / catatan" style={iconBtn(T)}>
              <Icon name="calendar" size={11} />
            </button>
          )}
        </span>
      </td>
    </tr>
      {kandidat && (
          <tr key={p.id + "-kandidat"}>
            <td colSpan={5} style={{ padding: "6px 7px", background: T.surfaceHover }}>
              {memuat ? (
                <span style={{ fontSize: 10.5, color: T.textMuted }}>Mencari dokumen…</span>
              ) : kandidat.length === 0 ? (
                <span style={{ fontSize: 10.5, color: T.textMuted }}>
                  Tidak ada dokumen di arsip yang cocok dengan &quot;{judul}&quot;.
                </span>
              ) : (
                <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 10, color: T.textSecondary, fontWeight: 600 }}>
                    Pilih dokumen yang sudah terunggah untuk periode ini
                  </span>
                  {kandidat.map(d => (
                    <button key={d.id} disabled={sibukHubung || d.terpakai > 0}
                      onClick={() => hubung(d)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, width: "100%",
                        padding: "4px 6px", fontSize: 10.5, textAlign: "left", cursor: d.terpakai > 0 ? "not-allowed" : "pointer",
                        background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 6, color: d.terpakai > 0 ? T.textMuted : T.text, opacity: d.terpakai > 0 ? 0.6 : 1,
                      }}>
                      <Icon name={d.persis ? "checkCircle" : "file"} size={11} />
                      <span style={{ flex: 1 }}>{d.judul}</span>
                      {d.terpakai > 0 && <span style={{ fontSize: 9.5 }}>sudah dipakai periode lain</span>}
                      {!d.persis && d.terpakai === 0 && <span style={{ fontSize: 9.5, color: T.textMuted }}>judul tidak persis</span>}
                    </button>
                  ))}
                </span>
              )}
            </td>
          </tr>
      )}
    </>
  );
}

// ── Form output (tambah / ubah) ──────────────────────────────────────────
//
// Satu periode bisa punya beberapa laporan dengan deadline berbeda, jadi saat
// menambah output formnya bisa berisi banyak baris. Tiap baris punya
// frekuensi, target, dan aturan deadline sendiri — itulah yang membuat
// "Laporan Bulanan" dan "Laporan Tahunan" bisa hidup berdampingan.
//
// Ubah output tetap satu baris: output yang sudah ada punya id dan periodenya,
// menambah baris saat ubah akan jadi output baru, bukan pengubahan.
const barisOutput = awal => ({
  nama: "", indikator: "", frekuensi: "Tahunan", target: 1,
  bulanWajib: "*", deadlineRule: DEADLINE_DEFAULT.Tahunan, pic: "", keterangan: "",
  ...(awal || {}),
});

function FormOutput({ form, admin, user, sibuk, setSibuk, onTutup, onSelesai, showToast, opsiPengguna = [] }) {
  const { T } = useContext(ThemeContext);
  const o = form.output;
  const banyak = form.mode === "tambah";
  const [baris, setBaris] = useState(() => [barisOutput({
    nama: o?.nama || "", indikator: o?.indikator || "", frekuensi: o?.frekuensi || "Tahunan",
    target: o?.target_per_tahun || 1, bulanWajib: o?.bulan_wajib || "*",
    deadlineRule: o?.deadline_rule || DEADLINE_DEFAULT.Tahunan,
    pic: o?.pic_id || "", keterangan: o?.keterangan || "",
  })]);
  // Default-nya membuat periode, bukan membiarkan kosong. Output tanpa periode
  // tidak punya tabel periode dan tidak punya tombol unggah sama sekali, jadi
  // yang terjadi setelah "Tambah Output" cuma baris output telanjang tanpa ada
  // yang bisa diklik. Periode tetap bisa dimatikan lewat checkbox-nya.
  const [nya, setNya] = useState(banyak);

  const ubahBaris = (i, patch) =>
    setBaris(bs => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  // Ganti frekuensi → ikut sesuaikan pilihan deadline yang valid.
  const gantiFrekuensi = (i, v) => {
    const opsi = DEADLINE_PRESET[v] || [];
    ubahBaris(i, {
      frekuensi: v,
      deadlineRule: opsi.some(d => d.value === baris[i].deadlineRule) ? baris[i].deadlineRule : DEADLINE_DEFAULT[v],
    });
  };

  // Target = jumlah dokumen setahun, jadi frekuensi harus ikut menyesuaikan.
  const gantiTarget = (i, v) => {
    const t = parseInt(v, 10) || 1;
    ubahBaris(i, { target: t, frekuensi: frekuensiDariTarget(t) });
  };

  const tambahBaris = () =>
    setBaris(bs => [...bs, barisOutput({ frekuensi: bs[bs.length - 1]?.frekuensi })]);

  const hapusBaris = i => setBaris(bs => (bs.length === 1 ? bs : bs.filter((_, j) => j !== i)));

  const submit = async ev => {
    ev.preventDefault();
    if (sibuk) return;

    // Baris dengan nama kosong diabaikan, bukan digagalkan. Sisa baris kosong
    // itu lebih sering terjadi karena baris ekstra yang diklik lalu dibiarkan.
    const isi = baris.filter(b => b.nama.trim());
    if (!isi.length) return showToast("Nama output wajib diisi.");
    const kosong = baris.length - isi.length;

    // Indeks baris di form untuk setiap baris yang benar-benar dikirim.
    // Server membalas satu entri hasil per entri payload, jadi nomor hasil
    // harus dipetakan balik ke baris form lewat daftar ini. Memakai indeks
    // hasil langsung akan salah begitu ada baris kosong yang disisipkan user di
    // tengah.
    const indeksKeBaris = [];
    baris.forEach((b, i) => { if (b.nama.trim()) indeksKeBaris.push(i); });

    setSibuk(true);
    try {
      if (form.mode === "edit") {
        const b = isi[0];
        await api(`/api/kertas-kerja/${o.id}`, "PUT", {
          nama: b.nama.trim(), indikator: b.indikator.trim(),
          frekuensi: b.frekuensi, target_per_tahun: parseInt(b.target, 10) || 1,
          bulan_wajib: b.bulanWajib.trim() || "*", deadline_rule: b.deadlineRule,
          pic_id: b.pic.trim() || null, keterangan: b.keterangan.trim() || null,
        });
        showToast(`Output "${b.nama.trim()}" diperbarui.`);
        onSelesai();
        return;
      }

      const payload = isi.map(b => ({
        nama: b.nama.trim(), indikator: b.indikator.trim(),
        frekuensi: b.frekuensi, target_per_tahun: parseInt(b.target, 10) || 1,
        bulan_wajib: b.bulanWajib.trim() || "*", deadline_rule: b.deadlineRule,
        pic_id: b.pic.trim() || null, keterangan: b.keterangan.trim() || null,
      }));

      // Satu baris tetap lewat endpoint lama supaya perilakunya sama seperti
      // sebelumnya, termasuk generate terpisah. Banyak baris lewat bulk, yang
      // sudah membuat periodenya per baris sesuai deadline masing-masing.
      if (payload.length === 1) {
        const res = await api("/api/kertas-kerja", "POST", {
          ...payload[0], subkegiatan_id: form.sub.id, tahun: form.tahun, created_by: user.name,
        });
        if (nya) {
          const g = await api(`/api/kertas-kerja/${res.row.id}/generate`, "POST", { tahun: form.tahun });
          showToast(`Output "${payload[0].nama}" ditambahkan dengan ${g.dibuat} periode ${form.tahun}.`);
        } else {
          showToast(`Output "${payload[0].nama}" ditambahkan. Buat periodenya lewat tombol Unggah di baris output.`);
        }
        onSelesai();
        return;
      }

      const res = await api("/api/kertas-kerja/bulk", "POST", {
        subkegiatan_id: form.sub.id, tahun: form.tahun,
        created_by: user.name, buat_periode: nya, outputs: payload,
      });

      // Kegagalan per baris dilaporkan apa adanya. Kalau ada yang bentrok nama,
      // user perlu tahu baris mana supaya tidak mengira semuanya gagal.
      const gagal = res.hasil.filter(h => !h.ok);
      if (!gagal.length) {
        const totalPeriodeBaru = res.hasil.reduce((a, h) => a + (h.dibuat || 0), 0);
        showToast(`${res.sukses} output ditambahkan${nya ? ` dengan ${totalPeriodeBaru} periode ${form.tahun}` : ""}.`);
        onSelesai();
      } else {
        // Ada yang gagal tapi sebagian berhasil: baris yang gagal dibiarkan
        // di form supaya bisa diperbaiki, sedangkan yang sudah berhasil hilang
        // dari form karena sudah ada di server.
        //
        // Disaring berdasarkan indeks baris form, bukan indeks hasil, supaya
        // baris kosong yang tersisip di tengah tidak membuat baris yang salah
        // ikut terhapus.
        const nomorGagal = new Set(
          res.hasil.map((h, i) => (h.ok ? null : indeksKeBaris[i])).filter(i => i != null)
        );
        setBaris(bs => bs.filter((_, j) => nomorGagal.has(j)));
        showToast(`${res.sukses} ditambahkan, ${gagal.length} gagal: ${gagal.map(g => g.nama || "(kosong)").join(", ")}. Baris yang gagal tetap ada di form.`);
      }
    } catch (err) {
      showToast(await pesanError(err, "Gagal menyimpan output"));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Modal
      title={form.mode === "tambah" ? (baris.length > 1 ? `Tambah ${baris.length} Output` : "Tambah Output") : "Ubah Output"}
      subtitle={`Sub kegiatan ${form.sub.kode} · ${form.sub.nama}`}
      icon={form.mode === "tambah" ? "plus" : "edit"}
      onClose={onTutup}
      maxWidth={840}
      lockClose={sibuk}
    >
      <form onSubmit={submit}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11.5, color: T.textMuted, flex: 1 }}>
            Tiap baris jadi satu output dengan deadline sendiri.
          </span>
        </div>

        {baris.map((b, i) => (
          <div key={i} style={{
            border: `1px solid ${T.border}`, borderRadius: 9, padding: 12, marginTop: 10,
            background: T.bg,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: T.textMuted,
                background: T.surfaceHover, borderRadius: 999, padding: "2px 8px",
              }}>
                Output {i + 1}
              </span>
              <span style={{ fontSize: 10.5, color: T.textMuted, flex: 1 }}>
                {jumlahPeriode(b.target)} periode/tahun · {labelDeadline(b.frekuensi, b.deadlineRule)}
              </span>
              {banyak && baris.length > 1 && (
                <button type="button" onClick={() => hapusBaris(i)} title="Hapus baris ini" style={iconBtn(T)}>
                  <Icon name="trash" size={11} />
                </button>
              )}
            </div>

            <label style={wrap}>
              <span style={lbl(T)}>Nama output / dokumen *</span>
              <input value={b.nama} onChange={e => ubahBaris(i, { nama: e.target.value })}
                placeholder="mis. Laporan Kinerja Triwulan I" style={inp(T)} autoFocus={i === 0} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 10 }}>
              <label style={wrap}>
                <span style={lbl(T)}>Frekuensi</span>
                <select value={b.frekuensi} onChange={e => gantiFrekuensi(i, e.target.value)} style={inp(T)}>
                  {FREKUENSI.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </label>
              <label style={wrap}>
                <span style={lbl(T)}>Target per tahun</span>
                <input type="number" min="1" value={b.target} onChange={e => gantiTarget(i, e.target.value)} style={inp(T)} />
              </label>
              <label style={wrap}>
                <span style={lbl(T)}>Aturan deadline</span>
                <select value={b.deadlineRule} onChange={e => ubahBaris(i, { deadlineRule: e.target.value })} style={inp(T)}>
                  {(DEADLINE_PRESET[b.frekuensi] || []).map(d =>
                    <option key={d.value} value={d.value}>{d.label}</option>
                  )}
                </select>
              </label>
            </div>

            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 11, color: T.textSecondary, cursor: "pointer" }}>
                Detail (indikator, periode wajib, PIC, keterangan)
              </summary>
              <label style={{ ...wrap, marginTop: 8 }}>
                <span style={lbl(T)}>Indikator</span>
                <input value={b.indikator} onChange={e => ubahBaris(i, { indikator: e.target.value })}
                  placeholder="opsional" style={inp(T)} />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 10 }}>
                <label style={wrap}>
                  <span style={lbl(T)}>Periode wajib</span>
                  <input value={b.bulanWajib} onChange={e => ubahBaris(i, { bulanWajib: e.target.value })}
                    placeholder="* atau 1,3,5,7,9,11" style={inp(T)} />
                  <span style={{ fontSize: 10.5, color: T.textMuted, display: "block", marginTop: 3 }}>
                    * = semua {jumlahPeriode(b.target)} periode wajib.
                  </span>
                </label>
                <CariPilih
                  label="PIC"
                  value={b.pic}
                  onChange={v => ubahBaris(i, { pic: v })}
                  opsi={opsiPengguna}
                  placeholder="Cari nama atau NIP…"
                  disabled={sibuk}
                />
              </div>
              <label style={{ ...wrap, marginTop: 10 }}>
                <span style={lbl(T)}>Keterangan</span>
                <input value={b.keterangan} onChange={e => ubahBaris(i, { keterangan: e.target.value })}
                  placeholder="opsional" style={inp(T)} />
              </label>
            </details>
          </div>
        ))}

        {banyak && (
          <button type="button" onClick={tambahBaris} disabled={sibuk || baris.length >= 50}
            style={{
              marginTop: 10, width: "100%", padding: "9px", fontSize: 12,
              background: "transparent", color: T.primary, border: `1.5px dashed ${T.inputBorder}`,
              borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 6, fontFamily: "inherit",
            }}>
            <Icon name="plus" size={12} />
            Tambah baris output lain ({baris.length}/50)
          </button>
        )}

        {banyak && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12 }}>
            <input type="checkbox" id="kk-otomatis" checked={nya} onChange={e => setNya(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: T.primary, cursor: "pointer" }} />
            <label htmlFor="kk-otomatis" style={{ fontSize: 11.5, color: T.textSecondary, cursor: "pointer" }}>
              Langsung buat periode untuk setiap baris (deadline mengikuti aturan masing-masing)
            </label>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <button type="submit" disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
            {sibuk ? "Menyimpan…"
              : form.mode === "edit" ? "Simpan"
                : `Simpan${baris.filter(b => b.nama.trim()).length > 1 ? ` ${baris.filter(b => b.nama.trim()).length} output` : ""}`}
          </button>
          <button type="button" onClick={onTutup} disabled={sibuk} style={btn(T, "transparent", T.text, sibuk, T.inputBorder)}>Batal</button>
        </div>
      </form>
    </Modal>
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
    <Modal
      title={`Ubah Periode ${p.periode_label}`}
      subtitle={`${form.output.nama} · tahun ${form.tahun}`}
      icon="clock"
      onClose={onTutup}
      maxWidth={480}
      lockClose={sibuk}
    >
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <label style={wrap}>
            <span style={lbl(T)}>Deadline</span>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inp(T)} autoFocus />
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

        <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          <button type="submit" disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
          <button type="button" onClick={onTutup} disabled={sibuk} style={btn(T, "transparent", T.text, sibuk, T.inputBorder)}>Batal</button>
        </div>
      </form>
    </Modal>
  );
}

const wrap = { display: "block" };
const lbl = T => ({ display: "block", fontSize: 11, fontWeight: 600, color: T.textSecondary, marginBottom: 4 });
const inp = T => ({
  width: "100%", padding: "7px 10px", border: `1px solid ${T.inputBorder}`,
  borderRadius: 8, fontSize: 12.5, outline: "none", background: T.inputBg,
  color: T.text, fontFamily: "inherit", boxSizing: "border-box",
});

function RiwayatUnggahModal({ docInfo, onTutup }) {
  const { T } = useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    if (!docInfo?.docId) return;
    setLoading(true);
    Promise.all([
      api(`/api/docs/${docInfo.docId}/history`).catch(() => []),
      api(`/api/docs/${docInfo.docId}/versions`).catch(() => ({ versions: [] })),
    ]).then(([hRes, vRes]) => {
      setHistory(Array.isArray(hRes) ? hRes : []);
      setVersions(vRes?.versions || []);
    }).finally(() => setLoading(false));
  }, [docInfo?.docId]);

  return (
    <Modal
      title="Riwayat Unggah Dokumen"
      subtitle={`${docInfo.docJudul} · Periode ${docInfo.periodeLabel}`}
      icon="history"
      onClose={onTutup}
      maxWidth={600}
    >
      {loading ? (
        <div style={{ fontSize: 13, color: T.textMuted, padding: 16, textAlign: "center" }}>
          Memuat riwayat unggah…
        </div>
      ) : (
        <div>
          {history.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.textMuted, padding: "12px 0", textAlign: "center" }}>
              Belum ada riwayat aktivitas untuk dokumen ini.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((h, i) => (
                <div key={h.id || i} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: T.bg,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: h.action === "upload" ? "#EFF6FF" : h.action === "approve" ? "#F0FDF4" : h.action === "reject" ? "#FEF2F2" : T.surfaceHover,
                    color: h.action === "upload" ? "#2563EB" : h.action === "approve" ? "#16A34A" : h.action === "reject" ? "#DC2626" : T.textSecondary,
                  }}>
                    <Icon name={h.action === "upload" ? "upload" : h.action === "approve" ? "check" : h.action === "reject" ? "x" : "history"} size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>
                      {h.action === "upload" ? "Dokumen Diunggah" : h.action === "approve" ? "Disetujui & Diarsipkan" : h.action === "reject" ? "Ditolak" : h.action}
                      {h.actor_name ? <span style={{ fontWeight: 400, color: T.textSecondary }}> oleh {h.actor_name}</span> : null}
                    </div>
                    {h.note && (
                      <div style={{ fontSize: 11.5, color: T.textSecondary, marginTop: 2, fontStyle: "italic" }}>
                        "{h.note}"
                      </div>
                    )}
                    <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 4 }}>
                      {h.created_at}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {versions.length > 1 && (
            <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                Riwayat Versi File ({versions.length} versi)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {versions.map(v => (
                  <div key={v.version_no} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 10px", background: T.surfaceHover, borderRadius: 6, fontSize: 11.5,
                  }}>
                    <span style={{ fontWeight: 600, color: T.text }}>
                      Versi {v.version_no} {v.active ? <span style={{ color: T.primary }}>(Aktif)</span> : null}
                    </span>
                    <span style={{ color: T.textMuted }}>{v.ukuran || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
