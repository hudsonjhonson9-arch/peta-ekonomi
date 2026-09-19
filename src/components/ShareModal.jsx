import { useState, useEffect } from "react";
import QRCode from "qrcode";

const T = {
  bg: "#0f172a", card: "#1e293b", border: "#334155", text: "#f1f5f9",
  textSecondary: "#94a3b8", primary: "#3b82f6", primaryLight: "rgba(59,130,246,0.1)",
  danger: "#ef4444", radius: 12, shadow: "0 4px 24px rgba(0,0,0,0.25)",
};

const btnBase = {
  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
  border: "none", borderRadius: 8, fontWeight: 600, transition: "all 0.15s",
};

const DURATIONS = [
  { label: "1 Jam", value: "1h" },
  { label: "24 Jam", value: "24h" },
  { label: "7 Hari", value: "7d" },
  { label: "30 Hari", value: "30d" },
];

export default function ShareModal({ docId, docTitle, api, onClose }) {
  const [duration, setDuration] = useState("24h");
  const [customDate, setCustomDate] = useState("");
  const [shares, setShares] = useState([]);
  const [qrImages, setQrImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => { loadShares(); }, []);

  async function loadShares() {
    try {
      const data = await api(`/api/docs/${docId}/shares`);
      setShares(data.shares || []);
    } catch (e) { console.error(e); }
  }

  async function createShare() {
    setLoading(true);
    try {
      const body = duration === "custom" && customDate
        ? { expiresIn: "custom", customExpiresAt: new Date(customDate).toISOString() }
        : { expiresIn: duration };
      await api(`/api/docs/${docId}/shares`, { method: "POST", body: JSON.stringify(body) });
      await loadShares();
    } catch (e) { alert("Gagal membuat tautan: " + e.message); }
    setLoading(false);
  }

  async function revokeShare(shareId) {
    if (!confirm("Hapus tautan ini?")) return;
    await api(`/api/docs/${docId}/shares/${shareId}`, { method: "DELETE" });
    await loadShares();
  }

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  async function generateQR(share) {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/#/publik?token=${share.token}`;
    const verifUrl = `${baseUrl}/#/publik?verify=${share.verif_code}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 180, margin: 1, color: { dark: "#f1f5f9", light: "#1e293b" } });
    setQrImages(prev => ({ ...prev, [share.id]: { url: dataUrl, verif: verifUrl } }));
  }

  function formatExpiry(date) {
    if (!date) return "Selamanya";
    return new Date(date).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: T.card, borderRadius: 16, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: T.shadow, border: `1px solid ${T.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Bagikan Dokumen</div>
          <button onClick={onClose} style={{ ...btnBase, background: "transparent", color: T.textSecondary, padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Duration picker */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, marginBottom: 8 }}>Masa Berlaku</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DURATIONS.map(d => (
              <button key={d.value} onClick={() => setDuration(d.value)}
                style={{ ...btnBase, padding: "8px 14px", fontSize: 13, background: duration === d.value ? T.primary : T.bg, color: duration === d.value ? "#fff" : T.textSecondary, border: `1.5px solid ${duration === d.value ? T.primary : T.border}` }}>
                {d.label}
              </button>
            ))}
            <button onClick={() => setDuration("custom")}
              style={{ ...btnBase, padding: "8px 14px", fontSize: 13, background: duration === "custom" ? T.primary : T.bg, color: duration === "custom" ? "#fff" : T.textSecondary, border: `1.5px solid ${duration === "custom" ? T.primary : T.border}` }}>
              Kustom
            </button>
          </div>
          {duration === "custom" && (
            <input type="datetime-local" value={customDate} onChange={e => setCustomDate(e.target.value)}
              style={{ marginTop: 8, width: "100%", padding: "8px 12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13 }} />
          )}
        </div>

        {/* Create button */}
        <button onClick={createShare} disabled={loading}
          style={{ ...btnBase, padding: "10px 20px", fontSize: 14, background: T.primary, color: "#fff", width: "100%", justifyContent: "center", marginBottom: 20, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Membuat..." : "Buat Tautan"}
        </button>

        {/* Active shares list */}
        {shares.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textSecondary, marginBottom: 8 }}>Tautan Aktif</div>
            {shares.map(s => {
              const baseUrl = window.location.origin;
              const link = `${baseUrl}/#/publik?token=${s.token}`;
              return (
                <div key={s.id} style={{ background: T.bg, borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, color: T.textSecondary, wordBreak: "break-all", marginBottom: 4 }}>{link}</div>
                  <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>Kadaluarsa: {formatExpiry(s.expires_at)}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => copyText(link, s.id)} style={{ ...btnBase, padding: "6px 10px", fontSize: 12, background: T.card, color: copied === s.id ? T.primary : T.textSecondary, border: `1px solid ${T.border}` }}>
                      {copied === s.id ? "Tersalin!" : "Copy"}
                    </button>
                    <button onClick={() => generateQR(s)} style={{ ...btnBase, padding: "6px 10px", fontSize: 12, background: T.card, color: T.textSecondary, border: `1px solid ${T.border}` }}>
                      QR
                    </button>
                    <button onClick={() => revokeShare(s.id)} style={{ ...btnBase, padding: "6px 10px", fontSize: 12, background: "rgba(239,68,68,0.1)", color: T.danger, border: `1px solid ${T.danger}33` }}>
                      Hapus
                    </button>
                  </div>
                  {/* QR Display */}
                  {qrImages[s.id] && (
                    <div style={{ marginTop: 10, textAlign: "center" }}>
                      <img src={qrImages[s.id].url} alt="QR Code" style={{ borderRadius: 8, border: `1px solid ${T.border}` }} />
                      <div style={{ marginTop: 6, fontSize: 12, color: T.textSecondary }}>
                        Kode: <strong style={{ color: T.primary }}>{s.verif_code}</strong>
                      </div>
                      <button onClick={() => copyText(s.verif_code, `code-${s.id}`)} style={{ ...btnBase, padding: "4px 10px", fontSize: 11, background: T.card, color: copied === `code-${s.id}` ? T.primary : T.textSecondary, border: `1px solid ${T.border}`, marginTop: 4 }}>
                        {copied === `code-${s.id}` ? "Tersalin!" : "Copy Kode"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {shares.length === 0 && (
          <div style={{ textAlign: "center", color: T.textSecondary, fontSize: 13, padding: 20 }}>
            Belum ada tautan aktif
          </div>
        )}
      </div>
    </div>
  );
}
