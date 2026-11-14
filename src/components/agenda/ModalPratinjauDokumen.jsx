import { useState, useContext, useMemo } from "react";
import { ThemeContext } from "../../App.jsx";
import { useIsDark, Modal } from "../ui.jsx";
import { Button } from "../customControls.jsx";
import {
  resolveKopConfig,
  resolvePaperConfig,
  bangunHtmlSPT,
  bangunHtmlSPPD,
  unduhSuratTugasDocx,
  unduhSppdDocx,
  unduhSuratTugasPdf,
  unduhSppdPdf,
  unduhBundleSppdZip,
  cetakSuratTugasWindow,
  cetakSppdWindow
} from "../../utils/sppdDocxGenerator.js";

const OPSI_ALAT_ANGKUT = [
  "Pesawat Udara (Ekonomi)",
  "Kendaraan Dinas Roda 4",
  "Kendaraan Dinas Roda 2",
  "Angkutan Darat / Travel",
  "Kapal Laut / Feri"
];

/**
 * ModalPratinjauDokumen — Live A4 / F4 preview SPT & SPPD per personil
 * Props:
 *   item             — data SPPD/SPT record
 *   defaultTab       — "spt" | "sppd"
 *   defaultPersonIdx — index personil awal
 *   onClose          — callback tutup modal
 *   showToast        — fn(msg) untuk notifikasi
 */
