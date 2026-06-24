import { useState } from "react";
import { Icon } from "./ui.jsx";

export default function LoginPage({ onLogin }) {
  const [nip, setNip] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ nip, password: pass })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setErr(data.error || "Login gagal");
      } else {
        onLogin(data.user);
      }
    } catch (e) {
      setErr("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      background: "linear-gradient(135deg, #1a3a2a 0%, #0d5c2e 50%, #1a4a3a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "40px 36px",
        width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56,
            background: "linear-gradient(135deg, #1a7a4a, #0d5c2e)",
            borderRadius: 14, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 14px",
          }}>
            <Icon name="archive" size={26} style={{ color: "#fff" }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1a3a2a", letterSpacing: -0.3 }}>PETA EKONOMI</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Pusat Dokumen Digital Perencanaan Bidang Ekonomi
          </div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
            BAPPERIDA Kabupaten Sumba Barat
          </div>
        </div>

        {/* Form */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
            NIP
          </label>
          <input
            value={nip}
            onChange={e => { setNip(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && handle()}
            placeholder="Masukkan NIP"
            style={{
              width: "100%", padding: "10px 12px",
              border: "1.5px solid #e0e0e0", borderRadius: 8,
              fontSize: 13, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
            Password
          </label>
          <input
            type="password"
            value={pass}
            onChange={e => { setPass(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && handle()}
            placeholder="••••••••"
            style={{
              width: "100%", padding: "10px 12px",
              border: "1.5px solid #e0e0e0", borderRadius: 8,
              fontSize: 13, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {err && (
          <div style={{ fontSize: 12, color: "#c62828", marginBottom: 12, textAlign: "center" }}>{err}</div>
        )}

        <button
          onClick={handle}
          disabled={loading}
          style={{
            width: "100%", padding: "12px",
            background: loading ? "#999" : "linear-gradient(135deg, #1a7a4a, #0d5c2e)",
            color: "#fff", border: "none", borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </div>
    </div>
  );
}
