import { Icon } from "./ui.jsx";
import { PageKitStyle } from "./pageKit.jsx";

const CSS = `
.pp-top{position:sticky;top:0;z-index:100;background:var(--pp-glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--pk-border)}
.pp-row{max-width:1240px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.pp-brandrow{height:64px}
.pp-brand{display:flex;align-items:center;gap:12px;background:none;border:none;padding:0;cursor:pointer;font:inherit;color:inherit;text-align:left}
.pp-logo{width:40px;height:40px;border-radius:10px;border:1px solid var(--pk-border);background:var(--pk-card);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pp-brand-name{font-size:16px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
.pp-brand-name b{color:var(--pk-primary)}
.pp-brand-sub{font-size:11px;color:var(--pk-muted);font-weight:500;margin-top:1px}
.pp-nav{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none}
.pp-nav::-webkit-scrollbar{display:none}
.pp-link{display:inline-flex;align-items:center;gap:7px;padding:11px 13px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;color:var(--pk-text2);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.pp-link:hover{color:var(--pk-text)}
.pp-link[aria-current="page"]{color:var(--pk-primary);border-bottom-color:var(--pk-primary)}
.pp-user{display:inline-flex;align-items:center;gap:8px;padding:3px 10px 3px 4px;border-radius:99px;border:1px solid var(--pk-border);background:var(--pk-sunken);font-size:12.5px;font-weight:600}
.pp-avatar{width:26px;height:26px;border-radius:50%;background:var(--pk-primary);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center}

.pp-hero{padding:52px 24px 44px;background:var(--pp-hero);border-bottom:1px solid var(--pk-border)}
.pp-hero-in{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:56px;align-items:center}
.pp-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:5px 13px;border-radius:99px;background:var(--pk-primary-soft);color:var(--pk-primary);font-size:11.5px;font-weight:700;letter-spacing:.04em;margin-bottom:18px}
.pp-eyebrow i{width:7px;height:7px;border-radius:50%;background:currentColor}
.pp-title{font-size:clamp(30px,4.2vw,46px);font-weight:800;letter-spacing:-.03em;line-height:1.1;margin:0 0 16px}
.pp-title em{font-style:normal;color:var(--pk-primary)}
.pp-lead{font-size:15.5px;line-height:1.65;color:var(--pk-text2);margin:0 0 26px;max-width:560px}
.pp-search{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 16px;border-radius:14px;border:1px solid var(--pk-border);background:var(--pk-card);box-shadow:var(--pk-shadow-lg);max-width:600px;transition:border-color .15s,box-shadow .15s}
.pp-search:focus-within{border-color:var(--pk-primary);box-shadow:0 0 0 3px var(--pk-ring),var(--pk-shadow-lg)}
.pp-search input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--pk-text);font:inherit;font-size:14.5px;height:40px}
.pp-chips{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px}
.pp-chips>span{font-size:12px;font-weight:600;color:var(--pk-muted)}
.pp-chip{padding:5px 13px;border-radius:99px;border:1px solid var(--pk-border);background:var(--pk-card);color:var(--pk-text2);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.pp-chip:hover{border-color:var(--pk-primary);color:var(--pk-primary);background:var(--pk-primary-soft)}

.pp-panel{padding:20px;border-radius:18px;background:var(--pk-card);border:1px solid var(--pk-border);box-shadow:var(--pk-shadow-lg)}
.pp-panel-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-size:13px;font-weight:700}
.pp-stats{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pp-stat{padding:16px;border-radius:13px;background:var(--pk-sunken);border:1px solid var(--pk-border)}
.pp-stat-ico{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.pp-stat-num{font-size:30px;font-weight:800;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.pp-stat-lbl{font-size:12px;color:var(--pk-text2);margin-top:6px;line-height:1.35}

.pp-sec{max-width:1240px;margin:0 auto;padding:48px 24px 0}
.pp-anchor{scroll-margin-top:116px}
.pp-sec-h{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px}
.pp-sec-h h2{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0}
.pp-sec-h p{font-size:13.5px;color:var(--pk-text2);margin:5px 0 0}
.pp-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:18px}
.pp-ds{display:flex;flex-direction:column;justify-content:space-between;gap:16px;text-align:left;padding:20px;border-radius:14px;border:1px solid var(--pk-border);background:var(--pk-card);box-shadow:var(--pk-shadow);color:inherit;font:inherit;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s}
.pp-ds:hover{transform:translateY(-3px);border-color:var(--pk-primary);box-shadow:var(--pk-shadow-lg)}
.pp-ds-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:11.5px;color:var(--pk-muted)}
.pp-ds-title{font-size:15.5px;font-weight:700;line-height:1.4;margin:0 0 8px}
.pp-ds-desc{font-size:12.5px;line-height:1.55;color:var(--pk-text2);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pp-ds-foot{display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid var(--pk-border);font-size:12px;color:var(--pk-muted)}
.pp-ds-foot span{display:inline-flex;align-items:center;gap:5px}
@media (max-width:900px){.pp-hero-in{grid-template-columns:minmax(0,1fr);gap:32px}.pp-hero{padding:36px 16px 32px}}
@media (max-width:640px){.pp-row,.pp-sec{padding-left:14px;padding-right:14px}.pp-cards{grid-template-columns:minmax(0,1fr)}.pp-brand-sub{display:none}.pp-search .pk-btn span{display:none}}
`;

