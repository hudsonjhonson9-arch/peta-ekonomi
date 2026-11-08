import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react";

/**
 * Komponen Verifikasi Keamanan (Bukan Bot)
 * Menampilkan tantangan visual matematika ringan dan aman dari /api/auth/captcha
 */
const VerifikasiBukanBot = forwardRef(function VerifikasiBukanBot(
  { value = "", onChange, onTokenChange, onKeyDown, error = "" },
  ref
) {
  const [captcha, setCaptcha] = useState({ token: "", svg_base64: "", soal: "" });
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const onTokenChangeRef = useRef(onTokenChange);
  const onChangeRef = useRef(onChange);
  onTokenChangeRef.current = onTokenChange;
  onChangeRef.current = onChange;

  const muatCaptcha = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch("/api/auth/captcha");
      if (!res.ok) throw new Error("Gagal memuat tantangan verifikasi");
      const data = await res.json();
      setCaptcha(data);
      onTokenChangeRef.current?.(data.token);
      onChangeRef.current?.(""); // Reset input jawaban saat captcha berganti
    } catch {
      setFetchError("Gagal memuat verifikasi bukan bot");
    } finally {
      setLoading(false);
    }
  }, []);

  // Expose fungsi reload ke komponen induk (misal saat login gagal)
  useImperativeHandle(ref, () => ({
    reload: muatCaptcha,
  }));

  useEffect(() => {
    muatCaptcha();
  }, [muatCaptcha]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
          <span>Verifikasi Keamanan</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B" }}>(Bukan Bot)</span>
        </label>
        <button
          type="button"
          onClick={muatCaptcha}
          disabled={loading}
          title="Ganti soal verifikasi"
          style={{
            background: "none",
            border: "none",
            padding: "2px 4px",
            fontSize: 11.5,
            color: "#2563EB",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: loading ? "rotate(180deg)" : "none", transition: "transform .3s ease" }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
          </svg>
          <span>Acak</span>
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "120px 1fr",
          gap: 10,
          alignItems: "center",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Gambar SVG Captcha */}
        <div
          style={{
            width: "100%",
            height: 44,
            background: "#F8FAFC",
            borderRadius: 12,
            border: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {loading ? (
            <span style={{ fontSize: 11, color: "#94A3B8" }}>Memuat...</span>
          ) : fetchError ? (
            <span style={{ fontSize: 10, color: "#DC2626", textAlign: "center", padding: 4 }}>Gagal</span>
          ) : captcha.svg_base64 ? (
            <img
              src={captcha.svg_base64}
              alt="Tantangan keamanan"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : null}
        </div>

        {/* Input Hasil Hitungan */}
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Hasil hitungan"
          style={{
            width: "100%",
            height: 44,
            minWidth: 0,
            padding: "11px 13px",
            border: error ? "1.5px solid #DC2626" : "1px solid #E2E8F0",
            borderRadius: 12,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            background: "#fff",
            color: "#0F172A",
            fontVariantNumeric: "tabular-nums",
          }}
        />
      </div>

      {error && (
        <div style={{ fontSize: 11.5, color: "#DC2626", marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
});

export default VerifikasiBukanBot;
