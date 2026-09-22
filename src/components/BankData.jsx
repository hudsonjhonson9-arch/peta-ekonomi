import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ChevronDown, Database, Layers, Building2 } from "lucide-react";

// =========================================================
// SETUP: tambahkan @supabase/supabase-js ke package.json
//   npm install @supabase/supabase-js
// dan simpan kredensial di .env (Vite):
//   VITE_SUPABASE_URL=...
//   VITE_SUPABASE_ANON_KEY=...
// =========================================================
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const C = {
  navy: "#0B2447",
  navyDark: "#061529",
  navyMid: "#0D2E5A",
  gold: "#C9A227",
  goldLight: "#E3B83A",
  offWhite: "#F7F4EE",
  warmGray: "#E8E3D9",
  white: "#FFFFFF",
  textDark: "#0D1B2A",
  textMid: "#4A5568",
  textLight: "#8898AA",
};

export default function BankData() {
  const [data, setData] = useState([]); // bidang -> opd -> iku -> ikk -> detail (nested)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tracks: bidang id terbuka, opd id terbuka, iku id terbuka, ikk id terbuka
  const [openBidang, setOpenBidang] = useState(null);
  const [openOpd, setOpenOpd] = useState(null);
  const [openIku, setOpenIku] = useState(null);
  const [openIkk, setOpenIkk] = useState(null);

  useEffect(() => {
    loadBankData();
  }, []);

  async function loadBankData() {
    setLoading(true);
    setError(null);
    try {
      // Satu query nested pakai Supabase's relational select — jauh lebih hemat
      // daripada 5x query terpisah.
      const { data: bidangData, error: err } = await supabase
        .from("bidang_list")
        .select(`
          id, nama_bidang, instansi_id,
          bank_data_opd (
            id, nama, urutan,
            bank_data_iku (
              id, nama, urutan,
              bank_data_ikk (
                id, nama, urutan,
                bank_data_detail ( id, indikator, data, sumber_data, aspek, tahun, urutan )
              )
            )
          )
        `)
        .order("id");

      if (err) throw err;
      setData(bidangData || []);
    } catch (e) {
      setError(e.message || "Gagal memuat data bank");
    } finally {
      setLoading(false);
    }
  }

  const toggle = (level, id) => {
    if (level === "bidang") {
      setOpenBidang(openBidang === id ? null : id);
      setOpenOpd(null); setOpenIku(null); setOpenIkk(null);
    } else if (level === "opd") {
      setOpenOpd(openOpd === id ? null : id);
      setOpenIku(null); setOpenIkk(null);
    } else if (level === "iku") {
      setOpenIku(openIku === id ? null : id);
      setOpenIkk(null);
    } else if (level === "ikk") {
      setOpenIkk(openIkk === id ? null : id);
    }
  };

  if (loading) {
    return <div style={{ padding: 48, textAlign: "center", color: C.textMid }}>Memuat bank data...</div>;
  }
  if (error) {
    return <div style={{ padding: 48, textAlign: "center", color: "#b91c1c" }}>Gagal memuat: {error}</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px" }}>
      <h2 className="display" style={{ fontSize: 28, fontWeight: 700, color: C.navy, marginBottom: 8 }}>
        Bank Data Pembangunan
      </h2>
      <p style={{ color: C.textMid, marginBottom: 28 }}>
        Data kinerja disusun per Bidang, OPD mitra, Indikator Kinerja Utama (IKU), dan Indikator Kinerja Kegiatan (IKK).
      </p>

      {data.map((bidang) => (
        <div key={bidang.id} style={{ marginBottom: 12, border: `1px solid ${C.warmGray}`, borderRadius: 12, overflow: "hidden" }}>
          {/* LEVEL 1: BIDANG */}
          <button
            onClick={() => toggle("bidang", bidang.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", background: C.navy, color: C.white, border: "none",
              cursor: "pointer", fontWeight: 700, fontSize: 16, textAlign: "left",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Layers size={18} /> {bidang.nama_bidang}
            </span>
            <ChevronDown size={18} style={{ transform: openBidang === bidang.id ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>

          {openBidang === bidang.id && (
            <div style={{ padding: "8px 16px 16px", background: C.offWhite }}>
              {(bidang.bank_data_opd || []).map((opd) => (
                <div key={opd.id} style={{ marginTop: 8, border: `1px solid ${C.warmGray}`, borderRadius: 10, overflow: "hidden", background: C.white }}>
                  {/* LEVEL 2: OPD */}
                  <button
                    onClick={() => toggle("opd", opd.id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 16px", background: C.navyMid, color: C.white, border: "none",
                      cursor: "pointer", fontWeight: 600, fontSize: 14.5, textAlign: "left",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Building2 size={16} /> {opd.nama}
                    </span>
                    <ChevronDown size={16} style={{ transform: openOpd === opd.id ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                  </button>

                  {openOpd === opd.id && (
                    <div style={{ padding: "8px 14px 14px" }}>
                      {(opd.bank_data_iku || []).map((iku) => (
                        <div key={iku.id} style={{ marginTop: 8, border: `1px solid ${C.warmGray}`, borderRadius: 8, overflow: "hidden" }}>
                          {/* LEVEL 3: IKU */}
                          <button
                            onClick={() => toggle("iku", iku.id)}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "10px 14px", background: C.warmGray, color: C.textDark, border: "none",
                              cursor: "pointer", fontWeight: 600, fontSize: 14, textAlign: "left",
                            }}
                          >
                            <span>IKU: {iku.nama}</span>
                            <ChevronDown size={15} style={{ transform: openIku === iku.id ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                          </button>

                          {openIku === iku.id && (
                            <div style={{ padding: "6px 12px 12px" }}>
                              {(iku.bank_data_ikk || []).map((ikk) => (
                                <div key={ikk.id} style={{ marginTop: 6 }}>
                                  {/* LEVEL 4: IKK */}
                                  <button
                                    onClick={() => toggle("ikk", ikk.id)}
                                    style={{
                                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                                      padding: "8px 12px", background: C.offWhite, color: C.textDark, border: `1px dashed ${C.gold}`,
                                      borderRadius: 6, cursor: "pointer", fontWeight: 500, fontSize: 13.5, textAlign: "left",
                                    }}
                                  >
                                    <span>IKK: {ikk.nama}</span>
                                    <ChevronDown size={14} style={{ transform: openIkk === ikk.id ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                                  </button>

                                  {/* LEVEL 5: DETAIL — tabel Indikator / Data / Sumber Data / Aspek */}
                                  {openIkk === ikk.id && (
                                    <div style={{ overflowX: "auto", marginTop: 6 }}>
                                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead>
                                          <tr style={{ background: C.navy, color: C.white }}>
                                            <th style={thStyle}>Indikator</th>
                                            <th style={thStyle}>Data</th>
                                            <th style={thStyle}>Sumber Data</th>
                                            <th style={thStyle}>Aspek</th>
                                            <th style={thStyle}>Tahun</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(ikk.bank_data_detail || []).map((row) => (
                                            <tr key={row.id} style={{ borderBottom: `1px solid ${C.warmGray}` }}>
                                              <td style={tdStyle}>{row.indikator}</td>
                                              <td style={{ ...tdStyle, fontWeight: 600, color: C.navy }}>{row.data}</td>
                                              <td style={tdStyle}>{row.sumber_data}</td>
                                              <td style={tdStyle}>
                                                <span style={{ background: C.gold, color: C.white, padding: "2px 8px", borderRadius: 20, fontSize: 11.5 }}>
                                                  {row.aspek}
                                                </span>
                                              </td>
                                              <td style={tdStyle}>{row.tahun || "-"}</td>
                                            </tr>
                                          ))}
                                          {(!ikk.bank_data_detail || ikk.bank_data_detail.length === 0) && (
                                            <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: C.textLight }}>Belum ada data</td></tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {data.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: C.textLight }}>
          <Database size={32} style={{ marginBottom: 8 }} />
          <p>Belum ada data bank yang diinput.</p>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 12.5 };
const tdStyle = { padding: "8px 10px", color: "#0D1B2A" };
