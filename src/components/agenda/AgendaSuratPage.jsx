import { useState, useEffect, useContext, useMemo, useRef } from "react";
import { ThemeContext } from "../../App.jsx";
import { useIsDark, Icon, Modal, Select, Button, DatePicker } from "../ui.jsx";
import useResponsive from "../../useResponsive.js";
import ModalPengaturanWewenang from "./ModalPengaturanWewenang.jsx";
import DocumentScanner from "./DocumentScanner.jsx";

// Chrome memblokir navigasi ke data URL di tab baru, jadi diubah ke Blob URL dulu.
async function bukaBerkas(url) {
  try {
    const blob = await (await fetch(url)).blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch {
    window.open(url, "_blank");
  }
}

// Web app Apps Script yang sama dengan modul Dokumen: mengunggah berkas ke
// Google Drive. XHR dipakai alih-alih fetch karena GAS menjawab dengan
// redirect 302 yang bermasalah diikuti fetch. group:true supaya TIDAK ikut
// membuat record di buku dokumen — lampiran agenda cukup menautkan hasilnya.
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyjrDE_5NnsTsKSyRvEwLLMJH3lWeGsg7jpM44btardExAFX1Vxvp246pazjQdH4UL5/exec";

function gasUpload(payload) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", GAS_URL);
    xhr.timeout = 45000;
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (json && json.error) reject(new Error(json.error));
        else resolve(json);
      } catch {
        reject(new Error("Balasan GAS bukan JSON"));
      }
    };
    xhr.onerror = () => reject(new Error("Jaringan ke GAS gagal"));
    xhr.ontimeout = () => reject(new Error("Timeout mengunggah ke Google Drive"));
    xhr.send(JSON.stringify(payload));
  });
}

const KODE_KLASIFIKASI_LIST = [
  { kode: "050", label: "050 - Perencanaan Pembangunan Daerah" },
  { kode: "005", label: "005 - Undangan & Rapat Dinas" },
  { kode: "900", label: "900 - Pengelolaan Keuangan & Anggaran" },
  { kode: "800", label: "800 - Kepegawaian & SDM Aparatur" },
  { kode: "020", label: "020 - Peralatan & Perlengkapan Kantor" },
  { kode: "060", label: "060 - Organisasi & Tata Laksana" },
  { kode: "045", label: "045 - Hukum, Perjanjian & Regulasi" },
];