export const PORTAL_MENU = [
  { key: "beranda", label: "Beranda", icon: "home" },
  { key: "dataset", label: "Katalog data", icon: "archive" },
  { key: "jelajah", label: "Jelajah kategori", icon: "layers" },
  { key: "leaderboard", label: "Leaderboard OPD", icon: "award" },
  { key: "peta", label: "Peta wilayah", icon: "world" },
  { key: "bandingkan", label: "Bandingkan", icon: "filter" },
  { key: "visualisasi", label: "Visualisasi", icon: "chart" },
  { key: "berita", label: "Berita", icon: "world" },
  { key: "katalog", label: "Publikasi Dokumen", icon: "file" },
  { key: "tanya-data", label: "Tanya data", icon: "users" },
];

export function portalVars(isDark) {
  return {
    "--pp-glass": isDark ? "rgba(15,23,42,.88)" : "rgba(255,255,255,.9)",
    "--pp-hero": isDark
      ? "linear-gradient(180deg,#0B132B 0%,#0F172A 100%)"
      : "linear-gradient(180deg,#F1F6FF 0%,#F8FAFC 100%)",
  };
}

export function PortalNavbar({ subPage, onNav, user, onLoginClick }) {
  const aktif = subPage === "detail" ? "dataset" : subPage;
  return (
    <header className="pp-top">
      <PageKitStyle />
      <style>{CSS}</style>
      <div className="pp-row pp-brandrow">
        <button type="button" className="pp-brand" onClick={() => onNav("beranda")} aria-label="Ke beranda Satu Data Sumba Barat">
          <span className="pp-logo">
            <img src="/Lambang_Kabupaten_Sumba_Barat.png" alt="" width={30} height={30} style={{ objectFit: "contain" }} />
          </span>
          <span>
            <span className="pp-brand-name" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span>Satu Data <b>Sumba Barat</b></span>
              <span className="pk-pill ok" style={{ height: 18, fontSize: 10, padding: "0 7px" }}>Resmi</span>
            </span>
            <span className="pp-brand-sub" style={{ display: "block" }}>BAPPERIDA · Kabupaten Sumba Barat</span>
          </span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {user && (
            <span className="pp-user">
              <span className="pp-avatar">{(user.nama || user.name || "A").charAt(0).toUpperCase()}</span>
              <span className="pk-hide-sm">{(user.nama || user.name || "Petugas").split(" ")[0]}</span>
              <span className="pk-pill info" style={{ height: 18, fontSize: 10 }}>{user.role}</span>
            </span>
          )}
          {onLoginClick && (
            <button type="button" className="pk-btn pk-btn-primary pk-btn-sm" onClick={onLoginClick}>
              <Icon name={user ? "chevronLeft" : "users"} size={14} />
              {user ? "Panel Admin" : "Login Petugas"}
            </button>
          )}
        </div>
      </div>

      <nav className="pp-row" aria-label="Navigasi portal" style={{ justifyContent: "center" }}>
        <div className="pp-nav" style={{ maxWidth: "100%" }}>
          {PORTAL_MENU.map((m) => (
            <button key={m.key} type="button" className="pp-link" aria-current={aktif === m.key ? "page" : undefined} onClick={() => onNav(m.key)}>
              <Icon name={m.icon} size={14} />
              {m.label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}

const STAT_META = [
  { key: "total_dataset", label: "Dataset sektoral terbuka", icon: "archive", color: "#2563EB", bg: "rgba(37,99,235,.12)" },
  { key: "total_opd", label: "Organisasi / produsen data", icon: "building", color: "#16A34A", bg: "rgba(22,163,74,.12)" },
  { key: "total_urusan", label: "Kategori bidang urusan", icon: "layers", color: "#7C3AED", bg: "rgba(124,58,237,.12)" },
  { key: "total_topik", label: "Topik pembangunan", icon: "tag", color: "#EA580C", bg: "rgba(234,88,12,.12)" },
];

const CHIPS = [
  { label: "Kemiskinan", q: "kemiskinan" },
  { label: "Pertanian dan padi", q: "padi" },
  { label: "Pendidikan", q: "pendidikan" },
  { label: "Kesehatan", q: "kesehatan" },
  { label: "Kecamatan", q: "kecamatan" },
];

export function PortalHero({ searchQ, setSearchQ, onNav, ringkasan }) {
  return (
    <section className="pp-hero">
      <div className="pp-hero-in">
        <div>
          <div className="pp-eyebrow"><i /> PORTAL RESMI SATU DATA · KABUPATEN SUMBA BARAT</div>
          <h1 className="pp-title">Data terpadu untuk perencanaan <em>pembangunan yang lebih baik</em></h1>
          <p className="pp-lead">
            Akses terbuka terhadap data statistik sektoral, indikator kinerja daerah, capaian Standar Pelayanan Minimal (SPM), dan kajian perencanaan pembangunan.
          </p>

          <form className="pp-search" role="search" onSubmit={(e) => { e.preventDefault(); onNav("dataset"); }}>
            <Icon name="search" size={18} style={{ color: "var(--pk-muted)", flexShrink: 0 }} />
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Cari dataset, indikator, urusan, atau perangkat daerah" aria-label="Cari data" />
            {searchQ && (
              <button type="button" className="pk-icon-btn" onClick={() => setSearchQ("")} aria-label="Hapus pencarian"><Icon name="x" size={14} /></button>
            )}
            <button type="submit" className="pk-btn pk-btn-primary"><Icon name="search" size={15} /><span>Cari data</span></button>
          </form>

          <div className="pp-chips">
            <span>Pencarian cepat:</span>
            {CHIPS.map((c) => (
              <button key={c.q} type="button" className="pp-chip" onClick={() => { setSearchQ(c.q); onNav("dataset"); }}>{c.label}</button>
            ))}
          </div>
        </div>

        <div className="pp-panel" aria-label="Ringkasan portal">
          <div className="pp-panel-h">
            <span>Ringkasan Satu Data</span>
            <span className="pk-pill ok"><span className="pk-dot" /> Terbarui otomatis</span>
          </div>
          <div className="pp-stats">
            {STAT_META.map((s) => (
              <div key={s.key} className="pp-stat">
                <div className="pp-stat-ico" style={{ background: s.bg, color: s.color }}><Icon name={s.icon} size={18} /></div>
                <div className="pp-stat-num">{ringkasan?.[s.key] ?? 0}</div>
                <div className="pp-stat-lbl">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SectionHead({ title, desc, actionLabel, onAction }) {
  return (
    <div className="pp-sec-h">
      <div>
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      {onAction && (
        <button type="button" className="pk-btn pk-btn-quiet" onClick={onAction}>
          {actionLabel} <Icon name="arrowRight" size={16} />
        </button>
      )}
    </div>
  );
}

export function DatasetCard({ d, onOpen }) {
  return (
    <button type="button" className="pp-ds" onClick={() => onOpen(d.id)}>
      <div>
        <div className="pp-ds-meta">
          <span className="pk-pill info">{d.opd_singkatan || d.opd_nama}</span>
          {d.satuan && <span>Satuan: {d.satuan}</span>}
          {d.polaritas === "negatif" && (
            <span className="pk-pill danger" style={{ marginLeft: "auto" }}>
              <Icon name="trendingDown" size={11} /> Minimasi
            </span>
          )}
        </div>
        <h3 className="pp-ds-title">{d.nama}</h3>
        {d.deskripsi && <p className="pp-ds-desc">{d.deskripsi}</p>}
      </div>
      <div className="pp-ds-foot">
        <span>{d.frekuensi || "Tahunan"}</span>
        <span><Icon name="eye" size={13} /> {d.view_count || 0} dilihat</span>
      </div>
    </button>
  );
}
