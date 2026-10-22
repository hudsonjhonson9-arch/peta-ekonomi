import { useState, useContext, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon, CariPilih, Modal } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";
import { api, usePksTree, usePksTahun, useStandarHarga, useKodeRekening, useDraftRincian, usePerubahan } from "../hooks.js";
import { canManageOutput } from "../data.js";
import { btn, FormPois, LEVELS, pesanError } from "./PksAdmin.jsx";

// Format rupiah lokal — sengaja tidak dibagi ke data.js: hanya dipakai di sini
// (Task 5 bisa memakai sendiri bila perlu).
const rupiah = n => (n == null ? "—" : "Rp " + Math.round(n).toLocaleString("id-ID"));

// Teks angka untuk input: buang ".00" hasil kolom NUMERIC supaya tidak
// tampil "1500,00" di input number. Desimal asli (mis. 2.5) tetap dipertahankan.
const teksAngka = v => {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : String(v);
};

// Tanggal riwayat perubahan — ringkas, tanpa jam.
const tgl = t => new Date(t).toLocaleDateString("id-ID",
  { day: "2-digit", month: "short", year: "numeric" });

// ── Alur validasi sub kegiatan (pola SIPD-RI) ─────────────────────────────
// Draft → Menunggu → Disetujui/Ditolak. Saat menunggu/disetujui sub kegiatan
// terkunci (server menolak perubahan pagu/rekening & rencana belanja dengan
// 409); realisasi tetap boleh diisi.
const SUB_TERKUNCI = ["menunggu", "disetujui"];

const STATUS_UI = {
  draft: { label: "Draft", warna: "#6B7280" },
  menunggu: { label: "Menunggu", warna: "#CA8A04" },
  disetujui: { label: "Disetujui", warna: "#16A34A" },
  ditolak: { label: "Ditolak", warna: "#DC2626" },
};

// Ambang selisih harga rincian vs standar (persen). Di luar ambang → warning.
// Peringatan saja, tidak memblokir persetujuan (cek ketat ada di server).
const AMBANG_SELISIH = 10;

// Selisih persen harga baris vs harga standarnya; null = tanpa standar/harga.
const selisihStandar = (harga, hargaStandar) => {
  if (hargaStandar == null || harga == null || harga === "") return null;
  const hs = Number(hargaStandar);
  const h = Number(harga);
  if (!Number.isFinite(hs) || hs <= 0 || !Number.isFinite(h)) return null;
  return ((h - hs) / hs) * 100;
};

// "+12,5%" / "−8,0%" — koma desimal Indonesia.
const teksSelisih = s => `${s > 0 ? "+" : "−"}${Math.abs(s).toFixed(1).replace(".", ",")}%`;

const chipStatus = status => {
  const s = STATUS_UI[status] || STATUS_UI.draft;
  return {
    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
    flexShrink: 0, color: s.warna, background: `${s.warna}1A`,
    border: `1px solid ${s.warna}4D`,
  };
};

const inputStyle = T => ({
  padding: "7px 10px", border: `1px solid ${T.inputBorder}`, borderRadius: 8,
  fontSize: 12.5, outline: "none", background: T.inputBg, color: T.text,
  fontFamily: "inherit", width: "100%", boxSizing: "border-box",
});

// Tombol ikon aksi di baris pohon (ubah program/kegiatan/sub) & pil tambah
// anak — gaya mengikuti PksAdmin.Node supaya konsisten antar halaman.
const iconAksi = T => ({
  background: "none", border: `1px solid ${T.inputBorder}`, color: T.textSecondary,
  borderRadius: 6, padding: "3px 5px", cursor: "pointer", display: "flex",
});

const pillTambah = T => ({
  display: "inline-flex", alignItems: "center", gap: 3,
  fontSize: 10.5, fontWeight: 600, fontFamily: "inherit",
  padding: "3px 7px", borderRadius: 6, cursor: "pointer",
  background: T.card, color: T.primary,
  border: `1px solid ${T.primary}`, whiteSpace: "nowrap",
});

// Kartu blok di dalam detail sub kegiatan (Pagu, Rencana vs Pagu,
// Perubahan/Realisasi, Validasi) — satu gaya supaya rapi dan sejajar.
const kotak = T => ({
  border: `1px solid ${T.border}`, borderRadius: 8,
  padding: "8px 10px", background: T.surfaceHover,
});

// Judul blok di dalam kotak detail sub.
const judulBlok = T => ({
  fontSize: 11.5, fontWeight: 700, color: T.textSecondary,
});

// Teks uraian kelompok barang utk opsi dropdown kode rekening: maks 2 uraian
// digabung " · ", sisanya "+n lainnya" supaya baris tidak panjang.
const uraianTeks = arr => !arr || !arr.length ? undefined
  : arr.slice(0, 2).join(" · ") + (arr.length > 2 ? ` +${arr.length - 2} lainnya` : "");

// Hierarki kode rekening (induk–anak): cocok bila sama persis ATAU val adalah
// keturunan prefix "rek." — memilih induk menampilkan baris berkode anak.
// Padanan logika ini ada di filterDaftar (server/standar-harga.js).
const rekCocok = (rek, val) => {
  const r = String(rek ?? "").trim();
  const v = String(val ?? "").trim();
  return !!r && (v === r || v.startsWith(`${r}.`));
};

