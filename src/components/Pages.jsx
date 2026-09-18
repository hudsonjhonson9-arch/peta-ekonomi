import { useState, useEffect, useContext, useMemo } from "react";
import { Icon, Badge } from "./ui.jsx";
import { STATUS_COLOR, ROLE_COLOR } from "../data.js";
import useResponsive from "../useResponsive.js";
import { ThemeContext } from "../App.jsx";

// ── Shared Style Factories (use T from ThemeContext) ──────────────────────────
function makeStyles(T) {
  const btnBase = {
    fontFamily: T.font,
    fontWeight: 600,
    borderRadius: T.radius,
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.15s ease",
    outline: "none",
    whiteSpace: "nowrap",
  };
  const btnPrimary = {
    ...btnBase,
    background: T.primary,
    color: "#fff",
    padding: "10px 18px",
    fontSize: 13,
    boxShadow: "0 1px 3px rgba(37,99,235,0.3)",
  };
  const btnGhost = {
    ...btnBase,
    background: "transparent",
    color: T.textSecondary,
    padding: "8px 12px",
    fontSize: 12,
  };
  const btnDanger = {
    ...btnBase,
    background: T.dangerBg,
    color: T.danger,
    padding: "8px 12px",
    fontSize: 12,
    border: `1px solid ${T.dangerBorder}`,
  };
  const cardStyle = {
    background: T.card,
    borderRadius: T.radiusLg,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadowSm,
  };
  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    fontFamily: T.font,
    border: `1.5px solid ${T.border}`,
    borderRadius: T.radius,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
    color: T.text,
    background: T.inputBg,
  };
  const inputErrorStyle = {
    ...inputStyle,
    borderColor: T.danger,
    boxShadow: `0 0 0 3px ${T.dangerRing}`,
  };
  return { btnBase, btnPrimary, btnGhost, btnDanger, cardStyle, inputStyle, inputErrorStyle };
}

