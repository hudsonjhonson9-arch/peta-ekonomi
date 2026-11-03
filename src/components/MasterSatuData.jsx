import { useState, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemeContext } from "../App.jsx";
import useResponsive from "../useResponsive.js";
import { Icon, Select, DatePicker, Button, Badge } from "./ui.jsx";
import SumbaBaratMap from "./SumbaBaratMap.jsx";

const TABS = [
  { key: "opd",            label: "Pengaturan OPD",     icon: "building" },
  { key: "urusan",         label: "Urusan",             icon: "layers" },
  { key: "bidang_urusan",  label: "Bidang Urusan",      icon: "folder" },
  { key: "hak_akses",      label: "Hak Akses Urusan",   icon: "shield" },
  { key: "topik",          label: "Topik",              icon: "tag" },
  { key: "sub_topik",      label: "Sub Topik",          icon: "file" },
  { key: "satuan",         label: "Satuan",             icon: "tag" },
  { key: "daftar_data",    label: "Daftar Data (SK)",   icon: "checkCircle" },
  { key: "template_field", label: "Template Field",     icon: "layers" },
  { key: "wilayah",        label: "Wilayah",            icon: "world" },
  { key: "reopen",         label: "Permintaan Reopen",  icon: "clock" },
];

const TIPE_FIELD_OPTS = [
  { value: "teks", label: "Teks" },
  { value: "angka", label: "Angka Bulat" },
  { value: "desimal", label: "Desimal" },
  { value: "tanggal", label: "Tanggal" },
  { value: "pilihan", label: "Pilihan" },
];

