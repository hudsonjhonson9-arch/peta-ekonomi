# 5 UI/UX Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk actions, search highlight, dark mode, sort dropdown, and recent activity sidebar to ARSIP DIGITAL BAPPERIDA.

**Architecture:** Theme system via React Context + CSS custom properties. Bulk actions via new Express endpoint with SQL transactions. All other features are frontend-only additions to existing components.

**Tech Stack:** React 18, Express.js, PostgreSQL, inline styles (no CSS framework), react-query.

## Global Constraints

- Windows/PowerShell: use `;` not `&&` for command chaining
- Deploy: GAS = manual paste; frontend/server = Coolify auto-deploy on push to `main`
- Live: `https://arsipdigital.mindcloud.my.id/`
- DB table: `bapperida_dokumen` columns: `id, judul, kategori, tipe, tanggal, ukuran, url, created_at, status, publik, bidang, files, pages`
- DB table: `audit_logs` columns: `id, user_name, action, doc_title, created_at`
- Ponytail mode: full (shortest diff, no unrequested abstractions)
- CSS approach: 100% inline styles. No CSS modules, no Tailwind.
- State: all `useState` in component tree. `App.jsx` holds top-level state.

---

## Task 1: Create Theme System

**Files:**
- Create: `src/theme.js`

**Interfaces:**
- Produces: `LIGHT`, `DARK` objects, `getTheme(preference)` function

- [ ] **Step 1: Create theme.js**

```js
// src/theme.js
const LIGHT = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  borderHover: "#CBD5E1",
  primary: "#2563EB",
  primaryLight: "#EFF6FF",
  primaryRing: "#BFDBFE",
  shadowSm: "0 1px 2px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
  sidebarBg: "#0F172A",
  sidebarHover: "#1E293B",
  sidebarText: "#CBD5E1",
  sidebarTextActive: "#FFFFFF",
  bottomNavBg: "#FFFFFF",
  bottomNavBorder: "#E2E8F0",
  inputBg: "#FFFFFF",
  inputBorder: "#E2E8F0",
  markBg: "#FEF08A",
};

const DARK = {
  bg: "#0F172A",
  card: "#1E293B",
  text: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  border: "#334155",
  borderHover: "#475569",
  primary: "#3B82F6",
  primaryLight: "#1E3A5F",
  primaryRing: "#60A5FA",
  shadowSm: "0 1px 3px rgba(0,0,0,0.3)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.4)",
  sidebarBg: "#020617",
  sidebarHover: "#0F172A",
  sidebarText: "#94A3B8",
  sidebarTextActive: "#FFFFFF",
  bottomNavBg: "#1E293B",
  bottomNavBorder: "#334155",
  inputBg: "#1E293B",
  inputBorder: "#334155",
  markBg: "#854D0E",
};

function getTheme(preference) {
  if (preference === "dark") return DARK;
  if (preference === "light") return LIGHT;
  // system
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return DARK;
  }
  return LIGHT;
}

function isDarkTheme(preference) {
  if (preference === "dark") return true;
  if (preference === "light") return false;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return true;
  }
  return false;
}

export { LIGHT, DARK, getTheme, isDarkTheme };
```

- [ ] **Step 2: Verify file loads**

Run: `cd D:\Code\peta-ekonomi; node -e "const t = require('./src/theme.js'); console.log(Object.keys(t))"`
Expected: exports LIGHT, DARK, getTheme, isDarkTheme

- [ ] **Step 3: Commit**

```bash
git add src/theme.js
git commit -m "feat(theme): add light/dark theme token system"
```

---

## Task 2: Add ThemeContext to App.jsx

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `LIGHT`, `DARK`, `getTheme`, `isDarkTheme` from `src/theme.js`
- Produces: `ThemeContext` with `{ T, isDark, theme, setTheme }` — used by all child components

- [ ] **Step 1: Add ThemeContext provider**

At top of `App.jsx`, after imports, add:

```jsx
import { LIGHT, DARK, getTheme, isDarkTheme } from "./theme.js";

const ThemeContext = React.createContext({ T: LIGHT, isDark: false, theme: "system", setTheme: () => {} });
export { ThemeContext };
```

Inside `App` component, before `return`, add state:

