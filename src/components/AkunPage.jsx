import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../App.jsx";
import useResponsive from "../useResponsive.js";
import { Icon, Badge } from "./ui.jsx";
import { ROLE_COLOR } from "../data.js";

// Evaluasi kekuatan kata sandi secara dinamis
function hitungKekuatanPassword(pass) {
  if (!pass) return { skor: 0, label: "Belum diisi", warna: "#94A3B8", persen: 0 };
  let skor = 0;
  if (pass.length >= 6) skor += 1;
  if (pass.length >= 8) skor += 1;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) skor += 1;
  if (/[0-9]/.test(pass) || /[^a-zA-Z0-9]/.test(pass)) skor += 1;

  if (skor <= 1) return { skor: 1, label: "Sangat Lemah", warna: "#DC2626", persen: 25 };
  if (skor === 2) return { skor: 2, label: "Cukup", warna: "#D97706", persen: 50 };
  if (skor === 3) return { skor: 3, label: "Bagus", warna: "#2563EB", persen: 75 };
  return { skor: 4, label: "Sangat Kuat", warna: "#16A34A", persen: 100 };
}

export default function AkunPage({ user, onUpdateUser }) {
  const { T, isDark } = useContext(ThemeContext);
  const { isMobile } = useResponsive();

  const [activeTab, setActiveTabState] = useState(() => {
    try {
      const hp = new URLSearchParams((window.location.hash || "").split("?")[1] || "");
      const urlTab = hp.get("tab");
      if (urlTab && ["profil", "password", "keamanan"].includes(urlTab)) return urlTab;
      return localStorage.getItem("akun_tab") || "profil";
    } catch {
      return "profil";
    }
  });

  const setActiveTab = (t) => {
    setActiveTabState(t);
    try {
      localStorage.setItem("akun_tab", t);
      const base = (window.location.hash || "#akun").split("?")[0] || "#akun";
      history.replaceState(null, "", `${base}?tab=${t}`);
    } catch (_) {}
  };

  useEffect(() => {
    const onHash = () => {
      try {
        const hp = new URLSearchParams((window.location.hash || "").split("?")[1] || "");
        const urlTab = hp.get("tab");
        if (urlTab && ["profil", "password", "keamanan"].includes(urlTab)) {
          setActiveTabState(urlTab);
        }
      } catch (_) {}
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const [loading, setLoading] = useState(false);
  const [pesanSukses, setPesanSukses] = useState("");
  const [pesanError, setPesanError] = useState("");
  const [salinNipSukses, setSalinNipSukses] = useState(false);

  // Profil Form
  const [profil, setProfil] = useState({
    nama: user?.name || user?.nama || "",
    nip: user?.nip || "",
    jabatan: "",
    nomorhp: "",
    bidang: user?.unit || "",
    role: user?.role || "",
    opd_nama: user?.opd_nama || "BAPPERIDA",
    last_login: null,
  });

  // Password Form
  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPassword, setKonfirmasiPassword] = useState("");
  const [showPassLama, setShowPassLama] = useState(false);
  const [showPassBaru, setShowPassBaru] = useState(false);
  const [showPassKonf, setShowPassKonf] = useState(false);

  // Riwayat Login
  const [riwayat, setRiwayat] = useState([]);
  const [cariRiwayat, setCariRiwayat] = useState("");

  // Load profil detail & riwayat
  useEffect(() => {
    fetch("/api/akun/profil")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setProfil({
            nama: data.nama || "",
            nip: data.nip || "",
            jabatan: data.jabatan || "",
            nomorhp: data.nomorhp || "",
            bidang: data.bidang || "",
            role: data.role || "",
            opd_nama: data.opd_nama || "BAPPERIDA",
            last_login: data.last_login || null,
          });
        }
      })
      .catch(() => {});

    fetch("/api/akun/riwayat-login")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRiwayat(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const handleSalinNip = () => {
    if (!profil.nip) return;
    navigator.clipboard.writeText(profil.nip);
    setSalinNipSukses(true);
    setTimeout(() => setSalinNipSukses(false), 2000);
  };

  const handleSimpanProfil = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPesanSukses("");
    setPesanError("");

    try {
      const res = await fetch("/api/akun/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: profil.nama,
          nomorhp: profil.nomorhp,
          jabatan: profil.jabatan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui profil");

      setPesanSukses("Profil pribadi berhasil diperbarui.");
      if (onUpdateUser) {
        onUpdateUser({ ...user, name: profil.nama, nama: profil.nama });
      }
    } catch (err) {
      setPesanError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGantiPassword = async (e) => {
    e.preventDefault();
    if (!passwordLama || !passwordBaru) {
      setPesanError("Semua kolom kata sandi wajib diisi");
      return;
    }
    if (passwordBaru.length < 6) {
      setPesanError("Kata sandi baru minimal 6 karakter");
      return;
    }
    if (passwordBaru !== konfirmasiPassword) {
      setPesanError("Konfirmasi kata sandi baru tidak cocok");
      return;
    }

    setLoading(true);
    setPesanSukses("");
    setPesanError("");

    try {
      const res = await fetch("/api/akun/ganti-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password_lama: passwordLama,
          password_baru: passwordBaru,
          konfirmasi_password: konfirmasiPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengganti kata sandi");

      setPesanSukses(data.message || "Kata sandi berhasil diperbarui. Silakan gunakan sandi baru pada login selanjutnya.");
      setPasswordLama("");
      setPasswordBaru("");
      setKonfirmasiPassword("");
    } catch (err) {
      setPesanError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Evaluasi kekuatan password baru
  const kekuatan = useMemo(() => hitungKekuatanPassword(passwordBaru), [passwordBaru]);
  const isMatch = Boolean(passwordBaru && konfirmasiPassword && passwordBaru === konfirmasiPassword);
  const isMismatch = Boolean(konfirmasiPassword && passwordBaru !== konfirmasiPassword);

  // Riwayat terfilter
  const riwayatFiltered = useMemo(() => {
    if (!cariRiwayat.trim()) return riwayat;
    const q = cariRiwayat.toLowerCase();
    return riwayat.filter(
      (r) =>
        (r.pesan && r.pesan.toLowerCase().includes(q)) ||
        (r.status && r.status.toLowerCase().includes(q)) ||
        (r.ip_address && r.ip_address.toLowerCase().includes(q))
    );
  }, [riwayat, cariRiwayat]);

  // Skor Keamanan Akun
  const skorKeamanan = useMemo(() => {
    let pts = 50; // Sandi awal terenkripsi
    if (profil.nomorhp && profil.nomorhp.length >= 10) pts += 25;
    if (profil.jabatan) pts += 15;
    if (riwayat.length > 0) pts += 10;
    return Math.min(100, pts);
  }, [profil, riwayat]);

  const inisialNama = useMemo(() => {
    const n = profil.nama || user?.name || "AD";
    const parts = n.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }, [profil.nama, user]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: isMobile ? "12px 8px 32px" : "20px 16px 48px" }}>
      {/* ── 1. HERO PROFILE BANNER CARD ── */}
      <div
        style={{
          background: isDark
            ? "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)"
            : "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)",
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          padding: isMobile ? 18 : 24,
          marginBottom: 20,
          boxShadow: T.shadow,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          {/* Avatar Lingkaran Besar dengan Badge Online */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${T.primary} 0%, #1D4ED8 100%)`,
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 0.5,
                boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
              }}
            >
              {inisialNama}
            </div>
            <div
              title="Akun Aktif"
              style={{
                position: "absolute",
                bottom: 2,
                right: 2,
                width: 15,
                height: 15,
                borderRadius: "50%",
                background: "#10B981",
                border: "2.5px solid #FFFFFF",
              }}
            />
          </div>

          {/* Info User */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: isMobile ? 20 : 23, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.2 }}>
                {profil.nama || "Pengguna Bapperida"}
              </h1>
              <Badge
                label={profil.role || user?.role || "Staf"}
                colors={ROLE_COLOR[profil.role || user?.role] || { bg: "#EFF6FF", text: "#2563EB" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap", fontSize: 13, color: T.textMuted }}>
              {/* NIP Badge dengan Tombol Copy */}
              <div
                onClick={handleSalinNip}
                title="Klik untuk menyalin NIP"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9",
                  padding: "3px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "monospace",
                  fontWeight: 600,
                  fontSize: 12,
                  color: T.text,
                  border: `1px solid ${T.border}`,
                }}
              >
                <Icon name={salinNipSukses ? "check" : "copy"} size={13} style={{ color: salinNipSukses ? "#10B981" : T.primary }} />
                <span>NIP: {profil.nip || "—"}</span>
                {salinNipSukses && <span style={{ color: "#10B981", fontSize: 11, fontWeight: 700 }}>Disalin!</span>}
              </div>

              {/* Instansi OPD */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="building" size={14} style={{ color: T.textMuted }} />
                <span>{profil.opd_nama || "BAPPERIDA Kab. Sumba Barat"}</span>
              </div>

              {/* Jabatan */}
              {profil.jabatan && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Icon name="tag" size={13} style={{ color: T.textMuted }} />
                  <span>{profil.jabatan}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Sesi & Keamanan Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div
            style={{
              padding: "8px 14px",
              background: isDark ? "rgba(16, 185, 129, 0.12)" : "#ECFDF5",
              border: "1px solid #A7F3D0",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              color: "#065F46",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Icon name="shield" size={16} style={{ color: "#10B981" }} />
            <div>
              <div style={{ fontSize: 10.5, color: "#047857", textTransform: "uppercase", fontWeight: 700 }}>Status Keamanan</div>
              <div>Bcrypt 10-Rounds &bull; Terlindungi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Alert Feedback */}
      {pesanSukses && (
        <div
          style={{
            padding: "14px 18px",
            background: "#ECFDF5",
            border: "1.5px solid #6EE7B7",
            borderRadius: 12,
            color: "#065F46",
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(16,185,129,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="checkCircle" size={20} style={{ color: "#10B981" }} />
            <span>{pesanSukses}</span>
          </div>
          <button onClick={() => setPesanSukses("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#065F46" }}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {pesanError && (
        <div
          style={{
            padding: "14px 18px",
            background: "#FEF2F2",
            border: "1.5px solid #FCA5A5",
            borderRadius: 12,
            color: "#991B1B",
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(239,68,68,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="alert" size={20} style={{ color: "#DC2626" }} />
            <span>{pesanError}</span>
          </div>
          <button onClick={() => setPesanError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B" }}>
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {/* ── 2. TWO-COLUMN MASTER-DETAIL LAYOUT ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "290px 1fr", gap: 20, alignItems: "start" }}>
        {/* KOLOM KIRI: Navigasi Tab + Card Skor Keamanan */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Card Menu Navigasi Tab */}
          <div
            style={{
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 10,
              boxShadow: T.shadow,
            }}
          >
            {[
              { key: "profil", label: "Profil Saya", sub: "Identitas, jabatan & kontak", icon: "users" },
              { key: "password", label: "Ganti Kata Sandi", sub: "Pembaruan sandi akun", icon: "shield" },
              { key: "keamanan", label: "Riwayat Aktivitas", sub: "Catatan audit login & sesi", icon: "history" },
            ].map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(t.key);
                    setPesanSukses("");
                    setPesanError("");
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: active ? (isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF") : "transparent",
                    color: active ? T.primary : T.text,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    textAlign: "left",
                    transition: "all 0.15s ease",
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      background: active ? T.primary : (isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9"),
                      color: active ? "#FFFFFF" : T.textMuted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={t.icon} size={18} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: active ? 700 : 600 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{t.sub}</div>
                  </div>
                  {active && (
                    <div style={{ width: 4, height: 18, borderRadius: 2, background: T.primary }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Card Skor Kesehatan Keamanan Akun */}
          <div
            style={{
              background: T.cardBg,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 18,
              boxShadow: T.shadow,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="shield" size={15} style={{ color: "#10B981" }} />
                <span>Skor Keamanan Akun</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: skorKeamanan >= 80 ? "#10B981" : "#D97706" }}>
                {skorKeamanan}%
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ height: 6, background: isDark ? "rgba(255,255,255,0.1)" : "#E2E8F0", borderRadius: 99, overflow: "hidden", marginBottom: 14 }}>
              <div
                style={{
                  width: `${skorKeamanan}%`,
                  height: "100%",
                  background: skorKeamanan >= 80 ? "#10B981" : "#F59E0B",
                  borderRadius: 99,
                  transition: "width 0.4s ease",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.text }}>
                <Icon name="checkCircle" size={14} style={{ color: "#10B981" }} />
                <span>Sandi akun terenkripsi Bcrypt</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.text }}>
                <Icon name="checkCircle" size={14} style={{ color: "#10B981" }} />
                <span>NIP terverifikasi kepegawaian</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: profil.nomorhp ? T.text : T.textMuted }}>
                <Icon name={profil.nomorhp ? "checkCircle" : "alert"} size={14} style={{ color: profil.nomorhp ? "#10B981" : "#F59E0B" }} />
                <span>{profil.nomorhp ? "No. WhatsApp terhubung" : "Belum ada no. WhatsApp"}</span>
              </div>
            </div>
          </div>

          {/* Card Informasi Bantuan */}
          <div
            style={{
              background: isDark ? "rgba(37,99,235,0.08)" : "#F0F9FF",
              border: `1px solid ${isDark ? "rgba(37,99,235,0.25)" : "#BAE6FD"}`,
              borderRadius: 14,
              padding: 16,
              fontSize: 12,
              color: isDark ? "#93C5FD" : "#0369A1",
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="info" size={14} />
              <span>Butuh Bantuan Akun?</span>
            </div>
            Perubahan NIP, perpindahan OPD, atau hak akses dikelola oleh Administrator BAPPERIDA melalui menu Manajemen Pengguna.
          </div>
        </div>

        {/* KOLOM KANAN: Konten Tab Aktif */}
        <div style={{ minWidth: 0 }}>
          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: PROFIL SAYA
              ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "profil" && (
            <div
              style={{
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: isMobile ? 18 : 28,
                boxShadow: T.shadow,
              }}
            >
              <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 22 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: 0 }}>
                  Informasi Profil & Kepegawaian
                </h2>
                <p style={{ fontSize: 13, color: T.textMuted, margin: "4px 0 0" }}>
                  Tinjau data akun kepegawaian Anda dan perbarui nomor kontak serta jabatan Anda
                </p>
              </div>

              <form onSubmit={handleSimpanProfil}>
                {/* Bagian 1: Data Terkunci Sistem */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="lock" size={13} />
                    <span>Data Kepegawaian (Terkunci oleh Sistem)</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                        Nomor Induk Pegawai (NIP)
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={profil.nip}
                          disabled
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            paddingLeft: 34,
                            background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
                            border: `1px solid ${T.border}`,
                            borderRadius: 9,
                            fontSize: 13,
                            color: T.textMuted,
                            fontFamily: "monospace",
                            boxSizing: "border-box",
                          }}
                        />
                        <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>
                          <Icon name="lock" size={14} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                        Tingkat Akses / Role Sistem
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={profil.role}
                          disabled
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            paddingLeft: 34,
                            background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
                            border: `1px solid ${T.border}`,
                            borderRadius: 9,
                            fontSize: 13,
                            color: T.textMuted,
                            fontWeight: 600,
                            boxSizing: "border-box",
                          }}
                        />
                        <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>
                          <Icon name="shield" size={14} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                        Unit Kerja / Bidang
                      </label>
                      <input
                        type="text"
                        value={profil.bidang || "Sekretariat / Umum"}
                        disabled
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
                          border: `1px solid ${T.border}`,
                          borderRadius: 9,
                          fontSize: 13,
                          color: T.textMuted,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                        Instansi / Organisasi Perangkat Daerah
                      </label>
                      <input
                        type="text"
                        value={profil.opd_nama}
                        disabled
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
                          border: `1px solid ${T.border}`,
                          borderRadius: 9,
                          fontSize: 13,
                          color: T.textMuted,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian 2: Data yang Dapat Diedit */}
                <div style={{ marginBottom: 24, paddingTop: 16, borderTop: `1px dashed ${T.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="edit" size={13} />
                    <span>Informasi Pribadi & Kontak (Dapat Diedit)</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                        Nama Lengkap Beserta Gelar <span style={{ color: T.danger }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={profil.nama}
                        onChange={(e) => setProfil({ ...profil, nama: e.target.value })}
                        required
                        placeholder="Masukkan nama lengkap Anda"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          background: T.inputBg || T.cardBg,
                          border: `1px solid ${T.border}`,
                          borderRadius: 9,
                          fontSize: 13.5,
                          color: T.text,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                          Jabatan Fungsional / Struktural
                        </label>
                        <input
                          type="text"
                          value={profil.jabatan}
                          onChange={(e) => setProfil({ ...profil, jabatan: e.target.value })}
                          placeholder="Contoh: Analis Kebijakan Ahli Muda"
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            background: T.inputBg || T.cardBg,
                            border: `1px solid ${T.border}`,
                            borderRadius: 9,
                            fontSize: 13.5,
                            color: T.text,
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                          Nomor WhatsApp / HP
                        </label>
                        <input
                          type="text"
                          value={profil.nomorhp}
                          onChange={(e) => setProfil({ ...profil, nomorhp: e.target.value })}
                          placeholder="Contoh: 081234567890"
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            background: T.inputBg || T.cardBg,
                            border: `1px solid ${T.border}`,
                            borderRadius: 9,
                            fontSize: 13.5,
                            color: T.text,
                            boxSizing: "border-box",
                            outline: "none",
                          }}
                        />
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                          Digunakan untuk verifikasi 4 digit terakhir saat pemulihan kata sandi mandiri tanpa OTP.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tombol Simpan */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: "11px 24px",
                      background: T.primary,
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: loading ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon name="check" size={16} />
                    <span>{loading ? "Menyimpan Perubahan..." : "Simpan Perubahan Profil"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: GANTI KATA SANDI (REDESIGNED DENGAN UI/UX PRO MAX)
              ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "password" && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr", gap: 20 }}>
              {/* Form Input Sandi Baru */}
              <div
                style={{
                  background: T.cardBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 16,
                  padding: isMobile ? 18 : 28,
                  boxShadow: T.shadow,
                }}
              >
                <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 22 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="key" size={18} style={{ color: T.primary }} />
                    <span>Perbarui Kata Sandi</span>
                  </h2>
                  <p style={{ fontSize: 13, color: T.textMuted, margin: "4px 0 0" }}>
                    Gunakan kombinasi kata sandi yang kuat dan tidak dibagikan kepada staf lain
                  </p>
                </div>

                <form onSubmit={handleGantiPassword}>
                  {/* Kata Sandi Lama */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                      Kata Sandi Saat Ini (Lama) <span style={{ color: T.danger }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassLama ? "text" : "password"}
                        value={passwordLama}
                        onChange={(e) => setPasswordLama(e.target.value)}
                        placeholder="Masukkan kata sandi lama Anda"
                        autoComplete="current-password"
                        required
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          paddingLeft: 36,
                          paddingRight: 40,
                          background: T.inputBg || T.cardBg,
                          border: `1px solid ${T.border}`,
                          borderRadius: 9,
                          fontSize: 13.5,
                          color: T.text,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                      <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>
                        <Icon name="lock" size={15} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassLama(!showPassLama)}
                        title={showPassLama ? "Sembunyikan sandi" : "Lihat sandi"}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: T.textMuted,
                          cursor: "pointer",
                          padding: 4,
                          display: "flex",
                        }}
                      >
                        <Icon name={showPassLama ? "eyeOff" : "eye"} size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Kata Sandi Baru */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                      Kata Sandi Baru <span style={{ color: T.danger }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassBaru ? "text" : "password"}
                        value={passwordBaru}
                        onChange={(e) => setPasswordBaru(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        autoComplete="new-password"
                        required
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          paddingLeft: 36,
                          paddingRight: 40,
                          background: T.inputBg || T.cardBg,
                          border: `1px solid ${T.border}`,
                          borderRadius: 9,
                          fontSize: 13.5,
                          color: T.text,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                      <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>
                        <Icon name="key" size={15} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassBaru(!showPassBaru)}
                        title={showPassBaru ? "Sembunyikan sandi" : "Lihat sandi"}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: T.textMuted,
                          cursor: "pointer",
                          padding: 4,
                          display: "flex",
                        }}
                      >
                        <Icon name={showPassBaru ? "eyeOff" : "eye"} size={16} />
                      </button>
                    </div>

                    {/* Dynamic Password Strength Meter */}
                    {passwordBaru && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, fontSize: 11.5 }}>
                          <span style={{ color: T.textMuted }}>Kekuatan Kata Sandi:</span>
                          <span style={{ fontWeight: 700, color: kekuatan.warna }}>{kekuatan.label}</span>
                        </div>
                        <div style={{ height: 5, background: isDark ? "rgba(255,255,255,0.1)" : "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${kekuatan.persen}%`,
                              height: "100%",
                              background: kekuatan.warna,
                              borderRadius: 99,
                              transition: "all 0.3s ease",
                            }}
                          />
                        </div>

                        {/* Checklist Kriteria */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8, fontSize: 11 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, color: passwordBaru.length >= 6 ? "#16A34A" : T.textMuted }}>
                            <Icon name={passwordBaru.length >= 6 ? "check" : "x"} size={12} />
                            <span>Minimal 6 karakter</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, color: (/[a-z]/.test(passwordBaru) && /[A-Z]/.test(passwordBaru)) ? "#16A34A" : T.textMuted }}>
                            <Icon name={(/[a-z]/.test(passwordBaru) && /[A-Z]/.test(passwordBaru)) ? "check" : "x"} size={12} />
                            <span>Huruf besar & kecil</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, color: (/[0-9]/.test(passwordBaru) || /[^a-zA-Z0-9]/.test(passwordBaru)) ? "#16A34A" : T.textMuted }}>
                            <Icon name={(/[0-9]/.test(passwordBaru) || /[^a-zA-Z0-9]/.test(passwordBaru)) ? "check" : "x"} size={12} />
                            <span>Angka atau simbol</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, color: passwordBaru.length >= 8 ? "#16A34A" : T.textMuted }}>
                            <Icon name={passwordBaru.length >= 8 ? "check" : "x"} size={12} />
                            <span>Disarankan ≥ 8 karakter</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Konfirmasi Kata Sandi Baru */}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                      Konfirmasi Kata Sandi Baru <span style={{ color: T.danger }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassKonf ? "text" : "password"}
                        value={konfirmasiPassword}
                        onChange={(e) => setKonfirmasiPassword(e.target.value)}
                        placeholder="Ketik ulang kata sandi baru"
                        autoComplete="new-password"
                        required
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          paddingLeft: 36,
                          paddingRight: 40,
                          background: T.inputBg || T.cardBg,
                          border: `1px solid ${isMatch ? "#10B981" : isMismatch ? "#EF4444" : T.border}`,
                          borderRadius: 9,
                          fontSize: 13.5,
                          color: T.text,
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                      />
                      <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>
                        <Icon name="key" size={15} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassKonf(!showPassKonf)}
                        title={showPassKonf ? "Sembunyikan sandi" : "Lihat sandi"}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: T.textMuted,
                          cursor: "pointer",
                          padding: 4,
                          display: "flex",
                        }}
                      >
                        <Icon name={showPassKonf ? "eyeOff" : "eye"} size={16} />
                      </button>
                    </div>

                    {/* Indikator Kecocokan Password */}
                    {konfirmasiPassword && (
                      <div style={{ marginTop: 6, fontSize: 11.5, display: "flex", alignItems: "center", gap: 5 }}>
                        {isMatch ? (
                          <span style={{ color: "#16A34A", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <Icon name="checkCircle" size={13} /> Kata sandi cocok
                          </span>
                        ) : (
                          <span style={{ color: "#DC2626", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <Icon name="alert" size={13} /> Kata sandi belum cocok
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tombol Simpan Sandi */}
                  <button
                    type="submit"
                    disabled={loading || (konfirmasiPassword && !isMatch)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: (konfirmasiPassword && !isMatch) ? "#94A3B8" : T.primary,
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: (loading || (konfirmasiPassword && !isMatch)) ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon name="shield" size={17} />
                    <span>{loading ? "Memproses Pembaruan..." : "Perbarui Kata Sandi"}</span>
                  </button>
                </form>
              </div>

              {/* Panel Panduan Praktik Keamanan Sandi */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    background: T.cardBg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 16,
                    padding: 22,
                    boxShadow: T.shadow,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: isDark ? "rgba(37,99,235,0.2)" : "#EFF6FF",
                        color: T.primary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="shield" size={17} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
                      Standar Keamanan Sandi BAPPERIDA
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5, color: T.textSecondary, lineHeight: 1.5 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>&bull;</span>
                      <span>Gunakan kombinasi minimal <b>8 hingga 16 karakter</b> untuk ketahanan terhadap serangan brute-force.</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>&bull;</span>
                      <span>Hindari memakai data pribadi yang mudah ditebak seperti <b>tanggal lahir, NIP, atau nama anak</b>.</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>&bull;</span>
                      <span>Jangan pernah membagikan kata sandi akun Anda kepada siapapun, termasuk sesama rekan kerja.</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ color: "#16A34A", fontWeight: 700 }}>&bull;</span>
                      <span>Disarankan mengganti kata sandi secara berkala setiap <b>3 hingga 6 bulan sekali</b>.</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: isDark ? "rgba(16, 185, 129, 0.08)" : "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: 14,
                    padding: 16,
                    fontSize: 12,
                    color: isDark ? "#86EFAC" : "#166534",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="checkCircle" size={14} style={{ color: "#16A34A" }} />
                    <span>Enkripsi Bcrypt Satu Arah</span>
                  </div>
                  Kata sandi Anda disimpan dengan enkripsi satu arah (*salted hash*), sehingga tidak dapat dibaca bahkan oleh pengelola database.
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: RIWAYAT AKTIVITAS & AUDIT SESI
              ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "keamanan" && (
            <div
              style={{
                background: T.cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: isMobile ? 18 : 28,
                boxShadow: T.shadow,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="history" size={18} style={{ color: T.primary }} />
                    <span>Riwayat Aktivitas & Audit Sesi</span>
                  </h2>
                  <p style={{ fontSize: 13, color: T.textMuted, margin: "4px 0 0" }}>
                    Catatan 20 log autentikasi dan aktivitas keamanan terakhir untuk akun Anda
                  </p>
                </div>

                {/* Filter Pencarian Log */}
                <div style={{ position: "relative", minWidth: 220 }}>
                  <input
                    type="text"
                    value={cariRiwayat}
                    onChange={(e) => setCariRiwayat(e.target.value)}
                    placeholder="Saring riwayat aktivitas..."
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      paddingLeft: 32,
                      background: T.inputBg || T.cardBg,
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: T.text,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>
                    <Icon name="search" size={14} />
                  </div>
                </div>
              </div>

              {/* Tabel Log Aktivitas */}
              {!riwayatFiltered.length ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: T.textMuted }}>
                  <Icon name="history" size={32} style={{ color: T.textMuted, opacity: 0.5, marginBottom: 10 }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Belum ada catatan aktivitas</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Log autentikasi akan otomatis tercatat setiap kali Anda login atau memperbarui sandi</div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.border}`, textAlign: "left", color: T.textMuted }}>
                        <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Waktu & Tanggal</th>
                        <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Aktivitas</th>
                        <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Status</th>
                        <th style={{ padding: "10px 12px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" }}>Alamat IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riwayatFiltered.map((r) => {
                        const isGantiPass = r.status === "ganti_password" || r.status === "reset_password";
                        const isGagal = r.status && r.status.includes("gagal");
                        return (
                          <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}`, transition: "background 0.1s ease" }}>
                            <td style={{ padding: "12px", color: T.text, whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Icon name="clock" size={13} style={{ color: T.textMuted }} />
                                <span>{new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
                              </div>
                            </td>
                            <td style={{ padding: "12px", color: T.text, fontWeight: 600 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <Icon name={isGantiPass ? "key" : "users"} size={14} style={{ color: isGantiPass ? T.primary : T.textMuted }} />
                                <span>{r.pesan}</span>
                              </div>
                            </td>
                            <td style={{ padding: "12px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "3px 9px",
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  background: isGagal ? "#FEE2E2" : isGantiPass ? "#EFF6FF" : "#DCFCE7",
                                  color: isGagal ? "#DC2626" : isGantiPass ? "#2563EB" : "#16A34A",
                                  border: `1px solid ${isGagal ? "#FCA5A5" : isGantiPass ? "#BFDBFE" : "#86EFAC"}`,
                                }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: isGagal ? "#DC2626" : isGantiPass ? "#2563EB" : "#16A34A" }} />
                                {r.status || "sukses"}
                              </span>
                            </td>
                            <td style={{ padding: "12px", color: T.textMuted, fontFamily: "monospace", fontSize: 12 }}>
                              <span style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9", padding: "2px 7px", borderRadius: 4 }}>
                                {r.ip_address || "127.0.0.1"}
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
          )}
        </div>
      </div>
    </div>
  );
}
