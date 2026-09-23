import { useState, useContext } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon } from "./ui.jsx";

const MAIN = [
  { key: "dashboard", label: "Dashboard", icon: "home" },
  { key: "dokumen",   label: "Dokumen",   icon: "archive" },
  { key: "upload",    label: "Upload",    icon: "upload" },
  { key: "pencarian", label: "Cari",      icon: "search" },
];

const MORE = [
  { key: "publik",            label: "Portal Publik",   icon: "world" },
  { key: "panduan",           label: "Panduan",         icon: "file" },
  { key: "bankdata",          label: "Bank Data",       icon: "chart"  },
  { key: "pengguna",          label: "Pengguna",        icon: "users",  adminOnly: true },
  { key: "kategori-dokumen",  label: "Jenis Dokumen",    icon: "tag",    adminOnly: true },
  { key: "sektor",            label: "Sektor",          icon: "layers", adminOnly: true },
  { key: "audit",             label: "Audit Trail",     icon: "history", adminOnly: true },
];

export default function BottomNav({ active, onNav, user }) {
  const { T, theme, setTheme } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  const moreItems = MORE.filter(n => !n.adminOnly || user.role === "Admin");
  const isMoreActive = moreItems.some(n => n.key === active);

  const themeIcon = theme === "system" ? "monitor" : theme === "dark" ? "moon" : "sun";
  const themeLabel = theme === "system" ? "Sistem" : theme === "dark" ? "Gelap" : "Terang";
  const cycleTheme = () => {
    const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
  };

  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200 }}>
      {/* More menu */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
          <div style={{
            position: "absolute", bottom: 56, right: 8, left: 8,
            background: T.bottomNavBg, borderRadius: 12, boxShadow: T.shadowMd,
            border: `1px solid ${T.border}`, padding: "6px 0", zIndex: 201,
            maxHeight: 300, overflowY: "auto",
          }}>
            {moreItems.map(n => (
              <button
                key={n.key}
                onClick={() => { onNav(n.key); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 16px", background: "none", border: "none",
                  cursor: "pointer", fontSize: 13, color: active === n.key ? T.primary : T.text,
                  fontWeight: active === n.key ? 600 : 400,
                }}
              >
                <Icon name={n.icon} size={16} />
                {n.label}
              </button>
            ))}
            <div style={{ height: 1, background: T.border, margin: "4px 0" }} />
            <button
              onClick={cycleTheme}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "11px 16px", background: "none", border: "none",
                cursor: "pointer", fontSize: 13, color: T.text,
              }}
            >
              <Icon name={themeIcon} size={16} />
              Mode: {themeLabel}
            </button>
          </div>
        </>
      )}

      {/* Bottom bar */}
      <div style={{
        background: T.bottomNavBg, borderTop: `1px solid ${T.bottomNavBorder}`,
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}>
        {MAIN.map(n => {
          const isActive = active === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onNav(n.key)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 2,
                padding: "6px 0 4px",
                background: "none", border: "none",
                cursor: "pointer",
                color: isActive ? T.primary : T.textMuted,
                fontSize: 10, fontWeight: isActive ? 700 : 500,
                minHeight: 48,
              }}
            >
              <Icon name={n.icon} size={20} />
              <span>{n.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", gap: 2,
            padding: "6px 0 4px",
            background: "none", border: "none",
            cursor: "pointer",
            color: isMoreActive || open ? T.primary : T.textMuted,
            fontSize: 10, fontWeight: isMoreActive ? 700 : 500,
            minHeight: 48,
          }}
        >
          <Icon name="menu" size={20} />
          <span>Lainnya</span>
        </button>
      </div>
    </nav>
  );
}
