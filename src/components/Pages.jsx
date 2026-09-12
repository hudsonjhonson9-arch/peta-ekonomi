import { useState, useEffect } from "react";
import { Icon, Badge } from "./ui.jsx";
import { STATUS_COLOR, ROLE_COLOR } from "../data.js";
import useResponsive from "../useResponsive.js";

// ─── PENCARIAN ────────────────────────────────────────────────────────────────
export function Pencarian({ docs, onView }) {
  const { isMobile } = useResponsive();
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
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Pencarian Dokumen</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Cari dalam seluruh repositori dokumen</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: isMobile ? 16 : 24, border: "1px solid #e8e8e8", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Icon name="search" size={isMobile ? 14 : 16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Cari dokumen..."
              style={{ width: "100%", padding: "10px 12px 10px 38px", border: "1.5px solid #2563EB", borderRadius: 8, fontSize: isMobile ? 16 : 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            onClick={() => doSearch()}
            style={{ padding: "10px 18px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Cari
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Coba cari:</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setQ(s); doSearch(s); }}
              style={{ fontSize: 12, padding: "4px 12px", background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 99, cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {searched && (
        <div>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
            {results.length > 0
              ? `${results.length} dokumen ditemukan untuk "${q}"`
              : `Tidak ada dokumen untuk "${q}"`}
          </div>
          {results.map(d => (
            <div
              key={d.id}
              onClick={() => onView(d)}
              style={{ background: "#fff", borderRadius: 10, padding: isMobile ? 12 : 16, border: "1px solid #e8e8e8", marginBottom: 8, cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}
            >
              <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, background: "#EFF6FF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="file" size={isMobile ? 15 : 18} style={{ color: "#2563EB" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{d.title}</div>
                <div style={{ fontSize: isMobile ? 11 : 12, color: "#888", marginBottom: 3 }}>{d.type} · {d.sector} · {d.year}</div>
                <div style={{ fontSize: isMobile ? 11 : 12, color: "#666", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.desc}</div>
              </div>
              <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", color: "#999" }}>
              <Icon name="search" size={32} style={{ color: "#ddd", marginBottom: 10 }} />
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
  const publik = docs.filter(d =>
    d.status === "Diarsipkan" && d.publik
  );

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #0F172A, #1D4ED8)", borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 28px", marginBottom: 24, color: "#fff" }}>
        <div style={{ fontSize: isMobile ? 19 : 22, fontWeight: 700, marginBottom: 6 }}>Portal Dokumen Publik</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
          Akses dokumen perencanaan pembangunan yang tersedia untuk publik
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
          BAPPERIDA Kabupaten Sumba Barat · NTT
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>{publik.length} dokumen tersedia untuk publik</div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 12 }}>
        {publik.map(d => (
          <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #e8e8e8" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, background: "#EFF6FF", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="file" size={18} style={{ color: "#2563EB" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4, lineHeight: 1.3 }}>{d.title}</div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>{d.type} · {d.year} · {d.size}</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.desc}</div>
                <button
                  onClick={() => onDownload && onDownload(d)}
                  style={{ fontSize: 11, padding: "5px 12px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
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
    setForm({ id: "", nip: "", name: "", role: "Staf", unit: bidangList[0] || "", status: "AKTIF", password: "" });
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

  const inpStyle = {
    width: "100%", padding: "9px 12px", border: "1.5px solid #e0e0e0",
    borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box"
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Manajemen Pengguna</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{users.length} pengguna terdaftar</div>
        </div>
        <button
          onClick={openAdd}
          style={{ padding: "9px 16px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.background = "#1D4ED8"}
          onMouseLeave={e => e.currentTarget.style.background = "#2563EB"}
        >
          <Icon name="plus" size={14} /> Tambah Pengguna
        </button>
      </div>

      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map(u => (
            <div key={u.id} style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1px solid #e8e8e8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, background: "#EFF6FF", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#2563EB", flexShrink: 0 }}>
                  {u.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>NIP: {u.nip}</div>
                </div>
                <Badge label={u.role} colors={ROLE_COLOR[u.role] || { bg: "#eee", text: "#666" }} />
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 12, color: "#666", marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ background: "#f5f5f5", padding: "2px 8px", borderRadius: 6 }}>{u.unit}</span>
                <span style={{
                  background: u.status === "AKTIF" || u.status === "Aktif" ? "#EFF6FF" : "#ffebee",
                  color: u.status === "AKTIF" || u.status === "Aktif" ? "#2e7d32" : "#c62828",
                  padding: "2px 8px", borderRadius: 6, fontWeight: 600
                }}>{u.status}</span>
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 10 }}>Login: {u.lastLogin}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEdit(u)} style={{ flex: 1, padding: "8px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", color: "#555", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Icon name="edit" size={12} /> Edit
                </button>
                <button onClick={() => handleDelete(u)} style={{ flex: 1, padding: "8px", background: "#ffebee", border: "none", borderRadius: 8, cursor: "pointer", color: "#c62828", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Icon name="x" size={12} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #e8e8e8" }}>
                {["Nama / NIP", "Peran", "Unit Kerja", "Status", "Login Terakhir", "Aksi"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: "#666", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? "1px solid #f5f5f5" : "none", transition: "background 0.1s" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, background: "#EFF6FF", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#2563EB", flexShrink: 0 }}>
                        {u.name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>NIP: {u.nip}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge label={u.role} colors={ROLE_COLOR[u.role] || { bg: "#eee", text: "#666" }} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#555" }}>{u.unit}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11, color: u.status === "AKTIF" || u.status === "Aktif" ? "#2e7d32" : "#c62828", background: u.status === "AKTIF" || u.status === "Aktif" ? "#EFF6FF" : "#ffebee", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{u.status}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#888" }}>{u.lastLogin}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(u)} style={{ fontSize: 11, padding: "5px 10px", background: "#f5f5f5", border: "none", borderRadius: 6, cursor: "pointer", color: "#555", display: "inline-flex", alignItems: "center", gap: 4, transition: "background 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#e0e0e0"}
                        onMouseLeave={e => e.currentTarget.style.background = "#f5f5f5"}
                      >
                        <Icon name="edit" size={11} /> Edit
                      </button>
                      <button onClick={() => handleDelete(u)} style={{ fontSize: 11, padding: "5px 10px", background: "#ffebee", border: "none", borderRadius: 6, cursor: "pointer", color: "#c62828", display: "inline-flex", alignItems: "center", gap: 4, transition: "background 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#ffcdd2"}
                        onMouseLeave={e => e.currentTarget.style.background = "#ffebee"}
                      >
                        <Icon name="x" size={11} /> Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Form */}
      {modalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{
            background: "#fff", borderRadius: isMobile ? "16px 16px 0 0" : 16, padding: isMobile ? 20 : 28,
            width: isMobile ? "100%" : 440, maxHeight: isMobile ? "85vh" : "auto", overflowY: "auto",
            boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
            animation: isMobile ? "slideUp .25s ease" : undefined,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                {isEdit ? "Edit Data Pengguna" : "Tambah Pengguna Baru"}
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>NIP Pegawai *</label>
                <input
                  value={form.nip}
                  onChange={e => setForm({ ...form, nip: e.target.value })}
                  placeholder="Masukkan NIP"
                  style={inpStyle}
                />
                {errors.nip && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.nip}</div>}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>Nama Lengkap *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Masukkan Nama Lengkap"
                  style={inpStyle}
                />
                {errors.name && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.name}</div>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>Peran *</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    style={{ ...inpStyle, cursor: "pointer" }}
                  >
                    <option>Staf</option>
                    <option>Reviewer</option>
                    <option>Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>Status *</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    style={{ ...inpStyle, cursor: "pointer" }}
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="TUGAS">TUGAS</option>
                    <option value="NONAKTIF">NONAKTIF</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>Unit Kerja / Bidang *</label>
                <select
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                  style={inpStyle}
                >
                  <option value="">— Pilih Bidang —</option>
                  {bidangList.map(b => <option key={b} value={b}>{b}</option>)}
                  {form.unit && !bidangList.includes(form.unit) && <option value={form.unit}>{form.unit}</option>}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>
                  Password {isEdit ? "(Kosongkan jika tidak diubah)" : "*"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={isEdit ? "••••••••" : "Masukkan password default"}
                  style={inpStyle}
                />
                {errors.password && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.password}</div>}
              </div>

              {errors.submit && (
                <div style={{ fontSize: 12, color: "#c62828", textAlign: "center", background: "#ffebee", padding: "8px", borderRadius: 6 }}>
                  {errors.submit}
                </div>
              )}

              <div style={{ borderTop: "1px solid #eee", paddingTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ padding: "8px 16px", background: "#f5f5f5", color: "#555", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{ padding: "8px 20px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
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

  const inpStyle = {
    width: "100%", padding: "9px 12px", border: "1.5px solid #e0e0e0",
    borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box"
  };

  return (
    <div style={{ padding: isMobile ? "16px" : "24px 32px" }}>
      {/* Header Card */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid #e8e8e8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, background: "linear-gradient(135deg, #2563EB, #1D4ED8)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="tag" size={20} style={{ color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>Manajemen Tipe Dokumen</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{categories.length} tipe dokumen dikonfigurasi</div>
          </div>
        </div>
        <button
          onClick={openAdd}
          style={{ padding: "10px 18px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.3)"; }}
        >
          <Icon name="plus" size={14} /> Tambah Tipe Dokumen
        </button>
      </div>

      {/* Table Card */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8e8e8", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 700, color: "#64748B", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e8e8e8" }}>Nama Tipe Dokumen</th>
              <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 700, color: "#64748B", textAlign: "right", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e8e8e8", width: 160 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: i < categories.length - 1 ? "1px solid #F1F5F9" : "none", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, background: "#EFF6FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="tag" size={16} style={{ color: "#2563EB" }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{c.nama}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 20px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => openEdit(c)}
                      style={{ fontSize: 12, padding: "7px 12px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer", color: "#475569", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 500, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#E2E8F0"; e.currentTarget.style.borderColor = "#CBD5E1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
                    >
                      <Icon name="edit" size={12} /> Edit
                    </button>
                    <button onClick={() => handleDelete(c)}
                      style={{ fontSize: 12, padding: "7px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer", color: "#DC2626", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 500, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#F87171"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                    >
                      <Icon name="x" size={12} /> Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#94A3B8" }}>
            <Icon name="tag" size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div style={{ fontSize: 14 }}>Belum ada tipe dokumen</div>
          </div>
        )}
      </div>

      {/* Modal Kategori Form */}
      {modalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{
            background: "#fff", borderRadius: isMobile ? "16px 16px 0 0" : 16, padding: isMobile ? 20 : 28,
            width: isMobile ? "100%" : 380, boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
            animation: isMobile ? "slideUp .25s ease" : undefined,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                {isEdit ? "Edit Tipe Dokumen" : "Tambah Tipe Dokumen Baru"}
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>Nama Tipe Dokumen *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: RPJMD, Renstra, Laporan, dll."
                  style={inpStyle}
                />
                {errors.name && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.name}</div>}
              </div>

              {errors.submit && (
                <div style={{ fontSize: 12, color: "#c62828", textAlign: "center", background: "#ffebee", padding: "8px", borderRadius: 6 }}>
                  {errors.submit}
                </div>
              )}

              <div style={{ borderTop: "1px solid #eee", paddingTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{ padding: "8px 16px", background: "#f5f5f5", color: "#555", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{ padding: "8px 20px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
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
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Audit Trail</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Riwayat semua aktivitas pada sistem</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
        {logs.map((l, i) => (
          <div key={l.id} style={{ display: "flex", gap: isMobile ? 10 : 14, padding: isMobile ? "12px 14px" : "14px 18px", borderBottom: i < logs.length - 1 ? "1px solid #f5f5f5" : "none", alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, background: "#EFF6FF", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#2563EB" }}>
              {l.user[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#0F172A", marginBottom: 3 }}>
                <b>{l.user}</b>{" "}
                <span style={{ color: ACTION_COLOR[l.action] || "#555", fontWeight: 600 }}>{l.action}</span>
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{l.doc}</div>
              <div style={{ fontSize: 11, color: "#aaa" }}>{l.time}</div>
            </div>
            <div style={{ fontSize: 11, padding: "3px 8px", background: "#f5f5f5", borderRadius: 6, color: "#888", whiteSpace: "nowrap" }}>
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

  const inp = { width: "100%", padding: "10px 12px", border: "1.5px solid #ddd", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ padding: isMobile ? "16px" : "24px 32px" }}>
      {/* Header Card */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", border: "1px solid #e8e8e8", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, background: "linear-gradient(135deg, #2563EB, #1D4ED8)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="layers" size={20} style={{ color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>Manajemen Sektor</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{sectors.length} sektor dikonfigurasi</div>
          </div>
        </div>
        <button
          onClick={openAdd}
          style={{ padding: "10px 18px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,99,235,0.3)"; }}
        >
          <Icon name="plus" size={14} /> Tambah Sektor
        </button>
      </div>

      {/* Table Card */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8e8e8", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 700, color: "#64748B", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e8e8e8" }}>Nama Sektor</th>
              <th style={{ padding: "14px 20px", fontSize: 12, fontWeight: 700, color: "#64748B", textAlign: "right", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e8e8e8", width: 160 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < sectors.length - 1 ? "1px solid #F1F5F9" : "none", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "14px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, background: "#EFF6FF", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="layers" size={16} style={{ color: "#2563EB" }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{s.nama}</span>
                  </div>
                </td>
                <td style={{ padding: "14px 20px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => openEdit(s)}
                      style={{ fontSize: 12, padding: "7px 12px", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer", color: "#475569", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 500, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#E2E8F0"; e.currentTarget.style.borderColor = "#CBD5E1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
                    >
                      <Icon name="edit" size={12} /> Edit
                    </button>
                    <button onClick={() => handleDelete(s)}
                      style={{ fontSize: 12, padding: "7px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, cursor: "pointer", color: "#DC2626", display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 500, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#F87171"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = "#FECACA"; }}
                    >
                      <Icon name="x" size={12} /> Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sectors.length === 0 && (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#94A3B8" }}>
            <Icon name="layers" size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div style={{ fontSize: 14 }}>Belum ada sektor</div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 400, maxWidth: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 20 }}>{isEdit ? "Edit Sektor" : "Tambah Sektor"}</div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#555", display: "block", marginBottom: 5 }}>Nama Sektor *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inp, borderColor: errors.name ? "#c62828" : "#ddd" }} placeholder="Misal: Pertanian & Pangan" />
              {errors.name && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.name}</div>}
            </div>
            {errors.submit && <div style={{ fontSize: 12, color: "#c62828", marginBottom: 12, padding: "8px 12px", background: "#ffebee", borderRadius: 8 }}>{errors.submit}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: "8px 16px", background: "#f5f5f5", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Batal</button>
              <button onClick={handleSubmit} disabled={loading} style={{ padding: "8px 16px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13 }}>
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
