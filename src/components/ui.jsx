export function Badge({ label, colors }) {
  return (
    <span style={{
      background: colors.bg,
      color: colors.text,
      fontSize: 11,
      fontWeight: 600,
      padding: "3px 9px",
      borderRadius: 99,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

const PATHS = {
  home:         "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  archive:      "M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
  search:       "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35",
  upload:       "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  users:        "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  chart:        "M18 20V10 M12 20V4 M6 20v-6",
  history:      "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  file:         "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  download:     "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  check:        "M20 6L9 17l-5-5",
  x:            "M18 6L6 18 M6 6l12 12",
  eye:          "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
  chevronRight: "M9 18l6-6-6-6",
  plus:         "M12 5v14 M5 12h14",
  menu:         "M3 12h18 M3 6h18 M3 18h18",
  bell:         "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  tag:          "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01",
  world:        "M12 2a10 10 0 100 20A10 10 0 0012 2z M2 12h20 M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z",
  logout:       "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  edit:         "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  filter:       "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  layers:       "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
  link:         "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  "external-link": "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3",
  folder:  "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  grid:   "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  list:   "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  building: "M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16",
  trash:     "M3 6h18 M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  calendar: "M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01",
};

// ── Google Drive Embed ─────────────────────────────────────────────────────
export function extractGDriveFileId(url) {
  if (!url) return null;
  // https://drive.google.com/file/d/FILE_ID/view?...
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // https://drive.google.com/open?id=FILE_ID
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // https://drive.google.com/uc?export=view&id=FILE_ID
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

export function extractGDriveFolderId(url) {
  if (!url) return null;
  const m = url.match(/\/folders\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export function isGDriveUrl(url) {
  return url && /drive\.google\.com/.test(url);
}

// ponytail: build a direct-download URL for Google Docs viewer
export function gdriveDirectUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// ── File-type + universal preview helpers ──────────────────────────────────
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
const OFFICE_EXT = /\.(docx?|xlsx?|pptx?)$/i;
const PDF_EXT = /\.pdf$/i;

export function isImageFile(url, title = "") {
  return IMAGE_EXT.test(title) || (url && IMAGE_EXT.test(url));
}

export function isOfficeFile(url, title = "") {
  return OFFICE_EXT.test(title) || (url && OFFICE_EXT.test(url));
}

export function isPdfFile(url, title = "") {
  return PDF_EXT.test(title) || (url && PDF_EXT.test(url));
}

// Returns an iframe-embeddable preview URL for ANY file, or null if the
// file can't be previewed inline (e.g. no URL at all).
// - Google Drive files/folders: uses Drive's own /preview or folder view
//   (this already natively renders PDF, DOCX, XLSX, PPTX, and images).
// - Non-Drive files (must be a public URL): routed through Google's public
//   Docs Viewer, which can also render PDF, Office docs, and images.
export function getUniversalPreviewUrl(url) {
  if (!url) return null;
  const folderId = extractGDriveFolderId(url);
  if (folderId) return `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
  const fileId = extractGDriveFileId(url);
  if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
  // Not a Drive link — fall back to Google Docs Viewer for a public URL.
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
}

export function formatBytes(bytes) {
  if (!bytes) return "—";
  return bytes > 1048576
    ? (bytes / 1048576).toFixed(1) + ' MB'
    : (bytes / 1024).toFixed(0) + ' KB';
}

export function GoogleDriveEmbed({ url, title, onClose }) {
  const folderId = extractGDriveFolderId(url);
  const fileId = extractGDriveFileId(url);
  if (!folderId && !fileId) return null;
  const embedUrl = folderId
    ? `https://drive.google.com/embeddedfolderview?id=${folderId}#list`
    : `https://drive.google.com/file/d/${fileId}/preview`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
        justifyContent: "center", zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, width: "90vw", maxWidth: 1100,
          height: "85vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: "1px solid #e8e8e8",
          background: "#F8FAFC", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{ width: 32, height: 32, background: "#E8F5E9", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="eye" size={16} style={{ color: "#2e7d32" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title || "Preview Dokumen"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "7px 14px", background: "#fff", color: "#2563EB",
                border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 12,
                fontWeight: 600, cursor: "pointer", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <Icon name="eye" size={12} /> Buka di Tab Baru
            </a>
            <button
              onClick={onClose}
              style={{
                padding: "7px 14px", background: "#fff", color: "#475569",
                border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12,
                fontWeight: 600, cursor: "pointer", display: "flex",
                alignItems: "center", gap: 5,
              }}
            >
              <Icon name="x" size={12} /> Tutup
            </button>
          </div>
        </div>

        {/* Iframe */}
        <iframe
          src={embedUrl}
          title={title}
          style={{ flex: 1, width: "100%", border: "none" }}
          allow="autoplay"
        />
      </div>
    </div>
  );
}

export function Icon({ name, size = 16, style = {} }) {
  const d = PATHS[name] || "";
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={style}
    >
      {d.split(" M").map((seg, i) => (
        <path key={i} d={i === 0 ? seg : "M" + seg} />
      ))}
    </svg>
  );
}

export function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      background: "#1b5e20", color: "#fff",
      padding: "12px 20px", borderRadius: 10,
      fontSize: 13, fontWeight: 500, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      animation: "fadeIn .2s ease",
    }}>
      <Icon name="check" size={15} /> {msg}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8, padding: 0 }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
