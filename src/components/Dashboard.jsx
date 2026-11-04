import { useContext, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon, Badge, Button } from "./ui.jsx";
import { Select } from "./customControls.jsx";
import { STATUS_COLOR, ROLE_COLOR } from "../data.js";
import useResponsive from "../useResponsive.js";
import BankDataDashboard from "./BankDataDashboard.jsx";
import { PksRingkasan, DeadlineList } from "./PksRingkasan.jsx";
import { usePksTahun, usePksRingkasan, usePksDeadlineTerdekat } from "../hooks.js";
import { ThemeContext } from "../App.jsx";

// ── 1. Komponen Ringkasan Kertas Kerja ──────────────────────────────────────
function InfoKertasKerja({ T, onNav }) {
  const { data: tahunList = [] } = usePksTahun();
  const [tahun, setTahun] = useState(() => Number(localStorage.getItem("kk-tahun")) || new Date().getFullYear());
  const { data: ringkasan, isLoading } = usePksRingkasan(tahun);
  const { data: deadline = [] } = usePksDeadlineTerdekat(tahun);

  const pilihTahun = (v) => {
    setTahun(v);
    try { localStorage.setItem("kk-tahun", String(v)); } catch { /* kuota penuh */ }
  };

  const wajib = Number(ringkasan?.wajib || 0);
  const opsiTahun = [...new Set([tahun, ...tahunList].filter((y) => y != null))].sort((a, b) => b - a);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <Icon name="checkCircle" size={15} style={{ color: T.primary, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Kertas Kerja Perencanaan</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Select
            size="sm"
            minWidth={90}
            value={tahun}
            onChange={(v) => pilihTahun(parseInt(v, 10))}
            options={opsiTahun.map((y) => ({ value: y, label: String(y) }))}
          />
          <button
            onClick={() => onNav("kertas-kerja")}
            style={{ fontSize: 12, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
          >
            Lihat semua →
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, fontSize: 12.5, color: T.textMuted }}>
          Memuat ringkasan kertas kerja {tahun}…
        </div>
      ) : wajib === 0 ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, fontSize: 12.5, color: T.textMuted }}>
          Belum ada periode wajib tercatat untuk tahun {tahun}.
        </div>
      ) : (
        <>
          <PksRingkasan T={T} r={ringkasan} tahun={tahun} marginBottom={16} />
          <DeadlineList T={T} deadline={deadline} max={5} marginBottom={0} />
        </>
      )}
    </div>
  );
}

