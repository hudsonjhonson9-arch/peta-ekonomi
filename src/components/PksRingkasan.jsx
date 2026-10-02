import { Icon } from "./ui.jsx";
import { sisaHari } from "../data.js";

// Ringkasan angka dan daftar deadline dipakai di dua tempat: halaman Kertas
// Kerja dan Dashboard. Dipisah ke sini supaya tidak ada dua implementasi yang
// bisa berbeda tampilan atau-hitungan.

// COUNT dari Postgres datang sebagai string, jadi selalu lewat Number().
export function PksRingkasan({ T, r, tahun, isLoading, marginBottom = 16 }) {
  const wajib       = Number(r?.wajib || 0);
  const terisi      = Number(r?.terisi || 0);
  const terlambat   = Number(r?.terlambat || 0);
  const mauDeadline = Number(r?.mauDeadline || 0);
  const persen      = wajib ? Math.round((terisi / wajib) * 100) : 0;

  const kartu = [
    { label: "Output", nilai: Number(r?.output || 0), warna: T.text, ikon: "file" },
    { label: "Sub kegiatan", nilai: Number(r?.subkegiatan || 0), warna: T.text, ikon: "layers" },
    { label: "Terlambat", nilai: terlambat, warna: "#DC2626", ikon: "alert" },
    { label: "Jatuh tempo ≤3 hari", nilai: mauDeadline, warna: "#EA580C", ikon: "clock" },
  ];

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: T.textSecondary }}>
            Kelengkapan periode wajib {tahun ?? "—"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginTop: 2 }}>
            {terisi} <span style={{ fontSize: 13, fontWeight: 500, color: T.textMuted }}>/ {wajib} terisi ({persen}%)</span>
          </div>
        </div>
        {isLoading && <span style={{ fontSize: 11.5, color: T.textMuted }}>memuat…</span>}
      </div>

      <div style={{ height: 7, background: T.surfaceHover, borderRadius: 999, margin: "10px 0 14px", overflow: "hidden" }}>
        <div style={{ width: `${persen}%`, height: "100%", background: persen >= 100 ? "#16A34A" : T.primary, borderRadius: 999, transition: "width .3s" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
        {kartu.map(k => (
          <div key={k.label} style={{ border: `1px solid ${T.border}`, borderRadius: 9, padding: "9px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Icon name={k.ikon} size={12} style={{ color: k.warna === T.text ? T.textMuted : k.warna }} />
              <span style={{ fontSize: 10.5, color: T.textMuted }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: k.warna, marginTop: 2 }}>{k.nilai}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Deadline wajib yang belum terisi dokumen dalam 14 hari ke depan.
export function DeadlineList({ T, deadline = [], max = 6, marginBottom = 16 }) {
  if (!deadline.length) return null;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, marginBottom }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Icon name="clock" size={14} style={{ color: "#EA580C" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Deadline 14 hari ke depan</span>
        <span style={{ fontSize: 11, color: T.textMuted }}>({deadline.length})</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {deadline.slice(0, max).map(d => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ fontFamily: "ui-monospace, monospace", color: T.textMuted, fontSize: 11, flexShrink: 0 }}>{d.sub_kode}</span>
            <span style={{ color: T.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.output}</span>
            <span style={{ color: T.textSecondary, fontSize: 11, flexShrink: 0 }}>{d.periode_label}</span>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, flexShrink: 0,
              color: d.lewat ? "#DC2626" : "#EA580C",
              background: d.lewat ? "#FEF2F2" : "#FFF7ED",
            }}>
              {d.lewat ? `lewat ${Math.abs(sisaHari(d.deadline))} hari` : `${sisaHari(d.deadline)} hari lagi`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
