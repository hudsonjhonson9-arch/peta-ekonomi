import { useState, useEffect, useMemo, useContext } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon, Badge } from "./ui.jsx";

let cachedGeoJson = null;

// Posisi label optimal untuk 6 Kecamatan di Kab. Sumba Barat agar tidak saling bertumpuk
const LABEL_ANCHORS = {
  "53.12.04": [119.418, -9.455], // Tana Righu
  "53.12.10": [119.435, -9.560], // Loli
  "53.12.15": [119.452, -9.633], // Kota Waikabubak
  "53.12.18": [119.235, -9.705], // Laboya Barat
  "53.12.12": [119.358, -9.708], // Lamboya
  "53.12.11": [119.462, -9.705], // Wanokaka
};

// Normalisasi kode atau nama kecamatan agar cocok dengan GeoJSON 5312.min.geojson
export function resolveKecamatanKode(kodeRaw, namaRaw) {
  const k = String(kodeRaw || "").trim();
  if (["53.12.04", "53.12.10", "53.12.11", "53.12.12", "53.12.15", "53.12.18"].includes(k)) return k;
  const digits = k.replace(/\D/g, "");
  if (digits.startsWith("5312") && digits.length >= 6) {
    const kec = `53.12.${digits.slice(4, 6)}`;
    if (["53.12.04", "53.12.10", "53.12.11", "53.12.12", "53.12.15", "53.12.18"].includes(kec)) return kec;
  }
  // Pemetaan kode lama atau berdasarkan nama kecamatan
  const mapOld = {
    "53.12.01": "53.12.15",
    "53.12.02": "53.12.10",
    "53.12.03": "53.12.11",
    "53.12.05": "53.12.12",
    "53.12.06": "53.12.18",
  };
  if (mapOld[k]) return mapOld[k];

  const n = String(namaRaw || "").toLowerCase();
  if (n.includes("waikabubak")) return "53.12.15";
  if (n.includes("loli")) return "53.12.10";
  if (n.includes("wanokaka") || n.includes("wanukaka")) return "53.12.11";
  if (n.includes("tana righu") || n.includes("tanarighu")) return "53.12.04";
  if (n.includes("laboya barat") || n.includes("lamboya barat")) return "53.12.18";
  if (n.includes("lamboya") || n.includes("laboya")) return "53.12.12";
  return k;
}

const DATASET_STEPS = ["#fefce8", "#fef08a", "#facc15", "#f59e0b", "#b45309"];
const WILAYAH_PALETTE = {
  "53.12.04": "#3B82F6", // Tana Righu
  "53.12.10": "#8B5CF6", // Loli
  "53.12.15": "#F59E0B", // Kota Waikabubak
  "53.12.18": "#10B981", // Laboya Barat
  "53.12.12": "#06B6D4", // Lamboya
  "53.12.11": "#EC4899", // Wanokaka
};

