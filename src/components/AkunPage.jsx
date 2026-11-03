import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon } from "./ui.jsx";

const TABS = [
  { key: "profil", label: "Profil & Kepegawaian", icon: "users" },
  { key: "password", label: "Ganti Kata Sandi", icon: "shield" },
  { key: "keamanan", label: "Riwayat Aktivitas", icon: "history" },
];

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
    setPesanSukses("");
    setPesanError("");
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
        if (urlTab && ["profil", "password", "keamanan"].includes(urlTab)) setActiveTabState(urlTab);
      } catch (_) {}
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const [loading, setLoading] = useState(false);
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
    setLoading(true);
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
      setLoading(false);
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
      setPesanSukses(data.message || "Kata sandi berhasil diperbarui. Gunakan kata sandi baru saat login berikutnya.");
      setPasswordLama("");
      setPasswordBaru("");
      setKonfirmasiPassword("");
    } catch (err) {
      setPesanError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const kekuatan = useMemo(() => hitungKekuatanPassword(passwordBaru), [passwordBaru]);
  const isMatch = Boolean(passwordBaru && konfirmasiPassword && passwordBaru === konfirmasiPassword);
  const isMismatch = Boolean(konfirmasiPassword && passwordBaru !== konfirmasiPassword);

  const kriteria = [
    { ok: passwordBaru.length >= 6, teks: "Minimal 6 karakter" },
    { ok: passwordBaru.length >= 8, teks: "8 karakter atau lebih" },
    { ok: /[a-z]/.test(passwordBaru) && /[A-Z]/.test(passwordBaru), teks: "Huruf besar & kecil" },
    { ok: /[0-9]/.test(passwordBaru) || /[^a-zA-Z0-9]/.test(passwordBaru), teks: "Kombinasi angka / simbol" },
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
    padding: "20px 24px",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── 1. HEADER BANNER AKUN ── */}
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
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

      {/* ── 2. NAVIGASI TAB PILL BERIKON ── */}
      <div
        role="tablist"
        aria-label="Pengaturan akun"
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          borderBottom: `1px solid ${T.border}`,
          paddingBottom: 12,
        }}
      >
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setActiveTab(t.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 16px",
                borderRadius: 10,
                border: active ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                background: active ? T.primaryLight : T.card,
                color: active ? T.primary : T.textSecondary,
                fontWeight: active ? 700 : 600,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
            >
              <Icon name={t.icon} size={15} />
              <span>{t.label}</span>
              {t.key === "keamanan" && riwayat.length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "1px 7px",
                    borderRadius: 99,
                    background: active ? T.primary : T.surfaceHover,
                    color: active ? "#fff" : T.textMuted,
                    fontWeight: 700,
                  }}
                >
                  {riwayat.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── ALERT NOTIFIKASI ── */}
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

      {/* ── 3. TAB 1: PROFIL & KEPEGAWAIAN ── */}
      {activeTab === "profil" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18 }}>
          {/* Kartu 1: Data Kepegawaian (Terkunci) */}
          <div style={kartuStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: T.surfaceHover || "rgba(0,0,0,0.04)",
                  color: T.textSecondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="shield" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Data Kepegawaian Terkunci</div>
                <div style={{ fontSize: 11.5, color: T.textMuted }}>Dikelola administrator lewat modul Pengguna</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {dataTerkunci.map((d, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: T.surfaceHover || "rgba(0,0,0,0.02)",
                    border: `1px solid ${T.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{d.label}</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: T.text,
                        marginTop: 2,
                        fontFamily: d.mono ? "monospace" : "inherit",
                      }}
                    >
                      {d.val}
                    </div>
                  </div>
                  <span style={{ color: T.textMuted }}>
                    <Icon name={d.icon} size={15} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Kartu 2: Nama dan Kontak (Dapat Diubah) */}
          <div style={kartuStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: T.primaryLight,
                  color: T.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="users" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Informasi Kontak & Gelar</div>
                <div style={{ fontSize: 11.5, color: T.textMuted }}>Dapat diperbarui langsung oleh pengguna</div>
              </div>
            </div>

            <form onSubmit={handleSimpanProfil} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>
                  Nama Lengkap Beserta Gelar <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  style={inputStyle}
                  required
                  value={profil.nama}
                  onChange={(e) => setProfil({ ...profil, nama: e.target.value })}
                  placeholder="Contoh: Achmad Aqil Susanto, S.Kom"
                />
              </div>

              <div>
                <label style={labelStyle}>Jabatan Kedinasan</label>
                <input
                  style={inputStyle}
                  value={profil.jabatan}
                  onChange={(e) => setProfil({ ...profil, jabatan: e.target.value })}
                  placeholder="Contoh: Pranata Komputer Ahli Pertama"
                />
              </div>

              <div>
                <label style={labelStyle}>Nomor WhatsApp / HP</label>
                <input
                  style={inputStyle}
                  inputMode="tel"
                  value={profil.nomorhp}
                  onChange={(e) => setProfil({ ...profil, nomorhp: e.target.value })}
                  placeholder="Contoh: 082237174435"
                />
                <span style={{ fontSize: 11, color: T.textMuted, marginTop: 4, display: "block" }}>
                  Empat digit terakhir digunakan untuk verifikasi pemulihan sandi
                </span>
              </div>

              <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 20px",
                    borderRadius: 10,
                    background: T.primary,
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon name={loading ? "loader" : "checkCircle"} size={14} />
                  <span>{loading ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 4. TAB 2: GANTI KATA SANDI ── */}
      {activeTab === "password" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18, alignItems: "start" }}>
          {/* Kolom Kiri: Form Ganti Kata Sandi */}
          <div style={kartuStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: T.primaryLight,
                  color: T.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="key" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Ganti Kata Sandi Akun</div>
                <div style={{ fontSize: 11.5, color: T.textMuted }}>Pastikan menggunakan kata sandi yang aman dan tidak dibagikan</div>
              </div>
            </div>

            <form onSubmit={handleGantiPassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Sandi Saat Ini */}
              <div>
                <label style={labelStyle}>Kata Sandi Saat Ini <span style={{ color: "#DC2626" }}>*</span></label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassLama ? "text" : "password"}
                    style={{ ...inputStyle, paddingRight: 40 }}
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
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: T.textMuted,
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <Icon name={showPassLama ? "eyeOff" : "eye"} size={16} />
                  </button>
                </div>
              </div>

              {/* Sandi Baru */}
              <div>
                <label style={labelStyle}>Kata Sandi Baru <span style={{ color: "#DC2626" }}>*</span></label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassBaru ? "text" : "password"}
                    style={{ ...inputStyle, paddingRight: 40 }}
                    value={passwordBaru}
                    onChange={(e) => setPasswordBaru(e.target.value)}
                    placeholder="Masukkan minimal 6 karakter kata sandi baru"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassBaru(!showPassBaru)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: T.textMuted,
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <Icon name={showPassBaru ? "eyeOff" : "eye"} size={16} />
                  </button>
                </div>

                {/* Indikator Kekuatan Sandi */}
                {passwordBaru && (
                  <div style={{ marginTop: 10, background: T.surfaceHover || "rgba(0,0,0,0.02)", padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11.5, color: T.textSecondary }}>Kekuatan Kata Sandi:</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: kekuatan.tone }}>{kekuatan.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, height: 5, marginBottom: 8 }}>
                      {[1, 2, 3, 4].map((n) => (
                        <div
                          key={n}
                          style={{
                            flex: 1,
                            borderRadius: 4,
                            background: n <= kekuatan.skor ? kekuatan.tone : T.border,
                            transition: "background 0.2s ease",
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {kriteria.map((k) => (
                        <span
                          key={k.teks}
                          style={{
                            fontSize: 11,
                            color: k.ok ? "#16A34A" : T.textMuted,
                            fontWeight: k.ok ? 600 : 400,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Icon name={k.ok ? "check" : "file"} size={10} style={{ opacity: k.ok ? 1 : 0.4 }} />
                          {k.teks}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Konfirmasi Sandi Baru */}
              <div>
                <label style={labelStyle}>Ulangi Kata Sandi Baru <span style={{ color: "#DC2626" }}>*</span></label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassKonf ? "text" : "password"}
                    style={{
                      ...inputStyle,
                      paddingRight: 40,
                      borderColor: isMatch ? "#16A34A" : isMismatch ? "#DC2626" : T.border,
                    }}
                    value={konfirmasiPassword}
                    onChange={(e) => setKonfirmasiPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi baru"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassKonf(!showPassKonf)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: T.textMuted,
                      cursor: "pointer",
                      display: "flex",
                    }}
                  >
                    <Icon name={showPassKonf ? "eyeOff" : "eye"} size={16} />
                  </button>
                </div>
                {isMismatch && (
                  <span style={{ fontSize: 11.5, color: "#DC2626", fontWeight: 600, marginTop: 4, display: "block" }}>
                    Kata sandi konfirmasi belum cocok.
                  </span>
                )}
              </div>

              <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                <button
                  type="submit"
                  disabled={loading || isMismatch}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 20px",
                    borderRadius: 10,
                    background: T.primary,
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: loading || isMismatch ? "not-allowed" : "pointer",
                    opacity: loading || isMismatch ? 0.7 : 1,
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon name={loading ? "loader" : "shield"} size={14} />
                  <span>{loading ? "Memproses..." : "Perbarui Kata Sandi"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Kolom Kanan: Panduan & Kebijakan Keamanan Siber */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={kartuStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: "#F0FDF4",
                    color: "#16A34A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="shield" size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Standar Keamanan Kata Sandi</div>
                  <div style={{ fontSize: 11.5, color: T.textMuted }}>Kebijakan pengamanan akun Satu Data BAPPERIDA</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  {
                    title: "Kombinasi Karakter Kompleks",
                    desc: "Gunakan minimal 8 karakter dengan perpaduan huruf besar (A-Z), huruf kecil (a-z), angka (0-9), dan simbol unik.",
                    icon: "checkCircle",
                    color: "#2563EB",
                  },
                  {
                    title: "Hindari Data Identitas Pribadi",
                    desc: "Jangan gunakan NIP, tanggal lahir, nama instansi, atau urutan angka umum (misal: 123456).",
                    icon: "alert",
                    color: "#D97706",
                  },
                  {
                    title: "Enkripsi Hash Satu Arah",
                    desc: "Kata sandi disimpan menggunakan algoritma hash kriptografis yang aman dan tidak dapat dibaca oleh siapa pun.",
                    icon: "lock",
                    color: "#16A34A",
                  },
                  {
                    title: "Audit & Pemantauan Aktivitas",
                    desc: "Setiap pergantian sandi dan sesi login terekam otomatis pada tab Riwayat Aktivitas untuk pemantauan keamanan.",
                    icon: "history",
                    color: "#6B7280",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: T.surfaceHover || "rgba(0,0,0,0.02)",
                      border: `1px solid ${T.border}`,
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: T.card,
                        color: item.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        border: `1px solid ${T.border}`,
                        marginTop: 1,
                      }}
                    >
                      <Icon name={item.icon} size={14} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, lineHeight: 1.45 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bantuan Pemulihan Akun */}
            <div
              style={{
                padding: "14px 18px",
                borderRadius: 12,
                background: T.card,
                border: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Kendala Akses atau Lupa Sandi?</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                  Hubungi Administrator BAPPERIDA Sumba Barat untuk bantuan reset akun.
                </div>
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: T.surfaceHover,
                  color: T.textSecondary,
                  border: `1px solid ${T.border}`,
                }}
              >
                Admin BAPPERIDA
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. TAB 3: RIWAYAT AKTIVITAS ── */}
      {activeTab === "keamanan" && (
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
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Riwayat Login & Keamanan</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>Menampilkan 20 catatan aktivitas terbaru akun Anda</div>
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
              <div>{cariRiwayat ? "Coba gunakan kata kunci lain." : "Catatan login akan terekam secara otomatis."}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: `1.5px solid ${T.border}`, textAlign: "left", color: T.textSecondary }}>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Waktu</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Aktivitas</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Status</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Alamat IP</th>
                  </tr>
                </thead>
                <tbody>
                  {riwayatFiltered.map((r, idx) => {
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
      )}
    </div>
  );
}