const DEFAULT_BIDANG_LIST = [
  "Sekretariat",
  "Bidang Perencanaan Pengendalian dan Evaluasi Pembangunan Daerah",
  "Bidang Perekonomian dan Sumber Daya Alam",
  "Bidang Pemerintahan dan Pembangunan Manusia",
  "Bidang Infrastruktur dan Kewilayahan",
  "Bidang Riset dan Inovasi Daerah"
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

const DITERUSKAN_GRUP = [
  {
    kategori: "Pimpinan & Sekretariat",
    items: [
      "Sekretaris BAPPERIDA",
      "Subbagian Umum & Kepegawaian",
      "Subbagian Perencanaan & Keuangan"
    ]
  },
  {
    kategori: "Kepala Bidang Teknis",
    items: [
      "Bidang Perencanaan Pengendalian dan Evaluasi Pembangunan Daerah",
      "Bidang Perekonomian dan Sumber Daya Alam",
      "Bidang Pemerintahan dan Pembangunan Manusia",
      "Bidang Infrastruktur dan Kewilayahan",
      "Bidang Riset dan Inovasi Daerah"
    ]
  },
  {
    kategori: "Pelaksana & Jabatan Fungsional",
    items: [
      "Pejabat Fungsional Perencana",
      "Peneliti / Analis Kebijakan",
      "Staf Teknis Pelaksana"
    ]
  }
];

const DITERUSKAN_OPTIONS = DITERUSKAN_GRUP.flatMap((g) => g.items);

// ── Komponen Tangkapan Kamera Langsung Dokumen Surat ─────────────────────────
function CameraCaptureModal({ isOpen, onClose, onCapture }) {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [capturedImg, setCapturedImg] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImg(null);
      setCameraError(null);
      return;
    }
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (mode) => {
    stopCamera();
    setLoadingCamera(true);
    setCameraError(null);
    try {
      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.warn("Gagal mengakses kamera:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (errFallback) {
        setCameraError(errFallback.message || "Kamera tidak dapat diakses atau izin ditolak oleh browser.");
      }
    } finally {
      setLoadingCamera(false);
    }
  };

  const toggleFacing = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    const maxDim = 1600;
    let targetW = vw;
    let targetH = vh;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (facingMode === "user") {
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, targetW, targetH);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImg(dataUrl);
  };

  const handleUsePhoto = () => {
    if (capturedImg) {
      onCapture(capturedImg, `Foto_Fisik_Surat_${Date.now()}.jpg`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(4px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 620,
          background: "#0F172A",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            background: "#1E293B",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            color: "#fff"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="camera" size={16} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Foto Dokumen Surat Masuk</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: 4,
              display: "flex"
            }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            height: 380,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}
        >
          {cameraError ? (
            <div style={{ padding: 24, textAlign: "center", color: "#F87171" }}>
              <Icon name="alert" size={32} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>{cameraError}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>
                Pastikan izin kamera telah diberikan di browser atau gunakan tombol unggah berkas dari galeri.
              </div>
            </div>
          ) : capturedImg ? (
            <img
              src={capturedImg}
              alt="Hasil Tangkapan"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: facingMode === "user" ? "scaleX(-1)" : "none"
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 24,
                  border: "2px dashed rgba(255, 255, 255, 0.6)",
                  borderRadius: 8,
                  pointerEvents: "none",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.25)"
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 99,
                    whiteSpace: "nowrap"
                  }}
                >
                  Posisikan dokumen surat di dalam bingkai
                </div>
              </div>
            </>
          )}

          {loadingCamera && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.7)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                gap: 8
              }}
            >
              <Icon name="loader" size={24} />
              <span style={{ fontSize: 12 }}>Menghubungkan ke kamera...</span>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "14px 20px",
            background: "#1E293B",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          {capturedImg ? (
            <>
              <button
                type="button"
                onClick={() => setCapturedImg(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Icon name="refresh" size={13} /> Foto Ulang
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  background: "#2563EB",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Icon name="check" size={14} /> Gunakan Foto Ini
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleFacing}
                title="Ganti Kamera (Depan / Belakang)"
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Icon name="refresh" size={13} />
                <span>{facingMode === "environment" ? "Kamera Belakang" : "Kamera Depan"}</span>
              </button>

              <button
                type="button"
                onClick={snapPhoto}
                disabled={!!cameraError || loadingCamera}
                title="Ambil Foto"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  border: "4px solid #fff",
                  background: "#EF4444",
                  cursor: cameraError || loadingCamera ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 12px rgba(239, 68, 68, 0.5)",
                  transition: "transform 0.1s ease",
                  opacity: cameraError || loadingCamera ? 0.5 : 1
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff" }} />
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "transparent",
                  color: "#94A3B8",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12.5
                }}
              >
                Batal
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgendaSuratPage({ user, showToast }) {
  const { T } = useContext(ThemeContext);
  const isDark = useIsDark();
  const { isMobile } = useResponsive();

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
  const [nomorKeluarCheck, setNomorKeluarCheck] = useState({ status: "idle", message: "", conflict: null });
  const [uploadingDraft, setUploadingDraft] = useState(false);
  const [uploadingFinal, setUploadingFinal] = useState(false);
  const draftFileInputRef = useRef(null);
  const finalFileInputRef = useRef(null);
  const [modalDisposisi, setModalDisposisi] = useState(null); // { surat, form, riwayat, mode, loading }
  const [modalDetail, setModalDetail] = useState(null); // { jenis: 'masuk'|'keluar', data }
  const [modalHapus, setModalHapus] = useState(null); // { jenis: 'masuk'|'keluar', data }
  const [modalKamera, setModalKamera] = useState(false);
  const [modalScan, setModalScan] = useState(false);
  const [modalLightboxFoto, setModalLightboxFoto] = useState(null); // { url, title }
  const [modalWewenang, setModalWewenang] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pegawaiList, setPegawaiList] = useState([]);
  const [bidangList, setBidangList] = useState([]);

  // Foto dibuka di lightbox, PDF/tautan dibuka di tab baru
  const lihatBerkas = (url, title) => {
    if (!url) return;
    if (url.startsWith("data:image")) setModalLightboxFoto({ url, title });
    else if (url.startsWith("data:")) bukaBerkas(url);
    else window.open(url, "_blank", "noopener");
  };

  useEffect(() => {
    fetch("/api/agenda/pegawai-list")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setPegawaiList(j.items || []); })
      .catch(() => {});

    fetch("/api/agenda/bidang-list")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && Array.isArray(j.items) && j.items.length > 0) {
          setBidangList(j.items.map((b) => b.nama || b.nama_bidang || b).filter(Boolean));
        } else {
          return fetch("/api/bidang")
            .then((r) => r.json())
            .then((data) => {
              if (Array.isArray(data) && data.length > 0) {
                setBidangList(data.map((b) => b.nama || b.nama_bidang || b).filter(Boolean));
              }
            });
        }
      })
      .catch(() => {});
  }, []);

  // Opsi Bidang Pengonsep Dinamis (dari Master Data Bidang BAPPERIDA)
  const opsiBidangPengonsep = useMemo(() => {
    const list = bidangList.length > 0 ? bidangList : DEFAULT_BIDANG_LIST;
    const items = [];
    const seen = new Set();
    list.forEach((b) => {
      const val = String(b || "").trim();
      if (val && !seen.has(val)) {
        seen.add(val);
        items.push({ value: val, label: val });
      }
    });
    if (modalKeluar?.data?.bidang_pengonsep && !seen.has(modalKeluar.data.bidang_pengonsep)) {
      items.push({
        value: modalKeluar.data.bidang_pengonsep,
        label: modalKeluar.data.bidang_pengonsep
      });
    }
    return items;
  }, [bidangList, modalKeluar?.data?.bidang_pengonsep]);

  // Opsi Pejabat Penandatangan Dinamis (dari Jabatan Struktural Pegawai)
  const opsiPejabatPenandatangan = useMemo(() => {
    const listPegawai = pegawaiList || [];
    const items = [];
    const seen = new Set();

    // Saring pegawai dengan jabatan pimpinan/struktural
    const pejabatStruktural = listPegawai.filter((p) => {
      const j = (p.jabatan || "").toLowerCase().trim();
      return (
        j.includes("kepala") ||
        j.includes("sekretaris") ||
        j.includes("kasubag") ||
        j.includes("kabid") ||
        j.includes("plt") ||
        j.includes("plh")
      );
    });

    const urutanPrioritas = [
      "kepala badan",
      "kepala bapperida",
      "plt. kepala",
      "sekretaris",
      "perencanaan, pengendalian",
      "perekonomian",
      "pemerintahan",
      "infrastruktur",
      "riset",
      "kasubag"
    ];

    pejabatStruktural.sort((a, b) => {
      const ja = (a.jabatan || "").toLowerCase();
      const jb = (b.jabatan || "").toLowerCase();
      const idxA = urutanPrioritas.findIndex((u) => ja.includes(u));
      const idxB = urutanPrioritas.findIndex((u) => jb.includes(u));
      return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
    });

    pejabatStruktural.forEach((p) => {
      const val = (p.jabatan || "").trim();
      if (val && !seen.has(val)) {
        seen.add(val);
        items.push({
          value: val,
          label: val,
          sub: p.nama ? `${p.nama}${p.nip ? ` • NIP. ${p.nip}` : ""}` : "",
          nama: p.nama
        });
      }
    });

    if (!seen.has("Kepala Badan") && !seen.has("Kepala BAPPERIDA")) {
      items.unshift({ value: "Kepala Badan", label: "Kepala Badan", sub: "Kepala BAPPERIDA" });
      seen.add("Kepala Badan");
    }
    if (!seen.has("Plt. Kepala BAPPERIDA")) {
      items.splice(1, 0, { value: "Plt. Kepala BAPPERIDA", label: "Plt. Kepala BAPPERIDA" });
      seen.add("Plt. Kepala BAPPERIDA");
    }
    if (!seen.has("Sekretaris") && !seen.has("Sekretaris BAPPERIDA")) {
      items.push({ value: "Sekretaris", label: "Sekretaris", sub: "Sekretariat BAPPERIDA" });
      seen.add("Sekretaris");
    }

    if (modalKeluar?.data?.penandatangan && !seen.has(modalKeluar.data.penandatangan)) {
      items.push({
        value: modalKeluar.data.penandatangan,
        label: modalKeluar.data.penandatangan
      });
    }

    return items;
  }, [pegawaiList, modalKeluar?.data?.penandatangan]);

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
        file_name: "",
        drive_url: ""
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
        drive_url: it.drive_url || "",
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

  // Upload file dari galeri / disk dengan kompresi otomatis jika gambar
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          setModalMasuk((prev) =>
            prev
              ? {
                  ...prev,
                  data: {
                    ...prev.data,
                    file_url: compressed,
                    file_name: file.name,
                    drive_url: ""
                  }
                }
              : prev
          );
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setModalMasuk((prev) =>
          prev
            ? {
                ...prev,
                data: {
                  ...prev.data,
                  file_url: ev.target.result,
                  file_name: file.name,
                  drive_url: ""
                }
              }
            : prev
        );
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Handlers Disposisi Berjenjang ─────────────────────────────────────────
  const bukaModalDisposisi = async (surat) => {
    setModalDisposisi({
      surat,
      loading: true,
      riwayat: [],
      mode: "tambah",
      form: {
        id: null,
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
      if (data.ok) {
        const d = data.disposisi;
        const riwayat = data.riwayat || (d ? [d] : []);
        setModalDisposisi((prev) => ({
          ...prev,
          loading: false,
          riwayat,
          mode: riwayat.length > 0 ? "tambah_lanjutan" : "tambah",
          form: {
            id: null,
            tanggal_disposisi: new Date().toISOString().split("T")[0],
            pemberi_disposisi:
              riwayat.length > 0 && riwayat[riwayat.length - 1].pemberi_disposisi.startsWith("Kepala BAPPERIDA")
                ? "Sekretaris BAPPERIDA"
                : "Kepala BAPPERIDA",
            arahan: [],
            catatan_instruksi: "",
            diteruskan_kepada: [],
            batas_waktu: "",
            status_tindaklanjut: "Didisposisikan"
          }
        }));
      } else {
        setModalDisposisi((prev) => ({ ...prev, loading: false }));
      }
    } catch (_) {
      setModalDisposisi((prev) => ({ ...prev, loading: false }));
    }
  };

  const editEntriDisposisi = (entry) => {
    setModalDisposisi((prev) => ({
      ...prev,
      mode: "edit",
      form: {
        id: entry.id,
        tanggal_disposisi: entry.tanggal_disposisi ? entry.tanggal_disposisi.split("T")[0] : new Date().toISOString().split("T")[0],
        pemberi_disposisi: entry.pemberi_disposisi || "Kepala BAPPERIDA",
        arahan: Array.isArray(entry.arahan) ? entry.arahan : (typeof entry.arahan === "string" ? JSON.parse(entry.arahan || "[]") : []),
        catatan_instruksi: entry.catatan_instruksi || "",
        diteruskan_kepada: Array.isArray(entry.diteruskan_kepada) ? entry.diteruskan_kepada : (typeof entry.diteruskan_kepada === "string" ? JSON.parse(entry.diteruskan_kepada || "[]") : []),
        batas_waktu: entry.batas_waktu ? entry.batas_waktu.split("T")[0] : "",
        status_tindaklanjut: entry.status_tindaklanjut || "Didisposisikan"
      }
    }));
  };

  const hapusEntriDisposisi = async (id) => {
    if (!window.confirm("Hapus entri riwayat disposisi ini?")) return;
    try {
      const res = await fetch(`/api/agenda/disposisi/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Gagal menghapus");
      notif("Entri disposisi berhasil dihapus");
      if (modalDisposisi?.surat) {
        bukaModalDisposisi(modalDisposisi.surat);
      }
      fetchData();
    } catch (e) {
      notif("Error: " + e.message);
    }
  };

  const simpanDisposisi = async (e) => {
    e.preventDefault();
    const { surat, form, mode } = modalDisposisi;
    if (!form.diteruskan_kepada.length && !form.catatan_instruksi) {
      notif("Pilih minimal satu penerima disposisi atau isi catatan instruksi!");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agenda/surat-masuk/${surat.id}/disposisi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          mode: mode === "edit" ? "edit" : "tambah"
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "Gagal menyimpan lembar disposisi");

      notif(mode === "edit" ? "Entri disposisi berhasil diperbarui!" : "Lembar disposisi surat berhasil disimpan & diteruskan!");

      const riwayat = data.riwayat || (data.disposisi ? [data.disposisi] : []);
      setModalDisposisi((prev) => ({
        ...prev,
        riwayat,
        mode: "tambah_lanjutan",
        form: {
          id: null,
          tanggal_disposisi: new Date().toISOString().split("T")[0],
          pemberi_disposisi: form.pemberi_disposisi.startsWith("Kepala BAPPERIDA") ? "Sekretaris BAPPERIDA" : form.pemberi_disposisi,
          arahan: [],
          catatan_instruksi: "",
          diteruskan_kepada: [],
          batas_waktu: "",
          status_tindaklanjut: "Didisposisikan"
        }
      }));
      fetchData();
    } catch (err) {
      notif("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cetakLembarDisposisi = (surat, riwayat = []) => {
    const w = window.open("", "_blank");
    if (!w) {
      notif("Izinkan jendela pop-up di browser untuk mencetak lembar disposisi.");
      return;
    }

    const tglTerima = surat.tanggal_terima ? new Date(surat.tanggal_terima).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";
    const tglSurat = surat.tanggal_surat ? new Date(surat.tanggal_surat).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";

    const allDiteruskan = new Set();
    const allArahan = new Set();
    const catatanList = [];

    (riwayat || []).forEach((r) => {
      const dit = Array.isArray(r.diteruskan_kepada) ? r.diteruskan_kepada : (typeof r.diteruskan_kepada === "string" ? JSON.parse(r.diteruskan_kepada || "[]") : []);
      const arh = Array.isArray(r.arahan) ? r.arahan : (typeof r.arahan === "string" ? JSON.parse(r.arahan || "[]") : []);
      dit.forEach((x) => allDiteruskan.add(x));
      arh.forEach((x) => allArahan.add(x));
      if (r.catatan_instruksi) {
        catatanList.push(`<strong>${r.pemberi_disposisi || "Pimpinan"}:</strong> ${r.catatan_instruksi}`);
      }
    });

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Lembar Disposisi - ${surat.nomor_agenda || "Surat"}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.35; color: #000; margin: 0; padding: 20px; }
    .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
    .kop h3 { margin: 0; font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .kop h2 { margin: 2px 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; }
    .kop p { margin: 2px 0 0; font-size: 9.5pt; font-style: italic; }
    .title { text-align: center; font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 14px 0 10px; text-transform: uppercase; }
    table.info { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    table.info td { padding: 4px 6px; font-size: 10.5pt; vertical-align: top; }
    table.info td.label { width: 130px; font-weight: bold; }
    table.box { width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 10px; }
    table.box th { border: 1px solid #000; background: #f2f2f2; font-weight: bold; font-size: 10.5pt; padding: 6px; text-align: left; }
    table.box td { border: 1px solid #000; padding: 6px; font-size: 10pt; vertical-align: top; }
    .check-item { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px; }
    .checkbox { width: 12px; height: 12px; border: 1.5px solid #000; display: inline-block; margin-right: 6px; text-align: center; line-height: 10px; font-size: 10px; font-weight: bold; }
    .catatan-box { border: 1.5px solid #000; min-height: 85px; padding: 8px; font-size: 10.5pt; margin-bottom: 14px; }
    .signature-grid { display: flex; justify-content: space-between; margin-top: 15px; }
    .sig-col { width: 45%; text-align: center; font-size: 10.5pt; }
    .sig-space { height: 65px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; padding: 10px 14px; background: #e0f2fe; border: 1px solid #0284c7; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
    <div><strong>Pratinjau Lembar Disposisi Resmi</strong> - Siap dicetak (Ukuran A4)</div>
    <button onclick="window.print()" style="padding: 6px 16px; background: #0284c7; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">Cetak Sekarang</button>
  </div>

  <div class="kop">
    <h3>PEMERINTAH KABUPATEN SUMBA BARAT</h3>
    <h2>BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH</h2>
    <p>Jalan Weekarou No. 01, Telp/Fax. (0387) 21012, Waikabubak - Nusa Tenggara Timur</p>
  </div>

  <div class="title">LEMBAR DISPOSISI</div>

  <table class="info" border="0">
    <tr>
      <td class="label">Surat Dari</td>
      <td style="width: 10px;">:</td>
      <td><strong>${surat.asal_surat || "—"}</strong></td>
      <td class="label" style="width: 120px;">Diterima Tanggal</td>
      <td style="width: 10px;">:</td>
      <td>${tglTerima}</td>
    </tr>
    <tr>
      <td class="label">Nomor Surat</td>
      <td>:</td>
      <td>${surat.nomor_surat_asli || "—"}</td>
      <td class="label">Nomor Agenda</td>
      <td>:</td>
      <td><strong>${surat.nomor_agenda || "—"}</strong></td>
    </tr>
    <tr>
      <td class="label">Tanggal Surat</td>
      <td>:</td>
      <td>${tglSurat}</td>
      <td class="label">Sifat</td>
      <td>:</td>
      <td><strong>${surat.sifat || "Biasa"}</strong></td>
    </tr>
    <tr>
      <td class="label">Perihal</td>
      <td>:</td>
      <td colspan="4" style="line-height: 1.4;">${surat.perihal || "—"}</td>
    </tr>
  </table>

  <table class="box">
    <thead>
      <tr>
        <th style="width: 50%;">DITERUSKAN KEPADA SDR:</th>
        <th style="width: 50%;">DISPOSISI / PETUNJUK:</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          ${[
            "Sekretaris BAPPERIDA",
            "Kepala Bidang Perekonomian & SDA",
            "Kepala Bidang Pembangunan Manusia & Masyarakat (PMM)",
            "Kepala Bidang Infrastruktur & Kewilayahan (IPW)",
            "Kepala Bidang Perencanaan, Pengendalian & Evaluasi (P2E)",
            "Kasubbag Umum & Kepegawaian",
            "Kasubbag Perencanaan & Keuangan",
            "Pejabat Fungsional / Staf Teknis"
          ].map((jabatan) => `
            <div class="check-item">
              <span class="checkbox">${allDiteruskan.has(jabatan) ? "&#10003;" : "&nbsp;"}</span>
              <span>${jabatan}</span>
            </div>
          `).join("")}
        </td>
        <td>
          ${[
            "Tindak lanjuti sesuai ketentuan",
            "Hadiri / Wakili rapat dinas",
            "Pelajari & berikan telaahan / saran",
            "Siapkan bahan / draf surat balasan",
            "Koordinasikan dengan bidang terkait",
            "Untuk diketahui & dipedomani",
            "Arsipkan & catat dalam agenda"
          ].map((arahan) => `
            <div class="check-item">
              <span class="checkbox">${allArahan.has(arahan) ? "&#10003;" : "&nbsp;"}</span>
              <span>${arahan}</span>
            </div>
          `).join("")}
        </td>
      </tr>
    </tbody>
  </table>

  <div style="font-weight: bold; margin-bottom: 4px; font-size: 10.5pt;">CATATAN / INSTRUKSI PIMPINAN:</div>
  <div class="catatan-box">
    ${catatanList.length > 0 ? catatanList.join("<br/><br/>") : "<em>(Tidak ada catatan tambahan)</em>"}
  </div>

  <div class="signature-grid">
    <div class="sig-col">
      <div>Mengetahui,</div>
      <div><strong>Sekretaris BAPPERIDA</strong></div>
      <div class="sig-space"></div>
      <div style="border-bottom: 1px solid #000; display: inline-block; min-width: 180px;">&nbsp;</div>
      <div>NIP. ....................................................</div>
    </div>
    <div class="sig-col">
      <div>Waikabubak, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
      <div><strong>Kepala BAPPERIDA</strong></div>
      <div class="sig-space"></div>
      <div style="border-bottom: 1px solid #000; display: inline-block; min-width: 180px;">&nbsp;</div>
      <div>NIP. ....................................................</div>
    </div>
  </div>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  // ── Handlers Surat Keluar ─────────────────────────────────────────────────
  const fetchPreviewNomorKeluar = async (kode, customBulan = null) => {
    try {
      const b = customBulan || (new Date().getMonth() + 1);
      const res = await fetch(`/api/agenda/surat-keluar/preview-nomor?tahun=${tahun}&kode=${encodeURIComponent(kode || "050")}&bulan=${b}`);
      const data = await res.json();
      if (data.ok) return data.nomor_surat;
    } catch (_) {}
    const romawi = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][(customBulan ? customBulan - 1 : new Date().getMonth())] || "XI";
    return `BAPPERIDA.011.7/53.12/..../${romawi}/${tahun}`;
  };

  const cekKetersediaanNomorKeluar = async (nomorVal, excludeId = null) => {
    const trimmed = String(nomorVal || "").trim();
    if (!trimmed) {
      setNomorKeluarCheck({ status: "idle", message: "", conflict: null });
      return false;
    }
    setNomorKeluarCheck({ status: "checking", message: "Memeriksa ketersediaan nomor...", conflict: null });
    try {
      const exParam = excludeId ? `&exclude_id=${encodeURIComponent(excludeId)}` : "";
      const res = await fetch(`/api/agenda/surat-keluar/cek-nomor?nomor=${encodeURIComponent(trimmed)}${exParam}`);
      const data = await res.json();
      if (data.ok) {
        if (data.exists) {
          setNomorKeluarCheck({
            status: "taken",
            message: `Nomor "${trimmed}" sudah digunakan (${data.conflict?.bidang_pengonsep || "Bidang lain"}: ${data.conflict?.perihal || data.conflict?.nomor_agenda || ""}).`,
            conflict: data.conflict
          });
          return false;
        } else {
          setNomorKeluarCheck({
            status: "available",
            message: `Nomor "${trimmed}" tersedia dan belum pernah digunakan.`,
            conflict: null
          });
          return true;
        }
      }
    } catch (_) {}
    setNomorKeluarCheck({ status: "idle", message: "", conflict: null });
    return true;
  };

  useEffect(() => {
    const no = modalKeluar?.data?.nomor_surat ?? modalKeluar?.previewNomor;
    if (!no) {
      setNomorKeluarCheck({ status: "idle", message: "", conflict: null });
      return;
    }
    const timer = setTimeout(() => {
      cekKetersediaanNomorKeluar(no, modalKeluar.mode === "edit" ? modalKeluar.data.id : null);
    }, 320);
    return () => clearTimeout(timer);
  }, [modalKeluar?.data?.nomor_surat, modalKeluar?.previewNomor, modalKeluar?.mode, modalKeluar?.data?.id]);

  const handleUploadBerkasKeluar = async (e, jenis) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (jenis === "draft") setUploadingDraft(true);
    else setUploadingFinal(true);

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const res = await gasUpload({
        action: "direct",
        group: true,
        file: dataUrl.split(",")[1],
        filename: file.name,
        mimeType: file.type || "application/pdf",
        title: file.name.replace(/\.[^.]+$/i, "")
      });

      if (res && res.fileUrl) {
        setModalKeluar((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            [jenis === "draft" ? "file_draft_url" : "file_final_url"]: res.fileUrl
          }
        }));
        notif(`Berkas "${file.name}" berhasil diunggah ke Google Drive!`);
      } else {
        throw new Error("Respon Google Drive tidak memiliki URL berkas.");
      }
    } catch (err) {
      notif(`Gagal mengunggah berkas: ${err.message}`);
    } finally {
      if (jenis === "draft") setUploadingDraft(false);
      else setUploadingFinal(false);
      e.target.value = "";
    }
  };

  const bukaTambahSuratKeluar = async () => {
    const preview = await fetchPreviewNomorKeluar("050");
    setNomorKeluarCheck({ status: "idle", message: "", conflict: null });
    const bidangOpsiList = bidangList.length > 0 ? bidangList : DEFAULT_BIDANG_LIST;
    const defBidang = (user?.bidang && bidangOpsiList.includes(user.bidang))
      ? user.bidang
      : (bidangOpsiList[0] || "Sekretariat");
    const defTtd = opsiPejabatPenandatangan[0]?.value || "Kepala Badan";

    setModalKeluar({
      mode: "tambah",
      previewNomor: preview,
      data: {
        kode_klasifikasi: "050",
        tanggal_surat: new Date().toISOString().split("T")[0],
        nomor_surat: preview,
        tujuan_surat: "",
        perihal: "",
        sifat: "Biasa",
        bidang_pengonsep: defBidang,
        penandatangan: defTtd,
        file_draft_url: "",
        file_final_url: "",
        status: "Draf"
      }
    });
  };

  const bukaEditSuratKeluar = (it) => {
    setNomorKeluarCheck({ status: "idle", message: "", conflict: null });
    const bidangOpsiList = bidangList.length > 0 ? bidangList : DEFAULT_BIDANG_LIST;
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
        bidang_pengonsep: it.bidang_pengonsep || bidangOpsiList[0] || "Sekretariat",
        penandatangan: it.penandatangan || "Kepala Badan",
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
    if (nomorKeluarCheck.status === "taken") {
      notif(nomorKeluarCheck.message || "Nomor surat keluar sudah digunakan! Silakan ganti nomor terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    try {
      const url = mode === "tambah" ? "/api/agenda/surat-keluar" : `/api/agenda/surat-keluar/${data.id}`;
      const method = mode === "tambah" ? "POST" : "PUT";
      const payload = {
        ...data,
        nomor_surat: (data.nomor_surat || modalKeluar.previewNomor || "").trim(),
        tahun
      };
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

  // Badge Status Renderer (Anti-slop: crisp, accessible, semantic)
  const renderStatusBadge = (status) => {
    const s = status || "Diterima";
    let bg = isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.15)";
    let col = T.textSecondary;

    if (s === "Didisposisi" || s === "Ditandatangani") {
      bg = isDark ? "rgba(59,130,246,0.18)" : "rgba(37,99,235,0.1)";
      col = T.primary;
    } else if (s === "Selesai" || s === "Terkirim") {
      bg = isDark ? "rgba(16,185,129,0.18)" : "rgba(5,150,105,0.1)";
      col = T.success;
    } else if (s === "Draf" || s === "Menunggu TTD") {
      bg = isDark ? "rgba(245,158,11,0.18)" : "rgba(217,119,6,0.1)";
      col = T.warning;
    } else if (s === "Dibatalkan") {
      bg = isDark ? "rgba(239,68,68,0.18)" : "rgba(220,38,38,0.1)";
      col = T.danger;
    }

    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: col,
        whiteSpace: "nowrap"
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: col, flexShrink: 0 }} />
        {s}
      </span>
    );
  };

  const renderSifatBadge = (sifat) => {
    const s = sifat || "Biasa";
    let bg = isDark ? "rgba(148,163,184,0.1)" : "rgba(100,116,139,0.08)";
    let col = T.textSecondary;
    if (s === "Penting") { bg = isDark ? "rgba(245,158,11,0.16)" : "rgba(245,158,11,0.1)"; col = isDark ? "#FBBF24" : "#B45309"; }
    else if (s === "Rahasia") { bg = isDark ? "rgba(239,68,68,0.16)" : "rgba(220,38,38,0.1)"; col = isDark ? "#F87171" : "#B91C1C"; }
    else if (s === "Segera") { bg = isDark ? "rgba(168,85,247,0.16)" : "rgba(147,51,234,0.1)"; col = isDark ? "#C084FC" : "#7E22CE"; }

    return (
      <span style={{
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10.5,
        fontWeight: 600,
        background: bg,
        color: col,
        whiteSpace: "nowrap"
      }}>
        {s}
      </span>
    );
  };

  // Skeleton Loader for tables (Rule 19: Add loading states)
  const renderTableSkeleton = (cols = 7, rows = 5) => {
    const bgBar = isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0";
    return (
      <div style={{ padding: "8px 0" }}>
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={rIdx}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 16,
              padding: "14px 16px",
              borderBottom: `1px solid ${isDark ? "#334155" : "#F1F5F9"}`,
              alignItems: "center",
              animation: "agendaPulse 1.4s ease-in-out infinite",
              animationDelay: `${rIdx * 0.12}s`,
            }}
          >
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                style={{
                  height: cIdx === 0 ? 15 : 13,
                  width: cIdx === 0 ? "70%" : cIdx === 4 ? "90%" : "60%",
                  borderRadius: 4,
                  background: bgBar,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: T.font }}>
      <style>{`
        @keyframes agendaPulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.9; }
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 19 : 22, fontWeight: 700, color: T.text, letterSpacing: "-0.015em" }}>
            Buku Agenda Surat
          </h2>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 3 }}>
            Registrasi surat masuk & keluar dinas · {itemsMasuk.length} surat masuk ({statMasukDisposisi} didisposisi, {statMasukMenunggu} menunggu arahan), {itemsKeluar.length} surat keluar aktif
          </div>
        </div>

        {/* Year Selector & Primary Action */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Select
            value={tahun}
            onChange={(v) => setTahun(parseInt(v, 10))}
            options={[
              { value: 2026, label: "Tahun 2026" },
              { value: 2025, label: "Tahun 2025" },
              { value: 2024, label: "Tahun 2024" },
            ]}
            icon="calendar"
            size="sm"
            minWidth={130}
          />

          {tab === "masuk" ? (
            <Button
              variant="primary"
              icon="plus"
              onClick={bukaTambahSuratMasuk}
            >
              Catat Surat Masuk
            </Button>
          ) : (
            <Button
              variant="primary"
              icon="plus"
              onClick={bukaTambahSuratKeluar}
            >
              Booking Nomor Surat
            </Button>
          )}

          <Button
            variant="secondary"
            icon="settings"
            onClick={() => setModalWewenang(true)}
            title="Pengaturan pejabat penandatangan dan paraf hierarki"
          >
            Wewenang
          </Button>
        </div>
      </div>

      {/* ── Sub-Nav Tabs (Matching BankData & DocPages) ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => { setTab("masuk"); setStatusFilter(""); setSifatFilter(""); }}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: tab === "masuk" ? T.primary : T.card,
            color: tab === "masuk" ? "#fff" : T.textSecondary,
            border: `1px solid ${tab === "masuk" ? T.primary : T.border}`,
            boxShadow: tab === "masuk" ? T.shadowSm : "none",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="archive" size={14} />
          <span>Buku Surat Masuk & Disposisi</span>
          <span
            style={{
              padding: "1px 7px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: tab === "masuk" ? "rgba(255,255,255,0.22)" : isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              color: tab === "masuk" ? "#fff" : T.textMuted,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {itemsMasuk.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setTab("keluar"); setStatusFilter(""); setSifatFilter(""); }}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: tab === "keluar" ? T.primary : T.card,
            color: tab === "keluar" ? "#fff" : T.textSecondary,
            border: `1px solid ${tab === "keluar" ? T.primary : T.border}`,
            boxShadow: tab === "keluar" ? T.shadowSm : "none",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="externalLink" size={14} />
          <span>Buku Surat Keluar & Booking Nomor</span>
          <span
            style={{
              padding: "1px 7px",
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: tab === "keluar" ? "rgba(255,255,255,0.22)" : isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
              color: tab === "keluar" ? "#fff" : T.textMuted,
              fontVariantNumeric: "tabular-nums"
            }}
          >
            {itemsKeluar.length}
          </span>
        </button>
      </div>

      {/* ── Toolbar Search & Filter (Matching DocPages / BankData) ── */}
      <div
        style={{
          background: T.card,
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          padding: isMobile ? 12 : 14,
          marginBottom: 16,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted, display: "flex", pointerEvents: "none" }}>
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
              padding: "9px 12px 9px 34px",
              borderRadius: 8,
              border: `1.5px solid ${T.border}`,
              background: T.inputBg,
              color: T.text,
              fontSize: 13,
              fontFamily: T.font,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filter Sifat */}
        <div style={{ width: isMobile ? "100%" : 150 }}>
          <Select
            value={sifatFilter}
            onChange={setSifatFilter}
            placeholder="Semua Sifat"
            options={[
              { value: "", label: "Semua Sifat" },
              { value: "Biasa", label: "Biasa" },
              { value: "Penting", label: "Penting" },
              { value: "Rahasia", label: "Rahasia" },
              { value: "Segera", label: "Segera" },
            ]}
            fullWidth
            size="sm"
          />
        </div>

        {/* Filter Status */}
        <div style={{ width: isMobile ? "100%" : 160 }}>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Semua Status"
            options={tab === "masuk" ? [
              { value: "", label: "Semua Status" },
              { value: "Diterima", label: "Diterima" },
              { value: "Didisposisi", label: "Didisposisi" },
              { value: "Selesai", label: "Selesai" },
            ] : [
              { value: "", label: "Semua Status" },
              { value: "Draf", label: "Draf" },
              { value: "Ditandatangani", label: "Ditandatangani" },
              { value: "Terkirim", label: "Terkirim" },
              { value: "Dibatalkan", label: "Dibatalkan" },
            ]}
            fullWidth
            size="sm"
          />
        </div>

        <Button
          variant="secondary"
          icon="refresh"
          size="sm"
          onClick={fetchData}
        >
          Segarkan
        </Button>

        <div style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
          {tab === "masuk" ? `${filteredMasuk.length} surat masuk` : `${filteredKeluar.length} surat keluar`}
        </div>
      </div>

      {/* ── Table Container ── */}
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: T.shadowSm,
        overflow: "hidden"
      }}>
        {loading ? (
          renderTableSkeleton(7, 5)
        ) : error ? (
          <div style={{ padding: 48, textAlign: "center", color: T.danger }}>
            <Icon name="alert" size={24} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600 }}>{error}</div>
            <button
              type="button"
              onClick={fetchData}
              style={{ marginTop: 12, padding: "6px 14px", borderRadius: 6, background: T.bg, border: `1px solid ${T.border}`, color: T.text, cursor: "pointer", fontSize: 12 }}
            >
              Coba Lagi
            </button>
          </div>
        ) : tab === "masuk" ? (
          /* ═════════ TABEL SURAT MASUK ═════════ */
          filteredMasuk.length === 0 ? (
            <div style={{
              padding: "56px 20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: isDark ? "rgba(37,99,235,0.15)" : "#EFF6FF",
                color: T.primary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Icon name="mail" size={22} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Belum ada catatan surat masuk untuk tahun {tahun}</div>
                <div style={{ fontSize: 12.5, color: T.textSecondary, maxWidth: 440, margin: "4px auto 0", lineHeight: 1.5 }}>
                  Mulai mencatat surat dinas masuk untuk pengelolaan agenda disposisi pimpinan dan arsip digital.
                </div>
              </div>
              <Button
                variant="primary"
                icon="plus"
                onClick={bukaTambahSuratMasuk}
              >
                Catat Surat Masuk Pertama
              </Button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F8FAFC", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 140 }}>No. Agenda</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 110 }}>Tgl. Terima</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em" }}>Asal Instansi</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em" }}>Nomor & Tgl Asli</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 260 }}>Perihal & Sifat</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 130 }}>Status</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "right", minWidth: 150 }}>Aksi</th>
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
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "#1E293B" : "#F8FAFC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "11px 14px", fontFamily: "monospace", fontWeight: 600, color: T.primary, fontVariantNumeric: "tabular-nums" }}>
                        {it.nomor_agenda}
                      </td>
                      <td style={{ padding: "11px 14px", fontVariantNumeric: "tabular-nums", color: T.text }}>
                        {it.tanggal_terima ? it.tanggal_terima.split("T")[0] : "—"}
                      </td>
                      <td style={{ padding: "11px 14px", fontWeight: 600, color: T.text }}>
                        {it.asal_surat}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ fontWeight: 600, color: T.text }}>{it.nomor_surat_asli}</div>
                        <div style={{ fontSize: 11, color: T.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                          {it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "—"}
                        </div>
                        {it.file_url && (
                          <button
                            type="button"
                            onClick={() => lihatBerkas(it.file_url, `Foto Fisik: ${it.nomor_agenda} (${it.asal_surat})`)}
                            style={{
                              marginTop: 4,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: isDark ? "rgba(59,130,246,0.18)" : "#EFF6FF",
                              border: `1px solid ${isDark ? "#2563EB" : "#BFDBFE"}`,
                              color: T.primary,
                              fontSize: 10.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4
                            }}
                            title="Lihat Foto Fisik Surat"
                          >
                            <Icon name="camera" size={11} />
                            <span>Foto Fisik</span>
                          </button>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ color: T.text, lineHeight: 1.4, marginBottom: 4 }}>{it.perihal}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {renderSifatBadge(it.sifat)}
                          <span style={{ fontSize: 11, color: T.textMuted }}>Kode: {it.kode_klasifikasi || "050"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        {renderStatusBadge(it.status)}
                        {it.pemberi_disposisi && (
                          <div style={{ fontSize: 10.5, color: T.textSecondary, marginTop: 4, whiteSpace: "nowrap" }}>
                            Oleh: {it.pemberi_disposisi}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                          {/* Disposisi Button */}
                          <button
                            type="button"
                            title="Lembar Disposisi"
                            onClick={() => bukaModalDisposisi(it)}
                            style={{
                              height: 28,
                              padding: "0 9px",
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: it.status === "Didisposisi" ? (isDark ? "rgba(59,130,246,0.18)" : "rgba(37,99,235,0.08)") : T.bg,
                              color: it.status === "Didisposisi" ? T.primary : T.text,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              transition: "all 0.15s ease"
                            }}
                          >
                            <Icon name="fileText" size={12} />
                            <span>Disposisi</span>
                          </button>

                          {/* Detail Button */}
                          <button
                            type="button"
                            title="Lihat Detail"
                            onClick={() => setModalDetail({ jenis: "masuk", data: it })}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: T.bg,
                              color: T.textSecondary,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <Icon name="eye" size={13} />
                          </button>

                          {/* Edit Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              type="button"
                              title="Edit Surat Masuk"
                              onClick={() => bukaEditSuratMasuk(it)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: `1px solid ${T.border}`,
                                background: T.bg,
                                color: T.textSecondary,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s ease"
                              }}
                            >
                              <Icon name="edit" size={13} />
                            </button>
                          )}

                          {/* Hapus Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              type="button"
                              title="Hapus Surat Masuk"
                              onClick={() => setModalHapus({ jenis: "masuk", data: it })}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: `1px solid ${T.dangerBorder || "#FECACA"}`,
                                background: T.dangerBg || "#FEF2F2",
                                color: T.danger,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s ease"
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
            <div style={{
              padding: "56px 20px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF",
                color: "#8B5CF6",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Icon name="externalLink" size={22} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Belum ada register surat keluar untuk tahun {tahun}</div>
                <div style={{ fontSize: 12.5, color: T.textSecondary, maxWidth: 440, margin: "4px auto 0", lineHeight: 1.5 }}>
                  Pesan nomor urut surat keluar resmi untuk menjamin integritas tata naskah dinas.
                </div>
              </div>
              <Button
                variant="primary"
                icon="plus"
                onClick={bukaTambahSuratKeluar}
              >
                Booking Nomor Pertama
              </Button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#131D31" : "#F8FAFC", borderBottom: `1px solid ${T.border}`, color: T.textSecondary }}>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 80 }}>No. Urut</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 200 }}>Nomor Surat Dinas</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 110 }}>Tanggal</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em" }}>Tujuan Surat</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", minWidth: 240 }}>Perihal & Bidang</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", width: 120 }}>Status</th>
                    <th style={{ padding: "11px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "right", minWidth: 140 }}>Aksi</th>
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
                      onMouseEnter={(e) => e.currentTarget.style.background = isDark ? "#1E293B" : "#F8FAFC"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "11px 14px", fontFamily: "monospace", fontWeight: 600, color: T.primary, fontVariantNumeric: "tabular-nums" }}>
                        {String(it.nomor_urut || 1).padStart(4, "0")}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ fontFamily: "monospace", fontWeight: 600, color: T.text, fontSize: 13, textDecoration: it.status === "Dibatalkan" ? "line-through" : "none" }}>
                          {it.nomor_surat}
                        </div>
                        <div style={{ fontSize: 11, color: T.textSecondary }}>
                          Reg: {it.nomor_agenda || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px", fontVariantNumeric: "tabular-nums", color: T.text }}>
                        {it.tanggal_surat ? it.tanggal_surat.split("T")[0] : "—"}
                      </td>
                      <td style={{ padding: "11px 14px", fontWeight: 600, color: T.text }}>
                        {it.tujuan_surat}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ color: T.text, lineHeight: 1.4, marginBottom: 4 }}>{it.perihal}</div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: T.textSecondary, fontWeight: 600 }}>{it.bidang_pengonsep}</span>
                          <span style={{ fontSize: 11, color: T.textMuted }}>• TTD: {it.penandatangan || "Kepala Badan"}</span>
                          {it.file_final_url && (
                            <button
                              type="button"
                              onClick={() => lihatBerkas(it.file_final_url, `Surat Final: ${it.nomor_surat}`)}
                              style={{
                                padding: "2px 7px",
                                borderRadius: 4,
                                background: isDark ? "rgba(16,185,129,0.18)" : "#ECFDF5",
                                border: `1px solid ${isDark ? "#059669" : "#A7F3D0"}`,
                                color: T.success,
                                fontSize: 10.5,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                              }}
                              title="Buka Berkas Surat Final (Signed PDF)"
                            >
                              <Icon name="fileText" size={11} />
                              <span>Berkas Final</span>
                            </button>
                          )}
                          {it.file_draft_url && !it.file_final_url && (
                            <button
                              type="button"
                              onClick={() => lihatBerkas(it.file_draft_url, `Draf Surat: ${it.nomor_surat}`)}
                              style={{
                                padding: "2px 7px",
                                borderRadius: 4,
                                background: isDark ? "rgba(245,158,11,0.18)" : "#FFFBEB",
                                border: `1px solid ${isDark ? "#D97706" : "#FDE68A"}`,
                                color: T.warning,
                                fontSize: 10.5,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                              }}
                              title="Buka Berkas Draf Surat"
                            >
                              <Icon name="file" size={11} />
                              <span>Draf</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        {renderStatusBadge(it.status)}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center" }}>
                          {/* Detail Button */}
                          <button
                            type="button"
                            title="Lihat Detail"
                            onClick={() => setModalDetail({ jenis: "keluar", data: it })}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: `1px solid ${T.border}`,
                              background: T.bg,
                              color: T.textSecondary,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <Icon name="eye" size={13} />
                          </button>

                          {/* Edit Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              type="button"
                              title="Edit Surat Keluar"
                              onClick={() => bukaEditSuratKeluar(it)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: `1px solid ${T.border}`,
                                background: T.bg,
                                color: T.textSecondary,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s ease"
                              }}
                            >
                              <Icon name="edit" size={13} />
                            </button>
                          )}

                          {/* Batalkan / Hapus Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              type="button"
                              title="Batalkan / Hapus Nomor"
                              onClick={() => setModalHapus({ jenis: "keluar", data: it })}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: `1px solid ${T.dangerBorder || "#FECACA"}`,
                                background: T.dangerBg || "#FEF2F2",
                                color: T.danger,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s ease"
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Nomor Surat Asli <span style={{ color: T.danger }}>*</span>
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
                  Asal Instansi Pengirim <span style={{ color: T.danger }}>*</span>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tanggal Surat Asli
                </label>
                <DatePicker
                  value={modalMasuk.data.tanggal_surat}
                  onChange={(val) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, tanggal_surat: val } })}
                  placeholder="Pilih tanggal surat..."
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tanggal Diterima
                </label>
                <DatePicker
                  value={modalMasuk.data.tanggal_terima}
                  onChange={(val) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, tanggal_terima: val } })}
                  placeholder="Pilih tanggal terima..."
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                Perihal Surat <span style={{ color: T.danger }}>*</span>
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

            {/* Sifat & jumlah lampiran berdampingan; Kode Klasifikasi sendiri di
                baris penuh supaya label panjangnya tidak terpotong di layar sempit. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Sifat Surat
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalMasuk.data.sifat}
                  onChange={(v) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, sifat: v } })}
                  options={[
                    { value: "Biasa", label: "Biasa" },
                    { value: "Penting", label: "Penting" },
                    { value: "Rahasia", label: "Rahasia" },
                    { value: "Segera", label: "Segera" },
                  ]}
                />
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
                Kode Klasifikasi
              </label>
              <Select
                fullWidth
                size="md"
                searchable
                value={modalMasuk.data.kode_klasifikasi}
                onChange={(v) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, kode_klasifikasi: v } })}
                options={KODE_KLASIFIKASI_LIST.map((k) => ({
                  value: k.kode,
                  label: `${k.kode} - ${k.label.split("- ")[1] || k.label}`,
                }))}
              />
            </div>

            {/* Lampiran Media Foto Fisik / Unggah Berkas */}
            <div style={{
              background: isDark ? "#172337" : "#F8FAFC",
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="camera" size={14} />
                  <span>Foto Fisik / Dokumen Surat Masuk</span>
                </label>
                {modalMasuk.data.file_url && (
                  <span style={{ fontSize: 11, color: T.success, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="checkCircle" size={12} /> Berkas Terlampir
                  </span>
                )}
              </div>

              {/* 3 Opsi Input Media */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalScan(true)}
                  style={{
                    padding: "9px 8px",
                    borderRadius: 8,
                    border: `1.5px solid ${modalMasuk.data.file_url?.startsWith("data:") ? T.primary : T.border}`,
                    background: isDark ? "#1E293B" : "#fff",
                    color: T.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Icon name="camera" size={14} />
                  <span>Pindai Surat</span>
                </button>

                <label
                  style={{
                    padding: "9px 8px",
                    borderRadius: 8,
                    border: `1.5px solid ${T.border}`,
                    background: isDark ? "#1E293B" : "#fff",
                    color: T.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Icon name="upload" size={14} />
                  <span>Unggah File</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const u = window.prompt("Masukkan tautan Google Drive / Cloud URL:", modalMasuk.data.file_url || "");
                    if (u !== null) {
                      setModalMasuk((prev) => ({
                        ...prev,
                        data: { ...prev.data, file_url: u, file_name: u ? "Tautan Berkas Cloud" : "", drive_url: "" }
                      }));
                    }
                  }}
                  style={{
                    padding: "9px 8px",
                    borderRadius: 8,
                    border: `1.5px solid ${T.border}`,
                    background: isDark ? "#1E293B" : "#fff",
                    color: T.text,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Icon name="link" size={14} />
                  <span>Tautan URL</span>
                </button>
              </div>

              {/* Preview Card If Attached */}
              {modalMasuk.data.file_url && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: isDark ? "#0F172A" : "#EFF6FF",
                  border: `1px solid ${isDark ? "#2563EB" : "#BFDBFE"}`,
                  padding: "8px 12px",
                  borderRadius: 8,
                  gap: 10
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {modalMasuk.data.file_url.startsWith("data:image") ? (
                      <img
                        src={modalMasuk.data.file_url}
                        alt="Preview"
                        onClick={() => setModalLightboxFoto({ url: modalMasuk.data.file_url, title: "Foto Surat Masuk" })}
                        style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, cursor: "pointer", border: `1px solid ${T.border}` }}
                      />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 6, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", color: "#1D4ED8" }}>
                        <Icon name="file" size={20} />
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {modalMasuk.data.file_name || "Foto_Fisik_Surat.jpg"}
                      </div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>
                        {modalMasuk.data.file_url.startsWith("data:image") ? "Foto fisik surat siap disimpan" : "Berkas dokumen / tautan terlampir"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    {modalMasuk.data.file_url.startsWith("data:") && (
                      <button
                        type="button"
                        onClick={() => lihatBerkas(modalMasuk.data.file_url, "Foto Fisik Surat Masuk")}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: T.bg,
                          border: `1px solid ${T.border}`,
                          color: T.primary,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <Icon name="eye" size={12} />
                        <span>Lihat</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setModalMasuk((prev) => ({
                          ...prev,
                          data: { ...prev.data, file_url: "", file_name: "", drive_url: "" },
                        }))
                      }
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        background: T.dangerBg || "#FEF2F2",
                        border: `1px solid ${T.dangerBorder || "#FECACA"}`,
                        color: T.danger,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Icon name="trash" size={12} />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              )}

              {modalMasuk.data.drive_url && (
                <a
                  href={modalMasuk.data.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: T.primary,
                    textDecoration: "none",
                    width: "fit-content"
                  }}
                >
                  <Icon name="link" size={12} />
                  <span>Salinan Google Drive — buka di tab baru</span>
                </a>
              )}
            </div>

            {modalMasuk.mode === "edit" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Status Surat
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalMasuk.data.status}
                  onChange={(v) => setModalMasuk({ ...modalMasuk, data: { ...modalMasuk.data, status: v } })}
                  options={[
                    { value: "Diterima", label: "Diterima" },
                    { value: "Didisposisi", label: "Didisposisi" },
                    { value: "Selesai", label: "Selesai" },
                  ]}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setModalMasuk(null)}
                style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: "pointer", fontSize: 13 }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Menyimpan..." : "Simpan Surat Masuk"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: DISPOSISI DIGITAL BERJENJANG (KEPALA BADAN -> SEKRETARIS -> KABID -> STAF) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalDisposisi && (
        <Modal
          title="Lembar Disposisi Digital Berjenjang"
          subtitle={`Disposisi untuk Surat: ${modalDisposisi.surat?.nomor_agenda || ""} - ${modalDisposisi.surat?.asal_surat || ""}`}
          icon="fileText"
          onClose={() => setModalDisposisi(null)}
          maxWidth={720}
        >
          {modalDisposisi.loading ? (
            <div style={{ padding: 40, textAlign: "center", color: T.textSecondary }}>Memuat riwayat lembar disposisi...</div>
          ) : (
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Box Info Surat & Baca Foto Fisik */}
              <div style={{ background: isDark ? "#172337" : "#F1F5F9", padding: "12px 14px", borderRadius: 8, borderLeft: `4px solid ${T.primary}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary }}>PERIHAL SURAT MASUK</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginTop: 2, lineHeight: 1.4 }}>
                      {modalDisposisi.surat?.perihal}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                      No. Asli: <strong>{modalDisposisi.surat?.nomor_surat_asli}</strong> • Dari: <strong>{modalDisposisi.surat?.asal_surat}</strong> • Sifat: <strong>{modalDisposisi.surat?.sifat}</strong>
                    </div>
                  </div>
                  {modalDisposisi.surat?.file_url && (
                    <button
                      type="button"
                      onClick={() =>
                        lihatBerkas(
                          modalDisposisi.surat.file_url,
                          `Foto Fisik: ${modalDisposisi.surat.nomor_agenda} (${modalDisposisi.surat.asal_surat})`
                        )
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: T.primary,
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0
                      }}
                    >
                      <Icon name="camera" size={13} />
                      <span>Baca Surat Fisik</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Riwayat Alur Disposisi Berjenjang */}
              {modalDisposisi.riwayat && modalDisposisi.riwayat.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      Riwayat Alur Disposisi ({modalDisposisi.riwayat.length} Tingkat)
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setModalDisposisi((prev) => ({
                          ...prev,
                          mode: "tambah_lanjutan",
                          form: {
                            id: null,
                            tanggal_disposisi: new Date().toISOString().split("T")[0],
                            pemberi_disposisi: "Sekretaris BAPPERIDA",
                            arahan: [],
                            catatan_instruksi: "",
                            diteruskan_kepada: [],
                            batas_waktu: "",
                            status_tindaklanjut: "Didisposisikan"
                          }
                        }))
                      }
                      style={{
                        background: "transparent",
                        border: "none",
                        color: T.primary,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Icon name="plus" size={13} />
                      <span>Tambah Disposisi Lanjutan</span>
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {modalDisposisi.riwayat.map((r, idx) => {
                      const arh = Array.isArray(r.arahan) ? r.arahan : (typeof r.arahan === "string" ? JSON.parse(r.arahan || "[]") : []);
                      const dit = Array.isArray(r.diteruskan_kepada) ? r.diteruskan_kepada : (typeof r.diteruskan_kepada === "string" ? JSON.parse(r.diteruskan_kepada || "[]") : []);
                      const isCurrentlyEditing = modalDisposisi.mode === "edit" && modalDisposisi.form?.id === r.id;

                      return (
                        <div
                          key={r.id || idx}
                          style={{
                            background: isCurrentlyEditing ? (isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF") : T.bg,
                            border: `1px solid ${isCurrentlyEditing ? T.primary : T.border}`,
                            borderRadius: 8,
                            padding: "10px 14px",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: isDark ? "rgba(59,130,246,0.25)" : "#DBEAFE", color: T.primary }}>
                                Tingkat {idx + 1}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                                {r.pemberi_disposisi || "Kepala BAPPERIDA"}
                              </span>
                              <span style={{ fontSize: 11, color: T.textMuted, fontVariantNumeric: "tabular-nums" }}>
                                {r.tanggal_disposisi ? r.tanggal_disposisi.split("T")[0] : ""}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => editEntriDisposisi(r)}
                                style={{ background: "transparent", border: "none", color: T.primary, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                              >
                                Edit
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => hapusEntriDisposisi(r.id)}
                                  style={{ background: "transparent", border: "none", color: T.danger, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Penerima Disposisi */}
                          {dit.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: T.textSecondary }}>Diteruskan kepada:</span>
                              {dit.map((d, dIdx) => (
                                <span
                                  key={dIdx}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: isDark ? "#1E293B" : "#F1F5F9",
                                    padding: "2px 7px",
                                    borderRadius: 4,
                                    color: T.text,
                                    border: `1px solid ${T.border}`
                                  }}
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Petunjuk / Arahan */}
                          {arh.length > 0 && (
                            <div style={{ fontSize: 11.5, color: T.textSecondary, marginTop: 5 }}>
                              <strong>Petunjuk:</strong> {arh.join(" • ")}
                            </div>
                          )}

                          {/* Catatan Khusus */}
                          {r.catatan_instruksi && (
                            <div style={{
                              fontSize: 12,
                              color: T.text,
                              marginTop: 6,
                              fontStyle: "italic",
                              background: isDark ? "#0F172A" : "#FAF5FF",
                              padding: "6px 10px",
                              borderRadius: 6,
                              borderLeft: `3px solid #8B5CF6`,
                              lineHeight: 1.4
                            }}>
                              "{r.catatan_instruksi}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Form Input / Edit Disposisi */}
              <form onSubmit={simpanDisposisi} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.primary,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  borderBottom: `1px solid ${T.border}`,
                  paddingBottom: 6
                }}>
                  {modalDisposisi.mode === "edit"
                    ? "Edit Entri Disposisi"
                    : modalDisposisi.riwayat?.length > 0
                    ? "+ Formulir Disposisi Lanjutan (Sekretaris / Kepala Bidang)"
                    : "Formulir Lembar Disposisi Pertama"}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                      Pemberi Disposisi *
                    </label>
                    <Select
                      fullWidth
                      size="md"
                      searchable
                      value={modalDisposisi.form.pemberi_disposisi}
                      onChange={(v) =>
                        setModalDisposisi({
                          ...modalDisposisi,
                          form: { ...modalDisposisi.form, pemberi_disposisi: v }
                        })
                      }
                      options={opsiPejabatPenandatangan}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                      Tanggal Disposisi *
                    </label>
                    <DatePicker
                      value={modalDisposisi.form.tanggal_disposisi}
                      onChange={(val) =>
                        setModalDisposisi({
                          ...modalDisposisi,
                          form: { ...modalDisposisi.form, tanggal_disposisi: val }
                        })
                      }
                      placeholder="Pilih tanggal disposisi..."
                    />
                  </div>
                </div>

                {/* Checklist Diteruskan Kepada (Tergrup Resmi) */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 6 }}>
                    Diteruskan Kepada (Pilih Pejabat / Bidang / Subbagian):
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, background: T.bg, padding: 12, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    {DITERUSKAN_GRUP.map((grup) => (
                      <div key={grup.kategori}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", marginBottom: 4, letterSpacing: "0.02em" }}>
                          {grup.kategori}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                          {grup.items.map((opt) => {
                            const checked = modalDisposisi.form.diteruskan_kepada.includes(opt);
                            return (
                              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const cur = modalDisposisi.form.diteruskan_kepada;
                                    const next = e.target.checked ? [...cur, opt] : cur.filter((x) => x !== opt);
                                    setModalDisposisi({
                                      ...modalDisposisi,
                                      form: { ...modalDisposisi.form, diteruskan_kepada: next }
                                    });
                                  }}
                                />
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checklist Arahan Pimpinan */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 6 }}>
                    Petunjuk / Arahan Tindak Lanjut:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 6, background: T.bg, padding: 10, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    {ARAHAN_OPTIONS.map((opt) => {
                      const checked = modalDisposisi.form.arahan.includes(opt);
                      return (
                        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.text, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const cur = modalDisposisi.form.arahan;
                              const next = e.target.checked ? [...cur, opt] : cur.filter((x) => x !== opt);
                              setModalDisposisi({
                                ...modalDisposisi,
                                form: { ...modalDisposisi.form, arahan: next }
                              });
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
                    placeholder="Tuliskan catatan khusus atau arahan spesifik dari pimpinan / kepala bidang..."
                    value={modalDisposisi.form.catatan_instruksi}
                    onChange={(e) =>
                      setModalDisposisi({
                        ...modalDisposisi,
                        form: { ...modalDisposisi.form, catatan_instruksi: e.target.value }
                      })
                    }
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13, resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                      Batas Waktu Tindak Lanjut (Opsional)
                    </label>
                    <DatePicker
                      value={modalDisposisi.form.batas_waktu}
                      onChange={(val) =>
                        setModalDisposisi({
                          ...modalDisposisi,
                          form: { ...modalDisposisi.form, batas_waktu: val }
                        })
                      }
                      placeholder="Pilih batas waktu..."
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                      Status Disposisi
                    </label>
                    <Select
                      fullWidth
                      size="md"
                      value={modalDisposisi.form.status_tindaklanjut}
                      onChange={(v) =>
                        setModalDisposisi({
                          ...modalDisposisi,
                          form: { ...modalDisposisi.form, status_tindaklanjut: v }
                        })
                      }
                      options={[
                        { value: "Didisposisikan", label: "Didisposisikan" },
                        { value: "Dalam Proses", label: "Dalam Proses" },
                        { value: "Selesai", label: "Selesai" },
                      ]}
                    />
                  </div>
                </div>

                {/* Footer Controls */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => cetakLembarDisposisi(modalDisposisi.surat, modalDisposisi.riwayat)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: T.card,
                      color: T.text,
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <Icon name="fileText" size={13} />
                    <span>Cetak Lembar Disposisi (A4)</span>
                  </button>

                  <div style={{ display: "flex", gap: 10 }}>
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
                      {submitting ? "Menyimpan..." : modalDisposisi.mode === "edit" ? "Perbarui Disposisi" : "Simpan Disposisi Digital"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
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
            {/* Box Nomor Surat Keluar Custom & Cek Otomatis */}
            <div
              style={{
                background: isDark ? "#172337" : "#EFF6FF",
                border: `1.5px solid ${
                  nomorKeluarCheck.status === "taken"
                    ? T.danger
                    : nomorKeluarCheck.status === "available"
                    ? T.success
                    : isDark ? "#2563EB" : "#BFDBFE"
                }`,
                padding: "12px 16px",
                borderRadius: 8
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.03em" }}>
                  NOMOR REGISTER / SURAT (DAPAT DICUSTOM) *
                </label>
              </div>

              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="text"
                  required
                  placeholder="Mis. BAPPERIDA.011.7/53.12/0001/XI/2026 atau nomor custom..."
                  value={modalKeluar.data.nomor_surat ?? modalKeluar.previewNomor ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setModalKeluar((prev) => ({
                      ...prev,
                      previewNomor: val,
                      data: { ...prev.data, nomor_surat: val }
                    }));
                  }}
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: `1.5px solid ${
                      nomorKeluarCheck.status === "taken"
                        ? T.danger
                        : nomorKeluarCheck.status === "available"
                        ? T.success
                        : T.border
                    }`,
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    color: T.text,
                    fontSize: 13.5,
                    fontWeight: 800,
                    fontFamily: "monospace",
                    fontVariantNumeric: "tabular-nums"
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    cekKetersediaanNomorKeluar(
                      modalKeluar.data.nomor_surat ?? modalKeluar.previewNomor,
                      modalKeluar.mode === "edit" ? modalKeluar.data.id : null
                    )
                  }
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: `1px solid ${T.border}`,
                    background: isDark ? "#1E293B" : "#FFFFFF",
                    color: T.text,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  Cek Nomor
                </button>
              </div>

              {/* Indikator Status Cek Nomor Otomatis */}
              {nomorKeluarCheck.status !== "idle" && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color:
                      nomorKeluarCheck.status === "taken"
                        ? T.danger
                        : nomorKeluarCheck.status === "available"
                        ? T.success
                        : T.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <Icon
                    name={
                      nomorKeluarCheck.status === "taken"
                        ? "alert"
                        : nomorKeluarCheck.status === "available"
                        ? "checkCircle"
                        : "clock"
                    }
                    size={13}
                  />
                  <span>{nomorKeluarCheck.message}</span>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Kode Klasifikasi *
                </label>
                <Select
                  fullWidth
                  size="md"
                  searchable
                  value={modalKeluar.data.kode_klasifikasi}
                  onChange={async (v) => {
                    const newKode = v;
                    const d = new Date(modalKeluar.data.tanggal_surat || Date.now());
                    const bln = !isNaN(d.getTime()) ? d.getMonth() + 1 : (new Date().getMonth() + 1);
                    const prev = await fetchPreviewNomorKeluar(newKode, bln);
                    const isDefault = !modalKeluar.data.nomor_surat || modalKeluar.data.nomor_surat === modalKeluar.previewNomor;
                    setModalKeluar((current) => ({
                      ...current,
                      previewNomor: modalKeluar.mode === "tambah" ? prev : current.previewNomor,
                      data: {
                        ...current.data,
                        kode_klasifikasi: newKode,
                        nomor_surat: (modalKeluar.mode === "tambah" && isDefault) ? prev : current.data.nomor_surat
                      }
                    }));
                  }}
                  options={KODE_KLASIFIKASI_LIST.map((k) => ({
                    value: k.kode,
                    label: k.label,
                  }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Tanggal Surat *
                </label>
                <DatePicker
                  value={modalKeluar.data.tanggal_surat}
                  onChange={async (newTgl) => {
                    const d = new Date(newTgl);
                    const bln = !isNaN(d.getTime()) ? d.getMonth() + 1 : (new Date().getMonth() + 1);
                    const prev = await fetchPreviewNomorKeluar(modalKeluar.data.kode_klasifikasi, bln);
                    const isDefault = !modalKeluar.data.nomor_surat || modalKeluar.data.nomor_surat === modalKeluar.previewNomor;
                    setModalKeluar((current) => ({
                      ...current,
                      previewNomor: modalKeluar.mode === "tambah" ? prev : current.previewNomor,
                      data: {
                        ...current.data,
                        tanggal_surat: newTgl,
                        nomor_surat: (modalKeluar.mode === "tambah" && isDefault) ? prev : current.data.nomor_surat
                      }
                    }));
                  }}
                  placeholder="Pilih tanggal surat..."
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Bidang Pengonsep *
                </label>
                <Select
                  fullWidth
                  size="md"
                  searchable
                  value={modalKeluar.data.bidang_pengonsep}
                  onChange={(v) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, bidang_pengonsep: v } })}
                  options={opsiBidangPengonsep}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Pejabat Penandatangan
                </label>
                <Select
                  fullWidth
                  size="md"
                  searchable
                  value={modalKeluar.data.penandatangan}
                  onChange={(v) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, penandatangan: v } })}
                  options={opsiPejabatPenandatangan}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Sifat Surat
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalKeluar.data.sifat}
                  onChange={(v) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, sifat: v } })}
                  options={[
                    { value: "Biasa", label: "Biasa" },
                    { value: "Penting", label: "Penting" },
                    { value: "Rahasia", label: "Rahasia" },
                    { value: "Segera", label: "Segera" },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, display: "block", marginBottom: 4 }}>
                  Status Surat
                </label>
                <Select
                  fullWidth
                  size="md"
                  value={modalKeluar.data.status}
                  onChange={(v) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, status: v } })}
                  options={[
                    { value: "Draf", label: "Draf" },
                    { value: "Ditandatangani", label: "Ditandatangani" },
                    { value: "Terkirim", label: "Terkirim" },
                    ...(isAdmin ? [{ value: "Dibatalkan", label: "Dibatalkan" }] : []),
                  ]}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>
                    Tautan Draf Surat (Docs/Drive)
                  </label>
                  {modalKeluar.data.file_draft_url && (
                    <button
                      type="button"
                      onClick={() => lihatBerkas(modalKeluar.data.file_draft_url, "Draf Surat")}
                      style={{ border: "none", background: "transparent", color: T.primary, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                    >
                      Buka Tautan
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="url"
                    placeholder="https://docs.google.com/... atau unggah"
                    value={modalKeluar.data.file_draft_url}
                    onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, file_draft_url: e.target.value } })}
                    style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                  />
                  <input
                    type="file"
                    ref={draftFileInputRef}
                    style={{ display: "none" }}
                    accept=".pdf,.doc,.docx,.odt,.rtf"
                    onChange={(e) => handleUploadBerkasKeluar(e, "draft")}
                  />
                  <button
                    type="button"
                    disabled={uploadingDraft}
                    onClick={() => draftFileInputRef.current?.click()}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      color: T.text,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: uploadingDraft ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      whiteSpace: "nowrap"
                    }}
                    title="Unggah berkas draf dari komputer"
                  >
                    <Icon name="upload" size={13} />
                    <span>{uploadingDraft ? "Mengunggah..." : "Unggah"}</span>
                  </button>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary }}>
                    Tautan Surat Final (Signed PDF)
                  </label>
                  {modalKeluar.data.file_final_url && (
                    <button
                      type="button"
                      onClick={() => lihatBerkas(modalKeluar.data.file_final_url, "Surat Final")}
                      style={{ border: "none", background: "transparent", color: T.primary, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}
                    >
                      Buka Tautan
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/.../pdf atau unggah"
                    value={modalKeluar.data.file_final_url}
                    onChange={(e) => setModalKeluar({ ...modalKeluar, data: { ...modalKeluar.data, file_final_url: e.target.value } })}
                    style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.inputBg || T.bg, color: T.text, fontSize: 13 }}
                  />
                  <input
                    type="file"
                    ref={finalFileInputRef}
                    style={{ display: "none" }}
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleUploadBerkasKeluar(e, "final")}
                  />
                  <button
                    type="button"
                    disabled={uploadingFinal}
                    onClick={() => finalFileInputRef.current?.click()}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${T.border}`,
                      background: isDark ? "#1E293B" : "#F8FAFC",
                      color: T.text,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: uploadingFinal ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      whiteSpace: "nowrap"
                    }}
                    title="Unggah berkas final bertanda tangan dari komputer"
                  >
                    <Icon name="upload" size={13} />
                    <span>{uploadingFinal ? "Mengunggah..." : "Unggah"}</span>
                  </button>
                </div>
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
                disabled={submitting || uploadingDraft || uploadingFinal}
                style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: T.primary, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: (submitting || uploadingDraft || uploadingFinal) ? 0.7 : 1 }}
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
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {modalDetail.data.file_url && (
                    modalDetail.data.file_url.startsWith("data:image") ? (
                      <button
                        type="button"
                        onClick={() => setModalLightboxFoto({ url: modalDetail.data.file_url, title: `Foto Fisik: ${modalDetail.data.nomor_agenda || modalDetail.data.nomor_surat}` })}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.primary, background: "transparent", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
                      >
                        <Icon name="camera" size={13} /> Lihat Foto Fisik Surat
                      </button>
                    ) : (
                      <a
                        href={modalDetail.data.file_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          if (modalDetail.data.file_url.startsWith("data:")) {
                            e.preventDefault();
                            bukaBerkas(modalDetail.data.file_url);
                          }
                        }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.primary, textDecoration: "none", fontWeight: 600 }}
                      >
                        <Icon name="link" size={13} /> Berkas Surat Masuk
                      </a>
                    )
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL KAMERA LANGSUNG AMBIL FOTO SURAT */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalScan && (
        <DocumentScanner
          defaultSize="F4"
          fileName={`surat-${String(modalMasuk?.data?.nomor_surat_asli || "masuk").replace(/[^\w-]+/g, "_")}`}
          onClose={() => setModalScan(false)}
          onSave={async (file, info) => {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });

            // Salinan ke Google Drive — best effort, kegagalan tidak membatalkan
            // lampiran karena data URL lokal tetap tersedia sebagai cadangan.
            let driveUrl = "";
            try {
              const res = await gasUpload({
                action: "direct",
                group: true,
                file: dataUrl.split(",")[1],
                filename: file.name,
                mimeType: "application/pdf",
                title: file.name.replace(/\.pdf$/i, ""),
              });
              if (res && res.fileUrl) driveUrl = res.fileUrl;
            } catch (_) {
              /* tetap simpan lokal */
            }

            // Batas body server 10 MB; data URL ~33% lebih besar dari file aslinya.
            // Bila data URL terlalu besar tetapi salinan Drive berhasil, pakai
            // tautan Drive sebagai berkas utama supaya halaman banyak tetap muat.
            const terlaluBesar = dataUrl.length > 9 * 1024 * 1024;
            if (terlaluBesar && !driveUrl) {
              throw Object.assign(new Error("PDF terlalu besar"), {
                userMessage: "PDF terlalu besar untuk disimpan (maksimal sekitar 6 MB). Kurangi jumlah halaman, lalu simpan lagi.",
              });
            }
            setModalMasuk((prev) =>
              prev
                ? {
                    ...prev,
                    data: {
                      ...prev.data,
                      file_url: terlaluBesar ? driveUrl : dataUrl,
                      file_name: file.name,
                      drive_url: driveUrl,
                    },
                  }
                : prev
            );
            setModalScan(false);
            notif(
              driveUrl
                ? `PDF ${info.pageCount} halaman terlampir dan tersalin ke Google Drive. Klik "Simpan Surat Masuk" untuk mencatatnya.`
                : `PDF ${info.pageCount} halaman terlampir (unggah Drive dilewati). Klik "Simpan Surat Masuk" untuk menyimpan.`
            );
          }}
        />
      )}

      <CameraCaptureModal
        isOpen={modalKamera}
        onClose={() => setModalKamera(false)}
        onCapture={(dataUrl, fileName) => {
          if (modalMasuk) {
            setModalMasuk((prev) => ({
              ...prev,
              data: {
                ...prev.data,
                file_url: dataUrl,
                file_name: fileName
              }
            }));
          }
        }}
      />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* LIGHTBOX MODAL: PRATINJAU FOTO RESOLUSI PENUH */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {modalLightboxFoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setModalLightboxFoto(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "92vw",
              maxHeight: "92vh",
              background: "#0F172A",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                background: "#1E293B",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                color: "#fff"
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{modalLightboxFoto.title || "Foto Fisik Dokumen"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a
                  href={modalLightboxFoto.url}
                  download="Foto_Surat_Masuk.jpg"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    textDecoration: "none",
                    fontSize: 12,
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Icon name="download" size={13} />
                  <span>Unduh</span>
                </a>
                <button
                  type="button"
                  onClick={() => setModalLightboxFoto(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94A3B8",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex"
                  }}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            </div>
            <div style={{ padding: 12, display: "flex", justifyContent: "center", alignItems: "center", overflow: "auto" }}>
              <img
                src={modalLightboxFoto.url}
                alt={modalLightboxFoto.title || "Foto Dokumen"}
                style={{ maxWidth: "88vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 6 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PENGATURAN WEWENANG */}
      {modalWewenang && (
        <ModalPengaturanWewenang
          onClose={() => setModalWewenang(false)}
          pegawaiList={pegawaiList}
          showToast={showToast}
          onSaved={() => {
            notif("Pengaturan wewenang berhasil disimpan.");
          }}
        />
      )}
    </div>
  );
}