export default function SumbaBaratMap({
  mode = "spm", // 'spm' | 'dataset' | 'wilayah'
  items = [],   // array of { kode, nama, nilai, target, realisasi, keterangan, satuan }
  kabupatenNilai = null,
  selectedKode = null,
  onSelectKecamatan = null,
  satuan = "%",
  title = "Peta Geospasial Kabupaten Sumba Barat (53.12)",
  subtitle = "Klik poligon kecamatan pada peta untuk melihat rincian capaian wilayah",
  height = 440,
}) {
  const { T } = useContext(ThemeContext);
  const [geo, setGeo] = useState(cachedGeoJson);
  const [loading, setLoading] = useState(!cachedGeoJson);
  const [error, setError] = useState(null);
  const [hovered, setHovered] = useState(null); // { kode, nama, jumlah_desa, clientX, clientY }

  useEffect(() => {
    if (cachedGeoJson) return;
    setLoading(true);
    fetch("/geojson/5312.min.geojson")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        cachedGeoJson = data;
        setGeo(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || "Gagal memuat /geojson/5312.min.geojson");
        setLoading(false);
      });
  }, []);

  // Lookup nilai per kode kecamatan (mendukung normalisasi kode/nama)
  const dataByKode = useMemo(() => {
    const map = {};
    (items || []).forEach(it => {
      const k = resolveKecamatanKode(it.kode || it.wilayah_kode, it.nama || it.nama_wilayah);
      if (!k) return;
      map[k] = {
        ...it,
        kode: k,
        nilai: it.nilai !== undefined && it.nilai !== null ? Number(it.nilai) : (
          it.capaian_persen !== undefined && it.capaian_persen !== null ? Number(it.capaian_persen) : null
        ),
      };
    });
    return map;
  }, [items]);

  const { minVal, maxVal } = useMemo(() => {
    const vals = Object.values(dataByKode)
      .map(d => d.nilai)
      .filter(v => v !== null && !Number.isNaN(v));
    if (!vals.length) return { minVal: 0, maxVal: 100 };
    return { minVal: Math.min(...vals), maxVal: Math.max(...vals) };
  }, [dataByKode]);

  // Proyeksi koordinat [lon, lat] ke SVG viewBox 760 x 480
  const projection = useMemo(() => {
    if (!geo) return null;
    const [minLon, minLat, maxLon, maxLat] = geo.bbox || [119.056, -9.79722, 119.58601, -9.37621];
    const svgW = 760;
    const svgH = 470;
    const padX = 36;
    const padY = 30;
    const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
    const cosLat = Math.cos(midLatRad);

    const geoW = (maxLon - minLon) * cosLat;
    const geoH = maxLat - minLat;
    const scale = Math.min((svgW - padX * 2) / geoW, (svgH - padY * 2) / geoH);

    const renderedW = geoW * scale;
    const renderedH = geoH * scale;
    const offsetX = (svgW - renderedW) / 2;
    const offsetY = (svgH - renderedH) / 2;

    const projectPoint = ([lon, lat]) => {
      const x = offsetX + (lon - minLon) * cosLat * scale;
      const y = offsetY + (maxLat - lat) * scale;
      return [x, y];
    };

    const ringToPath = ring =>
      ring
        .map((pt, idx) => {
          const [x, y] = projectPoint(pt);
          return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ") + " Z";

    const geometryToPath = geom => {
      if (!geom) return "";
      if (geom.type === "Polygon") {
        return geom.coordinates.map(ringToPath).join(" ");
      }
      if (geom.type === "MultiPolygon") {
        return geom.coordinates.map(poly => poly.map(ringToPath).join(" ")).join(" ");
      }
      return "";
    };

    return { svgW, svgH, projectPoint, geometryToPath };
  }, [geo]);

  const getFillColor = kode => {
    if (!kode) return "rgba(148, 163, 184, 0.35)";
    if (mode === "wilayah") {
      return WILAYAH_PALETTE[kode] || "#3B82F6";
    }
    const row = dataByKode[kode];
    const val = row?.nilai ?? (Object.keys(dataByKode).length === 0 ? kabupatenNilai : null);
    if (val === null || val === undefined || Number.isNaN(val)) return "#cbd5e1";

    if (mode === "spm") {
      if (val >= 80) return "#16a34a";
      if (val >= 60) return "#eab308";
      return "#dc2626";
    }

    // mode === 'dataset'
    if (minVal === maxVal) return DATASET_STEPS[2];
    const ratio = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    const idx = Math.min(DATASET_STEPS.length - 1, Math.floor(ratio * DATASET_STEPS.length));
    return DATASET_STEPS[idx];
  };

  const getStatusLabel = val => {
    if (val === null || val === undefined || Number.isNaN(val)) return "Belum ada data";
    if (val >= 80) return "Baik (≥ 80%)";
    if (val >= 60) return "Cukup (60–79%)";
    return "Perlu Perhatian (< 60%)";
  };

  const features = geo?.features || [];
  const namedFeatures = features.filter(f => f.properties?.kode);

  return (
    <div style={{
      background: "linear-gradient(135deg, #0b1736 0%, #172e6e 100%)",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      padding: 18,
      color: "#f8fafc",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Header bar di atas kanvas peta */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              background: "#eab308", color: "#0f172a", fontWeight: 800,
              fontSize: 10.5, padding: "2px 8px", borderRadius: 20, letterSpacing: 0.4,
            }}>
              GEOJSON 53.12
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>{title}</span>
          </div>
          <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 3 }}>{subtitle}</div>
        </div>

        {selectedKode && onSelectKecamatan && (
          <button
            type="button"
            onClick={() => onSelectKecamatan(null)}
            style={{
              background: "rgba(255,255,255,0.14)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.28)", borderRadius: 8,
              padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Reset Pilihan Kecamatan
          </button>
        )}
      </div>

      {/* Kanvas SVG Peta GeoJSON Sumba Barat */}
      <div style={{
        width: "100%",
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}>
        {loading && (
          <div style={{ color: "#cbd5e1", fontSize: 13 }}>Memuat kanvas peta GeoJSON Sumba Barat (5312.min.geojson)...</div>
        )}
        {error && (
          <div style={{ color: "#fca5a5", fontSize: 13 }}>Gagal memuat peta: {error}</div>
        )}
        {!loading && !error && projection && (
          <svg
            viewBox={`0 0 ${projection.svgW} ${projection.svgH}`}
            style={{ width: "100%", height: "100%", maxHeight: height, userSelect: "none" }}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="sb-map-shadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#020617" floodOpacity="0.45" />
              </filter>
            </defs>

            <g filter="url(#sb-map-shadow)">
              {features.map((feat, idx) => {
                const props = feat.properties || {};
                const kode = props.kode;
                const dPath = projection.geometryToPath(feat.geometry);
                const isSelected = kode && selectedKode === kode;
                const isHovered = kode && hovered?.kode === kode;
                const fill = getFillColor(kode);

                return (
                  <path
                    key={kode || `island-${idx}`}
                    d={dPath}
                    fill={fill}
                    fillOpacity={!kode ? 0.45 : isSelected || isHovered ? 0.96 : 0.84}
                    stroke={isSelected ? "#fde047" : isHovered ? "#ffffff" : "#0f172a"}
                    strokeWidth={isSelected ? 2.8 : isHovered ? 2.2 : 1.3}
                    style={{
                      cursor: kode ? "pointer" : "default",
                      transition: "fill-opacity 0.15s ease, stroke-width 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      if (!kode) return;
                      setHovered({
                        kode,
                        nama: props.nama,
                        jumlah_desa: props.jumlah_desa,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    onMouseMove={e => {
                      if (!kode) return;
                      setHovered(h => (h ? { ...h, x: e.clientX, y: e.clientY } : null));
                    }}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      if (!kode || !onSelectKecamatan) return;
                      onSelectKecamatan(selectedKode === kode ? null : kode, props);
                    }}
                  />
                );
              })}
            </g>

            {/* Label Nama Kecamatan & Nilai di atas Poligon */}
            {namedFeatures.map(feat => {
              const { kode, nama } = feat.properties;
              const anchor = LABEL_ANCHORS[kode];
              if (!anchor) return null;
              const [lx, ly] = projection.projectPoint(anchor);
              const row = dataByKode[kode];
              const val = row?.nilai;

              return (
                <g
                  key={`lbl-${kode}`}
                  transform={`translate(${lx}, ${ly})`}
                  style={{ pointerEvents: "none" }}
                >
                  <rect
                    x={-58}
                    y={-17}
                    width={116}
                    height={val !== null && val !== undefined ? 34 : 22}
                    rx={6}
                    fill="rgba(15, 23, 42, 0.82)"
                    stroke="rgba(255,255,255,0.28)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={0}
                    y={-3}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={10.5}
                    fontWeight={700}
                  >
                    {nama}
                  </text>
                  {val !== null && val !== undefined && !Number.isNaN(val) && (
                    <text
                      x={0}
                      y={11}
                      textAnchor="middle"
                      fill="#fde047"
                      fontSize={10.5}
                      fontWeight={800}
                    >
                      {val.toLocaleString("id-ID", { maximumFractionDigits: 2 })}{satuan === "%" ? "%" : ` ${satuan}`}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Legenda Bawah */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 10, marginTop: 8, paddingTop: 10,
        borderTop: "1px solid rgba(255,255,255,0.14)", fontSize: 11.5, color: "#e2e8f0",
      }}>
        {mode === "spm" ? (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 13, height: 13, borderRadius: 3, background: "#16a34a", display: "inline-block" }} />
              <span>≥ 80% (Baik)</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 13, height: 13, borderRadius: 3, background: "#eab308", display: "inline-block" }} />
              <span>60 – &lt; 80% (Cukup)</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 13, height: 13, borderRadius: 3, background: "#dc2626", display: "inline-block" }} />
              <span>&lt; 60% (Perlu Perhatian)</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 13, height: 13, borderRadius: 3, background: "#cbd5e1", display: "inline-block" }} />
              <span>Belum ada data</span>
            </span>
          </div>
        ) : mode === "dataset" ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span>Rentang Nilai:</span>
            <strong>{minVal.toLocaleString("id-ID")}</strong>
            <div style={{
              width: 110, height: 10, borderRadius: 4,
              background: `linear-gradient(to right, ${DATASET_STEPS.join(", ")})`,
            }} />
            <strong>{maxVal.toLocaleString("id-ID")} {satuan}</strong>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {namedFeatures.map(f => (
              <span key={f.properties.kode} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: WILAYAH_PALETTE[f.properties.kode] || "#3B82F6", display: "inline-block" }} />
                <span>{f.properties.kode} {f.properties.nama} ({f.properties.jumlah_desa} Desa/Kel)</span>
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          Sumber Peta: GeoJSON Kabupaten Sumba Barat (6 Kecamatan · 74 Desa/Kelurahan)
        </div>
      </div>

      {/* Floating Tooltip saat kursor di atas poligon kecamatan */}
      {hovered && (
        <div
          style={{
            position: "fixed",
            left: Math.min(window.innerWidth - 250, Math.max(12, hovered.x + 16)),
            top: Math.max(12, hovered.y - 78),
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.96)",
            color: "#f8fafc",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 10,
            padding: "10px 13px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            minWidth: 195,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fde047" }}>
            Kec. {hovered.nama}
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 1 }}>
            Kode Kemendagri: <b>{hovered.kode}</b> · {hovered.jumlah_desa} Desa/Kelurahan
          </div>
          {mode !== "wilayah" && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.15)", fontSize: 12 }}>
              {dataByKode[hovered.kode]?.nilai !== undefined && dataByKode[hovered.kode]?.nilai !== null ? (
                <>
                  <div>
                    Capaian/Nilai:{" "}
                    <b style={{ color: "#fff", fontSize: 13.5 }}>
                      {dataByKode[hovered.kode].nilai.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
                      {satuan === "%" ? "%" : ` ${satuan}`}
                    </b>
                  </div>
                  {mode === "spm" && (
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>
                      Status: {getStatusLabel(dataByKode[hovered.kode].nilai)}
                    </div>
                  )}
                </>
              ) : (
                <span style={{ color: "#94a3b8" }}>Belum ada data pada periode ini</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

