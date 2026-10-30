import { useState, useEffect } from "react";
import {
  Icon, Badge, driveThumbUrl, gdriveDirectUrl, getUniversalPreviewUrl,
  isImageFile, extractGDriveFileId,
} from "./ui.jsx";
import { getDocFileInfo, getBidangColor } from "./docMeta.js";
import { STATUS_COLOR } from "../data.js";
import HighlightText from "./HighlightText.jsx";

// Tampilan daftar ala Finder: list, columns, gallery + preview pane.
// Semua styling inline mengikuti token theme (T), tanpa Tailwind.

const card = (T) => ({ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, boxShadow: T.shadowSm });

const fileUrl = (d) => (Array.isArray(d?.files) && d.files[0]?.url) || d?.url || "";

// API mengirim tanggalDokumen sudah terformat ("06 Jan 2026").
const docDate = (d) => d?.tanggalDokumen || d?.tanggal_dokumen || d?.createdAt || null;

function fmtDate(s) {
  if (!s) return "—";
  if (typeof s === "string" && !/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Thumbnail ──────────────────────────────────────────────────────────────
export function FileThumb({ doc, size = 40, T, radius = 10 }) {
  const url = fileUrl(doc);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [url]);

  const fi = getDocFileInfo(doc);
  // ponytail: hanya gambar yang minta thumbnail Drive — kalau semua baris minta,
  // Drive balas 429 dan seluruh thumbnail gagal. PDF/dokumen tetap tile ikon.
  const src = isImageFile(url, doc?.files?.[0]?.name || doc?.title)
    ? (driveThumbUrl(url, size > 200 ? 600 : 300) || url)
    : null;

  if (!src || broken) {
    return (
      <div style={{ width: size, height: size, borderRadius: radius, background: fi.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name="file" size={Math.round(size * 0.45)} style={{ color: fi.color }} />
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: "hidden", flexShrink: 0, background: T.bg, border: `1px solid ${T.border}` }}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

// ── Stage pratinjau (dipakai pane & gallery) ───────────────────────────────
function Stage({ doc, T, height }) {
  const url = fileUrl(doc);
  const pTitle = doc?.files?.[0]?.name || doc?.title || "";
  const gid = extractGDriveFileId(url);
  const isImage = isImageFile(url, pTitle);
  const preview = getUniversalPreviewUrl(url);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [url, pTitle]);

  const box = { height, background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };
  if (!doc) {
    return (
      <div style={{ ...box, flexDirection: "column", gap: 8, color: T.textMuted }}>
        <Icon name="gallery" size={28} />
        <div style={{ fontSize: 12 }}>Pilih dokumen</div>
      </div>
    );
  }
  if (isImage && !broken) {
    return (
      <div style={box}>
        <img
          src={gid ? `https://lh3.googleusercontent.com/d/${gid}` : url}
          alt={pTitle}
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    );
  }
  if (preview) {
    return (
      <div style={box}>
        <iframe
          key={url}
          src={preview}
          title={pTitle}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="autoplay"
        />
      </div>
    );
  }
  return (
    <div style={{ ...box, flexDirection: "column", gap: 8, color: T.textMuted }}>
      <Icon name="file" size={28} />
      <div style={{ fontSize: 12 }}>Tidak ada pratinjau</div>
    </div>
  );
}

function Meta({ label, value, T }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ color: T.textMuted, flexShrink: 0 }}>{label}</span>
      <span style={{ color: T.text, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

// ── Preview pane ───────────────────────────────────────────────────────────
export function PreviewPane({ doc, T, onOpen, onClose }) {
  const btn = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: T.font, fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "9px 12px", cursor: "pointer", border: "none", textDecoration: "none" };
  if (!doc) {
    return <div style={{ ...card(T), position: "sticky", top: 16 }}><Stage T={T} height={280} /></div>;
  }
  const gid = extractGDriveFileId(fileUrl(doc));
  const fi = getDocFileInfo(doc);
  return (
    <div style={{ ...card(T), position: "sticky", top: 16, overflow: "hidden" }}>
      <div style={{ position: "relative" }}>
        <Stage doc={doc} T={T} height={320} />
        {onClose && (
          <button onClick={onClose} title="Tutup pratinjau" style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 8, border: "none", background: "rgba(15,23,42,0.55)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.35, marginBottom: 8 }}>{doc.title}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          <Badge label={fi.label} colors={{ bg: fi.bg, text: fi.color }} />
          <Badge label={doc.status} colors={STATUS_COLOR[doc.status]} />
          {doc.versi > 1 && <Badge label={`v${doc.versi}`} colors={{ bg: T.primaryLight, text: T.primary }} />}
        </div>
        <div style={{ marginBottom: 12 }}>
          <Meta label="Bidang" value={doc.bidang || "Umum"} T={T} />
          <Meta label="Sektor" value={doc.sector} T={T} />
          <Meta label="Tahun" value={doc.year} T={T} />
          <Meta label="Tanggal" value={fmtDate(docDate(doc))} T={T} />
          <Meta label="Ukuran" value={doc.ukuran || doc.size} T={T} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onOpen(doc)} style={{ ...btn, flex: 1, background: T.primary, color: "#fff" }}>
            <Icon name="eye" size={14} /> Buka
          </button>
          {(gid || fileUrl(doc)) && (
            <a href={gid ? gdriveDirectUrl(gid) : fileUrl(doc)} target="_blank" rel="noopener noreferrer"
              style={{ ...btn, background: T.bg, color: T.textSecondary, border: `1px solid ${T.border}` }}>
              <Icon name="download" size={14} /> Unduh
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Baris & elemen bersama ─────────────────────────────────────────────────
function SelBox({ on, T, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: "pointer",
      border: on ? "none" : `2px solid ${T.borderHover}`,
      background: on ? T.primary : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {on && <Icon name="check" size={11} style={{ color: "#fff" }} />}
    </div>
  );
}

function FolderRow({ nama, count, T, active, onClick }) {
  const bc = getBidangColor(nama);
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: active ? T.primaryLight : "transparent", borderLeft: `3px solid ${active ? T.primary : "transparent"}` }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.hoverBg || T.bg; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 8, background: bc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name="folder" size={14} style={{ color: bc.text }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nama}</div>
        <div style={{ fontSize: 11, color: T.textSecondary }}>{count} dokumen</div>
      </div>
      <Icon name="chevronRight" size={14} style={{ color: T.textMuted, flexShrink: 0 }} />
    </div>
  );
}

function Empty({ label, T }) {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <Icon name="search" size={26} style={{ color: T.primary }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginTop: 10 }}>{label}</div>
    </div>
  );
}

function DocRow({ d, T, search, isMobile, selectionMode, selectedIds, onToggleSelect, onOpen, onPeek, peekedId, showBidang, showDate = true }) {
  const isPeeked = peekedId === d.id;
  const open = () => (selectionMode ? onToggleSelect(d.id) : onOpen(d));
  return (
    <div
      onClick={() => { if (!selectionMode) (isMobile ? onOpen(d) : onPeek(d)); else onToggleSelect(d.id); }}
      onDoubleClick={() => { if (!selectionMode) onOpen(d); }}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); open(); } }}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "9px 12px" : "9px 14px",
        cursor: "pointer",
        background: selectionMode && selectedIds.has(d.id) ? T.primaryLight : isPeeked ? (T.hoverBg || T.bg) : "transparent",
        borderLeft: `3px solid ${isPeeked && !selectionMode ? T.primary : "transparent"}`,
      }}
      onMouseEnter={e => { if (!isPeeked) e.currentTarget.style.background = T.primaryLight; }}
      onMouseLeave={e => { if (!isPeeked) e.currentTarget.style.background = "transparent"; }}
    >
      {selectionMode && <SelBox on={selectedIds.has(d.id)} T={T} onClick={e => { e.stopPropagation(); onToggleSelect(d.id); }} />}
      <FileThumb doc={d} size={34} T={T} radius={8} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <HighlightText text={d.title} query={search} />
        </div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[d.type, d.sector].filter(Boolean).join(" · ")}
        </div>
      </div>
      {showBidang && !isMobile && (
        <div style={{ width: 160, fontSize: 11, color: T.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.bidang || "Umum"}</div>
      )}
      {showDate && !isMobile && <div style={{ width: 100, fontSize: 11, color: T.textSecondary }}>{fmtDate(docDate(d))}</div>}
      {showDate && !isMobile && <div style={{ width: 70, fontSize: 11, color: T.textSecondary, textAlign: "right" }}>{d.ukuran || d.size || "—"}</div>}
      {!isMobile && <div style={{ flexShrink: 0 }}><Badge label={d.status} colors={STATUS_COLOR[d.status]} /></div>}
      <button
        onClick={e => { e.stopPropagation(); onOpen(d); }}
        title="Buka"
        style={{ border: "none", background: "transparent", cursor: "pointer", color: T.textMuted, display: "flex", alignItems: "center", padding: 4 }}
      >
        <Icon name="chevronRight" size={15} />
      </button>
    </div>
  );
}

