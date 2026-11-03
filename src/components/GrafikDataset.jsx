import { useState, useMemo, useContext } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import { ThemeContext } from "../App.jsx";
import { Select } from "./ui.jsx";

export const KODE_WILAYAH_KECAMATAN_MAP = {
  "53.12.04": "Tana Righu",
  "53.12.10": "Loli",
  "53.12.11": "Wanokaka",
  "53.12.12": "Lamboya",
  "53.12.15": "Kota Waikabubak",
  "53.12.18": "Laboya Barat",
  // Varian kode lokal/lama
  "53.12.01": "Kota Waikabubak",
  "53.12.02": "Loli",
  "53.12.03": "Wanokaka",
  "53.12.05": "Lamboya",
  "53.12.06": "Laboya Barat",
  "53.12": "Kab. Sumba Barat",
};

export function resolveNamaKecamatan(kodeOrNama, rowData = {}) {
  if (!kodeOrNama) return "Umum";
  const str = String(kodeOrNama).trim();

  // 1. Cek langsung jika di data row ada field kecamatan / nama_kecamatan / nama_wilayah
  if (rowData && typeof rowData === "object") {
    for (const key of Object.keys(rowData)) {
      const kl = key.toLowerCase();
      if ((kl === "kecamatan" || kl === "nama_kecamatan" || kl === "nama_wilayah") && rowData[key]) {
        return String(rowData[key]).trim();
      }
    }
  }

  // 2. Cek dari mapping standar kode BPS Sumba Barat
  if (KODE_WILAYAH_KECAMATAN_MAP[str]) {
    return KODE_WILAYAH_KECAMATAN_MAP[str];
  }

  // 3. Normalisasi jika teks mengandung nama kecamatan Sumba Barat
  const low = str.toLowerCase();
  if (low.includes("waikabubak")) return "Kota Waikabubak";
  if (low.includes("tanarighu") || low.includes("tana righu")) return "Tana Righu";
  if (low.includes("wanokaka") || low.includes("wanukaka")) return "Wanokaka";
  if (low.includes("laboya barat") || low.includes("lamboya barat")) return "Laboya Barat";
  if (low.includes("lamboya") || low.includes("laboya")) return "Lamboya";
  if (low.includes("loli")) return "Loli";
  if (low.includes("sumba barat")) return "Kab. Sumba Barat";

  return str;
}

const PALETTE = [
  "#2563EB", "#0D9488", "#D97706", "#7C3AED",
  "#E11D48", "#059669", "#4F46E5", "#EA580C",
];