```jsx
const [theme, setThemeState] = useState(() => localStorage.getItem("theme") || "system");
const T = useMemo(() => getTheme(theme), [theme]);
const isDark = useMemo(() => isDarkTheme(theme), [theme]);

const setTheme = (v) => {
  setThemeState(v);
  localStorage.setItem("theme", v);
  document.documentElement.setAttribute("data-theme", isDarkTheme(v) ? "dark" : "light");
};

// set initial data-theme on mount
useEffect(() => {
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}, [isDark]);
```

Wrap the entire return JSX with:

```jsx
<ThemeContext.Provider value={{ T, isDark, theme, setTheme }}>
  {/* existing return content */}
</ThemeContext.Provider>
```

- [ ] **Step 2: Build to verify no errors**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(theme): add ThemeContext provider to App"
```

---

## Task 3: Convert DocPages.jsx to Use Theme

**Files:**
- Modify: `src/components/DocPages.jsx`

**Interfaces:**
- Consumes: `ThemeContext` from `App.jsx`
- Produces: All components use `T` from context instead of local hardcoded object

- [ ] **Step 1: Replace local T with context T**

In `DocPages.jsx`:

1. Add import at top: `import { useContext } from "react";` (add to existing import)
2. Add import: `import { ThemeContext } from "../App.jsx";`
3. Remove the entire `const T = { ... }` block (lines 8-36 approximately)
4. In `DocList` component, add at top: `const { T } = useContext(ThemeContext);`
5. In any other exported component that uses `T` (e.g., `DocDetail`), add the same `useContext` call

- [ ] **Step 2: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/DocPages.jsx
git commit -m "feat(theme): convert DocPages to use ThemeContext"
```

---

## Task 4: Convert Pages.jsx to Use Theme

**Files:**
- Modify: `src/components/Pages.jsx`

**Interfaces:**
- Consumes: `ThemeContext` from `App.jsx`
- Produces: All page components use `T` from context

- [ ] **Step 1: Replace local T with context T**

In `Pages.jsx`:

1. Add import: `import { useContext } from "react";`
2. Add import: `import { ThemeContext } from "../App.jsx";`
3. Remove the entire `const T = { ... }` block (lines 7-35 approximately)
4. In each exported component that uses `T` (`Pencarian`, `UploadPage`, `AuditTrail`, `BankData`, `Sektor`, `TipeDokumen`), add: `const { T } = useContext(ThemeContext);`

- [ ] **Step 2: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/Pages.jsx
git commit -m "feat(theme): convert Pages to use ThemeContext"
```

---

## Task 5: Convert Sidebar.jsx to Use Theme

**Files:**
- Modify: `src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `ThemeContext` from `App.jsx`

- [ ] **Step 1: Replace hardcoded colors**

In `Sidebar.jsx`:

1. Add import: `import { useContext } from "react";`
2. Add import: `import { ThemeContext } from "../App.jsx";`
3. In the component function, add: `const { T } = useContext(ThemeContext);`
4. Replace hardcoded colors:
   - `background: "#0F172A"` → `background: T.sidebarBg`
   - `background: "#1E293B"` (hover) → `background: T.sidebarHover`
   - `color: "#CBD5E1"` (nav text) → `color: T.sidebarText`
   - `color: "#FFFFFF"` (active text) → `color: T.sidebarTextActive`
   - `color: "#94A3B8"` (muted text) → `color: T.textMuted`
   - `borderRight: "1px solid ..."` → `borderRight: "1px solid " + T.border`

- [ ] **Step 2: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat(theme): convert Sidebar to use ThemeContext"
```

---

## Task 6: Convert BottomNav.jsx to Use Theme

**Files:**
- Modify: `src/components/BottomNav.jsx`

**Interfaces:**
- Consumes: `ThemeContext` from `App.jsx`

- [ ] **Step 1: Replace hardcoded colors**

In `BottomNav.jsx`:

1. Add import: `import { useContext } from "react";`
2. Add import: `import { ThemeContext } from "../App.jsx";`
3. In the component function, add: `const { T } = useContext(ThemeContext);`
4. Replace hardcoded colors:
   - `background: "#fff"` → `background: T.bottomNavBg`
   - `borderTop: "1px solid #e8e8e8"` → `borderTop: "1px solid " + T.bottomNavBorder`
   - `color: "#2563EB"` (active) → `color: T.primary`
   - `color: "#666"` (inactive) → `color: T.textMuted`
   - `color: "#333"` (text) → `color: T.text`

- [ ] **Step 2: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomNav.jsx
git commit -m "feat(theme): convert BottomNav to use ThemeContext"
```

