// Kit gaya bersama. Warna diturunkan dari tema aplikasi (theme.js) lewat CSS variable.
// Gaya sengaja datar: garis tipis sebagai pemisah, tanpa bayangan kartu, tanpa ikon hias.

export function kitVars(T, isDark) {
  const card = T.cardBg || T.card;
  return {
    "--pk-font": T.font,
    "--pk-bg": T.bg,
    "--pk-card": card,
    "--pk-text": T.text,
    "--pk-text2": T.textSecondary,
    "--pk-muted": T.textMuted,
    "--pk-border": T.border,
    "--pk-border-strong": T.borderHover || T.border,
    "--pk-primary": T.primary,
    "--pk-primary-hover": T.primaryHover || T.primary,
    "--pk-primary-soft": isDark ? "rgba(59,130,246,.16)" : T.primaryLight || "#EFF6FF",
    "--pk-ring": T.primaryRing || "rgba(37,99,235,.16)",
    "--pk-sunken": isDark ? "rgba(255,255,255,.04)" : "#F8FAFC",
    "--pk-input": T.inputBg || card,
    "--pk-ok": isDark ? "#34D399" : "#047857",
    "--pk-ok-solid": isDark ? "#10B981" : "#059669",
    "--pk-ok-soft": isDark ? "rgba(16,185,129,.14)" : "#ECFDF5",
    "--pk-ok-line": isDark ? "rgba(16,185,129,.35)" : "#A7F3D0",
    "--pk-warn": isDark ? "#FBBF24" : "#B45309",
    "--pk-warn-soft": isDark ? "rgba(251,191,36,.12)" : "#FFFBEB",
    "--pk-warn-line": isDark ? "rgba(251,191,36,.35)" : "#FDE68A",
    "--pk-danger": isDark ? "#F87171" : "#B91C1C",
    "--pk-danger-soft": isDark ? "rgba(248,113,113,.12)" : "#FEF2F2",
    "--pk-danger-line": isDark ? "rgba(248,113,113,.35)" : "#FECACA",
    "--pk-shadow": "none",
    "--pk-shadow-lg": T.shadowLg || "0 8px 24px rgba(15,23,42,.08)",
  };
}

