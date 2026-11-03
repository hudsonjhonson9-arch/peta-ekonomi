import { useState, useEffect, useContext, useMemo, useRef } from "react";
import { Icon, Badge, Geser, Select, Button } from "./ui.jsx";
import { STATUS_COLOR, ROLE_COLOR } from "../data.js";
import useResponsive from "../useResponsive.js";
import { ThemeContext } from "../App.jsx";
import HighlightText from "./HighlightText.jsx";
import GrafikDataset, { resolveNamaKecamatan } from "./GrafikDataset.jsx";
import { unduhDatasetExcel } from "./BankDataPage.jsx";
import SpmPage from "./SpmPage.jsx";

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
// Snippet dari server hanya boleh berisi <mark>; escape sisanya (cegah XSS)
function safeSnippet(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/&lt;mark&gt;/g, "<mark>").replace(/&lt;\/mark&gt;/g, "</mark>");
}

export function Pencarian({ docs, onView }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [includeContent, setIncludeContent] = useState(true);
  const timerRef = useRef(null);

  const doSearch = async (query = q, contentSearch = includeContent) => {
    const ql = query.trim();
    if (!ql) return;
    setSearched(true);
    setLoading(true);
    try {
      if (contentSearch) {
        const r = await fetch(`/api/search?q=${encodeURIComponent(ql)}&limit=30`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        setResults(data.results || []);
      } else {
        // client-side metadata-only
        const qlLower = ql.toLowerCase();
        setResults(docs.filter(d =>
          d.title.toLowerCase().includes(qlLower) ||
          d.desc.toLowerCase().includes(qlLower) ||
          d.type.toLowerCase().includes(qlLower) ||
          d.sector.toLowerCase().includes(qlLower) ||
          d.tags.some(t => t.includes(qlLower)) ||
          d.uploader.toLowerCase().includes(qlLower)
        ).map(d => ({ doc: d, score: 0, hits: [] })));
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const handleInput = (val) => {
    setQ(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.trim().length >= 2 && includeContent) {
      timerRef.current = setTimeout(() => doSearch(val, true), 400);
    }
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
              onChange={e => handleInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Cari dokumen..."
              style={{ width: "100%", padding: "10px 12px 10px 38px", border: `1.5px solid ${T.primary}`, borderRadius: 8, fontSize: isMobile ? 16 : 14, outline: "none", boxSizing: "border-box", background: T.inputBg, color: T.text }}
            />
          </div>
          <button
            onClick={() => doSearch()}
            disabled={loading}
            style={{ padding: "10px 18px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer", whiteSpace: "nowrap", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Mencari..." : "Cari"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSecondary, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeContent}
              onChange={e => { setIncludeContent(e.target.checked); if (searched) doSearch(q, e.target.checked); }}
              style={{ accentColor: T.primary }}
            />
            Cari sampai isi dokumen
          </label>
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
            {loading ? "Mencari..." : results.length > 0
              ? `${results.length} dokumen ditemukan untuk "${q}"`
              : `Tidak ada dokumen untuk "${q}"`}
          </div>
          {results.map((r, i) => (
            <div
              key={r.doc.id || i}
              onClick={() => onView(r.doc)}
              style={{ background: T.card, borderRadius: 10, padding: isMobile ? 12 : 16, border: `1px solid ${T.border}`, marginBottom: 8, cursor: "pointer" }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, background: T.primaryLight, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="file" size={isMobile ? 15 : 18} style={{ color: T.primary }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: T.text, marginBottom: 2 }}><HighlightText text={r.doc.title} query={q} /></div>
                  <div style={{ fontSize: isMobile ? 11 : 12, color: T.textMuted, marginBottom: 3 }}>{r.doc.type} · {r.doc.sector} · {r.doc.year}</div>
                  <div style={{ fontSize: isMobile ? 11 : 12, color: T.textSecondary, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{r.doc.desc}</div>
                </div>
                <Badge label={r.doc.status} colors={STATUS_COLOR[r.doc.status]} />
              </div>
              {r.hits && r.hits.length > 0 && (
                <div style={{ marginTop: 10, paddingLeft: isMobile ? 44 : 50 }}>
                  {r.hits.map((h, j) => (
                    <div key={j} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: T.primary, fontWeight: 600, background: T.primaryLight, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>hlm {h.page_no}</span>
                      <span
                        style={{ fontSize: 12, color: T.textSecondary, lineHeight: "1.4" }}
                        dangerouslySetInnerHTML={{ __html: safeSnippet(h.snippet) }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!loading && results.length === 0 && (
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
  const [modePublik, setModePublik] = useState("dokumen"); // 'dokumen' | 'bankdata'
  const [verifCode, setVerifCode] = useState("");
  const [verifResult, setVerifResult] = useState(null);
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifError, setVerifError] = useState("");

  // State Katalog Bank Data Publik
  const [publikDatasets, setPublikDatasets] = useState([]);
  const [loadingDs, setLoadingDs] = useState(false);
  const [selectedDsId, setSelectedDsId] = useState(null);
  const [selectedDsDetail, setSelectedDsDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [qDs, setQDs] = useState("");
  const [kontenPublik, setKontenPublik] = useState({ berita: [], publikasi: [], tautan: [], faq: [], qna: [] });
  const [qnaForm, setQnaForm] = useState({ nama: "", email: "", instansi: "", pertanyaan: "" });
  const [qnaMsg, setQnaMsg] = useState("");

  useEffect(() => {
    fetch("/api/publik/konten")
      .then(r => (r.ok ? r.json() : {}))
      .then(d => setKontenPublik(d || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingDs(true);
    fetch("/api/publik/bankdata")
      .then(r => (r.ok ? r.json() : []))
      .then(d => setPublikDatasets(Array.isArray(d) ? d : []))
      .catch(() => setPublikDatasets([]))
      .finally(() => setLoadingDs(false));
  }, []);

  useEffect(() => {
    if (!selectedDsId) {
      setSelectedDsDetail(null);
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/publik/bankdata/${selectedDsId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setSelectedDsDetail(d))
      .catch(() => setSelectedDsDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedDsId]);

  const publik = docs.filter(d =>
    d.status === "Diarsipkan" && d.publik
  );

  const filteredDatasets = publikDatasets.filter(d => {
    if (!qDs.trim()) return true;
    const q = qDs.trim().toLowerCase();
    return `${d.nama || ""} ${d.opd_nama || ""} ${d.deskripsi || ""}`.toLowerCase().includes(q);
  });

  async function handleVerify() {
    if (!verifCode.trim()) return;
    setVerifLoading(true);
    setVerifError("");
    setVerifResult(null);
    try {
      const res = await fetch(`/api/publik/verify?code=${encodeURIComponent(verifCode.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verifikasi gagal");
      setVerifResult(data);
    } catch (e) {
      setVerifError(e.message);
    }
    setVerifLoading(false);
  }

  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${T.sidebarBg}, ${T.primary})`, borderRadius: 16, padding: isMobile ? "24px 20px" : "32px 28px", marginBottom: 20, color: "#fff" }}>
        <div style={{ fontSize: isMobile ? 19 : 22, fontWeight: 700, marginBottom: 6 }}>Portal Publik & Satu Data</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
          Akses dokumen perencanaan pembangunan dan dataset sektoral terbuka (Satu Data)
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
          BAPPERIDA Kabupaten Sumba Barat · NTT
        </div>
      </div>

      {/* Switcher Dokumen Publik vs Bank Data Terbuka */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          onClick={() => { setModePublik("dokumen"); setSelectedDsId(null); }}
          style={{
            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
            border: modePublik === "dokumen" ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
            background: modePublik === "dokumen" ? T.primary : T.card,
            color: modePublik === "dokumen" ? "#fff" : T.textSecondary,
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
        >
          <Icon name="file" size={15} /> Dokumen Publik ({publik.length})
        </button>
        <button
          onClick={() => setModePublik("bankdata")}
          style={{
            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
            border: modePublik === "bankdata" ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
            background: modePublik === "bankdata" ? T.primary : T.card,
            color: modePublik === "bankdata" ? "#fff" : T.textSecondary,
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
        >
          <Icon name="chart" size={15} /> Bank Data Terbuka ({publikDatasets.length})
        </button>
        <button
          onClick={() => { setModePublik("spm"); setSelectedDsId(null); }}
          style={{
            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
            border: modePublik === "spm" ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
            background: modePublik === "spm" ? T.primary : T.card,
            color: modePublik === "spm" ? "#fff" : T.textSecondary,
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
        >
          <Icon name="checkCircle" size={15} /> Capaian SPM & Peta Kecamatan
        </button>
        <button
          onClick={() => { setModePublik("konten"); setSelectedDsId(null); }}
          style={{
            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
            border: modePublik === "konten" ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
            background: modePublik === "konten" ? T.primary : T.card,
            color: modePublik === "konten" ? "#fff" : T.textSecondary,
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
        >
          <Icon name="world" size={15} /> Berita, Regulasi & Tanya Data
        </button>
      </div>

      {modePublik === "spm" ? (
        <SpmPage readOnly />
      ) : modePublik === "konten" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Berita & Artikel */}
          <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 12 }}>Berita & Informasi Satu Data</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              {(kontenPublik.berita || []).map(b => (
                <div key={b.id} style={{ padding: 14, borderRadius: 10, background: T.bg, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>{b.kategori} · {String(b.tanggal_terbit || "").slice(0, 10)}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 4 }}>{b.judul}</div>
                  <div style={{ fontSize: 12.5, color: T.textSecondary, marginTop: 6 }}>{b.ringkasan || b.isi}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Katalog Produk Hukum, SK Tim & Publikasi Kajian */}
          <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 12 }}>Produk Hukum, SK Tim Satu Data & Publikasi Kajian</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
              {(kontenPublik.publikasi || []).map(p => (
                <div key={p.id} style={{ padding: 14, borderRadius: 10, background: T.bg, border: `1px solid ${T.border}` }}>
                  <Badge label={`${p.jenis} (${p.tahun})`} colors={{ bg: "#EFF6FF", text: "#2563EB" }} />
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, marginTop: 8 }}>{p.judul}</div>
                  {p.nomor && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 3 }}>{p.nomor}</div>}
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 6 }}>{p.deskripsi}</div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ & Form Tanya Data Masyarakat */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1fr", gap: 16 }}>
            <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 12 }}>FAQ — Pertanyaan yang Sering Diajukan</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(kontenPublik.faq || []).map(f => (
                  <div key={f.id} style={{ padding: 12, borderRadius: 8, background: T.bg, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{f.pertanyaan}</div>
                    <div style={{ fontSize: 12.5, color: T.textSecondary, marginTop: 4 }}>{f.jawaban}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>Tanya Data & Buku Tamu Masyarakat</div>
              <div style={{ fontSize: 12.5, color: T.textSecondary, marginBottom: 12 }}>
                Ajukan permohonan data atau pertanyaan kepada Tim Walidata BAPPERIDA
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  value={qnaForm.nama}
                  onChange={e => setQnaForm(f => ({ ...f, nama: e.target.value }))}
                  placeholder="Nama Lengkap *"
                  style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 13 }}
                />
                <input
                  value={qnaForm.email}
                  onChange={e => setQnaForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Alamat Email *"
                  style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 13 }}
                />
                <input
                  value={qnaForm.instansi}
                  onChange={e => setQnaForm(f => ({ ...f, instansi: e.target.value }))}
                  placeholder="Asal Instansi / Universitas / Umum"
                  style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 13 }}
                />
                <textarea
                  rows={3}
                  value={qnaForm.pertanyaan}
                  onChange={e => setQnaForm(f => ({ ...f, pertanyaan: e.target.value }))}
                  placeholder="Tuliskan pertanyaan atau kebutuhan data Anda *"
                  style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 13 }}
                />
                <Button
                  variant="primary"
                  onClick={async () => {
                    if (!qnaForm.nama || !qnaForm.email || !qnaForm.pertanyaan) {
                      setQnaMsg("Nama, email, dan pertanyaan wajib diisi.");
                      return;
                    }
                    const res = await fetch("/api/publik/qna", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(qnaForm),
                    });
                    await fetch("/api/publik/visitor", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ nama: qnaForm.nama, email: qnaForm.email, instansi: qnaForm.instansi, keperluan: qnaForm.pertanyaan, aksi: "tanya_data" }),
                    }).catch(() => {});
                    if (res.ok) {
                      setQnaMsg("Pertanyaan Anda berhasil dikirim ke Tim Walidata.");
                      setQnaForm({ nama: "", email: "", instansi: "", pertanyaan: "" });
                    } else {
                      setQnaMsg("Gagal mengirim pertanyaan.");
                    }
                  }}
                >
                  Kirim Pertanyaan
                </Button>
                {qnaMsg && <div style={{ fontSize: 12, fontWeight: 600, color: T.primary }}>{qnaMsg}</div>}
              </div>
            </div>
          </div>
        </div>
      ) : modePublik === "dokumen" ? (
        <>
          {/* Verifikasi Dokumen */}
          <div style={{ background: T.card, borderRadius: 12, padding: 20, marginBottom: 24, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              Verifikasi Dokumen
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, marginBottom: 12 }}>
              Masukkan kode verifikasi untuk memeriksa keaslian dokumen
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={verifCode}
                onChange={e => setVerifCode(e.target.value)}
                placeholder="Contoh: A3K9-M2X7"
                maxLength={9}
                style={{ flex: 1, padding: "10px 14px", background: T.inputBg, border: `1.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 14, fontFamily: "monospace", letterSpacing: 2, outline: "none" }}
                onKeyDown={e => e.key === "Enter" && handleVerify()}
              />
              <button onClick={handleVerify} disabled={verifLoading}
                style={{ padding: "10px 20px", background: T.primary, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", opacity: verifLoading ? 0.6 : 1 }}>
                {verifLoading ? "Memeriksa..." : "Verifikasi"}
              </button>
            </div>

            {verifError && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, borderRadius: 8, color: T.danger, fontSize: 13 }}>
                {verifError}
              </div>
            )}

            {verifResult && (
              <div style={{ marginTop: 12, padding: "14px", background: T.successBg, border: `1px solid ${T.successBorder}`, borderRadius: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18, color: T.success }}>&#10003;</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.success }}>Dokumen Terverifikasi</span>
                </div>
                <div style={{ fontSize: 13, color: T.text, marginBottom: 4 }}>{verifResult.doc?.judul}</div>
                <div style={{ fontSize: 12, color: T.textSecondary }}>Tipe: {verifResult.doc?.file_type} | Versi: {verifResult.doc?.versi}</div>
                {verifResult.share?.expires_at && (
                  <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
                    Berlaku hingga: {new Date(verifResult.share.expires_at).toLocaleString("id-ID")}
                  </div>
                )}
                {verifResult.expired && (
                  <div style={{ fontSize: 12, color: T.danger, marginTop: 4 }}>Catatan: Tautan ini sudah kedaluwarsa</div>
                )}
              </div>
            )}
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
        </>
      ) : selectedDsId ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
            <button
              onClick={() => setSelectedDsId(null)}
              style={{
                padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`,
                background: T.card, color: T.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} /> Kembali ke Katalog Dataset
            </button>
            {selectedDsDetail && (
              <button
                onClick={() => unduhDatasetExcel(selectedDsDetail, selectedDsDetail.fields || [], selectedDsDetail.rows || [])}
                style={{
                  padding: "9px 16px", borderRadius: 8, border: "none",
                  background: T.primary, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <Icon name="download" size={14} /> Unduh Data Excel (.xlsx)
              </button>
            )}
          </div>

          {loadingDetail ? (
            <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Memuat dataset publik...</div>
          ) : !selectedDsDetail ? (
            <div style={{ padding: 24, color: T.danger }}>Dataset tidak ditemukan.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>{selectedDsDetail.nama}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.primary, marginBottom: 6 }}>
                  {selectedDsDetail.opd_nama} · Frekuensi: {selectedDsDetail.frekuensi}
                  {selectedDsDetail.satuan ? ` · Satuan: ${selectedDsDetail.satuan}` : ""}
                </div>
                {selectedDsDetail.deskripsi && (
                  <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>{selectedDsDetail.deskripsi}</div>
                )}
              </div>

              <GrafikDataset
                fields={selectedDsDetail.fields || []}
                rows={selectedDsDetail.rows || []}
                satuanDefault={selectedDsDetail.satuan || ""}
              />

              <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, padding: 16, overflowX: "auto" }}>
                {(() => {
                  const hasKecamatanField = (selectedDsDetail.fields || []).some(
                    f => f.nama_field.toLowerCase().includes("kecamatan") || f.label.toLowerCase().includes("kecamatan")
                  );
                  return (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>
                        Tabel Data ({(selectedDsDetail.rows || []).length} Baris)
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: T.surfaceHover, textAlign: "left" }}>
                            <th style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>Tahun</th>
                            <th style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>Periode</th>
                            {!hasKecamatanField && (
                              <th style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>Kecamatan</th>
                            )}
                      {(selectedDsDetail.fields || []).map(f => (
                        <th key={f.id} style={{ padding: "9px 10px", borderBottom: `1px solid ${T.border}`, color: T.text }}>
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedDsDetail.rows || []).map(r => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: "9px 10px", fontWeight: 700, color: T.text }}>{r.tahun}</td>
                        <td style={{ padding: "9px 10px", color: T.textSecondary }}>{r.periode || "Tahunan"}</td>
                        {!hasKecamatanField && (
                          <td style={{ padding: "9px 10px", color: T.text, fontWeight: 500 }}>
                            {resolveNamaKecamatan(r.wilayah_kode, r.data) || r.wilayah_kode || "—"}
                          </td>
                        )}
                        {(selectedDsDetail.fields || []).map(f => (
                          <td key={f.id} style={{ padding: "9px 10px", color: T.text, fontVariantNumeric: "tabular-nums" }}>
                            {r.data?.[f.nama_field] !== undefined && r.data?.[f.nama_field] !== null
                              ? (typeof r.data[f.nama_field] === "number" ? r.data[f.nama_field].toLocaleString("id-ID") : String(r.data[f.nama_field]))
                              : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                      </table>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 16, position: "relative" }}>
            <Icon name="search" size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
            <input
              value={qDs}
              onChange={e => setQDs(e.target.value)}
              placeholder="Cari dataset publik berdasarkan judul atau OPD..."
              style={{
                width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
                border: `1.5px solid ${T.border}`, background: T.card, color: T.text,
                fontSize: 13.5, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {loadingDs ? (
            <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Memuat katalog dataset publik...</div>
          ) : filteredDatasets.length === 0 ? (
            <div style={{ background: T.card, borderRadius: 12, padding: 36, textAlign: "center", border: `1px solid ${T.border}`, color: T.textMuted }}>
              Belum ada dataset terbuka yang dipublikasikan.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12 }}>
              {filteredDatasets.map(d => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDsId(d.id)}
                  style={{
                    background: T.card, borderRadius: 12, padding: 18,
                    border: `1px solid ${T.border}`, cursor: "pointer",
                    display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{d.nama}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.primary, marginBottom: 6 }}>{d.opd_nama}</div>
                    {d.deskripsi && (
                      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.45 }}>{d.deskripsi}</div>
                    )}
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    paddingTop: 10, borderTop: `1px solid ${T.border}`, fontSize: 11.5, color: T.textMuted,
                  }}>
                    <span>
                      {d.jumlah_baris || 0} baris data
                      {d.tahun_min ? ` · ${d.tahun_min}${d.tahun_max && d.tahun_max !== d.tahun_min ? `–${d.tahun_max}` : ""}` : ""}
                    </span>
                    <span style={{ color: T.primary, fontWeight: 700 }}>Lihat Tabel & Grafik ›</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
    unit: "", status: "AKTIF", password: "", opd_id: ""
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [bidangList, setBidangList] = useState([]);
  const [opdList, setOpdList] = useState([]);
  const [roleList, setRoleList] = useState([]);

  useEffect(() => {
    fetch('/api/bidang').then(r => r.json()).then(d => setBidangList(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/bankdata/opd').then(r => r.json()).then(d => setOpdList(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/roles').then(r => r.json()).then(d => setRoleList(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const openAdd = () => {
    setForm({ id: "", nip: "", name: "", role: "Staf", unit: bidangList[0]?.nama || "", status: "AKTIF", password: "", opd_id: "" });
    setErrors({});
    setIsEdit(false);
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setForm({ id: u.id, nip: u.nip, name: u.name, role: u.role, unit: u.unit, status: u.status, password: "", opd_id: u.opd_id ? String(u.opd_id) : "" });
    setErrors({});
    setIsEdit(true);
    setModalOpen(true);
  };

  const validate = () => {
    const e = {};
    if (!form.nip.trim()) e.nip = "NIP wajib diisi";
    if (!form.name.trim()) e.name = "Nama Lengkap wajib diisi";
    if (!isEdit && !form.password.trim()) e.password = "Password wajib diisi";
    const roleObj = roleList.find(r => r.nama === form.role);
    const butuhOpd = roleObj ? Boolean(roleObj.opd_scoped) : (form.role === "Operator Bank Data" || form.role === "Produsen Data");
    if (butuhOpd && !form.opd_id) e.opd_id = `OPD wajib dipilih untuk peran ${form.role}`;
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
  const ambilWarnaRole = (roleName) => {
    const found = roleList.find(r => r.nama === roleName);
    if (found && found.warna_bg && found.warna_text) {
      return { bg: found.warna_bg, text: found.warna_text };
    }
    return ROLE_COLOR[roleName] || { bg: "#F1F5F9", text: "#475569" };
  };

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
                <div>
                  <Badge label={u.role} colors={ambilWarnaRole(u.role)} />
                  {u.opd_nama && (
                    <div style={{ fontSize: 11, color: T.primary, fontWeight: 600, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      OPD: {u.opd_nama}
                    </div>
                  )}
                </div>
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
                <Badge label={u.role} colors={ambilWarnaRole(u.role)} />
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
                <button onClick={() => openEdit(u)} style={{ ...s.btnBase, flex: 1, padding: "9px 12px", background: T.bg, border: `1px solid ${T.border}`, color: T.textSecondary, fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                  onMouseLeave={e => e.currentTarget.style.background = T.bg}>
                  <Icon name="edit" size={13} /> Edit
                </button>
                <button onClick={() => handleDelete(u)} style={{ ...s.btnBase, flex: 1, padding: "9px 12px", background: T.dangerBg, border: `1px solid ${T.dangerBorder}`, color: T.danger, fontSize: 13 }}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1200, padding: isMobile ? 0 : 20 }}
          onClick={() => setModalOpen(false)}>
          <Geser aktif={!isMobile} onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: isMobile ? "16px 16px 0 0" : T.radiusLg,
            padding: isMobile ? "24px 20px 80px" : "28px 32px",
            width: isMobile ? "100%" : 460, maxHeight: isMobile ? "85vh" : "auto", overflowY: "auto",
            boxShadow: T.shadowLg, animation: isMobile ? "slideUp .25s ease" : "fadeIn .15s ease",
          }}>
            {/* Modal Header */}
            <div data-pegang style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
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
                  <Select
                    fullWidth
                    size="lg"
                    value={form.role}
                    onChange={v => setForm({ ...form, role: v })}
                    options={(roleList.length > 0 ? roleList.map(r => ({ value: r.nama, label: r.nama })) : [
                      { value: "Admin", label: "Admin" },
                      { value: "Walidata", label: "Walidata" },
                      { value: "Reviewer", label: "Reviewer" },
                      { value: "Operator Bank Data", label: "Operator Bank Data" },
                      { value: "Produsen Data", label: "Produsen Data" },
                      { value: "Staf", label: "Staf" },
                    ])}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Status <span style={{ color: T.danger }}>*</span></label>
                  <Select fullWidth size="lg" value={form.status} onChange={v => setForm({ ...form, status: v })} options={["AKTIF", "TUGAS", "NONAKTIF"].map(st => ({ value: st, label: st }))}
                    onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                    onBlur={() => {}} />
                </div>
              </div>

              {/* OPD untuk role yang membutuhkan pemetaan OPD */}
              {(() => {
                const rDipilih = roleList.find(r => r.nama === form.role);
                const butuhOpd = rDipilih ? Boolean(rDipilih.opd_scoped) : (form.role === "Operator Bank Data" || form.role === "Produsen Data");
                if (!butuhOpd) return null;
                return (
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>
                      OPD yang Dikelola (Perangkat Daerah) <span style={{ color: T.danger }}>*</span>
                    </label>
                    <Select
                      fullWidth
                      size="lg"
                      value={form.opd_id || ""}
                      error={!!errors.opd_id}
                      placeholder="— Pilih OPD —"
                      onChange={val => {
                        const found = opdList.find(o => String(o.id) === String(val));
                        setForm({ ...form, opd_id: val, unit: found?.nama || form.unit });
                      }}
                      options={[
                        { value: "", label: "— Pilih OPD —" },
                        ...opdList.map(o => ({ value: String(o.id), label: o.nama })),
                      ]}
                    />
                    {errors.opd_id && <div style={{ fontSize: 12, color: T.danger, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><Icon name="x" size={12} /> {errors.opd_id}</div>}
                  </div>
                );
              })()}

              {/* Unit Kerja */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Unit Kerja <span style={{ color: T.danger }}>*</span></label>
                <Select fullWidth size="lg" value={form.unit} placeholder="— Pilih Bidang —" onChange={v => setForm({ ...form, unit: v })} options={[{ value: "", label: "— Pilih Bidang —" }, ...bidangList.map(b => ({ value: b.nama, label: b.nama })), ...(form.unit && !bidangList.some(b => b.nama === form.unit) ? [{ value: form.unit, label: form.unit }] : [])]}

                  onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = T.focusRing; }}
                  onBlur={() => {}} />




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
              <button onClick={() => setModalOpen(false)} style={{ ...s.btnBase, padding: "10px 18px", background: T.surfaceHover, color: T.textSecondary, fontSize: 13 }}
                onMouseEnter={e => e.currentTarget.style.background = T.borderHover}
                onMouseLeave={e => e.currentTarget.style.background = T.surfaceHover}>
                Batal
              </button>
              <button onClick={handleSubmit} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </Geser>
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
    if (!form.name.trim()) e.name = "Nama Jenis Dokumen wajib diisi";
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>Jenis Dokumen</h1>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1200, padding: isMobile ? 0 : 20 }}
          onClick={() => setModalOpen(false)}>
          <Geser aktif={!isMobile} onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: isMobile ? "16px 16px 0 0" : T.radiusLg,
            padding: isMobile ? "24px 20px 80px" : "28px 32px",
            width: isMobile ? "100%" : 420, maxHeight: isMobile ? "85vh" : "auto",
            boxShadow: T.shadowLg, animation: isMobile ? "slideUp .25s ease" : "fadeIn .15s ease",
          }}>
            {/* Modal Header */}
            <div data-pegang style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: 0 }}>{isEdit ? "Edit Jenis Dokumen" : "Tambah Jenis Dokumen"}</h2>
              <button onClick={() => setModalOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.surfaceHover; e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textMuted; }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Form */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.text, display: "block", marginBottom: 6 }}>Nama Jenis Dokumen <span style={{ color: T.danger }}>*</span></label>
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
              <button onClick={() => setModalOpen(false)} style={{ ...s.btnBase, padding: "10px 18px", background: T.surfaceHover, color: T.textSecondary, fontSize: 13 }}
                onMouseEnter={e => e.currentTarget.style.background = T.borderHover}
                onMouseLeave={e => e.currentTarget.style.background = T.surfaceHover}>
                Batal
              </button>
              <button onClick={handleSubmit} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </Geser>
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
          ) : sectors.map(sec => (
            <div key={sec.id} style={{ ...s.cardStyle, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, background: T.primaryLight, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="layers" size={18} style={{ color: T.primary }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sec.nama}</div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(sec)} style={s.btnGhost}>
                  <Icon name="edit" size={13} /> Edit
                </button>
                <button onClick={() => handleDelete(sec)} style={s.btnDanger}>
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
            sectors.map((sec, i) => (
              <div key={sec.id}
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
                  <span style={{ fontSize: 14, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sec.nama}</span>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => openEdit(sec)} style={s.btnGhost}
                    onMouseEnter={e => e.currentTarget.style.background = T.primaryLight}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Icon name="edit" size={13} /> Edit
                  </button>
                  <button onClick={() => handleDelete(sec)} style={s.btnDanger}
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1200, padding: isMobile ? 0 : 20 }}
          onClick={() => setModalOpen(false)}>
          <Geser aktif={!isMobile} onClick={e => e.stopPropagation()} style={{
            background: T.card, borderRadius: isMobile ? "16px 16px 0 0" : T.radiusLg,
            padding: isMobile ? "24px 20px 80px" : "28px 32px",
            width: isMobile ? "100%" : 420, maxHeight: isMobile ? "85vh" : "auto",
            boxShadow: T.shadowLg, animation: isMobile ? "slideUp .25s ease" : "fadeIn .15s ease",
          }}>
            {/* Modal Header */}
            <div data-pegang style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
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
              <button onClick={() => setModalOpen(false)} style={{ ...s.btnBase, padding: "10px 18px", background: T.surfaceHover, color: T.textSecondary, fontSize: 13 }}
                onMouseEnter={e => e.currentTarget.style.background = T.borderHover}
                onMouseLeave={e => e.currentTarget.style.background = T.surfaceHover}>
                Batal
              </button>
              <button onClick={handleSubmit} disabled={loading} style={{ ...s.btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </Geser>
        </div>
      )}
    </div>
  );
}