---

## Task 7: Convert Dashboard.jsx to Use Theme

**Files:**
- Modify: `src/components/Dashboard.jsx`

**Interfaces:**
- Consumes: `ThemeContext` from `App.jsx`

- [ ] **Step 1: Replace hardcoded colors**

In `Dashboard.jsx`:

1. Add import: `import { useContext } from "react";`
2. Add import: `import { ThemeContext } from "../App.jsx";`
3. In the component function, add: `const { T } = useContext(ThemeContext);`
4. Replace all hardcoded `#fff` → `T.card`, `#e8e8e8`/`#E2E8F0` → `T.border`, `#0F172A` → `T.text`, `#64748B` → `T.textSecondary`, `#F8FAFC` → `T.bg`, `#2563EB` → `T.primary`

- [ ] **Step 2: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat(theme): convert Dashboard to use ThemeContext"
```

---

## Task 8: Convert App.jsx Shell Colors to Use Theme

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `T` from ThemeContext (already available in App)

- [ ] **Step 1: Replace shell background**

In `App.jsx`, find the main container style with `background: "#f5f7f5"` and replace with `background: T.bg`. The `T` variable is already available from Task 2.

- [ ] **Step 2: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(theme): use theme tokens for app shell background"
```

---

## Task 9: Add Dark Mode Toggle to Sidebar

**Files:**
- Modify: `src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `ThemeContext` from `App.jsx`

- [ ] **Step 1: Add theme toggle button**

In `Sidebar.jsx`, find the bottom area (near user info / "Keluar" button). Add a theme toggle row above or below the user info:

```jsx
const { T, theme, setTheme } = useContext(ThemeContext);

// In the sidebar bottom section, before the user info:
<div
  onClick={() => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  }}
  style={{
    display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
    cursor: "pointer", borderRadius: 8, fontSize: 13, color: T.sidebarText,
    transition: "background 0.15s",
  }}
  onMouseEnter={e => e.currentTarget.style.background = T.sidebarHover}
  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
>
  <span style={{ fontSize: 16 }}>{theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "💻"}</span>
  <span>{theme === "dark" ? "Gelap" : theme === "light" ? "Terang" : "Sistem"}</span>
</div>
```

Note: using emoji for icons since `ui.jsx` Icon component doesn't have moon/sun icons. Replace with `<Icon>` if icons are added to PATHS.

- [ ] **Step 2: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat(dark-mode): add theme toggle to sidebar"
```

---

## Task 10: Add Dark Mode CSS Fallback to index.html

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `data-theme` attribute set by ThemeContext

- [ ] **Step 1: Add dark mode CSS variables**

In `index.html`, inside `<style>`, add after existing styles:

```css
html[data-theme="dark"] {
  color-scheme: dark;
}
html[data-theme="dark"] body {
  background: #0F172A;
  color: #F1F5F9;
}
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(dark-mode): add CSS fallback for data-theme"
```

---

## Task 11: Create HighlightText Component

**Files:**
- Modify: `src/components/DocPages.jsx`

**Interfaces:**
- Produces: `HighlightText` component used in card renderings

- [ ] **Step 1: Add HighlightText component**

In `DocPages.jsx`, add before the `DocList` function:

```jsx
function HighlightText({ text, query }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return <>{parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: T.markBg || "#FEF08A", padding: 0, borderRadius: 2 }}>{p}</mark>
      : p
  )}</>;
}
```

Note: `T` is not yet available at module scope — this component will be called inside `DocList` where `T` is available via context. Move it inside `DocList` or pass `T` as prop. Simplest: define it inside `DocList` body.

Actually, since `HighlightText` is pure and `T` comes from context, define it inside `DocList`:

```jsx
export function DocList(...) {
  const { T } = useContext(ThemeContext);
  
  function HighlightText({ text, query }) {
    if (!query) return <>{text}</>;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return <>{parts.map((p, i) =>
      p.toLowerCase() === query.toLowerCase()
        ? <mark key={i} style={{ background: T.markBg || "#FEF08A", padding: 0, borderRadius: 2 }}>{p}</mark>
        : p
    )}</>;
  }
  
  // ... rest of DocList
```