// Fork struktur Panel/SubKey dari KertasKerja.jsx (Panel:274, SubKey:297) —
// KertasKerja tidak diubah dan tidak diekspor, jadi polanya disalin lalu
// disederhanakan: tanpa output/periode, tanpa pencarian.
export default function ScreeningRKA({ user, showToast }) {
  const { T } = useContext(ThemeContext);
  const qc = useQueryClient();
  const [tahun, setTahun] = useState(null);
  const [buka, setBuka] = useState({});

  // Form tambah/ubah Program–Kegiatan–Sub Kegiatan langsung dari pohon
  // (admin) — memakai FormPois yang sama dengan halaman Struktur PKS.
  const [formPks, setFormPks] = useState(null);
  const [sibukPks, setSibukPks] = useState(false);
  const bukaTambahPks = (level, parentId) =>
    setFormPks({ level, mode: "tambah", row: null, parentId, parentLabel: null });
  const bukaEditPks = (level, row) =>
    setFormPks({ level, mode: "edit", row, parentId: row[LEVELS[level].kunci] ?? null });
  // Hapus baris struktur — server menolak bila masih punya anak.
  const hapusPks = async (level, row) => {
    const ok = window.confirm(
      `Hapus ${LEVELS[level].label} "${row.nama}"?\n\n` +
      `Kalau masih ada data di bawahnya, server akan menolak dan Anda harus hapus yang paling bawah dulu.`
    );
    if (!ok) return;
    try {
      await api(`/api/pks/${level}/${row.id}`, "DELETE");
      showToast(`${LEVELS[level].label} "${row.nama}" dihapus.`);
      reload();
    } catch (err) {
      showToast(await pesanError(err, "Gagal menghapus"));
    }
  };

  const admin = canManageOutput(user.role);
  const { data: tahunList = [] } = usePksTahun();
  const { data: tree, isLoading, isError } = usePksTree(tahun);

  // Default ke tahun terbaru yang punya data, sama seperti KertasKerja.
  useEffect(() => {
    if (tahun == null && tahunList.length) setTahun(tahunList[0]);
  }, [tahunList, tahun]);

  const reload = () => {
    qc.invalidateQueries({ queryKey: ["pks-tree", tahun] });
    qc.invalidateQueries({ queryKey: ["pks-ringkasan"] });
    qc.invalidateQueries({ queryKey: ["pks-deadline"] });
    qc.invalidateQueries({ queryKey: ["pks-tahun"] });
  };
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

  // Total anggaran Program & Kegiatan = jumlah pagu sub kegiatan di bawahnya
  // (pohon tidak punya pagu sendiri — dihitung dari klien tiap refetch).
  const programs = (tree?.tree || []).map(p => {
    const kegiatan = (p.kegiatan || []).map(k => ({
      ...k,
      totalPagu: (k.subkegiatan || [])
        .reduce((s, x) => s + (Number(x.pagu) || 0), 0),
    }));
    return {
      ...p,
      kegiatan,
      totalPagu: kegiatan.reduce((s, k) => s + k.totalPagu, 0),
    };
  });

  return (
    <div>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="filter" size={14} style={{ color: T.primary }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Screening RKA</span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
              Program → Kegiatan → Sub Kegiatan · pagu &amp; rencana belanja{admin ? "" : " (lihat saja)"}
            </div>
          </div>

          {/* Kanan: pemilih tahun + aksi dalam satu grup — sebelumnya select
              mengambang di tengah baris (space-between dgn 3 anak). */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary }}>
                Tahun
              </span>
              <select value={tahun ?? ""} aria-label="Tahun anggaran"
                onChange={e => setTahun(parseInt(e.target.value, 10))}
                style={{
                  padding: "6px 9px", border: `1px solid ${T.inputBorder}`, borderRadius: 8,
                  fontSize: 12, background: T.inputBg, color: T.text, fontFamily: "inherit",
                }}>
                {[...new Set([tahun, ...tahunList].filter(Boolean))].sort((a, b) => b - a).map(y =>
                  <option key={y} value={y}>{y}</option>
                )}
              </select>
            </label>

            {admin && tahun != null && (
              <button onClick={() => bukaTambahPks("program", null)}
                style={btn(T, T.card, T.textSecondary, false, T.inputBorder)}>
                <Icon name="plus" size={13} /> Program
              </button>
            )}

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

      {/* Form tambah/ubah program–kegiatan–sub kegiatan (admin) */}
      {formPks && (
        <FormPois
          form={formPks}
          tahun={tahun}
          tree={tree?.tree || []}
          sibuk={sibukPks}
          setSibuk={setSibukPks}
          onTutup={() => setFormPks(null)}
          onSelesai={() => { setFormPks(null); reload(); }}
          showToast={showToast}
        />
      )}

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
          ikon="layers" kode={p.kode} nama={p.nama} total={p.totalPagu}
          aksi={admin ? (
            <>
              <button onClick={() => bukaTambahPks("kegiatan", p.id)}
                title="Tambah Kegiatan di bawah program ini" style={pillTambah(T)}>
                <Icon name="plus" size={11} /> {LEVELS.kegiatan.label}
              </button>
              <button onClick={() => bukaEditPks("program", p)}
                title="Ubah Program" style={iconAksi(T)}>
                <Icon name="edit" size={12} />
              </button>
              <button onClick={() => hapusPks("program", p)}
                title="Hapus Program" style={iconAksi(T)}>
                <Icon name="trash" size={12} />
              </button>
            </>
          ) : null}>
          {p.kegiatan.map(k => (
            <Panel key={`k${k.id}`} T={T} buka={!!buka[`k${k.id}`]} onToggle={() => toggle(`k${k.id}`)}
              ikon="list" kode={k.kode} nama={k.nama} total={k.totalPagu}
              aksi={admin ? (
                <>
                  <button onClick={() => bukaTambahPks("subkegiatan", k.id)}
                    title="Tambah Sub Kegiatan di bawah kegiatan ini" style={pillTambah(T)}>
                    <Icon name="plus" size={11} /> {LEVELS.subkegiatan.label}
                  </button>
                  <button onClick={() => bukaEditPks("kegiatan", k)}
                    title="Ubah Kegiatan" style={iconAksi(T)}>
                    <Icon name="edit" size={12} />
                  </button>
                  <button onClick={() => hapusPks("kegiatan", k)}
                    title="Hapus Kegiatan" style={iconAksi(T)}>
                    <Icon name="trash" size={12} />
                  </button>
                </>
              ) : null}>
              {k.subkegiatan.map(s => (
                <SubRow key={`s${s.id}`} T={T} sub={s} admin={admin} tahun={tahun}
                  buka={!!buka[`s${s.id}`]} onToggle={() => toggle(`s${s.id}`)}
                  showToast={showToast} reload={reload}
                  aksi={admin ? (
                    <>
                      <button onClick={() => bukaEditPks("subkegiatan", s)}
                        title="Ubah Sub Kegiatan" style={iconAksi(T)}>
                        <Icon name="edit" size={12} />
                      </button>
                      <button onClick={() => hapusPks("subkegiatan", s)}
                        title="Hapus Sub Kegiatan" style={iconAksi(T)}>
                        <Icon name="trash" size={12} />
                      </button>
                    </>
                  ) : null} />
              ))}
            </Panel>
          ))}
        </Panel>
      ))}
    </div>
  );
}