export default function MasterSatuData({ user, showToast, initialTab = "opd" }) {
  const { T, isDark } = useContext(ThemeContext);
  const { isMobile } = useResponsive();
  const queryClient = useQueryClient();

  const [tab, setTabState] = useState(() => {
    try {
      return localStorage.getItem("master_satudata_tab") || initialTab || "opd";
    } catch {
      return initialTab || "opd";
    }
  });
  const setTab = (t) => {
    setTabState(t);
    try {
      localStorage.setItem("master_satudata_tab", t);
    } catch (_) {}
  };
  const [searchQ, setSearchQ] = useState("");
  const [filterParent, setFilterParent] = useState("SEMUA");
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit'|'decide', type, item }
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["satudata-master-ringkasan"],
    queryFn: () => fetch("/api/satudata/master/ringkasan", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : {})),
  });

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["satudata-master-ringkasan"] });
    queryClient.invalidateQueries({ queryKey: ["bankdata-opd"] });
    queryClient.invalidateQueries({ queryKey: ["bankdata-tree"] });
  };

  const bidangs = data?.bidangs || [];
  const opds = data?.opd || [];
  const urusans = data?.urusan || [];
  const bidangUrusans = data?.bidang_urusan || [];
  const hakAksesList = data?.hak_akses_urusan || [];
  const topiks = data?.topik || [];
  const subTopiks = data?.sub_topik || [];
  const satuans = data?.satuan || [];
  const daftarDatas = data?.daftar_data || [];
  const templateFields = data?.template_field || [];
  const wilayahs = data?.wilayah || [];
  const reopenRequests = data?.reopen_requests || [];
  const datasets = data?.datasets || [];

  const pendingReopenCount = useMemo(
    () => reopenRequests.filter(r => r.status === "menunggu").length,
    [reopenRequests]
  );

  const inpStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.inputBg,
    color: T.text, fontSize: 13, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  };

  const lblStyle = {
    display: "block", fontSize: 11, fontWeight: 700, color: T.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5,
  };

  const thStyle = {
    padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
    color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5,
    borderBottom: `1px solid ${T.border}`, background: T.bgAlt, whiteSpace: "nowrap",
  };

  const tdStyle = {
    padding: "10px 12px", fontSize: 13, color: T.text,
    borderBottom: `1px solid ${T.border}`, verticalAlign: "middle",
  };

  const bukaTambah = (type) => {
    const defaults = {
      opd: { bidang_id: bidangs[0]?.id || 3, nama: "", kode_opd: "", singkatan: "", keterangan: "", is_active: true },
      urusan: { kode_urusan: "", nama_urusan: "", keterangan: "" },
      bidang_urusan: { urusan_id: urusans[0]?.id || "", kode_bidang: "", nama_bidang: "", keterangan: "" },
      hak_akses: { opd_id: opds[0]?.id || "", urusan_id: urusans[0]?.id || "", bidang_urusan_id: "", keterangan: "" },
      topik: { nama_topik: "", slug: "", ikon: "layers", deskripsi: "", urutan: topiks.length + 1, is_active: true },
      sub_topik: { topik_id: topiks[0]?.id || "", nama_sub_topik: "", slug: "", deskripsi: "", urutan: 1, is_active: true },
      satuan: { nama_satuan: "", simbol: "", keterangan: "" },
      daftar_data: { opd_id: opds[0]?.id || "", tahun: 2025, jumlah_target_sk: 10, nomor_sk: "", keterangan: "" },
      template_field: {
        kode: "", nama_template: "", tipe_preset: "grup", deskripsi: "",
        fields_json: [{ nama_field: "nilai", label: "Nilai", tipe_data: "desimal", wajib: true, tampil_grafik: true }],
      },
      wilayah: { kode_wilayah: "", nama_wilayah: "", tingkat: "Kecamatan", induk_kode: "53.12", luas_km2: "", jumlah_penduduk: "" },
      reopen: { dataset_id: datasets[0]?.id || "", periode_tahun: new Date().getFullYear(), alasan: "" },
    };
    setForm(defaults[type] || {});
    setModal({ mode: "add", type });
  };

  const bukaEdit = (type, item) => {
    setForm({
      ...item,
      fields_json: Array.isArray(item.fields_json) ? item.fields_json.map(f => ({ ...f })) : [],
    });
    setModal({ mode: "edit", type, item });
  };

  const simpanModal = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      const { mode, type, item } = modal;
      const endpointMap = {
        opd: "/api/satudata/master/opd",
        urusan: "/api/satudata/master/urusan",
        bidang_urusan: "/api/satudata/master/bidang-urusan",
        hak_akses: "/api/satudata/master/hak-akses-urusan",
        topik: "/api/satudata/master/topik",
        sub_topik: "/api/satudata/master/sub-topik",
        satuan: "/api/satudata/master/satuan",
        daftar_data: "/api/satudata/master/daftar-data",
        template_field: "/api/satudata/master/template-field",
        wilayah: "/api/satudata/master/wilayah",
        reopen: "/api/satudata/reopen",
      };
      let url = endpointMap[type];
      let method = "POST";
      if (mode === "edit" && type !== "daftar_data" && type !== "hak_akses") {
        url = `${url}/${item.id}`;
        method = "PUT";
      } else if (mode === "decide" && type === "reopen") {
        url = `/api/satudata/reopen/${item.id}/putuskan`;
        method = "POST";
      }

      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menyimpan data");
      showToast?.(out.message || "Berhasil disimpan");
      setModal(null);
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const hapusItem = async (type, id, label) => {
    if (!window.confirm(`Hapus ${label}? Tindakan ini tidak dapat dibatalkan.`)) return;
    const endpointMap = {
      opd: "/api/satudata/master/opd",
      urusan: "/api/satudata/master/urusan",
      bidang_urusan: "/api/satudata/master/bidang-urusan",
      hak_akses: "/api/satudata/master/hak-akses-urusan",
      topik: "/api/satudata/master/topik",
      sub_topik: "/api/satudata/master/sub-topik",
      satuan: "/api/satudata/master/satuan",
      daftar_data: "/api/satudata/master/daftar-data",
      template_field: "/api/satudata/master/template-field",
      wilayah: "/api/satudata/master/wilayah",
    };
    try {
      const res = await fetch(`${endpointMap[type]}/${id}`, { method: "DELETE", credentials: "same-origin" });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Gagal menghapus");
      showToast?.(out.message || "Berhasil dihapus");
      reload();
    } catch (e) {
      showToast?.("Gagal: " + e.message);
    }
  };

  const q = searchQ.trim().toLowerCase();

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 800, color: T.text }}>
            Master Data Satu Data
          </h2>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>
            Pengaturan referensi OPD, Urusan Pemerintahan, Topik, Satuan, Daftar Data SK, Template Field, Wilayah & Permintaan Reopen
          </div>
        </div>
        <Button variant="primary" icon="plus" onClick={() => bukaTambah(tab)}>
          {tab === "reopen" ? "Ajukan Reopen" : `Tambah ${TABS.find(t => t.key === tab)?.label || "Data"}`}
        </Button>
      </div>

      {/* Sub-Navigation Pills (Scrollable horizontally with hidden scrollbar) */}
      <style>{`
        .sd-tabs-no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>
      <div
        className="sd-tabs-no-scrollbar"
        onWheel={e => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
        style={{
          display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto",
          scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch",
          paddingBottom: 10, marginBottom: 16,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={e => {
                setTab(t.key);
                setSearchQ("");
                setFilterParent("SEMUA");
                e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
              }}
              style={{
                display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                padding: "8px 13px", borderRadius: 9,
                border: active ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                background: active ? `${T.primary}15` : T.card,
                color: active ? T.primary : T.textSecondary,
                fontSize: 12.5, fontWeight: active ? 700 : 600,
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
              }}
            >
              <Icon name={t.icon} size={14} />
              <span>{t.label}</span>
              {t.key === "reopen" && pendingReopenCount > 0 && (
                <span style={{
                  background: "#DC2626", color: "#fff", borderRadius: 20,
                  padding: "1px 7px", fontSize: 10, fontWeight: 700,
                }}>
                  {pendingReopenCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        marginBottom: 14, background: T.card, padding: 12, borderRadius: 12,
        border: `1px solid ${T.border}`,
      }}>
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <Icon name="search" size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textMuted }} />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder={`Cari pada ${TABS.find(t => t.key === tab)?.label || "data"}...`}
            style={{ ...inpStyle, paddingLeft: 34 }}
          />
        </div>

        {tab === "opd" && (
          <Select
            value={filterParent}
            onChange={v => setFilterParent(v)}
            style={{ minWidth: 230 }}
            options={[
              { value: "SEMUA", label: "Semua Bidang Koordinasi" },
              ...bidangs.map(b => ({ value: String(b.id), label: b.nama })),
            ]}
          />
        )}

        {(tab === "bidang_urusan" || tab === "hak_akses") && (
          <Select
            value={filterParent}
            onChange={v => setFilterParent(v)}
            style={{ minWidth: 240 }}
            options={[
              { value: "SEMUA", label: "Semua Urusan Pemerintahan" },
              ...urusans.map(u => ({ value: String(u.id), label: `${u.kode_urusan} - ${u.nama_urusan}` })),
            ]}
          />
        )}

        {tab === "sub_topik" && (
          <Select
            value={filterParent}
            onChange={v => setFilterParent(v)}
            style={{ minWidth: 220 }}
            options={[
              { value: "SEMUA", label: "Semua Topik" },
              ...topiks.map(t => ({ value: String(t.id), label: t.nama_topik })),
            ]}
          />
        )}

        {tab === "wilayah" && (
          <Select
            value={filterParent}
            onChange={v => setFilterParent(v)}
            style={{ minWidth: 200 }}
            options={[
              { value: "SEMUA", label: "Semua Tingkat Wilayah" },
              { value: "Provinsi", label: "Provinsi" },
              { value: "Kabupaten/Kota", label: "Kabupaten/Kota" },
              { value: "Kecamatan", label: "Kecamatan" },
              { value: "Desa/Kelurahan", label: "Desa/Kelurahan" },
            ]}
          />
        )}

        {tab === "reopen" && (
          <Select
            value={filterParent}
            onChange={v => setFilterParent(v)}
            style={{ minWidth: 180 }}
            options={[
              { value: "SEMUA", label: "Semua Status" },
              { value: "menunggu", label: "Menunggu Keputusan" },
              { value: "disetujui", label: "Disetujui" },
              { value: "ditolak", label: "Ditolak" },
            ]}
          />
        )}
      </div>

      {/* Main Content Card */}
      <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: T.textMuted }}>Memuat Master Data Satu Data...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            {/* 1. TAB OPD */}
            {tab === "opd" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Kode OPD</th>
                    <th style={thStyle}>Singkatan</th>
                    <th style={thStyle}>Nama Perangkat Daerah (OPD)</th>
                    <th style={thStyle}>Bidang Koordinasi BAPPERIDA</th>
                    <th style={thStyle}>Dataset</th>
                    <th style={thStyle}>Keterangan</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {opds
                    .filter(o => (filterParent === "SEMUA" || String(o.bidang_id) === String(filterParent)))
                    .filter(o => !q || `${o.nama} ${o.kode_opd || ""} ${o.singkatan || ""} ${o.bidang_nama || ""}`.toLowerCase().includes(q))
                    .map(o => (
                      <tr key={o.id}>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 600 }}>{o.kode_opd || `OPD-${o.id}`}</td>
                        <td style={tdStyle}>{o.singkatan || "—"}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{o.nama}</td>
                        <td style={tdStyle}>{o.bidang_nama || "—"}</td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 700, color: T.primary }}>{o.jumlah_dataset || 0}</span>{" "}
                          <span style={{ fontSize: 11, color: T.textMuted }}>({o.dataset_disetujui || 0} terbit)</span>
                        </td>
                        <td style={{ ...tdStyle, color: T.textSecondary }}>{o.keterangan || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("opd", o)}>Edit</Button>{" "}
                          <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("opd", o.id, o.nama)} style={{ color: T.danger }} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {/* 2. TAB URUSAN */}
            {tab === "urusan" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Kode Urusan</th>
                    <th style={thStyle}>Nama Urusan Pemerintahan</th>
                    <th style={thStyle}>Jml Bidang Urusan</th>
                    <th style={thStyle}>Keterangan</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {urusans
                    .filter(u => !q || `${u.kode_urusan} ${u.nama_urusan} ${u.keterangan || ""}`.toLowerCase().includes(q))
                    .map(u => {
                      const jmlBidang = bidangUrusans.filter(b => String(b.urusan_id) === String(u.id)).length;
                      return (
                        <tr key={u.id}>
                          <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: T.primary }}>{u.kode_urusan}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{u.nama_urusan}</td>
                          <td style={tdStyle}>{jmlBidang} Bidang</td>
                          <td style={{ ...tdStyle, color: T.textSecondary }}>{u.keterangan || "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("urusan", u)}>Edit</Button>{" "}
                            <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("urusan", u.id, u.nama_urusan)} style={{ color: T.danger }} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}

            {/* 3. TAB BIDANG URUSAN */}
            {tab === "bidang_urusan" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Kode Bidang</th>
                    <th style={thStyle}>Nama Bidang Urusan</th>
                    <th style={thStyle}>Urusan Induk</th>
                    <th style={thStyle}>Keterangan</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {bidangUrusans
                    .filter(b => filterParent === "SEMUA" || String(b.urusan_id) === String(filterParent))
                    .filter(b => !q || `${b.kode_bidang} ${b.nama_bidang} ${b.nama_urusan || ""}`.toLowerCase().includes(q))
                    .map(b => (
                      <tr key={b.id}>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: T.primary }}>{b.kode_bidang}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{b.nama_bidang}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: T.textSecondary }}>{b.kode_urusan} - {b.nama_urusan}</td>
                        <td style={{ ...tdStyle, color: T.textSecondary }}>{b.keterangan || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("bidang_urusan", b)}>Edit</Button>{" "}
                          <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("bidang_urusan", b.id, b.nama_bidang)} style={{ color: T.danger }} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {/* 4. TAB HAK AKSES URUSAN */}
            {tab === "hak_akses" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Perangkat Daerah (OPD)</th>
                    <th style={thStyle}>Urusan Pemerintahan</th>
                    <th style={thStyle}>Bidang Urusan</th>
                    <th style={thStyle}>Keterangan</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {hakAksesList
                    .filter(h => filterParent === "SEMUA" || String(h.urusan_id) === String(filterParent))
                    .filter(h => !q || `${h.opd_nama} ${h.nama_urusan} ${h.nama_bidang || ""}`.toLowerCase().includes(q))
                    .map(h => (
                      <tr key={h.id}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{h.opd_nama}</td>
                        <td style={tdStyle}>{h.kode_urusan} - {h.nama_urusan}</td>
                        <td style={tdStyle}>{h.kode_bidang ? `${h.kode_bidang} - ${h.nama_bidang}` : "Seluruh Bidang pada Urusan Ini"}</td>
                        <td style={{ ...tdStyle, color: T.textSecondary }}>{h.keterangan || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("hak_akses", h.id, `Hak akses ${h.opd_nama}`)} style={{ color: T.danger }}>
                            Cabut
                          </Button>
                        </td>
                      </tr>
                    ))}
                  {hakAksesList.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                        Belum ada pembatasan Hak Akses Urusan per OPD. Klik <b>+ Tambah Hak Akses Urusan</b> untuk memetakan urusan ke OPD.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 5. TAB TOPIK */}
            {tab === "topik" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Urutan</th>
                    <th style={thStyle}>Nama Topik</th>
                    <th style={thStyle}>Slug</th>
                    <th style={thStyle}>Sub Topik</th>
                    <th style={thStyle}>Deskripsi</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {topiks
                    .filter(t => !q || `${t.nama_topik} ${t.slug} ${t.deskripsi || ""}`.toLowerCase().includes(q))
                    .map(t => {
                      const subCount = subTopiks.filter(s => String(s.topik_id) === String(t.id)).length;
                      return (
                        <tr key={t.id}>
                          <td style={tdStyle}>{t.urutan}</td>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                              <Icon name={t.ikon || "layers"} size={15} style={{ color: T.primary }} />
                              {t.nama_topik}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: T.textMuted }}>{t.slug}</td>
                          <td style={tdStyle}>{subCount} Sub Topik</td>
                          <td style={{ ...tdStyle, color: T.textSecondary }}>{t.deskripsi || "—"}</td>
                          <td style={tdStyle}>
                            <Badge label={t.is_active ? "Aktif" : "Nonaktif"} colors={t.is_active ? { bg: "#DCFCE7", text: "#15803D" } : { bg: "#F1F5F9", text: "#64748B" }} />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("topik", t)}>Edit</Button>{" "}
                            <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("topik", t.id, t.nama_topik)} style={{ color: T.danger }} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}

            {/* 6. TAB SUB TOPIK */}
            {tab === "sub_topik" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Topik Induk</th>
                    <th style={thStyle}>Nama Sub Topik</th>
                    <th style={thStyle}>Slug</th>
                    <th style={thStyle}>Deskripsi</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {subTopiks
                    .filter(s => filterParent === "SEMUA" || String(s.topik_id) === String(filterParent))
                    .filter(s => !q || `${s.nama_sub_topik} ${s.nama_topik || ""} ${s.deskripsi || ""}`.toLowerCase().includes(q))
                    .map(s => (
                      <tr key={s.id}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: T.primary }}>{s.nama_topik}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{s.nama_sub_topik}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: T.textMuted }}>{s.slug}</td>
                        <td style={{ ...tdStyle, color: T.textSecondary }}>{s.deskripsi || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("sub_topik", s)}>Edit</Button>{" "}
                          <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("sub_topik", s.id, s.nama_sub_topik)} style={{ color: T.danger }} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {/* 7. TAB SATUAN */}
            {tab === "satuan" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nama Satuan</th>
                    <th style={thStyle}>Simbol</th>
                    <th style={thStyle}>Keterangan</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {satuans
                    .filter(s => !q || `${s.nama_satuan} ${s.simbol || ""} ${s.keterangan || ""}`.toLowerCase().includes(q))
                    .map(s => (
                      <tr key={s.id}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{s.nama_satuan}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: T.primary }}>{s.simbol || "—"}</td>
                        <td style={{ ...tdStyle, color: T.textSecondary }}>{s.keterangan || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("satuan", s)}>Edit</Button>{" "}
                          <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("satuan", s.id, s.nama_satuan)} style={{ color: T.danger }} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {/* 8. TAB DAFTAR DATA (TARGET SK) */}
            {tab === "daftar_data" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Tahun</th>
                    <th style={thStyle}>Perangkat Daerah (OPD)</th>
                    <th style={thStyle}>Nomor SK</th>
                    <th style={thStyle}>Target SK</th>
                    <th style={thStyle}>Realisasi Dataset</th>
                    <th style={thStyle}>Ketercapaian (%)</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {daftarDatas
                    .filter(d => !q || `${d.opd_nama} ${d.nomor_sk || ""} ${d.tahun}`.toLowerCase().includes(q))
                    .map(d => {
                      const target = Number(d.jumlah_target_sk) || 0;
                      const real = Number(d.realisasi_dataset) || 0;
                      const pct = target > 0 ? Math.min(100, Math.round((real / target) * 100)) : 0;
                      return (
                        <tr key={d.id}>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{d.tahun}</td>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{d.opd_nama}</td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>{d.nomor_sk || "—"}</td>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{target} Dataset</td>
                          <td style={tdStyle}>
                            <b>{real}</b> dibuat ({d.disetujui_dataset || 0} disetujui)
                          </td>
                          <td style={{ ...tdStyle, minWidth: 160 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 8, background: T.bgAlt, borderRadius: 99, overflow: "hidden" }}>
                                <div style={{
                                  width: `${pct}%`, height: "100%",
                                  background: pct >= 80 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626",
                                }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("daftar_data", d)}>Edit</Button>{" "}
                            <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("daftar_data", d.id, `Target SK ${d.opd_nama}`)} style={{ color: T.danger }} />
                          </td>
                        </tr>
                      );
                    })}
                  {daftarDatas.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                        Belum ada penetapan Target Daftar Data SK per OPD. Klik <b>+ Tambah Daftar Data (SK)</b> di kanan atas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 9. TAB TEMPLATE FIELD */}
            {tab === "template_field" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Tipe Preset</th>
                    <th style={thStyle}>Nama Template</th>
                    <th style={thStyle}>Kode</th>
                    <th style={thStyle}>Susunan Kolom (Field)</th>
                    <th style={thStyle}>Deskripsi</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {templateFields
                    .filter(t => !q || `${t.nama_template} ${t.kode} ${t.deskripsi || ""}`.toLowerCase().includes(q))
                    .map(t => (
                      <tr key={t.id}>
                        <td style={tdStyle}>
                          <Badge
                            label={t.tipe_preset === "grup" ? "Template Grup" : "Field Tunggal"}
                            colors={t.tipe_preset === "grup" ? { bg: "#EFF6FF", text: "#2563EB" } : { bg: "#F0FDF4", text: "#16A34A" }}
                          />
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{t.nama_template}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: T.textMuted }}>{t.kode}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {(t.fields_json || []).map((f, idx) => (
                              <span key={idx} style={{
                                fontSize: 11, padding: "2px 8px", borderRadius: 6,
                                background: T.bgAlt, border: `1px solid ${T.border}`, fontWeight: 600,
                              }}>
                                {f.label} <span style={{ color: T.textMuted }}>({f.tipe_data})</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, color: T.textSecondary, fontSize: 12 }}>{t.deskripsi || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("template_field", t)}>Edit</Button>{" "}
                          <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("template_field", t.id, t.nama_template)} style={{ color: T.danger }} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}

            {/* 10. TAB WILAYAH */}
            {tab === "wilayah" && (
              <div>
                <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
                  <SumbaBaratMap
                    mode="wilayah"
                    title="Peta Referensi Wilayah Kabupaten Sumba Barat (GeoJSON 53.12)"
                    subtitle="Klik poligon kecamatan pada peta untuk menyaring daftar Desa/Kelurahan di kecamatan tersebut"
                    selectedKode={searchQ.startsWith("53.12.") ? searchQ : null}
                    onSelectKecamatan={(kode) => setSearchQ(kode || "")}
                    height={360}
                  />
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Kode Kemendagri</th>
                    <th style={thStyle}>Nama Wilayah</th>
                    <th style={thStyle}>Tingkat</th>
                    <th style={thStyle}>Kode Induk</th>
                    <th style={thStyle}>Luas (km²)</th>
                    <th style={thStyle}>Jumlah Penduduk</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {wilayahs
                    .filter(w => filterParent === "SEMUA" || w.tingkat === filterParent)
                    .filter(w => !q || `${w.kode_wilayah} ${w.nama_wilayah} ${w.tingkat}`.toLowerCase().includes(q))
                    .map(w => (
                      <tr key={w.id}>
                        <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: T.primary }}>{w.kode_wilayah}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{w.nama_wilayah}</td>
                        <td style={tdStyle}>
                          <Badge
                            label={w.tingkat}
                            colors={
                              w.tingkat === "Kecamatan"
                                ? { bg: "#EFF6FF", text: "#2563EB" }
                                : w.tingkat === "Kabupaten/Kota"
                                ? { bg: "#EDE9FE", text: "#7C3AED" }
                                : { bg: "#F0FDF4", text: "#16A34A" }
                            }
                          />
                        </td>
                        <td style={{ ...tdStyle, fontFamily: "monospace", color: T.textSecondary }}>{w.parent_kode || w.induk_kode || "—"}</td>
                        <td style={tdStyle}>{w.luas_km2 != null ? Number(w.luas_km2).toLocaleString("id-ID") : "—"}</td>
                        <td style={tdStyle}>{w.jumlah_penduduk != null ? Number(w.jumlah_penduduk).toLocaleString("id-ID") : "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <Button size="xs" variant="ghost" icon="edit" onClick={() => bukaEdit("wilayah", w)}>Edit</Button>{" "}
                          <Button size="xs" variant="ghost" icon="trash" onClick={() => hapusItem("wilayah", w.id, w.nama_wilayah)} style={{ color: T.danger }} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            )}

            {/* 11. TAB PERMINTAAN REOPEN */}
            {tab === "reopen" && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>OPD</th>
                    <th style={thStyle}>Dataset / Indikator</th>
                    <th style={thStyle}>Periode</th>
                    <th style={thStyle}>Alasan Pengajuan</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Batas Waktu Reopen</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Keputusan</th>
                  </tr>
                </thead>
                <tbody>
                  {reopenRequests
                    .filter(r => filterParent === "SEMUA" || r.status === filterParent)
                    .filter(r => !q || `${r.dataset_nama} ${r.opd_nama} ${r.alasan}`.toLowerCase().includes(q))
                    .map(r => (
                      <tr key={r.id}>
                        <td style={{ ...tdStyle, fontSize: 12, color: T.textSecondary }}>
                          {new Date(r.created_at).toLocaleDateString("id-ID")}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{r.opd_nama}</td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{r.dataset_nama}</td>
                        <td style={tdStyle}>{r.periode_tahun}</td>
                        <td style={{ ...tdStyle, maxWidth: 280 }}>{r.alasan}</td>
                        <td style={tdStyle}>
                          <Badge
                            label={r.status === "menunggu" ? "Menunggu" : r.status === "disetujui" ? "Disetujui" : "Ditolak"}
                            colors={
                              r.status === "menunggu"
                                ? { bg: "#FEF3C7", text: "#D97706" }
                                : r.status === "disetujui"
                                ? { bg: "#DCFCE7", text: "#15803D" }
                                : { bg: "#FEE2E2", text: "#DC2626" }
                            }
                          />
                        </td>
                        <td style={tdStyle}>
                          {r.batas_waktu ? String(r.batas_waktu).slice(0, 10) : "—"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          {r.status === "menunggu" && user?.role === "Admin" && (
                            <>
                              <Button
                                size="xs"
                                variant="success"
                                icon="check"
                                onClick={() => {
                                  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
                                  setForm({ status: "disetujui", batas_waktu: nextWeek, catatan_admin: "" });
                                  setModal({ mode: "decide", type: "reopen", item: r });
                                }}
                              >
                                Putuskan
                              </Button>
                            </>
                          )}
                          {r.status !== "menunggu" && (
                            <span style={{ fontSize: 11, color: T.textMuted }}>
                              Oleh {r.diputuskan_oleh || "Admin"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  {reopenRequests.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 28, textAlign: "center", color: T.textMuted }}>
                        Belum ada permintaan pembukaan kembali gerbang pemutakhiran (Reopen).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal Form Add / Edit / Decide */}
      {modal && (
        <div
          onClick={() => !busy && setModal(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
            zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card, color: T.text, borderRadius: 14,
              border: `1px solid ${T.border}`, boxShadow: T.shadowLg,
              width: "100%", maxWidth: modal.type === "template_field" ? 680 : 500,
              maxHeight: "90vh", overflowY: "auto", padding: 22,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {modal.mode === "decide"
                  ? "Keputusan Permintaan Reopen"
                  : `${modal.mode === "edit" ? "Edit" : "Tambah"} ${TABS.find(t => t.key === modal.type)?.label || ""}`}
              </h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted }}>
                <Icon name="x" size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {modal.type === "opd" && (
                <>
                  <div>
                    <label style={lblStyle}>Bidang Koordinasi BAPPERIDA *</label>
                    <Select
                      fullWidth
                      value={String(form.bidang_id || "")}
                      onChange={v => setForm(f => ({ ...f, bidang_id: Number(v) }))}
                      options={bidangs.map(b => ({ value: String(b.id), label: b.nama }))}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Kode OPD</label>
                      <input value={form.kode_opd || ""} onChange={e => setForm(f => ({ ...f, kode_opd: e.target.value }))} placeholder="Mis: 1.01.01" style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Singkatan</label>
                      <input value={form.singkatan || ""} onChange={e => setForm(f => ({ ...f, singkatan: e.target.value }))} placeholder="Mis: DISDIKPORA" style={inpStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Nama Perangkat Daerah (OPD) *</label>
                    <input value={form.nama || ""} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="Mis: Dinas Pendidikan, Kepemudaan dan Olahraga" style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Keterangan</label>
                    <textarea rows={2} value={form.keterangan || ""} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "urusan" && (
                <>
                  <div>
                    <label style={lblStyle}>Kode Urusan *</label>
                    <input value={form.kode_urusan || ""} onChange={e => setForm(f => ({ ...f, kode_urusan: e.target.value }))} placeholder="Mis: 1" style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Nama Urusan Pemerintahan *</label>
                    <input value={form.nama_urusan || ""} onChange={e => setForm(f => ({ ...f, nama_urusan: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Keterangan</label>
                    <textarea rows={2} value={form.keterangan || ""} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "bidang_urusan" && (
                <>
                  <div>
                    <label style={lblStyle}>Urusan Induk *</label>
                    <Select
                      fullWidth
                      value={String(form.urusan_id || "")}
                      onChange={v => setForm(f => ({ ...f, urusan_id: Number(v) }))}
                      options={urusans.map(u => ({ value: String(u.id), label: `${u.kode_urusan} - ${u.nama_urusan}` }))}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Kode Bidang Urusan *</label>
                    <input value={form.kode_bidang || ""} onChange={e => setForm(f => ({ ...f, kode_bidang: e.target.value }))} placeholder="Mis: 1.01" style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Nama Bidang Urusan *</label>
                    <input value={form.nama_bidang || ""} onChange={e => setForm(f => ({ ...f, nama_bidang: e.target.value }))} placeholder="Mis: Pendidikan" style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Keterangan</label>
                    <textarea rows={2} value={form.keterangan || ""} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "hak_akses" && (
                <>
                  <div>
                    <label style={lblStyle}>Perangkat Daerah (OPD) *</label>
                    <Select
                      fullWidth
                      value={String(form.opd_id || "")}
                      onChange={v => setForm(f => ({ ...f, opd_id: Number(v) }))}
                      options={opds.map(o => ({ value: String(o.id), label: o.nama }))}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Urusan Pemerintahan *</label>
                    <Select
                      fullWidth
                      value={String(form.urusan_id || "")}
                      onChange={v => setForm(f => ({ ...f, urusan_id: Number(v), bidang_urusan_id: "" }))}
                      options={urusans.map(u => ({ value: String(u.id), label: `${u.kode_urusan} - ${u.nama_urusan}` }))}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Bidang Urusan (Opsional — kosongkan untuk semua bidang di urusan ini)</label>
                    <Select
                      fullWidth
                      value={String(form.bidang_urusan_id || "")}
                      onChange={v => setForm(f => ({ ...f, bidang_urusan_id: v ? Number(v) : "" }))}
                      options={[
                        { value: "", label: "Seluruh Bidang pada Urusan Ini" },
                        ...bidangUrusans
                          .filter(b => String(b.urusan_id) === String(form.urusan_id))
                          .map(b => ({ value: String(b.id), label: `${b.kode_bidang} - ${b.nama_bidang}` })),
                      ]}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Keterangan</label>
                    <input value={form.keterangan || ""} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "topik" && (
                <>
                  <div>
                    <label style={lblStyle}>Nama Topik *</label>
                    <input value={form.nama_topik || ""} onChange={e => setForm(f => ({ ...f, nama_topik: e.target.value }))} style={inpStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Urutan Tampil</label>
                      <input type="number" value={form.urutan ?? 1} onChange={e => setForm(f => ({ ...f, urutan: Number(e.target.value) }))} style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Status</label>
                      <Select
                        fullWidth
                        value={form.is_active ? "1" : "0"}
                        onChange={v => setForm(f => ({ ...f, is_active: v === "1" }))}
                        options={[{ value: "1", label: "Aktif" }, { value: "0", label: "Nonaktif" }]}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Deskripsi</label>
                    <textarea rows={2} value={form.deskripsi || ""} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "sub_topik" && (
                <>
                  <div>
                    <label style={lblStyle}>Topik Induk *</label>
                    <Select
                      fullWidth
                      value={String(form.topik_id || "")}
                      onChange={v => setForm(f => ({ ...f, topik_id: Number(v) }))}
                      options={topiks.map(t => ({ value: String(t.id), label: t.nama_topik }))}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Nama Sub Topik *</label>
                    <input value={form.nama_sub_topik || ""} onChange={e => setForm(f => ({ ...f, nama_sub_topik: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Deskripsi</label>
                    <textarea rows={2} value={form.deskripsi || ""} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "satuan" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Nama Satuan *</label>
                      <input value={form.nama_satuan || ""} onChange={e => setForm(f => ({ ...f, nama_satuan: e.target.value }))} placeholder="Mis: Persen" style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Simbol</label>
                      <input value={form.simbol || ""} onChange={e => setForm(f => ({ ...f, simbol: e.target.value }))} placeholder="Mis: %" style={inpStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Keterangan</label>
                    <input value={form.keterangan || ""} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "daftar_data" && (
                <>
                  <div>
                    <label style={lblStyle}>Perangkat Daerah (OPD) *</label>
                    <Select
                      fullWidth
                      value={String(form.opd_id || "")}
                      onChange={v => setForm(f => ({ ...f, opd_id: Number(v) }))}
                      options={opds.map(o => ({ value: String(o.id), label: o.nama }))}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Tahun Penetapan *</label>
                      <input type="number" value={form.tahun || 2025} onChange={e => setForm(f => ({ ...f, tahun: Number(e.target.value) }))} style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Target Jumlah Data dalam SK *</label>
                      <input type="number" value={form.jumlah_target_sk ?? 10} onChange={e => setForm(f => ({ ...f, jumlah_target_sk: Number(e.target.value) }))} style={inpStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Nomor SK Bupati / Penetapan</label>
                    <input value={form.nomor_sk || ""} onChange={e => setForm(f => ({ ...f, nomor_sk: e.target.value }))} placeholder="Mis: SK Bupati No. 188.45/85/HK/2025" style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Keterangan</label>
                    <textarea rows={2} value={form.keterangan || ""} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "template_field" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Nama Template *</label>
                      <input value={form.nama_template || ""} onChange={e => setForm(f => ({ ...f, nama_template: e.target.value }))} placeholder="Mis: Nilai Tunggal Tahunan" style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Tipe Preset</label>
                      <Select
                        fullWidth
                        value={form.tipe_preset || "grup"}
                        onChange={v => setForm(f => ({ ...f, tipe_preset: v }))}
                        options={[
                          { value: "grup", label: "Template Grup" },
                          { value: "field", label: "Field Tunggal" },
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Deskripsi</label>
                    <input value={form.deskripsi || ""} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} style={inpStyle} />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ ...lblStyle, marginBottom: 0 }}>Daftar Kolom (Field) dalam Template</label>
                      <Button
                        size="xs"
                        variant="secondary"
                        icon="plus"
                        onClick={() => setForm(f => ({
                          ...f,
                          fields_json: [...(f.fields_json || []), { nama_field: "", label: "", tipe_data: "angka", wajib: true, tampil_grafik: true }],
                        }))}
                      >
                        Tambah Kolom
                      </Button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(form.fields_json || []).map((fld, idx) => (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 130px 32px", gap: 6, alignItems: "center" }}>
                          <input
                            value={fld.nama_field || ""}
                            onChange={e => {
                              const next = [...form.fields_json];
                              next[idx] = { ...next[idx], nama_field: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") };
                              setForm(f => ({ ...f, fields_json: next }));
                            }}
                            placeholder="nama_field"
                            style={inpStyle}
                          />
                          <input
                            value={fld.label || ""}
                            onChange={e => {
                              const next = [...form.fields_json];
                              next[idx] = { ...next[idx], label: e.target.value };
                              setForm(f => ({ ...f, fields_json: next }));
                            }}
                            placeholder="Label Kolom"
                            style={inpStyle}
                          />
                          <Select
                            fullWidth
                            value={fld.tipe_data || "angka"}
                            onChange={v => {
                              const next = [...form.fields_json];
                              next[idx] = { ...next[idx], tipe_data: v };
                              setForm(f => ({ ...f, fields_json: next }));
                            }}
                            options={TIPE_FIELD_OPTS}
                          />
                          <Button
                            size="xs"
                            variant="ghost"
                            icon="trash"
                            onClick={() => setForm(f => ({ ...f, fields_json: f.fields_json.filter((_, i) => i !== idx) }))}
                            style={{ color: T.danger }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {modal.type === "wilayah" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Kode Wilayah Kemendagri *</label>
                      <input value={form.kode_wilayah || ""} onChange={e => setForm(f => ({ ...f, kode_wilayah: e.target.value }))} placeholder="Mis: 53.12.01" style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Tingkat Wilayah *</label>
                      <Select
                        fullWidth
                        value={form.tingkat || "Kecamatan"}
                        onChange={v => setForm(f => ({ ...f, tingkat: v }))}
                        options={[
                          { value: "Provinsi", label: "Provinsi" },
                          { value: "Kabupaten/Kota", label: "Kabupaten/Kota" },
                          { value: "Kecamatan", label: "Kecamatan" },
                          { value: "Desa/Kelurahan", label: "Desa/Kelurahan" },
                        ]}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Nama Wilayah *</label>
                    <input value={form.nama_wilayah || ""} onChange={e => setForm(f => ({ ...f, nama_wilayah: e.target.value }))} placeholder="Mis: Kecamatan Loli" style={inpStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={lblStyle}>Kode Induk</label>
                      <input value={form.induk_kode || ""} onChange={e => setForm(f => ({ ...f, induk_kode: e.target.value }))} placeholder="53.12" style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Luas (km²)</label>
                      <input type="number" step="0.01" value={form.luas_km2 ?? ""} onChange={e => setForm(f => ({ ...f, luas_km2: e.target.value }))} style={inpStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Penduduk (Jiwa)</label>
                      <input type="number" value={form.jumlah_penduduk ?? ""} onChange={e => setForm(f => ({ ...f, jumlah_penduduk: e.target.value }))} style={inpStyle} />
                    </div>
                  </div>
                </>
              )}

              {modal.type === "reopen" && modal.mode === "add" && (
                <>
                  <div>
                    <label style={lblStyle}>Pilih Dataset Sektoral *</label>
                    <Select
                      fullWidth
                      value={String(form.dataset_id || "")}
                      onChange={v => setForm(f => ({ ...f, dataset_id: Number(v) }))}
                      options={datasets.map(d => ({ value: String(d.id), label: d.nama }))}
                    />
                  </div>
                  <div>
                    <label style={lblStyle}>Periode Tahun *</label>
                    <input type="number" value={form.periode_tahun || 2025} onChange={e => setForm(f => ({ ...f, periode_tahun: Number(e.target.value) }))} style={inpStyle} />
                  </div>
                  <div>
                    <label style={lblStyle}>Alasan Pengajuan Pembukaan Gerbang *</label>
                    <textarea rows={3} value={form.alasan || ""} onChange={e => setForm(f => ({ ...f, alasan: e.target.value }))} placeholder="Jelaskan alasan keterlambatan atau perlunya revisi data periode ini..." style={inpStyle} />
                  </div>
                </>
              )}

              {modal.type === "reopen" && modal.mode === "decide" && (
                <>
                  <div style={{ padding: 12, borderRadius: 10, background: T.bgAlt, fontSize: 12.5 }}>
                    <div><b>Dataset:</b> {modal.item?.dataset_nama}</div>
                    <div><b>OPD:</b> {modal.item?.opd_nama} (Periode {modal.item?.periode_tahun})</div>
                    <div><b>Alasan OPD:</b> {modal.item?.alasan}</div>
                  </div>
                  <div>
                    <label style={lblStyle}>Keputusan *</label>
                    <Select
                      fullWidth
                      value={form.status || "disetujui"}
                      onChange={v => setForm(f => ({ ...f, status: v }))}
                      options={[
                        { value: "disetujui", label: "Setujui Pembukaan Kembali (Reopen)" },
                        { value: "ditolak", label: "Tolak Permintaan" },
                      ]}
                    />
                  </div>
                  {form.status === "disetujui" && (
                    <div>
                      <label style={lblStyle}>Batas Waktu Pemutakhiran *</label>
                      <DatePicker
                        fullWidth
                        value={form.batas_waktu || ""}
                        onChange={v => setForm(f => ({ ...f, batas_waktu: v }))}
                      />
                    </div>
                  )}
                  <div>
                    <label style={lblStyle}>Catatan Admin / Walidata</label>
                    <textarea rows={2} value={form.catatan_admin || ""} onChange={e => setForm(f => ({ ...f, catatan_admin: e.target.value }))} style={inpStyle} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <Button variant="ghost" onClick={() => setModal(null)}>Batal</Button>
              <Button variant="primary" loading={busy} onClick={simpanModal}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
