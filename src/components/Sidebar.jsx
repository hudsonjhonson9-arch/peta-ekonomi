import { Icon } from "./ui.jsx";
import { ROLE_COLOR } from "../data.js";
import { Badge } from "./ui.jsx";

const NAV = [
  { key: "dashboard", label: "Dashboard",       icon: "home"    },
  { key: "dokumen",   label: "Dokumen",          icon: "archive" },
  { key: "upload",    label: "Upload Dokumen",   icon: "upload"  },
  { key: "pencarian", label: "Pencarian",        icon: "search"  },
  { key: "publik",    label: "Portal Publik",    icon: "world"   },
  { key: "pengguna",  label: "Pengguna",         icon: "users",  adminOnly: true },
  { key: "kategori-dokumen", label: "Tipe Dokumen", icon: "tag",   adminOnly: true },
  { key: "audit",     label: "Audit Trail",      icon: "history", adminOnly: true },
];

export default function Sidebar({ active, onNav, user, onLogout, collapsed }) {
  return (
    <div style={{
      width: collapsed ? 60 : 220,
      minHeight: "100vh",
      background: "#0d2b1a",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.2s",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? "18px 12px" : "18px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, background: "#1a7a4a", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon name="archive" size={18} style={{ color: "#fff" }} />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>PETA EKONOMI</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>BAPPERIDA Sumba Barat</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 0" }}>
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
                background: isActive ? "rgba(255,255,255,0.12)" : "none",
                border: "none",
                borderLeft: isActive ? "3px solid #4caf50" : "3px solid transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
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

      {/* User info + logout */}
      <div style={{
        padding: collapsed ? "12px 0" : "12px 16px",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, background: "#1a7a4a",
              borderRadius: 50, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {user.name[0]}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{user.role}</div>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          title={collapsed ? "Keluar" : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none",
            color: "rgba(255,255,255,0.5)",
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
