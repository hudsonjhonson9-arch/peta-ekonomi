import { useState, useEffect, useContext, useMemo } from "react";
import { ThemeContext } from "../../App.jsx";
import { useIsDark, Icon, Modal } from "../ui.jsx";

const KODE_KLASIFIKASI_LIST = [
  { kode: "050", label: "050 - Perencanaan Pembangunan Daerah" },
  { kode: "005", label: "005 - Undangan & Rapat Dinas" },
  { kode: "900", label: "900 - Pengelolaan Keuangan & Anggaran" },
  { kode: "800", label: "800 - Kepegawaian & SDM Aparatur" },
  { kode: "020", label: "020 - Peralatan & Perlengkapan Kantor" },
  { kode: "060", label: "060 - Organisasi & Tata Laksana" },
  { kode: "045", label: "045 - Hukum, Perjanjian & Regulasi" },
];

const BIDANG_LIST = [
  "Sekretariat",
  "Bidang Perekonomian & SDA",
  "Bidang Pembangunan Manusia & Masyarakat (PMM)",
  "Bidang Infrastruktur & Kewilayahan (IPW)",
  "Bidang Perencanaan, Pengendalian & Evaluasi (P2E)",
  "Subbagian Umum & Kepegawaian",
  "Subbagian Perencanaan & Keuangan"
];

const PENANDATANGAN_LIST = [
  "Kepala BAPPERIDA",
  "Sekretaris BAPPERIDA",
  "Plt. Kepala BAPPERIDA",
  "Kepala Bidang Perekonomian & SDA",
  "Kepala Bidang PMM",
  "Kepala Bidang IPW",
  "Kepala Bidang P2E"
];

const ARAHAN_OPTIONS = [
  "Tindak lanjuti sesuai ketentuan",
  "Hadiri / Wakili rapat dinas",
  "Pelajari & berikan telaahan / saran",
  "Siapkan bahan / draf surat balasan",
  "Koordinasikan dengan bidang terkait",
  "Untuk diketahui & dipedomani",
  "Arsipkan & catat dalam agenda"
];

const DITERUSKAN_OPTIONS = [
  "Sekretaris BAPPERIDA",
  "Bidang Perekonomian & SDA",
  "Bidang Pembangunan Manusia & Masyarakat (PMM)",
  "Bidang Infrastruktur & Kewilayahan (IPW)",
  "Bidang Perencanaan, Pengendalian & Evaluasi (P2E)",
  "Subbagian Umum & Kepegawaian",
  "Subbagian Perencanaan & Keuangan",
  "Pejabat Fungsional / Staf Teknis"
];

