import { useState, useContext } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon } from "./ui.jsx";
import { navGroupsUntuk, NAV_UTAMA_BOTTOM, NAV_BOTTOM_LABEL, NAV_BOTTOM_ICON } from "../data.js";

export default function BottomNav({ active, onNav, user }) {
  const { T, theme, setTheme } = useContext(ThemeContext);
  const [open, setOpen] = useState(false);
  // Sheet "Lainnya" memakai kelompok yang sama dengan Sidebar, jadi nama dan
  // urutannya tidak bisa berbeda antara desktop dan mobile.
  const groups = navGroupsUntuk(user.role);
  const moreGroups = groups
    .map(g => ({ ...g, items: g.items.filter(i => !NAV_UTAMA_BOTTOM.includes(i.key)) }))
    .filter(g => g.items.length > 0);
  const isMoreActive = moreGroups.some(g => g.items.some(i => i.key === active));

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
            maxHeight: "60vh", overflowY: "auto",
          }}>
            {moreGroups.map(g => (
              <div key={g.key}>
                <div style={{
                  padding: "8px 16px 3px", fontSize: 10, fontWeight: 700,
                  color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.7,
                }}>
                  {g.label}
                </div>
                {g.items.map(n => (
                  <button
                    key={n.key}
                    onClick={() => { onNav(n.key); setOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 16px", background: "none", border: "none",
                      cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                      color: active === n.key ? T.primary : T.text,
                      fontWeight: active === n.key ? 600 : 400,
                    }}
                  >
                    <Icon name={n.icon} size={16} />
                    {n.label}
                  </button>
                ))}
              </div>
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
        {NAV_UTAMA_BOTTOM.map(key => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onNav(key)}
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
              <Icon name={NAV_BOTTOM_ICON[key]} size={20} />
              <span>{NAV_BOTTOM_LABEL[key]}</span>
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
