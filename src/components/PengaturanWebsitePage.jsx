import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon, Badge } from "./ui.jsx";

const PRESET_TEMA = [
  { key: "emerald", label: "Emerald BAPPERIDA", primer: "#059669", aksen: "#0284C7", desc: "Warna resmi khas perencanaan dan kelestarian daerah" },
  { key: "blue", label: "Biru Bahari Sumba", primer: "#2563EB", aksen: "#0D9488", desc: "Elegan, profesional, dan mencerminkan pelayanan publik modern" },
  { key: "indigo", label: "Indigo Transformatif", primer: "#4F46E5", aksen: "#EA580C", desc: "Modern, berbasis inovasi teknologi dan sains digital" },
  { key: "slate", label: "Slate Netral", primer: "#334155", aksen: "#2563EB", desc: "Minimalis, kontras tinggi, cocok untuk dokumen dan data teknis" },
];

export default function PengaturanWebsitePage() {
  const { T, isDark } = useContext(ThemeContext);

  // Tab State tersimpan di URL hash dan localStorage
  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const hp = new URLSearchParams((window.location.hash || "").split("?")[1] || "");
      const urlTab = hp.get("tab");
      if (urlTab && ["identitas", "tema", "beranda", "aset", "riwayat"].includes(urlTab)) return urlTab;
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
        if (urlTab && ["identitas", "tema", "beranda", "aset", "riwayat"].includes(urlTab)) {
          setActiveTabState(urlTab);
        }
      } catch (_) {}
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const [loading, setLoading] = useState(false);
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
    tema: {
      preset: "emerald",
      warna_primer: "#059669",
      warna_aksen: "#0284C7",
      font: "Plus Jakarta Sans",
      mode_gelap: false,
    },
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
  const [assets, setAssets] = useState([]);

  // Load Data dari API
  const muatData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pengaturan", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const aktif = data.draft || data.published;
        if (aktif && aktif.payload) {
          setSettings({
            identitas: { ...settings.identitas, ...(aktif.payload.identitas || {}) },
            tema: { ...settings.tema, ...(aktif.payload.tema || {}) },
            beranda: { ...settings.beranda, ...(aktif.payload.beranda || {}) },
          });
        }
        setDraftInfo(data.draft ? { id: data.draft.id, updated_at: data.draft.updated_at } : null);
        setPublishedInfo(data.published ? { id: data.published.id, published_at: data.published.published_at, published_by: data.published.published_by } : null);
      }

      const resRiwayat = await fetch("/api/admin/pengaturan/riwayat", { cache: "no-store" });
      if (resRiwayat.ok) {
        setRiwayat(await resRiwayat.json());
      }

      const resAset = await fetch("/api/admin/pengaturan/aset", { cache: "no-store" });
      if (resAset.ok) {
        setAssets(await resAset.json());
      }
    } catch {
      // Abaikan error jaringan offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    muatData();
  }, []);

  // Simpan Draft
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
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan draft");
      setPesan({ jenis: "sukses", teks: "Draf konfigurasi berhasil disimpan. Perubahan dapat diuji sebelum diterbitkan." });
      muatData();
    } catch (err) {
      setPesan({ jenis: "error", teks: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Terbitkan ke Publik
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

      setPesan({ jenis: "sukses", teks: "Pengaturan berhasil diterbitkan ke portal publik! Semua data live langsung aktif." });
      muatData();
    } catch (err) {
      setPesan({ jenis: "error", teks: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Rollback ke Revisi Tertentu
  const handleRollback = async (revisionId) => {
    if (!window.confirm(`Pulihkan pengaturan dari Revisi #${revisionId} ke dalam draf?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pengaturan/riwayat/${revisionId}/rollback`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal rollback revisi");
      setPesan({ jenis: "sukses", teks: data.message });
      muatData();
    } catch (err) {
      setPesan({ jenis: "error", teks: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Hitung persentase kelengkapan data identitas
  const kelengkapanIdentitas = useMemo(() => {
    const fields = [
      settings.identitas.nama_portal,
      settings.identitas.nama_daerah,
      settings.identitas.instansi,
      settings.identitas.deskripsi,
      settings.identitas.email,
      settings.identitas.telepon,
      settings.identitas.alamat,
    ];
    const filled = fields.filter((f) => f && String(f).trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [settings.identitas]);

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: `1.5px solid ${T.border}`,
    background: isDark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
    color: T.text,
    fontSize: 13.5,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 12.5,
    fontWeight: 700,
    color: T.text,
    marginBottom: 6,
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* ── HEADER EXECUTIVE CONTROL CENTER ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                padding: "3px 8px",
                borderRadius: 6,
                background: `${T.primary}18`,
                color: T.primary,
              }}
            >
              Manajemen Konten & CMS
            </span>
            {draftInfo ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 99,
                  background: "#FEF3C7",
                  color: "#D97706",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B" }} />
                Ada Draf Belum Terbit
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 99,
                  background: "#DCFCE7",
                  color: "#166534",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
                Publikasi Sinkron
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: -0.3 }}>
            Pengaturan Website & CMS Portal
          </h1>
          <p style={{ fontSize: 13.5, color: T.textSecondary, margin: "4px 0 0", maxWidth: 640 }}>
            Kelola profil resmi daerah, identitas portal Satu Data, visual tema, tata letak beranda publik, dan audit revisi.
          </p>
        </div>

        {/* Action Group */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => window.open("/#publik", "_blank")}
            title="Buka pratinjau portal publik di tab baru"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 8,
              border: `1.5px solid ${T.border}`,
              background: T.cardBg,
              color: T.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Icon name="world" size={15} />
            <span>Pratinjau Portal</span>
          </button>

          <button
            onClick={handleSimpanDraft}
            disabled={saving}
            title="Simpan konfigurasi ke draf tanpa langsung mengubah publik"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              borderRadius: 8,
              border: `1.5px solid ${T.border}`,
              background: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9",
              color: T.text,
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            <Icon name="archive" size={15} />
            <span>Simpan Draf</span>
          </button>

          <button
            onClick={handleTerbitkan}
            disabled={saving}
            title="Terapkan dan publikasikan konfigurasi langsung ke pengunjung portal"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)",
            }}
          >
            <Icon name="checkCircle" size={15} />
            <span>Terbitkan ke Publik</span>
          </button>
        </div>
      </div>

      {/* Alert Notifikasi Pesan */}
      {pesan.teks && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: pesan.jenis === "sukses" ? (isDark ? "rgba(16,185,129,0.15)" : "#ECFDF5") : (isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2"),
            border: `1px solid ${pesan.jenis === "sukses" ? "#10B981" : "#EF4444"}`,
            color: pesan.jenis === "sukses" ? (isDark ? "#34D399" : "#065F46") : (isDark ? "#F87171" : "#991B1B"),
            fontSize: 13.5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name={pesan.jenis === "sukses" ? "checkCircle" : "alert"} size={18} />
            <span>{pesan.teks}</span>
          </div>
          <button
            onClick={() => setPesan({ jenis: "", teks: "" })}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 4 }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {/* ── TABS BAR (SWISS SEGMENTED BAR) ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: `1.5px solid ${T.border}`,
          marginBottom: 24,
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        {[
          { key: "identitas", label: "Identitas & Kontak", icon: "building", hint: "Profil & SEO" },
          { key: "tema", label: "Tema & Visual", icon: "layers", hint: "Warna & Tipografi" },
          { key: "beranda", label: "Tata Letak Beranda", icon: "home", hint: "Komponen Publik" },
          { key: "aset", label: "Aset & Logo Daerah", icon: "upload", hint: "Galeri Aset" },
          { key: "riwayat", label: "Riwayat & Rollback", icon: "clock", hint: `${riwayat.length} Revisi` },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                background: "none",
                border: "none",
                borderBottom: isActive ? `2.5px solid ${T.primary}` : "2.5px solid transparent",
                color: isActive ? T.primary : T.textSecondary,
                fontWeight: isActive ? 700 : 500,
                fontSize: 13.5,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <Icon name={tab.icon} size={15} />
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 6,
                  background: isActive ? `${T.primary}18` : (isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9"),
                  color: isActive ? T.primary : T.textMuted,
                  fontWeight: 600,
                }}
              >
                {tab.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 2-COLUMN MAIN CONTENT (SETTINGS FORM + STICKY LIVE MOCKUP) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 360px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* KOLOM KIRI: FORMULIR PENGATURAN */}
        <div>
          {/* TAB 1: IDENTITAS & KONTAK */}
          {activeTab === "identitas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Card 1: Identitas Lembaga */}
              <div
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: T.shadow,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: `${T.primary}15`,
                      color: T.primary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="building" size={17} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>
                      Identitas Portal & Lembaga
                    </h3>
                    <p style={{ fontSize: 12, color: T.textSecondary, margin: "2px 0 0" }}>
                      Nama resmi sistem dan instansi penyelenggara Satu Data
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>
                      <span>Nama Portal Resmi</span>
                      <span style={{ fontSize: 11, color: T.textMuted }}>Wajib</span>
                    </label>
                    <input
                      type="text"
                      value={settings.identitas.nama_portal}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, nama_portal: e.target.value } })}
                      style={inputStyle}
                      placeholder="Contoh: Portal Satu Data BAPPERIDA Sumba Barat"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      <span>Nama Daerah</span>
                      <span style={{ fontSize: 11, color: T.textMuted }}>Wajib</span>
                    </label>
                    <input
                      type="text"
                      value={settings.identitas.nama_daerah}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, nama_daerah: e.target.value } })}
                      style={inputStyle}
                      placeholder="Kabupaten Sumba Barat"
                    />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>
                      <span>Instansi Pengelola / Walidata</span>
                      <span style={{ fontSize: 11, color: T.textMuted }}>BAPPERIDA</span>
                    </label>
                    <input
                      type="text"
                      value={settings.identitas.instansi}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, instansi: e.target.value } })}
                      style={inputStyle}
                      placeholder="Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: SEO & Meta Deskripsi */}
              <div
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: T.shadow,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#2563EB15",
                      color: "#2563EB",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="world" size={17} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>
                      Optimasi Mesin Pencari (SEO & OpenGraph)
                    </h3>
                    <p style={{ fontSize: 12, color: T.textSecondary, margin: "2px 0 0" }}>
                      Teks deskripsi yang muncul pada hasil pencarian Google dan pratinjau media sosial
                    </p>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    <span>Deskripsi Meta SEO</span>
                    <span style={{ fontSize: 11, color: settings.identitas.deskripsi.length > 160 ? "#EF4444" : T.textMuted }}>
                      {settings.identitas.deskripsi.length} / 160 Karakter Disarankan
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={settings.identitas.deskripsi}
                    onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, deskripsi: e.target.value } })}
                    style={{ ...inputStyle, resize: "vertical", minHeight: 76 }}
                    placeholder="Tuliskan ringkasan 1-2 kalimat tentang portal Satu Data Sumba Barat..."
                  />
                </div>

                {/* Pratinjau Google Search Result */}
                <div
                  style={{
                    marginTop: 14,
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: isDark ? "rgba(0,0,0,0.25)" : "#F8FAFC",
                    border: `1px dashed ${T.border}`,
                  }}
                >
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
                    Pratinjau Hasil Pencarian Google
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1D4ED8", textDecoration: "underline" }}>
                    {settings.identitas.nama_portal} — {settings.identitas.nama_daerah}
                  </div>
                  <div style={{ fontSize: 12, color: "#059669", margin: "2px 0" }}>
                    https://arsipdigital.mindcloud.my.id/portal
                  </div>
                  <div style={{ fontSize: 12.5, color: T.textSecondary, lineHeight: 1.4 }}>
                    {settings.identitas.deskripsi || "Deskripsi portal resmi Satu Data Kabupaten Sumba Barat..."}
                  </div>
                </div>
              </div>

              {/* Card 3: Kontak & Alamat Resmi */}
              <div
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: T.shadow,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#0D948815",
                      color: "#0D9488",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="tag" size={17} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>
                      Kontak Dinas & Alamat Kantor
                    </h3>
                    <p style={{ fontSize: 12, color: T.textSecondary, margin: "2px 0 0" }}>
                      Informasi resmi yang dapat dihubungi oleh masyarakat, akademisi, dan media
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>
                      <span>Email Dinas Resmi</span>
                    </label>
                    <input
                      type="email"
                      value={settings.identitas.email}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, email: e.target.value } })}
                      style={inputStyle}
                      placeholder="bapperida@sumbabaratkab.go.id"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      <span>Telepon / Hotline Kantor</span>
                    </label>
                    <input
                      type="text"
                      value={settings.identitas.telepon}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, telepon: e.target.value } })}
                      style={inputStyle}
                      placeholder="(0387) 21123"
                    />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>
                      <span>Alamat Lengkap Kantor BAPPERIDA</span>
                    </label>
                    <input
                      type="text"
                      value={settings.identitas.alamat}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, alamat: e.target.value } })}
                      style={inputStyle}
                      placeholder="Jl. Veteran No. 1, Waikabubak, Sumba Barat, NTT"
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: Media Sosial */}
              <div
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: T.shadow,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#F59E0B15",
                      color: "#F59E0B",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="link" size={17} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>
                      Tautan Media Sosial Resmi
                    </h3>
                    <p style={{ fontSize: 12, color: T.textSecondary, margin: "2px 0 0" }}>
                      Tautan media sosial yang dipasang pada footer portal publik
                    </p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Instagram URL</label>
                    <input
                      type="text"
                      value={settings.identitas.instagram || ""}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, instagram: e.target.value } })}
                      style={inputStyle}
                      placeholder="https://instagram.com/bapperidasumbabarat"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Facebook URL</label>
                    <input
                      type="text"
                      value={settings.identitas.facebook || ""}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, facebook: e.target.value } })}
                      style={inputStyle}
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>YouTube URL</label>
                    <input
                      type="text"
                      value={settings.identitas.youtube || ""}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, youtube: e.target.value } })}
                      style={inputStyle}
                      placeholder="https://youtube.com/@..."
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>X / Twitter URL</label>
                    <input
                      type="text"
                      value={settings.identitas.twitter || ""}
                      onChange={(e) => setSettings({ ...settings, identitas: { ...settings.identitas, twitter: e.target.value } })}
                      style={inputStyle}
                      placeholder="https://x.com/..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TEMA & DESAIN */}
          {activeTab === "tema" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Preset Palet Warna */}
              <div
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: T.shadow,
                }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>
                  Palet Warna Tema Portal
                </h3>
                <p style={{ fontSize: 12.5, color: T.textSecondary, margin: "0 0 16px" }}>
                  Pilih preset tema desain warna yang telah diuji standar aksesibilitas WCAG AA
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {PRESET_TEMA.map((p) => {
                    const isSelected = settings.tema.preset === p.key;
                    return (
                      <div
                        key={p.key}
                        onClick={() =>
                          setSettings({
                            ...settings,
                            tema: {
                              ...settings.tema,
                              preset: p.key,
                              warna_primer: p.primer,
                              warna_aksen: p.aksen,
                            },
                          })
                        }
                        style={{
                          padding: "14px 16px",
                          borderRadius: 12,
                          border: isSelected ? `2px solid ${p.primer}` : `1.5px solid ${T.border}`,
                          background: isSelected ? `${p.primer}0E` : (isDark ? "rgba(255,255,255,0.02)" : "#FAFAFA"),
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{p.label}</span>
                          <div style={{ display: "flex", gap: 5 }}>
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: p.primer }} />
                            <div style={{ width: 16, height: 16, borderRadius: "50%", background: p.aksen }} />
                          </div>
                        </div>
                        <p style={{ fontSize: 11.5, color: T.textSecondary, margin: 0, lineHeight: 1.35 }}>
                          {p.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                  <div>
                    <label style={labelStyle}>Warna Primer Kustom (Hex)</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="color"
                        value={settings.tema.warna_primer}
                        onChange={(e) => setSettings({ ...settings, tema: { ...settings.tema, warna_primer: e.target.value } })}
                        style={{ width: 44, height: 40, border: "none", cursor: "pointer", borderRadius: 8 }}
                      />
                      <input
                        type="text"
                        value={settings.tema.warna_primer}
                        onChange={(e) => setSettings({ ...settings, tema: { ...settings.tema, warna_primer: e.target.value } })}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Tipografi Font Utama</label>
                    <select
                      value={settings.tema.font}
                      onChange={(e) => setSettings({ ...settings, tema: { ...settings.tema, font: e.target.value } })}
                      style={inputStyle}
                    >
                      <option value="Plus Jakarta Sans">Plus Jakarta Sans (Standar Modern)</option>
                      <option value="Inter">Inter (SaaS & Data Heavy)</option>
                      <option value="Work Sans">Work Sans (Swiss Geometric)</option>
                      <option value="system-ui">System Default</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TATA LETAK BERANDA */}
          {activeTab === "beranda" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Hero Banner Text */}
              <div
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: T.shadow,
                }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>
                  Pesan Utama Banner Beranda
                </h3>
                <p style={{ fontSize: 12.5, color: T.textSecondary, margin: "0 0 16px" }}>
                  Judul headline dan pengantar yang pertama kali dilihat warga dan pengunjung portal
                </p>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Judul Utama Banner (Hero Headline)</label>
                  <input
                    type="text"
                    value={settings.beranda.hero_title}
                    onChange={(e) => setSettings({ ...settings, beranda: { ...settings.beranda, hero_title: e.target.value } })}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Sub-Judul Penjelas</label>
                  <textarea
                    rows={2}
                    value={settings.beranda.hero_subtitle}
                    onChange={(e) => setSettings({ ...settings, beranda: { ...settings.beranda, hero_subtitle: e.target.value } })}
                    style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
                  />
                </div>
              </div>

              {/* Komponen Modular Beranda */}
              <div
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: T.shadow,
                }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>
                  Komponen Aktif di Beranda Publik
                </h3>
                <p style={{ fontSize: 12.5, color: T.textSecondary, margin: "0 0 16px" }}>
                  Aktifkan atau nonaktifkan modul data yang ditampilkan di halaman depan portal
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    {
                      key: "tampilkan_statistik",
                      icon: "chart",
                      title: "Statistik Counter Utama",
                      desc: "Kartu hitung jumlah dataset terbuka, organisasi produsen, bidang urusan, dan topik",
                    },
                    {
                      key: "tampilkan_spm",
                      icon: "shield",
                      title: "Ringkasan Capaian Standar Pelayanan Minimal (SPM)",
                      desc: "Tabel dan progres capaian 6 urusan wajib pelayanan dasar Pemkab Sumba Barat",
                    },
                    {
                      key: "tampilkan_peta",
                      icon: "world",
                      title: "Peta Interaktif Wilayah Kabupaten",
                      desc: "Peta batas wilayah kecamatan dengan indikator spasial terintegrasi",
                    },
                    {
                      key: "tampilkan_berita",
                      icon: "fileText",
                      title: "Seksi Berita & Publikasi Kegiatan",
                      desc: "Artikel rilis pers, berita pembangunan, dan pengumuman resmi Satu Data",
                    },
                    {
                      key: "tampilkan_visualisasi",
                      icon: "layers",
                      title: "Visualisasi Grafik & Tren Makro",
                      desc: "Grafik batang dan garis indikator makro ekonomi daerah secara interaktif",
                    },
                  ].map((item) => {
                    const isChecked = Boolean(settings.beranda[item.key]);
                    return (
                      <div
                        key={item.key}
                        onClick={() =>
                          setSettings({
                            ...settings,
                            beranda: { ...settings.beranda, [item.key]: !isChecked },
                          })
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 16px",
                          borderRadius: 10,
                          border: isChecked ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                          background: isChecked ? `${T.primary}08` : "none",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: isChecked ? `${T.primary}18` : (isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9"),
                              color: isChecked ? T.primary : T.textMuted,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Icon name={item.icon} size={16} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{item.title}</div>
                            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 1 }}>{item.desc}</div>
                          </div>
                        </div>

                        {/* Toggle Pill */}
                        <div
                          style={{
                            width: 42,
                            height: 24,
                            borderRadius: 99,
                            background: isChecked ? T.primary : (isDark ? "#334155" : "#CBD5E1"),
                            position: "relative",
                            transition: "background 0.2s ease",
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "#FFFFFF",
                              position: "absolute",
                              top: 3,
                              left: isChecked ? 21 : 3,
                              transition: "left 0.2s ease",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ASET & LOGO DAERAH */}
          {activeTab === "aset" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "22px 24px",
                  boxShadow: T.shadow,
                }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>
                  Logo & Identitas Visual Portal
                </h3>
                <p style={{ fontSize: 12.5, color: T.textSecondary, margin: "0 0 16px" }}>
                  Sesuai aturan branding, portal publik menggunakan lambang resmi Kabupaten Sumba Barat.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  {[
                    {
                      path: "/Lambang_Kabupaten_Sumba_Barat.png",
                      name: "Lambang Kabupaten Sumba Barat",
                      role: "Logo Utama Portal Publik",
                      isCurrent: true,
                    },
                    {
                      path: "/icon.svg",
                      name: "Logo Arsip Digital BAPPERIDA",
                      role: "Logo Panel Admin & Arsip Internal",
                      isCurrent: false,
                    },
                  ].map((a, i) => (
                    <div
                      key={i}
                      style={{
                        borderRadius: 12,
                        border: a.isCurrent ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
                        background: a.isCurrent ? `${T.primary}06` : "none",
                        padding: 16,
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          height: 100,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 10,
                        }}
                      >
                        <img src={a.path} alt={a.name} style={{ maxHeight: 85, maxWidth: "100%", objectFit: "contain" }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{a.name}</div>
                      <div style={{ fontSize: 11.5, color: T.textSecondary, marginTop: 2 }}>{a.role}</div>
                      {a.isCurrent && (
                        <div style={{ marginTop: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: T.primary,
                              background: `${T.primary}15`,
                              padding: "2px 8px",
                              borderRadius: 6,
                            }}
                          >
                            Aktif di Portal Publik
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RIWAYAT REVISI & ROLLBACK */}
          {activeTab === "riwayat" && (
            <div
              style={{
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: "22px 24px",
                boxShadow: T.shadow,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>
                    Log Riwayat Konfigurasi & Rollback
                  </h3>
                  <p style={{ fontSize: 12.5, color: T.textSecondary, margin: "2px 0 0" }}>
                    Setiap penerbitan disimpan sebagai versi arsip yang dapat dipulihkan kapan saja dengan 1 klik.
                  </p>
                </div>
                <button
                  onClick={muatData}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: "none",
                    color: T.textSecondary,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <Icon name="refresh" size={13} />
                  <span>Segarkan Log</span>
                </button>
              </div>

              {!riwayat.length ? (
                <div style={{ textAlign: "center", padding: "36px 0", color: T.textMuted, fontSize: 13.5 }}>
                  Belum ada log revisi konfigurasi yang tercatat.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {riwayat.map((r) => {
                    const isPub = r.status === "published";
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 18px",
                          borderRadius: 10,
                          border: `1px solid ${T.border}`,
                          background: isPub ? `${T.primary}08` : (isDark ? "rgba(255,255,255,0.02)" : "#FAFAFA"),
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 800,
                              background: isPub ? "#DCFCE7" : (isDark ? "#334155" : "#E2E8F0"),
                              color: isPub ? "#15803D" : (isDark ? "#CBD5E1" : "#475569"),
                            }}
                          >
                            #{r.id} {isPub ? "AKTIF" : "ARSIP"}
                          </span>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>
                              {r.note || "Konfigurasi sistem portal"}
                            </div>
                            <div style={{ fontSize: 11.5, color: T.textSecondary, marginTop: 2 }}>
                              Diterbitkan {r.published_at ? new Date(r.published_at).toLocaleString("id-ID") : "—"}
                              {r.publisher_nama ? ` • Oleh ${r.publisher_nama}` : ""}
                            </div>
                          </div>
                        </div>

                        {!isPub && (
                          <button
                            onClick={() => handleRollback(r.id)}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 8,
                              border: `1px solid ${T.primary}`,
                              background: "none",
                              color: T.primary,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Pulihkan ke Draf
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* KOLOM KANAN: LIVE PREVIEW PORTAL CARD (STICKY SIDECAR) */}
        <div style={{ position: "sticky", top: 20 }}>
          <div
            style={{
              background: T.cardBg,
              border: `1.5px solid ${T.border}`,
              borderRadius: 14,
              padding: 20,
              boxShadow: T.shadow,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, color: T.textSecondary }}>
                Live Mockup Portal
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 99,
                  background: `${settings.tema.warna_primer}20`,
                  color: settings.tema.warna_primer,
                }}
              >
                Pratinjau Langsung
              </span>
            </div>

            {/* Mockup Browser Window */}
            <div
              style={{
                borderRadius: 10,
                overflow: "hidden",
                border: `1px solid ${T.border}`,
                background: isDark ? "#0F172A" : "#FFFFFF",
              }}
            >
              {/* Browser Address Bar */}
              <div
                style={{
                  padding: "6px 10px",
                  background: isDark ? "#1E293B" : "#F1F5F9",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  color: T.textMuted,
                }}
              >
                <div style={{ display: "flex", gap: 3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444" }} />
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B" }} />
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                </div>
                <span style={{ flex: 1, textAlign: "center", background: isDark ? "#0F172A" : "#FFFFFF", padding: "2px 6px", borderRadius: 4 }}>
                  arsipdigital.mindcloud.my.id
                </span>
              </div>

              {/* Mockup Header */}
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: `1px solid ${T.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <img src="/Lambang_Kabupaten_Sumba_Barat.png" alt="" width={18} height={22} style={{ objectFit: "contain" }} />
                  <div style={{ lineHeight: 1 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: T.text }}>
                      {settings.identitas.nama_portal.slice(0, 24)}...
                    </div>
                    <div style={{ fontSize: 7.5, color: T.textMuted }}>
                      {settings.identitas.nama_daerah}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "3px 7px",
                    borderRadius: 4,
                    background: settings.tema.warna_primer,
                    color: "#fff",
                    fontSize: 8.5,
                    fontWeight: 700,
                  }}
                >
                  Portal Data
                </div>
              </div>

              {/* Mockup Hero Banner */}
              <div
                style={{
                  padding: "16px 12px",
                  background: `linear-gradient(135deg, ${settings.tema.warna_primer}12 0%, rgba(255,255,255,0) 100%)`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
                    color: settings.tema.warna_primer,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 4,
                  }}
                >
                  PORTAL RESMI SATU DATA
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.text, lineHeight: 1.25, marginBottom: 4 }}>
                  {settings.beranda.hero_title.slice(0, 48)}...
                </div>
                <div style={{ fontSize: 8.5, color: T.textSecondary, lineHeight: 1.3, marginBottom: 10 }}>
                  {settings.beranda.hero_subtitle.slice(0, 75)}...
                </div>

                {/* Mock Search Input */}
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: `1px solid ${T.border}`,
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    fontSize: 8.5,
                    color: T.textMuted,
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Cari dataset statistik...</span>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: settings.tema.warna_primer,
                      color: "#fff",
                      fontSize: 7.5,
                      fontWeight: 700,
                    }}
                  >
                    Cari
                  </span>
                </div>
              </div>

              {/* Mock Module Badges */}
              <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {settings.beranda.tampilkan_statistik && (
                  <span style={{ fontSize: 7.5, padding: "2px 5px", borderRadius: 3, background: "#EFF6FF", color: "#2563EB", fontWeight: 700 }}>
                    Counter
                  </span>
                )}
                {settings.beranda.tampilkan_spm && (
                  <span style={{ fontSize: 7.5, padding: "2px 5px", borderRadius: 3, background: "#ECFDF5", color: "#059669", fontWeight: 700 }}>
                    SPM
                  </span>
                )}
                {settings.beranda.tampilkan_peta && (
                  <span style={{ fontSize: 7.5, padding: "2px 5px", borderRadius: 3, background: "#FEF3C7", color: "#D97706", fontWeight: 700 }}>
                    Peta
                  </span>
                )}
                {settings.beranda.tampilkan_berita && (
                  <span style={{ fontSize: 7.5, padding: "2px 5px", borderRadius: 3, background: "#F3E8FF", color: "#7C3AED", fontWeight: 700 }}>
                    Berita
                  </span>
                )}
              </div>
            </div>

            {/* Checklist Kelengkapan */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                <span>Kelengkapan Data</span>
                <span style={{ color: kelengkapanIdentitas === 100 ? "#059669" : T.primary }}>{kelengkapanIdentitas}%</span>
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 99, background: isDark ? "#334155" : "#E2E8F0", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${kelengkapanIdentitas}%`,
                    height: "100%",
                    background: kelengkapanIdentitas === 100 ? "#059669" : T.primary,
                    borderRadius: 99,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 8, lineHeight: 1.4 }}>
                {kelengkapanIdentitas === 100
                  ? "Seluruh profil identitas dan kontak dinas lengkap."
                  : "Lengkapi semua field identitas untuk memaksimalkan kepatuhan standar Satu Data Indonesia."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