// ── Panel rekursif (program / kegiatan) ──────────────────────────────────
// `total`: total pagu sub kegiatan di bawahnya (lihat ScreeningRKA) — chip di
// kanan, gaya sama dengan chip pagu di SubRow.
// `aksi`: tombol tambah anak + ubah (admin) — dibungkus pemisah supaya klik
// tidak ikut menutup/membuka panel.
function Panel({ T, buka, onToggle, ikon, kode, nama, total, aksi = null, children }) {
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
        {total !== undefined && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, flexShrink: 0,
            fontFamily: "ui-monospace, monospace",
            color: T.text, background: T.card, border: `1px solid ${T.border}`,
          }}>
            {rupiah(total)}
          </span>
        )}
        {aksi && (
          <span onClick={e => e.stopPropagation()}
            style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            {aksi}
          </span>
        )}
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
function SubRow({ T, sub, admin, tahun, buka, onToggle, showToast, reload, aksi = null }) {
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

        <span style={chipStatus(sub.status_validasi)}>
          {(STATUS_UI[sub.status_validasi] || STATUS_UI.draft).label}
        </span>

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

        {aksi && (
          <span onClick={e => e.stopPropagation()}
            style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            {aksi}
          </span>
        )}
      </div>

      {buka && (
        <div style={{ margin: "6px 0 0 18px", paddingLeft: 10, borderLeft: `1px solid ${T.border}` }}>
          <DetailSub T={T} sub={sub} admin={admin} tahun={tahun} showToast={showToast} onSave={reload} />
        </div>
      )}
    </div>
  );
}

// ── Detail sub kegiatan: pagu + rencana belanja ───────────────────────────
function DetailSub({ T, sub, admin, tahun, showToast, onSave }) {
  const [paguTeks, setPaguTeks] = useState(() => teksAngka(sub.pagu));
  const [sibuk, setSibuk] = useState(false);

  const status = sub.status_validasi || "draft";
  const terkunci = SUB_TERKUNCI.includes(status);

  // Sinkronkan draft dengan data server HANYA bila nilainya berubah — dependensi
  // berupa nilai, bukan referensi, supaya refetch polling (30 dtk) tidak
  // menimpa input yang sedang diketik selama nilainya sama.
  useEffect(() => {
    setPaguTeks(teksAngka(sub.pagu));
  }, [sub.pagu]);

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

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>
        {sub.kode} · {sub.nama}
      </div>

      {/* Grid seragam (auto-fit): Pagu | Rencana vs Pagu —
          Perubahan/Realisasi | Validasi. Di layar sempit menumpuk satu kolom. */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 10, marginBottom: 14,
      }}>
        {/* Pagu */}
        <div style={kotak(T)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8,
            alignItems: "center", flexWrap: "wrap" }}>
            <span style={judulBlok(T)}>Pagu</span>
            <span style={{ fontSize: 11.5, color: T.textMuted,
              fontFamily: "ui-monospace, monospace" }}>
              {rupiah(sub.pagu)}
            </span>
          </div>
          {terkunci && (
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
              Terkunci — {status === "disetujui" ? "sudah disetujui" : "menunggu validasi Admin"}.
              {" "}Admin bisa membuka lewat "Kembalikan ke Draft" di blok Validasi.
            </div>
          )}
          {admin ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
              <input
                type="number" min="0" step="any" inputMode="decimal"
                value={paguTeks} onChange={e => setPaguTeks(e.target.value)}
                placeholder="0" style={{ ...inputStyle(T), maxWidth: 200 }}
                disabled={terkunci || sibuk}
                onKeyDown={e => { if (e.key === "Enter") simpanPagu(); }}
              />
              <button onClick={simpanPagu} disabled={sibuk || terkunci}
                style={btn(T, T.primary, "#fff", sibuk || terkunci)}>
                Simpan
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 6 }}>
              {rupiah(sub.pagu)}
            </div>
          )}
        </div>

        {/* Rencana vs Pagu + Perubahan/Realisasi (fragment → 2 sel grid) */}
        <RingkasanPagu T={T} sub={sub} tahun={tahun} admin={admin}
          showToast={showToast} onSave={onSave} />

        {/* Validasi */}
        <BlokStatus T={T} sub={sub} admin={admin}
          showToast={showToast} onSave={onSave} />
      </div>

      <DraftRincian T={T} tahun={tahun} sub={sub} terkunci={terkunci}
        showToast={showToast} />
    </div>
  );
}

