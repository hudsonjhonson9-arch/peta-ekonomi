export function Badge({ label, colors }) {
  return (
    <span style={{
      background: colors.bg,
      color: colors.text,
      fontSize: 11,
      fontWeight: 600,
      padding: "3px 9px",
      borderRadius: 99,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

const PATHS = {
  home:         "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  archive:      "M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
  search:       "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35",
  upload:       "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  users:        "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  chart:        "M18 20V10 M12 20V4 M6 20v-6",
  history:      "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  file:         "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  download:     "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  check:        "M20 6L9 17l-5-5",
  x:            "M18 6L6 18 M6 6l12 12",
  eye:          "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
  chevronRight: "M9 18l6-6-6-6",
  plus:         "M12 5v14 M5 12h14",
  menu:         "M3 12h18 M3 6h18 M3 18h18",
  bell:         "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  tag:          "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01",
  world:        "M12 2a10 10 0 100 20A10 10 0 0012 2z M2 12h20 M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z",
  logout:       "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  edit:         "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  filter:       "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
};

export function Icon({ name, size = 16, style = {} }) {
  const d = PATHS[name] || "";
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={style}
    >
      {d.split(" M").map((seg, i) => (
        <path key={i} d={i === 0 ? seg : "M" + seg} />
      ))}
    </svg>
  );
}

export function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      background: "#1b5e20", color: "#fff",
      padding: "12px 20px", borderRadius: 10,
      fontSize: 13, fontWeight: 500, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      animation: "fadeIn .2s ease",
    }}>
      <Icon name="check" size={15} /> {msg}
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 8, padding: 0 }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