export default function ModalPratinjauDokumen({ item, defaultTab = "spt", defaultPersonIdx = 0, onClose, showToast }) {
  const { T } = useContext(ThemeContext);
  const isDark = useIsDark();

  const initialKop = useMemo(() => resolveKopConfig(item).key, [item]);
  const [tab, setTab] = useState(defaultTab); // "spt" | "sppd"
  const [personIdx, setPersonIdx] = useState(defaultPersonIdx);
  const [kopSurat, setKopSurat] = useState(initialKop); // "BAPPERIDA" | "SEKDA"
  const [paperSize, setPaperSize] = useState("A4"); // "A4" | "F4"
  const [alatAngkut, setAlatAngkut] = useState(item?.alat_angkutan || (item?.jenis_sppd === "LUAR_DAERAH" ? "Pesawat Udara (Ekonomi)" : "Kendaraan Dinas Roda 4"));
  const [busy, setBusy] = useState(false);

  const paperConfig = useMemo(() => resolvePaperConfig(paperSize), [paperSize]);

  const pengikutList = useMemo(() => {
    try {
      return Array.isArray(item.pengikut) ? item.pengikut : JSON.parse(item.pengikut || "[]");
    } catch (_) { return []; }
  }, [item]);

  const wewenangObj = useMemo(() => {
    if (!item?.wewenang) return {};
    if (typeof item.wewenang === "object") return item.wewenang;
    try { return JSON.parse(item.wewenang || "{}"); } catch (_) { return {}; }
  }, [item]);

  // All people: main person (with their own pptk_*) + pengikut
  const allPersonnel = useMemo(() => {
    const p1Pptk = wewenangObj.pelaksana_pptk || wewenangObj.bidang || {};
    return [
      {
        nama: item.pelaksana_nama,
        nip: item.pelaksana_nip,
        pangkat: item.pelaksana_pangkat,
        jabatan: item.pelaksana_jabatan,
        pptk_nama: item.pelaksana_pptk_nama || p1Pptk.nama || "",
        pptk_nip: item.pelaksana_pptk_nip || p1Pptk.nip || "",
        pptk_jabatan: item.pelaksana_pptk_jabatan || p1Pptk.jabatan || "",
        tempat_berangkat: item.pelaksana_tempat_berangkat || p1Pptk.tempat_berangkat || item.tempat_berangkat || "Waikabubak",
        tempat_tujuan: item.pelaksana_tempat_tujuan || p1Pptk.tempat_tujuan || item.tempat_tujuan || "",
        tanggal_berangkat: item.pelaksana_tanggal_berangkat || p1Pptk.tanggal_berangkat || item.tanggal_berangkat || ""
      },
      ...pengikutList
    ];
  }, [item, pengikutList, wewenangObj]);

  const currentPerson = allPersonnel[personIdx] || allPersonnel[0];

  const effectiveItem = useMemo(() => ({
    ...item,
    kop_surat: kopSurat,
    alat_angkutan: alatAngkut,
    paper_size: paperSize,
    wewenang: {
      ...wewenangObj,
      kop_surat: kopSurat
    }
  }), [item, kopSurat, alatAngkut, paperSize, wewenangObj]);

  const htmlContent = useMemo(() => {
    if (tab === "spt") return bangunHtmlSPT(effectiveItem);
    return bangunHtmlSPPD(effectiveItem, currentPerson);
  }, [tab, effectiveItem, currentPerson]);

  const notif = (msg) => { if (showToast) showToast(msg); };

  const handleCetak = () => {
    if (tab === "spt") cetakSuratTugasWindow(effectiveItem, { paperSize });
    else cetakSppdWindow(effectiveItem, currentPerson, { paperSize });
  };

  const handleUnduhDocx = async () => {
    setBusy(true);
    try {
      if (tab === "spt") {
        notif("Menyiapkan SPT (.docx)…");
        await unduhSuratTugasDocx(effectiveItem);
        notif("SPT berhasil diunduh.");
      } else {
        notif(`Menyiapkan SPPD ${currentPerson.nama} (.docx)…`);
        await unduhSppdDocx(effectiveItem, currentPerson);
        notif(`SPPD ${currentPerson.nama} berhasil diunduh.`);
      }
    } catch (err) {
      notif("Gagal: " + (err?.message || err));
    } finally { setBusy(false); }
  };

  const handleUnduhPdf = async () => {
    setBusy(true);
    try {
      if (tab === "spt") {
        notif(`Menyiapkan SPT (${paperSize} .pdf)…`);
        await unduhSuratTugasPdf(effectiveItem, { paperSize });
        notif(`SPT (${paperSize} .pdf) berhasil diunduh.`);
      } else {
        notif(`Menyiapkan SPPD ${currentPerson.nama} (${paperSize} .pdf)…`);
        await unduhSppdPdf(effectiveItem, currentPerson, { paperSize });
        notif(`SPPD ${currentPerson.nama} (${paperSize} .pdf) berhasil diunduh.`);
      }
    } catch (err) {
      notif("Gagal unduh PDF: " + (err?.message || err));
    } finally { setBusy(false); }
  };

  const handleUnduhZip = async () => {
    setBusy(true);
    try {
      notif("Menyiapkan paket ZIP (SPT + semua SPPD)…");
      await unduhBundleSppdZip(effectiveItem);
      notif("Paket ZIP berhasil diunduh.");
    } catch (err) {
      notif("Gagal unduh ZIP: " + (err?.message || err));
    } finally { setBusy(false); }
  };

  const tabStyle = (active) => ({
    padding: "7px 14px",
    borderRadius: 7,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    border: `1px solid ${active ? T.primary : T.border}`,
    background: active ? T.primary : T.bg,
    color: active ? "#fff" : T.text,
    transition: "all 0.15s ease"
  });

  const kopBtnStyle = (active) => ({
    padding: "5px 10px",
    borderRadius: 6,
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    border: `1px solid ${active ? T.primary : T.border}`,
    background: active ? (isDark ? "rgba(37,99,235,0.22)" : "#EFF6FF") : T.bg,
    color: active ? T.primary : T.textSecondary,
    transition: "all 0.15s ease"
  });

  const inlineStyle = {
    display: "block",
    fontFamily: "Arial, 'Times New Roman', sans-serif",
    fontSize: "10pt",
    color: "#000",
    background: "#fff",
    lineHeight: 1.4,
    boxSizing: "border-box",
    WebkitPrintColorAdjust: "exact"
  };

  return (
    <Modal
      title="Pratinjau Dokumen Resmi"
      subtitle={`${item.nomor_spt || item.nomor_register} · ${item.pelaksana_nama}`}
      icon="fileText"
      onClose={onClose}
      maxWidth={960}
    >
      <div style={{ padding: "14px 20px 18px" }}>
        {/* ── Toolbar Utama ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          {/* Tab selector + Kop Switcher + Paper Size */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={tabStyle(tab === "spt")} onClick={() => setTab("spt")}>
                Surat Perintah Tugas (SPT)
              </button>
              <button type="button" style={tabStyle(tab === "sppd")} onClick={() => setTab("sppd")}>
                Lembar SPPD ({allPersonnel.length})
              </button>
            </div>

            <div style={{ height: 20, width: 1, background: T.border, margin: "0 2px" }} />

            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, marginRight: 2 }}>KOP:</span>
              <button
                type="button"
                style={kopBtnStyle(kopSurat === "BAPPERIDA")}
                onClick={() => setKopSurat("BAPPERIDA")}
              >
                BAPPERIDA
              </button>
              <button
                type="button"
                style={kopBtnStyle(kopSurat === "SEKDA")}
                onClick={() => setKopSurat("SEKDA")}
              >
                Sekretariat Daerah
              </button>
            </div>

            <div style={{ height: 20, width: 1, background: T.border, margin: "0 2px" }} />

            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary, marginRight: 2 }}>Kertas:</span>
              <button
                type="button"
                style={kopBtnStyle(paperSize === "A4")}
                onClick={() => setPaperSize("A4")}
                title="Ukuran A4 (210 × 297 mm)"
              >
                A4
              </button>
              <button
                type="button"
                style={kopBtnStyle(paperSize === "F4")}
                onClick={() => setPaperSize("F4")}
                title="Ukuran F4 / Folio (215 × 330 mm)"
              >
                F4 (Folio)
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={handleCetak} disabled={busy} icon="print" size="sm">
              Cetak ({paperSize})
            </Button>
            <Button variant="secondary" onClick={handleUnduhDocx} loading={busy} icon="download" size="sm">
              Unduh DOCX
            </Button>
            <Button variant="secondary" onClick={handleUnduhPdf} loading={busy} icon="file" size="sm">
              Unduh PDF ({paperSize})
            </Button>
            <Button variant="primary" onClick={handleUnduhZip} loading={busy} icon="download" size="sm">
              ZIP Lengkap
            </Button>
          </div>
        </div>

        {/* Personnel selector & Poin 5 Alat Angkut (for SPPD tab) */}
        {tab === "sppd" && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: T.bg,
            border: `1px solid ${T.border}`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>Pilih Personil:</span>
                {allPersonnel.map((p, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setPersonIdx(i)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: personIdx === i ? 700 : 500,
                      background: personIdx === i ? T.primary : T.card,
                      color: personIdx === i ? "#fff" : T.text,
                      border: `1px solid ${personIdx === i ? T.primary : T.border}`,
                      transition: "all 0.15s ease"
                    }}
                  >
                    {i + 1}. {p.nama}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: T.textSecondary }}>
                Pengesah Romawi I: <strong style={{ color: T.text }}>{currentPerson?.pptk_jabatan || wewenangObj?.bidang?.jabatan || "Kepala Bidang PPE"}</strong> ({currentPerson?.pptk_nama || wewenangObj?.bidang?.nama || "BERLIAN MAGU WERU,S.Sos"})
              </div>
            </div>

            {/* Poin 5. Alat angkut yang digunakan */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingTop: 8,
              borderTop: `1px dashed ${T.border}`,
              flexWrap: "wrap"
            }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.textSecondary }}>
                5. Alat angkut yang digunakan:
              </span>
              <input
                type="text"
                value={alatAngkut}
                onChange={(e) => setAlatAngkut(e.target.value)}
                placeholder="Mis. Pesawat Udara (Ekonomi) / Kendaraan Dinas Roda 4"
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: T.card,
                  color: T.text,
                  fontSize: 12,
                  fontWeight: 600,
                  minWidth: 230
                }}
              />
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {OPSI_ALAT_ANGKUT.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAlatAngkut(opt)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 5,
                      fontSize: 11,
                      fontWeight: alatAngkut === opt ? 700 : 500,
                      cursor: "pointer",
                      border: `1px solid ${alatAngkut === opt ? T.primary : T.border}`,
                      background: alatAngkut === opt ? (isDark ? "rgba(37,99,235,0.22)" : "#EFF6FF") : T.card,
                      color: alatAngkut === opt ? T.primary : T.textSecondary
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Paper Preview Canvas (A4 / F4) ── */}
        <div style={{
          background: isDark ? "#0f172a" : "#cbd5e1",
          borderRadius: 10,
          padding: "20px 16px",
          minHeight: 520,
          maxHeight: "66vh",
          overflowY: "auto",
          border: `1px solid ${T.border}`
        }}>
          <div style={{
            background: "#fff",
            width: "100%",
            maxWidth: paperConfig.previewWidthPx,
            minHeight: paperConfig.previewMinHeightPx,
            margin: "0 auto",
            padding: "28px 34px",
            boxShadow: "0 8px 28px rgba(15, 23, 42, 0.18)",
            borderRadius: 3,
            boxSizing: "border-box",
            overflowX: "auto",
            transition: "max-width 0.2s ease, min-height 0.2s ease"
          }}>
            <div
              style={inlineStyle}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 10, fontSize: 11.5, color: T.textSecondary, textAlign: "center" }}>
          Pratinjau {paperConfig.label} · Klik <strong>Cetak ({paperSize})</strong> untuk mencetak langsung, <strong>Unduh PDF ({paperSize})</strong> untuk berkas PDF, atau <strong>Unduh DOCX</strong> untuk berkas Microsoft Word.
        </div>
      </div>
    </Modal>
  );
}
