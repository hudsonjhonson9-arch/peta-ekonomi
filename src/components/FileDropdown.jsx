import { useState, useMemo, useRef, useEffect, useContext } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon, formatBytes } from "./ui.jsx";

// Dropdown custom untuk memilih file di dokumen multi-file (folder BAST dsb).
// Fitur: prev/next, kolom cari (jika file > 6), tutup via klik luar / Esc.
export default function FileDropdown({ files, active, onSelect }) {
  const { T } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  const idx = Math.max(0, files.findIndex(f => f.url === active.url));
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? files.filter(f => (f.name || "").toLowerCase().includes(s)) : files;
  }, [files, q]);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = f => { onSelect(f); setOpen(false); setQ(""); };
  const step = d => {
    const n = idx + d;
    if (n >= 0 && n < files.length) onSelect(files[n]);
  };

  const navBtn = disabled => ({
    width: 40, height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 10,
    color: disabled ? T.textMuted : T.primary, cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", gap: 8, zIndex: 20 }}>
      <button onClick={() => step(-1)} disabled={idx === 0} style={navBtn(idx === 0)} title="File sebelumnya">
        <Icon name="chevronRight" size={14} style={{ transform: "rotate(180deg)" }} />
      </button>

      <button
        onClick={() => setOpen(v => !v)}
        style={{
          flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", background: T.card, color: T.text, textAlign: "left",
          border: `1.5px solid ${open ? T.primary : T.border}`, borderRadius: 10,
          boxShadow: open ? T.focusRing : T.shadowSm, cursor: "pointer", fontSize: 13, fontWeight: 600,
        }}
      >
        <Icon name="file" size={15} style={{ color: T.primary, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {active.name}
        </span>
        <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0, fontWeight: 500 }}>
          {idx + 1} / {files.length}
        </span>
        <Icon
          name="chevronRight" size={14}
          style={{ color: T.textMuted, flexShrink: 0, transform: open ? "rotate(-90deg)" : "rotate(90deg)", transition: "transform 0.15s" }}
        />
      </button>

      <button onClick={() => step(1)} disabled={idx === files.length - 1} style={navBtn(idx === files.length - 1)} title="File berikutnya">
        <Icon name="chevronRight" size={14} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 48, right: 48,
          background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 12,
          boxShadow: "0 12px 32px rgba(0,0,0,0.3)", overflow: "hidden",
        }}>
          {files.length > 6 && (
            <div style={{ padding: 8, borderBottom: `1px solid ${T.border}`, position: "relative" }}>
              <Icon name="search" size={13} style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
              <input
                autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama file..."
                style={{
                  width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 32px", fontSize: 13,
                  background: T.bg, color: T.text, border: `1.5px solid ${T.border}`, borderRadius: 8, outline: "none",
                }}
              />
            </div>
          )}
          <div style={{ maxHeight: 320, overflowY: "auto", padding: 6 }}>
            {filtered.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: T.textMuted }}>Tidak ada file cocok</div>
            )}
            {filtered.map(f => {
              const isActive = f.url === active.url;
              return (
                <div
                  key={f.url}
                  onClick={() => pick(f)}
                  title={f.name}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8,
                    cursor: "pointer", fontSize: 13, color: isActive ? T.primary : T.text,
                    fontWeight: isActive ? 600 : 500, background: isActive ? T.primaryLight : "transparent",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.surfaceHover; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <Icon name={isActive ? "check" : "file"} size={14} style={{ flexShrink: 0, color: isActive ? T.primary : T.textMuted }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  {f.size ? <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>{formatBytes(f.size)}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
