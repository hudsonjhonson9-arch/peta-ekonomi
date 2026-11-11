import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./ui.jsx";
import { ROLE_COLOR, navGroupsUntuk, grupTerbukaAwal, isOpdBapperidaFrontend } from "../data.js";
import { Badge } from "./ui.jsx";
import { ThemeContext } from "../App.jsx";

// Status lipatan tiap kelompok disimpan supaya pilihan user bertahan setelah
// refresh. Yang tersimpan hanya kelompok yang benar-benar diubah user.
const KUNCI_GRUP = "sidebarGrupTerbuka";

// Di bawah lebar ini teks label tidak muat lagi, jadi tampilan berubah jadi
// mode ikon (sama seperti sidebar dilipat) walau lebarnya bukan 60px persis.
export const LEBAR_ICON = 120;

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

const KUNCI_SUB = "sidebarSubmenuTerbuka";

function muatSubBuka() {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI_SUB) || "null");
    return v && typeof v === "object" && !Array.isArray(v) ? v : { bankdata: true, spm: true, "kertas-kerja": true, "master-satudata": true, "kelola-konten": true, monitoring: true };
  } catch {
    return { bankdata: true, spm: true, "kertas-kerja": true, "master-satudata": true, "kelola-konten": true, monitoring: true };
  }
}

function simpanSubBuka(v) {
  try { localStorage.setItem(KUNCI_SUB, JSON.stringify(v)); } catch (_) {}
}

function simpanGrupTerbuka(v) {
  try { localStorage.setItem(KUNCI_GRUP, JSON.stringify(v)); } catch { /* kuota penuh */ }
}

function RecentActivity({ logs = [] }) {
  const { T } = useContext(ThemeContext);
  // Default disembunyikan (hide) sesuai permintaan pengguna
  const [buka, setBuka] = useState(false);
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
    <div style={{ padding: "4px 8px 0" }}>
      <button
        onClick={() => setBuka(v => !v)}
        aria-expanded={buka}
        title={buka ? "Sembunyikan Aktivitas" : "Tampilkan Aktivitas"}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 10px",
          background: "none", border: "none", cursor: "pointer",
          fontSize: 11.5, fontWeight: 600, color: T.textMuted,
          fontFamily: "inherit",
        }}
      >
        <span>Aktivitas</span>
        <Icon name={buka ? "chevronDown" : "chevronRight"} size={12} />
      </button>
      {buka && (
        <div style={{ marginTop: 2, paddingBottom: 4 }}>
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
      )}
    </div>
  );
}

