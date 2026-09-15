# Task 2 Report: GAS — `createFolder`, `folderId`, `group`, `registerFolder`

## What I implemented

Edited `google-apps-script/Code.gs` only:

1. **Step 1 — `createFolder` action** (inserted after `chunk` block): validates `folderName`, creates a subfolder under `DRIVE_FOLDER_ID`, sets ANYONE_WITH_LINK/VIEW sharing, returns `{ folderId, folderUrl }`.
2. **Step 2 — `initiate` optional parent**: `metadata.parents = params.folderId ? [params.folderId] : [DRIVE_FOLDER_ID]`.
3. **Step 3 — `direct` folder + group guard**:
   - `var folder = params.folderId ? DriveApp.getFolderById(params.folderId) : DriveApp.getFolderById(DRIVE_FOLDER_ID);`
   - DB POST wrapped in `if (!params.group) { ... }`; `return res(200, ...)` stays outside a step up.
4. **Step 4 — `finalize` group guard**: DB POST (apiPayload/apiOpts/API_KEY/fetch) wrapped in `if (!params.group) { ... }`; `file.setSharing`, `sizeLabel`, and `return res` stay outside.
5. **Step 5 — `registerFolder` action** (inserted after `finalize`, before MODE DIRECT): validates `title`+`files`, sums `f.size` for `sizeLabel`, posts `apiPayload` (incl. `files` array and `url: params.folderUrl || ''`), returns `{ message, url, ukuran, files: files.length }`.

All code matches the brief verbatim (braces, indentation 2-space, ES5 `var` style, Indonesian comments).

## Verification

- **Cannot run GAS locally** (browser-pasted deployment). No `node --check` attempted (GAS dialect, not Node — brief disallows).
- Visual + scripted brace review: programmatically stripped comments and counted braces — **60 opens / 60 closes, depth returns to 0, never negative (min 0, max 6)**.
- Confirmed each `if (action === ...)` block opens in order: initiate (L42), chunk (L86), createFolder (L124), finalize (L141), registerFolder (L192), MODE DIRECT fallback (L239).
- Re-read full file after edits: every `{`/`}` paired, indentation consistent, no existing block damaged.
- `doGet`, `doOptions`, constants, comment blocks, `chunk` untouched.
- Diff order check: `params.folderId ?` guards added only to `initiate` metadata and `direct`; `!params.group` guards in both `finalize` and `direct`.

## Files changed

- `google-apps-script/Code.gs` (239 → 307 lines)

## Self-review findings

- Direct mode's `var folder`/`var file` live in `doPost` function scope and are reused only there; `!params.group` wrap keeps 1-file/drive-link flows byte-identical behaviorally.
- `files.reduce` is ES5-safe (GAS ok).

## Concerns (validate at deploy time)

- Frontend must send `folderName` to `createFolder`, then pass returned `folderId` to `initiate`/`direct`, `group:true` to `direct`/`finalize`, and call `registerFolder` once with `title` + `files` array — nothing in GAS validates cross-action consistency (server task's job).
- Advanced Drive Service must be enabled for `createFolder` on a folder (already used elsewhere, so expected enabled).
- `registerFolder` passes `files` to the API `/api/docs` endpoint — the server must accept a `files` array (Task 1 added `files` column; JSON array handling is a deploy-time check).