import { useState, useRef } from "react";
import { Icon } from "./ui.jsx";
import useResponsive from "../useResponsive.js";

export default function UploadForm({ onSubmit, user, categories = [], sectors = [], bidangs = [] }) {
  const { isMobile } = useResponsive();
  const [form, setForm] = useState({
    title: "", type: "", sector: "", bidang: "",
    year: (new Date().getFullYear() + 1).toString(),
    desc: "", tags: "",
  });
  const [file,      setFile]      = useState(null);
  const [errors,    setErrors]    = useState({});
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [inputMode, setInputMode] = useState("file"); // "file" | "gdrive"
  const [gdriveUrl, setGdriveUrl] = useState("");
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title  = "Judul dokumen wajib diisi";
    if (!form.type)         e.type   = "Pilih jenis dokumen";
    if (!form.sector)       e.sector = "Pilih sektor";
    if (inputMode === "file" && !file) e.file = "Pilih file dokumen";
    if (inputMode === "gdrive" && !gdriveUrl.trim()) e.gdriveUrl = "Masukkan URL Google Drive";
    if (inputMode === "gdrive" && gdriveUrl.trim() && !/drive\.google\.com/.test(gdriveUrl)) e.gdriveUrl = "URL harus dari Google Drive";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handle = () => {
    if (!validate() || uploading) return;
    setUploading(true);
    setProgress(0);

    if (inputMode === "gdrive") {
      // Direct Google Drive URL mode — skip GAS upload
      onSubmit({ ...form, fileObj: null, fileUrl: gdriveUrl, uploader: user.name }, function (pct) {
        setProgress(pct);
        if (pct >= 100) {
          setTimeout(function () {
            setUploading(false);
            setFile(null);
            setGdriveUrl("");
            setForm({ title: "", type: "", sector: "", bidang: "", year: (new Date().getFullYear() + 1).toString(), desc: "", tags: "" });
            setProgress(0);
            setErrors({});
          }, 600);
        }
      });
    } else {
      onSubmit({ ...form, fileObj: file, uploader: user.name }, function (pct) {
        setProgress(pct);
        if (pct >= 100) {
          setTimeout(function () {
            setUploading(false);
            setFile(null);
            setForm({ title: "", type: "", sector: "", bidang: "", year: (new Date().getFullYear() + 1).toString(), desc: "", tags: "" });
            setProgress(0);
            setErrors({});
          }, 600);
        }
      });
    }
  };

  const inp = (err) => ({
    width: "100%", padding: "10px 12px",
    border: `1.5px solid ${err ? "#c62828" : "#e0e0e0"}`,
    borderRadius: 8, fontSize: 13, outline: "none",
    boxSizing: "border-box", background: "#fff",
  });

  const formatSize = (bytes) => {
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    if (bytes > 1024) return (bytes / 1024).toFixed(0) + " KB";
    return bytes + " B";
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Upload Dokumen</div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>
          Tambah dokumen baru ke repositori ARSIP DIGITAL BAPPERIDA
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e8e8e8" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 16, marginBottom: 16 }}>

          {/* Judul */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Judul Dokumen *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} style={inp(errors.title)}
              placeholder="Contoh: Kajian Potensi Pembangunan Sumba Barat 2024" disabled={uploading} />
            {errors.title && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.title}</div>}
          </div>

          {/* Jenis */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Jenis Dokumen *</label>
            <select value={form.type} onChange={e => set("type", e.target.value)} style={{ ...inp(errors.type), cursor: "pointer" }} disabled={uploading}>
              <option value="">— Pilih Jenis —</option>
              {categories.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
            </select>
            {errors.type && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.type}</div>}
          </div>

          {/* Sektor */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Sektor *</label>
            <select value={form.sector} onChange={e => set("sector", e.target.value)} style={{ ...inp(errors.sector), cursor: "pointer" }} disabled={uploading}>
              <option value="">— Pilih Sektor —</option>
              {sectors.map(s => <option key={s.id} value={s.nama}>{s.nama}</option>)}
            </select>
            {errors.sector && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.sector}</div>}
          </div>

          {/* Bidang */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Bidang</label>
            <select value={form.bidang} onChange={e => set("bidang", e.target.value)} style={{ ...inp(), cursor: "pointer" }} disabled={uploading}>
              <option value="">— Pilih Bidang —</option>
              {bidangs.map(b => <option key={b.id} value={b.nama}>{b.nama}</option>)}
            </select>
          </div>

          {/* Tahun */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Tahun Dokumen</label>
            <select value={form.year} onChange={e => set("year", e.target.value)} style={{ ...inp(), cursor: "pointer" }} disabled={uploading}>
              {["2027", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019"].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Tag / Kata Kunci</label>
            <input value={form.tags} onChange={e => set("tags", e.target.value)} style={inp()}
              placeholder="pertanian, kajian, 2024 (pisah koma)" disabled={uploading} />
          </div>

          {/* Deskripsi */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>Deskripsi Dokumen</label>
            <textarea value={form.desc} onChange={e => set("desc", e.target.value)} rows={3}
              style={{ ...inp(), resize: "vertical", lineHeight: 1.6 }}
              placeholder="Ringkasan isi dan tujuan dokumen ini..." disabled={uploading} />
          </div>

          {/* File / Google Drive URL */}
          <div style={{ gridColumn: "1 / -1" }}>
            {/* Mode Toggle */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setInputMode("file")}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s",
                  background: inputMode === "file" ? "#EFF6FF" : "#fff",
                  color: inputMode === "file" ? "#2563EB" : "#666",
                  border: inputMode === "file" ? "1.5px solid #BFDBFE" : "1.5px solid #e0e0e0",
                }}
              >
                <Icon name="upload" size={14} /> Upload File
              </button>
              <button
                type="button"
                onClick={() => setInputMode("gdrive")}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s",
                  background: inputMode === "gdrive" ? "#E8F5E9" : "#fff",
                  color: inputMode === "gdrive" ? "#2e7d32" : "#666",
                  border: inputMode === "gdrive" ? "1.5px solid #C8E6C9" : "1.5px solid #e0e0e0",
                }}
              >
                <Icon name="link" size={14} /> Link Google Drive
              </button>
            </div>

            {inputMode === "file" ? (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
                  File Dokumen * (PDF, DOCX, XLSX, JPG, PNG, WEBP)
                </label>
                <input
                  type="file" ref={fileRef}
                  accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={e => { setFile(e.target.files[0]); setProgress(0); }}
                  style={{ display: "none" }}
                />
                <div
                  onClick={() => !uploading && fileRef.current.click()}
                  style={{
                    border: `2px dashed ${errors.file ? "#c62828" : "#BFDBFE"}`,
                    borderRadius: 10, padding: 28, textAlign: "center",
                    cursor: uploading ? "not-allowed" : "pointer", background: file ? "#EFF6FF" : "#fafafa",
                    transition: "all .15s",
                  }}
                >
                  <Icon name="upload" size={28} style={{ color: file ? "#2563EB" : "#ccc", marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: file ? "#2563EB" : "#999" }}>
                    {file ? "✓ " + file.name : "Klik untuk pilih file atau seret ke sini"}
                  </div>
                  {file && (
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                      <span>{formatSize(file.size)}</span>
                      <span>{file.type || "unknown"}</span>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>PDF, DOCX, XLSX, JPG, PNG, WEBP hingga 50 MB</div>
                </div>
                {errors.file && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.file}</div>}
              </>
            ) : (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
                  URL Google Drive *
                </label>
                <input
                  value={gdriveUrl}
                  onChange={e => setGdriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/xxxxx/view?usp=sharing"
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: `1.5px solid ${errors.gdriveUrl ? "#c62828" : "#e0e0e0"}`,
                    borderRadius: 8, fontSize: 13, outline: "none",
                    boxSizing: "border-box", background: "#fff",
                  }}
                  disabled={uploading}
                />
                {errors.gdriveUrl && <div style={{ fontSize: 11, color: "#c62828", marginTop: 4 }}>{errors.gdriveUrl}</div>}
                <div style={{ fontSize: 11, color: "#888", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="eye" size={12} style={{ color: "#2e7d32" }} />
                  Dokumen akan bisa dilihat langsung di dalam aplikasi (embedded view)
                </div>
              </>
            )}

            {/* Progress bar */}
            {uploading && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 4 }}>
                  <span>Mengunggah...</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height: 6, background: "#f0f0f0", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#2563EB", borderRadius: 99, width: progress + "%", transition: "width .3s" }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => { setForm({ title: "", type: "", sector: "", year: (new Date().getFullYear() + 1).toString(), desc: "", tags: "" }); setFile(null); setErrors({}); }}
            style={{ padding: "10px 20px", background: "#f5f5f5", color: "#555", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}
            disabled={uploading}
          >
            Reset
          </button>
          <button
            onClick={handle}
            disabled={uploading}
            style={{
              padding: "10px 24px",
              background: uploading ? "#ccc" : "#2563EB",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              cursor: uploading ? "not-allowed" : "pointer",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon name="upload" size={14} />
            {uploading ? "Mengunggah " + progress + "%..." : "Upload & Kirim untuk Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
