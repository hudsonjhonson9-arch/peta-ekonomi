import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../../App.jsx";
import { useIsDark, Icon, Modal } from "../ui.jsx";
import { Button } from "../customControls.jsx";
import {
  bangunHtmlSPT,
  bangunHtmlSPPD,
  unduhSuratTugasDocx,
  unduhSppdDocx,
  unduhBundleSppdZip,
  cetakSuratTugasWindow,
  cetakSppdWindow
} from "../../utils/sppdDocxGenerator.js";

/**
 * ModalPratinjauDokumen — Live A4 preview SPT & SPPD per personil
 * Props:
 *   item       — data SPPD/SPT record
 *   onClose    — callback tutup modal
 *   showToast  — fn(msg) untuk notifikasi
 */
export default function ModalPratinjauDokumen({ item, onClose, showToast }) {
  const { T } = useContext(ThemeContext);
  const isDark = useIsDark();

  const [tab, setTab] = useState("spt"); // "spt" | "sppd"
  const [personIdx, setPersonIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  const pengikutList = useMemo(() => {
    try {
      return Array.isArray(item.pengikut) ? item.pengikut : JSON.parse(item.pengikut || "[]");
    } catch (_) { return []; }
  }, [item]);

  // All people: main person + pengikut
  const allPersonnel = useMemo(() => [
    {
      nama: item.pelaksana_nama,
      nip: item.pelaksana_nip,
      pangkat: item.pelaksana_pangkat,
      jabatan: item.pelaksana_jabatan
    },
    ...pengikutList
  ], [item, pengikutList]);

  const currentPerson = allPersonnel[personIdx] || allPersonnel[0];

  const htmlContent = useMemo(() => {
    if (tab === "spt") return bangunHtmlSPT(item);
    return bangunHtmlSPPD(item, currentPerson);
  }, [tab, item, currentPerson]);

  const notif = (msg) => { if (showToast) showToast(msg); };

  const handleCetak = () => {
    if (tab === "spt") cetakSuratTugasWindow(item);
    else cetakSppdWindow(item, currentPerson);
  };

  const handleUnduhDocx = async () => {
    setBusy(true);
    try {
      if (tab === "spt") {
        notif("Menyiapkan SPT (.docx)…");
        await unduhSuratTugasDocx(item);
        notif("SPT berhasil diunduh.");
      } else {
        notif(`Menyiapkan SPPD ${currentPerson.nama} (.docx)…`);
        await unduhSppdDocx(item, currentPerson);
        notif(`SPPD ${currentPerson.nama} berhasil diunduh.`);
      }
    } catch (err) {
      notif("Gagal: " + (err?.message || err));
    } finally { setBusy(false); }
  };

  const handleUnduhZip = async () => {
    setBusy(true);
    try {
      notif("Menyiapkan paket ZIP (SPT + semua SPPD)…");
      await unduhBundleSppdZip(item);
      notif("Paket ZIP berhasil diunduh.");
    } catch (err) {
      notif("Gagal unduh ZIP: " + (err?.message || err));
    } finally { setBusy(false); }
  };

  const tabStyle = (active) => ({
    padding: "7px 16px",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    background: active ? T.primary : T.bg,
    color: active ? "#fff" : T.text,
    transition: "background 0.15s"
  });

  const inlineStyle = {
    all: "initial",
    display: "block",
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: "10pt",
    color: "#000",
    background: "#fff",
    lineHeight: 1.4,
    WebkitPrintColorAdjust: "exact"
  };

  return (
    <Modal
      title="Pratinjau Dokumen Resmi"
      subtitle={`${item.nomor_spt || item.nomor_register} · ${item.pelaksana_nama}`}
      onClose={onClose}
      width={860}
    >
      {/* ── Toolbar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {/* Tab selector */}
        <div style={{ display: "flex", gap: 6 }}>
          <button style={tabStyle(tab === "spt")} onClick={() => setTab("spt")}>
            📄 Surat Perintah Tugas
          </button>
          <button style={tabStyle(tab === "sppd")} onClick={() => setTab("sppd")}>
            🗂 SPPD
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={handleCetak} disabled={busy} icon="print" size="sm">
            Cetak
          </Button>
          <Button variant="secondary" onClick={handleUnduhDocx} loading={busy} icon="download" size="sm">
            Unduh DOCX
          </Button>
          <Button variant="primary" onClick={handleUnduhZip} loading={busy} icon="download" size="sm">
            ZIP Lengkap
          </Button>
        </div>
      </div>

      {/* Personnel selector (only for SPPD tab if >1 person) */}
      {tab === "sppd" && allPersonnel.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, alignSelf: "center" }}>Personil:</span>
          {allPersonnel.map((p, i) => (
            <button
              key={i}
              onClick={() => setPersonIdx(i)}
              style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                fontWeight: personIdx === i ? 700 : 400,
                background: personIdx === i ? T.primary : T.bg,
                color: personIdx === i ? "#fff" : T.text,
                border: `1px solid ${personIdx === i ? T.primary : T.border}`,
                transition: "background 0.15s"
              }}
            >
              {i + 1}. {p.nama}
            </button>
          ))}
        </div>
      )}

      {/* ── A4 Preview Canvas ── */}
      <div style={{
        background: isDark ? "#1a1a1a" : "#e5e7eb",
        borderRadius: 8,
        padding: 20,
        minHeight: 480,
        maxHeight: "60vh",
        overflowY: "auto"
      }}>
        <div style={{
          background: "#fff",
          maxWidth: 760,
          margin: "0 auto",
          padding: "24px 28px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          borderRadius: 2
        }}>
          <div
            style={inlineStyle}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 10, fontSize: 11, color: T.textSecondary, textAlign: "center" }}>
        Pratinjau layar · Klik <strong>Cetak</strong> untuk mencetak atau simpan sebagai PDF, atau <strong>Unduh DOCX</strong> untuk versi Word resmi.
      </div>
    </Modal>
  );
}

