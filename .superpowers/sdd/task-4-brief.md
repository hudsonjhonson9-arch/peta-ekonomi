# Task 4 Brief: DocPages — daftar file di detail + ikon folder di list

**Goal:** Show folder documents: (a) a "File dalam Folder" card in DocDetail listing each file's name + size in bytes, and (b) folder icon + file-count label in both DocList grids.

**File to modify:** `src/components/DocPages.jsx`

**Working directory:** `D:\Code\peta-ekonomi`

**Dependencies (already implemented):** `formatBytes(bytes)` is now exported from `./ui.jsx` — returns `"—"` for falsy, `"X.X MB"` for > 1 MiB, `"X KB"` otherwise. Documents will carry `doc.files` as an **array** (`[]` when none) — from the server, which now parses the `files` JSON column.

## Current Code Context (verbatim, exact line numbers)

### Import line (line 2):
```js
import { Icon, Badge, GoogleDriveEmbed, isGDriveUrl } from "./ui.jsx";
```

### DocDetail signature + context (around lines 731-741):
```js
export function DocDetail({ doc, onBack, onApprove, onReject, onDownload, onPreview, onTogglePublik, user }) {
  const { isMobile } = useResponsive();
  ...
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.title) || (doc.url && /\.(jpg|jpeg|png|gif|webp)/i.test(doc.url));
  const canEmbed = isGDriveUrl(doc.url);
```

### DocDetail Metadata Card ENDS at line 822:
```js
              ))}
            </div>
          </div>

          {/* Approval Panel */}
          {canApprove && (
```

### Grid "Tanpa Bidang" map callback (lines 313-356):
```js
            {tanpaBidangDocs.map((d, i) => {
              return (
                ...
                <Icon name="file" size={18} style={{ color: T.primary }} />     // line 345
                ...
                <div style={{ fontSize: 11, color: T.textSecondary }}>{d.type}</div>  // line 351
```

### Grid inside bidang map callback (lines 447-516):
```js
          {folderDocs.map((d, i) => {
            return (
              ...
              <Icon name="file" size={16} style={{ color: getBidangColor(d.bidang).text }} />   // line 488
              ...
              <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>           // line 506
                {d.sector} · {d.year}
              </div>
```

## Exact Changes

### Step 1: Update import (line 2)
```js
import { Icon, Badge, GoogleDriveEmbed, isGDriveUrl, formatBytes } from "./ui.jsx";
```

### Step 2: DocDetail — "File dalam Folder" card
Insert between the end of the Metadata Card `</div>` (line 821) and `{/* Approval Panel */}` (line 823):

```jsx
          {/* File dalam Folder */}
          {Array.isArray(doc.files) && doc.files.length > 0 && (
            <div style={{ ...cardStyle, padding: isMobile ? 20 : 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="folder" size={16} style={{ color: T.primary }} />
                File dalam Folder
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {doc.files.map(f => (
                  <a
                    key={f.url}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", background: T.bg, borderRadius: T.radius,
                      border: `1px solid ${T.border}`, textDecoration: "none",
                      color: "inherit", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = T.focusRing; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <Icon name="file" size={15} style={{ color: T.primary, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>{formatBytes(f.size)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
```

### Step 3: Grid "Tanpa Bidang" — folder icon + count
The map callback is `(d, i) => { return (...); }`. Change it to:
```js
            {tanpaBidangDocs.map((d, i) => {
              const isFolder = Array.isArray(d.files) && d.files.length > 0;
              return (
```

Change the icon (line 345):
```js
                      <Icon name={isFolder ? "folder" : "file"} size={18} style={{ color: T.primary }} />
```

Change the type line (line 351):
```js
                      <div style={{ fontSize: 11, color: T.textSecondary }}>
                        {isFolder ? `${d.files.length} file dalam folder` : d.type}
                      </div>
```

### Step 4: Grid inside bidang — folder icon + count
Change `folderDocs.map((d, i) => { return (` to:
```js
          {folderDocs.map((d, i) => {
            const isFolder = Array.isArray(d.files) && d.files.length > 0;
            return (
```

Change the icon (line 488):
```js
          <Icon name={isFolder ? "folder" : "file"} size={16} style={{ color: getBidangColor(d.bidang).text }} />
```

Change the meta line (lines 506-508):
```js
                <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 8 }}>
                  {isFolder ? `${d.files.length} file · ${d.sector} · ${d.year}` : `${d.sector} · ${d.year}`}
                </div>
```

### Step 5: Verify build
Run: `npm run build` from `D:\Code\peta-ekonomi`
Expected: exit code 0.

### Step 6: Commit
```bash
git add src/components/DocPages.jsx
git commit -m "feat: daftar file dalam folder di detail, ikon folder di list"
```

## Constraints
- Do NOT change list view, empty states, filters, or other doc types. Only the two maps and DocDetail's left column.
- The `Icon` component already supports `name="folder"` (it's defined in PATHS in ui.jsx).
- No new dependencies.
- Preserve existing style (inline styles, T tokens, isMobile).