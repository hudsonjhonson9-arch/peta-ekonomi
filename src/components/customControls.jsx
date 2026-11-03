import { useState, useEffect, useContext, useRef, useMemo } from "react";
import { ThemeContext } from "../App.jsx";
import { Icon } from "./ui.jsx";

// ── Custom Dropdown (Select) ─────────────────────────────────────────────────
// Pengganti <select> bawaan di seluruh aplikasi:
// - Mendukung options: [{ value, label, sub, icon }] atau string/number polos,
//   maupun grouped options: [{ group: "Nama Grup", options: [{ value, label }] }]
// - Panel position: "fixed" (tidak pernah terpotong di dalam Modal / tabel overflow)
// - Pencarian otomatis jika jumlah opsi > 7 (atau prop searchable={true/false})
// - Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
// - Mode toolbar filter (default) maupun fullWidth untuk form input.
export function Select({
  value,
  onChange,
  options = [],
  style,
  minWidth = 140,
  label,
  placeholder = "— Pilih —",
  disabled = false,
  error = false,
  fullWidth = false,
  size = "md",
  searchable,
  icon,
}) {
  const { T } = useContext(ThemeContext);
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState("");
  const [sorot, setSorot] = useState(0);
  const [rect, setRect] = useState(null);
  const boxRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const { flatOptions, groups } = useMemo(() => {
    const flat = [];
    const grps = [];
    for (const item of options) {
      if (item && typeof item === "object" && Array.isArray(item.options)) {
        const gOpts = item.options.map(o =>
          o && typeof o === "object"
            ? { value: o.value ?? o.id ?? "", label: String(o.label ?? o.value ?? ""), sub: o.sub, group: item.group }
            : { value: o, label: String(o), group: item.group }
        );
        grps.push({ group: item.group, options: gOpts });
        flat.push(...gOpts);
      } else if (item && typeof item === "object") {
        const norm = { value: item.value ?? item.id ?? "", label: String(item.label ?? item.value ?? ""), sub: item.sub };
        flat.push(norm);
        grps.push({ group: null, options: [norm] });
      } else {
        const norm = { value: item, label: String(item ?? "") };
        flat.push(norm);
        grps.push({ group: null, options: [norm] });
      }
    }
    return { flatOptions: flat, groups: grps };
  }, [options]);

  const bisaCari = searchable !== undefined ? searchable : flatOptions.length > 7;

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return flatOptions;
    return flatOptions.filter(o =>
      o.label.toLowerCase().includes(q) ||
      String(o.value).toLowerCase().includes(q) ||
      (o.sub && o.sub.toLowerCase().includes(q)) ||
      (o.group && o.group.toLowerCase().includes(q))
    );
  }, [flatOptions, cari]);

  useEffect(() => {
    if (!buka) {
      setCari("");
      setRect(null);
      return;
    }
    const idx = tersaring.findIndex(o => String(o.value) === String(value));
    setSorot(idx >= 0 ? idx : 0);

    const hitung = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setRect({ top: r.bottom, bottom: r.top, left: r.left, width: Math.max(r.width, 180) });
    };
    hitung();

    const tutupKlik = e => {
      if (boxRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setBuka(false);
    };
    window.addEventListener("scroll", hitung, true);
    window.addEventListener("resize", hitung);
    document.addEventListener("mousedown", tutupKlik);
    return () => {
      window.removeEventListener("scroll", hitung, true);
      window.removeEventListener("resize", hitung);
      document.removeEventListener("mousedown", tutupKlik);
    };
  }, [buka]);

  useEffect(() => {
    if (buka && bisaCari) {
      setTimeout(() => searchRef.current?.focus(), 10);
    }
  }, [buka, bisaCari]);

  const aktif = flatOptions.find(o => String(o.value) === String(value));
  const tampilLabel = aktif ? aktif.label : (value !== "" && value != null ? String(value) : placeholder);
  const isPlaceholder = !aktif && (value === "" || value == null);

  const pilihOpsi = val => {
    onChange(val);
    setBuka(false);
  };

  const onKeyDown = e => {
    if (disabled) return;
    if (!buka && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setBuka(true);
      return;
    }
    if (!buka) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setBuka(false);
      btnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSorot(s => Math.min(s + 1, Math.max(tersaring.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSorot(s => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (tersaring[sorot]) pilihOpsi(tersaring[sorot].value);
    }
  };

  const pad = size === "sm" ? "6px 10px" : size === "lg" ? "11px 14px" : "8.5px 12px";
  const fSize = size === "sm" ? 12 : size === "lg" ? 13.5 : 13;
  const radius = size === "sm" ? 8 : 10;
  const keAtas = rect ? window.innerHeight - rect.top < 280 && rect.bottom > 280 : false;
  const borderCol = error ? T.danger : buka ? T.primary : (T.inputBorder || T.border);

  return (
    <div
      ref={boxRef}
      style={{
        position: "relative",
        minWidth: fullWidth ? 0 : minWidth,
        width: fullWidth ? "100%" : undefined,
        flex: fullWidth ? "1 1 100%" : "0 1 auto",
        maxWidth: fullWidth ? "none" : 280,
        ...style,
      }}
    >
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={buka}
        aria-label={label || tampilLabel}
        onClick={() => { if (!disabled) setBuka(v => !v); }}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontFamily: T.font || "inherit",
          fontSize: fSize,
          fontWeight: aktif ? 500 : 400,
          padding: pad,
          border: `1.5px solid ${borderCol}`,
          borderRadius: radius,
          background: disabled ? T.surfaceHover : T.inputBg,
          color: isPlaceholder ? T.textMuted : T.text,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          textAlign: "left",
          boxShadow: buka ? T.focusRing : "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
          boxSizing: "border-box",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
          {icon && <Icon name={icon} size={14} style={{ color: T.primary, flexShrink: 0 }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tampilLabel}
          </span>
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 18, height: 18, borderRadius: 5,
          background: buka ? T.primaryLight : "transparent",
          transition: "background 0.15s ease", flexShrink: 0,
        }}>
          <Icon
            name="chevronDown"
            size={12}
            style={{
              color: buka ? T.primary : T.textMuted,
              transform: buka ? "rotate(180deg)" : "none",
              transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </span>
      </button>

      {buka && rect && (
        <div
          ref={panelRef}
          role="listbox"
          style={{
            position: "fixed",
            top: keAtas ? undefined : rect.top + 5,
            bottom: keAtas ? window.innerHeight - rect.bottom + 5 : undefined,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 12)),
            width: rect.width,
            zIndex: 1400,
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            boxShadow: T.shadowLg || "0 12px 32px rgba(15,23,42,0.18)",
            padding: 5,
            maxHeight: 300,
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn 0.12s ease",
          }}
        >
          {bisaCari && (
            <div style={{ position: "relative", padding: "2px 2px 6px", borderBottom: `1px solid ${T.border}`, marginBottom: 4 }}>
              <Icon name="search" size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-60%)", color: T.textMuted }} />
              <input
                ref={searchRef}
                value={cari}
                onChange={e => { setCari(e.target.value); setSorot(0); }}
                onKeyDown={onKeyDown}
                placeholder="Cari pilihan..."
                style={{
                  width: "100%",
                  padding: "6px 8px 6px 28px",
                  fontSize: 12,
                  border: `1px solid ${T.inputBorder || T.border}`,
                  borderRadius: 8,
                  background: T.inputBg,
                  color: T.text,
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div style={{ overflowY: "auto", maxHeight: 240, paddingRight: 1 }}>
            {tersaring.length === 0 ? (
              <div style={{ padding: "10px 12px", fontSize: 12, color: T.textMuted, textAlign: "center" }}>
                Tidak ada pilihan yang cocok
              </div>
            ) : cari.trim() ? (
              tersaring.map((o, idx) => {
                const on = String(o.value) === String(value);
                const isHover = idx === sorot;
                return (
                  <OptionRow
                    key={`${o.group || ""}-${o.value}-${idx}`}
                    o={o}
                    on={on}
                    isHover={isHover}
                    onSelect={() => pilihOpsi(o.value)}
                    onHover={() => setSorot(idx)}
                    T={T}
                    fSize={fSize}
                  />
                );
              })
            ) : (
              groups.map((g, gi) => (
                <div key={g.group || `g-${gi}`}>
                  {g.group && (
                    <div style={{
                      fontSize: 10.5, fontWeight: 700, color: T.textMuted,
                      padding: "6px 10px 3px", textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {g.group}
                    </div>
                  )}
                  {g.options.map((o, oi) => {
                    const flatIdx = flatOptions.indexOf(o);
                    const on = String(o.value) === String(value);
                    const isHover = flatIdx === sorot;
                    return (
                      <OptionRow
                        key={`${g.group || ""}-${o.value}-${oi}`}
                        o={o}
                        on={on}
                        isHover={isHover}
                        onSelect={() => pilihOpsi(o.value)}
                        onHover={() => setSorot(flatIdx)}
                        T={T}
                        fSize={fSize}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({ o, on, isHover, onSelect, onHover, T, fSize }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      onMouseDown={e => { e.preventDefault(); onSelect(); }}
      onMouseEnter={onHover}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        fontFamily: T.font || "inherit",
        fontSize: fSize,
        padding: "7.5px 10px",
        border: "none",
        borderRadius: 8,
        background: on ? T.primaryLight : isHover ? T.surfaceHover : "transparent",
        color: on ? T.primary : T.text,
        fontWeight: on ? 600 : 400,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.1s ease",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</div>
        {o.sub && (
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {o.sub}
          </div>
        )}
      </div>
      {on && <Icon name="check" size={13} style={{ flexShrink: 0, color: T.primary }} />}
    </button>
  );
}

// ── Custom DatePicker & DateTimePicker ───────────────────────────────────────
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI_PENDEK = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function parseTanggal(val) {
  if (!val || typeof val !== "string") return null;
  const m = val.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return {
    year: parseInt(m[1], 10),
    month: parseInt(m[2], 10) - 1,
    day: parseInt(m[3], 10),
    hour: m[4] != null ? parseInt(m[4], 10) : 9,
    minute: m[5] != null ? parseInt(m[5], 10) : 0,
  };
}

function formatIsoDate(y, m, d, withTime = false, hh = 0, mm = 0) {
  const ys = String(y).padStart(4, "0");
  const ms = String(m + 1).padStart(2, "0");
  const ds = String(d).padStart(2, "0");
  if (!withTime) return `${ys}-${ms}-${ds}`;
  return `${ys}-${ms}-${ds}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function DatePicker({
  value = "",
  onChange,
  placeholder = "Pilih tanggal...",
  withTime = false,
  disabled = false,
  error = false,
  size = "md",
  fullWidth = true,
  clearable = true,
  style,
}) {
  const { T } = useContext(ThemeContext);
  const parsed = useMemo(() => parseTanggal(value), [value]);
  const now = useMemo(() => new Date(), []);

  const [buka, setBuka] = useState(false);
  const [viewYear, setViewYear] = useState(() => parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? now.getMonth());
  const [modePilih, setModePilih] = useState("hari");
  const [jam, setJam] = useState(() => parsed?.hour ?? 9);
  const [menit, setMenit] = useState(() => parsed?.minute ?? 0);
  const [rect, setRect] = useState(null);

  const boxRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      setJam(parsed.hour);
      setMenit(parsed.minute);
    }
  }, [value]);

  useEffect(() => {
    if (!buka) {
      setModePilih("hari");
      setRect(null);
      return;
    }
    const hitung = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setRect({ top: r.bottom, bottom: r.top, left: r.left, width: r.width });
    };
    hitung();
    const tutupKlik = e => {
      if (boxRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setBuka(false);
    };
    const esc = e => { if (e.key === "Escape") setBuka(false); };
    window.addEventListener("scroll", hitung, true);
    window.addEventListener("resize", hitung);
    document.addEventListener("mousedown", tutupKlik);
    document.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("scroll", hitung, true);
      window.removeEventListener("resize", hitung);
      document.removeEventListener("mousedown", tutupKlik);
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const offset = (firstDay + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
    const arr = [];
    for (let i = offset - 1; i >= 0; i--) {
      const pm = viewMonth === 0 ? 11 : viewMonth - 1;
      const py = viewMonth === 0 ? viewYear - 1 : viewYear;
      arr.push({ y: py, m: pm, d: daysInPrev - i, luar: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ y: viewYear, m: viewMonth, d, luar: false });
    }
    const rem = 42 - arr.length;
    for (let d = 1; d <= rem; d++) {
      const nm = viewMonth === 11 ? 0 : viewMonth + 1;
      const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
      arr.push({ y: ny, m: nm, d, luar: true });
    }
    return arr;
  }, [viewYear, viewMonth]);

  const geserBulan = delta => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const pilihHari = c => {
    const nextVal = formatIsoDate(c.y, c.m, c.d, withTime, jam, menit);
    onChange(nextVal);
    if (!withTime) setBuka(false);
  };

  const pilihHariIni = () => {
    const t = new Date();
    const nextVal = formatIsoDate(t.getFullYear(), t.getMonth(), t.getDate(), withTime, t.getHours(), t.getMinutes());
    onChange(nextVal);
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    if (!withTime) setBuka(false);
  };

  const ubahWaktu = (newJam, newMenit) => {
    setJam(newJam);
    setMenit(newMenit);
    const base = parsed || { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
    onChange(formatIsoDate(base.year, base.month, base.day, true, newJam, newMenit));
  };

  const teksTampil = parsed
    ? `${String(parsed.day).padStart(2, "0")} ${BULAN_PENDEK[parsed.month]} ${parsed.year}${
        withTime ? ` · ${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}` : ""
      }`
    : placeholder;

  const pad = size === "sm" ? "6px 10px" : "8.5px 12px";
  const fSize = size === "sm" ? 12 : 13;
  const radius = size === "sm" ? 8 : 10;
  const panelWidth = 284;
  const keAtas = rect ? window.innerHeight - rect.top < 340 && rect.bottom > 340 : false;
  const borderCol = error ? T.danger : buka ? T.primary : (T.inputBorder || T.border);

  return (
    <div ref={boxRef} style={{ position: "relative", width: fullWidth ? "100%" : "auto", ...style }}>
      <div
        ref={btnRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={buka}
        onClick={() => { if (!disabled) setBuka(v => !v); }}
        onKeyDown={e => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBuka(v => !v); }
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: pad,
          fontSize: fSize,
          fontFamily: T.font || "inherit",
          border: `1.5px solid ${borderCol}`,
          borderRadius: radius,
          background: disabled ? T.surfaceHover : T.inputBg,
          color: parsed ? T.text : T.textMuted,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          boxShadow: buka ? T.focusRing : "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          boxSizing: "border-box",
          userSelect: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: 6,
            background: parsed ? T.primaryLight : T.surfaceHover,
            color: parsed ? T.primary : T.textMuted, flexShrink: 0,
          }}>
            <Icon name="calendar" size={13} />
          </span>
          <span style={{ fontWeight: parsed ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {teksTampil}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {clearable && parsed && !disabled && (
            <button
              type="button"
              title="Hapus tanggal"
              onClick={e => { e.stopPropagation(); onChange(""); }}
              style={{
                background: "none", border: "none", padding: 3, borderRadius: 5,
                cursor: "pointer", color: T.textMuted, display: "flex",
              }}
            >
              <Icon name="x" size={12} />
            </button>
          )}
          <Icon
            name="chevronDown"
            size={12}
            style={{
              color: buka ? T.primary : T.textMuted,
              transform: buka ? "rotate(180deg)" : "none",
              transition: "transform 0.2s ease",
            }}
          />
        </span>
      </div>

      {buka && rect && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Pilih tanggal"
          style={{
            position: "fixed",
            top: keAtas ? undefined : rect.top + 6,
            bottom: keAtas ? window.innerHeight - rect.bottom + 6 : undefined,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 12)),
            width: panelWidth,
            zIndex: 1400,
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            boxShadow: T.shadowLg || "0 16px 36px rgba(15,23,42,0.2)",
            padding: 12,
            animation: "fadeIn 0.14s ease",
            userSelect: "none",
          }}
        >
          {/* Header Navigasi Bulan & Tahun */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => (modePilih === "hari" ? geserBulan(-1) : setViewYear(y => y - 1))}
              style={{
                width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.border}`,
                background: T.surfaceHover, color: T.text, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="chevronRight" size={13} style={{ transform: "rotate(180deg)" }} />
            </button>

            <button
              type="button"
              onClick={() => setModePilih(m => (m === "hari" ? "bulan" : "hari"))}
              style={{
                background: T.primaryLight, color: T.primary, border: "none",
                borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
              }}
            >
              {modePilih === "hari" ? `${BULAN_ID[viewMonth]} ${viewYear}` : `${viewYear}`}
              <Icon name="chevronDown" size={11} style={{ transform: modePilih === "bulan" ? "rotate(180deg)" : "none" }} />
            </button>

            <button
              type="button"
              onClick={() => (modePilih === "hari" ? geserBulan(1) : setViewYear(y => y + 1))}
              style={{
                width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.border}`,
                background: T.surfaceHover, color: T.text, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="chevronRight" size={13} />
            </button>
          </div>

          {modePilih === "bulan" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "4px 0" }}>
              {BULAN_PENDEK.map((b, idx) => {
                const aktifBulan = idx === viewMonth;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => { setViewMonth(idx); setModePilih("hari"); }}
                    style={{
                      padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: aktifBulan ? 700 : 500,
                      border: `1px solid ${aktifBulan ? T.primary : T.border}`,
                      background: aktifBulan ? T.primary : T.surfaceHover,
                      color: aktifBulan ? "#fff" : T.text,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                {HARI_PENDEK.map(h => (
                  <div key={h} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: T.textMuted, padding: "3px 0" }}>
                    {h}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                {cells.map((c, idx) => {
                  const isSelected = parsed && parsed.year === c.y && parsed.month === c.m && parsed.day === c.d;
                  const isToday = now.getFullYear() === c.y && now.getMonth() === c.m && now.getDate() === c.d;
                  return (
                    <button
                      key={`${c.y}-${c.m}-${c.d}-${idx}`}
                      type="button"
                      onClick={() => pilihHari(c)}
                      style={{
                        height: 32,
                        borderRadius: 8,
                        border: isToday && !isSelected ? `1.5px solid ${T.primary}` : "none",
                        background: isSelected ? T.primary : "transparent",
                        color: isSelected ? "#fff" : c.luar ? T.textMuted : T.text,
                        opacity: c.luar && !isSelected ? 0.45 : 1,
                        fontSize: 12,
                        fontWeight: isSelected || isToday ? 700 : 500,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = T.primaryLight; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                    >
                      {c.d}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {withTime && (
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.textSecondary, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="clock" size={13} style={{ color: T.primary }} /> Waktu
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <TimeStepper value={jam} max={23} onChange={v => ubahWaktu(v, menit)} T={T} />
                <span style={{ fontWeight: 700, color: T.text }}>:</span>
                <TimeStepper value={menit} max={59} step={5} onChange={v => ubahWaktu(jam, v)} T={T} />
              </div>
            </div>
          )}

          <div style={{
            marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6,
          }}>
            <button
              type="button"
              onClick={pilihHariIni}
              style={{
                background: T.primaryLight, color: T.primary, border: "none",
                borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Hari Ini
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              {parsed && (
                <button
                  type="button"
                  onClick={() => { onChange(""); setBuka(false); }}
                  style={{
                    background: T.surfaceHover, color: T.textSecondary, border: "none",
                    borderRadius: 7, padding: "5px 10px", fontSize: 11.5, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Hapus
                </button>
              )}
              {withTime && (
                <button
                  type="button"
                  onClick={() => setBuka(false)}
                  style={{
                    background: T.primary, color: "#fff", border: "none",
                    borderRadius: 7, padding: "5px 12px", fontSize: 11.5, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Selesai
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeStepper({ value, max, step = 1, onChange, T }) {
  const inc = () => onChange((value + step) > max ? 0 : value + step);
  const dec = () => onChange((value - step) < 0 ? max - (max % step) : value - step);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", background: T.surfaceHover,
      border: `1px solid ${T.border}`, borderRadius: 7, overflow: "hidden",
    }}>
      <button type="button" onClick={dec} style={{ border: "none", background: "none", padding: "3px 6px", cursor: "pointer", color: T.textSecondary, fontSize: 11, fontWeight: 700 }}>−</button>
      <span style={{ fontSize: 12, fontWeight: 700, color: T.text, minWidth: 22, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        {String(value).padStart(2, "0")}
      </span>
      <button type="button" onClick={inc} style={{ border: "none", background: "none", padding: "3px 6px", cursor: "pointer", color: T.textSecondary, fontSize: 11, fontWeight: 700 }}>+</button>
    </div>
  );
}

// ── Custom Button Component ──────────────────────────────────────────────────
export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  type = "button",
  onClick,
  style,
  children,
  ...rest
}) {
  const { T } = useContext(ThemeContext);
  const isOff = disabled || loading;

  const variants = {
    primary: {
      background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryHover || T.primary} 100%)`,
      color: "#fff",
      border: `1px solid ${T.primary}`,
      boxShadow: "0 2px 6px rgba(37,99,235,0.22)",
    },
    secondary: {
      background: T.surfaceHover,
      color: T.text,
      border: `1px solid ${T.border}`,
      boxShadow: "none",
    },
    outline: {
      background: T.card,
      color: T.textSecondary,
      border: `1.5px solid ${T.inputBorder || T.border}`,
      boxShadow: T.shadowSm || "none",
    },
    ghost: {
      background: "transparent",
      color: T.textSecondary,
      border: "1px solid transparent",
      boxShadow: "none",
    },
    danger: {
      background: T.danger || "#DC2626",
      color: "#fff",
      border: `1px solid ${T.danger || "#DC2626"}`,
      boxShadow: "0 2px 6px rgba(220,38,38,0.2)",
    },
    dangerSoft: {
      background: T.dangerBg || "#FEF2F2",
      color: T.danger || "#DC2626",
      border: `1px solid ${T.dangerBorder || "#FECACA"}`,
      boxShadow: "none",
    },
    success: {
      background: T.success || "#16A34A",
      color: "#fff",
      border: `1px solid ${T.success || "#16A34A"}`,
      boxShadow: "0 2px 6px rgba(22,163,74,0.2)",
    },
    warning: {
      background: T.warningBg || "#FFFBEB",
      color: T.warning || "#D97706",
      border: `1px solid ${T.warningBorder || "#FDE68A"}`,
      boxShadow: "none",
    },
  };

  const sizes = {
    xs: { padding: "4px 9px", fontSize: 11, borderRadius: 7, gap: 4, iconSize: 11 },
    sm: { padding: "6px 12px", fontSize: 12, borderRadius: 8, gap: 5, iconSize: 13 },
    md: { padding: "8.5px 15px", fontSize: 13, borderRadius: 10, gap: 6, iconSize: 14 },
    lg: { padding: "11px 20px", fontSize: 14, borderRadius: 11, gap: 8, iconSize: 16 },
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      disabled={isOff}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        width: fullWidth ? "100%" : undefined,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 600,
        fontFamily: T.font || "inherit",
        borderRadius: s.borderRadius,
        background: v.background,
        color: v.color,
        border: v.border,
        boxShadow: v.boxShadow,
        cursor: isOff ? "not-allowed" : "pointer",
        opacity: isOff ? 0.6 : 1,
        transition: "transform 0.12s ease, box-shadow 0.15s ease, filter 0.15s ease",
        whiteSpace: "nowrap",
        boxSizing: "border-box",
        ...style,
      }}
      onMouseEnter={e => {
        if (!isOff) e.currentTarget.style.filter = "brightness(1.05)";
      }}
      onMouseLeave={e => {
        if (!isOff) {
          e.currentTarget.style.filter = "none";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
      onMouseDown={e => {
        if (!isOff) e.currentTarget.style.transform = "translateY(1px)";
      }}
      onMouseUp={e => {
        if (!isOff) e.currentTarget.style.transform = "translateY(0)";
      }}
      {...rest}
    >
      {loading ? (
        <span style={{
          width: s.iconSize, height: s.iconSize,
          border: "2px solid currentColor", borderTopColor: "transparent",
          borderRadius: "50%", display: "inline-block",
          animation: "spin 0.7s linear infinite",
        }} />
      ) : typeof icon === "string" ? (
        <Icon name={icon} size={s.iconSize} />
      ) : (
        icon || null
      )}
      {children}
      {typeof iconRight === "string" ? <Icon name={iconRight} size={s.iconSize} /> : (iconRight || null)}
    </button>
  );
}

