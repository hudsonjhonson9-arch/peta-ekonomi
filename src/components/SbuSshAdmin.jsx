import { useState, useContext, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Icon } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";
import { api, useStandarHarga, usePksTahun } from "../hooks.js";
import { btn } from "./PksAdmin.jsx";
import { parseRows } from "../uploadStandarHarga.js";

// Format rupiah lokal — sama dengan pola ScreeningRKA.jsx.
const rupiah = n => (n == null ? "—" : "Rp " + Math.round(n).toLocaleString("id-ID"));

const inputStyle = T => ({
  padding: "7px 10px", border: `1px solid ${T.inputBorder}`, borderRadius: 8,
  fontSize: 12.5, outline: "none", background: T.inputBg, color: T.text,
  fontFamily: "inherit", width: "100%", boxSizing: "border-box",
});

// ── Halaman administrasi SBU / SSH ────────────────────────────────────────
// Satu komponen untuk dua menu (mode "sbu" | "ssh"). Data = tabel
// standar_harga (sumber yang sama dengan pencocokan draft rincian di
// Screening RKA), jadi tidak ada tabel harga ganda.
//
// Lazy load: tahun default null → useStandarHarga disabled, nol request
// sampai user memilih tahun. Upload Excel memakai alur yang sama dengan
// TabelStandarHarga di ScreeningRKA (baca client-side, preview, replace-all).
export default function SbuSshAdmin({ showToast, mode = "sbu" }) {
  const { T } = useContext(ThemeContext);
  const qc = useQueryClient();
  const jenis = mode === "ssh" ? "SSH" : "SBU";

  const [tahun, setTahun] = useState(null);   // null = belum load (lazy)
  const [q, setQ] = useState("");
  const [qD, setQD] = useState("");           // debounce 300ms
  const [preview, setPreview] = useState(null); // {nama, tahun, jenis, items}
  const [sibuk, setSibuk] = useState(false);

  const { data: tahunList = [] } = usePksTahun();

  useEffect(() => {
    const t = setTimeout(() => setQD(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: daftar = [], isLoading } = useStandarHarga({
    tahun, jenis, q: qD.trim() || undefined,
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
      // tahun/jenis ditangkap SEKARANG: ganti file ≠ pindah select tahun.
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

  const th = {
    padding: "7px 9px", fontSize: 11, fontWeight: 700,
    color: T.textSecondary, textAlign: "left", whiteSpace: "nowrap",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="dollar" size={14} style={{ color: T.primary }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                Standar Harga {jenis}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
              Input standar harga {jenis} — upload Excel, data dipakai untuk
              pencocokan rincian belanja di Screening RKA.
            </div>
          </div>
          <select
            value={tahun ?? ""}
            onChange={e => setTahun(e.target.value ? parseInt(e.target.value, 10) : null)}
            aria-label="Pilih tahun"
            style={{
              padding: "6px 9px", border: `1px solid ${T.inputBorder}`, borderRadius: 8,
              fontSize: 12, background: T.inputBg, color: T.text, fontFamily: "inherit",
            }}>
            <option value="">— pilih tahun —</option>
            {tahunList.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Upload Excel (admin) */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, marginBottom: 10 }}>
          Unggah Excel — ganti semua data {jenis} {tahun ?? ""}
        </div>

        {tahun == null ? (
          <div style={{ fontSize: 12.5, color: T.textMuted }}>
            Pilih tahun dulu untuk mulai menginput standar harga.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input type="file" accept=".xlsx,.xls" onChange={bacaFile}
                style={{ fontSize: 12, color: T.textSecondary, fontFamily: "inherit" }} />
              <span style={{ fontSize: 11.5, color: T.textMuted }}>
                Kolom wajib: Uraian Barang, Harga Satuan.
              </span>
            </div>

            {preview && (
              <div style={{ marginTop: 10 }}>
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
                        <tr style={{ background: T.surfaceHover }}>
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
          </>
        )}
      </div>

      {/* Daftar data */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
          marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>
            Data {jenis} {tahun ?? ""}
          </span>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Cari uraian / spesifikasi / kode barang…"
            disabled={tahun == null}
            style={{ ...inputStyle(T), maxWidth: 300,
              opacity: tahun == null ? 0.5 : 1 }} />
          {tahun != null && daftar.length > 0 && (
            <span style={{ fontSize: 11.5, color: T.textMuted }}>
              {daftar.length} baris{daftar.length === 500 ? " (maks. 500 — persempit pencarian)" : ""}
            </span>
          )}
        </div>

        {tahun == null ? (
          <div style={{ fontSize: 12.5, color: T.textMuted, padding: "6px 2px" }}>
            Belum ada tahun dipilih — data dimuat setelah Anda mulai input.
          </div>
        ) : isLoading ? (
          <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 2px" }}>
            Memuat standar harga…
          </div>
        ) : daftar.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textMuted, padding: "6px 2px" }}>
            {qD.trim()
              ? `Tidak ada data ${jenis} untuk pencarian "${qD.trim()}".`
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
                    <td style={{ padding: "6px 9px", color: T.text, minWidth: 220 }}>{it.uraian_barang}</td>
                    <td style={{ padding: "6px 9px", color: T.textSecondary, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.spesifikasi || "—"}</td>
                    <td style={{ padding: "6px 9px", color: T.textSecondary, whiteSpace: "nowrap" }}>{it.satuan || "—"}</td>
                    <td style={{ padding: "6px 9px", textAlign: "right", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", color: T.text }}>{rupiah(it.harga_satuan)}</td>
                    <td style={{ padding: "6px 9px", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace", color: T.textMuted }}>{it.kode_rekening || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