- [ ] **Step 2: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 3: Commit**

```bash
git add src/components/DocPages.jsx
git commit -m "feat(search): add HighlightText component"
```

---

## Task 12: Apply HighlightText to Card Renderings

**Files:**
- Modify: `src/components/DocPages.jsx`

**Interfaces:**
- Consumes: `HighlightText` from Task 11, `search` state

- [ ] **Step 1: Replace {d.title} in all card renderings**

Find all instances of `{d.title}` in card renderings within DocList and replace with `<HighlightText text={d.title} query={search} />`.

There are approximately 4 locations:
1. Grid tanpa bidang cards (~line 594)
2. Grid folder docs cards (~line 754)
3. List tanpa bidang cards (~line 824)
4. List folder docs cards (~line 949)

Each replacement:
```jsx
// Before:
{d.title}

// After:
<HighlightText text={d.title} query={search} />
```

- [ ] **Step 2: Apply to Pencarian page**

In `Pages.jsx`, find the Pencarian component's search results rendering. Replace `{d.title}` with highlighted version. Since Pencarian doesn't have `HighlightText`, either:
- Export it from DocPages and import in Pages, or
- Duplicate the small function in Pages (ponytail: it's 8 lines, duplication is fine for now)

Simplest: add the same HighlightText function inside the Pencarian component in Pages.jsx, using `T` from its own useContext.

- [ ] **Step 3: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 4: Commit**

```bash
git add src/components/DocPages.jsx src/components/Pages.jsx
git commit -m "feat(search): apply highlight to all card renderings"
```

---

## Task 13: Add Sort Dropdown to DocList

**Files:**
- Modify: `src/components/DocPages.jsx`

**Interfaces:**
- Produces: `sortField`, `sortDir` state; `sorted` useMemo result

- [ ] **Step 1: Add sort state**

In `DocList`, after existing filter state declarations, add:

```jsx
const [sortOpt, setSortOpt] = useState("date-desc");
```

Single state — the option value encodes both field and direction.

- [ ] **Step 2: Add sorting useMemo**

After the existing `filtered` useMemo, add:

```jsx
const sorted = useMemo(() => {
  const arr = [...filtered];
  switch (sortOpt) {
    case "date-desc": return arr.sort((a, b) => b.id - a.id);
    case "date-asc": return arr.sort((a, b) => a.id - b.id);
    case "title-asc": return arr.sort((a, b) => a.title.localeCompare(b.title));
    case "title-desc": return arr.sort((a, b) => b.title.localeCompare(a.title));
    case "status": return arr.sort((a, b) => a.status.localeCompare(b.status));
    default: return arr;
  }
}, [filtered, sortOpt]);
```

- [ ] **Step 3: Replace `filtered` with `sorted` in render**

In all places where `filtered` is used for rendering (grid/list sections), replace with `sorted`. Also update the empty state check: `{sorted.length === 0 && ...}`

- [ ] **Step 4: Add sort select to filter bar**

In the filter bar area (where the existing `<select>` elements are), add after the "Semua Status" select:

```jsx
<select
  value={sortOpt}
  onChange={e => setSortOpt(e.target.value)}
  style={{
    padding: "8px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
    background: T.inputBg, color: T.text, fontSize: 13, cursor: "pointer",
    outline: "none",
  }}
>
  <option value="date-desc">Terbaru ↓</option>
  <option value="date-asc">Terlama ↑</option>
  <option value="title-asc">Judul A-Z</option>
  <option value="title-desc">Judul Z-A</option>
  <option value="status">Status</option>
</select>
```

- [ ] **Step 5: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 6: Commit**

```bash
git add src/components/DocPages.jsx
git commit -m "feat(sort): add sort dropdown to doc list"
```

---

## Task 14: Add Bulk API Endpoint

**Files:**
- Modify: `server/index.js`

**Interfaces:**
- Produces: `POST /api/docs/bulk` endpoint

- [ ] **Step 1: Add bulk endpoint**

In `server/index.js`, after existing single-doc endpoints, add:

```js
// Bulk actions
app.post("/api/docs/bulk", async (req, res) => {
  const { action, ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array required" });
  }

  try {
    let result;
    if (action === "delete") {
      result = await pool.query(
        "DELETE FROM bapperida_dokumen WHERE id = ANY($1)",
        [ids]
      );
    } else if (action === "archive") {
      result = await pool.query(
        "UPDATE bapperida_dokumen SET status = 'Diarsipkan' WHERE id = ANY($1)",
        [ids]
      );
    } else if (action === "approve") {
      result = await pool.query(
        "UPDATE bapperida_dokumen SET status = 'Disetujui' WHERE id = ANY($1)",
        [ids]
      );
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    // Log bulk action
    for (const id of ids) {
      try {
        await pool.query(
          "INSERT INTO audit_logs (user_name, action, doc_title) VALUES ($1, $2, $3)",
          [req.body.userName || "System", `bulk_${action}`, `doc_id:${id}`]
        );
      } catch (e) { /* ponytail: don't fail bulk action if logging fails */ }
    }

    res.json({ count: result.rowCount });
  } catch (err) {
    console.error("Bulk action error:", err);
    res.status(500).json({ error: "Bulk action failed" });
  }
});
```

- [ ] **Step 2: Verify server starts**

Run: `cd D:\Code\peta-ekonomi; node server/index.js` (Ctrl+C after startup message)
Expected: No errors on startup

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat(bulk): add POST /api/docs/bulk endpoint"
```

---

## Task 15: Add Bulk Selection UI to DocList

**Files:**
- Modify: `src/components/DocPages.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `handleBulkAction` from App.jsx (to be created)
- Produces: `selectedIds`, `selectMode` state; checkbox UI; floating action bar

- [ ] **Step 1: Add selection state to DocList**

In `DocList`, add state:

```jsx
const [selectedIds, setSelectedIds] = useState(new Set());
const selectMode = selectedIds.size > 0;
```

Add helper functions:

```jsx
const toggleSelect = (id) => {
  setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

const toggleSelectAll = () => {
  if (selectedIds.size === sorted.length) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(sorted.map(d => d.id)));
  }
};

const clearSelection = () => setSelectedIds(new Set());
```

- [ ] **Step 2: Add "Pilih" button to filter bar**

In the filter bar header area, add a button:

```jsx
<button
  onClick={() => {
    if (selectMode) clearSelection();
    else setSelectedIds(new Set(sorted.map(d => d.id)));
  }}
  style={{
    padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.border}`,
    background: selectMode ? T.primary : T.card, color: selectMode ? "#FFF" : T.text,
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  }}
>
  {selectMode ? "Batal" : "Pilih"}