const CSS = `
.pk{font-family:var(--pk-font);color:var(--pk-text);-webkit-font-smoothing:antialiased;font-size:14px}
.pk *,.pk *::before,.pk *::after{box-sizing:border-box}
.pk-page{max-width:1120px;margin:0 auto;padding:32px 24px 72px}
.pk-card{background:var(--pk-card);border:1px solid var(--pk-border);border-radius:10px}
.pk-h1{font-size:22px;font-weight:700;letter-spacing:-.015em;line-height:1.25;margin:0}
.pk-h2{font-size:14px;font-weight:600;line-height:1.4;margin:0}
.pk-sub{font-size:13px;color:var(--pk-text2);line-height:1.55;margin:4px 0 0}
.pk-muted{color:var(--pk-muted)}
.pk-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}

/* Baris pengaturan: judul di kiri, isian di kanan, dipisah garis tipis */
.pk-rows>.pk-row:first-child{border-top:none;padding-top:4px}
.pk-row{display:grid;grid-template-columns:240px minmax(0,1fr);gap:48px;padding:28px 0;border-top:1px solid var(--pk-border)}
.pk-row.stack{grid-template-columns:minmax(0,1fr);gap:16px}
.pk-row-t{font-size:14px;font-weight:600;line-height:1.4}
.pk-row-d{font-size:13px;color:var(--pk-text2);line-height:1.55;margin-top:4px}
.pk-max{max-width:440px}
.pk-kv>div{display:grid;grid-template-columns:200px minmax(0,1fr);gap:16px;padding:10px 0;border-bottom:1px solid var(--pk-border);font-size:13.5px}
.pk-kv>div:first-child{padding-top:0}
.pk-kv>div:last-child{border-bottom:none;padding-bottom:0}
.pk-kv dt{color:var(--pk-muted)}
.pk-kv dd{margin:0;font-weight:500;word-break:break-word}

.pk-label{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:13px;font-weight:500;margin-bottom:6px}
.pk-label small{font-size:12px;font-weight:400;color:var(--pk-muted)}
.pk-hint{font-size:12px;color:var(--pk-muted);margin-top:6px;line-height:1.5}
.pk-input{width:100%;height:38px;padding:0 12px;border:1px solid var(--pk-border-strong);border-radius:8px;background:var(--pk-input);color:var(--pk-text);font:inherit;font-size:14px;outline:none;transition:border-color .12s,box-shadow .12s}
textarea.pk-input{height:auto;padding:9px 12px;line-height:1.55;resize:vertical}
select.pk-input{cursor:pointer}
.pk-input::placeholder{color:var(--pk-muted)}
.pk-input:focus{border-color:var(--pk-primary);box-shadow:0 0 0 3px var(--pk-ring)}
.pk-input[aria-invalid="true"]{border-color:var(--pk-danger)}
.pk-input.is-ok{border-color:var(--pk-ok-solid)}
.pk-wrap{position:relative}
.pk-wrap .pk-lead{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--pk-muted);display:flex;pointer-events:none}
.pk-wrap .pk-input.has-lead{padding-left:36px}
.pk-wrap .pk-input.has-trail{padding-right:42px}
.pk-wrap .pk-trail{position:absolute;right:3px;top:50%;transform:translateY(-50%)}

.pk-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:8px;border:1px solid transparent;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;text-decoration:none}
.pk-btn:disabled{opacity:.5;cursor:not-allowed}
.pk-btn-sm{height:30px;padding:0 11px;font-size:12.5px;border-radius:7px}
.pk-btn-lg{height:42px;padding:0 20px;font-size:14px}
.pk-btn-primary{background:var(--pk-primary);color:#fff}
.pk-btn-primary:hover:not(:disabled){background:var(--pk-primary-hover)}
.pk-btn-ok{background:var(--pk-ok-solid);color:#fff}
.pk-btn-ghost{background:transparent;border-color:var(--pk-border-strong);color:var(--pk-text)}
.pk-btn-ghost:hover:not(:disabled){background:var(--pk-sunken)}
.pk-btn-quiet{background:transparent;color:var(--pk-primary);padding:0 8px}
.pk-btn-quiet:hover:not(:disabled){background:var(--pk-primary-soft)}
.pk-link{background:none;border:none;padding:0;font:inherit;color:var(--pk-primary);cursor:pointer}
.pk-link:hover{text-decoration:underline}
.pk-icon-btn{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:7px;background:transparent;color:var(--pk-muted);cursor:pointer}
.pk-icon-btn:hover{background:var(--pk-sunken);color:var(--pk-text)}

.pk-pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:99px;font-size:11.5px;font-weight:600;background:var(--pk-sunken);color:var(--pk-text2);border:1px solid var(--pk-border);white-space:nowrap}
.pk-pill.ok{background:var(--pk-ok-soft);color:var(--pk-ok);border-color:var(--pk-ok-line)}
.pk-pill.warn{background:var(--pk-warn-soft);color:var(--pk-warn);border-color:var(--pk-warn-line)}
.pk-pill.danger{background:var(--pk-danger-soft);color:var(--pk-danger);border-color:var(--pk-danger-line)}
.pk-pill.info{background:var(--pk-primary-soft);color:var(--pk-primary);border-color:transparent}
.pk-dot{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block;flex-shrink:0}
.pk-status{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--pk-text2)}
.pk-status.ok .pk-dot{color:var(--pk-ok-solid)}
.pk-status.warn .pk-dot{color:#F59E0B}

.pk-tabs{display:flex;gap:24px;border-bottom:1px solid var(--pk-border);overflow-x:auto;scrollbar-width:none;margin:24px 0 8px}
.pk-tabs::-webkit-scrollbar{display:none}
.pk-tab{padding:10px 0;margin-bottom:-1px;background:none;border:none;border-bottom:2px solid transparent;color:var(--pk-text2);font:inherit;font-size:13.5px;font-weight:500;cursor:pointer;white-space:nowrap}
.pk-tab:hover{color:var(--pk-text)}
.pk-tab[aria-selected="true"]{color:var(--pk-text);font-weight:600;border-bottom-color:var(--pk-primary)}

.pk-note{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:6px;border-left:3px solid;font-size:13.5px;line-height:1.5;margin:16px 0 4px;background:var(--pk-sunken)}
.pk-note.ok{border-color:var(--pk-ok-solid)}
.pk-note.err{border-color:var(--pk-danger);background:var(--pk-danger-soft)}
.pk-note span{flex:1}

.pk-grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.pk-stack{display:flex;flex-direction:column;gap:16px}
.pk-span2{grid-column:1/-1}

.pk-bar{height:4px;border-radius:99px;background:var(--pk-border);overflow:hidden}
.pk-bar>i{display:block;height:100%;border-radius:99px;transition:width .4s ease}
.pk-segs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.pk-segs>i{height:4px;border-radius:99px;background:var(--pk-border);transition:background .2s}

.pk-switch{width:38px;height:22px;border-radius:99px;border:none;background:var(--pk-border-strong);position:relative;cursor:pointer;flex-shrink:0;transition:background .15s}
.pk-switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
.pk-switch[aria-checked="true"]{background:var(--pk-primary)}
.pk-switch[aria-checked="true"]::after{transform:translateX(16px)}

.pk-crit{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:10px;font-size:12.5px;color:var(--pk-muted)}
.pk-crit .on{color:var(--pk-ok)}

.pk-table{width:100%;border-collapse:collapse;font-size:13px}
.pk-table th{text-align:left;font-size:12px;font-weight:500;color:var(--pk-muted);padding:8px 12px 8px 0;border-bottom:1px solid var(--pk-border-strong);white-space:nowrap}
.pk-table td{padding:12px 12px 12px 0;border-bottom:1px solid var(--pk-border);vertical-align:middle}
.pk-table tbody tr:last-child td{border-bottom:none}
.pk-scroll{overflow-x:auto}
.pk-empty{padding:48px 0;color:var(--pk-muted);font-size:13.5px}
.pk-empty b{display:block;color:var(--pk-text);font-size:14px;margin-bottom:4px}

/* Kerangka pengaturan: navigasi vertikal, isi, pratinjau */
.pk-shell{display:grid;grid-template-columns:180px minmax(0,1fr) 300px;gap:44px;align-items:start;margin-top:28px}
.pk-shell.no-aside{grid-template-columns:180px minmax(0,1fr)}
.pk-vnav{position:sticky;top:16px;display:flex;flex-direction:column;gap:2px}
.pk-vnav button{display:flex;justify-content:space-between;align-items:center;text-align:left;padding:8px 12px;border:none;border-radius:7px;background:transparent;color:var(--pk-text2);font:inherit;font-size:13.5px;font-weight:500;cursor:pointer}
.pk-vnav button:hover{background:var(--pk-sunken);color:var(--pk-text)}
.pk-vnav button[aria-selected="true"]{background:var(--pk-primary-soft);color:var(--pk-primary);font-weight:600}
.pk-vnav small{font-size:11.5px;color:var(--pk-muted)}

.pk :focus-visible{outline:2px solid var(--pk-primary);outline-offset:2px}
@media (max-width:1100px){
  .pk-shell,.pk-shell.no-aside{grid-template-columns:minmax(0,1fr);gap:20px}
  .pk-vnav{position:static;flex-direction:row;overflow-x:auto;border-bottom:1px solid var(--pk-border);gap:4px;padding-bottom:6px}
  .pk-vnav button{white-space:nowrap}
}
@media (max-width:760px){
  .pk-page{padding:20px 14px 48px}
  .pk-row{grid-template-columns:minmax(0,1fr);gap:14px;padding:22px 0}
  .pk-grid2{grid-template-columns:1fr}
  .pk-kv>div{grid-template-columns:1fr;gap:2px}
  .pk-hide-sm{display:none!important}
}
@media (prefers-reduced-motion:reduce){.pk *{transition:none!important;animation:none!important}}
`;

export function PageKitStyle() {
  return <style>{CSS}</style>;
}
