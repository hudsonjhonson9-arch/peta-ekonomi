# Task 3 Brief: ui.jsx — `formatBytes`, `extractGDriveFolderId`, embed folder

**Goal:** Add two small exported helpers and teach `GoogleDriveEmbed` to render a Drive folder list when the URL points to a folder (i.e. contains `/folders/<id>`).

**File to modify:** `src/components/ui.jsx`

**Working directory:** `D:\Code\peta-ekonomi`

## Current Code Context (verbatim)

### `extractGDriveFileId` (lines 50-62):
```js
export function extractGDriveFileId(url) {
  if (!url) return null;
  // https://drive.google.com/file/d/FILE_ID/view?...
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // https://drive.google.com/open?id=FILE_ID
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // https://drive.google.com/uc?export=view&id=FILE_ID
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}
```

### `isGDriveUrl` (lines 64-66):
```js
export function isGDriveUrl(url) {
  return url && /drive\.google\.com/.test(url);
}
```

### `GoogleDriveEmbed` first 4 lines (68-71):
```js
export function GoogleDriveEmbed({ url, title, onClose }) {
  const fileId = extractGDriveFileId(url);
  if (!fileId) return null;
  const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
```

## Exact Changes

### Step 1: Add `extractGDriveFolderId`
Insert AFTER `extractGDriveFileId` (after line 62), BEFORE `isGDriveUrl`:

```js
export function extractGDriveFolderId(url) {
  if (!url) return null;
  const m = url.match(/\/folders\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
```

### Step 2: Add `formatBytes`
Insert AFTER `isGDriveUrl` (after line 66), BEFORE `GoogleDriveEmbed`:

```js
export function formatBytes(bytes) {
  if (!bytes) return "—";
  return bytes > 1048576
    ? (bytes / 1048576).toFixed(1) + ' MB'
    : (bytes / 1024).toFixed(0) + ' KB';
}
```

### Step 3: `GoogleDriveEmbed` — support folder URLs
Change the first 4 lines of the function body (lines 69-71) to:

```js
  const folderId = extractGDriveFolderId(url);
  const fileId = extractGDriveFileId(url);
  if (!folderId && !fileId) return null;
  const embedUrl = folderId
    ? `https://drive.google.com/embeddedfolderview?id=${folderId}#list`
    : `https://drive.google.com/file/d/${fileId}/preview`;
```

### Step 4: Verify build
Run: `npm run build` (from project root `D:\Code\peta-ekonomi`)
Expected: exit code 0, no errors.

### Step 5: Commit
```bash
git add src/components/ui.jsx
git commit -m "feat: dukung preview folder Drive (embeddedfolderview) + formatBytes"
```

## Constraints
- Do NOT change any other component or behavior. Only add the two helpers and adjust `GoogleDriveEmbed`'s URL selection.
- Keep existing style (named exports, EM dash `—` used elsewhere in the codebase).
- No new dependencies.