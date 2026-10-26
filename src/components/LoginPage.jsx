import { useState } from "react";
import { Icon } from "./ui.jsx";

export default function LoginPage({ onLogin }) {
  const [nip, setNip] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  const handle = async () => {
    if (!nip || !pass) {
      setErr("Silakan masukkan NIP dan password");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nip, password: pass, remember })
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || "Login gagal");
      else onLogin(data.user);
    } catch {
      setErr("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  const input = {
    width: "100%", padding: "11px 13px",
    border: "1px solid #E2E8F0", borderRadius: 12,
    fontSize: 14, outline: "none", boxSizing: "border-box",
    background: "#fff", color: "#0F172A",
    transition: "border-color .15s, box-shadow .15s",
  };
  const label = { fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 };

  return (
    <>
      <style>{`
        .ad-login { min-height: 100vh; min-height: 100dvh; width: 100%; display: flex; background: #F8FAFC; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        .ad-login .kiri { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .ad-login .card {
          width: 100%; max-width: 360px; background: #fff; border-radius: 20px;
          padding: 36px 32px; box-shadow: 0 20px 60px rgba(15,23,42,0.10);
          border: 1px solid #E2E8F0; box-sizing: border-box;
          animation: adFadeUp .5s ease both;
        }
        .ad-login .stagger > * { animation: adFadeUp .5s ease both; }
        .ad-login .stagger > *:nth-child(1){animation-delay:.05s}
        .ad-login .stagger > *:nth-child(2){animation-delay:.10s}
        .ad-login .stagger > *:nth-child(3){animation-delay:.15s}
        .ad-login .stagger > *:nth-child(4){animation-delay:.20s}
        .ad-login .stagger > *:nth-child(5){animation-delay:.25s}
        .ad-login .stagger > *:nth-child(6){animation-delay:.30s}
        .ad-login .stagger > *:nth-child(7){animation-delay:.35s}
        @keyframes adFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .ad-login input:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
        .ad-login .kanan {
          flex: 1.1; background: #2563EB; color: #fff; display: flex;
          flex-direction: column; justify-content: center; padding: 64px 72px; position: relative; overflow: hidden;
        }
        .ad-login .kanan::before, .ad-login .kanan::after {
          content: ""; position: absolute; border-radius: 9999px; background: rgba(255,255,255,0.06);
        }
        .ad-login .kanan::before { width: 380px; height: 380px; top: -120px; right: -80px; }
        .ad-login .kanan::after { width: 260px; height: 260px; bottom: -100px; left: -60px; }
        .ad-login .kanan > * { position: relative; z-index: 1; }
        .ad-login .btn-masuk:active { transform: translateY(1px); }
        @media (max-width: 1023px) { .ad-login .kanan { display: none; } }
      `}</style>

      <div className="ad-login">
        {/* Kiri — kartu login */}
        <div className="kiri">
          <div className="card">
            <div className="stagger">
              {/* Logo */}
              <div style={{ textAlign: "center", marginBottom: 26 }}>
                <img src="/icon.svg" alt="" width={52} height={52} style={{ margin: "0 auto 12px", display: "block", borderRadius: 14 }} />
                <div style={{ fontSize: 19, fontWeight: 700, color: "#0F172A", letterSpacing: -0.3 }}>Arsip Digital Bapperida</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Pusat Dokumen Digital Perencanaan Pembangunan</div>
              </div>

              {/* NIP */}
              <div style={{ marginBottom: 16 }}>
                <label style={label}>NIP</label>
                <input
                  value={nip}
                  onChange={e => { setNip(e.target.value); setErr(""); }}
                  onKeyDown={e => e.key === "Enter" && handle()}
                  placeholder="Masukkan NIP"
                  style={input}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    value={pass}
                    onChange={e => { setPass(e.target.value); setErr(""); }}
                    onKeyDown={e => e.key === "Enter" && handle()}
                    placeholder="••••••••"
                    style={{ ...input, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
                    style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "#94A3B8", padding: 2, display: "flex",
                    }}
                  >
                    <Icon name={showPass ? "eyeOff" : "eye"} size={16} />
                  </button>
                </div>
              </div>

              {/* Ingat saya + lupa password */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#475569", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: "#2563EB", cursor: "pointer" }}
                  />
                  Ingat saya
                </label>
                <a href="#" onClick={e => e.preventDefault()} style={{ fontSize: 12.5, color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>
                  Lupa password?
                </a>
              </div>

              {err && (
                <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 12, textAlign: "center" }}>{err}</div>
              )}

              {/* Tombol utama */}
              <button
                className="btn-masuk"
                onClick={handle}
                disabled={loading}
                style={{
                  width: "100%", padding: "12px", marginBottom: 18,
                  background: loading ? "#94A3B8" : "#2563EB",
                  color: "#fff", border: "none", borderRadius: 12,
                  fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "background .15s",
                }}
              >
                {loading && (
                  <span style={{
                    width: 15, height: 15, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff",
                    animation: "adSpin .7s linear infinite",
                  }} />
                )}
                {loading ? "Memproses..." : "Masuk"}
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
                <span style={{ fontSize: 11.5, color: "#94A3B8" }}>atau</span>
                <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
              </div>

              {/* Google (dekoratif) */}
              <button
                type="button"
                onClick={() => setErr("Login Google belum tersedia")}
                style={{
                  width: "100%", padding: "11px", background: "#fff",
                  border: "1px solid #E2E8F0", borderRadius: 12, color: "#334155",
                  fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 36.1 44 30.6 44 24c0-1.3-.1-2.7-.4-3.9z"/>
                </svg>
                Lanjutkan dengan Google
              </button>
            </div>
          </div>
        </div>

        {/* Kanan — panel brand (hidden < 1024px) */}
        <div className="kanan">
          <div style={{ maxWidth: 440 }}>
            <img src="/icon.svg" alt="" width={64} height={64} style={{ marginBottom: 28, borderRadius: 16, boxShadow: "0 8px 24px rgba(15,23,42,0.2)" }} />
            <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, letterSpacing: -1, margin: "0 0 16px" }}>
              Satu pintu untuk arsip perencanaan pembangunan daerah.
            </h1>
            <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "rgba(255,255,255,0.85)", margin: 0 }}>
              Kelola dokumen, screening RKA, dan bank data sektor BAPPERIDA Kabupaten Sumba Barat — terstruktur, aman, dan mudah ditemukan kapan saja.
            </p>
            <div style={{ marginTop: 36, paddingLeft: 16, borderLeft: "3px solid rgba(255,255,255,0.35)" }}>
              <p style={{ fontSize: 14.5, fontStyle: "italic", lineHeight: 1.6, margin: "0 0 8px" }}>
                "Sejak pakai sistem ini, pencarian dokumen perencanaan yang dulu butuh berjam-jam sekarang cukup beberapa detik."
              </p>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.75)", margin: 0 }}>
                — Staf Perencanaan, BAPPERIDA Sumba Barat
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes adSpin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
