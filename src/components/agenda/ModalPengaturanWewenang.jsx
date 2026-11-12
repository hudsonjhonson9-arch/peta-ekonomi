import { useState, useEffect, useContext } from "react";
import { ThemeContext } from "../../App.jsx";
import { useIsDark, Icon, Modal } from "../ui.jsx";
import { Select, Button } from "../customControls.jsx";

const STATUS_LIST = ["Definitif", "Plt.", "Plh."];

const FIELD = (label, key, placeholder = "") => ({ label, key, placeholder });

function fieldRow(T, label, value, onChange, placeholder = "") {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, display: "block", marginBottom: 4 }}>
        {label}
      </label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "7px 10px", borderRadius: 7, fontSize: 13,
          border: `1.5px solid ${T.border}`, background: T.input, color: T.text,
          boxSizing: "border-box", outline: "none"
        }}
      />
    </div>
  );
}

export default function ModalPengaturanWewenang({ onClose, pegawaiList = [], onSaved, showToast }) {
  const { T } = useContext(ThemeContext);
  const isDark = useIsDark();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    fetch("/api/agenda/wewenang")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data) {
          setForm(j.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !form) return (
    <Modal title="Pengaturan Wewenang" onClose={onClose}>
      <div style={{ padding: 32, textAlign: "center", color: T.textSecondary, fontSize: 13 }}>
        Memuat konfigurasi wewenang…
      </div>
    </Modal>
  );

  const set = (path, val) => {
    const keys = path.split(".");
    setForm((prev) => {
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = val;
      return next;
    });
  };

  const autoFill = (sectionKey, pegawaiNip) => {
    const p = pegawaiList.find((x) => String(x.nip) === String(pegawaiNip));
    if (!p) return;
    setForm((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        nama: p.nama || p.name || "",
        nip: p.nip || "",
        pangkat: p.pangkat || "",
        jabatan: p.jabatan || ""
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/agenda/wewenang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const j = await r.json();
      if (j.success) {
        if (showToast) showToast("Pengaturan wewenang berhasil disimpan.");
        if (onSaved) onSaved(j.data);
        onClose();
      } else {
        if (showToast) showToast("Gagal menyimpan: " + (j.error || "Error"));
      }
    } catch (err) {
      if (showToast) showToast("Gagal menyimpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const pegawaiOptions = [
    { value: "", label: "— Pilih dari daftar pegawai —" },
    ...(pegawaiList || []).map((p) => ({
      value: p.nip,
      label: `${p.nama || p.name} · ${p.jabatan || ""}`
    }))
  ];

  const SectionTitle = ({ children }) => (
    <div style={{
      fontSize: 11, fontWeight: 700, color: T.textSecondary, letterSpacing: "0.08em",
      textTransform: "uppercase", borderBottom: `1px solid ${T.border}`,
      paddingBottom: 6, marginBottom: 10, marginTop: 20
    }}>
      {children}
    </div>
  );

  return (
    <Modal
      title="Pengaturan Wewenang Penandatangan & Paraf"
      subtitle="Kepala Badan, Sekretaris, PPTK/Kabid, KTU, dan 3 Paraf Hierarki"
      onClose={onClose}
      width={560}
    >
      <div style={{ padding: "16px 0", maxHeight: "72vh", overflowY: "auto" }}>
        {/* ── KEPALA BADAN ── */}
        <SectionTitle>Kepala Badan (Penandatangan Utama)</SectionTitle>

        {/* Quick fill from pegawai list */}
        {pegawaiList.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, display: "block", marginBottom: 4 }}>
              Isi otomatis dari daftar pegawai
            </label>
            <Select
              value=""
              onChange={(v) => v && autoFill("kepala", v)}
              options={pegawaiOptions}
              fullWidth
              placeholder="— Pilih pegawai —"
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, display: "block", marginBottom: 4 }}>
              Status Jabatan
            </label>
            <Select
              value={form.kepala?.status || "Definitif"}
              onChange={(v) => set("kepala.status", v)}
              options={STATUS_LIST.map((s) => ({ value: s, label: s }))}
              fullWidth
            />
          </div>
          <div style={{ flex: 2 }}>
            {fieldRow(T, "Jabatan Resmi", form.kepala?.jabatan, (v) => set("kepala.jabatan", v), "Kepala BAPPERIDA")}
          </div>
        </div>

        {fieldRow(T, "Nama Lengkap (kapital)", form.kepala?.nama, (v) => set("kepala.nama", v), "NAMA KEPALA BADAN, Gelar")}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>{fieldRow(T, "NIP", form.kepala?.nip, (v) => set("kepala.nip", v), "19xxxxxx xxxxxx x xxx")}</div>
          <div style={{ flex: 1 }}>{fieldRow(T, "Pangkat / Golongan", form.kepala?.pangkat, (v) => set("kepala.pangkat", v), "Pembina – IV/a")}</div>
        </div>

        {/* ── SEKRETARIS ── */}
        <SectionTitle>Sekretaris Badan</SectionTitle>
        {pegawaiList.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <Select
              value=""
              onChange={(v) => v && autoFill("sekretaris", v)}
              options={pegawaiOptions}
              fullWidth
              placeholder="— Isi dari daftar pegawai —"
            />
          </div>
        )}
        {fieldRow(T, "Nama Lengkap", form.sekretaris?.nama, (v) => set("sekretaris.nama", v))}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>{fieldRow(T, "NIP", form.sekretaris?.nip, (v) => set("sekretaris.nip", v))}</div>
          <div style={{ flex: 1 }}>{fieldRow(T, "Pangkat / Golongan", form.sekretaris?.pangkat, (v) => set("sekretaris.pangkat", v))}</div>
        </div>

        {/* ── PPTK / KABID ── */}
        <SectionTitle>PPTK / Kepala Bidang (Pengesahan SPPD)</SectionTitle>
        {pegawaiList.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <Select
              value=""
              onChange={(v) => v && autoFill("bidang", v)}
              options={pegawaiOptions}
              fullWidth
              placeholder="— Isi dari daftar pegawai —"
            />
          </div>
        )}
        {fieldRow(T, "Nama Lengkap", form.bidang?.nama, (v) => set("bidang.nama", v))}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>{fieldRow(T, "NIP", form.bidang?.nip, (v) => set("bidang.nip", v))}</div>
          <div style={{ flex: 1 }}>{fieldRow(T, "Jabatan (untuk PPTKJabatan)", form.bidang?.jabatan, (v) => set("bidang.jabatan", v), "Kepala Bidang PPE")}</div>
        </div>

        {/* ── KTU ── */}
        <SectionTitle>KTU / Kasubbag Umum & Kepegawaian</SectionTitle>
        {pegawaiList.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <Select
              value=""
              onChange={(v) => v && autoFill("ktu", v)}
              options={pegawaiOptions}
              fullWidth
              placeholder="— Isi dari daftar pegawai —"
            />
          </div>
        )}
        {fieldRow(T, "Nama Lengkap", form.ktu?.nama, (v) => set("ktu.nama", v))}
        {fieldRow(T, "NIP", form.ktu?.nip, (v) => set("ktu.nip", v))}

        {/* ── 3 PARAF HIERARKI ── */}
        <SectionTitle>Paraf Hierarki (3 Jabatan)</SectionTitle>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 10 }}>
          Ditulis sebagai teks jabatan di kolom paraf dokumen SPT/SPPD.
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, display: "block", marginBottom: 3 }}>
              Paraf {i + 1}
            </label>
            <input
              value={(form.paraf || [])[i] || ""}
              onChange={(e) => {
                const arr = [...(form.paraf || ["", "", ""])];
                arr[i] = e.target.value;
                set("paraf", arr);
              }}
              placeholder={["Sekretaris BAPPERIDA", "Kepala Bidang Terkait", "Kasubbag Umum & Kepegawaian"][i]}
              style={{
                width: "100%", padding: "7px 10px", borderRadius: 7, fontSize: 13,
                border: `1.5px solid ${T.border}`, background: T.input, color: T.text,
                boxSizing: "border-box"
              }}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
        <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
        <Button variant="primary" onClick={handleSave} loading={saving} icon="save">
          Simpan Wewenang
        </Button>
      </div>
    </Modal>
  );
}

