import { useState, useEffect } from "react";
import { useIsDark } from "../ui.jsx";

export default function AgendaSuratPage() {
  const isDark = useIsDark();
  const [tab, setTab] = useState("masuk"); // "masuk" | "keluar"
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [itemsMasuk, setItemsMasuk] = useState([]);
  const [itemsKeluar, setItemsKeluar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";
  const textCol = isDark ? "#F8FAFC" : "#0F172A";
  const mutedCol = isDark ? "#94A3B8" : "#64748B";

  useEffect(() => {
    fetchData();
  }, [tab, tahun]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = search ? `&q=${encodeURIComponent(search)}` : "";
      if (tab === "masuk") {
        const res = await fetch(`/api/agenda/surat-masuk?tahun=${tahun}${q}`);
        const data = await res.json();
        if (data.ok) setItemsMasuk(data.items || []);
        else setError(data.message || "Gagal memuat data");
      } else {
        const res = await fetch(`/api/agenda/surat-keluar?tahun=${tahun}${q}`);
        const data = await res.json();
        if (data.ok) setItemsKeluar(data.items || []);
        else setError(data.message || "Gagal memuat data");
      }
    } catch (e) {
      setError(e.message || "Kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: textCol, margin: 0 }}>Agenda Surat Digital</h1>
          <p style={{ fontSize: 13, color: mutedCol, margin: "4px 0 0" }}>Buku register surat masuk dan booking nomor surat dinas keluar resmi BAPPERIDA</p>
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
          onClick={() => setTab("masuk")}
          style={{
            padding: "10px 20px",
            background: tab === "masuk" ? "#3B82F6" : "transparent",
            color: tab === "masuk" ? "#FFFFFF" : mutedCol,
            fontWeight: 700,
            fontSize: 13,
            borderRadius: "8px 8px 0 0",
            border: "none",
            cursor: "pointer"
          }}
        >
          📥 Buku Surat Masuk
        </button>
        <button
          onClick={() => setTab("keluar")}
          style={{
            padding: "10px 20px",
            background: tab === "keluar" ? "#3B82F6" : "transparent",
            color: tab === "keluar" ? "#FFFFFF" : mutedCol,
            fontWeight: 700,
            fontSize: 13,
            borderRadius: "8px 8px 0 0",
            border: "none",
            cursor: "pointer"
          }}
        >
          📤 Buku Surat Keluar
        </button>
      </div>

      {/* Search Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Cari perihal, nomor agenda, atau instansi pengirim/tujuan..."
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
          <div style={{ padding: 40, textAlign: "center", color: mutedCol }}>Memuat data agenda surat...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: "#EF4444" }}>{error}</div>
        ) : tab === "masuk" ? (
          !itemsMasuk.length ? (
            <div style={{ padding: 40, textAlign: "center", color: mutedCol }}>Belum ada data surat masuk untuk tahun {tahun}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#0F172A" : "#F8FAFC", borderBottom: `1px solid ${borderCol}`, color: mutedCol }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>No. Agenda</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Tanggal Terima</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Asal Surat</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Nomor & Tanggal Surat</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Perihal</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsMasuk.map((it) => (
                    <tr key={it.id} style={{ borderBottom: `1px solid ${borderCol}` }}>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#3B82F6", fontVariantNumeric: "tabular-nums" }}>{it.nomor_agenda}</td>
                      <td style={{ padding: "12px 16px", fontVariantNumeric: "tabular-nums", color: textCol }}>{it.tanggal_terima}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: textCol }}>{it.asal_surat}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: textCol }}>{it.nomor_surat_asli}</div>
                        <div style={{ fontSize: 11, color: mutedCol, fontVariantNumeric: "tabular-nums" }}>{it.tanggal_surat}</div>
                      </td>
                      <td style={{ padding: "12px 16px", color: textCol, maxWidth: 300, lineHeight: 1.4 }}>{it.perihal}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: it.status === "Didisposisi" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)",
                          color: it.status === "Didisposisi" ? "#3B82F6" : "#22C55E"
                        }}>
                          {it.status || "Diterima"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          !itemsKeluar.length ? (
            <div style={{ padding: 40, textAlign: "center", color: mutedCol }}>Belum ada data surat keluar untuk tahun {tahun}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: isDark ? "#0F172A" : "#F8FAFC", borderBottom: `1px solid ${borderCol}`, color: mutedCol }}>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>No. Urut</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Nomor Surat Dinas</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Tanggal</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Tujuan Surat</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Perihal</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Bidang</th>
                    <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsKeluar.map((it) => (
                    <tr key={it.id} style={{ borderBottom: `1px solid ${borderCol}` }}>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: "#3B82F6", fontVariantNumeric: "tabular-nums" }}>
                        {String(it.nomor_urut).padStart(4, "0")}
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700, color: textCol, fontVariantNumeric: "tabular-nums" }}>{it.nomor_surat}</td>
                      <td style={{ padding: "12px 16px", fontVariantNumeric: "tabular-nums", color: textCol }}>{it.tanggal_surat}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: textCol }}>{it.tujuan_surat}</td>
                      <td style={{ padding: "12px 16px", color: textCol, maxWidth: 300, lineHeight: 1.4 }}>{it.perihal}</td>
                      <td style={{ padding: "12px 16px", color: mutedCol }}>{it.bidang_pengonsep}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "3px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: it.status === "Ditandatangani" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
                          color: it.status === "Ditandatangani" ? "#22C55E" : "#F59E0B"
                        }}>
                          {it.status || "Draf"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
