import { useState, useEffect } from "react";
import { useIsDark } from "../ui.jsx";

export default function AgendaSppdPage() {
  const isDark = useIsDark();
  const [jenis, setJenis] = useState("DALAM_DAERAH"); // "DALAM_DAERAH" | "LUAR_DAERAH"
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";
  const textCol = isDark ? "#F8FAFC" : "#0F172A";
  const mutedCol = isDark ? "#94A3B8" : "#64748B";

  useEffect(() => {
    fetchData();
  }, [jenis, tahun]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = search ? `&q=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/agenda/sppd?jenis=${jenis}&tahun=${tahun}${q}`);
      const data = await res.json();
      if (data.ok) setItems(data.items || []);
      else setError(data.message || "Gagal memuat data");
    } catch (e) {
      setError(e.message || "Kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  const fmtRupiah = (num) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Number(num) || 0);
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: textCol, margin: 0 }}>Buku Register SPPD</h1>
          <p style={{ fontSize: 13, color: mutedCol, margin: "4px 0 0" }}>Register surat tugas, biaya perjalanan dinas, dan pertanggungjawaban SPJ</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={tahun}
            onChange={(e) => setTahun(parseInt(e.target.value, 10))}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${borderCol}`,
              background: cardBg,
              color: textCol,
              fontWeight: 700,
              fontSize: 13
            }}
          >
            <option value={2026}>Tahun 2026</option>
            <option value={2025}>Tahun 2025</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${borderCol}`, marginBottom: 20 }}>
        <button
          onClick={() => setJenis("DALAM_DAERAH")}
          style={{
            padding: "10px 20px",
            background: jenis === "DALAM_DAERAH" ? "#3B82F6" : "transparent",
            color: jenis === "DALAM_DAERAH" ? "#FFFFFF" : mutedCol,
            fontWeight: 700,
            fontSize: 13,
            borderRadius: "8px 8px 0 0",
            border: "none",
            cursor: "pointer"
          }}
        >
          📍 SPPD Dalam Daerah
        </button>
        <button
          onClick={() => setJenis("LUAR_DAERAH")}
          style={{
            padding: "10px 20px",
            background: jenis === "LUAR_DAERAH" ? "#3B82F6" : "transparent",
            color: jenis === "LUAR_DAERAH" ? "#FFFFFF" : mutedCol,
            fontWeight: 700,
            fontSize: 13,
            borderRadius: "8px 8px 0 0",
            border: "none",
            cursor: "pointer"
          }}
        >
          ✈️ SPPD Luar Daerah
        </button>
      </div>

      {/* Search Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Cari pelaksana, tujuan perjalanan, atau maksud kegiatan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchData()}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${borderCol}`,
            background: cardBg,
            color: textCol,
            fontSize: 13
          }}
        />
        <button
          onClick={fetchData}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "#3B82F6",
            color: "#FFFFFF",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          Cari
        </button>
      </div>

      {/* Content Table */}
      <div style={{ background: cardBg, border: `1px solid ${borderCol}`, borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: mutedCol }}>Memuat register SPPD...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#EF4444" }}>{error}</div>
        ) : !items.length ? (
          <div style={{ padding: 40, textAlign: "center", color: mutedCol }}>
            Belum ada register SPPD {jenis === "DALAM_DAERAH" ? "Dalam Daerah" : "Luar Daerah"} untuk tahun {tahun}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ background: isDark ? "#0F172A" : "#F8FAFC", borderBottom: `1px solid ${borderCol}`, color: mutedCol }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>No. Register</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Pelaksana Utama</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Maksud Perjalanan</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Tempat Tujuan</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Waktu Pelaksanaan</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Total Biaya</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: `1px solid ${borderCol}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#3B82F6", fontVariantNumeric: "tabular-nums" }}>{it.nomor_register}</div>
                      <div style={{ fontSize: 11, color: mutedCol, fontVariantNumeric: "tabular-nums" }}>SPT: {it.nomor_spt}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 700, color: textCol }}>{it.pelaksana_nama}</div>
                      <div style={{ fontSize: 11, color: mutedCol, fontFamily: "monospace", fontVariantNumeric: "tabular-nums" }}>NIP: {it.pelaksana_nip}</div>
                    </td>
                    <td style={{ padding: "12px 16px", color: textCol, maxWidth: 280, lineHeight: 1.4 }}>{it.maksud_perjalanan}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: textCol }}>
                      {it.tempat_tujuan}
                      {it.provinsi_tujuan && <div style={{ fontSize: 11, color: mutedCol, fontWeight: "normal" }}>Prov. {it.provinsi_tujuan}</div>}
                    </td>
                    <td style={{ padding: "12px 16px", fontVariantNumeric: "tabular-nums" }}>
                      <div style={{ fontWeight: 600, color: textCol }}>{it.tanggal_berangkat} s/d {it.tanggal_kembali}</div>
                      <div style={{ fontSize: 11, color: "#F59E0B" }}>{it.lama_hari} Hari Dinas</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right", fontFamily: "monospace", fontVariantNumeric: "tabular-nums", color: textCol }}>
                      {fmtRupiah(it.total_biaya)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: it.status === "Selesai" ? "rgba(34,197,94,0.15)" : (it.status === "Laporan Masuk" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.15)"),
                        color: it.status === "Selesai" ? "#22C55E" : (it.status === "Laporan Masuk" ? "#3B82F6" : "#F59E0B")
                      }}>
                        {it.status || "Pengajuan"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
