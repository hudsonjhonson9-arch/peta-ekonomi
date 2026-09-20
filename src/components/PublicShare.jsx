import { useState, useEffect, useContext } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon, extractGDriveFileId, formatBytes } from "./ui.jsx";
import useResponsive from "../useResponsive.js";

// Halaman publik (tanpa login) untuk tautan berbagi: #/publik?token=XXXX atau #/publik?verify=XXXX-XXXX
export default function PublicShare({ token, verify }) {
  const { T } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let cancelled = false;
    const url = token
      ? `/api/publik?token=${encodeURIComponent(token)}`
      : `/api/publik/verify?code=${encodeURIComponent(verify)}`;
    fetch(url)
      .then(async r => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Tautan tidak valid atau sudah kedaluwarsa");
        return j;
      })
      .then(data => { if (!cancelled) setState({ loading: false, error: "", data }); })
      .catch(e => { if (!cancelled) setState({ loading: false, error: e.message, data: null }); });
    return () => { cancelled = true; };
  }, [token, verify]);

  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radiusLg, boxShadow: T.shadowSm };
  const { loading, error, data } = state;
  const doc = data?.doc;
  const title = doc?.judul || doc?.title;
  const expires = data?.share?.expires_at;
  const isVerify = !token;

  let files = [];
  if (doc?.files) { try { files = typeof doc.files === "string" ? JSON.parse(doc.files) : doc.files; } catch (_) {} }
  const fileId = doc?.url ? extractGDriveFileId(doc.url) : null;
  const previewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;

  const rows = doc && !isVerify ? [
    ["Jenis Dokumen", doc.kategori],
    ["Sektor", doc.tipe],
    ["Bidang", doc.bidang],
    ["Nomor Dokumen", doc.nomor_dokumen],
    ["Versi", doc.versi > 1 ? `v${doc.versi}` : null],
    ["Ukuran", doc.ukuran],
    ["Halaman", doc.pages ? `${doc.pages} halaman` : null],
  ].filter(([, v]) => v) : [];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font }}>
      <div style={{ background: `linear-gradient(135deg, ${T.sidebarBg}, ${T.primary})`, color: "#fff", padding: isMobile ? "20px 16px" : "26px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700 }}>ARSIP DIGITAL BAPPERIDA</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
            {isVerify ? "Verifikasi Keaslian Dokumen" : "Dokumen yang Dibagikan"} · Kabupaten Sumba Barat
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? 14 : 24 }}>
        {loading && <div style={{ ...card, padding: 32, textAlign: "center", color: T.textSecondary }}>Memuat…</div>}

        {!loading && error && (
          <div style={{ ...card, padding: 32, textAlign: "center", background: T.dangerBg, border: `1px solid ${T.dangerBorder}` }}>
            <Icon name="x" size={28} style={{ color: T.danger }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: T.danger, marginTop: 10 }}>{isVerify ? "Kode tidak valid" : "Tautan tidak dapat dibuka"}</div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 6 }}>{error}</div>
          </div>
        )}

        {!loading && doc && (
          <>
            <div style={{ ...card, padding: isMobile ? 18 : 26, marginBottom: 16 }}>
              {isVerify && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: data.expired ? T.warningBg : T.successBg, color: data.expired ? T.warning : T.success, border: `1px solid ${data.expired ? T.warningBorder : T.successBorder}`, borderRadius: 99, padding: "5px 12px", fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                  <Icon name="check" size={13} /> {data.expired ? "Dokumen asli (tautan sudah kedaluwarsa)" : "Dokumen Terverifikasi"}
                </div>
              )}
              <h1 style={{ fontSize: isMobile ? 19 : 24, fontWeight: 700, color: T.text, margin: 0, lineHeight: 1.3 }}>{title}</h1>
              {doc.desc && <p style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.7, margin: "10px 0 0" }}>{doc.desc}</p>}
              {isVerify && (
                <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 10 }}>
                  Tipe: {doc.file_type || "—"} · Versi: {doc.versi || 1}
                </div>
              )}
              {expires && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 10 }}>
                  Berlaku hingga {new Date(expires).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
              {!isVerify && doc.url && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", background: T.primary, color: "#fff", borderRadius: T.radius, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                    <Icon name="download" size={15} /> Buka / Unduh
                  </a>
                </div>
              )}
            </div>

            {!isVerify && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 16, alignItems: "start" }}>
                <div style={{ ...card, overflow: "hidden", minHeight: 300 }}>
                  {previewUrl ? (
                    <iframe src={previewUrl} title={title} allow="autoplay" style={{ width: "100%", height: isMobile ? 420 : 640, border: "none", display: "block" }} />
                  ) : (
                    <div style={{ padding: 32, textAlign: "center", color: T.textSecondary, fontSize: 13 }}>Pratinjau tidak tersedia. Gunakan tombol Buka / Unduh.</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {rows.length > 0 && (
                    <div style={{ ...card, padding: 18 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Informasi Dokumen</div>
                      {rows.map(([k, v]) => (
                        <div key={k} style={{ padding: "8px 12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius, marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k}</div>
                          <div style={{ fontSize: 13, color: T.text }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {files.length > 0 && (
                    <div style={{ ...card, padding: 18 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 10 }}>File dalam Folder</div>
                      {files.map(f => (
                        <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius, marginBottom: 6, textDecoration: "none" }}>
                          <Icon name="file" size={14} style={{ color: T.primary, flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          <span style={{ fontSize: 11, color: T.textMuted }}>{formatBytes(f.size)}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 28 }}>
          <a href={window.location.pathname} style={{ fontSize: 13, color: T.primary, textDecoration: "none" }}>Buka aplikasi Arsip Digital</a>
        </div>
      </div>
    </div>
  );
}