// ── Blok alur validasi: Draft → Menunggu → Disetujui/Ditolak ──────────────
// Staf mengajukan (Draft/Ditolak → Menunggu), Admin memvalidasi (Setujui /
// Tolak / Kembalikan ke Draft). Server tetap memaksa prasyarat: pagu terisi
// dan total rencana ≤ pagu saat menyetujui; catatan wajib saat menolak —
// tombol dinonaktifkan di klien supaya alasan kelihatan sebelum diklik.
function BlokStatus({ T, sub, admin, showToast, onSave }) {
  const status = sub.status_validasi || "draft";
  const { data } = useDraftRincian(sub.id);
  const total = data ? data.total : 0;
  const pagu = sub.pagu;
  const adaPagu = pagu != null && pagu > 0;          // sama dengan RingkasanPagu
  const melebihi = adaPagu && total > pagu;

  const [sibuk, setSibuk] = useState(false);
  const [tolakBuka, setTolakBuka] = useState(false);
  const [catatan, setCatatan] = useState("");

  // Tutup form catatan saat status berubah (mis. setelah diajukan ulang).
  useEffect(() => { setTolakBuka(false); setCatatan(""); }, [status]);

  const kirim = async (path, body, pesan) => {
    setSibuk(true);
    try {
      await api(path, "POST", body);
      showToast(pesan);
      setTolakBuka(false);
      onSave && onSave();
    } catch (e) {
      showToast(`Gagal: ${e.message}`);
    } finally {
      setSibuk(false);
    }
  };

  const ajukan = () =>
    kirim("/api/screening/ajukan", { subkegiatan_id: sub.id },
      "Diajukan untuk validasi Admin.");
  const setujui = () =>
    kirim("/api/screening/validasi", { subkegiatan_id: sub.id, status: "disetujui" },
      "Disetujui.");
  const tolak = () => {
    if (!catatan.trim()) { showToast("Catatan wajib diisi saat menolak."); return; }
    kirim("/api/screening/validasi",
      { subkegiatan_id: sub.id, status: "ditolak", catatan },
      "Ditolak — catatan terkirim.");
  };
  const kembalikan = () =>
    kirim("/api/screening/validasi", { subkegiatan_id: sub.id, status: "draft" },
      "Dikembalikan ke Draft.");

  const alasan = !adaPagu ? "Pagu belum diisi"
    : melebihi ? "Total rencana melebihi pagu"
    : "";
  const ui = STATUS_UI[status] || STATUS_UI.draft;

  return (
    <div style={kotak(T)}>
      {/* Judul + chip di kiri, aksi di kanan — satu baris, wrap di layar sempit */}
      <div style={{ display: "flex", gap: 8, alignItems: "center",
        flexWrap: "wrap", justifyContent: "space-between" }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={judulBlok(T)}>Validasi</span>
          <span style={chipStatus(status)}>{ui.label}</span>
          {sub.status_oleh && sub.status_at && (
            <span style={{ fontSize: 11, color: T.textMuted }}>
              oleh {sub.status_oleh} · {tgl(sub.status_at)}
            </span>
          )}
        </span>

        <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {(status === "draft" || status === "ditolak") && (
            <button onClick={ajukan} disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
              <Icon name="check" size={13} /> Ajukan ke Admin
            </button>
          )}
          {status === "menunggu" && !admin && (
            <span style={{ fontSize: 12, color: T.textMuted }}>
              Menunggu validasi Admin…
            </span>
          )}
          {status === "menunggu" && admin && (
            <>
              <button onClick={setujui} disabled={sibuk || !!alasan}
                style={btn(T, "#16A34A", "#fff", sibuk || !!alasan)}>
                <Icon name="check" size={13} /> Setujui
              </button>
              <button onClick={() => setTolakBuka(v => !v)} disabled={sibuk}
                style={btn(T, "#DC2626", "#fff", sibuk)}>
                <Icon name="x" size={13} /> Tolak
              </button>
              {alasan && (
                <span style={{ fontSize: 11, color: "#DC2626" }}>
                  {alasan} — Setujui dinonaktifkan.
                </span>
              )}
            </>
          )}
          {admin && (status === "disetujui" || status === "ditolak") && (
            <button onClick={kembalikan} disabled={sibuk}
              style={btn(T, T.card, T.textSecondary, sibuk, T.inputBorder)}>
              Kembalikan ke Draft
            </button>
          )}
        </span>
      </div>

      {sub.catatan_validasi && (
        <div style={{
          fontSize: 11.5, marginTop: 6, color: status === "ditolak" ? "#DC2626" : T.textSecondary,
        }}>
          Catatan: {sub.catatan_validasi}
        </div>
      )}

      {tolakBuka && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={catatan} onChange={e => setCatatan(e.target.value)}
            placeholder="Alasan penolakan (wajib)"
            style={{ ...inputStyle(T), maxWidth: 340 }}
            onKeyDown={e => { if (e.key === "Enter") tolak(); }} />
          <button onClick={tolak} disabled={sibuk} style={btn(T, "#DC2626", "#fff", sibuk)}>
            Konfirmasi tolak
          </button>
          <button onClick={() => { setTolakBuka(false); setCatatan(""); }}
            style={btn(T, T.surfaceHover, T.textSecondary, false, T.inputBorder)}>
            Batal
          </button>
        </div>
      )}
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

  // Status klien: <90% Aman · pas 100% Pas · 90–<100% Mendekati · >100% Melebihi
  const persenPas = adaPagu && Number(pagu) === Number(totalRencana);
  const badge = !adaPagu
    ? { label: "Pagu belum diisi", warna: T.textMuted }
    : persenPas
      ? { label: "Pas", warna: "#16A34A" }
      : persen < 90
        ? { label: "Aman", warna: "#16A34A" }
        : persen < 100
          ? { label: "Mendekati", warna: "#CA8A04" }
          : { label: "Melebihi", warna: "#DC2626" };

  // Stat blok: label kecil di atas, nilai tebal monospace di bawah — lebih
  // terbaca daripada "Label: nilai" panjang dalam satu baris.
  const item = (label, nilai, warna) => (
    <div style={{ minWidth: 84 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 1,
        color: warna || T.text, fontFamily: "ui-monospace, monospace" }}>
        {nilai}
      </div>
    </div>
  );

  // Baris yang harganya menyimpang > ambang dari standar SSH/SBU — warning
  // saja, tidak memblokir persetujuan.
  const deviasi = ((data && data.items) || []).filter(it => {
    const s = selisihStandar(it.harga_satuan, it.harga_standar);
    return s != null && Math.abs(s) > AMBANG_SELISIH;
  }).length;

  // Snapshot inisiasi terakhir untuk sub ini (bila tahun sudah diinisiasi).
  const snap = (perubahan?.item || [])
    .find(i => Number(i.subkegiatan_id) === Number(sub.id));
  const inisiasi = perubahan?.riwayat?.[0];

  // Realisasi: draft disinkronkan dengan data server hanya saat nilainya
  // berubah (pola pagu di DetailSub) supaya refetch polling tidak menimpa
  // input yang sedang diketik.
  const [realTeks, setRealTeks] = useState(() => teksAngka(sub.realisasi));
  const [sibukReal, setSibukReal] = useState(false);
  useEffect(() => {
    setRealTeks(teksAngka(sub.realisasi));
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
    // Fragment: dua kartu ini jadi dua sel grid di DetailSub (auto-fit).
    <>
      <div style={kotak(T)}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8,
          alignItems: "center", flexWrap: "wrap" }}>
          <span style={judulBlok(T)}>Rencana vs Pagu</span>
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: badge.warna,
              background: `${badge.warna}1A`, border: `1px solid ${badge.warna}4D`,
              borderRadius: 999, padding: "2px 8px" }}>
              {badge.label}
            </span>
            {deviasi > 0 && (
              <span title="Baris dengan selisih harga vs standar di luar ambang"
                style={{ fontSize: 11, fontWeight: 700, color: "#DC2626",
                  background: "#DC26261A", border: "1px solid #DC26264D",
                  borderRadius: 999, padding: "2px 8px",
                  display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="alert" size={11} />
                {deviasi} baris selisih &gt;{AMBANG_SELISIH}%
              </span>
            )}
          </span>
        </div>
        {/* Stat 2×2 biar rapi (tidak ada yang turun sendirian saat wrap) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "8px 16px", marginTop: 8 }}>
          {adaPagu && item("Pagu", rupiah(pagu))}
          {item("Total rencana", rupiah(totalRencana))}
          {adaPagu && item("Sisa", rupiah(sisa))}
          {adaPagu && item("Terpakai", `${persen.toFixed(1)}%`, badge.warna)}
        </div>
      </div>

      {/* Perubahan anggaran + realisasi */}
      <div style={kotak(T)}>
        {snap ? (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary }}>
              Perubahan Anggaran {tahun}
              {inisiasi && (
                <span style={{ fontWeight: 400, color: T.textMuted }}>
                  {" "}· diinisiasi {tgl(inisiasi.created_at)}
                </span>
              )}
            </div>
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: "8px 16px", marginTop: 8 }}>
              {item("Sebelum perubahan", rupiah(Number(snap.sebelum_rencana || 0)))}
              {item("Sesudah perubahan", rupiah(totalRencana))}
              {item("Selisih",
                `${selisih > 0 ? "+" : selisih < 0 ? "−" : ""}${rupiah(Math.abs(selisih))}`,
                selisih > 0 ? "#DC2626" : selisih < 0 ? "#16A34A" : T.textSecondary)}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: T.textMuted }}>
            Belum ada inisiasi perubahan untuk {tahun ?? "tahun ini"}
            {admin ? " — gunakan tombol \"Inisiasi Perubahan\"." : "."}
          </div>
        )}

        {/* Realisasi dipisah garis putus-putus supaya tidak menyatu
            dengan info perubahan. */}
        <div style={{ display: "flex", gap: 6, alignItems: "center",
          flexWrap: "wrap", marginTop: 8, paddingTop: 8,
          borderTop: `1px dashed ${T.inputBorder}` }}>
          <span style={judulBlok(T)}>Realisasi</span>
          {admin ? (
            <>
              <input
                type="number" min="0" step="any" inputMode="decimal"
                value={realTeks} onChange={e => setRealTeks(e.target.value)}
                placeholder="0"
                style={{ ...inputStyle(T), maxWidth: 150, padding: "4px 8px", fontSize: 12 }}
                onKeyDown={e => { if (e.key === "Enter") simpanRealisasi(); }}
              />
              <button onClick={simpanRealisasi} disabled={sibukReal}
                style={btn(T, T.primary, "#fff", sibukReal)}>
                Simpan
              </button>
              <span style={{ fontSize: 11.5, color: T.textMuted,
                fontFamily: "ui-monospace, monospace" }}>
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
    </>
  );
}

