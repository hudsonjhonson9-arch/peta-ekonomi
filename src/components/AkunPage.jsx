import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../App.jsx";
import useResponsive from "../useResponsive.js";
import { Icon } from "./ui.jsx";

function hitungKekuatanPassword(pass) {
  if (!pass) return { skor: 0, label: "", tone: "" };
  let skor = 0;
  if (pass.length >= 6) skor += 1;
  if (pass.length >= 8) skor += 1;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) skor += 1;
  if (/[0-9]/.test(pass) || /[^a-zA-Z0-9]/.test(pass)) skor += 1;
  if (skor <= 1) return { skor: 1, label: "Sangat lemah", tone: "#DC2626" };
  if (skor === 2) return { skor: 2, label: "Cukup", tone: "#D97706" };
  if (skor === 3) return { skor: 3, label: "Bagus", tone: "#2563EB" };
  return { skor: 4, label: "Sangat kuat", tone: "#16A34A" };
}

export default function AkunPage({ user, onUpdateUser }) {
  const { T, isDark } = useContext(ThemeContext);
  const { isMobile } = useResponsive();

  const [loadingProfil, setLoadingProfil] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);
  const [pesanSukses, setPesanSukses] = useState("");
  const [pesanError, setPesanError] = useState("");
  const [salinNipSukses, setSalinNipSukses] = useState(false);

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

  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPassword, setKonfirmasiPassword] = useState("");
  const [showPassLama, setShowPassLama] = useState(false);
  const [showPassBaru, setShowPassBaru] = useState(false);
  const [showPassKonf, setShowPassKonf] = useState(false);

  const [riwayat, setRiwayat] = useState([]);
  const [cariRiwayat, setCariRiwayat] = useState("");

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
    setLoadingProfil(true);
    setPesanSukses("");
    setPesanError("");
    try {
      const res = await fetch("/api/akun/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: profil.nama, nomorhp: profil.nomorhp, jabatan: profil.jabatan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui profil");
      setPesanSukses("Data profil berhasil diperbarui.");
      if (onUpdateUser) onUpdateUser({ ...user, name: profil.nama, nama: profil.nama });
    } catch (err) {
      setPesanError(err.message);
    } finally {
      setLoadingProfil(false);
    }
  };

  const handleGantiPassword = async (e) => {
    e.preventDefault();
    if (!passwordLama || !passwordBaru) {
      setPesanError("Isi kata sandi saat ini dan kata sandi baru.");
      return;
    }
    if (passwordBaru.length < 6) {
      setPesanError("Kata sandi baru minimal 6 karakter.");
      return;
    }
    if (passwordBaru !== konfirmasiPassword) {
      setPesanError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setLoadingPass(true);
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
      setPesanSukses(data.message || "Kata sandi berhasil diperbarui. Gunakan kata sandi baru saat login berikutnya.");
      setPasswordLama("");
      setPasswordBaru("");
      setKonfirmasiPassword("");
    } catch (err) {
      setPesanError(err.message);
    } finally {
      setLoadingPass(false);
    }
  };

  const kekuatan = useMemo(() => hitungKekuatanPassword(passwordBaru), [passwordBaru]);
  const isMatch = Boolean(passwordBaru && konfirmasiPassword && passwordBaru === konfirmasiPassword);
  const isMismatch = Boolean(konfirmasiPassword && passwordBaru !== konfirmasiPassword);

  const kriteria = [
    { ok: passwordBaru.length >= 6, teks: "Min. 6 karakter" },
    { ok: passwordBaru.length >= 8, teks: "8 karakter+" },
    { ok: /[a-z]/.test(passwordBaru) && /[A-Z]/.test(passwordBaru), teks: "Besar & kecil" },
    { ok: /[0-9]/.test(passwordBaru) || /[^a-zA-Z0-9]/.test(passwordBaru), teks: "Angka/simbol" },
  ];

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

  const skorKeamanan = useMemo(() => {
    let pts = 50;
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

  const dataTerkunci = [
    { label: "Nomor Induk Pegawai (NIP)", val: profil.nip || "—", mono: true, icon: "file" },
    { label: "Tingkat Akses (Role)", val: profil.role || "—", badge: true, icon: "shield" },
    { label: "Unit Kerja / Bidang", val: profil.bidang || "Sekretariat / Umum", icon: "building" },
    { label: "Perangkat Daerah (OPD)", val: profil.opd_nama || "BAPPERIDA", icon: "building" },
  ];

  const kartuStyle = {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: isMobile ? "16px 18px" : "20px 24px",
    boxShadow: T.shadowSm || "0 1px 3px rgba(0,0,0,0.05)",
  };

  const inputStyle = {
    width: "100%",
    padding: "9px 13px",
    fontSize: 13,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    background: T.inputBg || T.card,
    color: T.text,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.15s ease",
  };

  const labelStyle = {
    display: "block",
    fontSize: 12.5,
    fontWeight: 600,
    color: T.text,
    marginBottom: 6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, color: T.text }}>
      {/* ── 1. HEADER BANNER PROFIL PENGGUNA ── */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: isMobile ? "16px" : "18px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          boxShadow: T.shadowSm,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 240, flex: 1 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${T.primary}, #1D4ED8)`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
            }}
          >
            {inisialNama}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.3 }}>
                {profil.nama || "Pengguna BAPPERIDA"}
              </h1>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: T.primaryLight,
                  color: T.primary,
                  border: `1px solid ${T.border}`,
                }}
              >
                {profil.role || "Pengguna"}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{[profil.jabatan, profil.opd_nama].filter(Boolean).join(" · ") || "BAPPERIDA Kab. Sumba Barat"}</span>
              {profil.nip && (
                <>
                  <span style={{ opacity: 0.5 }}>•</span>
                  <button
                    type="button"
                    onClick={handleSalinNip}
                    title="Klik untuk menyalin NIP"
                    style={{
                      background: T.surfaceHover || "rgba(0,0,0,0.04)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      padding: "2px 8px",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: salinNipSukses ? "#16A34A" : T.textSecondary,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: "monospace",
                    }}
                  >
                    <Icon name={salinNipSukses ? "check" : "file"} size={11} />
                    <span>{salinNipSukses ? "NIP Disalin" : `NIP ${profil.nip}`}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Indikator Keamanan Akun */}
        <div
          style={{
            background: T.surfaceHover || "rgba(0,0,0,0.02)",
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "10px 16px",
            minWidth: 170,
          }}
          title="Dihitung dari kelengkapan profil dan riwayat login sistem"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>
            <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name="shield" size={13} style={{ color: T.primary }} />
              Keamanan Akun
            </span>
            <span style={{ fontWeight: 800, color: skorKeamanan >= 80 ? "#16A34A" : "#D97706" }}>
              {skorKeamanan}%
            </span>
          </div>
          <div style={{ width: "100%", height: 6, borderRadius: 99, background: T.border, overflow: "hidden" }}>
            <div
              style={{
                width: `${skorKeamanan}%`,
                height: "100%",
                background: skorKeamanan >= 80 ? "#16A34A" : "#F59E0B",
                borderRadius: 99,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── NOTIFIKASI ALERT ── */}
      {pesanSukses && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            color: "#166534",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="checkCircle" size={16} style={{ color: "#16A34A" }} />
            {pesanSukses}
          </span>
          <button
            type="button"
            onClick={() => setPesanSukses("")}
            style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", display: "flex" }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {pesanError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="alert" size={16} style={{ color: "#DC2626" }} />
            {pesanError}
          </span>
          <button
            type="button"
            onClick={() => setPesanError("")}
            style={{ background: "none", border: "none", color: "#991B1B", cursor: "pointer", display: "flex" }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {/* ── 2. BARIS UTAMA: DATA PEGAWAI (KIRI) & GANTI KATA SANDI (KANAN) [KOMPAK & TINGGI SAMA] ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        {/* ── CARD KIRI: DATA PEGAWAI & PROFIL (ULTRA COMPACT) ── */}
        <div style={{ ...kartuStyle, padding: isMobile ? "12px 14px" : "14px 18px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: T.primaryLight,
                color: T.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="users" size={15} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>Data Pegawai & Profil</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Identitas kepegawaian & kontak kedinasan</div>
            </div>
          </div>

          {/* Sub-A & Sub-B: Dibagi Dua (Kiri: NIP, Role, Unit, OPD | Kanan: Nama, Jabatan, No WA & Simpan) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
              gap: 12,
              flex: 1,
            }}
          >
            {/* SEBELAH KIRI: NIP, Role, Unit, OPD (Identitas Terkunci) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "12px 14px",
                background: T.surfaceHover || "rgba(0,0,0,0.02)",
                borderRadius: 10,
                boxSizing: "border-box",
                border: `1px solid ${T.border}`,
                gap: 8,
              }}
            >
              <div>
                <div style={{ color: T.textMuted, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>
                  NIP
                </div>
                <div style={{ fontWeight: 700, fontFamily: "monospace", color: T.text, fontSize: 11.5, wordBreak: "break-all" }}>
                  {profil.nip || "—"}
                </div>
              </div>

              <div>
                <div style={{ color: T.textMuted, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>
                  Role
                </div>
                <div>
                  <span style={{ fontWeight: 700, color: T.primary, background: T.primaryLight, padding: "2px 7px", borderRadius: 4, fontSize: 11, display: "inline-block" }}>
                    {profil.role || "—"}
                  </span>
                </div>
              </div>

              <div>
                <div style={{ color: T.textMuted, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>
                  Unit
                </div>
                <div style={{ fontWeight: 600, color: T.text, fontSize: 11.5, lineHeight: 1.3 }} title={profil.bidang}>
                  {profil.bidang || "Sekretariat"}
                </div>
              </div>

              <div>
                <div style={{ color: T.textMuted, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>
                  OPD
                </div>
                <div style={{ fontWeight: 600, color: T.text, fontSize: 11.5, lineHeight: 1.3 }} title={profil.opd_nama}>
                  {profil.opd_nama || "BAPPERIDA"}
                </div>
              </div>
            </div>

            {/* SEBELAH KANAN: Form Nama, Jabatan, Nomor WA & Tombol Simpan */}
            <form onSubmit={handleSimpanProfil} style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "space-between", width: "100%", boxSizing: "border-box" }}>
              <div>
                <label style={{ ...labelStyle, fontSize: 11.5, marginBottom: 3 }}>
                  Nama Lengkap Beserta Gelar <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, height: 32, width: "100%", boxSizing: "border-box" }}
                  required
                  value={profil.nama}
                  onChange={(e) => setProfil({ ...profil, nama: e.target.value })}
                  placeholder="Contoh: Achmad Aqil Susanto, S.Kom"
                />
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: 11.5, marginBottom: 3 }}>Jabatan Kedinasan</label>
                <input
                  style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, height: 32, width: "100%", boxSizing: "border-box" }}
                  value={profil.jabatan}
                  onChange={(e) => setProfil({ ...profil, jabatan: e.target.value })}
                  placeholder="Contoh: Pranata Komputer Ahli Pertama"
                />
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: 11.5, marginBottom: 3 }}>Nomor WhatsApp / HP</label>
                <input
                  style={{ ...inputStyle, padding: "6px 10px", fontSize: 12, height: 32, width: "100%", boxSizing: "border-box" }}
                  inputMode="tel"
                  value={profil.nomorhp}
                  onChange={(e) => setProfil({ ...profil, nomorhp: e.target.value })}
                  placeholder="Contoh: 082237174435"
                />
              </div>

              <div style={{ paddingTop: 4 }}>
                <button
                  type="submit"
                  disabled={loadingProfil}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    width: "100%",
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 8,
                    background: T.primary,
                    color: "#fff",
                    border: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: loadingProfil ? "not-allowed" : "pointer",
                    opacity: loadingProfil ? 0.7 : 1,
                    boxShadow: "0 1px 2px rgba(37,99,235,0.25)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon name={loadingProfil ? "loader" : "checkCircle"} size={13} />
                  <span>{loadingProfil ? "Menyimpan..." : "Simpan Perubahan Profil"}</span>
                </button>
              </div>
            </form>
          </div>
          </div>

        {/* ── CARD KANAN: GANTI KATA SANDI (ULTRA COMPACT) ── */}
        <div style={{ ...kartuStyle, padding: isMobile ? "12px 14px" : "14px 18px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: T.primaryLight,
                color: T.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="key" size={15} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>Ganti Kata Sandi</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Perbarui kata sandi akun secara berkala</div>
            </div>
          </div>

          <form onSubmit={handleGantiPassword} style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
            {/* Sandi Saat Ini */}
            <div>
              <label style={{ ...labelStyle, fontSize: 11.5, marginBottom: 3 }}>
                Kata Sandi Saat Ini <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassLama ? "text" : "password"}
                  style={{ ...inputStyle, padding: "6px 34px 6px 10px", fontSize: 12, height: 32 }}
                  value={passwordLama}
                  onChange={(e) => setPasswordLama(e.target.value)}
                  placeholder="Masukkan kata sandi saat ini"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassLama(!showPassLama)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: T.textMuted,
                    cursor: "pointer",
                    display: "flex",
                  }}
                >
                  <Icon name={showPassLama ? "eyeOff" : "eye"} size={14} />
                </button>
              </div>
            </div>

            {/* Baris 2-Kolom: Sandi Baru & Konfirmasi Sandi */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ ...labelStyle, fontSize: 11.5, marginBottom: 3 }}>
                  Kata Sandi Baru <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassBaru ? "text" : "password"}
                    style={{ ...inputStyle, padding: "6px 34px 6px 10px", fontSize: 12, height: 32 }}
                    value={passwordBaru}
                    onChange={(e) => setPasswordBaru(e.target.value)}
                    placeholder="Min. 6 karakter"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassBaru(!showPassBaru)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: T.textMuted,
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <Icon name={showPassBaru ? "eyeOff" : "eye"} size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: 11.5, marginBottom: 3 }}>
                  Ulangi Sandi Baru <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassKonf ? "text" : "password"}
                    style={{
                      ...inputStyle,
                      padding: "6px 34px 6px 10px",
                      fontSize: 12,
                      height: 32,
                      borderColor: isMatch ? "#16A34A" : isMismatch ? "#DC2626" : T.border,
                    }}
                    value={konfirmasiPassword}
                    onChange={(e) => setKonfirmasiPassword(e.target.value)}
                    placeholder="Ulangi sandi"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassKonf(!showPassKonf)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: T.textMuted,
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <Icon name={showPassKonf ? "eyeOff" : "eye"} size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Indikator Kekuatan Sandi (Super Kompak 1 Baris) */}
            {passwordBaru && (
              <div style={{ padding: "5px 8px", background: T.surfaceHover || "rgba(0,0,0,0.02)", borderRadius: 6, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10.5, color: T.textSecondary }}>
                    Kekuatan: <strong style={{ color: kekuatan.tone }}>{kekuatan.label}</strong>
                    {isMismatch && <span style={{ color: "#DC2626", marginLeft: 6 }}>&bull; Belum cocok</span>}
                    {isMatch && <span style={{ color: "#16A34A", marginLeft: 6 }}>&bull; Cocok</span>}
                  </span>
                  <div style={{ display: "flex", gap: 3, width: 70, height: 4 }}>
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        style={{
                          flex: 1,
                          borderRadius: 2,
                          background: n <= kekuatan.skor ? kekuatan.tone : T.border,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tombol Simpan Sandi (Menempel Rapi di Bawah) */}
            <div style={{ marginTop: "auto", paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <button
                type="submit"
                disabled={loadingPass || isMismatch}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  width: "100%",
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 8,
                  background: isDark ? "#2563EB" : T.primary,
                  color: "#fff",
                  border: "none",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: loadingPass || isMismatch ? "not-allowed" : "pointer",
                  opacity: loadingPass || isMismatch ? 0.7 : 1,
                  boxShadow: "0 1px 2px rgba(37,99,235,0.25)",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon name={loadingPass ? "loader" : "shield"} size={14} />
                <span>{loadingPass ? "Memperbarui..." : "Perbarui Kata Sandi"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── 3. CARD TUNGGAL DI BAWAH: RIWAYAT AKTIVITAS & SESI AKUN ── */}
      <div style={kartuStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: isDark ? "#2E1065" : "#F5F3FF",
                color: isDark ? "#C4B5FD" : "#7C3AED",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="history" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Riwayat Login & Aktivitas Akun</div>
              <div style={{ fontSize: 11.5, color: T.textMuted }}>Catatan sesi login dan audit keamanan akun Anda ({riwayat.length} aktivitas terekam)</div>
            </div>
          </div>

          <div style={{ position: "relative", minWidth: 240 }}>
            <input
              value={cariRiwayat}
              onChange={(e) => setCariRiwayat(e.target.value)}
              placeholder="Cari aktivitas atau alamat IP..."
              style={{
                ...inputStyle,
                paddingLeft: 32,
                fontSize: 12,
              }}
            />
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: T.textMuted,
                display: "flex",
              }}
            >
              <Icon name="search" size={13} />
            </span>
          </div>
        </div>

        {!riwayatFiltered.length ? (
          <div
            style={{
              textAlign: "center",
              padding: "36px 16px",
              color: T.textMuted,
              fontSize: 13,
            }}
          >
            <div style={{ marginBottom: 6, fontWeight: 700, color: T.text }}>
              {cariRiwayat ? "Tidak ada catatan yang cocok" : "Belum ada catatan aktivitas"}
            </div>
            <div>{cariRiwayat ? "Coba gunakan kata kunci lain." : "Catatan login akan terekam secara otomatis setiap kali Anda masuk."}</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: T.primaryLight, textAlign: "left", color: T.primary }}>
                  <th style={{ padding: "9px 12px", fontWeight: 700, borderRadius: "6px 0 0 6px" }}>Waktu Masuk</th>
                  <th style={{ padding: "9px 12px", fontWeight: 700 }}>Aktivitas / Peristiwa</th>
                  <th style={{ padding: "9px 12px", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "9px 12px", fontWeight: 700, borderRadius: "0 6px 6px 0" }}>Alamat IP</th>
                </tr>
              </thead>
              <tbody>
                {riwayatFiltered.slice(0, 15).map((r, idx) => {
                  const gagal = r.status && r.status.includes("gagal");
                  return (
                    <tr
                      key={r.id || idx}
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        background: idx % 2 === 0 ? "transparent" : (T.surfaceHover || "rgba(0,0,0,0.015)"),
                      }}
                    >
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: T.textSecondary }}>
                        {new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: T.text }}>{r.pesan}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: gagal ? "#FEF2F2" : "#F0FDF4",
                            color: gagal ? "#DC2626" : "#16A34A",
                            border: `1px solid ${gagal ? "#FECACA" : "#BBF7D0"}`,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 99,
                              background: gagal ? "#DC2626" : "#16A34A",
                            }}
                          />
                          {(r.status || "sukses").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", color: T.textMuted, fontSize: 12 }}>
                        {r.ip_address || "127.0.0.1"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