function formatAngka(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return val ?? "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export default function GrafikDataset({ fields = [], rows = [], satuanDefault = "", polaritas = "positif", compact = false }) {
  const { T } = useContext(ThemeContext);

  const numericFields = useMemo(() => {
    const dipilih = fields.filter(
      f => (f.tipe_data === "angka" || f.tipe_data === "desimal") && f.tampil_grafik !== false
    );
    if (dipilih.length > 0) return dipilih;
    return fields.filter(f => f.tipe_data === "angka" || f.tipe_data === "desimal");
  }, [fields]);

  const [selectedField, setSelectedField] = useState("");
  const [chartType, setChartType] = useState("bar");

  const activeFieldKey = useMemo(() => {
    if (selectedField === "__ALL__" && numericFields.length > 1) return "__ALL__";
    if (numericFields.some(f => f.nama_field === selectedField)) return selectedField;
    return numericFields[0]?.nama_field || "";
  }, [selectedField, numericFields]);

  const { chartData, seriesList } = useMemo(() => {
    if (!numericFields.length || !rows.length) {
      return { chartData: [], seriesList: [] };
    }

    // Bangun pemetaan kode -> nama kecamatan dari baris-baris data
    const wilayahNamaMap = new Map();
    const wilayahSet = new Set();
    for (const r of rows) {
      if (r.wilayah_kode && String(r.wilayah_kode).trim()) {
        const rawW = String(r.wilayah_kode).trim();
        wilayahSet.add(rawW);
        if (!wilayahNamaMap.has(rawW)) {
          wilayahNamaMap.set(rawW, resolveNamaKecamatan(rawW, r.data));
        }
      }
    }
    const multiWilayah = wilayahSet.size > 1;

    if (activeFieldKey === "__ALL__" || (!multiWilayah && numericFields.length > 1 && !selectedField)) {
      const targetFields = activeFieldKey === "__ALL__" ? numericFields : [numericFields[0]];
      const byPeriod = new Map();
      for (const r of rows) {
        const labelX = r.periode && r.periode !== "Tahunan"
          ? `${r.tahun} (${r.periode})`
          : String(r.tahun);
        const rawW = r.wilayah_kode ? String(r.wilayah_kode).trim() : "";
        const namaWil = rawW ? (wilayahNamaMap.get(rawW) || resolveNamaKecamatan(rawW, r.data)) : "";
        const key = rawW && multiWilayah ? `${labelX} - ${namaWil}` : labelX;
        if (!byPeriod.has(key)) {
          byPeriod.set(key, { kategori: key, _tahun: r.tahun });
        }
        const item = byPeriod.get(key);
        const d = r.data || {};
        for (const f of targetFields) {
          const raw = d[f.nama_field];
          const num = raw !== null && raw !== undefined && raw !== "" ? Number(raw) : null;
          if (num !== null && Number.isFinite(num)) {
            item[f.nama_field] = num;
          }
        }
      }
      return {
        chartData: Array.from(byPeriod.values()),
        seriesList: targetFields.map((f, i) => ({
          key: f.nama_field,
          name: f.label,
          color: PALETTE[i % PALETTE.length],
        })),
      };
    }

    const fieldObj = numericFields.find(f => f.nama_field === activeFieldKey) || numericFields[0];
    if (!fieldObj) return { chartData: [], seriesList: [] };

    if (multiWilayah) {
      const wilayahArr = Array.from(wilayahSet);
      const byPeriod = new Map();
      for (const r of rows) {
        const labelX = r.periode && r.periode !== "Tahunan"
          ? `${r.tahun} (${r.periode})`
          : String(r.tahun);
        if (!byPeriod.has(labelX)) {
          byPeriod.set(labelX, { kategori: labelX, _tahun: r.tahun });
        }
        const item = byPeriod.get(labelX);
        const w = String(r.wilayah_kode || "Umum").trim();
        const raw = r.data?.[fieldObj.nama_field];
        const num = raw !== null && raw !== undefined && raw !== "" ? Number(raw) : null;
        if (num !== null && Number.isFinite(num)) {
          item[w] = num;
        }
      }
      return {
        chartData: Array.from(byPeriod.values()),
        seriesList: wilayahArr.map((w, i) => ({
          key: w,
          name: wilayahNamaMap.get(w) || resolveNamaKecamatan(w) || w,
          color: PALETTE[i % PALETTE.length],
        })),
      };
    }

    const byPeriod = new Map();
    for (const r of rows) {
      const labelX = r.periode && r.periode !== "Tahunan"
        ? `${r.tahun} (${r.periode})`
        : String(r.tahun);
      const raw = r.data?.[fieldObj.nama_field];
      const num = raw !== null && raw !== undefined && raw !== "" ? Number(raw) : null;
      byPeriod.set(labelX, {
        kategori: labelX,
        [fieldObj.nama_field]: num !== null && Number.isFinite(num) ? num : 0,
      });
    }

    return {
      chartData: Array.from(byPeriod.values()),
      seriesList: [
        {
          key: fieldObj.nama_field,
          name: fieldObj.label,
          color: PALETTE[0],
        },
      ],
    };
  }, [numericFields, rows, activeFieldKey, selectedField]);

  const trendSummary = useMemo(() => {
    if (!chartData || chartData.length < 2 || !seriesList.length) return null;
    const firstPeriod = chartData[0];
    const lastPeriod = chartData[chartData.length - 1];

    let sumFirst = 0;
    let sumLast = 0;
    let count = 0;

    const seriesTrends = seriesList.map(s => {
      const v1 = Number(firstPeriod[s.key]);
      const v2 = Number(lastPeriod[s.key]);
      if (Number.isFinite(v1) && Number.isFinite(v2)) {
        sumFirst += v1;
        sumLast += v2;
        count++;
        const delta = v2 - v1;
        const pct = v1 !== 0 ? (delta / v1) * 100 : 0;
        // Pada polaritas negatif (minimasi): penurunan (delta < 0) = prestasi membaik!
        const isMembaik = polaritas === "negatif" ? delta < 0 : delta > 0;
        const isSama = Math.abs(delta) < 0.0001;
        return {
          key: s.key,
          name: s.name,
          v1,
          v2,
          delta,
          pct,
          isMembaik,
          isSama,
        };
      }
      return null;
    }).filter(Boolean);

    if (!seriesTrends.length || count === 0) return null;

    const avg1 = sumFirst / count;
    const avg2 = sumLast / count;
    const avgDelta = avg2 - avg1;
    const avgPct = avg1 !== 0 ? (avgDelta / avg1) * 100 : 0;
    const overallMembaik = polaritas === "negatif" ? avgDelta < 0 : avgDelta > 0;
    const overallSama = Math.abs(avgDelta) < 0.0001;

    return {
      firstLabel: firstPeriod.kategori,
      lastLabel: lastPeriod.kategori,
      avg1,
      avg2,
      avgDelta,
      avgPct,
      overallMembaik,
      overallSama,
      seriesTrends,
    };
  }, [chartData, seriesList, polaritas]);

  if (numericFields.length === 0) {
    return (
      <div style={{
        padding: 28, textAlign: "center", color: T.textMuted,
        background: T.bg, borderRadius: 10, border: `1px dashed ${T.border}`, fontSize: 13,
      }}>
        Tidak ada kolom bertipe angka/desimal yang ditandai untuk ditampilkan pada grafik.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{
        padding: 28, textAlign: "center", color: T.textMuted,
        background: T.bg, borderRadius: 10, border: `1px dashed ${T.border}`, fontSize: 13,
      }}>
        Belum ada baris data untuk divisualisasikan.
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    boxShadow: T.shadowMd,
    color: T.text,
    fontSize: 12,
  };

  return (
    <div style={{
      background: T.card,
      borderRadius: 12,
      border: `1px solid ${T.border}`,
      padding: compact ? 14 : 18,
    }}>
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center",
        justifyContent: "space-between", gap: 10, marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary }}>Indikator:</span>
          <Select
            size="sm"
            minWidth={200}
            value={activeFieldKey}
            onChange={v => setSelectedField(v)}
            options={[
              ...numericFields.map(f => ({ value: f.nama_field, label: f.label })),
              ...(numericFields.length > 1
                ? [{ value: "__ALL__", label: `Semua Kolom Numerik (${numericFields.length})` }]
                : []),
            ]}
          />
          {satuanDefault && (
            <span style={{
              fontSize: 11, padding: "3px 8px", borderRadius: 99,
              background: T.primaryLight, color: T.primary, fontWeight: 600,
            }}>
              Satuan: {satuanDefault}
            </span>
          )}
          <span
            title={polaritas === "negatif"
              ? "Indikator Negatif / Minimasi: Semakin kecil nilainya semakin baik capaiannya (misal: Kemiskinan, Prevalensi Stunting)"
              : "Indikator Positif / Maksimasi: Semakin tinggi nilainya semakin baik capaiannya"
            }
            style={{
              fontSize: 11, padding: "3px 9px", borderRadius: 99,
              background: polaritas === "negatif" ? "#FEF2F2" : "#ECFDF5",
              color: polaritas === "negatif" ? "#DC2626" : "#059669",
              border: `1px solid ${polaritas === "negatif" ? "#FECACA" : "#A7F3D0"}`,
              fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5,
            }}
          >
            <Icon name={polaritas === "negatif" ? "trendingDown" : "trendingUp"} size={13} />
            {polaritas === "negatif" ? "Target Minimasi (Semakin kecil semakin baik)" : "Target Maksimasi (Semakin besar semakin baik)"}
          </span>
        </div>

        <div style={{
          display: "inline-flex", background: T.bg, padding: 3,
          borderRadius: 8, border: `1px solid ${T.border}`, gap: 2,
        }}>
          {[
            { id: "bar", label: "Batang" },
            { id: "line", label: "Garis" },
            { id: "area", label: "Area" },
          ].map(t => {
            const active = chartType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setChartType(t.id)}
                style={{
                  padding: "5px 11px", fontSize: 11, fontWeight: 600,
                  borderRadius: 6, border: "none", cursor: "pointer",
                  background: active ? T.primary : "transparent",
                  color: active ? "#fff" : T.textSecondary,
                  transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ringkasan Tren Capaian Antar Periode (Sesuai Polaritas Indikator) */}
      {trendSummary && (
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
          gap: 10, padding: "9px 13px", borderRadius: 8, marginBottom: 16,
          background: trendSummary.overallSama
            ? T.surfaceHover
            : (trendSummary.overallMembaik ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)"),
          border: `1px solid ${trendSummary.overallSama ? T.border : (trendSummary.overallMembaik ? "rgba(16, 185, 129, 0.28)" : "rgba(239, 68, 68, 0.28)")}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
            <span style={{
              fontWeight: 800,
              color: trendSummary.overallSama ? T.textSecondary : (trendSummary.overallMembaik ? "#059669" : "#DC2626"),
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              {trendSummary.overallSama ? (
                <span>Tren Stabil:</span>
              ) : trendSummary.overallMembaik ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="check" size={13} /> Capaian Membaik:</span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="alert" size={13} /> Perlu Perhatian:</span>
              )}
            </span>
            <span style={{ color: T.text, fontWeight: 600 }}>
              {trendSummary.firstLabel} → {trendSummary.lastLabel}
            </span>
            <span style={{ color: T.textMuted }}>·</span>
            <span style={{
              fontWeight: 700,
              color: trendSummary.overallSama ? T.textSecondary : (trendSummary.overallMembaik ? "#059669" : "#DC2626"),
            }}>
              Rata-rata {trendSummary.avgDelta > 0 ? "Naik" : "Turun"} {formatAngka(Math.abs(trendSummary.avgDelta))}{satuanDefault ? ` ${satuanDefault}` : ""} ({formatAngka(Math.abs(trendSummary.avgPct))}%)
            </span>
            {polaritas === "negatif" && (
              <span style={{ fontSize: 11, color: T.textMuted, fontStyle: "italic" }}>
                (Indikator minimasi: nilai menurun = capaian membaik)
              </span>
            )}
          </div>

          {trendSummary.seriesTrends.length > 1 && trendSummary.seriesTrends.length <= 6 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {trendSummary.seriesTrends.map(st => (
                <span
                  key={st.key}
                  style={{
                    fontSize: 11, padding: "2px 7px", borderRadius: 6,
                    background: st.isSama ? T.surfaceHover : (st.isMembaik ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)"),
                    color: st.isSama ? T.textSecondary : (st.isMembaik ? "#059669" : "#DC2626"),
                    fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3,
                  }}
                  title={`${st.name}: ${formatAngka(st.v1)} → ${formatAngka(st.v2)} (${st.delta > 0 ? "+" : ""}${formatAngka(st.delta)})`}
                >
                  <Icon name={st.delta < 0 ? "arrowDown" : "arrowUp"} size={10} />
                  <span>{st.name.replace("Kota ", "")}: {formatAngka(Math.abs(st.delta))}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ width: "100%", height: compact ? 260 : 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={chartData} margin={{ top: 10, right: 16, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="kategori" tick={{ fill: T.textSecondary, fontSize: 11 }} axisLine={{ stroke: T.border }} />
              <YAxis tickFormatter={formatAngka} tick={{ fill: T.textSecondary, fontSize: 11 }} axisLine={{ stroke: T.border }} width={65} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val, name) => [
                  `${formatAngka(val)}${satuanDefault ? ` ${satuanDefault}` : ""}`,
                  resolveNamaKecamatan(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {seriesList.map(s => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={52} />
              ))}
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="kategori" tick={{ fill: T.textSecondary, fontSize: 11 }} axisLine={{ stroke: T.border }} />
              <YAxis tickFormatter={formatAngka} tick={{ fill: T.textSecondary, fontSize: 11 }} axisLine={{ stroke: T.border }} width={65} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val, name) => [
                  `${formatAngka(val)}${satuanDefault ? ` ${satuanDefault}` : ""}`,
                  resolveNamaKecamatan(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {seriesList.map(s => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: s.color }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="kategori" tick={{ fill: T.textSecondary, fontSize: 11 }} axisLine={{ stroke: T.border }} />
              <YAxis tickFormatter={formatAngka} tick={{ fill: T.textSecondary, fontSize: 11 }} axisLine={{ stroke: T.border }} width={65} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val, name) => [
                  `${formatAngka(val)}${satuanDefault ? ` ${satuanDefault}` : ""}`,
                  resolveNamaKecamatan(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {seriesList.map(s => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.18}
                  strokeWidth={2.5}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