export default function Sidebar({ active, activeTab, onNav, user, onLogout, onCiutkan, lebar = 220, onLebar, mobileOpen, logs }) {
  const isBapperida = isOpdBapperidaFrontend(user);
  const isItemActive = (key) => {
    if (active === key) return true;
    if (active === "dashboard") {
      return isBapperida ? key === "dashboard-arsip" : key === "dashboard-satudata";
    }
    return false;
  };
  const { T, theme, setTheme } = useContext(ThemeContext);
  const isMobileOv = mobileOpen !== undefined;
  // Pegangan lebar di tepi kanan: seret untuk mengubah lebar, klik ganda
  // untuk mengembalikan ke 220px. `seretRef` menyimpan posisi awal pointer
  // agar lebar dihitung dari titik mulai seret, bukan dari perubahan tiap event.
  const [seret, setSeret] = useState(false);
  const [pegang, setPegang] = useState(false);
  const seretRef = useRef(null);
  useEffect(() => () => { document.body.style.userSelect = ""; }, []);

  // Mode ikon: lebar sidebar melewati batas teks (termasuk saat tombol
  // "Ciutkan" menyetelnya ke 60px) — satu pintu untuk semua tampilan kecil.
  const modeIcon = lebar <= LEBAR_ICON;
  // useMemo dipakai karena daftar ini jadi dependensi effect di bawah; tanpa
  // itu referensinya baru tiap render dan effect berjalan terus.
  const allowedMenusKey = Array.isArray(user.allowed_menus) ? user.allowed_menus.join(",") : "";
  const groups = useMemo(
    () => navGroupsUntuk(user.role, user.allowed_menus, user),
    [user.role, allowedMenusKey, user?.opd_id, user?.is_bapperida]
  );
  const [grupBuka, setGrupBuka] = useState(() => grupTerbukaAwal(muatGrupTerbuka()));
  const [subBuka, setSubBuka] = useState(muatSubBuka);

  // Jika active berubah ke halaman yang punya submenu, buka otomatis submenunya
  useEffect(() => {
    if (active) {
      setSubBuka(prev => {
        if (prev[active]) return prev;
        const next = { ...prev, [active]: true };
        simpanSubBuka(next);
        return next;
      });
    }
  }, [active]);

  const toggleSub = (itemKey) => {
    setSubBuka(prev => {
      const next = { ...prev, [itemKey]: !prev[itemKey] };
      simpanSubBuka(next);
      return next;
    });
  };

  // Halaman aktif selalu terlihat: kelompoknya dibuka otomatis. Tanpa ini,
  // lipatan yang ditutup manual lalu pindah halaman akan membuat item aktif
  // tidak terlihat di sidebar.
  useEffect(() => {
    const grupAktif = groups.find(g => g.items.some(i => isItemActive(i.key)));
    if (!grupAktif || grupBuka[grupAktif.key]) return;
    setGrupBuka(prev => {
      if (prev[grupAktif.key]) return prev;
      const next = { ...prev, [grupAktif.key]: true };
      simpanGrupTerbuka(next);
      return next;
    });
  }, [active, groups, grupBuka, isBapperida]);

  // Petunjuk ada menu di bawah: scrollbar disembunyikan, jadi tanpa ini item
  // paling bawah (mis. Audit Trail) tidak terlihat dan tidak ketahuan ada.
  const navRef = useRef(null);
  const [adaBawah, setAdaBawah] = useState(false);
  const cekScroll = () => {
    const el = navRef.current;
    if (!el) return;
    setAdaBawah(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  };
  useEffect(() => {
    cekScroll();
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(cekScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [groups, grupBuka, subBuka, modeIcon, lebar]);

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

  // Tombol kecil berlatar tonal (tanpa garis) untuk blok footer (tema & keluar).
  const tombolFooter = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    flex: 1, minWidth: 0,
    background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8,
    color: T.textMuted, cursor: "pointer",
    fontSize: 12, fontWeight: 600, padding: "6px 8px", fontFamily: "inherit",
    transition: "background 0.15s, color 0.15s",
  };
  const hoverFooter = {
    onMouseEnter: e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.color = "#fff"; },
    onMouseLeave: e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = T.textMuted; },
  };

  return (
    <div style={{
      width: isMobileOv ? (mobileOpen ? 260 : 0) : lebar,
      height: "100dvh",
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
        padding: modeIcon ? "18px 12px 10px" : "18px 16px 10px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <img
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt="UMA DATA"
          width={36}
          height={36}
          style={{ flexShrink: 0, borderRadius: 10 }}
          onError={(e) => {
            if (!e.target.dataset.fallback) {
              e.target.dataset.fallback = '1';
              e.target.src = '/icon.svg';
            }
          }}
        />
        {!modeIcon && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>UMA DATA</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>Bapperida · Kab. Sumba Barat</div>
          </div>
        )}
      </div>

      {/* Tombol ciutkan/lebarkan — tepat di bawah logo */}
      {onCiutkan && (
        <div style={{
          padding: "8px 8px 0",
          display: "flex", justifyContent: modeIcon ? "center" : "flex-start",
        }}>
          <button
            onClick={onCiutkan}
            title={modeIcon ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            aria-label={modeIcon ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: modeIcon ? undefined : "100%",
              background: "none", border: "none",
              borderRadius: 8, color: T.textMuted,
              cursor: "pointer", fontSize: 12, fontWeight: 600,
              padding: modeIcon ? "6px 7px" : "6px 10px",
              fontFamily: "inherit",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.sidebarHover; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.textMuted; }}
          >
            <Icon name="chevronRight" size={14} style={modeIcon ? undefined : { transform: "rotate(180deg)" }} />
            {!modeIcon && "Ciutkan"}
          </button>
        </div>
      )}

      {/* Nav — kelompok yang bisa dilipat */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" }}>
      <nav ref={navRef} onScroll={cekScroll} className="sidebar-nav" style={{ flex: 1, minHeight: 0, padding: "6px 0 14px", overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {groups.map((g, i) => {
          // Saat sidebar dikecilkan hanya ikon yang muat, jadi semua kelompok
          // dibuka tanpa perlu menampilkan judulnya.
          const buka = modeIcon || !!grupBuka[g.key];
          return (
            <div key={g.key} style={{
              marginBottom: 2,
              // Mode ikon: judul kelompok disembunyikan, jadi kelompok
              // dipisah jarak saja (tanpa garis).
              ...(modeIcon && i > 0 ? { marginTop: 12 } : {}),
            }}>
              {!modeIcon && (
                <button
                  onClick={() => lipat(g)}
                  aria-expanded={buka}
                  title={g.label}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 8,
                    padding: i === 0 ? "6px 18px 4px" : "12px 18px 4px",
                    background: "none", border: "none",
                    cursor: "pointer",
                    color: T.textMuted, textAlign: "left",
                    fontSize: 11.5, fontWeight: 600, letterSpacing: 0.1,
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
                const isActive = isItemActive(n.key);
                const hasChildren = Array.isArray(n.children) && n.children.length > 0;
                const isSubOpen = !modeIcon && hasChildren && !!subBuka[n.key];

                if (hasChildren && !modeIcon) {
                  return (
                    <div key={n.key} style={{ marginBottom: 2 }}>
                      {/* Baris Menu Induk (Parent) */}
                      <div
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.sidebarHover; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          margin: "1px 8px",
                          borderRadius: 8,
                          background: isActive ? `${T.primary}26` : "transparent",
                          transition: "background 0.15s ease",
                        }}>
                        <button
                          onClick={() => {
                            if (!isSubOpen) {
                              setSubBuka(prev => {
                                const next = { ...prev, [n.key]: true };
                                simpanSubBuka(next);
                                return next;
                              });
                            }
                            const targetTab = (isActive && activeTab) ? activeTab : (n.children[0]?.tab || null);
                            onNav(n.key, targetTab);
                          }}
                          title={n.label}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "7px 6px 7px 10px",
                            background: "none",
                            border: "none",
                            color: isActive ? T.sidebarTextActive : T.sidebarText,
                            cursor: "pointer",
                            fontSize: 12.8,
                            fontWeight: isActive ? 600 : 400,
                            textAlign: "left",
                            fontFamily: "inherit",
                          }}
                        >
                          <Icon
                            name={n.icon}
                            size={17}
                            style={{
                              flexShrink: 0,
                              color: isActive ? T.primary : "inherit",
                            }}
                          />
                          <span style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}>
                            {n.label}
                          </span>
                        </button>

                        {/* Tombol Chevron Expand/Collapse */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSub(n.key);
                          }}
                          aria-expanded={isSubOpen}
                          title={isSubOpen ? `Tutup sub-menu ${n.label}` : `Buka sub-menu ${n.label}`}
                          style={{
                            background: "none",
                            border: "none",
                            padding: "7px 10px 7px 6px",
                            cursor: "pointer",
                            color: isSubOpen ? (isActive ? T.primary : T.sidebarTextActive) : T.textMuted,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Icon
                            name="chevronRight"
                            size={13}
                            style={{
                              transform: isSubOpen ? "rotate(90deg)" : "rotate(0deg)",
                              transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                          />
                        </button>
                      </div>

                      {/* Sub-menu accordion list */}
                      {isSubOpen && (
                        <div style={{
                          position: "relative",
                          marginLeft: 8,
                          marginRight: 8,
                          paddingLeft: 27,
                          marginTop: 2,
                          marginBottom: 4,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}>
                          {n.children.map(child => {
                            const isChildActive = isActive && (
                              activeTab ? activeTab === child.tab : (
                                (localStorage.getItem(`${n.key}_tab`) || n.children[0]?.tab) === child.tab
                              )
                            );
                            return (
                              <button
                                key={child.tab || child.label}
                                onClick={() => onNav(n.key, child.tab)}
                                title={child.label}
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  background: isChildActive ? `${T.primary}26` : "transparent",
                                  border: "none",
                                  color: isChildActive ? (T.sidebarTextActive || "#fff") : (T.textMuted || "rgba(255,255,255,0.7)"),
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: isChildActive ? 600 : 400,
                                  textAlign: "left",
                                  fontFamily: "inherit",
                                  transition: "all 0.12s ease",
                                }}
                                onMouseEnter={e => {
                                  if (!isChildActive) {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                    e.currentTarget.style.color = "#fff";
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (!isChildActive) {
                                    e.currentTarget.style.background = "transparent";
                                    e.currentTarget.style.color = T.textMuted || "rgba(255,255,255,0.7)";
                                  }
                                }}
                              >
                                <span style={{
                                  flex: 1,
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}>
                                  {child.label}
                                </span>
                                {child.badge !== undefined && child.badge > 0 && (
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: 99,
                                    background: "#EF4444",
                                    color: "#fff",
                                  }}>
                                    {child.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <button
                    key={n.key}
                    onClick={() => onNav(n.key)}
                    title={n.label}
                    style={{
                      width: "calc(100% - 16px)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: modeIcon ? "9px 0" : "7px 10px",
                      margin: "1px 8px",
                      borderRadius: 8,
                      justifyContent: modeIcon ? "center" : "flex-start",
                      background: isActive ? `${T.primary}26` : "transparent",
                      border: "none",
                      color: isActive ? T.sidebarTextActive : T.sidebarText,
                      cursor: "pointer",
                      fontSize: 12.8,
                      fontWeight: isActive ? 600 : 400,
                      fontFamily: "inherit",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.sidebarHover; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <Icon name={n.icon} size={17} style={{ flexShrink: 0, color: isActive ? T.primary : "inherit" }} />
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
      {/* Pudar di tepi bawah: tanda masih ada menu lain kalau di-scroll */}
      <div aria-hidden="true" style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 40,
        pointerEvents: "none",
        background: `linear-gradient(to top, ${T.sidebarBg}, ${T.sidebarBg}00)`,
        opacity: adaBawah ? 1 : 0,
        transition: "opacity 0.2s",
      }} />
      </div>

      {/* Recent activity (default disembunyikan / di-hide) */}
      {!modeIcon && <RecentActivity logs={logs} />}

      {/* Footer: profil, lalu pintasan tema & keluar sebaris */}
      <div style={{
        margin: "4px 8px 8px",
        padding: modeIcon ? "8px 6px" : "8px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.05)",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {!modeIcon && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{
              width: 30, height: 30, background: T.primary,
              borderRadius: 50, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {user.name[0]}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div title={user.name} style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
              <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 1, textTransform: "capitalize" }}>{user.role}</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: modeIcon ? "column" : "row", gap: 6 }}>
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
            title={theme === "dark" ? "Tema: Gelap" : theme === "light" ? "Tema: Terang" : "Tema: Sistem"}
            style={tombolFooter}
            {...hoverFooter}
          >
            <Icon name={theme === "dark" ? "moon" : theme === "light" ? "sun" : "monitor"} size={15} />
            {!modeIcon && (theme === "dark" ? "Gelap" : theme === "light" ? "Terang" : "Sistem")}
          </button>
          <button
            onClick={onLogout}
            title="Keluar"
            style={tombolFooter}
            {...hoverFooter}
          >
            <Icon name="logout" size={15} />
            {!modeIcon && "Keluar"}
          </button>
        </div>
      </div>

      {/* Pegangan lebar sidebar (hanya desktop, saat tidak dilipat) */}
      {!isMobileOv && onLebar && (
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
