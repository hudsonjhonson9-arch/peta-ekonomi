import { useState, useEffect, useContext } from "react";
import QRCode from "qrcode";
import { ThemeContext } from "../App.jsx";
import { Geser, DatePicker, Button } from "./ui.jsx";

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
  const { T: TH } = useContext(ThemeContext);
  const T = { ...TH, shadow: TH.shadowLg };
  const [duration, setDuration] = useState("24h");
  const [customDate, setCustomDate] = useState("");
  const [shares, setShares] = useState([]);
  const [qrImages, setQrImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  // Muat saat dibuka + poll 30 dtk: tautan bisa dibuat/dicabut oleh admin
  // lain selagi dialog terbuka (truth = database).
  useEffect(() => {
    loadShares();
    const t = setInterval(loadShares, 30000);
    return () => clearInterval(t);
  }, []);

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
      await api(`/api/docs/${docId}/shares`, "POST", body);
      await loadShares();
    } catch (e) { alert("Gagal membuat tautan: " + e.message); }
    setLoading(false);
  }

  async function revokeShare(shareId) {
    if (!confirm("Hapus tautan ini?")) return;
    try {
      await api(`/api/docs/${docId}/shares/${shareId}`, "DELETE");
      await loadShares();
    } catch (e) { alert("Gagal menghapus tautan: " + e.message); }
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
    const dataUrl = await QRCode.toDataURL(url, { width: 180, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
    setQrImages(prev => ({ ...prev, [share.id]: { url: dataUrl, verif: verifUrl } }));
  }

  function formatExpiry(date) {
    if (!date) return "Selamanya";
    return new Date(date).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <Geser style={{ background: T.card, borderRadius: 16, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: T.shadow, border: `1px solid ${T.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div data-pegang style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
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
              <Button
                key={d.value}
                size="sm"
                variant={duration === d.value ? "primary" : "outline"}
                onClick={() => setDuration(d.value)}
              >
                {d.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant={duration === "custom" ? "primary" : "outline"}
              onClick={() => setDuration("custom")}
            >
              Kustom
            </Button>
          </div>
          {duration === "custom" && (
            <div style={{ marginTop: 10 }}>
              <DatePicker
                withTime
                value={customDate}
                onChange={setCustomDate}
                placeholder="Pilih tanggal & waktu kedaluwarsa..."
              />
            </div>
          )}
        </div>

        {/* Create button */}
        <Button
          fullWidth
          size="lg"
          variant="primary"
          icon="share"
          loading={loading}
          onClick={createShare}
          disabled={loading}
          style={{ marginBottom: 20 }}
        >
          {loading ? "Membuat..." : "Buat Tautan"}
        </Button>

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
                    <Button size="xs" variant={copied === s.id ? "primary" : "outline"} onClick={() => copyText(link, s.id)}>
                      {copied === s.id ? "Tersalin!" : "Copy"}
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => generateQR(s)}>
                      QR
                    </Button>
                    <Button size="xs" variant="dangerSoft" onClick={() => revokeShare(s.id)}>
                      Hapus
                    </Button>
                  </div>
                  {/* QR Display */}
                  {qrImages[s.id] && (
                    <div style={{ marginTop: 10, textAlign: "center" }}>
                      <img src={qrImages[s.id].url} alt="QR Code" style={{ borderRadius: 8, border: `1px solid ${T.border}`, background: "#fff" }} />
                      <div style={{ marginTop: 6, fontSize: 12, color: T.textSecondary }}>
                        Kode: <strong style={{ color: T.primary }}>{s.verif_code}</strong>
                      </div>
                      <Button size="xs" variant={copied === `code-${s.id}` ? "primary" : "outline"} onClick={() => copyText(s.verif_code, `code-${s.id}`)} style={{ marginTop: 4 }}>
                        {copied === `code-${s.id}` ? "Tersalin!" : "Copy Kode"}
                      </Button>
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
      </Geser>
    </div>
  );
}
