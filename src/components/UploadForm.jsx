import { useState, useRef } from "react";
import { Icon } from "./ui.jsx";
import useResponsive from "../useResponsive.js";

const T = {
  font: "'Segoe UI', system-ui, -apple-system, sans-serif",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E4ECFC",
  borderHover: "#C7D7FC",
  primary: "#2563EB",
  primaryHover: "#1D4ED8",
  primaryLight: "#EFF6FF",
  primaryRing: "rgba(37,99,235,0.15)",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  success: "#059669",
  successBg: "#ECFDF5",
  radius: 8,
  radiusLg: 12,
  shadowSm: "0 1px 2px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 6px -1px rgba(0,0,0,0.07)",
};

const cardStyle = {
  background: T.card,
  borderRadius: T.radiusLg,
  border: `1px solid ${T.border}`,
  boxShadow: T.shadowSm,
};

export default function UploadForm({ onSubmit, user, categories = [], sectors = [], bidangs = [] }) {
  const { isMobile } = useResponsive();
  const [form, setForm] = useState({
    title: "", type: "", sector: "", bidang: "",
    year: (new Date().getFullYear() + 1).toString(),
    desc: "", tags: "",
  });
  const [files,     setFiles]     = useState([]);
  const [errors,    setErrors]    = useState({});
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [inputMode, setInputMode] = useState("file");
  const [gdriveUrl, setGdriveUrl] = useState("");
  const [dragOver,  setDragOver]  = useState(false);
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title  = "Judul dokumen wajib diisi";
    if (!form.type)         e.type   = "Pilih jenis dokumen";
    if (!form.sector)       e.sector = "Pilih sektor";
    if (inputMode === "file" && !files.length) e.file = "Pilih minimal satu file dokumen";
    if (inputMode === "gdrive" && !gdriveUrl.trim()) e.gdriveUrl = "Masukkan URL Google Drive";
    if (inputMode === "gdrive" && gdriveUrl.trim() && !/drive\.google\.com/.test(gdriveUrl)) e.gdriveUrl = "URL harus dari Google Drive";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetForm = () => {
    setForm({ title: "", type: "", sector: "", bidang: "", year: (new Date().getFullYear() + 1).toString(), desc: "", tags: "" });
    setFiles([]);
    setErrors({});
    setGdriveUrl("");
  };

  const handle = () => {
    if (!validate() || uploading) return;
    setUploading(true);
    setProgress(0);

    const payload = inputMode === "gdrive"
      ? { ...form, fileObjs: null, fileUrl: gdriveUrl, uploader: user.name }
      : { ...form, fileObjs: files, uploader: user.name };

    onSubmit(payload, function (pct) {
      setProgress(pct);
      if (pct >= 100) {
        setTimeout(() => {
          setUploading(false);
          resetForm();
          setProgress(0);
        }, 600);
      }
    });
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!uploading && e.dataTransfer.files?.length) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
      setProgress(0);
    }
  };

  const formatSize = (bytes) => {
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    if (bytes > 1024) return (bytes / 1024).toFixed(0) + " KB";
    return bytes + " B";
  };

  const inpStyle = (err) => ({
    width: "100%",
    padding: "11px 14px",
    border: `1.5px solid ${err ? T.danger : T.border}`,
    borderRadius: T.radius,
    fontSize: 14,
    fontFamily: T.font,
    outline: "none",
    boxSizing: "border-box",
    background: T.card,
    color: T.text,
    transition: "border-color 0.15s, box-shadow 0.15s",
  });

  const labelStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: T.textSecondary,
    display: "block",
    marginBottom: 6,
  };

  const requiredMark = { color: T.danger, marginLeft: 2 };

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh", padding: isMobile ? "12px 16px 16px" : "20px 36px 28px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: T.text, letterSpacing: "-0.01em" }}>
          Upload Dokumen
        </div>
        <div style={{ fontSize: 14, color: T.textSecondary, marginTop: 4 }}>
          Tambah dokumen baru ke repositori ARSIP DIGITAL BAPPERIDA
        </div>
      </div>

      <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
        {/* ── Section: Informasi Dokumen ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: T.primary }} />
            Informasi Dokumen
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 14 : 16 }}>
            {/* Judul */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                Judul Dokumen <span style={requiredMark}>*</span>
              </label>
              <input
                value={form.title}
                onChange={e => set("title", e.target.value)}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryRing}`; }}
                onBlur={e => { e.target.style.borderColor = errors.title ? T.danger : T.border; e.target.style.boxShadow = "none"; }}
                style={inpStyle(errors.title)}
                placeholder="Contoh: Kajian Potensi Pembangunan Sumba Barat 2024"
                disabled={uploading}
              />
              {errors.title && <div style={{ fontSize: 12, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="x" size={12} /> {errors.title}
              </div>}
            </div>

            {/* Jenis */}
            <div>
              <label style={labelStyle}>
                Jenis Dokumen <span style={requiredMark}>*</span>
              </label>
              <select
                value={form.type}
                onChange={e => set("type", e.target.value)}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryRing}`; }}
                onBlur={e => { e.target.style.borderColor = errors.type ? T.danger : T.border; e.target.style.boxShadow = "none"; }}
                style={{ ...inpStyle(errors.type), cursor: "pointer" }}
                disabled={uploading}
              >
                <option value="">— Pilih Jenis —</option>
                {categories.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
              </select>
              {errors.type && <div style={{ fontSize: 12, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="x" size={12} /> {errors.type}
              </div>}
            </div>

            {/* Sektor */}
            <div>
              <label style={labelStyle}>
                Sektor <span style={requiredMark}>*</span>
              </label>
              <select
                value={form.sector}
                onChange={e => set("sector", e.target.value)}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryRing}`; }}
                onBlur={e => { e.target.style.borderColor = errors.sector ? T.danger : T.border; e.target.style.boxShadow = "none"; }}
                style={{ ...inpStyle(errors.sector), cursor: "pointer" }}
                disabled={uploading}
              >
                <option value="">— Pilih Sektor —</option>
                {sectors.map(s => <option key={s.id} value={s.nama}>{s.nama}</option>)}
              </select>
              {errors.sector && <div style={{ fontSize: 12, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="x" size={12} /> {errors.sector}
              </div>}
            </div>

            {/* Bidang */}
            <div>
              <label style={labelStyle}>Bidang</label>
              <select
                value={form.bidang}
                onChange={e => set("bidang", e.target.value)}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryRing}`; }}
                onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                style={{ ...inpStyle(), cursor: "pointer" }}
                disabled={uploading}
              >
                <option value="">— Pilih Bidang —</option>
                {bidangs.map(b => <option key={b.id} value={b.nama}>{b.nama}</option>)}
              </select>
            </div>

            {/* Tahun */}
            <div>
              <label style={labelStyle}>Tahun Dokumen</label>
              <select
                value={form.year}
                onChange={e => set("year", e.target.value)}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryRing}`; }}
                onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                style={{ ...inpStyle(), cursor: "pointer" }}
                disabled={uploading}
              >
                {["2027", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019"].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>

            {/* Tags */}
            <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
              <label style={labelStyle}>Tag / Kata Kunci</label>
              <input
                value={form.tags}
                onChange={e => set("tags", e.target.value)}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryRing}`; }}
                onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                style={inpStyle()}
                placeholder="pertanian, kajian, 2024 (pisah koma)"
                disabled={uploading}
              />
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>Pisahkan dengan koma</div>
            </div>

            {/* Deskripsi */}
            <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
              <label style={labelStyle}>Deskripsi Dokumen</label>
              <textarea
                value={form.desc}
                onChange={e => set("desc", e.target.value)}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryRing}`; }}
                onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = "none"; }}
                rows={3}
                style={{ ...inpStyle(), resize: "vertical", lineHeight: 1.6 }}
                placeholder="Ringkasan isi dan tujuan dokumen ini..."
                disabled={uploading}
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.border, margin: "24px 0" }} />

        {/* ── Section: File Dokumen ── */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: T.primary }} />
            File Dokumen
          </div>

          {/* Mode Toggle */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Metode Unggah</label>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setInputMode("file")}
                style={{
                  flex: 1, padding: isMobile ? "10px 10px" : "10px 14px", borderRadius: T.radius, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  transition: "all 0.15s",
                  background: inputMode === "file" ? T.primaryLight : T.card,
                  color: inputMode === "file" ? T.primary : T.textSecondary,
                  border: `1.5px solid ${inputMode === "file" ? T.primary : T.border}`,
                }}
              >
                <Icon name="upload" size={15} /> Upload File dari Komputer
              </button>
              <button
                type="button"
                onClick={() => setInputMode("gdrive")}
                style={{
                  flex: 1, padding: isMobile ? "10px 10px" : "10px 14px", borderRadius: T.radius, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  transition: "all 0.15s",
                  background: inputMode === "gdrive" ? T.successBg : T.card,
                  color: inputMode === "gdrive" ? T.success : T.textSecondary,
                  border: `1.5px solid ${inputMode === "gdrive" ? T.success : T.border}`,
                }}
              >
                <Icon name="link" size={15} /> Link Google Drive
              </button>
            </div>
          </div>

          {inputMode === "file" ? (
            <>
              <label style={labelStyle}>
                File Dokumen <span style={requiredMark}>*</span>
              </label>
              <input
                type="file" ref={fileRef}
                multiple
                accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files)]); setProgress(0); }}
                style={{ display: "none" }}
              />
              <div
                onClick={() => !uploading && fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                style={{
                  border: `2px dashed ${errors.file ? T.danger : dragOver ? T.primary : files.length ? T.primary : T.border}`,
                  borderRadius: T.radiusLg,
                  padding: files.length ? "20px 24px" : "24px 24px",
                  textAlign: "center",
                  cursor: uploading ? "not-allowed" : "pointer",
                  background: dragOver ? T.primaryLight : files.length ? T.primaryLight : "#FAFBFC",
                  transition: "all 0.2s",
                }}
              >
                {files.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", width: "100%" }}>
                    {files.map((f, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 10, background: T.primaryLight,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <Icon name="file" size={20} style={{ color: T.primary }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.name}
                          </div>
                          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2, display: "flex", gap: 8 }}>
                            <span>{formatSize(f.size)}</span>
                            <span>·</span>
                            <span>{f.type || "unknown"}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter((_, i) => i !== idx)); }}
                          style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${T.border}`, background: T.card, cursor: "pointer", fontSize: 12, color: T.danger }}
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); fileRef.current.click(); }}
                      style={{ padding: "8px 14px", borderRadius: 6, border: `1px dashed ${T.border}`, background: "transparent", cursor: "pointer", fontSize: 12, color: T.primary, fontWeight: 600, marginTop: 4 }}
                    >
                      + Tambah File Lain
                    </button>
                  </div>
                ) : (
                  <>
                    <Icon name="upload" size={30} style={{ color: dragOver ? T.primary : T.textMuted, marginBottom: 12 }} />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); fileRef.current.click(); }}
                      style={{
                        background: T.primary, color: "#fff", border: "none", borderRadius: T.radius,
                        padding: "11px 26px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                        fontFamily: T.font, display: "flex", alignItems: "center", gap: 8, margin: "0 auto",
                        boxShadow: "0 1px 3px rgba(37,99,235,0.3)",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.primaryHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = T.primary; }}
                    >
                      <Icon name="upload" size={16} /> Pilih File
                    </button>
                    <div style={{ fontSize: 13, color: dragOver ? T.primary : T.textSecondary, marginTop: 12, fontWeight: 500 }}>
                      {dragOver ? "Lepaskan file di sini" : "atau seret file ke kotak ini"}
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
                      PDF, DOCX, XLSX, JPG, PNG, WEBP · Bisa pilih lebih dari satu file
                    </div>
                  </>
                )}
              </div>
              {errors.file && <div style={{ fontSize: 12, color: T.danger, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="x" size={12} /> {errors.file}
              </div>}
            </>
          ) : (
            <>
              <label style={labelStyle}>
                URL Google Drive <span style={requiredMark}>*</span>
              </label>
              <input
                value={gdriveUrl}
                onChange={e => setGdriveUrl(e.target.value)}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryRing}`; }}
                onBlur={e => { e.target.style.borderColor = errors.gdriveUrl ? T.danger : T.border; e.target.style.boxShadow = "none"; }}
                placeholder="https://drive.google.com/file/d/xxxxx/view?usp=sharing"
                style={inpStyle(errors.gdriveUrl)}
                disabled={uploading}
              />
              {errors.gdriveUrl && <div style={{ fontSize: 12, color: T.danger, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <Icon name="x" size={12} /> {errors.gdriveUrl}
              </div>}
              <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="eye" size={14} style={{ color: T.success }} />
                Dokumen akan bisa dilihat langsung di dalam aplikasi (embedded view)
              </div>
            </>
          )}

          {/* Progress bar */}
          {uploading && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>
                <span>Mengunggah...</span>
                <span style={{ fontWeight: 600 }}>{progress}%</span>
              </div>
              <div style={{ height: 8, background: T.border, borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: `linear-gradient(90deg, ${T.primary}, #60A5FA)`,
                  borderRadius: 99, width: progress + "%", transition: "width 0.3s ease",
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: T.border, margin: "24px 0" }} />

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            onClick={resetForm}
            disabled={uploading}
            style={{
              padding: "11px 20px",
              background: T.card,
              color: T.textSecondary,
              border: `1.5px solid ${T.border}`,
              borderRadius: T.radius,
              fontSize: 13,
              fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
              fontFamily: T.font,
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { if (!uploading) { e.currentTarget.style.borderColor = T.borderHover; e.currentTarget.style.background = T.bg; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.card; }}
          >
            Reset
          </button>
          <button
            onClick={handle}
            disabled={uploading}
            style={{
              padding: "11px 24px",
              background: uploading ? T.textMuted : T.primary,
              color: "#fff",
              border: "none",
              borderRadius: T.radius,
              fontSize: 13,
              fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
              fontFamily: T.font,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s",
              boxShadow: uploading ? "none" : "0 1px 3px rgba(37,99,235,0.3)",
            }}
            onMouseEnter={e => { if (!uploading) { e.currentTarget.style.background = T.primaryHover; e.currentTarget.style.boxShadow = "0 2px 6px rgba(37,99,235,0.4)"; }}}
            onMouseLeave={e => { if (!uploading) { e.currentTarget.style.background = T.primary; e.currentTarget.style.boxShadow = "0 1px 3px rgba(37,99,235,0.3)"; }}}
          >
            <Icon name="upload" size={16} />
            {uploading ? "Mengunggah " + progress + "%..." : "Upload & Kirim untuk Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