// ── 2. Leaderboard Cakupan Data & Ketercapaian SK per OPD ────────────────────
function LeaderboardOpdWidget({ walidataData, masterData, user, T, isMobile, onNav }) {
  const [tab, setTab] = useState("target_sk"); // "target_sk" | "volume"
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const daftarData = masterData?.daftar_data || [];
  const keterisianOpd = walidataData?.keterisian_opd || [];
  const opdMasterList = masterData?.opd || [];

  // Gabungkan data target SK dan realisasi dataset per OPD
  const rows = useMemo(() => {
    // Peta dari keterisian_opd (id, nama, singkatan, total_dataset, disetujui, menunggu_verval, draft)
    const statMap = new Map();
    keterisianOpd.forEach((k) => statMap.set(Number(k.id), k));

    // Peta master OPD untuk memastikan semua OPD terdaftar
    const allOpds = new Map();
    opdMasterList.forEach((o) => allOpds.set(Number(o.id), o));
    keterisianOpd.forEach((k) => {
      if (!allOpds.has(Number(k.id))) allOpds.set(Number(k.id), k);
    });

    // Peta target SK per OPD (ambil tahun terbaru)
    const targetMap = new Map();
    daftarData.forEach((d) => {
      const prev = targetMap.get(Number(d.opd_id));
      if (!prev || (d.tahun && prev.tahun && d.tahun > prev.tahun)) {
        targetMap.set(Number(d.opd_id), d);
      }
    });

    const list = Array.from(allOpds.values()).map((o) => {
      const oid = Number(o.id);
      const stat = statMap.get(oid) || {};
      const sk = targetMap.get(oid) || {};

      const total = Number(stat.total_dataset || 0);
      const disetujui = Number(stat.disetujui || 0);
      const menunggu = Number(stat.menunggu_verval || 0);
      const draft = Number(stat.draft || 0);

      const targetSk = Number(sk.jumlah_target_sk || 0);
      const realisasiSk = Number(sk.realisasi_dataset || total);
      const disetujuiSk = Number(sk.disetujui_dataset || disetujui);

      const pctSk = targetSk > 0 ? Math.round((realisasiSk / targetSk) * 100) : 0;

      return {
        id: oid,
        nama: o.nama || "Perangkat Daerah",
        singkatan: o.singkatan || "",
        total_dataset: total,
        disetujui,
        menunggu_verval: menunggu,
        draft,
        target_sk: targetSk,
        realisasi_sk: realisasiSk,
        disetujui_sk: disetujuiSk,
        persentase_sk: pctSk,
        nomor_sk: sk.nomor_sk || "",
        tahun_sk: sk.tahun || 2025,
      };
    });

    // Sorting sesuai tab aktif
    if (tab === "target_sk") {
      return list.sort((a, b) => {
        if (b.persentase_sk !== a.persentase_sk) return b.persentase_sk - a.persentase_sk;
        if (b.realisasi_sk !== a.realisasi_sk) return b.realisasi_sk - a.realisasi_sk;
        return a.nama.localeCompare(b.nama);
      });
    } else {
      return list.sort((a, b) => {
        if (b.total_dataset !== a.total_dataset) return b.total_dataset - a.total_dataset;
        if (b.disetujui !== a.disetujui) return b.disetujui - a.disetujui;
        return a.nama.localeCompare(b.nama);
      });
    }
  }, [keterisianOpd, daftarData, opdMasterList, tab]);

  const filtered = rows.filter((r) =>
    !search || `${r.nama} ${r.singkatan || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const displayList = showAll ? filtered : filtered.slice(0, 6);

  // Rata-rata kepatuhan daerah
  const avgPct = useMemo(() => {
    const valid = rows.filter((r) => r.target_sk > 0);
    if (!valid.length) return 0;
    const sum = valid.reduce((acc, r) => acc + r.persentase_sk, 0);
    return Math.round(sum / valid.length);
  }, [rows]);

  const userOpdRank = useMemo(() => {
    if (!user?.opd_id) return null;
    const idx = rows.findIndex((r) => Number(r.id) === Number(user.opd_id));
    if (idx === -1) return null;
    return { rank: idx + 1, row: rows[idx] };
  }, [rows, user?.opd_id]);

  return (
    <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, padding: isMobile ? 16 : 20, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      {/* Header Widget */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="award" size={17} style={{ color: "#2563EB" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
              Leaderboard Cakupan Data per OPD
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: "#ECFDF5", color: "#059669", padding: "2px 8px", borderRadius: 99 }}>
              Rata-rata {avgPct}%
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>
            Peringkat ketercapaian target SK Bupati dan keaktifan produsen data Kabupaten Sumba Barat
          </div>
        </div>

        {/* Tab Toggle Mode */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.bgAlt, padding: 3, borderRadius: 9, width: isMobile ? "100%" : "auto" }}>
          <button
            onClick={() => setTab("target_sk")}
            style={{
              flex: isMobile ? 1 : "initial",
              padding: "5px 12px",
              borderRadius: 7,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: tab === "target_sk" ? T.card : "transparent",
              color: tab === "target_sk" ? T.primary : T.textSecondary,
              boxShadow: tab === "target_sk" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s",
            }}
          >
            Target SK Bupati
          </button>
          <button
            onClick={() => setTab("volume")}
            style={{
              flex: isMobile ? 1 : "initial",
              padding: "5px 12px",
              borderRadius: 7,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: tab === "volume" ? T.card : "transparent",
              color: tab === "volume" ? T.primary : T.textSecondary,
              boxShadow: tab === "volume" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s",
            }}
          >
            Volume Dataset
          </button>
        </div>
      </div>

      {/* Banner Khusus Posisi OPD Pengguna */}
      {userOpdRank && (
        <div
          style={{
            background: T.isDark ? "#1E293B" : "#EFF6FF",
            border: `1px solid ${T.isDark ? "#334155" : "#BFDBFE"}`,
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <Icon name="award" size={16} style={{ color: "#2563EB" }} />
            <span style={{ color: T.text }}>
              Peringkat OPD Anda: <b>{userOpdRank.row.nama}</b> berada di posisi <b>#{userOpdRank.rank}</b> dari {rows.length} OPD
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB" }}>
            Ketercapaian: {userOpdRank.row.persentase_sk}% ({userOpdRank.row.disetujui_sk} disetujui / target {userOpdRank.row.target_sk} SK)
          </div>
        </div>
      )}

      {/* Bar Pencarian */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="text"
            placeholder="Cari perangkat daerah (OPD)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 12px 7px 32px",
              borderRadius: 8,
              border: `1px solid ${T.inputBorder}`,
              background: T.inputBg,
              color: T.text,
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.textMuted }}>
            <Icon name="search" size={14} />
          </div>
        </div>
        {user?.role === "Admin" && (
          <Button
            size="xs"
            variant="ghost"
            icon="settings"
            onClick={() => onNav("master-satudata")}
            style={{ fontSize: 11.5, whiteSpace: "nowrap" }}
          >
            Kelola SK di Master
          </Button>
        )}
      </div>

      {/* Tabel Leaderboard */}
      <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: T.bgAlt, borderBottom: `1px solid ${T.border}`, color: T.textMuted, fontSize: 11, textAlign: "left" }}>
              <th style={{ padding: "8px 12px", width: 60, textAlign: "center" }}>Rank</th>
              <th style={{ padding: "8px 12px" }}>Perangkat Daerah</th>
              {tab === "target_sk" ? (
                <>
                  <th style={{ padding: "8px 12px", width: 100 }}>Target SK</th>
                  <th style={{ padding: "8px 12px", width: 140 }}>Realisasi Dataset</th>
                  <th style={{ padding: "8px 12px", minWidth: 160 }}>Ketercapaian</th>
                  <th style={{ padding: "8px 12px", width: 110, textAlign: "right" }}>Status</th>
                </>
              ) : (
                <>
                  <th style={{ padding: "8px 12px", width: 110 }}>Total Dataset</th>
                  <th style={{ padding: "8px 12px", width: 110 }}>Disetujui</th>
                  <th style={{ padding: "8px 12px", width: 120 }}>Menunggu Verval</th>
                  <th style={{ padding: "8px 12px", width: 90, textAlign: "right" }}>Draf</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {displayList.map((row, idx) => {
              const rank = idx + 1;
              const isUserOpd = user?.opd_id && Number(user.opd_id) === row.id;

              // Style badge ranking
              let rankBadgeBg = T.bgAlt;
              let rankBadgeColor = T.textSecondary;
              let rankLabel = `#${rank}`;

              if (rank === 1) {
                rankBadgeBg = "#FEF9C3";
                rankBadgeColor = "#854D0E";
                rankLabel = "#1";
              } else if (rank === 2) {
                rankBadgeBg = "#F1F5F9";
                rankBadgeColor = "#334155";
                rankLabel = "#2";
              } else if (rank === 3) {
                rankBadgeBg = "#FFEDD5";
                rankBadgeColor = "#9A3412";
                rankLabel = "#3";
              }

              const pct = row.persentase_sk;
              const statusColor = pct >= 80 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
              const statusLabel = pct >= 80 ? "Sangat Baik" : pct >= 50 ? "Sedang" : "Rendah";

              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: idx < displayList.length - 1 ? `1px solid ${T.border}` : "none",
                    background: isUserOpd ? (T.isDark ? "#1E293B" : "#F0F7FF") : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Rank Kolom */}
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 26,
                        height: 24,
                        padding: "0 6px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: rankBadgeBg,
                        color: rankBadgeColor,
                      }}
                    >
                      {rankLabel}
                    </span>
                  </td>

                  {/* Nama OPD */}
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 600, color: isUserOpd ? T.primary : T.text }}>
                        {row.nama}
                      </span>
                      {isUserOpd && (
                        <span style={{ fontSize: 10, background: "#2563EB", color: "#fff", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                          OPD Anda
                        </span>
                      )}
                    </div>
                    {row.singkatan && (
                      <div style={{ fontSize: 11, color: T.textMuted }}>{row.singkatan}</div>
                    )}
                  </td>

                  {tab === "target_sk" ? (
                    <>
                      {/* Target SK */}
                      <td style={{ padding: "10px 12px", color: T.textSecondary }}>
                        {row.target_sk > 0 ? (
                          <span style={{ fontWeight: 600 }}>{row.target_sk} Dataset</span>
                        ) : (
                          <span style={{ color: T.textMuted, fontStyle: "italic" }}>Belum ada SK</span>
                        )}
                      </td>

                      {/* Realisasi */}
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontWeight: 700, color: T.text }}>{row.realisasi_sk}</span>
                        <span style={{ fontSize: 11, color: T.textMuted }}> ({row.disetujui_sk} disetujui)</span>
                      </td>

                      {/* Progress Bar Ketercapaian */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 7, background: T.bgAlt, borderRadius: 99, overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                height: "100%",
                                background: statusColor,
                                borderRadius: 99,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor, width: 38 }}>
                            {pct}%
                          </span>
                        </div>
                      </td>

                      {/* Status Kepatuhan */}
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: `${statusColor}18`,
                            color: statusColor,
                          }}
                        >
                          {row.target_sk > 0 ? statusLabel : "Belum SK"}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Total Dataset */}
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: T.text }}>
                        {row.total_dataset} Dataset
                      </td>

                      {/* Disetujui */}
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ color: "#16A34A", fontWeight: 600 }}>{row.disetujui}</span>
                      </td>

                      {/* Menunggu Verval */}
                      <td style={{ padding: "10px 12px" }}>
                        {row.menunggu_verval > 0 ? (
                          <span style={{ color: "#D97706", fontWeight: 600 }}>{row.menunggu_verval} dataset</span>
                        ) : (
                          <span style={{ color: T.textMuted }}>0</span>
                        )}
                      </td>

                      {/* Draf */}
                      <td style={{ padding: "10px 12px", textAlign: "right", color: T.textMuted }}>
                        {row.draft}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: T.textMuted }}>
                  Tidak ada perangkat daerah yang cocok dengan kata kunci &quot;{search}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Leaderboard */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 11.5, color: T.textMuted }}>
        <div>
          Menampilkan {displayList.length} dari {filtered.length} Perangkat Daerah Kabupaten Sumba Barat
        </div>
        {filtered.length > 6 && (
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              background: "none",
              border: "none",
              color: T.primary,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 11.5,
              padding: 0,
            }}
          >
            {showAll ? "Tampilkan Lebih Sedikit ↑" : `Lihat Semua (${filtered.length} OPD) ↓`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── 3. Antrean Verifikasi & Tindak Lanjut Khusus Reviewer & Admin ────────────
function AntreanTugasReviewer({ walidataData, docs, onNav, onView, T, isMobile }) {
  const antrianVerval = walidataData?.antrian_verifikasi || [];
  const reopenMenunggu = walidataData?.reopen_menunggu || [];
  const pendingDocs = docs.filter((d) => d.status !== "Diarsipkan" && d.status !== "Ditolak").slice(0, 4);

  if (antrianVerval.length === 0 && reopenMenunggu.length === 0 && pendingDocs.length === 0) {
    return null;
  }

  return (
    <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, padding: isMobile ? 16 : 20, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="bell" size={15} style={{ color: "#D97706" }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Antrean Tugas Membutuhkan Verifikasi</div>
            <div style={{ fontSize: 11.5, color: T.textMuted }}>Prioritas aksi untuk mempercepat layanan arsip & satu data</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {antrianVerval.length > 0 && (
            <span style={{ background: "#FEF3C7", color: "#B45309", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
              {antrianVerval.length} Dataset Baru
            </span>
          )}
          {reopenMenunggu.length > 0 && (
            <span style={{ background: "#EDE9FE", color: "#6D28D9", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
              {reopenMenunggu.length} Buka Kunci
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 14 }}>
        {/* Kolom 1: Dataset Satu Data Menunggu Verval */}
        <div style={{ background: T.bgAlt, borderRadius: 10, padding: 14, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Dataset Satu Data ({antrianVerval.length})</span>
            <button
              onClick={() => onNav("bankdata")}
              style={{ fontSize: 11, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Verval di Bank Data →
            </button>
          </div>

          {antrianVerval.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textMuted, padding: "12px 0", textAlign: "center" }}>
              Tidak ada dataset yang menunggu verifikasi saat ini.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {antrianVerval.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: T.card,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.nama}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.textMuted }}>
                      {item.opd_nama} · {item.baris_count || 0} baris data
                    </div>
                  </div>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#FEF3C7", color: "#B45309", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {item.status === "perlu_perbaikan" ? "Perbaikan" : "Diajukan"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom 2: Dokumen Arsip Menunggu Telaah */}
        <div style={{ background: T.bgAlt, borderRadius: 10, padding: 14, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>Dokumen Perencanaan ({pendingDocs.length})</span>
            <button
              onClick={() => onNav("dokumen")}
              style={{ fontSize: 11, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Lihat di Dokumen →
            </button>
          </div>

          {pendingDocs.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textMuted, padding: "12px 0", textAlign: "center" }}>
              Semua dokumen perencanaan telah diarsipkan atau ditindaklanjuti.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pendingDocs.map((d) => (
                <div
                  key={d.id}
                  style={{
                    background: T.card,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.textMuted }}>
                      {d.type} · {d.year} · {d.uploader}
                    </div>
                  </div>
                  <button
                    onClick={() => onView && onView(d)}
                    style={{ fontSize: 11, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    Telaah →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 3.b Widget Khusus Produsen Data (OPD) ───────────────────────────────────
function WidgetProdusenData({ produsenData, opdNama, onNav, T, isMobile }) {
  const datasets = produsenData?.datasets || [];
  const perluPerbaikan = datasets.filter((d) => d.status === "perlu_perbaikan");
  const diajukan = datasets.filter((d) => d.status === "diajukan");
  const draft = datasets.filter((d) => d.status === "draft");
  const jadwalMendekati = produsenData?.jadwal_mendekati || [];

  return (
    <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Alert Jika Ada Dataset Perlu Perbaikan */}
      {perluPerbaikan.length > 0 && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 12,
            padding: "14px 18px",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
              <Icon name="alert" size={16} style={{ color: "#DC2626" }} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#991B1B" }}>
                Perhatian: {perluPerbaikan.length} Dataset Memerlukan Perbaikan
              </div>
              <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 2 }}>
                Walidata mengembalikan dataset <b>{perluPerbaikan[0]?.nama}</b> dengan catatan: &quot;
                {perluPerbaikan[0]?.catatan_verifikasi || "Periksa kembali kelengkapan baris data"}
                &quot;{perluPerbaikan.length > 1 && ` (+${perluPerbaikan.length - 1} lainnya)`}
              </div>
            </div>
          </div>
          <button
            onClick={() => onNav("bankdata")}
            style={{
              padding: "7px 14px",
              background: "#DC2626",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Perbaiki di Bank Data →
          </button>
        </div>
      )}

      {/* Grid 2 Kolom: Status Pengajuan & Jadwal Pemutakhiran */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 14 }}>
        {/* Kolom 1: Status Pengajuan Terkini */}
        <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="database" size={15} style={{ color: T.primary }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>Pengajuan Dataset OPD</span>
            </div>
            <button
              onClick={() => onNav("bankdata")}
              style={{ fontSize: 11.5, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Kelola di Bank Data →
            </button>
          </div>

          {diajukan.length === 0 && draft.length === 0 && perluPerbaikan.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textMuted, padding: "16px 0", textAlign: "center" }}>
              Semua dataset OPD telah disetujui atau belum ada pengajuan baru.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...perluPerbaikan, ...diajukan, ...draft].slice(0, 4).map((d) => (
                <div
                  key={d.id}
                  style={{
                    background: T.bgAlt,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d.nama}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.textMuted }}>
                      {d.baris_count || 0} baris data · Frekuensi: {d.frekuensi || "Tahunan"}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontWeight: 700,
                      background:
                        d.status === "disetujui"
                          ? "#DCFCE7"
                          : d.status === "diajukan"
                          ? "#FEF3C7"
                          : d.status === "perlu_perbaikan"
                          ? "#FEE2E2"
                          : "#F1F5F9",
                      color:
                        d.status === "disetujui"
                          ? "#15803D"
                          : d.status === "diajukan"
                          ? "#B45309"
                          : d.status === "perlu_perbaikan"
                          ? "#B91C1C"
                          : "#475569",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.status === "disetujui"
                      ? "Disetujui"
                      : d.status === "diajukan"
                      ? "Menunggu Verval"
                      : d.status === "perlu_perbaikan"
                      ? "Perlu Perbaikan"
                      : "Draf"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom 2: Jadwal Pemutakhiran Data */}
        <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="calendar" size={15} style={{ color: "#D97706" }} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>Jadwal Pemutakhiran Terdekat</span>
            </div>
            <span style={{ fontSize: 11, color: T.textMuted }}>Target Pembaruan</span>
          </div>

          {jadwalMendekati.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textMuted, padding: "16px 0", textAlign: "center" }}>
              Tidak ada tenggat jadwal pemutakhiran khusus dalam waktu dekat.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {jadwalMendekati.map((jm) => (
                <div
                  key={jm.id}
                  style={{
                    background: T.bgAlt,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {jm.nama}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.textMuted }}>
                      Frekuensi: {jm.frekuensi || "Tahunan"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#D97706" }}>
                      {jm.jadwal_pemutakhiran || jm.jadwal_pemutakhiran_akhir || "Sesuai Jadwal"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 4. Main Component: Dashboard (Adaptive Role-Based) ──────────────────────
export default function Dashboard({ user = null, docs = [], onNav, onView, sectors = [], categories = [] }) {
  const { isMobile } = useResponsive();
  const { T } = useContext(ThemeContext);

  const role = user?.role || "Admin";
  const baseLevel = user?.base_level || (role === "Walidata" ? "Admin" : (role === "Produsen Data" ? "Operator Bank Data" : role));
  const isProdusen = role === "Operator Bank Data" || role === "Produsen Data" || baseLevel === "Operator Bank Data";
  const isAdmin = role === "Admin" || role === "Walidata" || baseLevel === "Admin";
  const isReviewer = role === "Reviewer" || baseLevel === "Reviewer";
  const isStaf = role === "Staf" || baseLevel === "Staf";
  const userName = user?.name || user?.nama || "Pengguna";
  const opdNama = user?.opd_nama || "";
  const opdId = user?.opd_id || null;
  const bidang = user?.bidang || "";

  // 1. Data Walidata (Leaderboard OPD & Antrean Verval)
  const { data: walidataData } = useQuery({
    queryKey: ["dashboard-walidata"],
    queryFn: () => fetch("/api/dashboard/walidata", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : {})),
    refetchInterval: 30000,
  });

  // 2. Data Master Satu Data (Target SK Daftar Data)
  const { data: masterData } = useQuery({
    queryKey: ["satudata-master-ringkasan"],
    queryFn: () => fetch("/api/satudata/master/ringkasan", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : {})),
    refetchInterval: 30000,
  });

  // 3. Data Khusus Produsen Data (Jika Role Operator Bank Data / Produsen Data)
  const { data: produsenData } = useQuery({
    queryKey: ["dashboard-produsen", opdId],
    queryFn: () => fetch("/api/dashboard/produsen", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : {})),
    enabled: !!opdId,
    refetchInterval: 30000,
  });

  // 4. Data SPM (Capaian Standar Pelayanan Minimal)
  const { data: spmData } = useQuery({
    queryKey: ["dashboard-spm"],
    queryFn: () => fetch("/api/spm", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : {})),
    refetchInterval: 60000,
  });

  // Metrik dokumen global
  const archived = docs.filter((d) => d.status === "Diarsipkan").length;
  const pending = docs.filter((d) => d.status !== "Diarsipkan" && d.status !== "Ditolak").length;
  const rejected = docs.filter((d) => d.status === "Ditolak").length;

  // Metrik dokumen Staf (berdasarkan bidang)
  const docsBidang = useMemo(() => {
    if (!bidang) return docs;
    return docs.filter((d) => d.bidang === bidang || d.uploader === userName);
  }, [docs, bidang, userName]);

  const archivedBidang = docsBidang.filter((d) => d.status === "Diarsipkan").length;
  const pendingBidang = docsBidang.filter((d) => d.status !== "Diarsipkan" && d.status !== "Ditolak").length;
  const rejectedBidang = docsBidang.filter((d) => d.status === "Ditolak").length;

  // Metrik dataset OPD Operator
  const opdDatasets = produsenData?.datasets || (masterData?.datasets || []).filter((d) => Number(d.opd_id) === Number(opdId));
  const opdDisetujui = opdDatasets.filter((d) => d.status === "disetujui").length;
  const opdMenunggu = opdDatasets.filter((d) => d.status === "diajukan").length;
  const opdDraft = opdDatasets.filter((d) => d.status === "draft" || d.status === "perlu_perbaikan").length;

  // SPM Rata-rata
  const spmAverage = useMemo(() => {
    const list = spmData?.capaian || [];
    if (!list.length) return "84.5%";
    const valid = list.map((c) => Number(c.realisasi_persen)).filter((v) => Number.isFinite(v) && v > 0);
    if (!valid.length) return "84.5%";
    const sum = valid.reduce((a, b) => a + b, 0);
    return `${(sum / valid.length).toFixed(1)}%`;
  }, [spmData]);

  // Ucapan salam berdasarkan waktu
  const salamWaktu = useMemo(() => {
    const jam = new Date().getHours();
    if (jam >= 4 && jam < 11) return "Selamat Pagi";
    if (jam >= 11 && jam < 15) return "Selamat Siang";
    if (jam >= 15 && jam < 18) return "Selamat Sore";
    return "Selamat Malam";
  }, []);

  // Filter dokumen terbaru (staf bisa beralih antara Bidang Saya & Semua)
  const [filterDokumenStaf, setFilterDokumenStaf] = useState("bidang");
  const recentDocs = useMemo(() => {
    const source = (isStaf && filterDokumenStaf === "bidang") ? docsBidang : docs;
    return [...source].sort((a, b) => b.id - a.id).slice(0, 5);
  }, [docs, docsBidang, isStaf, filterDokumenStaf]);

  // Kartu KPI yang disesuaikan dengan Role Pengguna
  const cardsKpi = useMemo(() => {
    if (isProdusen) {
      return [
        { label: `Dataset ${opdNama || "OPD Saya"}`, value: opdDatasets.length, color: "#2563EB", icon: "database", hint: "Total statistik sektoral" },
        { label: "Dataset Disetujui (Publik)", value: opdDisetujui, color: "#16A34A", icon: "check", hint: "Telah tayang di Portal Publik" },
        { label: "Menunggu Verval Walidata", value: opdMenunggu, color: "#f57f17", icon: "clock", hint: "Sedang ditelaah Walidata" },
        { label: "Draf / Perlu Revisi", value: opdDraft, color: "#DC2626", icon: "edit", hint: "Butuh tindak lanjut OPD" },
      ];
    }

    if (isReviewer) {
      const antrianCount = walidataData?.antrian_verifikasi?.length || 0;
      const reopenCount = walidataData?.reopen_menunggu?.length || 0;
      return [
        { label: "Dataset Menunggu Verval", value: antrianCount, color: "#f57f17", icon: "database", hint: "Perlu diverifikasi" },
        { label: "Permintaan Buka Kunci", value: reopenCount, color: "#7C3AED", icon: "lock", hint: "Pengajuan reopen OPD" },
        { label: "Dokumen Menunggu Telaah", value: pending, color: "#2563EB", icon: "bell", hint: "Arsip perlu review" },
        { label: "Dokumen Diarsipkan", value: archived, color: "#16A34A", icon: "archive", hint: "Telah sah diverifikasi" },
      ];
    }

    if (isStaf) {
      return [
        { label: `Dokumen Bidang ${bidang || "Saya"}`, value: docsBidang.length, color: "#2563EB", icon: "archive", hint: `Total dokumen ${bidang || "staf"}` },
        { label: "Telah Diarsipkan", value: archivedBidang, color: "#16A34A", icon: "check", hint: "Selesai ditelaah" },
        { label: "Menunggu Proses Review", value: pendingBidang, color: "#f57f17", icon: "clock", hint: "Dalam proses review" },
        { label: "Perlu Revisi / Ditolak", value: rejectedBidang, color: "#DC2626", icon: "x", hint: "Harus diperbaiki staf" },
      ];
    }

    // Default: Admin & Walidata (Pengelola Sistem)
    const antrianCount = walidataData?.antrian_verifikasi?.length || 0;
    const totalDatasets = walidataData?.statistik_status?.reduce((acc, c) => acc + Number(c.count), 0) || (masterData?.datasets?.length || 0);

    return [
      { label: "Total Dokumen Arsip", value: docs.length, color: "#2563EB", icon: "archive", hint: `${archived} diarsipkan` },
      { label: "Dataset Terbit (Satu Data)", value: totalDatasets, color: "#16A34A", icon: "database", hint: "Statistik sektoral" },
      { label: "Antrean Verval Dataset", value: antrianCount, color: "#f57f17", icon: "bell", hint: "Perlu diverifikasi" },
      { label: "Rata-rata Capaian SPM", value: spmAverage, color: "#7C3AED", icon: "chart", hint: "Standar pelayanan minimal" },
    ];
  }, [
    isProdusen, isReviewer, isStaf, opdNama, opdDatasets.length, opdDisetujui, opdMenunggu, opdDraft,
    walidataData, pending, archived, docs.length, spmAverage, bidang,
    docsBidang.length, archivedBidang, pendingBidang, rejectedBidang, masterData?.datasets?.length,
  ]);

  const roleStyle = ROLE_COLOR[role] || ROLE_COLOR.Admin;

  return (
    <div>
      {/* ── 1. Welcome & Role Identity Banner ─────────────────────────────── */}
      <div
        style={{
          background: T.card,
          borderRadius: 14,
          padding: isMobile ? "16px 14px" : "18px 22px",
          border: `1px solid ${T.border}`,
          marginBottom: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        {/* Baris Atas: Informasi Pengguna & Role */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            paddingBottom: isMobile ? 12 : 14,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          {/* Avatar Bulat dengan Inisial */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: roleStyle.bg,
              color: roleStyle.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
              flexShrink: 0,
              border: `1px solid ${roleStyle.text}25`,
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16.5, fontWeight: 700, color: T.text }}>
                {salamWaktu}, {userName}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: roleStyle.bg,
                  color: roleStyle.text,
                }}
              >
                {role}
              </span>
              {opdNama && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: T.bgAlt,
                    color: T.textSecondary,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Icon name="building" size={13} /> {opdNama}
                </span>
              )}
              {bidang && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: T.bgAlt,
                    color: T.textSecondary,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Icon name="folder" size={13} /> Bidang {bidang}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: T.textMuted, marginTop: 3 }}>
              {role === "Admin" && "Panel Pengendali Walidata & Administrator Arsip Digital Satu Data Kabupaten Sumba Barat."}
              {role === "Walidata" && "Pusat Koordinasi Satu Data & Verifikasi Dataset Statistik Sektoral Kabupaten Sumba Barat."}
              {role === "Reviewer" && "Pusat Verifikasi Dokumen Perencanaan Pembangunan & Validasi Dataset Statistik Sektoral."}
              {isStaf && `Penyusunan Kertas Kerja dan Pengelolaan Dokumen Perencanaan Bidang ${bidang || "Bapperida"}.`}
              {isProdusen && `Produsen Data Sektoral Perangkat Daerah: ${opdNama || "Kabupaten Sumba Barat"}. Mengelola pemutakhiran dataset sektoral dan capaian indikator daerah.`}
            </div>
          </div>
        </div>

        {/* Baris Bawah: Shortcut Tombol Aksi Cepat Sesuai Role (Lebar Penuh) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 12,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: T.textSecondary, flexShrink: 0 }}>
            <Icon name="zap" size={14} style={{ color: T.primary }} />
            <span>Aksi Cepat</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              flex: 1,
              justifyContent: isMobile ? "flex-start" : "flex-end",
            }}
          >
            {isProdusen ? (
              <>
                <Button size="sm" variant="primary" icon="database" onClick={() => onNav("bankdata")}>
                  Kelola Dataset OPD
                </Button>
                <Button size="sm" variant="secondary" icon="shield" onClick={() => onNav("spm")}>
                  Capaian SPM
                </Button>
                <Button size="sm" variant="secondary" icon="world" onClick={() => onNav("publik")}>
                  Portal Publik
                </Button>
                <Button size="sm" variant="secondary" icon="users" onClick={() => onNav("akun")}>
                  Akun Saya
                </Button>
              </>
            ) : isReviewer ? (
              <>
                <Button size="sm" variant="primary" icon="database" onClick={() => onNav("bankdata")}>
                  Verval Dataset
                </Button>
                <Button size="sm" variant="secondary" icon="archive" onClick={() => onNav("dokumen")}>
                  Telaah Dokumen
                </Button>
                <Button size="sm" variant="secondary" icon="checkCircle" onClick={() => onNav("kertas-kerja")}>
                  Kertas Kerja
                </Button>
                <Button size="sm" variant="secondary" icon="filter" onClick={() => onNav("screening")}>
                  Screening RKA
                </Button>
              </>
            ) : isStaf ? (
              <>
                <Button size="sm" variant="primary" icon="upload" onClick={() => onNav("upload")}>
                  Unggah Dokumen
                </Button>
                <Button size="sm" variant="secondary" icon="checkCircle" onClick={() => onNav("kertas-kerja")}>
                  Kertas Kerja
                </Button>
                <Button size="sm" variant="secondary" icon="search" onClick={() => onNav("pencarian")}>
                  Cari Dokumen
                </Button>
                <Button size="sm" variant="secondary" icon="chart" onClick={() => onNav("bankdata")}>
                  Bank Data
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="primary" icon="database" onClick={() => onNav("bankdata")}>
                  Verval Bank Data
                </Button>
                <Button size="sm" variant="secondary" icon="upload" onClick={() => onNav("upload")}>
                  Unggah Dokumen
                </Button>
                <Button size="sm" variant="secondary" icon="building" onClick={() => onNav("master-satudata")}>
                  Master Data
                </Button>
                <Button size="sm" variant="secondary" icon="chart" onClick={() => onNav("monitoring")}>
                  Monitoring
                </Button>
                <Button size="sm" variant="secondary" icon="world" onClick={() => onNav("publik")}>
                  Portal Publik
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Kartu Metrik KPI Berbasis Role ─────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
          gap: isMobile ? 8 : 12,
          marginBottom: 24,
        }}
      >
        {cardsKpi.map((s, i) => (
          <div
            key={i}
            style={{
              background: T.card,
              borderRadius: 12,
              padding: 16,
              border: `1px solid ${T.border}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 11.5, color: T.textSecondary, fontWeight: 500, lineHeight: 1.3 }}>
                {s.label}
              </div>
              <div
                style={{
                  width: 30,
                  height: 30,
                  background: `${s.color}15`,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={s.icon} size={15} style={{ color: s.color }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: -0.5 }}>
                {s.value}
              </div>
              {s.hint && (
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{s.hint}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. Antrean Verifikasi & Tindak Lanjut (Reviewer & Admin) ───────── */}
      {(isReviewer || isAdmin) && (
        <AntreanTugasReviewer
          walidataData={walidataData}
          docs={docs}
          onNav={onNav}
          onView={onView}
          T={T}
          isMobile={isMobile}
        />
      )}

      {/* ── 3.b Widget Antrean & Status Khusus Produsen Data (OPD) ────────── */}
      {isProdusen && (
        <WidgetProdusenData
          produsenData={produsenData}
          opdNama={opdNama}
          onNav={onNav}
          T={T}
          isMobile={isMobile}
        />
      )}

      {/* ── 4. LEADERBOARD PERINGKAT KETERISIAN & TARGET SK PER OPD ────────── */}
      <LeaderboardOpdWidget
        walidataData={walidataData}
        masterData={masterData}
        user={user}
        T={T}
        isMobile={isMobile}
        onNav={onNav}
      />

      {/* ── 5. Kertas Kerja Perencanaan (Hanya Internal Bapperida) ────────── */}
      {!isProdusen && (
        <InfoKertasKerja T={T} onNav={onNav} />
      )}

      {/* ── 6. Katalog Bank Data Interaktif ───────────────────────────────── */}
      <BankDataDashboard />

      {/* ── 7. Daftar Dataset Sektoral OPD (Produsen) atau Dokumen Terbaru (Staf/Admin) ── */}
      {isProdusen ? (
        <div style={{ background: T.card, borderRadius: 14, padding: isMobile ? 16 : 20, border: `1px solid ${T.border}`, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                Daftar Dataset Sektoral {opdNama || "OPD Saya"}
              </div>
              <span style={{ fontSize: 11, background: T.bgAlt, color: T.textMuted, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>
                {opdDatasets.length} Dataset
              </span>
            </div>
            <button
              onClick={() => onNav("bankdata")}
              style={{ fontSize: 12, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Kelola di Bank Data →
            </button>
          </div>

          {opdDatasets.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontSize: 12.5 }}>
              Belum ada dataset yang terdaftar untuk {opdNama || "OPD Anda"}. Klik tombol <b>Kelola Dataset OPD</b> untuk mulai membuat dataset baru.
            </div>
          ) : (
            opdDatasets.slice(0, 6).map((d, i) => (
              <div
                key={d.id || i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < Math.min(opdDatasets.length, 6) - 1 ? `1px solid ${T.border}` : "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: T.primaryLight,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="database" size={16} style={{ color: T.primary }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.nama}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {d.baris_count || 0} Baris Data · Frekuensi: {d.frekuensi || "Tahunan"} · {d.status === "disetujui" ? "Publik (Terverifikasi)" : d.status === "diajukan" ? "Menunggu Verifikasi Walidata" : d.status === "perlu_perbaikan" ? "Perlu Revisi" : "Draf"}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontWeight: 700,
                    background:
                      d.status === "disetujui"
                        ? "#DCFCE7"
                        : d.status === "diajukan"
                        ? "#FEF3C7"
                        : d.status === "perlu_perbaikan"
                        ? "#FEE2E2"
                        : "#F1F5F9",
                    color:
                      d.status === "disetujui"
                        ? "#15803D"
                        : d.status === "diajukan"
                        ? "#B45309"
                        : d.status === "perlu_perbaikan"
                        ? "#B91C1C"
                        : "#475569",
                  }}
                >
                  {d.status === "disetujui"
                    ? "Disetujui"
                    : d.status === "diajukan"
                    ? "Diajukan"
                    : d.status === "perlu_perbaikan"
                    ? "Perlu Perbaikan"
                    : "Draf"}
                </span>
                <button
                  onClick={() => onNav("bankdata")}
                  style={{ fontSize: 11, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  Buka →
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ background: T.card, borderRadius: 14, padding: isMobile ? 16 : 20, border: `1px solid ${T.border}`, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                {isStaf && filterDokumenStaf === "bidang" ? `Dokumen Terbaru Bidang ${bidang || "Saya"}` : "Dokumen Perencanaan Terbaru"}
              </div>
              {isStaf && bidang && (
                <div style={{ display: "flex", gap: 4, background: T.bgAlt, padding: 2, borderRadius: 6 }}>
                  <button
                    onClick={() => setFilterDokumenStaf("bidang")}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 5,
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      background: filterDokumenStaf === "bidang" ? T.card : "transparent",
                      color: filterDokumenStaf === "bidang" ? T.primary : T.textSecondary,
                    }}
                  >
                    Bidang Saya
                  </button>
                  <button
                    onClick={() => setFilterDokumenStaf("semua")}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 5,
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      background: filterDokumenStaf === "semua" ? T.card : "transparent",
                      color: filterDokumenStaf === "semua" ? T.primary : T.textSecondary,
                    }}
                  >
                    Semua
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => onNav("dokumen")}
              style={{ fontSize: 12, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Lihat semua →
            </button>
          </div>

          {recentDocs.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: T.textMuted, fontSize: 12.5 }}>
              Belum ada arsip dokumen yang tersedia.
            </div>
          ) : (
            recentDocs.map((d, i) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < recentDocs.length - 1 ? `1px solid ${T.border}` : "none",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: T.primaryLight,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="file" size={16} style={{ color: T.primary }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {d.type} · {d.year} · {d.uploader} {d.bidang ? `(Bidang ${d.bidang})` : ""}
                  </div>
                </div>
                <Badge label={d.status} colors={STATUS_COLOR[d.status]} />
                <button
                  onClick={() => onView && onView(d)}
                  style={{ fontSize: 11, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  Lihat →
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
