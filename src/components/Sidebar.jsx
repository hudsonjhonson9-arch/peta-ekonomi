import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./ui.jsx";
import { ROLE_COLOR, navGroupsUntuk, grupTerbukaAwal } from "../data.js";
import { Badge } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";

// Status lipatan tiap kelompok disimpan supaya pilihan user bertahan setelah
// refresh. Yang tersimpan hanya kelompok yang benar-benar diubah user.
const KUNCI_GRUP = "sidebarGrupTerbuka";

// Di bawah lebar ini teks label tidak muat lagi, jadi tampilan berubah jadi
// mode ikon (sama seperti sidebar dilipat) walau lebarnya bukan 60px persis.
const LEBAR_ICON = 120;

function muatGrupTerbuka() {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI_GRUP) || "null");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    // Catch wajib mengembalikan objek juga. Kembali tanpa nilai membuat
    // state-nya undefined dan satu galat baca di sidebar menggagalkan seluruh
    // render, termasuk saat storage diblokir browser.
    return {};
  }
}

function simpanGrupTerbuka(v) {
  try { localStorage.setItem(KUNCI_GRUP, JSON.stringify(v)); } catch { /* kuota penuh */ }
}

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

export default function Sidebar({ active, onNav, user, onLogout, collapsed, onCiutkan, lebar = 220, onLebar, mobileOpen, logs }) {
  const { T, theme, setTheme } = useContext(ThemeContext);
  const isMobileOv = mobileOpen !== undefined;
  // Pegangan lebar di tepi kanan: seret untuk mengubah lebar, klik ganda
  // untuk mengembalikan ke 220px. `seretRef` menyimpan posisi awal pointer
  // agar lebar dihitung dari titik mulai seret, bukan dari perubahan tiap event.
  const [seret, setSeret] = useState(false);
  const [pegang, setPegang] = useState(false);
  const seretRef = useRef(null);
  useEffect(() => () => { document.body.style.userSelect = ""; }, []);

  // Mode ikon: sidebar dilipat lewat tombol, atau diseret sampai teks tak muat.
  const modeIcon = collapsed || lebar <= LEBAR_ICON;
  // useMemo dipakai karena daftar ini jadi dependensi effect di bawah; tanpa
  // itu referensinya baru tiap render dan effect berjalan terus.
  const groups = useMemo(() => navGroupsUntuk(user.role), [user.role]);
  const [grupBuka, setGrupBuka] = useState(() => grupTerbukaAwal(muatGrupTerbuka()));

  // Halaman aktif selalu terlihat: kelompoknya dibuka otomatis. Tanpa ini,
  // lipatan yang ditutup manual lalu pindah halaman akan membuat item aktif
  // tidak terlihat di sidebar.
  useEffect(() => {
    const grupAktif = groups.find(g => g.items.some(i => i.key === active));
    if (!grupAktif || grupBuka[grupAktif.key]) return;
    setGrupBuka(prev => {
      if (prev[grupAktif.key]) return prev;
      const next = { ...prev, [grupAktif.key]: true };
      simpanGrupTerbuka(next);
      return next;
    });
  }, [active, groups, grupBuka]);

  const lipat = g => {
    setGrupBuka(prev => {
      const next = { ...prev, [g.key]: !prev[g.key] };
      simpanGrupTerbuka(next);
      return next;
    });
  };

  const akhiriSeret = () => {
    seretRef.current = null;
    setSeret(false);
    document.body.style.userSelect = "";
  };

  return (
    <div style={{
      width: isMobileOv ? (mobileOpen ? 260 : 0) : (collapsed ? 60 : lebar),
      height: "100vh",
      background: T.sidebarBg,
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      transition: seret ? "none" : "width 0.2s, transform 0.25s",
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
        padding: modeIcon ? "18px 12px" : "18px 16px",
        borderBottom: "1px solid " + T.border,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <img src="/icon.svg" alt="" width={36} height={36} style={{ flexShrink: 0, borderRadius: 10 }} />
        {!modeIcon && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>ARSIP DIGITAL BAPPERIDA</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>Bapperida · Kab. Sumba Barat</div>
          </div>
        )}
      </div>

      {/* Tombol ciutkan/lebarkan — tepat di bawah logo */}
      {onCiutkan && (
        <div style={{
          padding: "7px 12px", borderBottom: "1px solid " + T.border,
          display: "flex", justifyContent: modeIcon ? "center" : "flex-end",
        }}>
          <button
            onClick={onCiutkan}
            title={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "none", border: `1px solid ${T.border}`,
              borderRadius: 7, color: T.textMuted,
              cursor: "pointer", fontSize: 12, fontWeight: 600,
              padding: modeIcon ? "6px 7px" : "6px 10px",
              fontFamily: "inherit",
            }}
          >
            <Icon name="chevronRight" size={14} style={collapsed ? undefined : { transform: "rotate(180deg)" }} />
            {!modeIcon && "Ciutkan"}
          </button>
        </div>
      )}

      {/* Nav — kelompok yang bisa dilipat */}
      <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
        {groups.map((g, i) => {
          // Saat sidebar dikecilkan hanya ikon yang muat, jadi semua kelompok
          // dibuka tanpa perlu menampilkan judulnya.
          const buka = modeIcon || !!grupBuka[g.key];
          return (
            <div key={g.key} style={{
              marginBottom: 2,
              // Mode ikon: judul kelompok disembunyikan, jadi tiap kelompok
              // dipisah garis tipis agar batasnya tetap terlihat.
              ...(modeIcon && i > 0 ? { borderTop: `1px solid ${T.border}`, marginTop: 8, paddingTop: 4 } : {}),
            }}>
              {!modeIcon && (
                <button
                  onClick={() => lipat(g)}
                  aria-expanded={buka}
                  title={g.label}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 16px 5px",
                    background: "none", border: "none",
                    borderLeft: "3px solid transparent",
                    cursor: "pointer",
                    color: T.textMuted, textAlign: "left",
                    fontSize: 10, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 0.7,
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {g.label}
                  </span>
                  <Icon name={buka ? "chevronDown" : "chevronRight"} size={13} />
                </button>
              )}
              {buka && g.items.map(n => {
                const isActive = active === n.key;
                return (
                  <button
                    key={n.key}
                    onClick={() => onNav(n.key)}
                    title={n.label}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: modeIcon ? "11px 0" : "10px 16px",
                      justifyContent: modeIcon ? "center" : "flex-start",
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
                    <Icon name={n.icon} size={17} style={{ flexShrink: 0 }} />
                    {!modeIcon && (
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
                        {n.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Recent activity */}
      {!modeIcon && <RecentActivity logs={logs} />}

      {/* Theme toggle */}
      <div style={{ padding: modeIcon ? "4px 0" : "4px 16px", borderTop: "1px solid " + T.border }}>
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
          title={modeIcon ? (theme === "dark" ? "Gelap" : theme === "light" ? "Terang" : "Sistem") : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none",
            color: T.textMuted, cursor: "pointer", fontSize: 13,
            padding: "8px 0", width: "100%",
            justifyContent: modeIcon ? "center" : "flex-start",
          }}
        >
          <Icon name={theme === "dark" ? "moon" : theme === "light" ? "sun" : "monitor"} size={16} />
          {!modeIcon && (theme === "dark" ? "Gelap" : theme === "light" ? "Terang" : "Sistem")}
        </button>
      </div>

      {/* User info + logout */}
      <div style={{
        padding: modeIcon ? "12px 0" : "12px 16px",
        borderTop: "1px solid " + T.border,
      }}>
        {!modeIcon && (
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
          title={modeIcon ? "Keluar" : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none",
            color: T.textMuted,
            cursor: "pointer", fontSize: 12,
            padding: "4px 0",
            width: "100%",
            justifyContent: modeIcon ? "center" : "flex-start",
          }}
        >
          <Icon name="logout" size={15} />
          {!modeIcon && "Keluar"}
        </button>
      </div>

      {/* Pegangan lebar sidebar (hanya desktop, saat tidak dilipat) */}
      {!isMobileOv && !collapsed && onLebar && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Geser untuk mengubah lebar sidebar"
          title="Geser untuk mengubah lebar · klik ganda untuk atur ulang"
          onPointerDown={e => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            seretRef.current = { x: e.clientX, lebar };
            setSeret(true);
            document.body.style.userSelect = "none";
          }}
          onPointerMove={e => {
            const s = seretRef.current;
            if (!s) return;
            onLebar(Math.round(Math.min(460, Math.max(60, s.lebar + (e.clientX - s.x)))));
          }}
          onPointerUp={akhiriSeret}
          onPointerCancel={akhiriSeret}
          onDoubleClick={() => onLebar(220)}
          onMouseEnter={() => setPegang(true)}
          onMouseLeave={() => setPegang(false)}
          style={{
            position: "absolute", top: 0, bottom: 0, right: 0, width: 10, zIndex: 6,
            cursor: "col-resize", touchAction: "none",
            background: (pegang || seret) ? T.primary + "30" : "transparent",
            transition: "background 0.15s",
          }}
        >
          {/* Pegangan kecil di tengah: penanda bahwa tepinya bisa diseret */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 3, height: 34, borderRadius: 3,
            background: (pegang || seret) ? T.primary : T.border,
            transition: "background 0.15s",
          }} />
        </div>
      )}
    </div>
  );
}
