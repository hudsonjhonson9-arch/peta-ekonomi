import { useState, useRef, useEffect } from "react";
import { Icon } from "./ui.jsx";
import { useNotifications, api } from "../hooks.js";
import { queryClient } from "../main.jsx";

const TYPE_ICON = { info: "bell", success: "check", warning: "x" };
const TYPE_COLOR = { info: "#2563EB", success: "#059669", warning: "#DC2626" };

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  const days = Math.floor(hrs / 24);
  return `${days}h lalu`;
}

export default function NotificationDropdown({ userId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { data: notifs = [] } = useNotifications(userId);
  const unread = notifs.filter(n => !n.is_read).length;

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markRead = async (id) => {
    await api(`/api/notifications/${id}/read`, "PATCH");
    queryClient.invalidateQueries(["notifications", userId]);
  };

  const markAllRead = async () => {
    await api("/api/notifications/read-all", "POST", { user_id: userId });
    queryClient.invalidateQueries(["notifications", userId]);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, display: "flex", alignItems: "center" }}
      >
        <Icon name="bell" size={18} style={{ color: "#666" }} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 0,
            width: 16, height: 16, background: "#c62828", borderRadius: "50%",
            fontSize: 9, color: "#fff", display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 700,
          }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 340, maxHeight: 400, background: "#fff", borderRadius: 12,
          boxShadow: "0 10px 40px rgba(0,0,0,0.15)", border: "1px solid #E2E8F0",
          overflow: "hidden", zIndex: 999,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #F1F5F9" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>Notifikasi</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: "none", border: "none", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                Belum ada notifikasi
              </div>
            ) : notifs.map(n => (
              <div
                key={n.id}
                onClick={() => { if (!n.is_read) markRead(n.id); }}
                style={{
                  display: "flex", gap: 10, padding: "10px 16px",
                  background: n.is_read ? "#fff" : "#F8FAFC",
                  cursor: "pointer", borderBottom: "1px solid #F8FAFC",
                  transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: TYPE_COLOR[n.type] + "15", display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon name={TYPE_ICON[n.type] || "bell"} size={14} style={{ color: TYPE_COLOR[n.type] || "#2563EB" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: "#0F172A", marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                </div>
                {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB", flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