// ── Draft Rincian: rencana belanja per sub kegiatan (Task 9) ──────────────
// Semua staf boleh CRUD — kebijakan LOGIN (keputusan 2026-10-06) — jadi tidak
// ada pintu admin di sini, berbeda dengan blok pagu/chips di atasnya.
// Uraian dipilih lewat dropdown search SSH+SBU (data Admin) — mengikuti pola
// SIPD (Standar Harga → pilih komponen); baris dikelompokkan per
// kelompok_belanja sebagai header grup — keterangan (catatan) tampil di bawah
// nama grup bila seragam di seluruh baris grup.
// `terkunci`: sub kegiatan menunggu/disetujui → CRUD diblokir (server juga
// menolak 409); isi form yang sudah terbuka dibiarkan apa adanya.
function DraftRincian({ T, tahun, sub, terkunci, showToast }) {
  const qc = useQueryClient();
  const { data, isLoading } = useDraftRincian(sub.id);
  const items = (data && data.items) || [];

  const [editId, setEditId] = useState(null);   // null | id baris yang diedit
  const [form, setForm] = useState(null);       // null | salinan item (kerja)
  const [tambahBuka, setTambahBuka] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  // Draft volume inline per baris (key = id) — diisi saat mengedit di tabel,
  // dikirim saat blur/Enter bila berbeda dari nilai server.
  const [volLokal, setVolLokal] = useState({});

  const tutup = () => {
    setEditId(null); setTambahBuka(false); setForm(null);
  };
  const muatUlang = () =>
    qc.invalidateQueries({ queryKey: ["draft-rincian", sub.id] });

  const tambah = () => {
    setEditId(null);
    setForm({
      kelompok_belanja: "", uraian: "", spesifikasi: "", satuan: "",
      volume: "", harga_satuan: "", kode_rekening: "", catatan: "",
      standar_harga_id: null, harga_standar: null,
    });
    setTambahBuka(true);
  };

  const edit = (it) => {
    setEditId(it.id);
    // NUMERIC kembali "1500.00" dari pg — konversi ke teks polos supaya
    // input number tidak menampilkan "1500,00".
    setForm({ ...it, volume: teksAngka(it.volume), harga_satuan: teksAngka(it.harga_satuan) });
    setTambahBuka(false);
  };

  // PATCH-2 (bagian Simpan): editId terisi → PUT (baris existing),
  // tidak ada → POST. Muat ulang key yang sama persis: ['draft-rincian', sub.id].
  const simpan = async () => {
    if (!form) return;
    const isi = {
      kelompok_belanja: form.kelompok_belanja, uraian: form.uraian,
      spesifikasi: form.spesifikasi, satuan: form.satuan,
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

  // Simpan volume dari sel tabel (blur / Enter) — hanya bila nilainya berubah.
  const simpanVolume = async (it, teks) => {
    const n = Number(teks);
    if (teks.trim() === "" || !Number.isFinite(n) || n < 0) {
      showToast("Volume harus angka nol atau lebih.");
      setVolLokal(p => { const q = { ...p }; delete q[it.id]; return q; });
      return;
    }
    if (Number(it.volume) === n) {
      setVolLokal(p => { const q = { ...p }; delete q[it.id]; return q; });
      return;
    }
    setSibuk(true);
    try {
      await api(`/api/draft-rincian/${it.id}`, "PUT", {
        kelompok_belanja: it.kelompok_belanja, uraian: it.uraian,
        spesifikasi: it.spesifikasi, satuan: it.satuan,
        volume: n, harga_satuan: it.harga_satuan,
        kode_rekening: it.kode_rekening, catatan: it.catatan,
        standar_harga_id: it.standar_harga_id, harga_standar: it.harga_standar,
      });
      setVolLokal(p => { const q = { ...p }; delete q[it.id]; return q; });
      muatUlang();
    } catch (e) {
      showToast(`Gagal menyimpan volume: ${e.message}`);
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

  // Kelompok header ala SIPD: urut sesuai kemunculan pertama; nama kosong =
  // baris tanpa kelompok, tampil biasa tanpa header. Grup dipecah per
  // kombinasi kelompok+catatan — kelompok sama tapi keterangan beda =
  // header terpisah dengan totalnya masing-masing.
  const grup = [];
  const indeks = new Map();
  items.forEach(it => {
    const nama = (it.kelompok_belanja || "").trim();
    const kat = (it.catatan || "").trim();
    const key = nama + "\u0000" + kat;
    if (!indeks.has(key)) {
      const g = { nama, baris: [], total: 0, kat };
      indeks.set(key, g);
      grup.push(g);
    }
    const g = indeks.get(key);
    g.baris.push(it);
    if (it.volume != null && it.harga_satuan != null)
      g.total += Math.round(Number(it.volume) * Number(it.harga_satuan));
  });

  const th = {
    padding: "6px 8px", fontSize: 11, fontWeight: 700,
    color: T.textSecondary, textAlign: "left", whiteSpace: "nowrap",
  };

  // Saran kelompok untuk form baris: nama yang sudah pernah dipakai di sub
  // kegiatan ini. Pengisian tetap teks bebas ala SIPD — daftar hanya membantu.
  const saranKelompok = [...new Set(items
    .map(it => (it.kelompok_belanja || "").trim())
    .filter(Boolean))];

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text }}>
          Rencana Belanja
        </span>
        <button onClick={tambah} disabled={sibuk || terkunci}
          style={btn(T, T.primary, "#fff", sibuk || terkunci)}>
          + Tambah baris
        </button>
        {terkunci && (
          <span style={{ fontSize: 11, color: T.textMuted }}>
            Terkunci — sub kegiatan sedang divalidasi atau sudah disetujui.
          </span>
        )}
      </div>

      {form && (
        <Modal
          title={editId != null ? "Edit Baris Rencana" : "Tambah Baris Rencana"}
          subtitle={sub.nama}
          onClose={terkunci ? undefined : tutup}
          lockClose={sibuk || terkunci}
          maxWidth={640}
        >
          <FormBaris T={T} tahun={tahun} sub={sub} form={form} setForm={setForm}
            onSimpan={simpan} onBatal={tutup} sibuk={sibuk}
            saranKelompok={saranKelompok} />
        </Modal>
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
              {grup.map(g => [
                g.nama ? (
                  // Struktur sel mengikuti baris data: nama di kolom 1–5,
                  // total tepat di kolom "Total" (kolom 6) supaya sejajar
                  // dengan total per baris & footer — bukan colSpan=7 yang
                  // melesat ke tepi kanan melewati kolom aksi.
                  <tr key={`${g.nama}__header`} style={{ background: T.surfaceHover }}>
                    <td colSpan={5} style={{ padding: "6px 8px" }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: T.text }}>
                        {g.nama}
                      </span>
                      {g.kat && (
                        <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2 }}>
                          Keterangan: {g.kat}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap",
                      fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: 12,
                      color: T.text }}>
                      {rupiah(g.total)}
                    </td>
                    <td />
                  </tr>
                ) : null,
                ...g.baris.map(it => {
                  // PATCH-3: cek null eksplisit sebelum rupiah(), jangan || "—".
                  const total = it.volume == null || it.harga_satuan == null
                    ? null
                    : Math.round(Number(it.volume) * Number(it.harga_satuan));
                  // Selisih vs standar SSH/SBU — warning bila di luar ambang.
                  const sel = selisihStandar(it.harga_satuan, it.harga_standar);
                  const banding = sel != null && Math.abs(sel) > AMBANG_SELISIH;
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
                        {terkunci || editId === it.id ? (
                          <span>{Number(it.volume)} {it.satuan}</span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="number" min="0" step="any" inputMode="decimal"
                              value={volLokal[it.id] ?? teksAngka(it.volume)}
                              onChange={e => setVolLokal(p => ({ ...p, [it.id]: e.target.value }))}
                              onBlur={e => simpanVolume(it, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                                if (e.key === "Escape") {
                                  setVolLokal(p => { const q = { ...p }; delete q[it.id]; return q; });
                                  e.currentTarget.blur();
                                }
                              }}
                              disabled={sibuk}
                              aria-label={`Volume ${it.uraian}`}
                              style={{
                                width: 72, padding: "3px 6px", fontSize: 12,
                                border: `1px solid ${T.inputBorder}`, borderRadius: 6,
                                background: T.inputBg, color: T.text, fontFamily: "inherit",
                              }}
                            />
                            <span style={{ fontSize: 11, color: T.textMuted }}>{it.satuan}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap",
                        fontFamily: "ui-monospace, monospace", color: T.text }}>
                        {it.harga_satuan == null ? "—" : rupiah(it.harga_satuan)}
                        {banding && (
                          <div title="Selisih harga vs standar di luar ambang"
                            style={{ fontSize: 10, fontWeight: 700, color: "#DC2626" }}>
                            {teksSelisih(sel)}
                          </div>
                        )}
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
                          <button onClick={() => edit(it)} disabled={sibuk || terkunci}
                            style={btn(T, T.surfaceHover, T.textSecondary, sibuk || terkunci, T.inputBorder)}>
                            Edit
                          </button>
                          <button onClick={() => hapus(it)} disabled={sibuk || terkunci}
                            style={btn(T, "#DC2626", "#fff", sibuk || terkunci)}>
                            Hapus
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                }),
              ])}
              {grup.length > 0 && (
                <tr style={{ background: T.surfaceHover, borderTop: `2px solid ${T.border}` }}>
                  <td colSpan={5} style={{ padding: "6px 8px", fontWeight: 700, fontSize: 12,
                    color: T.text, textAlign: "right" }}>
                    Total
                  </td>
                  <td style={{ padding: "6px 8px", fontWeight: 700, fontSize: 12,
                    color: T.text, textAlign: "right", whiteSpace: "nowrap",
                    fontFamily: "ui-monospace, monospace" }}>
                    {rupiah(grup.reduce((a, g) => a + g.total, 0))}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// FormBaris: shared tambah & edit. Total live = rumus identik dengan server
// (jumlahItem): Math.round(volume * harga). Uraian dipilih lewat dropdown
// search SSH+SBU (PilihUraian) — pola SIPD: Standar Harga → pilih komponen.
// Kode rekening dipilih dari daftar (chips sub kegiatan ∪ distinct standar
// harga) ala SIPD "Pilih Rekening/Akun" — memilihnya langsung menyaring
// kandidat uraian. Kelompok belanja tetap teks bebas ala SIPD (header grup),
// dengan saran dari kelompok yang sudah pernah dipakai.
function FormBaris({ T, tahun, sub, form, setForm, onSimpan, onBatal, sibuk,
  saranKelompok = [] }) {
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setTeks = k => v => setForm(p => ({ ...p, [k]: v }));

  const volume = Number(form.volume) || 0;
  const harga = Number(form.harga_satuan) || 0;
  const total = Math.round(volume * harga);

  // Selisih live vs standar — tampil selama di luar ambang (peringatan saja).
  const sel = selisihStandar(form.harga_satuan, form.harga_standar);
  const banding = sel != null && Math.abs(sel) > AMBANG_SELISIH;

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
    ["Spesifikasi", "spesifikasi", "", "2 1 160px"],
    ["Satuan", "satuan", "sak", "1 1 90px"],
    ["Volume", "volume", "0", "1 1 90px"],
    ["Harga satuan", "harga_satuan", "0", "1 1 130px"],
    ["Keterangan", "catatan", "", "2 1 160px"],
  ];

  // Opsi "Kode rekening": chips sub kegiatan ∪ distinct standar harga tahun
  // ini (urut abjad, dedupe). Kode dari standar_harga membawa teks uraian
  // kelompok barang (sub) → dropdown bisa dicari lewat uraian, bukan hanya
  // angka kodenya. Pilih salah satu → filter uraian di PilihUraian secara
  // hierarki (induk → anak) ikut menyaring; ketik manual tetap diterima
  // (CariPilih) untuk kode yang belum ada di daftar.
  const daftarRek = useKodeRekening(tahun);
  const chipsRek = [...new Set((sub.kode_rekening || [])
    .map(s => String(s).trim()).filter(Boolean))];
  const petaRek = new Map((daftarRek.data || [])
    .map(o => [String(o.kode).trim(), o.uraian || []]));
  const opsiRekening = [...new Set([...chipsRek, ...(daftarRek.data || []).map(o => o.kode)])]
    .sort((a, b) => a.localeCompare(b))
    .map(k => ({ value: k, label: k, sub: uraianTeks(petaRek.get(k) || []) }));

  const opsiKelompok = saranKelompok.map(n => ({ value: n, label: n }));

  return (
    <div style={{ border: `1px solid ${T.inputBorder}`, borderRadius: 8,
      padding: 10, background: T.surfaceHover, marginBottom: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <div style={kolom("3 1 300px")}>
          <span style={lb}>Uraian — cari dari SSH / SBU</span>
          <PilihUraian T={T} tahun={tahun} sub={sub} form={form}
            setForm={setForm} sibuk={sibuk} />
        </div>
        <div style={kolom("1 1 150px")}>
          <span style={lb}>Kode rekening</span>
          <CariPilih value={form.kode_rekening || ""}
            onChange={setTeks("kode_rekening")}
            opsi={opsiRekening} placeholder="5.1.02.01" disabled={sibuk}
            kosongDaftar="Belum ada daftar rekening — ketik kode."
            kosongCari="Tidak ada rekening cocok. Tekan Enter untuk memakai kode ini." />
        </div>
        <div style={kolom("2 1 200px")}>
          <span style={lb}>Kelompok belanja</span>
          <CariPilih value={form.kelompok_belanja || ""}
            onChange={setTeks("kelompok_belanja")}
            opsi={opsiKelompok} placeholder="Belanja Barang Pakai Habis"
            disabled={sibuk}
            kosongDaftar="Belum ada kelompok — ketik baru."
            kosongCari="Tidak ada kelompok cocok. Tekan Enter untuk memakai teks ini." />
        </div>
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
        {banding && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626" }}>
            Selisih {teksSelisih(sel)} dari standar
          </span>
        )}
        <button onClick={onSimpan} disabled={sibuk} style={btn(T, T.primary, "#fff", sibuk)}>
          Simpan
        </button>
        <button onClick={onBatal} disabled={sibuk}
          style={btn(T, T.surfaceHover, T.textSecondary, sibuk, T.inputBorder)}>
          Batal
        </button>
      </div>
    </div>
  );
}

// Dropdown pencarian uraian dari data Standar Harga (SSH + SBU, diinput Admin)
// — menggantikan alur "Cocokkan" lama; mengikuti pola SIPD: memilih komponen
// mengisi uraian/spesifikasi/satuan/kode rekening/harga standar otomatis
// (harga_satuan hanya bila masih kosong). Mengetik = cari (debounce 300ms),
// sekaligus tetap jadi uraian manual bila tidak memilih.
// rekening: kode baris diisi → kirim (filter server exact); kosong → jangan
// kirim chips[0] (melewatkan kandidat kode lain) — kirim undefined lalu
// filter lokal dengan chips sub kegiatan.
function PilihUraian({ T, tahun, sub, form, setForm, sibuk }) {
  const [buka, setBuka] = useState(false);
  const [qD, setQD] = useState(form.uraian || "");
  const [sorot, setSorot] = useState(0);
  const [rect, setRect] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const q = form.uraian || "";
  useEffect(() => {
    const t = setTimeout(() => setQD(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Panel fixed: dropdown tidak boleh terpotong overflow body Modal.
  useEffect(() => {
    if (!buka || !inputRef.current) { setRect(null); return; }
    const hitung = () => {
      const r = inputRef.current.getBoundingClientRect();
      setRect({ top: r.bottom, left: r.left, width: r.width });
    };
    hitung();
    window.addEventListener("scroll", hitung, true);
    window.addEventListener("resize", hitung);
    return () => {
      window.removeEventListener("scroll", hitung, true);
      window.removeEventListener("resize", hitung);
    };
  }, [buka]);
  const keAtas = rect ? window.innerHeight - rect.top < 400 : false;

  const qKirim = qD.trim() || undefined;
  const rek = form.kode_rekening || undefined;
  const ssh = useStandarHarga({ tahun, jenis: "SSH", q: qKirim, rekening: rek });
  const sbu = useStandarHarga({ tahun, jenis: "SBU", q: qKirim, rekening: rek });
  const memuat = ssh.isLoading || sbu.isLoading;

  const chips = sub.kode_rekening || [];
  const semua = [...(ssh.data || []), ...(sbu.data || [])]
    // Tanpa kode rekening terpilih: batasi ke chips sub kegiatan secara
    // hierarki (induk → anak), sama seperti filterDaftar di server.
    .filter(it => rek || !chips.length || chips.some(c => rekCocok(c, it.kode_rekening)))
    .sort((a, b) => String(a.uraian_barang).localeCompare(String(b.uraian_barang)));
  const kandidat = semua.slice(0, 12);
  const sisa = semua.length - kandidat.length;
  const sorotEfektif = kandidat.length ? Math.min(sorot, kandidat.length - 1) : 0;

  // Navigasi keyboard: sorotan kembali ke baris pertama tiap daftar berubah
  // (q, filter rekening, atau refetch), dan panel digulir supaya baris yang
  // disorot selalu terlihat.
  useEffect(() => { setSorot(0); }, [qD, rek, ssh.data, sbu.data, chips.join("")]);
  useEffect(() => {
    const el = listRef.current?.children?.[sorotEfektif];
    if (el?.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [sorotEfektif, buka, kandidat.length]);

  const onKeyDown = e => {
    if (e.key === "Escape") { setBuka(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setBuka(true);
      setSorot(s => Math.min(s + 1, Math.max(kandidat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSorot(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && buka && kandidat[sorotEfektif]) {
      e.preventDefault();
      pilih(kandidat[sorotEfektif]);
    }
  };

  const pilih = it => {
    setForm(p => ({
      ...p,
      standar_harga_id: it.id,
      harga_standar: it.harga_satuan ?? null,
      uraian: it.uraian_barang,
      spesifikasi: it.spesifikasi ?? p.spesifikasi ?? "",
      satuan: it.satuan ?? p.satuan ?? "",
      kode_rekening: it.kode_rekening ?? p.kode_rekening ?? "",
      harga_satuan: (p.harga_satuan == null || p.harga_satuan === "" ||
        Number(p.harga_satuan) === 0) ? it.harga_satuan : p.harga_satuan,
    }));
    setBuka(false);
  };
  const tanpa = () => {
    setForm(p => ({ ...p, standar_harga_id: null, harga_standar: null }));
    setBuka(false);
  };

  const inp = { ...inputStyle(T), width: "100%" };
  // Opsi wrap: uraian panjang turun baris (bukan ellipsis) supaya kebaca;
  // harga/satuan di kanan sejajar atas.
  const opsi = { display: "flex", justifyContent: "space-between", gap: 10,
    width: "100%", alignItems: "flex-start", padding: "6px 8px", borderRadius: 6,
    cursor: "pointer", textAlign: "left", border: "none", background: "transparent",
    color: T.text, fontSize: 12, fontFamily: "inherit" };

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        value={q} disabled={sibuk} autoComplete="off"
        onChange={e => setForm(p => ({ ...p, uraian: e.target.value }))}
        onFocus={() => setBuka(true)}
        onBlur={() => setBuka(false)}
        onKeyDown={onKeyDown}
        placeholder="Ketik untuk cari SSH / SBU…"
        style={inp}
      />
      {buka && !sibuk && rect && (
        <div ref={listRef} role="listbox" style={{
          position: "fixed",
          top: keAtas ? undefined : rect.top + 4,
          bottom: keAtas ? window.innerHeight - rect.top + 4 : undefined,
          left: rect.left, width: rect.width,
          zIndex: 1300, background: T.card,
          border: `1px solid ${T.inputBorder}`, borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,.14)", padding: 6,
          maxHeight: 380, overflowY: "auto" }}>
          {memuat ? (
            <div style={{ fontSize: 11.5, color: T.textMuted, padding: "4px 4px" }}>
              Mencari standar harga…
            </div>
          ) : kandidat.length === 0 ? (
            <div style={{ fontSize: 11.5, color: T.textMuted, padding: "4px 4px" }}>
              {qKirim ? `Tidak ada data untuk "${qKirim}".`
                : rek ? `Tidak ada SSH/SBU untuk rekening ${rek}.`
                : "Belum ada data SSH/SBU — uraian bisa diketik manual."}
            </div>
          ) : kandidat.map((it, i) => (
            <button key={`${it.jenis}-${it.id}`} type="button" role="option"
              aria-selected={i === sorotEfektif}
              onMouseDown={e => { e.preventDefault(); pilih(it); }}
              onMouseEnter={() => setSorot(i)}
              style={{ ...opsi,
                background: i === sorotEfektif
                  ? (T.surfaceHover || "rgba(127,127,127,.08)")
                  : "transparent" }}>
              <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word", lineHeight: 1.35 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, marginRight: 5,
                  color: it.jenis === "SBU" ? "#2563EB" : "#16A34A" }}>
                  {it.jenis}
                </span>
                {it.uraian_barang}
                {it.kode_rekening ? (
                  <span style={{ color: T.textMuted, fontFamily: "ui-monospace, monospace" }}>
                    {" · "}{it.kode_rekening}
                  </span>
                ) : null}
                {it.spesifikasi ? (
                  <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2, wordBreak: "break-word" }}>
                    {it.spesifikasi}
                  </div>
                ) : null}
              </span>
              <span style={{ flexShrink: 0, textAlign: "right", fontFamily: "ui-monospace, monospace",
                fontSize: 11.5, lineHeight: 1.35, paddingTop: 1 }}>
                {it.harga_satuan == null ? "—" : rupiah(it.harga_satuan)}
                {it.satuan ? (
                  <div style={{ fontSize: 10.5, color: T.textMuted }}>
                    / {it.satuan}
                  </div>
                ) : null}
              </span>
            </button>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8,
            marginTop: 4, paddingTop: 5, borderTop: `1px dashed ${T.inputBorder}` }}>
            <button type="button"
              onMouseDown={e => { e.preventDefault(); tanpa(); }}
              style={{ ...opsi, justifyContent: "flex-start", padding: "4px 6px",
                color: T.textSecondary, fontSize: 11.5, alignItems: "center" }}>
              Tanpa standar harga
            </button>
            {sisa > 0 && (
              <span style={{ fontSize: 10.5, color: T.textMuted, alignSelf: "center" }}>
                +{sisa} lainnya — persempit pencarian
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