function SortHead({ label, asc, desc, sortOpt, onSort, T, style }) {
  const active = sortOpt === asc || sortOpt === desc;
  return (
    <button
      onClick={() => onSort(active && sortOpt === asc ? desc : asc)}
      style={{
        display: "flex", alignItems: "center", gap: 3, background: "transparent", border: "none",
        fontFamily: T.font, fontSize: 11, fontWeight: 700, color: active ? T.primary : T.textMuted,
        cursor: "pointer", padding: 0, textAlign: "left", ...style,
      }}
    >
      {label}
      {active && <Icon name="chevronDown" size={11} style={{ transform: sortOpt === asc ? "rotate(180deg)" : "none" }} />}
    </button>
  );
}

// ── List ───────────────────────────────────────────────────────────────────
export function ViewList({ items, folders = [], selectedBidang, onSelectBidang, T, search, sortOpt, onSort, selectionMode, selectedIds, onToggleSelect, onOpen, onPeek, peekedId, isMobile, showDate = true, showBidangCol = true }) {
  const showBidang = !selectedBidang && showBidangCol;
  return (
    <div style={{ ...card(T), overflow: "hidden" }}>
      {folders.length > 0 && (
        <div style={{ borderBottom: `1px solid ${T.border}` }}>
          <div style={{ padding: "8px 14px", fontSize: 11, fontWeight: 700, color: T.textMuted, background: T.bg }}>Bidang</div>
          {folders.map(([nama, count]) => (
            <FolderRow key={nama} nama={nama} count={count} T={T} active={selectedBidang === nama} onClick={() => onSelectBidang(nama)} />
          ))}
        </div>
      )}
      {!isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.bg }}>
          <div style={{ width: selectionMode ? 18 : 0, flexShrink: 0 }} />
          <div style={{ width: 34, flexShrink: 0 }} />
          <div style={{ flex: 1 }}><SortHead label="Nama" asc="title-asc" desc="title-desc" sortOpt={sortOpt} onSort={onSort} T={T} /></div>
          {showBidang && <div style={{ width: 160 }}><SortHead label="Bidang" asc="bidang-asc" desc="bidang-desc" sortOpt={sortOpt} onSort={onSort} T={T} /></div>}
          {showDate && !isMobile && <div style={{ width: 100 }}><SortHead label="Tanggal" asc="date-asc" desc="date-desc" sortOpt={sortOpt} onSort={onSort} T={T} /></div>}
          {showDate && !isMobile && <div style={{ width: 70, textAlign: "right", justifyContent: "flex-end" }}><SortHead label="Ukuran" asc="size-asc" desc="size-desc" sortOpt={sortOpt} onSort={onSort} T={T} style={{ justifyContent: "flex-end" }} /></div>}
          <div style={{ width: 70 }} />
          <div style={{ width: 23 }} />
        </div>
      )}
      {items.length === 0
        ? <Empty label="Tidak ada dokumen" T={T} />
        : <div style={{ maxHeight: "none" }}>
            {items.map(d => (
              <DocRow key={d.id} d={d} T={T} search={search} isMobile={isMobile}
                selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={onToggleSelect}
                onOpen={onOpen} onPeek={onPeek} peekedId={peekedId} showBidang={showBidang} showDate={showDate} />
            ))}
          </div>}
    </div>
  );
}

