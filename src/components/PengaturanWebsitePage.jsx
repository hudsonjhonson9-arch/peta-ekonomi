import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon } from "./ui.jsx";
import { Select } from "./customControls.jsx";
import { kitVars, PageKitStyle } from "./pageKit.jsx";

const PRESET_TEMA = [
  { key: "emerald", label: "Emerald BAPPERIDA", primer: "#059669", aksen: "#0284C7", desc: "Warna resmi khas perencanaan dan kelestarian daerah" },
  { key: "blue", label: "Biru Bahari Sumba", primer: "#2563EB", aksen: "#0D9488", desc: "Profesional, mencerminkan pelayanan publik modern" },
  { key: "indigo", label: "Indigo Transformatif", primer: "#4F46E5", aksen: "#EA580C", desc: "Modern, berbasis inovasi teknologi digital" },
  { key: "slate", label: "Slate Netral", primer: "#334155", aksen: "#2563EB", desc: "Minimalis dan kontras tinggi, cocok untuk data teknis" },
];

const TAB_KEYS = ["identitas", "tema", "beranda", "aset", "riwayat"];

const MODUL = [
  { key: "tampilkan_statistik", title: "Kartu statistik utama", desc: "Jumlah dataset, produsen data, bidang urusan, dan topik." },
  { key: "tampilkan_spm", title: "Capaian SPM", desc: "Progres 6 urusan wajib Standar Pelayanan Minimal." },
  { key: "tampilkan_peta", title: "Peta wilayah kabupaten", desc: "Batas kecamatan dengan indikator spasial." },
  { key: "tampilkan_visualisasi", title: "Grafik dan tren makro", desc: "Grafik batang dan garis indikator daerah." },
  { key: "tampilkan_berita", title: "Berita dan publikasi", desc: "Rilis pers, berita pembangunan, dan pengumuman." },
];

function Field({ label, hint, aside, children, wide }) {
  return (
    <div className={wide ? "pk-span2" : undefined}>
      <label className="pk-label">
        <span>{label}</span>
        {aside && <small>{aside}</small>}
      </label>
      {children}
      {hint && <p className="pk-hint">{hint}</p>}
    </div>
  );
}

function Row({ title, desc, children }) {
  return (
    <section className="pk-row stack">
      <div>
        <h2 className="pk-row-t">{title}</h2>
        {desc && <p className="pk-row-d">{desc}</p>}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </section>
  );
}

