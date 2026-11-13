import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import Jscanify from "./jscanify.client.js";
import "./DocumentScanner.css";

const OPENCV_SRC = "/opencv.js"; // di-host sendiri di folder public/
const OPENCV_CDN = "https://docs.opencv.org/4.7.0/opencv.js"; // cadangan bila file lokal tidak ada
const LOAD_TIMEOUT_MS = 90000;

const SIZES = {
  A4: { label: "A4", w: 210, h: 297 },
  F4: { label: "F4", w: 215, h: 330 },
};

const SHORT_SIDE_PX = 1654; // sisi pendek hasil scan (A4 kira-kira 200 dpi, setara pindaian kamera HP)
const JPEG_QUALITY = 0.8;
const DETECT_WIDTH = 440; // lebar frame untuk deteksi: presisi sudut lebih baik, masih ringan
const DETECT_INTERVAL_MS = 200;
const MIN_AREA_RATIO = 0.15; // kertas harus menutupi minimal 15% frame
const STABLE_FRAMES = 4;
const MOVE_TOLERANCE = 0.02; // pergeseran sudut maksimum (rasio lebar frame)
const MAX_MISSES = 3;
const EDGE_MARGIN_RATIO = 0.02; // sudut yang lebih dekat dari ini ke tepi frame dianggap terpotong
const SMOOTH_ALPHA = 0.4; // EMA kotak tampilan, supaya tidak berkedip / pindah-pindah
const SMOOTH_MIN_HITS = 2; // deteksi berturut sebelum kotak mulai ditampilkan
const EDGE_EXIT_FRAMES = 2; // frame bersih berturut sebelum status "tepi" dilepas (anti-flap)

const CORNER_KEYS = [
  "topLeftCorner",
  "topRightCorner",
  "bottomRightCorner",
  "bottomLeftCorner",
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function quadArea(q) {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    sum += q[i].x * q[j].y - q[j].x * q[i].y;
  }
  return Math.abs(sum) / 2;
}

// Pilih alamat opencv.js yang benar-benar ada. Di server dev Vite, file yang tidak
// ada dijawab dengan index.html (status 200), jadi tipe kontennya ikut dicek.
async function pilihSumber(src) {
  if (/^https?:\/\//.test(src)) return src;
  try {
    const res = await fetch(src, { method: "HEAD" });
    if (res.ok && /javascript/i.test(res.headers.get("content-type") || "")) return src;
  } catch {
    // lanjut ke cadangan
  }
  return OPENCV_CDN;
}

// Tunggu sampai cv.Mat tersedia. Sengaja memakai polling dan tidak me-resolve dengan
// objek cv itu sendiri: pada sebagian build cv bersifat "thenable", dan me-resolve
// dengannya membuat promise menggantung selamanya.
function tungguOpenCV() {
  return new Promise((resolve, reject) => {
    const mulai = Date.now();
    let terhubung = false;
    const cek = () => {
      const cv = window.cv;
      if (cv && cv.Mat) {
        resolve();
        return;
      }
      if (cv && typeof cv.then === "function" && !terhubung) {
        terhubung = true;
        cv.then((modul) => {
          if (modul && modul.Mat) window.cv = modul;
        });
      }
      if (Date.now() - mulai > LOAD_TIMEOUT_MS) {
        reject(new Error("OpenCV terlalu lama dimuat"));
        return;
      }
      setTimeout(cek, 150);
    };
    cek();
  });
}

let opencvPromise = null;
function loadOpenCV(src) {
  if (opencvPromise) return opencvPromise;
  opencvPromise = (async () => {
    if (window.cv && window.cv.Mat) return;
    const url = await pilihSumber(src);
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("OpenCV gagal dimuat"));
      document.body.appendChild(script);
    });
    await tungguOpenCV();
  })().catch((err) => {
    opencvPromise = null;
    throw err;
  });
  return opencvPromise;
}

