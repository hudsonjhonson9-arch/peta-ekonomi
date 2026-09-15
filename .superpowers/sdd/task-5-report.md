# Task 5 Report: App.jsx — alur folder di handleUpload

## What I implemented
All 7 steps from the brief, applied exactly, inside `handleUpload` only:

1. **Setup alur folder** (before `try {`): `groupMode = form.fileObjs.length > 1`, plus `folderId`/`folderUrl = null`.
2. **`var groupFiles = []`** added next to `var allDocs = []`.
3. **createFolder once before loop**: `if (groupMode)` → `gasPost({action:"createFolder", folderName: form.title})` → throws on error/missing folderId, stores `folderId`/`folderUrl`.
4. **`direct` payload**: added `folderId: groupMode ? folderId : undefined`, `group: groupMode`.
5. **`initiate` payload**: added `folderId: groupMode ? folderId : undefined`.
6. **`finalize` payload**: added `group: groupMode`.
7. **Group collection**: after `if (result.error) throw ...`, `if (groupMode)` pushes `{name,url,size}` to `groupFiles` and `continue` — skips `allDocs.push`.
8. **registerFolder block**: after loop, `if (groupMode)` calls `registerFolder` with `folderUrl` + `files: groupFiles`; builds `folderDoc` (size from `reg.ukuran`, url from `reg.url || folderUrl`, includes `files: groupFiles`), prepends to docs, logs, invalidates, navigates, shows folder toast, `return`. Existing 1-file `if (allDocs.length > 0)` block left verbatim as fallback.

## Verification
Command: `npm run build` (from `D:\Code\peta-ekonomi`)
Result: exit 0. Output:
```
vite v5.4.21 building for production...
✓ 92 modules transformed.
dist/index.html               1.33 kB │ gzip: 0.66 kB
dist/assets/index-CQXZYAC1.js 315.92 kB │ gzip: 84.72 kB
✓ built in 866ms
```

## Files changed
- `src/App.jsx` — only file committed. (62 insertions, +1 file in commit.)
- Also created `D:\Code\peta-ekonomi\.superpowers\sdd\task-5-report.md` and the untracked brief/lint artifacts already present in `.superpowers/` — NOT staged.

## Self-review findings
- **Line-number match**: perfect. Brief's quoted line numbers (222-361) matched the file exactly before edits. No drift; anchored to the verbatim snippets as-is.
- **1-file path unchanged behavior**: `groupMode=false` → no createFolder call, `folderId`/`folderUrl` stay null, `direct`/`initiate`/`finalize` send `undefined`/false (dropped as absent by JSON.stringify), no `groupFiles.push`/`continue`, identical `allDocs.push`, identical toast. Byte-level: the only deltas are the three new var declarations.
- **fileUrl / Drive-URL mode untouched** (lines 194-220) — confirmed unchanged.
- **`continue` is valid** — inside the `for` loop; `groupFiles` collected across both direct and resumable branches (both set `result` before the pushed block).
- **`groupFiles` used before its `var` declaration?** No — `var groupFiles = []` is at top of `try`, before the loop. Hoisting consistent with surrounding style (`var` everywhere).
- No changes to `gasPost`, `DIRECT_THRESHOLD`, `CHUNK_SIZE`, or chunk loop.

## Concerns
- None blocking. Minor: `groupFiles` entries carry `size: fobj.size` (client-reported bytes); GAS `registerFolder` computes `ukuran` server-side, so the display size (`reg.ukuran`) is authoritative — consistent with brief.
- Untracked `.superpowers/` and `docs/superpowers/plans/...md` left unstaged per instruction to stage only `src/App.jsx`.

## Commit
- `44b5447` feat: upload multi-file jadi satu folder Drive + satu dokumen (HEAD before work was `8c88fd3`)