// ─── PENCARIAN ────────────────────────────────────────────────────────────────
export function Pencarian({ docs, onView }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);
  const [q,        setQ]        = useState("");
  const [results,  setResults]  = useState([]);
  const [searched, setSearched] = useState(false);

  const doSearch = (query = q) => {
    const ql = query.toLowerCase().trim();
    if (!ql) return;
    const r = docs.filter(d =>
      d.title.toLowerCase().includes(ql)  ||
      d.desc.toLowerCase().includes(ql)   ||
      d.type.toLowerCase().includes(ql)   ||
      d.sector.toLowerCase().includes(ql) ||
      d.tags.some(t => t.includes(ql))    ||
      d.uploader.toLowerCase().includes(ql)
    );
    setResults(r);
    setSearched(true);
  };

  const suggestions = ["RPJMD", "pariwisata", "UMKM", "kajian", "evaluasi", "pertanian", "2024"];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Pencarian Dokumen</div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>Cari dalam seluruh repositori dokumen</div>
      </div>

      <div style={{ background: T.card, borderRadius: 12, padding: isMobile ? 16 : 24, border: `1px solid ${T.border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Icon name="search" size={isMobile ? 14 : 16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Cari dokumen..."
              style={{ width: "100%", padding: "10px 12px 10px 38px", border: `1.5px solid ${T.primary}`, borderRadius: 8, fontSize: isMobile ? 16 : 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            onClick={() => doSearch()}
            style={{ padding: "10px 18px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Cari
          </button>
        </div>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Coba cari:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setQ(s); doSearch(s); }}
              style={{ fontSize: 12, padding: "4px 12px", background: T.primaryLight, color: T.primary, border: `1px solid ${T.primaryRing}`, borderRadius: 99, cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {searched && (
        <div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 12 }}>
            {results.length > 0
              ? `${results.length} dokumen ditemukan untuk "${q}"`
              : `Tidak ada dokumen untuk "${q}"`}
          </div>
          {results.map(d => (
            <div
              key={d.id}
              onClick={() => onView(d)}
              style={{ background: T.card, borderRadius: 10, padding: isMobile ? 12 : 16, border: `1px solid ${T.border}`, marginBottom: 8, cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}
            >
              <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, background: T.primaryLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="file" size={isMobile ? 15 : 18} style={{ color: T.primary }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>{d.title}</div>
                <div style={{ fontSize: isMobile ? 11 : 12, color: T.textMuted, marginBottom: 3 }}>{d.type} · {d.sector} · {d.year}</div>
                <div style={{ fontSize: isMobile ? 11 : 12, color: T.textSecondary, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.desc}</div>
              </div>
              <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, color: T.textMuted }}>
              <Icon name="search" size={32} style={{ color: T.textMuted, marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Dokumen tidak ditemukan</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Coba kata kunci lain</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PORTAL PUBLIK ────────────────────────────────────────────────────────────
export function PortalPublik({ docs, onDownload }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);
  const publik = docs.filter(d =>
    d.status === "Diarsipkan" && d.publik
  );

  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${T.sidebarBg}, ${T.primary})`, borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 28px", marginBottom: 24, color: "#fff" }}>
        <div style={{ fontSize: isMobile ? 19 : 22, fontWeight: 700, marginBottom: 6 }}>Portal Dokumen Publik</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
          Akses dokumen perencanaan pembangunan yang tersedia untuk publik
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
          BAPPERIDA Kabupaten Sumba Barat · NTT
        </div>
      </div>

      <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 14 }}>{publik.length} dokumen tersedia untuk publik</div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 12 }}>
        {publik.map(d => (
          <div key={d.id} style={{ background: T.card, borderRadius: 12, padding: 18, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, background: T.primaryLight, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="file" size={18} style={{ color: T.primary }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4, lineHeight: 1.3 }}>{d.title}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>{d.type} · {d.year} · {d.size}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.desc}</div>
                <button
                  onClick={() => onDownload && onDownload(d)}
                  style={{ fontSize: 11, padding: "5px 12px", background: T.primary, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
                >
                  <Icon name="download" size={11} /> Unduh
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MANAJEMEN PENGGUNA ───────────────────────────────────────────────────────
export function ManajemenPengguna({ users, onReload, showToast }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);
  const s = useMemo(() => makeStyles(T), [T]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState({
    id: "", nip: "", name: "", role: "Staf",
    unit: "", status: "AKTIF", password: ""
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [bidangList, setBidangList] = useState([]);

  useEffect(() => {
    fetch('/api/bidang').then(r => r.json()).then(d => setBidangList(d)).catch(() => {});
  }, []);

  const openAdd = () => {
    setForm({ id: "", nip: "", name: "", role: "Staf", unit: bidangList[0]?.nama || "", status: "AKTIF", password: "" });
    setErrors({});
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setForm({ id: u.id, nip: u.nip, name: u.name, role: u.role, unit: u.unit, status: u.status, password: "" });
    setErrors({});
    setIsEdit(true);
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.nip.trim()) e.nip = "NIP wajib diisi";
    if (!form.name.trim()) e.name = "Nama Lengkap wajib diisi";
    if (!isEdit && !form.password.trim()) e.password = "Password wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const url = isEdit ? `/api/users/${form.id}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ submit: data.error || "Terjadi kesalahan" });
      } else {
        showToast(isEdit ? "Pengguna berhasil diperbarui." : "Pengguna baru berhasil ditambahkan.");
        setModalOpen(false);
        onReload();
      }
    } catch (err) {
      setErrors({ submit: "Gagal menghubungi server" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus pengguna "${u.name}"?`)) return;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal menghapus pengguna");
      } else {
        showToast("Pengguna berhasil dihapus.");
        onReload();
      }
    } catch (err) {
      showToast("Gagal menghubungi server");
    }
  };

  const isActive = (s) => s === "AKTIF" || s === "Aktif";

  return (
    <div style={{ padding: isMobile ? 16 : "28px 36px", fontFamily: T.font, background: T.bg, minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>Pengguna</h1>
          <p style={{ fontSize: 13, color: T.textSecondary, margin: "4px 0 0" }}>{users.length} pengguna terdaftar</p>
        </div>
        <button onClick={openAdd} style={s.btnPrimary}
          onMouseEnter={e => { e.currentTarget.style.background = T.primaryHover; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.primary; e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.3)"; }}>
          <Icon name="plus" size={15} /> Tambah
        </button>
      </div>

      {/* Desktop Table */}
      {!isMobile ? (
        <div style={{ ...s.cardStyle, overflow: "hidden" }}>
          {/* Table Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 0.8fr 1fr 120px", padding: "12px 20px", background: T.primaryLight, borderBottom: `1px solid ${T.border}` }}>
            {["Nama / NIP", "Peran", "Unit Kerja", "Status", "Login Terakhir", "Aksi"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
            ))}
          </div>

          {users.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: T.primaryLight, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="users" size={22} style={{ color: T.primary }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Belum ada pengguna</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Klik "Tambah" untuk menambahkan pengguna baru</div>
            </div>
          ) : (
            users.map((u, i) => (
              <div key={u.id}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 0.8fr 1fr 120px",
                  padding: "14px 20px", alignItems: "center",
                  borderBottom: i < users.length - 1 ? `1px solid ${T.border}` : "none",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {/* Name + NIP */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, background: T.primaryLight, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: T.primary, flexShrink: 0 }}>
                    {u.name[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>NIP: {u.nip}</div>
                  </div>
                </div>
                {/* Role */}
                <div><Badge label={u.role} colors={ROLE_COLOR[u.role] || { bg: "#F1F5F9", text: "#475569" }} /></div>
                {/* Unit */}
                <div style={{ fontSize: 13, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.unit}</div>
                {/* Status */}
                <div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                    background: isActive(u.status) ? T.successBg : T.dangerBg,
                    color: isActive(u.status) ? T.success : T.danger,
                  }}>{u.status}</span>
                </div>
                {/* Last Login */}
                <div style={{ fontSize: 12, color: T.textMuted }}>{u.lastLogin}</div>
                {/* Actions */}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => openEdit(u)} style={s.btnGhost}
                    onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Icon name="edit" size={13} /> Edit
                  </button>
                  <button onClick={() => handleDelete(u)} style={s.btnDanger}
                    onMouseEnter={e => { e.currentTarget.style.background = T.dangerHover; e.currentTarget.style.borderColor = T.danger; }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.dangerBg; e.currentTarget.style.borderColor = T.dangerBorder; }}>
                    <Icon name="x" size={13} /> Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Mobile Cards */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.length === 0 ? (
            <div style={{ ...s.cardStyle, padding: "48px 20px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: T.primaryLight, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="users" size={22} style={{ color: T.primary }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Belum ada pengguna</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Klik "Tambah" untuk menambahkan pengguna baru</div>
            </div>
          ) : users.map(u => (
            <div key={u.id} style={{ ...s.cardStyle, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, background: T.primaryLight, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.primary, flexShrink: 0 }}>
                  {u.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>NIP: {u.nip}</div>
                </div>
                <Badge label={u.role} colors={ROLE_COLOR[u.role] || { bg: "#F1F5F9", text: "#475569" }} />
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 12, color: T.textSecondary, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ background: T.bg, border: `1px solid ${T.border}`, padding: "3px 10px", borderRadius: 99 }}>{u.unit}</span>
                <span style={{
                  fontWeight: 600, padding: "3px 10px", borderRadius: 99,
                  background: isActive(u.status) ? T.successBg : T.dangerBg,
                  color: isActive(u.status) ? T.success : T.danger,
                }}>{u.status}</span>
              </div>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>Login: {u.lastLogin}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEdit(u)} style={{ ...btnBase, flex: 1, padding: "9px 12px", background: T.bg, border: `1px solid ${T.border}`, color: T.textSecondary, fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                  onMouseLeave={e => e.currentTarget.style.background = T.bg}>
                  <Icon name="edit" size={13} /> Edit
                </button>
                <button onClick={() => handleDelete(u)} style={{ ...btnBase, flex: 1, padding: "9px 12px", background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, color: T.danger, fontSize: 13 }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.dangerHover; e.currentTarget.style.borderColor = T.danger; }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.dangerBg; e.currentTarget.style.borderColor = T.dangerBorder; }}>
                  <Icon name="x" size={13} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 50, padding: isMobile ? 0 : 20 }}
          onClick={() => setModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: isMobile ? "16px 16px 0 0" : T.radiusLg,
            padding: isMobile ? "24px 20px 80px" : "28px 32px",
            width: isMobile ? "100%" : 460, maxHeight: isMobile ? "85vh" : "auto", overflowY: "auto",
            boxShadow: T.shadowLg, animation: isMobile ? "slideUp .25s ease" : "fadeIn .15s ease",
          }}>
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: 0 }}>{isEdit ? "Edit Pengguna" : "Tambah Pengguna"}</h2>
              <button onClick={() => setModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHover; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMuted; }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* NIP */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>NIP <span style={{ color: T.danger }}>*</span></label>
                <input value={form.nip} onChange={e => setForm({ ...form, nip: e.target.value })} placeholder="Masukkan NIP"
                  style={errors.nip ? s.inputErrorStyle : s.inputStyle}
                  onFocus={e => { if (!errors.nip) e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                  onBlur={e => { if (!errors.nip) e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }} />
                {errors.nip && <div style={{ fontSize: 12, color: T.danger, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><Icon name="x" size={12} /> {errors.nip}</div>}
              </div>

              {/* Nama */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Nama Lengkap <span style={{ color: T.danger }}>*</span></label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masukkan nama lengkap"
                  style={errors.name ? s.inputErrorStyle : s.inputStyle}
                  onFocus={e => { if (!errors.name) e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                  onBlur={e => { if (!errors.name) e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }} />
                {errors.name && <div style={{ fontSize: 12, color: T.danger, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><Icon name="x" size={12} /> {errors.name}</div>}
              </div>

              {/* Role + Status */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Peran <span style={{ color: T.danger }}>*</span></label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                    style={{ ...s.inputStyle, cursor: "pointer", appearance: "auto" }}
                    onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                    onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}>
                    <option>Staf</option><option>Reviewer</option><option>Admin</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Status <span style={{ color: T.danger }}>*</span></label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    style={{ ...s.inputStyle, cursor: "pointer", appearance: "auto" }}
                    onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                    onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}>
                    <option value="AKTIF">AKTIF</option><option value="TUGAS">TUGAS</option><option value="NONAKTIF">NONAKTIF</option>
                  </select>
                </div>
              </div>

              {/* Unit Kerja */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Unit Kerja <span style={{ color: T.danger }}>*</span></label>
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                  style={{ ...s.inputStyle, cursor: "pointer", appearance: "auto" }}
                  onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                  onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}>
                  <option value="">— Pilih Bidang —</option>
                  {bidangList.map(b => <option key={b.id} value={b.nama}>{b.nama}</option>)}
                  {form.unit && !bidangList.some(b => b.nama === form.unit) && <option value={form.unit}>{form.unit}</option>}
                </select>
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>
                  Password {!isEdit && <span style={{ color: T.danger }}>*</span>}
                  {isEdit && <span style={{ fontWeight: 400, color: T.textMuted, fontSize: 12 }}> (kosongkan jika tidak diubah)</span>}
                </label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={isEdit ? "••••••••" : "Masukkan password"}
                  style={errors.password ? s.inputErrorStyle : s.inputStyle}
                  onFocus={e => { if (!errors.password) e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                  onBlur={e => { if (!errors.password) e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }} />
                {errors.password && <div style={{ fontSize: 12, color: T.danger, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><Icon name="x" size={12} /> {errors.password}</div>}
              </div>

              {errors.submit && (
                <div style={{ fontSize: 13, color: T.danger, padding: "10px 14px", background: T.dangerBg, borderRadius: T.radius, border: `1px solid ${T.dangerBorder}`, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="x" size={14} /> {errors.submit}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setModalOpen(false)} style={{ ...btnBase, padding: "10px 18px", background: T.surfaceHover, color: T.textSecondary, fontSize: 13 }}
                onMouseEnter={e => e.currentTarget.style.background = T.borderHover}
                onMouseLeave={e => e.currentTarget.style.background = T.surfaceHover}>
                Batal
              </button>
              <button onClick={handleSubmit} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MANAJEMEN KATEGORI DOKUMEN ──────────────────────────────────────────────

export function ManajemenKategoriDokumen({ categories, onReload, showToast }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);
  const s = useMemo(() => makeStyles(T), [T]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState({ id: "", name: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setForm({ id: "", name: "" });
    setErrors({});
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setForm({ id: c.id, name: c.nama });
    setErrors({});
    setIsEdit(true);
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Nama Tipe Dokumen wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const url = isEdit ? `/api/kategori-dokumen/${form.id}` : "/api/kategori-dokumen";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ submit: data.error || "Terjadi kesalahan" });
      } else {
        showToast(isEdit ? "Tipe dokumen berhasil diperbarui." : "Tipe dokumen baru berhasil ditambahkan.");
        setModalOpen(false);
        onReload();
      }
    } catch (err) {
      setErrors({ submit: "Gagal menghubungi server" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus tipe dokumen "${c.nama}"?`)) return;
    try {
      const res = await fetch(`/api/kategori-dokumen/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal menghapus tipe dokumen");
      } else {
        showToast("Tipe dokumen berhasil dihapus.");
        onReload();
      }
    } catch (err) {
      showToast("Gagal menghubungi server");
    }
  };

  return (
    <div style={{ padding: isMobile ? 16 : "28px 36px", fontFamily: T.font, background: T.bg, minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>Tipe Dokumen</h1>
          <p style={{ fontSize: 13, color: T.textSecondary, margin: "4px 0 0" }}>{categories.length} tipe dokumen dikonfigurasi</p>
        </div>
        <button onClick={openAdd} style={s.btnPrimary}
          onMouseEnter={e => { e.currentTarget.style.background = T.primaryHover; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.primary; e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.3)"; }}>
          <Icon name="plus" size={15} /> Tambah
        </button>
      </div>

      {/* Table Card */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.length === 0 ? (
            <div style={{ ...s.cardStyle, padding: "48px 20px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: T.primaryLight, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="tag" size={22} style={{ color: T.primary }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Belum ada tipe dokumen</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Klik "Tambah" untuk menambahkan tipe dokumen baru</div>
            </div>
          ) : categories.map(c => (
            <div key={c.id} style={{ ...s.cardStyle, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, background: T.primaryLight, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="tag" size={18} style={{ color: T.primary }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nama}</div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(c)} style={s.btnGhost}>
                  <Icon name="edit" size={13} /> Edit
                </button>
                <button onClick={() => handleDelete(c)} style={s.btnDanger}>
                  <Icon name="x" size={13} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...s.cardStyle, overflow: "hidden" }}>
          {/* Table Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", padding: "12px 20px", background: T.primaryLight, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.06em" }}>Nama</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>Aksi</span>
          </div>

          {/* Rows */}
          {categories.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: T.primaryLight, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="tag" size={22} style={{ color: T.primary }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Belum ada tipe dokumen</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Klik "Tambah" untuk menambahkan tipe dokumen baru</div>
            </div>
          ) : (
            categories.map((c, i) => (
              <div key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px",
                  padding: "14px 20px",
                  borderBottom: i < categories.length - 1 ? `1px solid ${T.border}` : "none",
                  alignItems: "center",
                  transition: "background 0.12s",
                  cursor: "default",
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, background: T.primaryLight, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="tag" size={16} style={{ color: T.primary }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nama}</span>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => openEdit(c)} style={s.btnGhost}
                    onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Icon name="edit" size={13} /> Edit
                  </button>
                  <button onClick={() => handleDelete(c)} style={s.btnDanger}
                    onMouseEnter={e => { e.currentTarget.style.background = T.dangerHover; e.currentTarget.style.borderColor = T.danger; }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.dangerBg; e.currentTarget.style.borderColor = T.dangerBorder; }}>
                    <Icon name="x" size={13} /> Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 50, padding: isMobile ? 0 : 20 }}
          onClick={() => setModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: isMobile ? "16px 16px 0 0" : T.radiusLg,
            padding: isMobile ? "24px 20px 80px" : "28px 32px",
            width: isMobile ? "100%" : 420, maxHeight: isMobile ? "85vh" : "auto",
            boxShadow: T.shadowLg, animation: isMobile ? "slideUp .25s ease" : "fadeIn .15s ease",
          }}>
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: 0 }}>{isEdit ? "Edit Tipe Dokumen" : "Tambah Tipe Dokumen"}</h2>
              <button onClick={() => setModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHover; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMuted; }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Form */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Nama Tipe Dokumen <span style={{ color: T.danger }}>*</span></label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: RPJMD, Renstra, Laporan"
                style={errors.name ? s.inputErrorStyle : s.inputStyle}
                onFocus={e => { if (!errors.name) e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                onBlur={e => { if (!errors.name) e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                autoFocus
              />
              {errors.name && <div style={{ fontSize: 12, color: T.danger, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><Icon name="x" size={12} /> {errors.name}</div>}
            </div>

            {errors.submit && (
              <div style={{ fontSize: 13, color: T.danger, marginTop: 12, padding: "10px 14px", background: T.dangerBg, borderRadius: T.radius, border: `1px solid ${T.dangerBorder}`, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="x" size={14} /> {errors.submit}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setModalOpen(false)} style={{ ...btnBase, padding: "10px 18px", background: T.surfaceHover, color: T.textSecondary, fontSize: 13 }}
                onMouseEnter={e => e.currentTarget.style.background = T.borderHover}
                onMouseLeave={e => e.currentTarget.style.background = T.surfaceHover}>
                Batal
              </button>
              <button onClick={handleSubmit} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AUDIT TRAIL ──────────────────────────────────────────────────────────────
const ACTION_COLOR = {
  "Upload dokumen":  "#1565c0",
  "Approve dokumen": "#2e7d32",
  "Review dokumen":  "#e65100",
  "Unduh dokumen":   "#4527a0",
  "Tolak dokumen":   "#c62828",
};

export function AuditTrail({ logs }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Audit Trail</div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>Riwayat semua aktivitas pada sistem</div>
      </div>

      <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
        {logs.map((l, i) => (
          <div key={l.id} style={{ display: "flex", gap: isMobile ? 10 : 14, padding: isMobile ? "12px 14px" : "14px 18px", borderBottom: i < logs.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, background: T.primaryLight, borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: T.primary }}>
              {l.user[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: T.text, marginBottom: 3 }}>
                <b>{l.user}</b>{" "}
                <span style={{ color: ACTION_COLOR[l.action] || T.textSecondary, fontWeight: 600 }}>{l.action}</span>
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 2 }}>{l.doc}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{l.time}</div>
            </div>
            <div style={{ fontSize: 11, padding: "3px 8px", background: T.surfaceHover, borderRadius: 6, color: T.textMuted, whiteSpace: "nowrap" }}>
              {l.action.split(" ")[0]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MANAJEMEN SEKTOR ──────────────────────────────────────────────────────
export function ManajemenSektor({ sectors, onReload, showToast }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);
  const s = useMemo(() => makeStyles(T), [T]);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState({ id: "", name: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setForm({ id: "", name: "" });
    setErrors({});
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setForm({ id: s.id, name: s.nama });
    setErrors({});
    setIsEdit(true);
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Nama sektor wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const url = isEdit ? `/api/sektor/${form.id}` : "/api/sektor";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors({ submit: data.error || "Terjadi kesalahan" });
      } else {
        showToast(isEdit ? "Sektor berhasil diperbarui." : "Sektor baru berhasil ditambahkan.");
        setModalOpen(false);
        onReload();
      }
    } catch (err) {
      setErrors({ submit: "Gagal menghubungi server" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus sektor "${s.nama}"?`)) return;
    try {
      const res = await fetch(`/api/sektor/${s.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Gagal menghapus sektor");
      } else {
        showToast("Sektor berhasil dihapus.");
        onReload();
      }
    } catch (err) {
      showToast("Gagal menghubungi server");
    }
  };

  return (
    <div style={{ padding: isMobile ? 16 : "28px 36px", fontFamily: T.font, background: T.bg, minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>Sektor</h1>
          <p style={{ fontSize: 13, color: T.textSecondary, margin: "4px 0 0" }}>{sectors.length} sektor dikonfigurasi</p>
        </div>
        <button onClick={openAdd} style={s.btnPrimary}
          onMouseEnter={e => { e.currentTarget.style.background = T.primaryHover; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = T.primary; e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.3)"; }}>
          <Icon name="plus" size={15} /> Tambah
        </button>
      </div>

      {/* Table Card */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sectors.length === 0 ? (
            <div style={{ ...s.cardStyle, padding: "48px 20px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: T.primaryLight, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="layers" size={22} style={{ color: T.primary }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Belum ada sektor</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Klik "Tambah" untuk menambahkan sektor baru</div>
            </div>
          ) : sectors.map(s => (
            <div key={s.id} style={{ ...s.cardStyle, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, background: T.primaryLight, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="layers" size={18} style={{ color: T.primary }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nama}</div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(s)} style={s.btnGhost}>
                  <Icon name="edit" size={13} /> Edit
                </button>
                <button onClick={() => handleDelete(s)} style={s.btnDanger}>
                  <Icon name="x" size={13} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...s.cardStyle, overflow: "hidden" }}>
          {/* Table Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", padding: "12px 20px", background: T.primaryLight, borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.06em" }}>Nama</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>Aksi</span>
          </div>

          {/* Rows */}
          {sectors.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: T.primaryLight, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="layers" size={22} style={{ color: T.primary }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Belum ada sektor</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Klik "Tambah" untuk menambahkan sektor baru</div>
            </div>
          ) : (
            sectors.map((s, i) => (
              <div key={s.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px",
                  padding: "14px 20px",
                  borderBottom: i < sectors.length - 1 ? `1px solid ${T.border}` : "none",
                  alignItems: "center",
                  transition: "background 0.12s",
                  cursor: "default",
                }}
                onMouseEnter={e => e.currentTarget.style.background = T.surfaceHover}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, background: T.primaryLight, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="layers" size={16} style={{ color: T.primary }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.nama}</span>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => openEdit(s)} style={s.btnGhost}
                    onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Icon name="edit" size={13} /> Edit
                  </button>
                  <button onClick={() => handleDelete(s)} style={s.btnDanger}
                    onMouseEnter={e => { e.currentTarget.style.background = T.dangerHover; e.currentTarget.style.borderColor = T.danger; }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.dangerBg; e.currentTarget.style.borderColor = T.dangerBorder; }}>
                    <Icon name="x" size={13} /> Hapus
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 50, padding: isMobile ? 0 : 20 }}
          onClick={() => setModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: isMobile ? "16px 16px 0 0" : T.radiusLg,
            padding: isMobile ? "24px 20px 80px" : "28px 32px",
            width: isMobile ? "100%" : 420, maxHeight: isMobile ? "85vh" : "auto",
            boxShadow: T.shadowLg, animation: isMobile ? "slideUp .25s ease" : "fadeIn .15s ease",
          }}>
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: 0 }}>{isEdit ? "Edit Sektor" : "Tambah Sektor"}</h2>
              <button onClick={() => setModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHover; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMuted; }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Form */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Nama Sektor <span style={{ color: T.danger }}>*</span></label>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Pertanian & Pangan"
                style={errors.name ? s.inputErrorStyle : s.inputStyle}
                onFocus={e => { if (!errors.name) e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                onBlur={e => { if (!errors.name) e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                autoFocus
              />
              {errors.name && <div style={{ fontSize: 12, color: T.danger, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><Icon name="x" size={12} /> {errors.name}</div>}
            </div>

            {errors.submit && (
              <div style={{ fontSize: 13, color: T.danger, marginTop: 12, padding: "10px 14px", background: T.dangerBg, borderRadius: T.radius, border: `1px solid ${T.dangerBorder}`, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="x" size={14} /> {errors.submit}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setModalOpen(false)} style={{ ...btnBase, padding: "10px 18px", background: T.surfaceHover, color: T.textSecondary, fontSize: 13 }}
                onMouseEnter={e => e.currentTarget.style.background = T.borderHover}
                onMouseLeave={e => e.currentTarget.style.background = T.surfaceHover}>
                Batal
              </button>
              <button onClick={handleSubmit} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
