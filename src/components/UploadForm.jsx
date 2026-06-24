import { useState, useRef } from "react";
import { Icon } from "./ui.jsx";
import { SECTORS } from "../data.js";

export default function UploadForm({ onSubmit, user, categories = [] }) {
  const [form, setForm] = useState({
    title: "", type: "", sector: "",
    year: new Date().getFullYear().toString(),
    desc: "", tags: "",
  });
  const [file,   setFile]   = useState(null);
  const [errors, setErrors] = useState({});
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title  = "Judul dokumen wajib diisi";
    if (!form.type)         e.type   = "Pilih jenis dokumen";
    if (!form.sector)       e.sector = "Pilih sektor";
    if (!file)              e.file   = "Pilih file dokumen";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handle = () => {
    if (!validate()) return;
    onSubmit({
      ...form,
      file:   file?.name || "dokumen.pdf",
      fileObj: file,
      uploader: user.name,
    });
    setForm({ title: "", type: "", sector: "", year: new Date().getFullYear().toString(), desc: "", tags: "" });
    setFile(null);
    setErrors({});
  };

  const inp = (err) => ({
    width: "100%", padding: "10px 12px",
    border: `1.5px solid ${err ? "#c62828" : "#e0e0e0"}`,
    borderRadius: 8, fontSize: 13, outline: "none",
    boxSizing: "border-box", background: "#fff",
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a3a2a" }}>Upload Dokumen</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
          Tambah dokumen baru ke repositori PETA EKONOMI
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* Judul */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Judul Dokumen *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} style={inp(errors.title)}
              placeholder="Contoh: Kajian Potensi Ekonomi Sumba Barat 2024" />
            {errors.title && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.title}</div>}
          </div>

          {/* Jenis */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Jenis Dokumen *</label>
            <select value={form.type} onChange={e => set("type", e.target.value)} style={{ ...inp(errors.type), cursor: "pointer" }}>
              <option value="">— Pilih Jenis —</option>
              {categories.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
            </select>
            {errors.type && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.type}</div>}
          </div>

          {/* Sektor */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Sektor *</label>
            <select value={form.sector} onChange={e => set("sector", e.target.value)} style={{ ...inp(errors.sector), cursor: "pointer" }}>
              <option value="">— Pilih Sektor —</option>
              {SECTORS.slice(1).map(s => <option key={s}>{s}</option>)}
            </select>
            {errors.sector && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.sector}</div>}
          </div>

          {/* Tahun */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Tahun Dokumen</label>
            <select value={form.year} onChange={e => set("year", e.target.value)} style={{ ...inp(), cursor: "pointer" }}>
              {["2024", "2023", "2022", "2021", "2020", "2019"].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Tag / Kata Kunci</label>
            <input value={form.tags} onChange={e => set("tags", e.target.value)} style={inp()}
              placeholder="pertanian, kajian, 2024 (pisah koma)" />
          </div>

          {/* Deskripsi */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Deskripsi Dokumen</label>
            <textarea value={form.desc} onChange={e => set("desc", e.target.value)} rows={3}
              style={{ ...inp(), resize: "vertical", lineHeight: 1.6 }}
              placeholder="Ringkasan isi dan tujuan dokumen ini..." />
          </div>

          {/* File */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
              File Dokumen * (PDF, DOCX, XLSX)
            </label>
            <input
              type="file" ref={fileRef}
              accept=".pdf,.doc,.docx,.xlsx"
              onChange={e => setFile(e.target.files[0])}
              style={{ display: "none" }}
            />
            <div
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${errors.file ? "#c62828" : "#c8e6c9"}`,
                borderRadius: 10, padding: 28, textAlign: "center",
                cursor: "pointer", background: file ? "#f0f7f2" : "#fafafa",
                transition: "all .15s",
              }}
            >
              <Icon name="upload" size={28} style={{ color: file ? "#1a7a4a" : "#ccc", marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: file ? "#1a7a4a" : "#999" }}>
                {file ? `✓ ${file.name}` : "Klik untuk pilih file atau seret ke sini"}
              </div>
              <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>PDF, DOCX, XLSX hingga 50 MB</div>
            </div>
            {errors.file && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.file}</div>}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => { setForm({ title: "", type: "", sector: "", year: "2024", desc: "", tags: "" }); setFile(null); setErrors({}); }}
            style={{ padding: "10px 20px", background: "#f5f5f5", color: "#555", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}
          >
            Reset
          </button>
          <button
            onClick={handle}
            style={{ padding: "10px 24px", background: "#1a7a4a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}
          >
            <Icon name="upload" size={14} /> Upload & Kirim untuk Review
          </button>
        </div>
      </div>
    </div>
  );
}
