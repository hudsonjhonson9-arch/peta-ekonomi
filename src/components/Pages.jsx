import { useState } from "react";
import { Icon, Badge } from "./ui.jsx";
import { STATUS_COLOR, ROLE_COLOR } from "../data.js";

// ─── PENCARIAN ────────────────────────────────────────────────────────────────
export function Pencarian({ docs, onView }) {
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
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Pencarian Dokumen</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Cari dalam seluruh repositori dokumen</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Icon name="search" size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#999" }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Ketik judul, jenis, sektor, kata kunci, atau nama pengupload..."
              style={{ width: "100%", padding: "12px 12px 12px 40px", border: "1.5px solid #1a7a4a", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <button
            onClick={() => doSearch()}
            style={{ padding: "12px 24px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
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
              style={{ fontSize: 12, padding: "4px 12px", background: "#f0f7f2", color: "#1a7a4a", border: "1px solid #c8e6c9", borderRadius: 99, cursor: "pointer" }}
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
              style={{ background: "#fff", borderRadius: 10, padding: 16, border: "1px solid #e8e8e8", marginBottom: 8, cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{ width: 40, height: 40, background: "#f0f7f2", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="file" size={18} style={{ color: "#1a7a4a" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a3a2a", marginBottom: 3 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{d.type} · {d.sector} · {d.year}</div>
                <div style={{ fontSize: 12, color: "#666", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.desc}</div>
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
export function PortalPublik({ docs }) {
  const publik = docs.filter(d =>
    d.status === "Diarsipkan" &&
    ["RPJMD", "Renstra", "Renja", "Data Statistik", "Kajian Ekonomi"].includes(d.type)
  );

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #1a3a2a, #0d5c2e)", borderRadius: 16, padding: "32px 28px", marginBottom: 24, color: "#fff" }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Portal Dokumen Publik</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
          Akses dokumen perencanaan bidang ekonomi yang tersedia untuk publik
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
          BAPPERIDA Kabupaten Sumba Barat · NTT
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>{publik.length} dokumen tersedia untuk publik</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {publik.map(d => (
          <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: 18, border: "1px solid #e8e8e8" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, background: "#f0f7f2", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="file" size={18} style={{ color: "#1a7a4a" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a3a2a", marginBottom: 4, lineHeight: 1.3 }}>{d.title}</div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>{d.type} · {d.year} · {d.size}</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{d.desc}</div>
                <button style={{ fontSize: 11, padding: "5px 12px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
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
  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState({
    id: "", nip: "", name: "", role: "Staf",
    unit: "Sekretariat", status: "AKTIF", password: ""
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const openAdd = () => {
    setForm({ id: "", nip: "", name: "", role: "Staf", unit: "Sekretariat", status: "AKTIF", password: "" });
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
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Manajemen Pengguna</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{users.length} pengguna terdaftar</div>
        </div>
        <button
          onClick={openAdd}
          style={{ padding: "9px 16px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.background = "#0d5c2e"}
          onMouseLeave={e => e.currentTarget.style.background = "#1a7a4a"}
        >
          <Icon name="plus" size={14} /> Tambah Pengguna
        </button>
      </div>

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
                    <div style={{ width: 32, height: 32, background: "#f0f7f2", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#1a7a4a", flexShrink: 0 }}>
                      {u.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a3a2a" }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>NIP: {u.nip}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px 14px" }}><Badge label={u.role} colors={ROLE_COLOR[u.role] || { bg: "#eee", text: "#666" }} /></td>
                <td style={{ padding: "12px 14px", fontSize: 12, color: "#555" }}>{u.unit}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 11, color: u.status === "AKTIF" || u.status === "Aktif" ? "#2e7d32" : "#c62828", background: u.status === "AKTIF" || u.status === "Aktif" ? "#e8f5e9" : "#ffebee", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{u.status}</span>
                </td>
                <td style={{ padding: "12px 14px", fontSize: 12, color: "#888" }}>{u.lastLogin}</td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => openEdit(u)}
                      style={{ fontSize: 11, padding: "5px 10px", background: "#f5f5f5", border: "none", borderRadius: 6, cursor: "pointer", color: "#555", display: "inline-flex", alignItems: "center", gap: 4, transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#e0e0e0"}
                      onMouseLeave={e => e.currentTarget.style.background = "#f5f5f5"}
                    >
                      <Icon name="edit" size={11} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      style={{ fontSize: 11, padding: "5px 10px", background: "#ffebee", border: "none", borderRadius: 6, cursor: "pointer", color: "#c62828", display: "inline-flex", alignItems: "center", gap: 4, transition: "background 0.2s" }}
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

      {/* Modal Form */}
      {modalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 440, boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a3a2a" }}>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                  style={{ ...inpStyle, cursor: "pointer" }}
                >
                  <option>Sekretariat</option>
                  <option>Bidang Perencanaan</option>
                  <option>Bidang Ekonomi dan SDA</option>
                  <option>Bidang Pemerintahan dan Pembangunan Manusia</option>
                  <option>Bidang Riset dan Inovasi Daerah</option>
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
                  style={{ padding: "8px 20px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}
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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Manajemen Tipe Dokumen</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{categories.length} tipe dokumen dikonfigurasi</div>
        </div>
        <button
          onClick={openAdd}
          style={{ padding: "9px 16px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "background 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.background = "#0d5c2e"}
          onMouseLeave={e => e.currentTarget.style.background = "#1a7a4a"}
        >
          <Icon name="plus" size={14} /> Tambah Tipe Dokumen
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", maxWidth: 600 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #e8e8e8" }}>
              {["Nama Tipe Dokumen", "Aksi"].map(h => (
                <th key={h} style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700, color: "#666", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: i < categories.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, background: "#f0f7f2", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="tag" size={13} style={{ color: "#1a7a4a" }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1a3a2a" }}>{c.nama}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => openEdit(c)}
                      style={{ fontSize: 11, padding: "5px 10px", background: "#f5f5f5", border: "none", borderRadius: 6, cursor: "pointer", color: "#555", display: "inline-flex", alignItems: "center", gap: 4, transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#e0e0e0"}
                      onMouseLeave={e => e.currentTarget.style.background = "#f5f5f5"}
                    >
                      <Icon name="edit" size={11} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      style={{ fontSize: 11, padding: "5px 10px", background: "#ffebee", border: "none", borderRadius: 6, cursor: "pointer", color: "#c62828", display: "inline-flex", alignItems: "center", gap: 4, transition: "background 0.2s" }}
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

      {/* Modal Form */}
      {modalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 380, boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a3a2a" }}>
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
                  style={{ padding: "8px 20px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", fontWeight: 600 }}
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
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Audit Trail</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>Riwayat semua aktivitas pada sistem</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden" }}>
        {logs.map((l, i) => (
          <div key={l.id} style={{ display: "flex", gap: 14, padding: "14px 18px", borderBottom: i < logs.length - 1 ? "1px solid #f5f5f5" : "none", alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, background: "#f0f7f2", borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#1a7a4a" }}>
              {l.user[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#1a3a2a", marginBottom: 3 }}>
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