export default function AgendaSuratPage({ user, showToast }) {
  const { T } = useContext(ThemeContext);
  const isDark = useIsDark();

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const r = (user.role || "").toLowerCase();
    return r === "admin";
  }, [user]);

  const [tab, setTab] = useState("masuk"); // "masuk" | "keluar"
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [sifatFilter, setSifatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [itemsMasuk, setItemsMasuk] = useState([]);
  const [itemsKeluar, setItemsKeluar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modals
  const [modalMasuk, setModalMasuk] = useState(null); // { mode: 'tambah'|'edit', data }
  const [modalKeluar, setModalKeluar] = useState(null); // { mode: 'tambah'|'edit', data, previewNomor }
  const [modalDisposisi, setModalDisposisi] = useState(null); // { surat, form, loading }
  const [modalDetail, setModalDetail] = useState(null); // { jenis: 'masuk'|'keluar', data }
  const [modalHapus, setModalHapus] = useState(null); // { jenis: 'masuk'|'keluar', data }
  const [submitting, setSubmitting] = useState(false);

  const notif = (msg) => {
    if (showToast) showToast(msg);
    else alert(msg);
  };

  useEffect(() => {
    fetchData();
  }, [tab, tahun]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = search ? `&q=${encodeURIComponent(search)}` : "";
      if (statusFilter) q += `&status=${encodeURIComponent(statusFilter)}`;

      if (tab === "masuk") {
        const res = await fetch(`/api/agenda/surat-masuk?tahun=${tahun}${q}`);
        const data = await res.json();
        if (data.ok) setItemsMasuk(data.items || []);
        else setError(data.message || "Gagal memuat data surat masuk");
      } else {
        const res = await fetch(`/api/agenda/surat-keluar?tahun=${tahun}${q}`);
        const data = await res.json();
        if (data.ok) setItemsKeluar(data.items || []);
        else setError(data.message || "Gagal memuat data surat keluar");
      }
    } catch (e) {
      setError(e.message || "Kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  // Filtered items (client-side for sifatFilter)
  const filteredMasuk = useMemo(() => {
    return itemsMasuk.filter((it) => {
      if (sifatFilter && it.sifat !== sifatFilter) return false;
      return true;
    });
  }, [itemsMasuk, sifatFilter]);

  const filteredKeluar = useMemo(() => {
    return itemsKeluar.filter((it) => {
      if (sifatFilter && it.sifat !== sifatFilter) return false;
      return true;
    });
  }, [itemsKeluar, sifatFilter]);

  // Metric Stats
  const statMasukTotal = itemsMasuk.length;
  const statMasukDisposisi = itemsMasuk.filter(i => i.status === "Didisposisi").length;
  const statMasukMenunggu = itemsMasuk.filter(i => i.status !== "Didisposisi" && i.status !== "Selesai").length;
  const statKeluarTotal = itemsKeluar.length;
  const statKeluarAktif = itemsKeluar.filter(i => i.status !== "Dibatalkan").length;

  // ── Handlers Surat Masuk ──────────────────────────────────────────────────
  const bukaTambahSuratMasuk = () => {
    setModalMasuk({
      mode: "tambah",
      data: {
        nomor_surat_asli: "",
        tanggal_terima: new Date().toISOString().split("T")[0],
        tanggal_surat: new Date().toISOString().split("T")[0],
        asal_surat: "",
        perihal: "",
        sifat: "Biasa",
        kode_klasifikasi: "050",
        jumlah_lampiran: "1 Berkas",
        file_url: "",
        file_name: ""
      }
    });
  };

  const bukaEditSuratMasuk = (it) => {
    setModalMasuk({
      mode: "edit",
      data: {
        id: it.id,
        nomor_surat_asli: it.nomor_surat_asli || "",
        tanggal_terima: it.tanggal_terima ? it.tanggal_terima.split("T")[0] : "",
        tanggal_surat: it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "",
        asal_surat: it.asal_surat || "",
        perihal: it.perihal || "",
        sifat: it.sifat || "Biasa",
        kode_klasifikasi: it.kode_klasifikasi || "050",
        jumlah_lampiran: it.jumlah_lampiran || "—",
        file_url: it.file_url || "",
        file_name: it.file_name || "",
        status: it.status || "Diterima"
      }
    });
  };

  const simpanSuratMasuk = async (e) => {
    e.preventDefault();
    const { mode, data } = modalMasuk;
    if (!data.nomor_surat_asli || !data.asal_surat || !data.perihal) {
      notif("Nomor surat asli, asal surat, dan perihal wajib diisi!");
      return;
    }
    setSubmitting(true);
    try {
      const url = mode === "tambah" ? "/api/agenda/surat-masuk" : `/api/agenda/surat-masuk/${data.id}`;
      const method = mode === "tambah" ? "POST" : "PUT";
      const payload = { ...data, tahun };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();
      if (!resJson.ok) throw new Error(resJson.message || "Gagal menyimpan surat masuk");

      notif(mode === "tambah" ? "Surat masuk berhasil dicatat ke buku agenda!" : "Surat masuk berhasil diperbarui!");
      setModalMasuk(null);
      fetchData();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Handlers Disposisi ────────────────────────────────────────────────────
  const bukaModalDisposisi = async (surat) => {
    setModalDisposisi({
      surat,
      loading: true,
      form: {
        tanggal_disposisi: new Date().toISOString().split("T")[0],
        pemberi_disposisi: "Kepala BAPPERIDA",
        arahan: [],
        catatan_instruksi: "",
        diteruskan_kepada: [],
        batas_waktu: "",
        status_tindaklanjut: "Didisposisikan"
      }
    });

    try {
      const res = await fetch(`/api/agenda/surat-masuk/${surat.id}/disposisi`);
      const data = await res.json();
      if (data.ok && data.disposisi) {
        const d = data.disposisi;
        setModalDisposisi(prev => ({
          ...prev,
          loading: false,
          form: {
            tanggal_disposisi: d.tanggal_disposisi ? d.tanggal_disposisi.split("T")[0] : new Date().toISOString().split("T")[0],
            pemberi_disposisi: d.pemberi_disposisi || "Kepala BAPPERIDA",
            arahan: Array.isArray(d.arahan) ? d.arahan : (typeof d.arahan === "string" ? JSON.parse(d.arahan || "[]") : []),
            catatan_instruksi: d.catatan_instruksi || "",
            diteruskan_kepada: Array.isArray(d.diteruskan_kepada) ? d.diteruskan_kepada : (typeof d.diteruskan_kepada === "string" ? JSON.parse(d.diteruskan_kepada || "[]") : []),
            batas_waktu: d.batas_waktu ? d.batas_waktu.split("T")[0] : "",
            status_tindaklanjut: d.status_tindaklanjut || "Didisposisikan"
          }
        }));
      } else {
        setModalDisposisi(prev => ({ ...prev, loading: false }));
      }
    } catch (_) {
      setModalDisposisi(prev => ({ ...prev, loading: false }));
    }
  };

  const simpanDisposisi = async (e) => {
    e.preventDefault();
    const { surat, form } = modalDisposisi;
    if (!form.diteruskan_kepada.length && !form.catatan_instruksi) {
      notif("Pilih minimal satu penerima disposisi atau isi catatan instruksi!");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agenda/surat-masuk/${surat.id}/disposisi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Gagal menyimpan lembar disposisi");

      notif("Lembar disposisi surat berhasil disimpan & status diperbarui!");
      setModalDisposisi(null);
      fetchData();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Handlers Surat Keluar ─────────────────────────────────────────────────
  const fetchPreviewNomorKeluar = async (kode) => {
    try {
      const res = await fetch(`/api/agenda/surat-keluar/preview-nomor?tahun=${tahun}&kode=${encodeURIComponent(kode || "050")}`);
      const data = await res.json();
      if (data.ok) return data.nomor_surat;
    } catch (_) {}
    return "050/..../BAPPERIDA/.../2026";
  };

  const bukaTambahSuratKeluar = async () => {
    const preview = await fetchPreviewNomorKeluar("050");
    setModalKeluar({
      mode: "tambah",
      previewNomor: preview,
      data: {
        kode_klasifikasi: "050",
        tanggal_surat: new Date().toISOString().split("T")[0],
        tujuan_surat: "",
        perihal: "",
        sifat: "Biasa",
        bidang_pengonsep: BIDANG_LIST[0],
        penandatangan: "Kepala BAPPERIDA",
        file_draft_url: "",
        file_final_url: "",
        status: "Draf"
      }
    });
  };

  const bukaEditSuratKeluar = (it) => {
    setModalKeluar({
      mode: "edit",
      previewNomor: it.nomor_surat,
      data: {
        id: it.id,
        nomor_surat: it.nomor_surat,
        kode_klasifikasi: it.kode_klasifikasi || "050",
        tanggal_surat: it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "",
        tujuan_surat: it.tujuan_surat || "",
        perihal: it.perihal || "",
        sifat: it.sifat || "Biasa",
        bidang_pengonsep: it.bidang_pengonsep || BIDANG_LIST[0],
        penandatangan: it.penandatangan || "Kepala BAPPERIDA",
        file_draft_url: it.file_draft_url || "",
        file_final_url: it.file_final_url || "",
        status: it.status || "Draf"
      }
    });
  };

  const simpanSuratKeluar = async (e) => {
    e.preventDefault();
    const { mode, data } = modalKeluar;
    if (!data.tujuan_surat || !data.perihal || !data.bidang_pengonsep) {
      notif("Tujuan surat, perihal, dan bidang pengonsep wajib diisi!");
      return;
    }
    setSubmitting(true);
    try {
      const url = mode === "tambah" ? "/api/agenda/surat-keluar" : `/api/agenda/surat-keluar/${data.id}`;
      const method = mode === "tambah" ? "POST" : "PUT";
      const payload = { ...data, tahun };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const resJson = await res.json();
      if (!resJson.ok) throw new Error(resJson.message || "Gagal booking nomor surat keluar");

      notif(mode === "tambah" ? `Nomor surat keluar berhasil dibooking: ${resJson.item?.nomor_surat || ""}` : "Data surat keluar berhasil diperbarui!");
      setModalKeluar(null);
      fetchData();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Hapus / Batalkan (Admin Only) ─────────────────────────────────────────
  const konfirmasiHapus = async (forceDelete = false) => {
    if (!isAdmin) {
      notif("Akses ditolak: Hanya administrator yang dapat menghapus data.");
      return;
    }
    const { jenis, data } = modalHapus;
    setSubmitting(true);
    try {
      let url = "";
      if (jenis === "masuk") {
        url = `/api/agenda/surat-masuk/${data.id}`;
      } else {
        url = `/api/agenda/surat-keluar/${data.id}${forceDelete ? "?force=true" : ""}`;
      }

      const res = await fetch(url, { method: "DELETE" });
      const resJson = await res.json();
      if (!resJson.ok) throw new Error(resJson.message || "Gagal menghapus data");

      notif(resJson.message || "Data berhasil dihapus");
      setModalHapus(null);
      fetchData();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Badge Status Renderer
  const renderStatusBadge = (status) => {
    const s = status || "Diterima";
    let bg = "rgba(148,163,184,0.15)";
    let col = T.textSecondary;

    if (s === "Didisposisi" || s === "Ditandatangani") {
      bg = "rgba(37,99,235,0.12)";
      col = T.primary;
    } else if (s === "Selesai" || s === "Terkirim") {
      bg = "rgba(5,150,105,0.12)";
      col = T.success;
    } else if (s === "Draf" || s === "Menunggu TTD") {
      bg = "rgba(217,119,6,0.12)";
      col = T.warning;
    } else if (s === "Dibatalkan") {
      bg = "rgba(220,38,38,0.12)";
      col = T.danger;
    }

    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color: col
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: col }} />
        {s}
      </span>
    );
  };

  const renderSifatBadge = (sifat) => {
    const s = sifat || "Biasa";
    let bg = "rgba(100,116,139,0.1)";
    let col = T.textSecondary;
    if (s === "Penting") { bg = "rgba(245,158,11,0.12)"; col = "#D97706"; }
    else if (s === "Rahasia") { bg = "rgba(220,38,38,0.12)"; col = "#DC2626"; }
    else if (s === "Segera") { bg = "rgba(147,51,234,0.12)"; col = "#9333EA"; }

    return (
      <span style={{
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: 10.5,
        fontWeight: 600,
        background: bg,
        color: col
      }}>
        {s}
      </span>
    );
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1280, margin: "0 auto", fontFamily: T.font }}>
      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0, letterSpacing: "-0.02em" }}>
              Tata Kelola Arsip & Agenda Surat
            </h1>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: isAdmin ? "rgba(37,99,235,0.12)" : "rgba(100,116,139,0.12)",
              color: isAdmin ? T.primary : T.textSecondary
            }}>
              {isAdmin ? "Mode Admin: Full CRUD" : "Mode Staf: Disposisi & Booking"}
            </span>
          </div>
          <p style={{ fontSize: 13, color: T.textSecondary, margin: "4px 0 0" }}>
            Pencatatan surat masuk, disposisi digital pimpinan, dan penerbitan nomor surat dinas resmi BAPPERIDA Sumba Barat
          </p>
        </div>

        {/* Year Selector & Primary Action */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 8px" }}>
            <Icon name="calendar" size={14} style={{ color: T.textSecondary }} />
            <select
              value={tahun}
              onChange={(e) => setTahun(parseInt(e.target.value, 10))}
              style={{
                border: "none",
                background: "transparent",
                color: T.text,
                fontWeight: 700,
                fontSize: 13,
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value={2026}>Tahun 2026</option>
              <option value={2025}>Tahun 2025</option>
              <option value={2024}>Tahun 2024</option>
            </select>
          </div>

          {tab === "masuk" ? (
            <button
              onClick={bukaTambahSuratMasuk}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: T.primary,
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: T.shadowSm
              }}
            >
              <Icon name="plus" size={14} />
              Catat Surat Masuk
            </button>
          ) : (
            <button
              onClick={bukaTambahSuratKeluar}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: T.primary,
                color: "#FFFFFF",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: T.shadowSm
              }}
            >
              <Icon name="plus" size={14} />
              Booking Nomor Surat
            </button>
          )}
        </div>
      </div>

      {/* ── Metric Summary Cards ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 12,
        marginBottom: 20
      }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(37,99,235,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: T.primary }}>
            <Icon name="fileText" size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>Surat Masuk ({tahun})</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontVariantNumeric: "tabular-nums" }}>{statMasukTotal} Dokumen</div>
          </div>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(5,150,105,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: T.success }}>
            <Icon name="checkCircle" size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>Telah Didisposisikan</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontVariantNumeric: "tabular-nums" }}>{statMasukDisposisi} Surat</div>
          </div>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(217,119,6,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: T.warning }}>
            <Icon name="clock" size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>Menunggu Tindak Lanjut</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontVariantNumeric: "tabular-nums" }}>{statMasukMenunggu} Surat</div>
          </div>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(147,51,234,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9333EA" }}>
            <Icon name="share" size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>Surat Keluar Terdaftar</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontVariantNumeric: "tabular-nums" }}>{statKeluarAktif} Nomor</div>
          </div>
        </div>
      </div>

      {/* ── Main Tab Bar ── */}
      <div style={{
        display: "flex",
        gap: 6,
        borderBottom: `1px solid ${T.border}`,
        marginBottom: 16
      }}>
        <button
          onClick={() => { setTab("masuk"); setStatusFilter(""); setSifatFilter(""); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: tab === "masuk" ? T.card : "transparent",
            color: tab === "masuk" ? T.primary : T.textSecondary,
            fontWeight: 700,
            fontSize: 13,
            borderTop: `2px solid ${tab === "masuk" ? T.primary : "transparent"}`,
            borderLeft: tab === "masuk" ? `1px solid ${T.border}` : "1px solid transparent",
            borderRight: tab === "masuk" ? `1px solid ${T.border}` : "1px solid transparent",
            borderBottom: tab === "masuk" ? `1px solid ${T.card}` : "none",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            marginBottom: -1,
            transition: "all 0.15s ease"
          }}
        >
          <Icon name="archive" size={15} />
          <span>Buku Surat Masuk & Disposisi</span>
          <span style={{
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 10,
            background: tab === "masuk" ? "rgba(37,99,235,0.12)" : T.bg,
            color: tab === "masuk" ? T.primary : T.textSecondary
          }}>
            {itemsMasuk.length}
          </span>
        </button>

        <button
          onClick={() => { setTab("keluar"); setStatusFilter(""); setSifatFilter(""); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: tab === "keluar" ? T.card : "transparent",
            color: tab === "keluar" ? T.primary : T.textSecondary,
            fontWeight: 700,
            fontSize: 13,
            borderTop: `2px solid ${tab === "keluar" ? T.primary : "transparent"}`,
            borderLeft: tab === "keluar" ? `1px solid ${T.border}` : "1px solid transparent",
            borderRight: tab === "keluar" ? `1px solid ${T.border}` : "1px solid transparent",
            borderBottom: tab === "keluar" ? `1px solid ${T.card}` : "none",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            marginBottom: -1,
            transition: "all 0.15s ease"
          }}
        >
          <Icon name="externalLink" size={15} />
          <span>Buku Surat Keluar & Booking Nomor</span>
          <span style={{
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 10,
            background: tab === "keluar" ? "rgba(37,99,235,0.12)" : T.bg,
            color: tab === "keluar" ? T.primary : T.textSecondary
          }}>
            {itemsKeluar.length}
          </span>
        </button>
      </div>

      {/* ── Toolbar Search & Filter ── */}
      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 16,
        flexWrap: "wrap",
        alignItems: "center"
      }}>
        <div style={{
          position: "relative",
          flex: "1 1 280px"
        }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textSecondary }}>
            <Icon name="search" size={14} />
          </div>
          <input
            type="text"
            placeholder={tab === "masuk" ? "Cari nomor agenda, perihal, atau instansi pengirim..." : "Cari nomor surat, tujuan dinas, atau perihal..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: T.card,
              color: T.text,
              fontSize: 12.5,
              outline: "none"
            }}
          />
        </div>

        {/* Filter Sifat */}
        <select
          value={sifatFilter}
          onChange={(e) => setSifatFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.card,
            color: T.text,
            fontSize: 12.5,
            cursor: "pointer"
          }}
        >
          <option value="">Semua Sifat</option>
          <option value="Biasa">Biasa</option>
          <option value="Penting">Penting</option>
          <option value="Rahasia">Rahasia</option>
          <option value="Segera">Segera</option>
        </select>

        {/* Filter Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.card,
            color: T.text,
            fontSize: 12.5,
            cursor: "pointer"
          }}
        >
          <option value="">Semua Status</option>
          {tab === "masuk" ? (
            <>
              <option value="Diterima">Diterima</option>
              <option value="Didisposisi">Didisposisi</option>
              <option value="Selesai">Selesai</option>
            </>
          ) : (
            <>
              <option value="Draf">Draf</option>
              <option value="Ditandatangani">Ditandatangani</option>
              <option value="Terkirim">Terkirim</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </>
          )}
        </select>

        <button
          onClick={fetchData}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.card,
            color: T.text,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <Icon name="refresh" size={13} />
          Segarkan
        </button>
      </div>

      {/* ── Table Container ── */}
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        boxShadow: T.shadowSm,
        overflow: "hidden"
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: T.textSecondary }}>
            <Icon name="loader" size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>Memuat buku register agenda...</div>
          </div>
        ) : error ? (
          <div style={{ padding: 48, textAlign: "center", color: T.danger }}>
            <Icon name="alert" size={24} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>{error}</div>
            <button
              onClick={fetchData}
              style={{ marginTop: 12, padding: "6px 14px", borderRadius: 6, background: T.bg, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", fontSize: 12 }}
            >
              Coba Lagi
            </button>
          </div>
        ) : tab === "masuk" ? (
          /* ═════════ TABEL SURAT MASUK ═════════ */
          filteredMasuk.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: T.textSecondary }}>
              <Icon name="fileText" size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Belum ada catatan surat masuk untuk tahun {tahun}</div>
              <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 14px" }}>
                Gunakan tombol "Catat Surat Masuk" untuk mulai mencatat surat dinas masuk.
              </p>
              <button
                onClick={bukaTambahSuratMasuk}
                style={{ padding: "8px 16px", borderRadius: 8, background: T.primary, color: "#fff", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
              >
                + Catat Surat Pertama
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F8FAFC", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>
                    <th style={{ padding: "10px 14px", fontWeight: 700, width: 140 }}>No. Agenda</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, width: 110 }}>Tgl. Terima</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700 }}>Asal Instansi</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700 }}>Nomor & Tanggal Asli</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, minWidth: 260 }}>Perihal & Sifat</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, width: 130 }}>Status</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right", minWidth: 160 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMasuk.map((it) => (
                    <tr
                      key={it.id}
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        transition: "background 0.1s ease"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "#243247" : "#F8FAFC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 700, color: T.primary, fontVariantNumeric: "tabular-nums" }}>
                        {it.nomor_agenda}
                      </td>
                      <td style={{ padding: "12px 14px", fontVariantNumeric: "tabular-nums", color: T.text }}>
                        {it.tanggal_terima ? it.tanggal_terima.split("T")[0] : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: T.text }}>
                        {it.asal_surat}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, color: T.text }}>{it.nomor_surat_asli}</div>
                        <div style={{ fontSize: 11, color: T.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                          {it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "—"}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ color: T.text, lineHeight: 1.4, marginBottom: 4 }}>{it.perihal}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {renderSifatBadge(it.sifat)}
                          <span style={{ fontSize: 11, color: T.textMuted }}>Kode: {it.kode_klasifikasi || "050"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {renderStatusBadge(it.status)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          {/* Disposisi (Staff & Admin) */}
                          <button
                            title="Lembar Disposisi"
                            onClick={() => bukaModalDisposisi(it)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: it.status === "Didisposisi" ? "rgba(37,99,235,0.1)" : T.bg,
                              color: it.status === "Didisposisi" ? T.primary : T.text,
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            <Icon name="fileText" size={12} />
                            Disposisi
                          </button>

                          {/* Detail Button */}
                          <button
                            title="Lihat Detail"
                            onClick={() => setModalDetail({ jenis: "masuk", data: it })}
                            style={{
                              padding: "5px 8px",
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: T.bg,
                              color: T.textSecondary,
                              cursor: "pointer"
                            }}
                          >
                            <Icon name="eye" size={13} />
                          </button>

                          {/* Edit Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              title="Edit Surat Masuk (Admin)"
                              onClick={() => bukaEditSuratMasuk(it)}
                              style={{
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: `1px solid ${T.border}`,
                                background: T.bg,
                                color: T.textSecondary,
                                cursor: "pointer"
                              }}
                            >
                              <Icon name="edit" size={13} />
                            </button>
                          )}

                          {/* Hapus Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              title="Hapus Surat Masuk (Admin)"
                              onClick={() => setModalHapus({ jenis: "masuk", data: it })}
                              style={{
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: `1px solid ${T.dangerBorder || "#FECACA"}`,
                                background: T.dangerBg || "#FEF2F2",
                                color: T.danger,
                                cursor: "pointer"
                              }}
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ═════════ TABEL SURAT KELUAR ═════════ */
          filteredKeluar.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: T.textSecondary }}>
              <Icon name="share" size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Belum ada register surat keluar untuk tahun {tahun}</div>
              <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 14px" }}>
                Klik tombol "Booking Nomor Surat" untuk memesan nomor urut dinas resmi.
              </p>
              <button
                onClick={bukaTambahSuratKeluar}
                style={{ padding: "8px 16px", borderRadius: 8, background: T.primary, color: "#fff", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
              >
                + Booking Nomor Pertama
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F8FAFC", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>
                    <th style={{ padding: "10px 14px", fontWeight: 700, width: 80 }}>No. Urut</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, minWidth: 200 }}>Nomor Surat Dinas</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, width: 110 }}>Tanggal</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700 }}>Tujuan Surat</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, minWidth: 240 }}>Perihal & Bidang</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, width: 120 }}>Status</th>
                    <th style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right", minWidth: 140 }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeluar.map((it) => (
                    <tr
                      key={it.id}
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        transition: "background 0.1s ease",
                        opacity: it.status === "Dibatalkan" ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "#243247" : "#F8FAFC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", fontWeight: 700, color: T.primary, fontVariantNumeric: "tabular-nums" }}>
                        {String(it.nomor_urut || 1).padStart(4, "0")}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontFamily: "monospace", fontWeight: 700, color: T.text, fontSize: 13, textDecoration: it.status === "Dibatalkan" ? "line-through" : "none" }}>
                          {it.nomor_surat}
                        </div>
                        <div style={{ fontSize: 11, color: T.textSecondary }}>
                          Reg: {it.nomor_agenda || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", fontVariantNumeric: "tabular-nums", color: T.text }}>
                        {it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: T.text }}>
                        {it.tujuan_surat}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ color: T.text, lineHeight: 1.4, marginBottom: 4 }}>{it.perihal}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: T.textSecondary, fontWeight: 600 }}>{it.bidang_pengonsep}</span>
                          <span style={{ fontSize: 11, color: T.textMuted }}>• TTD: {it.penandatangan || "Kepala Badan"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {renderStatusBadge(it.status)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          {/* Detail Button */}
                          <button
                            title="Lihat Detail"
                            onClick={() => setModalDetail({ jenis: "keluar", data: it })}
                            style={{
                              padding: "5px 8px",
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: T.bg,
                              color: T.textSecondary,
                              cursor: "pointer"
                            }}
                          >
                            <Icon name="eye" size={13} />
                          </button>

                          {/* Edit Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              title="Edit Surat Keluar (Admin)"
                              onClick={() => bukaEditSuratKeluar(it)}
                              style={{
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: `1px solid ${T.border}`,
                                background: T.bg,
                                color: T.textSecondary,
                                cursor: "pointer"
                              }}
                            >
                              <Icon name="edit" size={13} />
                            </button>
                          )}

                          {/* Batalkan / Hapus Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              title="Batalkan / Hapus Nomor (Admin)"
                              onClick={() => setModalHapus({ jenis: "keluar", data: it })}
                              style={{
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: `1px solid ${T.dangerBorder || "#FECACA"}`,
                                background: T.dangerBg || "#FEF2F2",
                                color: T.danger,
                                cursor: "pointer"
                              }}
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: TAMBAH / EDIT SURAT MASUK */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalMasuk && (
        <Modal
          title={modalMasuk.mode === "tambah" ? "Catat Agenda Surat Masuk" : "Edit Agenda Surat Masuk"}
          subtitle="Form registrasi surat dinas masuk BAPPERIDA Sumba Barat"
          icon="archive"
          onClose={() => setModalMasuk(null)}
          maxWidth={600}
        >
          <form onSubmit={simpanSuratMasuk} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Nomor Surat Asli *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mis. 050/123/DISP/XI/2026"
                  value={modalMasuk.data.nomor_surat_asli}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, nomor_surat_asli: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Asal Instansi Pengirim *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mis. Dinas PUPR Sumba Barat"
                  value={modalMasuk.data.asal_surat}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, asal_surat: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tanggal Surat Asli
                </label>
                <input
                  type="date"
                  value={modalMasuk.data.tanggal_surat}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, tanggal_surat: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tanggal Diterima
                </label>
                <input
                  type="date"
                  value={modalMasuk.data.tanggal_terima}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, tanggal_terima: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Perihal Surat *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Tuliskan pokok perihal surat dinas secara lengkap..."
                value={modalMasuk.data.perihal}
                onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, perihal: e.target.value } })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Sifat Surat
                </label>
                <select
                  value={modalMasuk.data.sifat}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, sifat: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                >
                  <option value="Biasa">Biasa</option>
                  <option value="Penting">Penting</option>
                  <option value="Rahasia">Rahasia</option>
                  <option value="Segera">Segera</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Kode Klasifikasi
                </label>
                <select
                  value={modalMasuk.data.kode_klasifikasi}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, kode_klasifikasi: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                >
                  {KODE_KLASIFIKASI_LIST.map((k) => (
                    <option key={k.kode} value={k.kode}>{k.kode} - {k.label.split("- ")[1]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Jumlah Lampiran
                </label>
                <input
                  type="text"
                  placeholder="Mis. 1 Gabung / —"
                  value={modalMasuk.data.jumlah_lampiran}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, jumlah_lampiran: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Tautan Berkas Pindaian / Google Drive (Opsional)
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/... atau tautan file PDF"
                value={modalMasuk.data.file_url}
                onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, file_url: e.target.value } })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
              />
            </div>

            {modalMasuk.mode === "edit" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Status Surat
                </label>
                <select
                  value={modalMasuk.data.status}
                  onChange={(e) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, status: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                >
                  <option value="Diterima">Diterima</option>
                  <option value="Didisposisi">Didisposisi</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setModalMasuk(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Menyimpan..." : "Simpan Surat Masuk"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: DISPOSISI DIGITAL PIMPINAN (STAFF & ADMIN) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalDisposisi && (
        <Modal
          title="Lembar Disposisi Digital"
          subtitle={`Disposisi untuk Surat: ${modalDisposisi.surat?.nomor_agenda || ""} - ${modalDisposisi.surat?.asal_surat || ""}`}
          icon="fileText"
          onClose={() => setModalDisposisi(null)}
          maxWidth={650}
        >
          {modalDisposisi.loading ? (
            <div style={{ padding: 40, textAlign: "center", color: T.textSecondary }}>Memuat riwayat lembar disposisi...</div>
          ) : (
            <form onSubmit={simpanDisposisi} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: isDark ? "#172337" : "#F1F5F9", padding: "10px 14px", borderRadius: 8, borderLeft: `4px solid ${T.primary}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary }}>PERIHAL SURAT</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginTop: 2 }}>{modalDisposisi.surat?.perihal}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                  No. Asli: {modalDisposisi.surat?.nomor_surat_asli} • Dari: {modalDisposisi.surat?.asal_surat}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                    Pemberi Disposisi
                  </label>
                  <select
                    value={modalDisposisi.form.pemberi_disposisi}
                    onChange={(e) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, pemberi_disposisi: e.target.value } })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                  >
                    <option value="Kepala BAPPERIDA">Kepala BAPPERIDA</option>
                    <option value="Sekretaris BAPPERIDA">Sekretaris BAPPERIDA</option>
                    <option value="Plt. Kepala BAPPERIDA">Plt. Kepala BAPPERIDA</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                    Tanggal Disposisi
                  </label>
                  <input
                    type="date"
                    value={modalDisposisi.form.tanggal_disposisi}
                    onChange={(e) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, tanggal_disposisi: e.target.value } })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Checklist Diteruskan Kepada */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 6 }}>
                  Diteruskan Kepada (Pilih Bidang / Bagian):
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, background: T.bg, padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  {DITERUSKAN_OPTIONS.map((opt) => {
                    const checked = modalDisposisi.form.diteruskan_kepada.includes(opt);
                    return (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = modalDisposisi.form.diteruskan_kepada;
                            const next = e.target.checked ? [...cur, opt] : cur.filter(x => x !== opt);
                            setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, diteruskan_kepada: next } });
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Checklist Arahan Pimpinan */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 6 }}>
                  Petunjuk / Arahan Tindak Lanjut:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, background: T.bg, padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  {ARAHAN_OPTIONS.map((opt) => {
                    const checked = modalDisposisi.form.arahan.includes(opt);
                    return (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = modalDisposisi.form.arahan;
                            const next = e.target.checked ? [...cur, opt] : cur.filter(x => x !== opt);
                            setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, arahan: next } });
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Catatan Khusus / Instruksi Tambahan:
                </label>
                <textarea
                  rows={3}
                  placeholder="Tuliskan catatan khusus atau arahan spesifik dari pimpinan..."
                  value={modalDisposisi.form.catatan_instruksi}
                  onChange={(e) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, catatan_instruksi: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                    Batas Waktu Tindak Lanjut (Opsional)
                  </label>
                  <input
                    type="date"
                    value={modalDisposisi.form.batas_waktu}
                    onChange={(e) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, batas_waktu: e.target.value } })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                    Status Disposisi
                  </label>
                  <select
                    value={modalDisposisi.form.status_tindaklanjut}
                    onChange={(e) => setModalDisposisi({ ...modalDisposisi, form: { ...modalDisposisi.form, status_tindaklanjut: e.target.value } })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                  >
                    <option value="Didisposisikan">Didisposisikan</option>
                    <option value="Dalam Proses">Dalam Proses</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalDisposisi(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Menyimpan..." : "Simpan Disposisi Digital"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: BOOKING / EDIT NOMOR SURAT KELUAR */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalKeluar && (
        <Modal
          title={modalKeluar.mode === "tambah" ? "Booking Nomor Surat Keluar" : "Edit Surat Keluar"}
          subtitle="Penerbitan nomor surat dinas resmi dengan penomoran berurutan otomatis"
          icon="externalLink"
          onClose={() => setModalKeluar(null)}
          maxWidth={620}
        >
          <form onSubmit={simpanSuratKeluar} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Live Number Preview */}
            <div style={{ background: isDark ? "#172337" : "#EFF6FF", border: `1px solid ${isDark ? "#2563EB" : "#BFDBFE"}`, padding: "12px 16px", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>
                {modalKeluar.mode === "tambah" ? "PRATINJAU NOMOR SURAT BERIKUTNYA" : "NOMOR SURAT DINAS"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: T.text, marginTop: 4, letterSpacing: "0.02em" }}>
                {modalKeluar.previewNomor}
              </div>
              <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4 }}>
                Sistem mengunci urutan secara atomik di database untuk mencegah nomor ganda antar bidang.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Kode Klasifikasi *
                </label>
                <select
                  value={modalKeluar.data.kode_klasifikasi}
                  onChange={async (e) => {
                    const newKode = e.target.value;
                    const prev = await fetchPreviewNomorKeluar(newKode);
                    setModalKeluar({
                      ...modalKeluar,
                      previewNomor: modalKeluar.mode === "tambah" ? prev : modalKeluar.previewNomor,
                      data: { ...modalKeluar.data, kode_klasifikasi: newKode }
                    });
                  }}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                >
                  {KODE_KLASIFIKASI_LIST.map((k) => (
                    <option key={k.kode} value={k.kode}>{k.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tanggal Surat *
                </label>
                <input
                  type="date"
                  required
                  value={modalKeluar.data.tanggal_surat}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, tanggal_surat: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Tujuan Surat Dinas *
              </label>
              <input
                type="text"
                required
                placeholder="Mis. Kepala Dinas Pendidikan, Kepemudaan dan Olahraga Kab. Sumba Barat"
                value={modalKeluar.data.tujuan_surat}
                onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, tujuan_surat: e.target.value } })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Perihal Surat Dinas *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Tuliskan pokok perihal surat keluar secara lengkap..."
                value={modalKeluar.data.perihal}
                onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, perihal: e.target.value } })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Bidang Pengonsep *
                </label>
                <select
                  value={modalKeluar.data.bidang_pengonsep}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, bidang_pengonsep: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                >
                  {BIDANG_LIST.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Pejabat Penandatangan
                </label>
                <select
                  value={modalKeluar.data.penandatangan}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, penandatangan: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                >
                  {PENANDATANGAN_LIST.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Sifat Surat
                </label>
                <select
                  value={modalKeluar.data.sifat}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, sifat: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                >
                  <option value="Biasa">Biasa</option>
                  <option value="Penting">Penting</option>
                  <option value="Rahasia">Rahasia</option>
                  <option value="Segera">Segera</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Status Surat
                </label>
                <select
                  value={modalKeluar.data.status}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, status: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                >
                  <option value="Draf">Draf</option>
                  <option value="Ditandatangani">Ditandatangani</option>
                  <option value="Terkirim">Terkirim</option>
                  {isAdmin && <option value="Dibatalkan">Dibatalkan</option>}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tautan Draf Surat (Docs/Drive)
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/..."
                  value={modalKeluar.data.file_draft_url}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, file_draft_url: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tautan Surat Final (Signed PDF)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/.../pdf"
                  value={modalKeluar.data.file_final_url}
                  onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, file_final_url: e.target.value } })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setModalKeluar(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Memproses..." : (modalKeluar.mode === "tambah" ? "Booking Nomor Resmi" : "Simpan Perubahan")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 4: DETAIL LENGKAP */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalDetail && (
        <Modal
          title={modalDetail.jenis === "masuk" ? "Rincian Surat Masuk" : "Rincian Surat Keluar"}
          subtitle="Detail informasi agenda surat dinas"
          icon="fileText"
          onClose={() => setModalDetail(null)}
          maxWidth={580}
        >
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, fontSize: 13 }}>
              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor Agenda:</div>
              <div style={{ fontWeight: 700, fontFamily: "monospace", color: T.primary }}>{modalDetail.data.nomor_agenda || "—"}</div>

              {modalDetail.jenis === "masuk" ? (
                <>
                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor Surat Asli:</div>
                  <div style={{ fontWeight: 700, color: T.text }}>{modalDetail.data.nomor_surat_asli}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Asal Instansi:</div>
                  <div style={{ fontWeight: 600, color: T.text }}>{modalDetail.data.asal_surat}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Tanggal Terima:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.tanggal_terima ? modalDetail.data.tanggal_terima.split("T")[0] : "—"}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Tanggal Surat:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.tanggal_surat ? modalDetail.data.tanggal_surat.split("T")[0] : "—"}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Jumlah Lampiran:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.jumlah_lampiran || "—"}</div>
                </>
              ) : (
                <>
                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Nomor Surat:</div>
                  <div style={{ fontWeight: 700, fontFamily: "monospace", color: T.text }}>{modalDetail.data.nomor_surat}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Tujuan Surat:</div>
                  <div style={{ fontWeight: 600, color: T.text }}>{modalDetail.data.tujuan_surat}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Tanggal Surat:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.tanggal_surat ? modalDetail.data.tanggal_surat.split("T")[0] : "—"}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Bidang Pengonsep:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.bidang_pengonsep}</div>

                  <div style={{ color: T.textSecondary, fontWeight: 600 }}>Penandatangan:</div>
                  <div style={{ color: T.text }}>{modalDetail.data.penandatangan}</div>
                </>
              )}

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Perihal:</div>
              <div style={{ color: T.text, lineHeight: 1.5 }}>{modalDetail.data.perihal}</div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Sifat & Status:</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {renderSifatBadge(modalDetail.data.sifat)}
                {renderStatusBadge(modalDetail.data.status)}
              </div>

              <div style={{ color: T.textSecondary, fontWeight: 600 }}>Pencatat (TU):</div>
              <div style={{ color: T.textSecondary, fontSize: 12 }}>{modalDetail.data.created_by || "Admin TU"}</div>
            </div>

            {/* Berkas File Link */}
            {(modalDetail.data.file_url || modalDetail.data.file_draft_url || modalDetail.data.file_final_url) && (
              <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: T.bg, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, marginBottom: 6 }}>BERKAS TERKAIT</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {modalDetail.data.file_url && (
                    <a href={modalDetail.data.file_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.primary, textDecoration: "none", fontWeight: 600 }}>
                      <Icon name="link" size={13} /> Berkas Surat Masuk
                    </a>
                  )}
                  {modalDetail.data.file_draft_url && (
                    <a href={modalDetail.data.file_draft_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.warning, textDecoration: "none", fontWeight: 600 }}>
                      <Icon name="file" size={13} /> Draf Naskah
                    </a>
                  )}
                  {modalDetail.data.file_final_url && (
                    <a href={modalDetail.data.file_final_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.success, textDecoration: "none", fontWeight: 600 }}>
                      <Icon name="checkCircle" size={13} /> Surat Bertandatangan
                    </a>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <button
                onClick={() => setModalDetail(null)}
                style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.card, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 5: KONFIRMASI HAPUS (ADMIN ONLY) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalHapus && (
        <Modal
          title={modalHapus.jenis === "masuk" ? "Hapus Surat Masuk" : "Hapus / Batalkan Surat Keluar"}
          subtitle="Tindakan ini memerlukan hak akses Administrator"
          icon="trash"
          onClose={() => setModalHapus(null)}
          maxWidth={480}
        >
          <div style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: 13, color: T.text, lineHeight: 1.5, margin: "0 0 16px" }}>
              Apakah Anda yakin ingin menghapus arsip surat agenda{" "}
              <strong>
                {modalHapus.jenis === "masuk" ? modalHapus.data.nomor_agenda : modalHapus.data.nomor_surat}
              </strong>
              ?
            </p>

            {modalHapus.jenis === "keluar" ? (
              <div style={{ background: T.bg, padding: 12, borderRadius: 8, fontSize: 12, color: T.textSecondary, marginBottom: 16 }}>
                <strong>Catatan Surat Keluar:</strong>
                <p style={{ margin: "4px 0 0" }}>
                  Disarankan memilih <strong>"Tandai Dibatalkan"</strong> agar nomor urut surat tidak terputus/hilang dalam buku agenda fisik.
                </p>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalHapus(null)}
                style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 12.5 }}
              >
                Batal
              </button>

              {modalHapus.jenis === "keluar" && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => konfirmasiHapus(false)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: T.warning, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
                >
                  Tandai Dibatalkan
                </button>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => konfirmasiHapus(true)}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: T.danger, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
              >
                {submitting ? "Menghapus..." : "Hapus Permanen"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
