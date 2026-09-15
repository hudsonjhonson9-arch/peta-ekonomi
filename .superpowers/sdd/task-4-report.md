# Task 4 Report: DocPages — File dalam Folder + Ikon Folder di List

## What Was Implemented

Four changes to `src/components/DocPages.jsx`:

1. **Import (line 2):** Added `formatBytes` to the named import from `./ui.jsx`.
2. **"Tanpa Bidang" grid map (~line 313):** Added `isFolder` const; swapped `<Icon name="file">` to `name={isFolder ? "folder" : "file"}`; replaced `{d.type}` with `{isFolder ? ...file count... : d.type}`.
3. **FolderDocs grid map (~line 447):** Added `isFolder` const; swapped icon to folder-aware; prepended file count to the `{d.sector} · {d.year}` meta line.
4. **DocDetail (~line 822):** Inserted a new "File dalam Folder" card between the Metadata Card and Approval Panel, rendering each file as a clickable link with name + `formatBytes(f.size)`.

## Verification

- **Command:** `npm run build`
- **Result:** Exit code 0. Vite v5.4.21, 92 modules transformed, built in 1.28s.

## Files Changed

| File | Lines changed |
|---|---|
| `src/components/DocPages.jsx` | +41 / −5 |

No other files were modified.

## Self-Review Findings

- All code matches the brief verbatim (inline styles, T tokens, isMobile, Card layout).
- List view (line ~650) left completely untouched.
- `doc.files` guard: `Array.isArray(doc.files) && doc.files.length > 0` — handles both `undefined` and empty `[]` correctly.
- `formatBytes` import path and usage match the `ui.jsx` contract.
- `key={f.url}` on file links assumes unique URLs — acceptable per brief.
- No new dependencies introduced.

## Concerns

None. All line numbers in the file matched the brief context exactly. The insert at line 822 was a clean boundary — no ambiguity with surrounding elements.