// Mengembalikan 4 titik sudut (kiri-atas, kanan-atas, kanan-bawah, kiri-bawah)
// dalam koordinat canvas deteksi, atau null jika kertas tidak ditemukan.
function detectQuad(scanner, canvas) {
  const cv = window.cv;
  const img = cv.imread(canvas);
  let contour = null;
  try {
    contour = scanner.findPaperContour(img);
    if (!contour) return null;
    const pts = scanner.getCornerPoints(contour, img);
    if (!pts || !CORNER_KEYS.every((k) => pts[k])) return null;
    const quad = CORNER_KEYS.map((k) => pts[k]);
    if (quadArea(quad) < canvas.width * canvas.height * MIN_AREA_RATIO) {
      return null;
    }
    // Jika ada sudut yang menempel di tepi frame, kertas kemungkinan terpotong
    // dan hasil pelurusan perspektif tidak bisa dipercaya.
    const margin = canvas.width * EDGE_MARGIN_RATIO;
    const touchesEdge = quad.some(
      (p) =>
        p.x < margin ||
        p.y < margin ||
        p.x > canvas.width - margin ||
        p.y > canvas.height - margin
    );
    return { quad, touchesEdge };
  } catch {
    return null;
  } finally {
    img.delete();
    if (contour) contour.delete();
  }
}