// ── Columns (Miller) ───────────────────────────────────────────────────────
export function ViewColumns({ folders = [], docs = [], allDocs = [], selectedBidang, onSelectBidang, T, search, selectionMode, selectedIds, onToggleSelect, onOpen, onPeek, peekedId, isMobile, showDate = true, showBidangCol = true }) {
  const list = selectedBidang ? docs : allDocs;
  return (
    <div style={{ ...card(T), display: "flex", overflow: "hidden", minHeight: 460 }}>
      <div style={{ width: isMobile ? 150 : 220, borderRight: `1px solid ${T.border}`, overflowY: "auto", flexShrink: 0 }}>
        <div
          onClick={() => onSelectBidang(null)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", background: !selectedBidang ? T.primaryLight : "transparent", borderLeft: `3px solid ${!selectedBidang ? T.primary : "transparent"}` }}
        >
          <Icon name="layers" size={14} style={{ color: T.primary, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: T.text }}>Semua Dokumen</div>
          <span style={{ fontSize: 11, color: T.textMuted }}>{allDocs.length}</span>
        </div>
        {folders.map(([nama, count]) => (
          <FolderRow key={nama} nama={nama} count={count} T={T} active={selectedBidang === nama} onClick={() => onSelectBidang(nama)} />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {list.length === 0
          ? <Empty label="Tidak ada dokumen" T={T} />
          : list.map(d => (
              <DocRow key={d.id} d={d} T={T} search={search} isMobile={isMobile}
                selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={onToggleSelect}
                onOpen={onOpen} onPeek={onPeek} peekedId={peekedId} showBidang={!selectedBidang && showBidangCol} showDate={showDate} />
            ))}
      </div>
    </div>
  );
}

// ── Gallery ────────────────────────────────────────────────────────────────
export function ViewGallery({ items, activeId, onPeek, onOpen, T, isMobile }) {
  const active = items.find(d => d.id === activeId) || items[0] || null;
  const fi = active ? getDocFileInfo(active) : null;
  return (
    <div style={{ ...card(T), overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Stage doc={active} T={T} height={isMobile ? 240 : 420} />
        </div>
        {active && (
          <div style={{ width: isMobile ? "auto" : 240, borderLeft: isMobile ? "none" : `1px solid ${T.border}`, borderTop: isMobile ? `1px solid ${T.border}` : "none", padding: 14, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8, lineHeight: 1.35 }}>{active.title}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              <Badge label={fi.label} colors={{ bg: fi.bg, text: fi.color }} />
              <Badge label={active.status} colors={STATUS_COLOR[active.status]} />
            </div>
            <Meta label="Bidang" value={active.bidang || "Umum"} T={T} />
            <Meta label="Sektor" value={active.sector} T={T} />
            <Meta label="Tahun" value={active.year} T={T} />
            <Meta label="Ukuran" value={active.ukuran || active.size} T={T} />
            <button onClick={() => onOpen(active)} style={{ marginTop: 12, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: T.font, fontSize: 13, fontWeight: 600, borderRadius: 10, padding: "9px 12px", border: "none", background: T.primary, color: "#fff", cursor: "pointer" }}>
              <Icon name="eye" size={14} /> Buka Dokumen
            </button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 10, overflowX: "auto", borderTop: `1px solid ${T.border}`, background: T.bg }}>
        {items.length === 0 && <div style={{ fontSize: 12, color: T.textMuted, padding: 6 }}>Tidak ada dokumen</div>}
        {items.map(d => {
          const on = active && d.id === active.id;
          return (
            <div
              key={d.id}
              onClick={() => onPeek(d)}
              onDoubleClick={() => onOpen(d)}
              title={d.title}
              style={{ flexShrink: 0, cursor: "pointer", borderRadius: 8, outline: on ? `2px solid ${T.primary}` : "none", outlineOffset: 1 }}
            >
              <FileThumb doc={d} size={56} T={T} radius={6} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
