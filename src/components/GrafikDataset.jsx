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

const PALETTE = [
  "#2563EB", "#0D9488", "#D97706", "#7C3AED",
  "#E11D48", "#059669", "#4F46E5", "#EA580C",
];

function formatAngka(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return val ?? "—";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export default function GrafikDataset({ fields = [], rows = [], satuanDefault = "", compact = false }) {
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

    const wilayahSet = new Set();
    for (const r of rows) {
      if (r.wilayah_kode && String(r.wilayah_kode).trim()) {
        wilayahSet.add(String(r.wilayah_kode).trim());
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
        const key = r.wilayah_kode && multiWilayah ? `${labelX} - ${r.wilayah_kode}` : labelX;
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
          name: w,
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
                  name,
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
                  name,
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
                  name,
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

