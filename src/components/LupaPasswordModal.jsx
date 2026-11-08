import { useState, useRef } from "react";
import { Icon, Geser } from "./ui.jsx";
import VerifikasiBukanBot from "./VerifikasiBukanBot.jsx";

export default function LupaPasswordModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1); // 1: Cek NIP, 2: Reset Form, 3: Sukses
  const [nip, setNip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoAkun, setInfoAkun] = useState(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaJawaban, setCaptchaJawaban] = useState("");
  const captchaRef = useRef(null);

  const [verifikasiHp, setVerifikasiHp] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPassword, setKonfirmasiPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  if (!isOpen) return null;

  const handleCekNip = async (e) => {
    e.preventDefault();
    if (!nip.trim()) {
      setError("Silakan masukkan NIP Anda");
      return;
    }
    if (!captchaJawaban.trim()) {
      setError("Silakan selesaikan verifikasi keamanan (bukan bot)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/akun/lupa-password/cek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nip: nip.trim(),
          captcha_token: captchaToken,
          captcha_jawaban: captchaJawaban,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (captchaRef.current) captchaRef.current.reload();
        throw new Error(data.error || "Gagal memeriksa NIP");
      }

      setInfoAkun(data);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!passwordBaru) {
      setError("Password baru wajib diisi");
      return;
    }
    if (passwordBaru.length < 6) {
      setError("Password baru minimal 6 karakter");
      return;
    }
    if (passwordBaru !== konfirmasiPassword) {
      setError("Konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/akun/lupa-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nip: infoAkun.nip,
          token_verifikasi: infoAkun.token_verifikasi,
          verifikasi_hp: verifikasiHp,
          password_baru: passwordBaru,
          konfirmasi_password: konfirmasiPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mereset password");
      }

      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setNip("");
    setError("");
    setInfoAkun(null);
    setVerifikasiHp("");
    setPasswordBaru("");
    setKonfirmasiPassword("");
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <Geser
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          overflow: "hidden",
          animation: "scaleIn 0.2s ease-out",
        }}
      >
        {/* Header (Draggable) */}
        <div
          data-pegang
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "grab",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#2563EB",
              }}
            >
              <Icon name="shield" size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A" }}>Pemulihan Akun</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>Reset kata sandi tanpa OTP email</div>
            </div>
          </div>
          <button
            onClick={resetState}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              padding: 4,
            }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "22px" }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 8,
                fontSize: 13,
                color: "#DC2626",
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleCekNip}>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, marginBottom: 16 }}>
                Masukkan NIP terdaftar Anda untuk memulai proses verifikasi identitas dan reset kata sandi.
              </p>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  NIP Pegawai
                </label>
                <input
                  type="text"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  placeholder="Contoh: 198301012010012008"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid #CBD5E1",
                    borderRadius: 10,
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>

              <VerifikasiBukanBot
                ref={captchaRef}
                value={captchaJawaban}
                onChange={setCaptchaJawaban}
                onTokenChange={setCaptchaToken}
              />

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={resetState}
                  style={{
                    padding: "10px 16px",
                    background: "#F1F5F9",
                    color: "#475569",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "10px 18px",
                    background: "#2563EB",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Memeriksa..." : "Lanjut Verifikasi"}
                </button>
              </div>
            </form>
          )}

          {step === 2 && infoAkun && (
            <form onSubmit={handleResetPassword}>
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 16,
                  fontSize: 12.5,
                }}
              >
                <div style={{ fontWeight: 700, color: "#0F172A" }}>{infoAkun.username}</div>
                <div style={{ color: "#64748B" }}>NIP: {infoAkun.nip} • {infoAkun.bidang}</div>
              </div>

              {infoAkun.punya_hp && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Verifikasi 4 Digit Terakhir No. HP ({infoAkun.clue_hp})
                  </label>
                  <input
                    type="text"
                    value={verifikasiHp}
                    onChange={(e) => setVerifikasiHp(e.target.value)}
                    placeholder="4 digit terakhir nomor HP Anda"
                    maxLength={4}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      border: "1px solid #CBD5E1",
                      borderRadius: 8,
                      fontSize: 13.5,
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>
                    Sebagai perlindungan keamanan akun tanpa OTP email.
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Password Baru
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    value={passwordBaru}
                    onChange={(e) => setPasswordBaru(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      paddingRight: 36,
                      border: "1px solid #CBD5E1",
                      borderRadius: 8,
                      fontSize: 13.5,
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#94A3B8",
                      cursor: "pointer",
                    }}
                  >
                    <Icon name={showPass ? "eyeOff" : "eye"} size={16} />
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Konfirmasi Password Baru
                </label>
                <input
                  type={showPass ? "text" : "password"}
                  value={konfirmasiPassword}
                  onChange={(e) => setKonfirmasiPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid #CBD5E1",
                    borderRadius: 8,
                    fontSize: 13.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    padding: "10px 16px",
                    background: "#F1F5F9",
                    color: "#475569",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "10px 18px",
                    background: "#059669",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Menyimpan..." : "Simpan Password Baru"}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#ECFDF5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Icon name="checkCircle" size={28} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A", marginBottom: 6 }}>
                Password Berhasil Diganti
              </div>
              <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5, marginBottom: 20 }}>
                Kata sandi baru Anda telah aktif. Silakan gunakan kata sandi baru untuk masuk ke aplikasi.
              </p>
              <button
                type="button"
                onClick={resetState}
                style={{
                  width: "100%",
                  padding: "11px",
                  background: "#2563EB",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Kembali ke Halaman Login
              </button>
            </div>
          )}
        </div>
      </Geser>
    </div>
  );
}