function drawOverlay(canvas, video, quad, scale, locked, warn) {
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (!quad || !video.videoWidth) return;

  // video memakai object-fit: contain, jadi hitung offset dan skalanya
  const s = Math.min(cw / video.videoWidth, ch / video.videoHeight);
  const ox = (cw - video.videoWidth * s) / 2;
  const oy = (ch - video.videoHeight * s) / 2;
  const k = s / scale;
  const pts = quad.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k }));
  const color = warn ? "#e5674f" : locked ? "#3fbf75" : "#e3a33a";

  // Redupkan area di luar kertas supaya fokus ke dokumen (gaya kamera ponsel)
  ctx.beginPath();
  ctx.rect(0, 0, cw, ch);
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fill("evenodd");

  // Garis tipis di sekeliling kertas
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Kurung sudut (bentuk L) mengikuti arah tepi kertas, seperti garis bidik kamera HP
  const arm = Math.max(20, Math.min(cw, ch) * 0.05);
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  for (let i = 0; i < 4; i++) {
    const c = pts[i];
    const to = (t) => {
      const dx = t.x - c.x;
      const dy = t.y - c.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: c.x + (dx / len) * arm, y: c.y + (dy / len) * arm };
    };
    const a = to(pts[(i + 3) % 4]);
    const b = to(pts[(i + 1) % 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function buildPdf(pages) {
  const first = pages[0];
  const orient = (p) => (p.pw > p.ph ? "l" : "p");
  const pdf = new jsPDF({
    unit: "mm",
    format: [first.pw, first.ph],
    orientation: orient(first),
    compress: true,
  });
  pages.forEach((p, i) => {
    if (i > 0) pdf.addPage([p.pw, p.ph], orient(p));
    const r = Math.min(p.pw / p.w, p.ph / p.h);
    const w = p.w * r;
    const h = p.h * r;
    pdf.addImage(p.url, "JPEG", (p.pw - w) / 2, (p.ph - h) / 2, w, h, undefined, "FAST");
  });
  return pdf.output("blob");
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function cameraErrorMessage(err) {
  if (!window.isSecureContext) return "Kamera hanya bisa dipakai lewat HTTPS.";
  switch (err && err.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Akses kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu muat ulang halaman.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Kamera tidak ditemukan di perangkat ini.";
    case "NotReadableError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.";
    default:
      return "Kamera tidak bisa dibuka.";
  }
}

/**
 * Props
 * - onSave(file, { pageCount }): dipanggil dengan File PDF. Boleh async (mis. upload ke GAS).
 * - onClose(): dipanggil saat tombol Tutup ditekan.
 * - fileName: awalan nama file, default "scan-surat".
 * - defaultSize: "A4" | "F4".
 * - opencvSrc: alamat opencv.js. Disarankan di-host sendiri (mis. "/opencv.js").
 */
export default function DocumentScanner({
  onSave,
  onClose,
  fileName = "scan-surat",
  defaultSize = "A4",
  opencvSrc = OPENCV_SRC,
}) {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const scannerRef = useRef(null);
  const streamRef = useRef(null);
  const quadRef = useRef(null);
  const edgeRef = useRef(false);
  const busyRef = useRef(false); // dibaca loop deteksi supaya tidak berebut saat memproses foto

  const [cvStatus, setCvStatus] = useState("loading"); // loading | ready | failed
  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState("");
  const [facing, setFacing] = useState("environment");
  const [manyCams, setManyCams] = useState(false);
  const [sizeKey, setSizeKey] = useState(defaultSize);
  const [pages, setPages] = useState([]);
  const [viewIndex, setViewIndex] = useState(null);
  const [retakeAt, setRetakeAt] = useState(null);
  const [detect, setDetect] = useState("none"); // none | found | locked | edge
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [flashing, setFlashing] = useState(false);
  const [flashN, setFlashN] = useState(0);

  // Muat OpenCV hanya saat scanner dibuka
  useEffect(() => {
    let cancelled = false;
    loadOpenCV(opencvSrc)
      .then(() => {
        if (cancelled) return;
        scannerRef.current = new Jscanify();
        setCvStatus("ready");
      })
      .catch(() => !cancelled && setCvStatus("failed"));
    return () => {
      cancelled = true;
    };
  }, [opencvSrc]);

  // Kamera
  useEffect(() => {
    let cancelled = false;
    setLive(false);

    async function start() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCamError(cameraErrorMessage());
        return;
      }
      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            // ideal: perangkat memilih mode terbaik yang dimilikinya (HP biasanya
            // menawarkan 4K), dan tetap menurun dengan mulus bila tidak tersedia.
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setCamError("");
        setLive(true);
        const devices = await navigator.mediaDevices.enumerateDevices();
        setManyCams(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (err) {
        if (!cancelled) setCamError(cameraErrorMessage(err));
      }
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  // Esc: keluar dari mode lihat halaman dulu, baru tutup scanner
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (viewIndex !== null) {
        setViewIndex(null);
        setRetakeAt(null);
      } else if (onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewIndex, onClose]);

  useEffect(
    () => () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    },
    []
  );

  // Deteksi kertas secara berkala saat kamera tampil
  const inCamera = viewIndex === null;
  useEffect(() => {
    if (cvStatus !== "ready" || !live || !inCamera) return undefined;

    const work = document.createElement("canvas");
    const wctx = work.getContext("2d", { willReadFrequently: true });
    let timer = null;
    let stopped = false;
    let prev = null;
    let stable = 0;
    let misses = 0;
    let hits = 0;
    let edgeExit = 0;

    const tick = () => {
      if (stopped) return;
      // Jangan makan CPU saat tab tersembunyi atau saat sedang memproses foto
      if (document.hidden || busyRef.current) {
        timer = setTimeout(tick, 250);
        return;
      }
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (video && overlay && video.videoWidth) {
        const mulai = performance.now();
        const scale = DETECT_WIDTH / video.videoWidth;
        work.width = DETECT_WIDTH;
        work.height = Math.round(video.videoHeight * scale);
        wctx.drawImage(video, 0, 0, work.width, work.height);

        const hasil = detectQuad(scannerRef.current, work);
        if (hasil) {
          misses = 0;
          hits = Math.min(hits + 1, 99);
          const { quad } = hasil;
          if (prev) {
            const moved = Math.max(...quad.map((p, i) => dist(p, prev[i]))) / DETECT_WIDTH;
            stable = moved < MOVE_TOLERANCE ? stable + 1 : 0;
          }
          prev = quad;
          // Tampilkan kotak hanya setelah beberapa frame berturut, lalu haluskan
          // dengan EMA supaya tidak berkedip / pindah-pindah antar frame.
          if (hits >= SMOOTH_MIN_HITS) {
            if (!quadRef.current) {
              quadRef.current = quad.map((p) => ({ ...p }));
            } else {
              quadRef.current = quadRef.current.map((p, i) => ({
                x: p.x + (quad[i].x - p.x) * SMOOTH_ALPHA,
                y: p.y + (quad[i].y - p.y) * SMOOTH_ALPHA,
              }));
            }
            // Masuk status "tepi" langsung, keluar pelan (anti-flap di batas margin)
            if (hasil.touchesEdge) {
              edgeRef.current = true;
              edgeExit = 0;
            } else if (++edgeExit >= EDGE_EXIT_FRAMES) {
              edgeRef.current = false;
            }
          }
        } else if (++misses >= MAX_MISSES) {
          prev = null;
          stable = 0;
          hits = 0;
          edgeExit = 0;
          quadRef.current = null;
          edgeRef.current = false;
        }

        const touching = !!quadRef.current && edgeRef.current;
        const locked = !!quadRef.current && !touching && stable >= STABLE_FRAMES;
        setDetect(!quadRef.current ? "none" : touching ? "edge" : locked ? "locked" : "found");
        drawOverlay(overlay, video, quadRef.current, scale, locked, touching);

        // Interval adaptif: kalau deteksi lambat di perangkat ini, jeda lebih lama
        // supaya UI tetap responsif (bisa menekan tombol dengan nyaman).
        const durasi = performance.now() - mulai;
        timer = setTimeout(
          tick,
          durasi > 55 ? Math.min(450, Math.round(durasi * 4)) : DETECT_INTERVAL_MS
        );
        return;
      }
      timer = setTimeout(tick, DETECT_INTERVAL_MS);
    };
    tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
      quadRef.current = null;
      edgeRef.current = false;
      setDetect("none");
    };
  }, [cvStatus, live, inCamera]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice("");
    // kilat putih sesaat, seperti rana kamera HP
    setFlashN((n) => n + 1);
    setFlashing(true);
    setTimeout(() => setFlashing(false), 360);

    // beri waktu UI menampilkan "Memproses" sebelum pekerjaan berat dimulai
    setTimeout(() => {
      try {
        const full = document.createElement("canvas");
        full.width = video.videoWidth;
        full.height = video.videoHeight;
        full.getContext("2d").drawImage(video, 0, 0);

        const size = SIZES[sizeKey];
        const quad = quadRef.current;
        const terpotong = edgeRef.current;
        let page = null;

        if (cvStatus === "ready" && quad && !terpotong) {
          const width = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2;
          const height = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2;
          const landscape = width > height;
          const ratio = size.h / size.w;
          const wpx = landscape ? Math.round(SHORT_SIDE_PX * ratio) : SHORT_SIDE_PX;
          const hpx = landscape ? SHORT_SIDE_PX : Math.round(SHORT_SIDE_PX * ratio);
          try {
            // Pakai sudut dari deteksi live (diskalakan ke resolusi penuh) supaya hasil
            // sama persis dengan kotak yang dilihat pengguna, dan tanpa deteksi ulang.
            const k = full.width / DETECT_WIDTH;
            const pt = (p) => ({ x: p.x * k, y: p.y * k });
            const corners = {
              topLeftCorner: pt(quad[0]),
              topRightCorner: pt(quad[1]),
              bottomRightCorner: pt(quad[2]),
              bottomLeftCorner: pt(quad[3]),
            };
            const out = scannerRef.current.extractPaper(full, wpx, hpx, corners);
            if (out && out.width) {
              page = {
                url: out.toDataURL("image/jpeg", JPEG_QUALITY),
                w: out.width,
                h: out.height,
                pw: landscape ? size.h : size.w,
                ph: landscape ? size.w : size.h,
              };
            }
          } catch {
            page = null;
          }
        }

        if (!page) {
          const m = Math.min(1, 2480 / Math.max(full.width, full.height));
          const raw = document.createElement("canvas");
          raw.width = Math.round(full.width * m);
          raw.height = Math.round(full.height * m);
          raw.getContext("2d").drawImage(full, 0, 0, raw.width, raw.height);
          const landscape = raw.width > raw.height;
          page = {
            url: raw.toDataURL("image/jpeg", JPEG_QUALITY),
            w: raw.width,
            h: raw.height,
            pw: landscape ? size.h : size.w,
            ph: landscape ? size.w : size.h,
          };
          setNotice(
            cvStatus === "ready" && terpotong
              ? "Kertas terpotong di tepi bingkai, jadi halaman disimpan apa adanya. Mundurkan kamera sampai seluruh kertas terlihat, lalu ambil ulang."
              : cvStatus === "ready"
              ? "Kertas tidak terdeteksi saat foto diambil, jadi halaman disimpan apa adanya."
              : cvStatus === "loading"
              ? "Deteksi tepi belum selesai dimuat, jadi halaman disimpan apa adanya."
              : "Halaman disimpan tanpa pelurusan karena deteksi tepi tidak termuat."
          );
        }

        if (retakeAt !== null) {
          setPages((prev) => prev.map((p, i) => (i === retakeAt ? page : p)));
          setViewIndex(retakeAt);
          setRetakeAt(null);
        } else {
          setPages((prev) => [...prev, page]);
        }
      } finally {
        // selalu lepas kunci, walau ada error, supaya tombol tidak macet
        busyRef.current = false;
        setBusy(false);
      }
    }, 30);
  }

  function removePage(index) {
    const next = pages.filter((_, i) => i !== index);
    setPages(next);
    setViewIndex(next.length === 0 ? null : Math.min(index, next.length - 1));
  }

  function movePage(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    const next = pages.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setPages(next);
    setViewIndex(target);
  }

  async function save() {
    if (!pages.length || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const blob = buildPdf(pages);
      const file = new File([blob], `${fileName}-${timestamp()}.pdf`, {
        type: "application/pdf",
      });
      if (onSave) await onSave(file, { pageCount: pages.length });
    } catch (err) {
      setNotice((err && err.userMessage) || "PDF gagal disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  let status = "";
  if (camError) status = "Kamera bermasalah";
  else if (busy) status = "Memproses foto…";
  else if (cvStatus === "loading") status = "Memuat deteksi tepi (9 MB, sekali saja) — kamera bisa langsung dipakai";
  else if (cvStatus === "failed") status = "Deteksi tepi tidak termuat — foto tanpa pelurusan";
  else if (detect === "edge") status = "Mundurkan — seluruh kertas harus terlihat";
  else if (detect === "locked") status = "Siap diambil";
  else if (detect === "found") status = "Kertas terdeteksi — tahan diam";
  else status = "Arahkan kamera ke kertas";

  const lastPage = pages.length ? pages[pages.length - 1] : null;

  return (
    <div className="ds-root" role="dialog" aria-modal="true" aria-label="Pindai surat">
      <div className="ds-stagewrap">
        <div className="ds-stage" hidden={!inCamera}>
          <video ref={videoRef} className="ds-video" playsInline muted />
          <canvas ref={overlayRef} className="ds-overlay" />
        </div>
        {!inCamera && pages[viewIndex] && (
          <img className="ds-preview" src={pages[viewIndex].url} alt={`Halaman ${viewIndex + 1}`} />
        )}

        {/* Bilah atas ala kamera ponsel */}
        <div className="ds-topbar">
          {inCamera ? (
            <>
              <button type="button" className="ds-iconbtn" onClick={onClose} aria-label="Tutup pemindai">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <span className={`ds-pill ds-pill--${camError ? "none" : detect}`} aria-live="polite">
                <span className="ds-dot" aria-hidden="true" />
                <span className="ds-pilltext">{status}</span>
              </span>
              <label className="ds-size">
                <span>Ukuran</span>
                <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)} aria-label="Ukuran kertas">
                  {Object.entries(SIZES).map(([key, s]) => (
                    <option key={key} value={key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ds-iconbtn"
                onClick={() => {
                  setRetakeAt(null);
                  setViewIndex(null);
                }}
                aria-label="Kembali ke kamera"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="ds-pill ds-pill--locked">
                <span className="ds-dot" aria-hidden="true" />
                Halaman {viewIndex + 1} / {pages.length}
              </span>
              <span className="ds-iconbtn ds-iconbtn--ghost" aria-hidden="true" />
            </>
          )}
        </div>

        {camError && inCamera && (
          <div className="ds-errbox" role="alert">
            <p className="ds-error">{camError}</p>
            <button type="button" className="ds-btn ds-btn--quiet" onClick={() => window.location.reload()}>
              Muat ulang halaman
            </button>
          </div>
        )}

        {/* Bilah bawah: strip halaman, kendali rana, dan simpan */}
        <div className="ds-botbar">
          {pages.length > 0 && (
            <ol className="ds-strip" aria-label="Halaman yang sudah diambil">
              {pages.map((p, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={`ds-thumb${viewIndex === i ? " is-active" : ""}`}
                    onClick={() => {
                      setRetakeAt(null);
                      setViewIndex(i);
                    }}
                    aria-label={`Lihat halaman ${i + 1}`}
                  >
                    <img src={p.url} alt="" />
                    <span>{i + 1}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}

          {notice && (
            <p className="ds-notice" role="status">
              {notice}
            </p>
          )}

          {inCamera ? (
            <div className="ds-controls">
              <button
                type="button"
                className="ds-roundbtn"
                onClick={() => lastPage && setViewIndex(pages.length - 1)}
                disabled={!lastPage}
                aria-label="Lihat halaman terakhir"
              >
                {lastPage && <img src={lastPage.url} alt="" />}
                {pages.length > 0 && <span className="ds-badge">{pages.length}</span>}
              </button>

              <div className="ds-shutterwrap">
                {retakeAt !== null && (
                  <button type="button" className="ds-chip" onClick={() => setRetakeAt(null)}>
                    Ambil ulang halaman {retakeAt + 1}
                    <span aria-hidden="true">×</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`ds-shutter${busy ? " is-busy" : ""}`}
                  onClick={capture}
                  disabled={!live || busy}
                  aria-label={retakeAt !== null ? `Ambil ulang halaman ${retakeAt + 1}` : "Ambil halaman"}
                >
                  <span className="ds-shutter-inner" />
                </button>
              </div>

              <button
                type="button"
                className="ds-roundbtn"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                disabled={!manyCams}
                aria-label="Ganti kamera depan atau belakang"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <polyline points="21 3 21 9 15 9" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="ds-controls ds-controls--review">
              <button type="button" className="ds-actbtn" onClick={() => movePage(viewIndex, -1)} disabled={viewIndex === 0}>
                ◀ Kiri
              </button>
              <button
                type="button"
                className="ds-actbtn"
                onClick={() => {
                  setRetakeAt(viewIndex);
                  setViewIndex(null);
                }}
              >
                Ambil ulang
              </button>
              <button type="button" className="ds-actbtn ds-actbtn--danger" onClick={() => removePage(viewIndex)}>
                Hapus
              </button>
              <button type="button" className="ds-actbtn" onClick={() => movePage(viewIndex, 1)} disabled={viewIndex === pages.length - 1}>
                Kanan ▶
              </button>
            </div>
          )}

          {pages.length > 0 && (
            <button type="button" className="ds-save" onClick={save} disabled={saving || busy}>
              {saving ? "Menyimpan…" : `Simpan PDF (${pages.length} halaman)`}
            </button>
          )}
        </div>

        {flashing && <div key={flashN} className="ds-flash" aria-hidden="true" />}
      </div>
    </div>
  );
}