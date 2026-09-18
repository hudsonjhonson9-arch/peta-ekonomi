# Design: 5 UI/UX Features for ARSIP DIGITAL BAPPERIDA

## Overview

Add 5 features to improve document management UX: bulk actions, search highlight, dark mode, sort dropdown, and recent activity sidebar.

---

## Feature 1: Bulk Actions

### Backend

**New endpoint** in `server/index.js`:

```
POST /api/docs/bulk
Body: { action: "delete" | "archive" | "approve", ids: [1, 2, 3] }
Response: { count: N }
```

- Single SQL transaction per action
- `delete`: `DELETE FROM bapperida_dokumen WHERE id = ANY($1)`
- `archive`: `UPDATE bapperida_dokumen SET status = 'Diarsipkan' WHERE id = ANY($1)`
- `approve`: `UPDATE bapperida_dokumen SET status = 'Disetujui' WHERE id = ANY($1)`
- Auth: admin can delete, admin+reviewer can archive/approve
- Log each action in `audit_logs` table

### Frontend

**New state** in `DocList` (`DocPages.jsx`):
- `selectedIds` — `Set` of document IDs
- `selectMode` — boolean, toggled by "Pilih" button in filter bar or long-press on mobile

**UI elements:**
- Checkbox on each card (top-right corner), always visible in select mode, visible on hover otherwise
- "Pilih Semua" checkbox in filter bar header (visible in select mode)
- Floating action bar at bottom when `selectedIds.size > 0`:
  - Count label: "3 dokumen dipilih"
  - "Arsipkan" button (archive icon)
  - "Hapus" button (trash icon, red, with confirm dialog)
  - "Batal" button to exit select mode

**Keyboard:** Escape exits select mode. After action: clear selection, invalidate query cache.

**Files:** `server/index.js`, `DocPages.jsx`, `App.jsx`

---

## Feature 2: Search Highlight

### Component

New `HighlightText` component in `DocPages.jsx`:

```jsx
function HighlightText({ text, query }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return <>{parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{background:"#FEF08A",padding:0,borderRadius:2}}>{p}</mark>
      : p
  )}</>;
}
```

### Usage

Replace `{d.title}` with `<HighlightText text={d.title} query={search} />` in:
- Grid tanpa bidang cards
- Grid folder docs cards
- List tanpa bidang cards
- List folder docs cards
- Pencarian page (`Pages.jsx`)

**Files:** `DocPages.jsx`, `Pages.jsx`

---

## Feature 3: Dark Mode

### Theme System

**New file** `src/theme.js`:
- Exports `LIGHT` and `DARK` objects (same shape as current `T` token object)
- `getTheme(preference)` function: resolves "system" → `prefers-color-scheme`, "light"/"dark" → direct

**Color mapping (dark palette):**

| Token | Light | Dark |
|-------|-------|------|
| bg | #F8FAFC | #0F172A |
| card | #FFFFFF | #1E293B |
| text | #0F172A | #F1F5F9 |
| textSecondary | #64748B | #94A3B8 |
| textMuted | #94A3B8 | #64748B |
| border | #E2E8F0 | #334155 |
| borderHover | #CBD5E1 | #475569 |
| primary | #2563EB | #3B82F6 |
| primaryLight | #EFF6FF | #1E3A5F |
| primaryRing | #BFDBFE | #60A5FA |
| shadowSm | 0 1px 2px rgba(0,0,0,0.05) | 0 1px 3px rgba(0,0,0,0.3) |
| sidebar bg | #0F172A | #020617 |
| sidebar hover | #1E293B | #0F172A |

### Context

`ThemeContext` in `App.jsx`:
- Provides `{ theme, isDark, toggleTheme }`
- `theme`: "light" | "dark" | "system"
- On mount: read `localStorage.getItem("theme")` || "system"
- On change: set `<html data-theme={resolved}>`, update localStorage
- CSS variables in `index.html` for `[data-theme="dark"]` fallback

### Toggle UI

Moon/Sun icon button in sidebar bottom area (next to user info):
- Click cycles: light → dark → system → light
- Shows current mode icon

### Token Propagation

Replace all hardcoded colors in components with `T.xxx` references:
- `Sidebar.jsx` — background, hover, text
- `BottomNav.jsx` — background, border, text
- `Dashboard.jsx` — card backgrounds, text colors
- `App.jsx` — shell background
- Already using `T` in: `DocPages.jsx`, `Pages.jsx`

**Files:** new `src/theme.js`, `App.jsx`, `index.html`, `DocPages.jsx`, `Pages.jsx`, `Sidebar.jsx`, `BottomNav.jsx`, `Dashboard.jsx`

---

## Feature 4: Sort Dropdown

### State

In `DocList` (`DocPages.jsx`):
```js
const [sortField, setSortField] = useState("date");
const [sortDir, setSortDir] = useState("desc");
```

### UI

Sort `<select>` in filter bar, after "Semua Status":
```
Terbaru ↓  |  Terlama ↑  |  Judul A-Z  |  Judul Z-A  |  Status
```

Single select — selecting an option sets both field and direction.

### Sorting Logic

Apply in the existing `filtered` useMemo (or a new `sorted` useMemo after it):
```js
const sorted = useMemo(() => {
  return [...filtered].sort((a, b) => {
    switch (sortField) {
      case "date": return sortDir === "desc" ? b.id - a.id : a.id - b.id;
      case "title": return sortDir === "desc"
        ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title);
      case "status": return a.status.localeCompare(b.status);
      default: return 0;
    }
  });
}, [filtered, sortField, sortDir]);
```

**Files:** `DocPages.jsx`

---

## Feature 5: Recent Activity

### Component

New `RecentActivity` in `Sidebar.jsx`:

**Structure:**
- Header: "Aktivitas Terbaru" + count badge
- List: last 10 entries from `logs` prop
- Each entry: icon (upload/archive/delete/review) + user + action + doc title + timeAgo
- Click entry → navigate to doc via `onNav`

**Visibility:** Only for admin + reviewer roles (`user.role === "ADMIN" || user.role === "KABID"`).

**Data:** Reuse existing `logs` state from App.jsx — no new API needed. Already has shape `{ id, user, action, doc, time }`.

**Files:** `Sidebar.jsx`, `App.jsx` (pass `logs` + `onNav` to sidebar)

---

## Implementation Order

1. **Dark Mode** — foundation first, affects all other UI changes
2. **Search Highlight** — standalone, no dependencies
3. **Sort Dropdown** — standalone, no dependencies
4. **Bulk Actions** — needs backend + frontend coordination
5. **Recent Activity** — depends on sidebar changes from dark mode

## Risk Areas

- Dark mode: most files touched, highest chance of regressions. Test each component after conversion.
- Bulk actions: transaction safety on backend. Use `ANY($1)` for IN clause.
- Search highlight: regex escaping for special characters in search query.