</button>
```

- [ ] **Step 3: Add checkboxes to grid cards**

In each grid card rendering (tanpa bidang + folder docs), add a checkbox overlay:

```jsx
{selectMode && (
  <div
    onClick={(e) => { e.stopPropagation(); toggleSelect(d.id); }}
    style={{
      position: "absolute", top: 8, right: 8, width: 20, height: 20,
      borderRadius: 4, border: `2px solid ${selectedIds.has(d.id) ? T.primary : T.border}`,
      background: selectedIds.has(d.id) ? T.primary : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", zIndex: 10,
    }}
  >
    {selectedIds.has(d.id) && <span style={{ color: "#FFF", fontSize: 12, fontWeight: 700 }}>✓</span>}
  </div>
)}
```

Note: each card needs `position: "relative"` in its style for the absolute checkbox to work.

- [ ] **Step 4: Add checkboxes to list cards**

Same checkbox pattern for list view cards (tanpa bidang + folder docs).

- [ ] **Step 5: Add floating action bar**

At the bottom of DocList's return, before closing `</div>`:

```jsx
{selectMode && selectedIds.size > 0 && (
  <div style={{
    position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
    padding: "12px 20px", display: "flex", alignItems: "center", gap: 12,
    boxShadow: T.shadowMd, zIndex: 1000,
  }}>
    <span style={{ fontSize: 13, color: T.textSecondary, marginRight: 8 }}>
      {selectedIds.size} dokumen dipilih
    </span>
    <button
      onClick={() => {
        if (window.confirm(`Arsipkan ${selectedIds.size} dokumen?`)) {
          onBulkAction?.("archive", [...selectedIds]);
          clearSelection();
        }
      }}
      style={{
        padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.border}`,
        background: T.card, color: T.text, fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}
    >
      📁 Arsipkan
    </button>
    <button
      onClick={() => {
        if (window.confirm(`Hapus ${selectedIds.size} dokumen? Tindakan ini tidak dapat dibatalkan.`)) {
          onBulkAction?.("delete", [...selectedIds]);
          clearSelection();
        }
      }}
      style={{
        padding: "6px 14px", borderRadius: 8, border: "1px solid #FCA5A5",
        background: "#FEF2F2", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}
    >
      🗑️ Hapus
    </button>
  </div>
)}
```

- [ ] **Step 6: Add Escape key to exit select mode**

In the existing keyboard shortcuts useEffect, add:

```jsx
if (e.key === "Escape" && selectMode) {
  clearSelection();
  return; // don't also clearBidang
}
```

Note: need to add `selectMode` to the useEffect dependency array.

- [ ] **Step 7: Add handleBulkAction to App.jsx**

In `App.jsx`, add function:

```jsx
const handleBulkAction = async (action, ids) => {
  try {
    const res = await api("/api/docs/bulk", {
      method: "POST",
      body: JSON.stringify({ action, ids, userName: user?.name }),
    });
    // Refresh docs
    queryClient.invalidateQueries({ queryKey: ["docs"] });
  } catch (err) {
    console.error("Bulk action failed:", err);
  }
};
```

Pass to DocList: `onBulkAction={handleBulkAction}`

- [ ] **Step 8: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 9: Commit**

```bash
git add src/components/DocPages.jsx src/App.jsx
git commit -m "feat(bulk): add selection UI and floating action bar"
```

---

## Task 16: Create RecentActivity Component

**Files:**
- Modify: `src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `logs` array from App.jsx, `onNav` for navigation
- Produces: `RecentActivity` rendered in sidebar

- [ ] **Step 1: Add RecentActivity to Sidebar**

In `Sidebar.jsx`, add the component. Props: `{ logs, onNav }`.

```jsx
function RecentActivity({ logs = [], onNav }) {
  const { T } = useContext(ThemeContext);
  const recent = logs.slice(0, 10);
  if (recent.length === 0) return null;

  const actionIcon = (action) => {
    if (action?.includes("upload")) return "📤";
    if (action?.includes("archive") || action?.includes("arsip")) return "📁";
    if (action?.includes("delete") || action?.includes("hapus")) return "🗑️";
    if (action?.includes("review") || action?.includes("approve")) return "✅";
    return "📝";
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins}m lalu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}j lalu`;
    const days = Math.floor(hrs / 24);
    return `${days}h lalu`;
  };

  return (
    <div style={{ marginTop: 16, padding: "0 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, padding: "0 4px" }}>
        Aktivitas Terbaru
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {recent.map((log) => (
          <div
            key={log.id}
            style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "6px 8px", borderRadius: 6, cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.sidebarHover}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{actionIcon(log.action)}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, color: T.sidebarText, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ fontWeight: 600 }}>{log.user}</span>{" "}
                {log.action}{" "}
                <span style={{ fontWeight: 500 }}>{log.doc}</span>
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                {timeAgo(log.time)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add RecentActivity to sidebar render**

In the sidebar JSX, find the bottom section (after nav items, before user info). Add:

```jsx
{RecentActivity && <RecentActivity logs={logs} onNav={onNav} />}
```

Pass `logs` and `onNav` from parent (App.jsx passes them to Sidebar).

- [ ] **Step 3: Pass logs and onNav from App.jsx to Sidebar**

In `App.jsx`, find where `<Sidebar>` is rendered. Add props:

```jsx
<Sidebar logs={logs} onNav={goPage} ... />
```

- [ ] **Step 4: Build to verify**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.jsx src/App.jsx
git commit -m "feat(activity): add recent activity panel to sidebar"
```

---

## Task 17: Final Integration Test & Polish

**Files:**
- All modified files

- [ ] **Step 1: Full build**

Run: `cd D:\Code\peta-ekonomi; npm run build 2>&1 | Select-Object -Last 5`
Expected: ✓ built successfully

- [ ] **Step 2: Push to deploy**

```bash
git push
```

- [ ] **Step 3: Verify on live site**

Check: https://arsipdigital.mindcloud.my.id/
- Toggle dark mode via sidebar
- Search and verify highlight appears
- Sort documents using dropdown
- Select multiple docs and test archive/delete
- Check recent activity panel in sidebar

- [ ] **Step 4: Final commit if any polish needed**

```bash
git add -A
git commit -m "chore: polish and integration fixes"
git push
```