// Pratinjau mengikuti pengaturan: warna, font, dan komponen yang aktif tampil sebagai blok.
function PortalPreview({ s, kelengkapan }) {
  const warna = s.tema.warna_primer;
  const blok = [
    s.beranda.tampilkan_statistik && { k: "stat", label: "Statistik", h: 26 },
    s.beranda.tampilkan_spm && { k: "spm", label: "Capaian SPM", h: 30 },
    s.beranda.tampilkan_peta && { k: "peta", label: "Peta wilayah", h: 38 },
    s.beranda.tampilkan_visualisasi && { k: "viz", label: "Grafik tren", h: 30 },
    s.beranda.tampilkan_berita && { k: "ber", label: "Berita", h: 26 },
  ].filter(Boolean);

  return (
    <aside style={{ position: "sticky", top: 16, background: "var(--pk-card)", border: "1px solid var(--pk-border)", borderRadius: 14, padding: 16 }}>
      <div className="pk-h2" style={{ marginBottom: 10 }}>Pratinjau</div>
      <div style={{ border: "1px solid var(--pk-border-strong)", borderRadius: 8, overflow: "hidden", fontFamily: `'${s.tema.font}', system-ui, sans-serif`, background: "var(--pk-card)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 11px", borderBottom: "1px solid var(--pk-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <img
              src={s.identitas.logo_url || `${import.meta.env.BASE_URL}Lambang_Kabupaten_Sumba_Barat.png`}
              alt=""
              width={18}
              height={22}
              style={{ objectFit: "contain" }}
              onError={(e) => {
                if (!e.target.dataset.fallback) {
                  e.target.dataset.fallback = '1';
                  e.target.src = '/Lambang_Kabupaten_Sumba_Barat.png';
                }
              }}
            />
            <div style={{ minWidth: 0, lineHeight: 1.15 }}>
              <div style={{ fontSize: 10, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.identitas.nama_portal}</div>
              <div style={{ fontSize: 8, color: "var(--pk-muted)" }}>{s.identitas.nama_daerah}</div>
            </div>
          </div>
          <span style={{ fontSize: 8.5, fontWeight: 700, padding: "3px 7px", borderRadius: 4, background: warna, color: "#fff" }}>Login</span>
        </div>

        <div style={{ padding: "16px 12px 14px", textAlign: "center", borderBottom: "1px solid var(--pk-border)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {s.beranda.hero_title || "Judul beranda"}
          </div>
          <div style={{ fontSize: 8.5, color: "var(--pk-text2)", lineHeight: 1.4, margin: "5px 0 9px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {s.beranda.hero_subtitle}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 3px 3px 8px", borderRadius: 5, border: "1px solid var(--pk-border-strong)", fontSize: 8.5, color: "var(--pk-muted)" }}>
            Cari dataset statistik
            <span style={{ padding: "3px 8px", borderRadius: 4, background: warna, color: "#fff", fontWeight: 700 }}>Cari</span>
          </div>
        </div>

        <div style={{ padding: 10, display: "grid", gap: 6 }}>
          {blok.length === 0 && <div style={{ fontSize: 9, color: "var(--pk-muted)", textAlign: "center", padding: 8 }}>Semua komponen dinonaktifkan</div>}
          {blok.map((b) => (
            <div key={b.k} style={{ height: b.h, borderRadius: 5, background: b.k === "peta" ? `${s.tema.warna_aksen}22` : "var(--pk-sunken)", border: "1px dashed var(--pk-border-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, fontWeight: 600, color: "var(--pk-muted)" }}>
              {b.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
          <span style={{ color: "var(--pk-text2)" }}>Kelengkapan identitas</span>
          <b>{kelengkapan}%</b>
        </div>
        <div className="pk-bar"><i style={{ width: `${kelengkapan}%`, background: kelengkapan === 100 ? "var(--pk-ok-solid)" : "var(--pk-primary)" }} /></div>
      </div>
    </aside>
  );
}

export default function PengaturanWebsitePage() {
  const { T, isDark } = useContext(ThemeContext);

  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const hp = new URLSearchParams((window.location.hash || "").split("?")[1] || "");
      const urlTab = hp.get("tab");
      if (urlTab && TAB_KEYS.includes(urlTab)) return urlTab;
      return localStorage.getItem("pengaturan_tab") || "identitas";
    } catch {
      return "identitas";
    }
  });

  const setActiveTab = (t) => {
    setActiveTabState(t);
    try {
      localStorage.setItem("pengaturan_tab", t);
      const base = (window.location.hash || "#pengaturan-website").split("?")[0] || "#pengaturan-website";
      history.replaceState(null, "", `${base}?tab=${t}`);
    } catch (_) {}
  };

  useEffect(() => {
    const onHash = () => {
      try {
        const hp = new URLSearchParams((window.location.hash || "").split("?")[1] || "");
        const urlTab = hp.get("tab");
        if (urlTab && TAB_KEYS.includes(urlTab)) setActiveTabState(urlTab);
      } catch (_) {}
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const [saving, setSaving] = useState(false);
  const [pesan, setPesan] = useState({ jenis: "", teks: "" });

  const [settings, setSettings] = useState({
    identitas: {
      nama_portal: "Portal Satu Data BAPPERIDA Sumba Barat",
      nama_daerah: "Kabupaten Sumba Barat",
      instansi: "Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah",
      deskripsi: "Portal resmi Satu Data Kabupaten Sumba Barat menyajikan data statistik sektoral, indikator kinerja, capaian SPM, dan informasi perencanaan pembangunan daerah yang akurat, mutakhir, terpadu, dan dapat dipertanggungjawabkan.",
      email: "bapperida@sumbabaratkab.go.id",
      telepon: "(0387) 21123",
      alamat: "Jl. Veteran No. 1, Waikabubak, Sumba Barat, Nusa Tenggara Timur",
      lat: -9.6253,
      lng: 119.3496,
      logo_url: "/Lambang_Kabupaten_Sumba_Barat.png",
      facebook: "https://facebook.com/bapperidasumbabarat",
      instagram: "https://instagram.com/bapperidasumbabarat",
      twitter: "",
      youtube: "https://youtube.com/@bapperidasumbabarat",
    },
    tema: { preset: "emerald", warna_primer: "#059669", warna_aksen: "#0284C7", font: "Plus Jakarta Sans", mode_gelap: false },
    beranda: {
      hero_title: "Data Terpadu untuk Perencanaan Pembangunan yang Lebih Baik",
      hero_subtitle: "Akses terbuka terhadap kumpulan data statistik sektoral, indikator kinerja daerah, capaian Standar Pelayanan Minimal (SPM), dan kajian perencanaan pembangunan daerah.",
      tampilkan_spm: true,
      tampilkan_peta: true,
      tampilkan_berita: true,
      tampilkan_statistik: true,
      tampilkan_visualisasi: true,
    },
  });

  const [draftInfo, setDraftInfo] = useState(null);
  const [publishedInfo, setPublishedInfo] = useState(null);
  const [riwayat, setRiwayat] = useState([]);

  const muatData = async () => {
    try {
      const res = await fetch("/api/admin/pengaturan", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const aktif = data.draft || data.published;
        if (aktif && aktif.payload) {
          setSettings((prev) => ({
            identitas: { ...prev.identitas, ...(aktif.payload.identitas || {}) },
            tema: { ...prev.tema, ...(aktif.payload.tema || {}) },
            beranda: { ...prev.beranda, ...(aktif.payload.beranda || {}) },
          }));
        }
        setDraftInfo(data.draft ? { id: data.draft.id, updated_at: data.draft.updated_at } : null);
        setPublishedInfo(data.published ? { id: data.published.id, published_at: data.published.published_at, published_by: data.published.published_by } : null);
      }
      const resRiwayat = await fetch("/api/admin/pengaturan/riwayat", { cache: "no-store" });
      if (resRiwayat.ok) setRiwayat(await resRiwayat.json());
      // Endpoint /aset tetap dipanggil agar perilaku lama tidak berubah, hasilnya belum dipakai di UI.
      await fetch("/api/admin/pengaturan/aset", { cache: "no-store" }).catch(() => {});
    } catch {
      // jaringan offline: abaikan
    }
  };

  useEffect(() => { muatData(); }, []);

  const ubah = (grup, kunci) => (e) => {
    const v = e.target.value;
    setSettings((s) => ({ ...s, [grup]: { ...s[grup], [kunci]: v } }));
  };
  const setNilai = (grup, kunci, v) => setSettings((s) => ({ ...s, [grup]: { ...s[grup], [kunci]: v } }));

  const handleSimpanDraft = async () => {
    setSaving(true);
    setPesan({ jenis: "", teks: "" });
    try {
      const res = await fetch("/api/admin/pengaturan/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: settings, note: "Draft konfigurasi diperbarui via admin portal" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan draf");
      setPesan({ jenis: "ok", teks: "Draf disimpan. Pengunjung belum melihat perubahan sampai Anda menerbitkannya." });
      muatData();
    } catch (err) {
      setPesan({ jenis: "err", teks: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTerbitkan = async () => {
    if (!window.confirm("Terbitkan pengaturan ini ke portal publik sekarang? Seluruh pengunjung akan langsung melihat perubahan ini.")) return;
    setSaving(true);
    setPesan({ jenis: "", teks: "" });
    try {
      await fetch("/api/admin/pengaturan/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: settings, note: "Penerbitan pengaturan website" }),
      });
      const res = await fetch("/api/admin/pengaturan/terbitkan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Diterbitkan ke portal publik Satu Data" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menerbitkan pengaturan");
      setPesan({ jenis: "ok", teks: "Pengaturan diterbitkan. Portal publik sudah memakai konfigurasi ini." });
      muatData();
    } catch (err) {
      setPesan({ jenis: "err", teks: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (revisionId) => {
    if (!window.confirm(`Pulihkan pengaturan dari Revisi #${revisionId} ke dalam draf?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pengaturan/riwayat/${revisionId}/rollback`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memulihkan revisi");
      setPesan({ jenis: "ok", teks: data.message });
      muatData();
    } catch (err) {
      setPesan({ jenis: "err", teks: err.message });
    } finally {
      setSaving(false);
    }
  };

  const kelengkapan = useMemo(() => {
    const i = settings.identitas;
    const f = [i.nama_portal, i.nama_daerah, i.instansi, i.deskripsi, i.email, i.telepon, i.alamat];
    return Math.round((f.filter((x) => x && String(x).trim().length > 0).length / f.length) * 100);
  }, [settings.identitas]);

  const tabs = [
    { key: "identitas", label: "Identitas dan kontak" },
    { key: "tema", label: "Tema" },
    { key: "beranda", label: "Beranda" },
    { key: "aset", label: "Logo dan aset" },
    { key: "riwayat", label: "Riwayat", hint: riwayat.length ? String(riwayat.length) : "" },
  ];

  const denganPratinjau = ["identitas", "tema", "beranda"].includes(activeTab);
  const id = settings.identitas;
  const metaPanjang = id.deskripsi.length;

  const tabIcon = { identitas: "building", tema: "settings", beranda: "home", aset: "upload", riwayat: "history" };
  const kartu = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "4px 24px 20px" };
  const btnBase = {
    display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 10,
    fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
  };

  return (
    <div className="pk pk-settings" style={{ ...kitVars(T, isDark) }}>
      <PageKitStyle />
      <style>{`
        .pk-settings .pk-shell{grid-template-columns:minmax(0,1fr) 300px;gap:20px;margin-top:0}
        .pk-settings .pk-shell.no-aside{grid-template-columns:minmax(0,1fr)}
        .pk-settings .pk-row{grid-template-columns:220px minmax(0,1fr);gap:32px}
        @media (max-width:1100px){.pk-settings .pk-shell{grid-template-columns:minmax(0,1fr)}}
        @media (max-width:760px){.pk-settings .pk-row{grid-template-columns:minmax(0,1fr);gap:12px}}
      `}</style>

      {/* Bar status & aksi */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 16px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: T.primaryLight, color: T.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="world" size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Konfigurasi Portal Publik</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: draftInfo ? "#D97706" : "#16A34A" }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: draftInfo ? "#D97706" : "#16A34A" }} />
                {draftInfo ? "Ada draf belum terbit" : "Sinkron dengan publik"}
              </span>
              {publishedInfo?.published_at && <span>· Terbit terakhir {new Date(publishedInfo.published_at).toLocaleString("id-ID")}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => window.open("/#publik", "_blank")} style={{ ...btnBase, cursor: "pointer", border: `1px solid ${T.border}`, background: T.card, color: T.textSecondary }}>
            <Icon name="world" size={14} /> Buka Portal
          </button>
          <button type="button" onClick={handleSimpanDraft} disabled={saving} style={{ ...btnBase, border: `1px solid ${T.border}`, background: T.card, color: T.textSecondary, opacity: saving ? 0.6 : 1 }}>
            <Icon name="file" size={14} /> Simpan Draf
          </button>
          <button type="button" onClick={handleTerbitkan} disabled={saving} style={{ ...btnBase, border: "none", background: T.primary, color: "#fff", opacity: saving ? 0.7 : 1 }}>
            <Icon name={saving ? "loader" : "checkCircle"} size={14} /> {saving ? "Memproses..." : "Terbitkan"}
          </button>
        </div>
      </div>

      {/* Navigasi tab, gaya sama dengan halaman Bank Data */}
      <div role="tablist" aria-label="Bagian pengaturan" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <button key={t.key} role="tab" type="button" aria-selected={active} onClick={() => setActiveTab(t.key)} style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10,
              border: active ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
              background: active ? T.primaryLight : T.card, color: active ? T.primary : T.textSecondary,
              fontWeight: active ? 700 : 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>
              <Icon name={tabIcon[t.key] || "file"} size={15} />
              <span>{t.label}</span>
              {t.hint && (
                <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 99, background: active ? T.primary : T.surfaceHover, color: active ? "#fff" : T.textMuted, fontWeight: 700 }}>{t.hint}</span>
              )}
            </button>
          );
        })}
      </div>

      {pesan.teks && (
        <div className={`pk-note ${pesan.jenis}`} role={pesan.jenis === "err" ? "alert" : "status"} style={{ marginTop: 20 }}>
          <span>{pesan.teks}</span>
          <button type="button" className="pk-icon-btn" style={{ width: 22, height: 22 }} onClick={() => setPesan({ jenis: "", teks: "" })} aria-label="Tutup pesan"><Icon name="x" size={13} /></button>
        </div>
      )}

      <div className={`pk-shell${denganPratinjau ? "" : " no-aside"}`}>
        <div className="pk-rows" role="tabpanel" style={{ minWidth: 0, ...kartu }}>
          {activeTab === "identitas" && (
            <>
              <Row title="Identitas portal" desc="Nama resmi sistem dan instansi penyelenggara.">
                <div className="pk-grid2">
                  <Field label="Nama portal" aside="Wajib"><input className="pk-input" value={id.nama_portal} onChange={ubah("identitas", "nama_portal")} /></Field>
                  <Field label="Nama daerah" aside="Wajib"><input className="pk-input" value={id.nama_daerah} onChange={ubah("identitas", "nama_daerah")} /></Field>
                  <Field wide label="Instansi pengelola (Walidata)"><input className="pk-input" value={id.instansi} onChange={ubah("identitas", "instansi")} /></Field>
                </div>
              </Row>

              <Row title="Tampilan di mesin pencari" desc="Teks yang muncul di hasil Google dan saat tautan dibagikan.">
                <Field label="Deskripsi meta" aside={<span style={{ color: metaPanjang > 160 ? "var(--pk-danger)" : undefined }}>{metaPanjang} / 160 karakter disarankan</span>}>
                  <textarea className="pk-input" rows={3} value={id.deskripsi} onChange={ubah("identitas", "deskripsi")} />
                </Field>
                <div style={{ marginTop: 14, paddingLeft: 14, borderLeft: "3px solid var(--pk-border-strong)" }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: isDark ? "#8AB4F8" : "#1A0DAB" }}>{id.nama_portal} — {id.nama_daerah}</div>
                  <div style={{ fontSize: 12.5, color: "var(--pk-ok)", margin: "1px 0" }}>https://arsipdigital.mindcloud.my.id/portal</div>
                  <div style={{ fontSize: 13, color: "var(--pk-text2)", lineHeight: 1.5 }}>{(id.deskripsi || "Deskripsi belum diisi.").slice(0, 160)}{id.deskripsi.length > 160 ? "…" : ""}</div>
                </div>
              </Row>

              <Row title="Kontak dan alamat" desc="Dapat dihubungi masyarakat, akademisi, dan media.">
                <div className="pk-grid2">
                  <Field label="Email dinas"><input className="pk-input" type="email" value={id.email} onChange={ubah("identitas", "email")} /></Field>
                  <Field label="Telepon kantor"><input className="pk-input" value={id.telepon} onChange={ubah("identitas", "telepon")} /></Field>
                  <Field wide label="Alamat kantor"><input className="pk-input" value={id.alamat} onChange={ubah("identitas", "alamat")} /></Field>
                </div>
              </Row>

              <Row title="Media sosial" desc="Tampil di footer portal. Kosongkan yang tidak dipakai.">
                <div className="pk-grid2">
                  <Field label="Instagram"><input className="pk-input" value={id.instagram || ""} onChange={ubah("identitas", "instagram")} placeholder="https://instagram.com/…" /></Field>
                  <Field label="Facebook"><input className="pk-input" value={id.facebook || ""} onChange={ubah("identitas", "facebook")} placeholder="https://facebook.com/…" /></Field>
                  <Field label="YouTube"><input className="pk-input" value={id.youtube || ""} onChange={ubah("identitas", "youtube")} placeholder="https://youtube.com/@…" /></Field>
                  <Field label="X / Twitter"><input className="pk-input" value={id.twitter || ""} onChange={ubah("identitas", "twitter")} placeholder="https://x.com/…" /></Field>
                </div>
              </Row>
            </>
          )}

          {activeTab === "tema" && (
            <>
              <Row title="Preset warna" desc="Pilih satu preset, lalu sesuaikan warna bila perlu.">
                <div role="radiogroup" aria-label="Preset tema" style={{ border: "1px solid var(--pk-border)", borderRadius: 8, overflow: "hidden" }}>
                  {PRESET_TEMA.map((p, i) => {
                    const dipilih = settings.tema.preset === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        role="radio"
                        aria-checked={dipilih}
                        onClick={() => setSettings((s) => ({ ...s, tema: { ...s.tema, preset: p.key, warna_primer: p.primer, warna_aksen: p.aksen } }))}
                        style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: "12px 14px", font: "inherit", color: "inherit", cursor: "pointer", border: "none", borderTop: i ? "1px solid var(--pk-border)" : "none", background: dipilih ? "var(--pk-primary-soft)" : "transparent" }}
                      >
                        <span style={{ display: "flex", width: 44, height: 24, borderRadius: 5, overflow: "hidden", flexShrink: 0 }}>
                          <i style={{ flex: 3, background: p.primer }} />
                          <i style={{ flex: 1, background: p.aksen }} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{p.label}</span>
                          <span className="pk-muted" style={{ display: "block", fontSize: 12.5 }}>{p.desc}</span>
                        </span>
                        {dipilih && <Icon name="check" size={16} style={{ color: "var(--pk-primary)" }} />}
                      </button>
                    );
                  })}
                </div>
              </Row>

              <Row title="Warna dan font" desc="Mengubah warna di sini menimpa preset yang dipilih.">
                <div className="pk-grid2">
                  <Field label="Warna primer">
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="color" aria-label="Pilih warna primer" value={settings.tema.warna_primer} onChange={ubah("tema", "warna_primer")} style={{ width: 42, height: 38, padding: 3, border: "1px solid var(--pk-border-strong)", borderRadius: 8, background: "var(--pk-input)", cursor: "pointer" }} />
                      <input className="pk-input pk-mono" value={settings.tema.warna_primer} onChange={ubah("tema", "warna_primer")} />
                    </div>
                  </Field>
                  <Field label="Warna aksen">
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="color" aria-label="Pilih warna aksen" value={settings.tema.warna_aksen} onChange={ubah("tema", "warna_aksen")} style={{ width: 42, height: 38, padding: 3, border: "1px solid var(--pk-border-strong)", borderRadius: 8, background: "var(--pk-input)", cursor: "pointer" }} />
                      <input className="pk-input pk-mono" value={settings.tema.warna_aksen} onChange={ubah("tema", "warna_aksen")} />
                    </div>
                  </Field>
                  <Field wide label="Font utama">
                    <Select
                      fullWidth
                      value={settings.tema.font}
                      onChange={(val) => setNilai("tema", "font", val)}
                      options={[
                        { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans (standar aplikasi)" },
                        { value: "Inter", label: "Inter (padat data)" },
                        { value: "Work Sans", label: "Work Sans (geometris)" },
                        { value: "system-ui", label: "Bawaan sistem" },
                      ]}
                    />
                    <p style={{ margin: "10px 0 0", fontSize: 17, fontWeight: 600, fontFamily: `'${settings.tema.font}', system-ui, sans-serif` }}>Data terpadu untuk Sumba Barat</p>
                  </Field>
                </div>
              </Row>
            </>
          )}

          {activeTab === "beranda" && (
            <>
              <Row title="Pesan utama" desc="Judul dan pengantar yang pertama dibaca pengunjung.">
                <div className="pk-stack">
                  <Field label="Judul utama"><input className="pk-input" value={settings.beranda.hero_title} onChange={ubah("beranda", "hero_title")} /></Field>
                  <Field label="Sub-judul"><textarea className="pk-input" rows={3} value={settings.beranda.hero_subtitle} onChange={ubah("beranda", "hero_subtitle")} /></Field>
                </div>
              </Row>

              <Row title="Komponen beranda" desc="Matikan komponen yang belum siap tampil. Pratinjau ikut berubah.">
                <div style={{ border: "1px solid var(--pk-border)", borderRadius: 8 }}>
                  {MODUL.map((m, i) => {
                    const aktif = Boolean(settings.beranda[m.key]);
                    return (
                      <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderTop: i ? "1px solid var(--pk-border)" : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.title}</div>
                          <div className="pk-muted" style={{ fontSize: 12.5, marginTop: 1 }}>{m.desc}</div>
                        </div>
                        <button type="button" role="switch" aria-checked={aktif} aria-label={m.title} className="pk-switch" onClick={() => setNilai("beranda", m.key, !aktif)} />
                      </div>
                    );
                  })}
                </div>
              </Row>
            </>
          )}

          {activeTab === "aset" && (
            <Row title="Logo" desc="Portal publik memakai lambang resmi Kabupaten Sumba Barat.">
              <div className="pk-grid2">
                {[
                  { path: `${import.meta.env.BASE_URL}Lambang_Kabupaten_Sumba_Barat.png`, name: "Lambang Kabupaten Sumba Barat", role: "Portal publik", aktif: true },
                  { path: `${import.meta.env.BASE_URL}icon.svg`, name: "Logo UMA DATA", role: "Panel admin dan arsip internal", aktif: false },
                ].map((a) => (
                  <figure key={a.path} style={{ margin: 0 }}>
                    <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", border: a.aktif ? "1.5px solid var(--pk-primary)" : "1px solid var(--pk-border)", borderRadius: 8, background: "var(--pk-sunken)" }}>
                      <img src={a.path} alt={a.name} style={{ maxHeight: 84, maxWidth: "80%", objectFit: "contain" }} />
                    </div>
                    <figcaption style={{ marginTop: 8, fontSize: 13 }}>
                      <b style={{ fontWeight: 600 }}>{a.name}</b>
                      <div className="pk-muted" style={{ fontSize: 12.5 }}>{a.role}{a.aktif ? " · dipakai sekarang" : ""}</div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Row>
          )}

          {activeTab === "riwayat" && (
            <Row title="Riwayat revisi" desc="Setiap penerbitan tersimpan sebagai versi yang bisa dipulihkan ke draf.">
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button type="button" className="pk-btn pk-btn-quiet pk-btn-sm" onClick={muatData}>Segarkan</button>
              </div>
              {!riwayat.length ? (
                <div className="pk-empty" style={{ padding: "24px 0" }}><b>Belum ada revisi</b>Revisi pertama tercatat saat Anda menerbitkan pengaturan.</div>
              ) : (
                <table className="pk-table">
                  <thead><tr><th>Revisi</th><th>Catatan</th><th>Waktu</th><th /></tr></thead>
                  <tbody>
                    {riwayat.map((r) => {
                      const aktif = r.status === "published";
                      return (
                        <tr key={r.id}>
                          <td className="pk-mono" style={{ whiteSpace: "nowrap" }}>#{r.id} <span className="pk-status" style={{ marginLeft: 6, color: aktif ? "var(--pk-ok)" : "var(--pk-muted)" }}><span className="pk-dot" />{aktif ? "aktif" : "arsip"}</span></td>
                          <td style={{ fontWeight: 500 }}>{r.note || "Konfigurasi portal"}{r.publisher_nama ? <span className="pk-muted" style={{ fontWeight: 400 }}> · {r.publisher_nama}</span> : null}</td>
                          <td className="pk-muted" style={{ whiteSpace: "nowrap" }}>{r.published_at ? new Date(r.published_at).toLocaleString("id-ID") : "—"}</td>
                          <td style={{ textAlign: "right" }}>{!aktif && <button type="button" className="pk-btn pk-btn-ghost pk-btn-sm" onClick={() => handleRollback(r.id)} disabled={saving}>Pulihkan</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Row>
          )}
        </div>

        {denganPratinjau && <PortalPreview s={settings} kelengkapan={kelengkapan} />}
      </div>
    </div>
  );
}
