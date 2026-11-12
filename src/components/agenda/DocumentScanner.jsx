import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import Jscanify from "jscanify/client";
import "./DocumentScanner.css";

const OPENCV_SRC = "https://docs.opencv.org/4.7.0/opencv.js";

const SIZES = {
  A4: { label: "A4", w: 210, h: 297 },
  F4: { label: "F4", w: 215, h: 330 },
};

const SHORT_SIDE_PX = 1240; // sisi pendek hasil scan (A4 kira-kira 150 dpi)
const JPEG_QUALITY = 0.8;
const DETECT_WIDTH = 480; // lebar frame untuk deteksi, supaya ringan
const DETECT_INTERVAL_MS = 120;
const MIN_AREA_RATIO = 0.15; // kertas harus menutupi minimal 15% frame
const STABLE_FRAMES = 4;
const MOVE_TOLERANCE = 0.02; // pergeseran sudut maksimum (rasio lebar frame)
const MAX_MISSES = 3;

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

let opencvPromise = null;
function loadOpenCV(src) {
  if (opencvPromise) return opencvPromise;
  opencvPromise = new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) {
      resolve(window.cv);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      const cv = window.cv;
      if (cv && cv.Mat) {
        resolve(cv);
      } else if (cv && typeof cv.then === "function") {
        cv.then((ready) => {
          window.cv = ready;
          resolve(ready);
        });
      } else if (cv) {
        cv.onRuntimeInitialized = () => resolve(window.cv);
      } else {
        reject(new Error("OpenCV tidak tersedia"));
      }
    };
    script.onerror = () => {
      opencvPromise = null;
      reject(new Error("OpenCV gagal dimuat"));
    };
    document.body.appendChild(script);
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
    return quad;
  } catch {
    return null;
  } finally {
    img.delete();
    if (contour) contour.delete();
  }
}

