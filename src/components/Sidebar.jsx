import { useContext } from "react";
import { Icon } from "./ui.jsx";
import { ROLE_COLOR } from "../data.js";
import { Badge } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";

const NAV = [
  { key: "dashboard", label: "Dashboard",       icon: "home"    },
  { key: "dokumen",   label: "Dokumen",          icon: "archive" },
  { key: "upload",    label: "Upload Dokumen",   icon: "upload"  },
  { key: "pencarian", label: "Pencarian",        icon: "search"  },
  { key: "publik",    label: "Portal Publik",    icon: "world"   },
  { key: "panduan",   label: "Panduan",          icon: "file"    },
  { key: "bankdata",  label: "Bank Data",        icon: "chart"  },
  { key: "pengguna",  label: "Pengguna",         icon: "users",  adminOnly: true },
  { key: "kategori-dokumen", label: "Jenis Dokumen", icon: "tag",   adminOnly: true },
  { key: "sektor",         label: "Sektor",        icon: "layers", adminOnly: true },
  { key: "audit",     label: "Audit Trail",      icon: "history", adminOnly: true },
];

function RecentActivity({ logs = [] }) {
  const { T } = useContext(ThemeContext);
  const recent = logs.slice(0, 5);
  if (recent.length === 0) return null;

  const actionIcon = (action) => {
    if (action?.includes("upload")) return "upload";
    if (action?.includes("Arsip") || action?.includes("arsip")) return "archive";
    if (action?.includes("Hapus") || action?.includes("hapus") || action?.includes("delete")) return "trash";
    if (action?.includes("Approve") || action?.includes("approve")) return "check";
    return "edit";
  };

  const timeAgo = (t) => {
    const d = Date.now() - new Date(t).getTime();
    const mins = Math.floor(d / 60000);
    if (mins < 1) return "baru";
    if (mins < 60) return mins + "m";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "j";
    return Math.floor(hrs / 24) + "h";
  };

  return (
    <div style={{ padding: "8px 12px 4px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Aktivitas
      </div>
      {recent.map((log) => (
        <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "4px 6px", borderRadius: 5 }}>
          <Icon name={actionIcon(log.action)} size={12} style={{ color: T.textMuted, marginTop: 2, flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, color: T.sidebarText, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 600 }}>{log.user || log.user_name}</span>{" "}
              <span style={{ color: T.textMuted }}>{log.action}</span>{" "}
              <span style={{ fontWeight: 500 }}>{log.doc || log.doc_title}</span>
            </div>
            <div style={{ fontSize: 9, color: T.textMuted, marginTop: 1 }}>{timeAgo(log.time || log.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({ active, onNav, user, onLogout, collapsed, mobileOpen, logs }) {
  const { T, theme, setTheme } = useContext(ThemeContext);
  const isMobileOv = mobileOpen !== undefined;

  return (
    <div style={{
      width: isMobileOv ? (mobileOpen ? 260 : 0) : (collapsed ? 60 : 220),
      height: "100vh",
      background: T.sidebarBg,
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.2s, transform 0.25s",
      flexShrink: 0,
      overflow: "hidden",
      position: "sticky",
      top: 0,
      ...(isMobileOv ? {
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 210,
        transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        paddingBottom: 64,
      } : {}),
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? "18px 12px" : "18px 16px",
        borderBottom: "1px solid " + T.border,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, background: T.primary, borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon name="archive" size={18} style={{ color: "#fff" }} />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>ARSIP DIGITAL BAPPERIDA</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>BAPPERIDA Sumba Barat</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
        {NAV.filter(n => !n.adminOnly || user.role === "Admin").map(n => {
          const isActive = active === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onNav(n.key)}
              title={collapsed ? n.label : undefined}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "11px 0" : "11px 16px",
                justifyContent: collapsed ? "center" : "flex-start",
                background: isActive ? T.sidebarHover : "none",
                border: "none",
                borderLeft: isActive ? "3px solid " + T.primary : "3px solid transparent",
                color: isActive ? T.sidebarTextActive : T.sidebarText,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              <Icon name={n.icon} size={17} />
              {!collapsed && n.label}
            </button>
          );
        })}
      </nav>

      {/* Recent activity */}
      {!collapsed && <RecentActivity logs={logs} />}

      {/* Theme toggle */}
      <div style={{ padding: collapsed ? "4px 0" : "4px 16px", borderTop: "1px solid " + T.border }}>
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
          title={collapsed ? (theme === "dark" ? "Gelap" : theme === "light" ? "Terang" : "Sistem") : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none",
            color: T.textMuted, cursor: "pointer", fontSize: 13,
            padding: "8px 0", width: "100%",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <Icon name={theme === "dark" ? "moon" : theme === "light" ? "sun" : "monitor"} size={16} />
          {!collapsed && (theme === "dark" ? "Gelap" : theme === "light" ? "Terang" : "Sistem")}
        </button>
      </div>

      {/* User info + logout */}
      <div style={{
        padding: collapsed ? "12px 0" : "12px 16px",
        borderTop: "1px solid " + T.border,
      }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, background: T.primary,
              borderRadius: 50, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {user.name[0]}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>{user.role}</div>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          title={collapsed ? "Keluar" : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none",
            color: T.textMuted,
            cursor: "pointer", fontSize: 12,
            padding: collapsed ? "4px 0" : "4px 0",
            width: "100%",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <Icon name="logout" size={15} />
          {!collapsed && "Keluar"}
        </button>
      </div>
    </div>
  );
}
