import { useState, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemeContext } from "../App.jsx";
import useResponsive from "../useResponsive.js";
import { Icon, Select, DatePicker, Button, Badge } from "./ui.jsx";

export default function KelolaKonten({ showToast }) {
  const { T } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();

  const [tab, setTabState] = useState(() => {
    try {
      return localStorage.getItem("konten_tab") || "berita";
    } catch {
      return "berita";
    }
  });
  const setTab = (t) => {
    setTabState(t);
    try {
      localStorage.setItem("konten_tab", t);
    } catch (_) {}
  };
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', type, item }
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["satudata-konten"],
    queryFn: () => fetch("/api/konten", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : {})),
  });

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["satudata-konten"] });
    queryClient.invalidateQueries({ queryKey: ["publik-konten"] });
  };

  const beritas = data?.berita || [];
  const publikasis = data?.publikasi || [];
  const tautans = data?.tautan || [];
  const changelogs = data?.changelog || [];

  const bukaTambah = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (tab === "berita") {
      setForm({ judul: "", kategori: "Satu Data", ringkasan: "", isi: "", gambar_url: "", status: "terbit", tanggal_terbit: today });
    } else if (tab === "publikasi") {
      setForm({ judul: "", jenis: "Publikasi Kajian", tahun: 2025, nomor: "", instansi: "BAPPERIDA Kab. Sumba Barat", file_url: "", deskripsi: "", tampil_publik: true });
    } else if (tab === "tautan") {
      setForm({ judul: "", tipe: "portal_eksternal", url: "", instansi: "", deskripsi: "", urutan: tautans.length + 1, is_active: true });
    } else if (tab === "changelog") {
      setForm({ versi: "v2.6.0", judul: "", tipe_rilis: "minor", ringkasan: "", perubahan_teks: "", status: "released", tanggal_rilis: today });
    }
    setModal({ mode: "add", type: tab });
  };

  const bukaEdit = (type, item) => {
    setForm({
      ...item,
      tanggal_terbit: item.tanggal_terbit ? String(item.tanggal_terbit).slice(0, 10) : "",
      tanggal_rilis: item.tanggal_rilis ? String(item.tanggal_rilis).slice(0, 10) : "",
      perubahan_teks: Array.isArray(item.perubahan) ? item.perubahan.join("\n") : "",
    });
    setModal({ mode: "edit", type, item });
  };

  const simpanModal = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      const { mode, type, item } = modal;
      const base = `/api/konten/${type}`;
      const url = mode === "edit" ? `${base}/${item.id}` : base;
      const method = mode === "edit" ? "PUT" : "POST";
      const payload = { ...form };
      if (type === "changelog") {
        payload.perubahan = String(form.perubahan_teks || "")
          .split("\n")
          .map(s => s.trim())
          .filter(Boolean);
      }
      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menyimpan konten");
      showToast?.(out.message || "Konten berhasil disimpan");
      setModal(null);
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const hapusItem = async (type, id, label) => {
    if (!window.confirm(`Hapus "${label}"?`)) return;
    try {
      const res = await fetch(`/api/konten/${type}/${id}`, { method: "DELETE", credentials: "same-origin" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menghapus");
      showToast?.(out.message || "Berhasil dihapus");
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    }
  };

  const inpStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.inputBg,
    color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  };
  const lblStyle = {
    display: "block", fontSize: 11, fontWeight: 700, color: T.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5,
  };
  const thStyle = {
    padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5,
    borderBottom: `1px solid ${T.border}`, background: T.bgAlt, whiteSpace: "nowrap",
  };
  const tdStyle = {
    padding: "10px 12px", fontSize: 13, color: T.text,
    borderBottom: `1px solid ${T.border}`, verticalAlign: "middle",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 800, color: T.text }}>
            Kelola Konten Portal Satu Data
          </h2>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>
            Manajemen Berita, Publikasi Kajian, Produk Hukum, SK Tim Satu Data, Video/Portal Eksternal & Changelog
          </div>
        </div>
        <Button variant="primary" icon="plus" onClick={bukaTambah}>
          Tambah {tab === "berita" ? "Berita" : tab === "publikasi" ? "Katalog Publikasi / SK" : tab === "tautan" ? "Video / Portal" : "Catatan Rilis"}
        </Button>
      </div>

      {/* Tabs */}
      <style>{`
        .sd-tabs-no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>
      <div
        className="sd-tabs-no-scrollbar"
        onWheel={e => { if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY; }}
        style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", marginBottom: 16 }}
      >
        {[
          { key: "berita",    label: `Berita & Artikel (${beritas.length})`,                 icon: "file" },
          { key: "publikasi", label: `Publikasi, Produk Hukum & SK (${publikasis.length})`, icon: "archive" },
          { key: "tautan",    label: `Video & Portal Lain (${tautans.length})`,             icon: "world" },
          { key: "changelog", label: `Changelog Aplikasi (${changelogs.length})`,           icon: "history" },
        ].map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 7, flexShrink: 0, whiteSpace: "nowrap",
                padding: "8px 14px", borderRadius: 9,
                border: active ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                background: active ? `${T.primary}15` : T.card,
                color: active ? T.primary : T.textSecondary,
                fontSize: 13, fontWeight: active ? 700 : 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Memuat data konten...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            {tab === "berita" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>Kategori</th>
                    <th style={thStyle}>Judul Berita</th>
                    <th style={thStyle}>Ringkasan</th>
                    <th style={thStyle}>Penulis</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {beritas.map(b => (
                    <tr key={b.id}>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: 12 }}>{String(b.tanggal_terbit || "").slice(0, 10)}</td>
                      <td style={tdStyle}><Badge label={b.kategori} colors={{ bg: "#EFF6FF", text: "#2563EB" }} /></td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{b.judul}</td>
                      <td style={{ ...tdStyle, color: T.textSecondary, maxWidth: 320 }}>{b.ringkasan || b.isi?.slice(0, 90)}</td>
                      <td style={tdStyle}>{b.penulis || "—"}</td>
                      <td style={tdStyle}>
                        <Badge
                          label={b.status === "terbit" ? "Terbit" : "Draft"}
                          colors={b.status === "terbit" ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#FEF3C7", text: "#D97706" }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                        <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("berita", b)}>Edit</Button>{" "}
                        <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("berita", b.id, b.judul)} style={{ color: T.danger }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "publikasi" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Jenis Katalog</th>
                    <th style={thStyle}>Tahun</th>
                    <th style={thStyle}>Judul Dokumen / Publikasi</th>
                    <th style={thStyle}>Nomor</th>
                    <th style={thStyle}>Instansi</th>
                    <th style={thStyle}>Publik</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {publikasis.map(p => (
                    <tr key={p.id}>
                      <td style={tdStyle}>
                        <Badge
                          label={p.jenis}
                          colors={
                            p.jenis === "Produk Hukum"
                              ? { bg: "#EDE9FE", text: "#7C3AED" }
                              : p.jenis === "SK Tim Satu Data"
                              ? { bg: "#FEF3C7", text: "#D97706" }
                              : { bg: "#EFF6FF", text: "#2563EB" }
                          }
                        />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{p.tahun}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{p.judul}</td>
                      <td style={tdStyle}>{p.nomor || "—"}</td>
                      <td style={tdStyle}>{p.instansi || "—"}</td>
                      <td style={tdStyle}>
                        <Badge label={p.tampil_publik ? "Tampil Publik" : "Internal"} colors={p.tampil_publik ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#F1F5F9", text: "#64748B" }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                        <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("publikasi", p)}>Edit</Button>{" "}
                        <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("publikasi", p.id, p.judul)} style={{ color: T.danger }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "tautan" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Urutan</th>
                    <th style={thStyle}>Tipe</th>
                    <th style={thStyle}>Judul</th>
                    <th style={thStyle}>URL / Tautan</th>
                    <th style={thStyle}>Instansi</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tautans.map(t => (
                    <tr key={t.id}>
                      <td style={tdStyle}>{t.urutan}</td>
                      <td style={tdStyle}>
                        <Badge label={t.tipe === "video" ? "Video" : t.tipe === "banner" ? "Banner" : "Portal Data Lain"} colors={{ bg: "#EFF6FF", text: "#2563EB" }} />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{t.judul}</td>
                      <td style={tdStyle}>
                        <a href={t.url} target="_blank" rel="noreferrer" style={{ color: T.primary, fontSize: 12 }}>
                          {t.url}
                        </a>
                      </td>
                      <td style={tdStyle}>{t.instansi || "—"}</td>
                      <td style={tdStyle}>
                        <Badge label={t.is_active ? "Aktif" : "Nonaktif"} colors={t.is_active ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#F1F5F9", text: "#64748B" }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                        <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("tautan", t)}>Edit</Button>{" "}
                        <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("tautan", t.id, t.judul)} style={{ color: T.danger }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "changelog" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Versi</th>
                    <th style={thStyle}>Tipe</th>
                    <th style={thStyle}>Judul Rilis</th>
                    <th style={thStyle}>Tanggal Rilis</th>
                    <th style={thStyle}>Poin Perubahan</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {changelogs.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 800, color: T.primary }}>{c.versi}</td>
                      <td style={tdStyle}><Badge label={c.tipe_rilis.toUpperCase()} colors={{ bg: "#EDE9FE", text: "#7C3AED" }} /></td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{c.judul}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: 12 }}>{String(c.tanggal_rilis || "").slice(0, 10)}</td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>
                        {(c.perubahan || []).length} item pembaruan
                      </td>
                      <td style={tdStyle}>
                        <Badge label={c.status === "released" ? "Released" : "Draft"} colors={c.status === "released" ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#FEF3C7", text: "#D97706" }} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                        <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("changelog", c)}>Edit</Button>{" "}
                        <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("changelog", c.id, c.versi)} style={{ color: T.danger }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal Add / Edit */}
      {modal && (
        <div
          onClick={() => !busy && setModal(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
            zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card, color: T.text, borderRadius: 14,
              border: `1px solid ${T.border}`, boxShadow: T.shadowLg,
              width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {modal.mode === "edit" ? "Edit" : "Tambah"} Konten ({modal.type.toUpperCase()})
              </h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {modal.type === "berita" && (
                <>
                  <div>
                    <label style={lblStyle}>Judul Berita / Artikel *</label>
                    <input value={form.judul || ""} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} style={inpStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Kategori</label>
                      <Select
                        fullWidth
                        value={form.kategori || "Satu Data"}
                        onChange={v => setForm(f => ({ ...f, kategori: v }))}
                        options={[
                          { value: "Satu Data", label: "Satu Data" },
                          { value: "Perencanaan", label: "Perencanaan" },
                          { value: "SPM", label: "SPM" },
                          { value: "Pengumuman", label: "Pengumuman" },
                        ]}
                      />
                    </div>
                    <div>
                      <label style={lblStyle}>Status</label>
                      <Select
                        fullWidth
                        value={form.status || "terbit"}
                        onChange={v => setForm(f => ({ ...f, status: v }))}
                        options={[
                          { value: "terbit", label: "Terbit" },
                          { value: "draft", label: "Draft" },
                        ]}
                      />
                    </div>
                    <div>
                      <label style={lblStyle}>Tanggal Terbit</label>
                      <DatePicker
                        fullWidth
                        value={form.tanggal_terbit || ""}
                        onChange={v => setForm(f => ({ ...f, tanggal_terbit: v }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Ringkasan Singkat</label>
                    <input value={form.ringkasan || ""} onChange={e => setForm(f => ({ ...f, ringkasan: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Isi Berita Lengkap *</label>
                    <textarea rows={4} value={form.isi || ""} onChange={e => setForm(f => ({ ...f, isi: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "publikasi" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Jenis Katalog *</label>
                      <Select
                        fullWidth
                        value={form.jenis || "Publikasi Kajian"}
                        onChange={v => setForm(f => ({ ...f, jenis: v }))}
                        options={[
                          { value: "Publikasi Kajian", label: "Publikasi Kajian" },
                          { value: "Produk Hukum", label: "Produk Hukum" },
                          { value: "SK Tim Satu Data", label: "SK Tim Satu Data" },
                          { value: "Infografis", label: "Infografis" },
                        ]}
                      />
                    </div>
                    <div>
                      <label style={lblStyle}>Tahun *</label>
                      <input type="number" value={form.tahun || 2025} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} style={inpStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Judul Dokumen / Publikasi *</label>
                    <input value={form.judul || ""} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} style={inpStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Nomor Peraturan / SK</label>
                      <input value={form.nomor || ""} onChange={e => setForm(f => ({ ...f, nomor: e.target.value }))} style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Instansi Penerbit</label>
                      <input value={form.instansi || ""} onChange={e => setForm(f => ({ ...f, instansi: e.target.value }))} style={inpStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>URL Berkas (Opsional)</label>
                    <input value={form.file_url || ""} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Deskripsi</label>
                    <textarea rows={2} value={form.deskripsi || ""} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "tautan" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Tipe Tautan</label>
                      <Select
                        fullWidth
                        value={form.tipe || "portal_eksternal"}
                        onChange={v => setForm(f => ({ ...f, tipe: v }))}
                        options={[
                          { value: "portal_eksternal", label: "Portal Data Lain" },
                          { value: "video", label: "Video Sosialisasi / YouTube" },
                          { value: "banner", label: "Banner Portal" },
                        ]}
                      />
                    </div>
                    <div>
                      <label style={lblStyle}>Urutan Tampil</label>
                      <input type="number" value={form.urutan || 1} onChange={e => setForm(f => ({ ...f, urutan: Number(e.target.value) }))} style={inpStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Judul *</label>
                    <input value={form.judul || ""} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>URL / Link *</label>
                    <input value={form.url || ""} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Instansi / Sumber</label>
                    <input value={form.instansi || ""} onChange={e => setForm(f => ({ ...f, instansi: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "changelog" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Versi Semver *</label>
                      <input value={form.versi || ""} onChange={e => setForm(f => ({ ...f, versi: e.target.value }))} placeholder="v2.6.0" style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Tipe Rilis</label>
                      <Select
                        fullWidth
                        value={form.tipe_rilis || "minor"}
                        onChange={v => setForm(f => ({ ...f, tipe_rilis: v }))}
                        options={[
                          { value: "major", label: "Major" },
                          { value: "minor", label: "Minor" },
                          { value: "patch", label: "Patch" },
                        ]}
                      />
                    </div>
                    <div>
                      <label style={lblStyle}>Tanggal Rilis</label>
                      <DatePicker
                        fullWidth
                        value={form.tanggal_rilis || ""}
                        onChange={v => setForm(f => ({ ...f, tanggal_rilis: v }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Judul Rilis *</label>
                    <input value={form.judul || ""} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Ringkasan</label>
                    <input value={form.ringkasan || ""} onChange={e => setForm(f => ({ ...f, ringkasan: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Daftar Perubahan (Satu per baris)</label>
                    <textarea rows={4} value={form.perubahan_teks || ""} onChange={e => setForm(f => ({ ...f, perubahan_teks: e.target.value }))} placeholder={"Penambahan modul SPM\nPerbaikan ekspor Excel"} style={inpStyle} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <Button variant="ghost" onClick={() => setModal(null)}>Batal</Button>
              <Button variant="primary" loading={busy} onClick={simpanModal}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
