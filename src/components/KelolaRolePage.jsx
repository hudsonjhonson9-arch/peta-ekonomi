import { useState, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemeContext } from "../App.jsx";
import useResponsive from "../useResponsive.js";
import { Icon, Select, Button, Badge, Geser } from "./ui.jsx";

const PRESET_WARNA = [
  { label: "Ungu",   bg: "#EDE9FE", text: "#7C3AED" },
  { label: "Biru",   bg: "#EFF6FF", text: "#2563EB" },
  { label: "Cyan",   bg: "#ECFEFF", text: "#0E7490" },
  { label: "Hijau",  bg: "#F0FDF4", text: "#16A34A" },
  { label: "Kuning", bg: "#FEFCE8", text: "#CA8A04" },
  { label: "Oranye", bg: "#FFF7ED", text: "#EA580C" },
  { label: "Merah",  bg: "#FEF2F2", text: "#DC2626" },
  { label: "Abu-abu",bg: "#F1F5F9", text: "#475569" },
];

export default function KelolaRolePage({ showToast }) {
  const { T } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();

  const [modalRole, setModalRole] = useState(null); // { mode: 'add' | 'edit', data: {...} }
  const [modalUsers, setModalUsers] = useState(null); // role object with users list
  const [activeTabModal, setActiveTabModal] = useState("profil"); // 'profil' | 'permissions' | 'menus'
  const [busy, setBusy] = useState(false);
  const [selectedNipToAssign, setSelectedNipToAssign] = useState("");

  // Fetch daftar role
  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ["sd-roles"],
    queryFn: () => fetch("/api/roles", { credentials: "same-origin" }).then(r => r.ok ? r.json() : []),
  });

  // Fetch metadata wewenang & menu
  const { data: meta = { modules: [], menus: [] } } = useQuery({
    queryKey: ["sd-roles-meta"],
    queryFn: () => fetch("/api/roles/permissions/meta", { credentials: "same-origin" }).then(r => r.ok ? r.json() : { modules: [], menus: [] }),
  });

  // Fetch semua user untuk opsi penugasan
  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-list"],
    queryFn: () => fetch("/api/users", { credentials: "same-origin" }).then(r => r.ok ? r.json() : []),
  });

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["sd-roles"] });
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const bukaTambahRole = () => {
    setActiveTabModal("profil");
    setModalRole({
      mode: "add",
      data: {
        nama: "",
        deskripsi: "",
        base_level: "Staf",
        opd_scoped: false,
        warna_bg: "#EFF6FF",
        warna_text: "#2563EB",
        allowed_menus: ["dashboard", "dokumen", "pencarian", "publik", "panduan"],
        permissions: ["dashboard.read", "dokumen.read"],
      },
    });
  };

  const bukaEditRole = (role) => {
    setActiveTabModal("profil");
    setModalRole({
      mode: "edit",
      data: {
        ...role,
        allowed_menus: Array.isArray(role.allowed_menus) ? [...role.allowed_menus] : [],
        permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
      },
    });
  };

  const bukaModalUsers = async (role) => {
    try {
      const res = await fetch(`/api/roles/${role.id}`, { credentials: "same-origin" });
      const detail = await res.json();
      setModalUsers(detail);
      setSelectedNipToAssign("");
    } catch (_) {
      showToast?.("Gagal memuat daftar pengguna role ini");
    }
  };

  const simpanRole = async () => {
    const { mode, data } = modalRole;
    if (!data.nama || !data.nama.trim()) {
      showToast?.("Nama role wajib diisi");
      return;
    }
    setBusy(true);
    try {
      const url = mode === "add" ? "/api/roles" : `/api/roles/${data.id}`;
      const method = mode === "add" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menyimpan role");
      showToast?.(out.message || "Role berhasil disimpan");
      setModalRole(null);
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const hapusRole = async (role) => {
    if (!window.confirm(`Hapus role "${role.nama}"? Aksi ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE", credentials: "same-origin" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menghapus role");
      showToast?.(out.message || "Role berhasil dihapus");
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    }
  };

  const assignUserKeRole = async () => {
    if (!selectedNipToAssign || !modalUsers) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/roles/${modalUsers.id}/users`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nip: selectedNipToAssign }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menugaskan pengguna");
      showToast?.(out.message || "Pengguna berhasil ditugaskan");
      bukaModalUsers(modalUsers);
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Helper toggle permission
  const togglePerm = (permKey) => {
    setModalRole(m => {
      const perms = new Set(m.data.permissions || []);
      if (perms.has(permKey)) perms.delete(permKey);
      else perms.add(permKey);
      return { ...m, data: { ...m.data, permissions: Array.from(perms) } };
    });
  };

  // Helper toggle group permissions
  const toggleGroupPerms = (groupPerms, selectAll) => {
    setModalRole(m => {
      const perms = new Set(m.data.permissions || []);
      groupPerms.forEach(p => {
        if (selectAll) perms.add(p.key);
        else perms.delete(p.key);
      });
      return { ...m, data: { ...m.data, permissions: Array.from(perms) } };
    });
  };

  // Helper toggle menu
  const toggleMenu = (menuKey) => {
    setModalRole(m => {
      const menus = new Set(m.data.allowed_menus || []);
      if (menus.has(menuKey)) menus.delete(menuKey);
      else menus.add(menuKey);
      return { ...m, data: { ...m.data, allowed_menus: Array.from(menus) } };
    });
  };

  // Presets
  const terapkanPreset = (jenis) => {
    const allPermKeys = (meta.modules || []).flatMap(m => m.permissions.map(p => p.key));
    const allMenuKeys = (meta.menus || []).map(m => m.key);

    if (jenis === "admin") {
      setModalRole(m => ({
        ...m,
        data: {
          ...m.data,
          base_level: "Admin",
          opd_scoped: false,
          permissions: ["*", ...allPermKeys],
          allowed_menus: allMenuKeys,
        },
      }));
    } else if (jenis === "walidata") {
      const walidataPerms = allPermKeys.filter(k =>
        k.startsWith("bankdata.") || k.startsWith("spm.") || k.startsWith("master_") || k.startsWith("konten.") || k.startsWith("monitoring.") || k.startsWith("dokumen.read")
      );
      const walidataMenus = ["dashboard", "dokumen", "pencarian", "publik", "bankdata", "spm", "master-satudata", "kelola-konten", "monitoring", "panduan"];
      setModalRole(m => ({
        ...m,
        data: {
          ...m.data,
          base_level: "Admin",
          opd_scoped: false,
          permissions: walidataPerms,
          allowed_menus: walidataMenus,
        },
      }));
    } else if (jenis === "produsen") {
      const produsenPerms = ["dashboard.read", "bankdata.read", "bankdata.create", "bankdata.update", "bankdata.export", "reopen.create", "spm.read"];
      const produsenMenus = ["dashboard", "bankdata", "spm", "publik", "panduan"];
      setModalRole(m => ({
        ...m,
        data: {
          ...m.data,
          base_level: "Operator Bank Data",
          opd_scoped: true,
          permissions: produsenPerms,
          allowed_menus: produsenMenus,
        },
      }));
    } else if (jenis === "staf") {
      const stafPerms = ["dashboard.read", "dokumen.read", "dokumen.create", "kertas_kerja.read", "kertas_kerja.create", "bankdata.read", "spm.read"];
      const stafMenus = ["dashboard", "dokumen", "upload", "pencarian", "kertas-kerja", "screening", "bankdata", "spm", "panduan"];
      setModalRole(m => ({
        ...m,
        data: {
          ...m.data,
          base_level: "Staf",
          opd_scoped: false,
          permissions: stafPerms,
          allowed_menus: stafMenus,
        },
      }));
    }
  };

  const totalUsersMapped = roles.reduce((s, r) => s + (parseInt(r.user_count, 10) || 0), 0);

  const inpStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.inputBg,
    color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  };
  const lblStyle = {
    display: "block", fontSize: 11, fontWeight: 700, color: T.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5,
  };
  const thStyle = {
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5,
    borderBottom: `1px solid ${T.border}`, background: T.bgAlt, whiteSpace: "nowrap",
  };
  const tdStyle = {
    padding: "12px 14px", fontSize: 13, color: T.text,
    borderBottom: `1px solid ${T.border}`, verticalAlign: "middle",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 800, color: T.text }}>
            Kelola Role & Hak Akses
          </h2>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>
            Konfigurasi wewenang fitur, izin modul, dan visibilitas menu sidebar untuk setiap peran pengguna sesuai kebutuhan organisasi
          </div>
        </div>
        <Button size="md" variant="primary" icon="plus" onClick={bukaTambahRole}>
          Tambah Role Baru
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div style={{ background: T.card, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12, color: T.textSecondary }}>Total Peran (Role)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 4 }}>{roles.length}</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Terdaftar di sistem</div>
        </div>
        <div style={{ background: T.card, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12, color: T.textSecondary }}>Role Bawaan Sistem</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#7C3AED", marginTop: 4 }}>
            {roles.filter(r => r.is_locked).length} Role
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Admin inti terkunci</div>
        </div>
        <div style={{ background: T.card, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12, color: T.textSecondary }}>Role Dinamis / Kustom</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#2563EB", marginTop: 4 }}>
            {roles.filter(r => !r.is_locked).length} Role
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Wewenang fleksibel</div>
        </div>
        <div style={{ background: T.card, padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12, color: T.textSecondary }}>Pengguna Terpetakan</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16A34A", marginTop: 4 }}>
            {totalUsersMapped} Akun
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Memiliki peran aktif</div>
        </div>
      </div>

      {/* Tabel Daftar Role */}
      <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Daftar Peran Pengguna & Wewenang</div>
            <div style={{ fontSize: 12, color: T.textSecondary }}>Daftar seluruh role sistem dengan matriks hak akses dan pengguna terdaftar</div>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nama Peran</th>
                <th style={thStyle}>Level Dasar</th>
                <th style={thStyle}>Cakupan OPD</th>
                <th style={thStyle}>Jumlah Pengguna</th>
                <th style={thStyle}>Hak Akses</th>
                <th style={thStyle}>Menu Terbuka</th>
                <th style={thStyle}>Tipe</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loadingRoles ? (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>
                    Memuat daftar peran...
                  </td>
                </tr>
              ) : roles.map(r => {
                const isSuper = (r.permissions || []).includes("*");
                const permCount = isSuper ? "Semua (*)" : `${(r.permissions || []).length} Wewenang`;
                const menuCount = `${(r.allowed_menus || []).length} Menu`;
                return (
                  <tr key={r.id}>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 99,
                          fontSize: 12,
                          fontWeight: 700,
                          background: r.warna_bg || "#EFF6FF",
                          color: r.warna_text || "#2563EB",
                          border: `1px solid ${r.warna_text || "#2563EB"}33`,
                        }}>
                          {r.nama}
                        </span>
                      </div>
                      {r.deskripsi && (
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, maxWidth: 280 }}>
                          {r.deskripsi}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <Badge label={r.base_level} colors={{ bg: T.bgAlt, text: T.textSecondary }} />
                    </td>
                    <td style={tdStyle}>
                      {r.opd_scoped ? (
                        <Badge label="OPD Terbatas" colors={{ bg: "#FEF3C7", text: "#92400E" }} />
                      ) : (
                        <Badge label="Lintas OPD" colors={{ bg: "#E0F2FE", text: "#0369A1" }} />
                      )}
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => bukaModalUsers(r)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontSize: 13, fontWeight: 700, color: T.primary,
                          padding: "3px 6px", borderRadius: 6,
                        }}
                        title="Lihat daftar pengguna dengan role ini"
                      >
                        <Icon name="users" size={14} />
                        {r.user_count} Pengguna
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isSuper ? "#7C3AED" : T.textSecondary }}>
                        {permCount}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, color: T.textSecondary }}>
                        {menuCount}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {r.is_locked ? (
                        <Badge label="Sistem" colors={{ bg: "#EDE9FE", text: "#7C3AED" }} />
                      ) : (
                        <Badge label="Kustom" colors={{ bg: "#F1F5F9", text: "#475569" }} />
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <Button
                          size="xs"
                          variant="ghost"
                          icon="edit"
                          onClick={() => bukaEditRole(r)}
                        >
                          Atur Akses
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          icon="users"
                          onClick={() => bukaModalUsers(r)}
                        >
                          Pengguna
                        </Button>
                        {!r.is_locked && (
                          <Button
                            size="xs"
                            variant="ghost"
                            icon="trash"
                            style={{ color: T.danger }}
                            onClick={() => hapusRole(r)}
                          >
                            Hapus
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Edit / Tambah Role (Draggable) */}
      {modalRole && (
        <div
          onClick={() => !busy && setModalRole(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(4px)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <Geser
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
              width: "100%", maxWidth: 840, maxHeight: "90vh", overflow: "hidden",
              display: "flex", flexDirection: "column", boxShadow: T.shadowLg,
            }}
          >
            {/* Modal Header */}
            <div data-pegang style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "grab", userSelect: "none" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.text }}>
                  {modalRole.mode === "add" ? "Tambah Role Pengguna Baru" : `Atur Role & Wewenang: ${modalRole.data.nama}`}
                </h3>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                  Sesuaikan informasi dasar, matriks hak akses modul, dan menu navigasi yang dapat dibuka
                </div>
              </div>
              <Button size="xs" variant="ghost" onClick={() => setModalRole(null)}>
                Tutup
              </Button>
            </div>

            {/* Modal Sub-Tabs */}
            <div style={{ display: "flex", gap: 4, padding: "8px 20px", background: T.bgAlt, borderBottom: `1px solid ${T.border}` }}>
              {[
                { key: "profil", label: "1. Profil & Tingkat", icon: "user" },
                { key: "permissions", label: `2. Matriks Wewenang (${(modalRole.data.permissions || []).length})`, icon: "shield" },
                { key: "menus", label: `3. Menu Navigasi (${(modalRole.data.allowed_menus || []).length})`, icon: "layers" },
              ].map(tb => (
                <button
                  key={tb.key}
                  onClick={() => setActiveTabModal(tb.key)}
                  style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    background: activeTabModal === tb.key ? T.primary : "transparent",
                    color: activeTabModal === tb.key ? "#fff" : T.textSecondary,
                  }}
                >
                  <Icon name={tb.icon} size={13} />
                  {tb.label}
                </button>
              ))}
            </div>

            {/* Modal Content */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {activeTabModal === "profil" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={lblStyle}>Nama Peran (Role) *</label>
                    <input
                      disabled={modalRole.data.is_locked}
                      value={modalRole.data.nama || ""}
                      onChange={e => setModalRole(m => ({ ...m, data: { ...m.data, nama: e.target.value } }))}
                      placeholder="Mis: Operator SPM Kesehatan / Tim Verifikasi"
                      style={{ ...inpStyle, opacity: modalRole.data.is_locked ? 0.7 : 1 }}
                    />
                    {modalRole.data.is_locked && (
                      <div style={{ fontSize: 11, color: "#7C3AED", marginTop: 4 }}>
                        * Nama role bawaan sistem dikunci demi integritas otentikasi.
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={lblStyle}>Deskripsi Peran</label>
                    <textarea
                      rows={2}
                      value={modalRole.data.deskripsi || ""}
                      onChange={e => setModalRole(m => ({ ...m, data: { ...m.data, deskripsi: e.target.value } }))}
                      placeholder="Tugas pokok dan fungsi pengguna dengan peran ini..."
                      style={{ ...inpStyle, resize: "vertical" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={lblStyle}>Tingkat Dasar (Base Permission Fallback)</label>
                      <Select
                        value={modalRole.data.base_level || "Staf"}
                        onChange={v => setModalRole(m => ({ ...m, data: { ...m.data, base_level: v } }))}
                        options={[
                          { value: "Admin", label: "Admin (Tingkat Tertinggi)" },
                          { value: "Reviewer", label: "Reviewer (Verifikator)" },
                          { value: "Operator Bank Data", label: "Operator Bank Data / Produsen Data" },
                          { value: "Staf", label: "Staf (Viewer / Pembuat Arsip)" },
                        ]}
                      />
                    </div>

                    <div>
                      <label style={lblStyle}>Pembatasan Data Berdasarkan OPD</label>
                      <Select
                        value={modalRole.data.opd_scoped ? "true" : "false"}
                        onChange={v => setModalRole(m => ({ ...m, data: { ...m.data, opd_scoped: v === "true" } }))}
                        options={[
                          { value: "false", label: "Tidak (Akses Lintas OPD / Seluruh Pemda)" },
                          { value: "true", label: "Ya (Data Dibatasi Hanya Sesuai OPD Pengguna)" },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Warna Badge */}
                  <div>
                    <label style={lblStyle}>Warna Label Badge</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {PRESET_WARNA.map(pw => {
                        const isSel = modalRole.data.warna_bg === pw.bg && modalRole.data.warna_text === pw.text;
                        return (
                          <button
                            key={pw.label}
                            type="button"
                            onClick={() => setModalRole(m => ({
                              ...m,
                              data: { ...m.data, warna_bg: pw.bg, warna_text: pw.text },
                            }))}
                            style={{
                              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                              background: pw.bg, color: pw.text,
                              border: isSel ? `2px solid ${pw.text}` : `1px solid ${pw.text}33`,
                              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                            }}
                          >
                            {isSel && <Icon name="check" size={12} />}
                            {pw.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div style={{ padding: "12px 14px", borderRadius: 10, background: T.bgAlt, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", marginBottom: 6 }}>
                      Terapkan Template Wewenang Cepat (Preset)
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button size="xs" variant="ghost" onClick={() => terapkanPreset("admin")}>Akses Penuh (Admin)</Button>
                      <Button size="xs" variant="ghost" onClick={() => terapkanPreset("walidata")}>Template Walidata</Button>
                      <Button size="xs" variant="ghost" onClick={() => terapkanPreset("produsen")}>Template Produsen Data (OPD)</Button>
                      <Button size="xs" variant="ghost" onClick={() => terapkanPreset("staf")}>Template Staf / Pegawai</Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTabModal === "permissions" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13, color: T.textSecondary }}>
                      Centang izin wewenang yang diberikan kepada akun dengan peran ini.
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          const allKeys = (meta.modules || []).flatMap(m => m.permissions.map(p => p.key));
                          setModalRole(m => ({ ...m, data: { ...m.data, permissions: allKeys } }));
                        }}
                      >
                        Pilih Semua Wewenang
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setModalRole(m => ({ ...m, data: { ...m.data, permissions: [] } }))}
                      >
                        Hapus Semua
                      </Button>
                    </div>
                  </div>

                  {/* Matrix Cards per Module */}
                  {(meta.modules || []).map(mod => {
                    const groupPerms = mod.permissions || [];
                    const selectedCount = groupPerms.filter(p => (modalRole.data.permissions || []).includes(p.key)).length;
                    const allSelected = selectedCount === groupPerms.length;

                    return (
                      <div
                        key={mod.key}
                        style={{
                          background: T.bgAlt, borderRadius: 12, border: `1px solid ${T.border}`,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{
                          padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: T.card,
                        }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{mod.label}</span>
                            <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>
                              ({selectedCount}/{groupPerms.length} aktif)
                            </span>
                            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 1 }}>{mod.deskripsi}</div>
                          </div>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => toggleGroupPerms(groupPerms, !allSelected)}
                          >
                            {allSelected ? "Batal Semua" : "Pilih Semua"}
                          </Button>
                        </div>
                        <div style={{ padding: "10px 14px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                          {groupPerms.map(p => {
                            const isChecked = (modalRole.data.permissions || []).includes(p.key) || (modalRole.data.permissions || []).includes("*");
                            return (
                              <label
                                key={p.key}
                                onClick={e => { e.preventDefault(); togglePerm(p.key); }}
                                style={{
                                  display: "flex", alignItems: "flex-start", gap: 8, padding: 8,
                                  borderRadius: 8, border: `1px solid ${isChecked ? T.primary + "66" : T.border}`,
                                  background: isChecked ? T.card : "transparent",
                                  cursor: "pointer", transition: "all 0.15s ease",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  style={{ marginTop: 2, accentColor: T.primary }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: isChecked ? T.text : T.textSecondary }}>
                                    {p.label}
                                  </div>
                                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                                    {p.desc}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTabModal === "menus" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: T.textSecondary }}>
                      Pilih menu pada sidebar navigasi yang boleh dilihat dan diakses oleh pengguna peran ini:
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          const allMenus = (meta.menus || []).map(m => m.key);
                          setModalRole(m => ({ ...m, data: { ...m.data, allowed_menus: allMenus } }));
                        }}
                      >
                        Pilih Semua Menu
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setModalRole(m => ({ ...m, data: { ...m.data, allowed_menus: [] } }))}
                      >
                        Hapus Semua
                      </Button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10 }}>
                    {(meta.menus || []).map(menu => {
                      const isChecked = (modalRole.data.allowed_menus || []).includes(menu.key);
                      return (
                        <label
                          key={menu.key}
                          onClick={e => { e.preventDefault(); toggleMenu(menu.key); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                            borderRadius: 10, border: `1px solid ${isChecked ? T.primary : T.border}`,
                            background: isChecked ? (T.primary + "12") : T.bgAlt,
                            cursor: "pointer", transition: "all 0.15s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ accentColor: T.primary }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isChecked ? T.primary : T.text }}>
                              {menu.label}
                            </div>
                            <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase" }}>
                              {menu.group}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "flex-end", gap: 8, background: T.bgAlt }}>
              <Button variant="ghost" onClick={() => setModalRole(null)}>
                Batal
              </Button>
              <Button variant="primary" loading={busy} onClick={simpanRole}>
                Simpan Konfigurasi Role
              </Button>
            </div>
          </Geser>
        </div>
      )}

      {/* Modal Daftar Pengguna pada Role Ini (Draggable) */}
      {modalUsers && (
        <div
          onClick={() => setModalUsers(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(4px)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <Geser
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
              width: "100%", maxWidth: 640, maxHeight: "85vh", overflow: "hidden",
              display: "flex", flexDirection: "column", boxShadow: T.shadowLg,
            }}
          >
            <div data-pegang style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "grab", userSelect: "none" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>
                  Pengguna dengan Peran: {modalUsers.nama}
                </h3>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                  Daftar akun pegawai yang memiliki wewenang {modalUsers.nama}
                </div>
              </div>
              <Button size="xs" variant="ghost" onClick={() => setModalUsers(null)}>Tutup</Button>
            </div>

            {/* Tambah Pegawai ke Role Ini */}
            <div style={{ padding: "12px 20px", background: T.bgAlt, borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <Select
                  value={selectedNipToAssign}
                  onChange={v => setSelectedNipToAssign(v)}
                  placeholder="-- Pilih pegawai untuk dimasukkan ke peran ini --"
                  options={allUsers
                    .filter(u => String(u.role).toLowerCase() !== String(modalUsers.nama).toLowerCase())
                    .map(u => ({ value: u.nip, label: `${u.name} (NIP: ${u.nip}) - Peran Saat Ini: ${u.role}` }))}
                />
              </div>
              <Button
                size="sm"
                variant="primary"
                loading={busy}
                disabled={!selectedNipToAssign}
                onClick={assignUserKeRole}
              >
                Tugaskan
              </Button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {(modalUsers.users || []).length === 0 ? (
                <div style={{ textAlign: "center", padding: 32, color: T.textMuted }}>
                  <Icon name="users" size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <div>Belum ada akun pengguna yang ditugaskan ke peran ini.</div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Nama Pegawai</th>
                      <th style={thStyle}>NIP</th>
                      <th style={thStyle}>OPD / Unit Kerja</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modalUsers.users || []).map(u => (
                      <tr key={u.nip}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{u.name}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace" }}>{u.nip}</td>
                        <td style={tdStyle}>{u.opd_nama || u.bidang || "-"}</td>
                        <td style={tdStyle}>
                          <Badge
                            label={u.status || "AKTIF"}
                            colors={u.status === "AKTIF" || u.status === "Aktif" ? { bg: T.successBg, text: T.success } : { bg: T.dangerBg, text: T.danger }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Geser>
        </div>
      )}
    </div>
  );
}