function drawOverlay(canvas, video, quad, scale, locked) {
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

  ctx.beginPath();
  quad.forEach((p, i) => {
    const x = ox + p.x * k;
    const y = oy + p.y * k;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = locked ? "rgba(63,191,117,0.16)" : "rgba(227,163,58,0.14)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = locked ? "#3fbf75" : "#e3a33a";
  ctx.stroke();
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

  const [cvStatus, setCvStatus] = useState("loading"); // loading | ready | failed
  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState("");
  const [facing, setFacing] = useState("environment");
  const [manyCams, setManyCams] = useState(false);
  const [sizeKey, setSizeKey] = useState(defaultSize);
  const [pages, setPages] = useState([]);
  const [viewIndex, setViewIndex] = useState(null);
  const [retakeAt, setRetakeAt] = useState(null);
  const [detect, setDetect] = useState("none"); // none | found | locked
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

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
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (video && overlay && video.videoWidth) {
        const scale = DETECT_WIDTH / video.videoWidth;
        work.width = DETECT_WIDTH;
        work.height = Math.round(video.videoHeight * scale);
        wctx.drawImage(video, 0, 0, work.width, work.height);

        const quad = detectQuad(scannerRef.current, work);
        if (quad) {
          misses = 0;
          if (prev) {
            const moved = Math.max(...quad.map((p, i) => dist(p, prev[i]))) / DETECT_WIDTH;
            stable = moved < MOVE_TOLERANCE ? stable + 1 : 0;
          }
          prev = quad;
          quadRef.current = quad;
        } else if (++misses >= MAX_MISSES) {
          prev = null;
          stable = 0;
          quadRef.current = null;
        }

        const locked = !!quadRef.current && stable >= STABLE_FRAMES;
        setDetect(quadRef.current ? (locked ? "locked" : "found") : "none");
        drawOverlay(overlay, video, quadRef.current, scale, locked);
      }
      timer = setTimeout(tick, DETECT_INTERVAL_MS);
    };
    tick();

    return () => {
      stopped = true;
      clearTimeout(timer);
      quadRef.current = null;
      setDetect("none");
    };
  }, [cvStatus, live, inCamera]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || busy) return;
    setBusy(true);
    setNotice("");

    // beri waktu UI menampilkan "Memproses" sebelum pekerjaan berat dimulai
    setTimeout(() => {
      const full = document.createElement("canvas");
      full.width = video.videoWidth;
      full.height = video.videoHeight;
      full.getContext("2d").drawImage(video, 0, 0);

      const size = SIZES[sizeKey];
      const quad = quadRef.current;
      let page = null;

      if (cvStatus === "ready" && quad) {
        const width = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2;
        const height = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2;
        const landscape = width > height;
        const ratio = size.h / size.w;
        const wpx = landscape ? Math.round(SHORT_SIDE_PX * ratio) : SHORT_SIDE_PX;
        const hpx = landscape ? SHORT_SIDE_PX : Math.round(SHORT_SIDE_PX * ratio);
        try {
          const out = scannerRef.current.extractPaper(full, wpx, hpx);
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
        const m = Math.min(1, 1754 / Math.max(full.width, full.height));
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
          cvStatus === "ready"
            ? "Kertas tidak terdeteksi saat foto diambil, jadi halaman disimpan apa adanya."
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
      setBusy(false);
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
  if (viewIndex !== null) {
    status = `Halaman ${viewIndex + 1} dari ${pages.length}`;
  } else if (cvStatus === "loading") {
    status = "Memuat deteksi tepi";
  } else if (cvStatus === "failed") {
    status = "Deteksi tepi tidak termuat. Foto diambil tanpa pelurusan.";
  } else if (detect === "locked") {
    status = "Siap diambil";
  } else if (detect === "found") {
    status = "Kertas terdeteksi. Tahan kamera tetap diam.";
  } else {
    status = "Arahkan kamera ke kertas";
  }

  return (
    <div className="ds-root" role="dialog" aria-modal="true" aria-label="Pindai surat">
      <header className="ds-head">
        <h2 className="ds-title">Pindai surat</h2>
        <label className="ds-size">
          <span>Ukuran kertas</span>
          <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
            {Object.entries(SIZES).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ds-btn ds-btn--quiet" onClick={onClose}>
          Tutup
        </button>
      </header>

      <div className="ds-stagewrap">
        <div className="ds-stage" hidden={!inCamera}>
          <video ref={videoRef} className="ds-video" playsInline muted />
          <canvas ref={overlayRef} className="ds-overlay" />
        </div>
        {!inCamera && pages[viewIndex] && (
          <img className="ds-preview" src={pages[viewIndex].url} alt={`Halaman ${viewIndex + 1}`} />
        )}
        {camError && inCamera && (
          <p className="ds-error" role="alert">
            {camError}
          </p>
        )}
        {!camError && (
          <p className={`ds-status ds-status--${inCamera ? detect : "none"}`} aria-live="polite">
            {status}
          </p>
        )}
      </div>

      <footer className="ds-foot">
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

        {inCamera ? (
          <div className="ds-actions">
            {manyCams && (
              <button
                type="button"
                className="ds-btn ds-btn--quiet"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              >
                Ganti kamera
              </button>
            )}
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              onClick={capture}
              disabled={!live || busy}
            >
              {busy
                ? "Memproses"
                : retakeAt !== null
                ? `Ambil ulang halaman ${retakeAt + 1}`
                : "Ambil halaman"}
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--outline"
              onClick={save}
              disabled={!pages.length || saving || busy}
            >
              {saving
                ? "Menyimpan"
                : `Simpan PDF${pages.length ? ` (${pages.length} halaman)` : ""}`}
            </button>
          </div>
        ) : (
          <div className="ds-actions">
            <button type="button" className="ds-btn ds-btn--primary" onClick={() => setViewIndex(null)}>
              Kembali ke kamera
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--outline"
              onClick={() => {
                setRetakeAt(viewIndex);
                setViewIndex(null);
              }}
            >
              Ambil ulang
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--quiet"
              onClick={() => movePage(viewIndex, -1)}
              disabled={viewIndex === 0}
            >
              Pindah ke kiri
            </button>
            <button
              type="button"
              className="ds-btn ds-btn--quiet"
              onClick={() => movePage(viewIndex, 1)}
              disabled={viewIndex === pages.length - 1}
            >
              Pindah ke kanan
            </button>
            <button type="button" className="ds-btn ds-btn--danger" onClick={() => removePage(viewIndex)}>
              Hapus halaman
            </button>
          </div>
        )}

        {notice && (
          <p className="ds-notice" role="status">
            {notice}
          </p>
        )}
      </footer>
    </div>
  );
}
