# Task 14-15 Report: Bulk API Endpoint & Bulk Selection UI

**Status:** DONE

**Commits:**
- `be65da2` — feat(bulk): add bulk API endpoint and selection UI

## Task 14: Bulk API Endpoint

Added `POST /api/docs/bulk` to `server/index.js`:
- Accepts `{ action: "delete"|"archive"|"publish", ids: [1,2,3] }`
- Rate limiting: max 50 IDs per request
- SQL transactions via `pool.connect()` + BEGIN/COMMIT/ROLLBACK
- Actions: delete (`DELETE FROM ... WHERE id = ANY($1)`), archive (`UPDATE ... SET status = 'Diarsipkan'`), publish (`UPDATE ... SET publik = true`)
- Audit log entry for bulk operations
- Returns `{ success: true, affected: N }`

## Task 15: Bulk Selection UI

Modified `src/components/DocPages.jsx`:
- `selectedIds` state (Set) and `selectionMode` state (boolean)
- "Pilih/Batal" toggle button in filter bar
- Checkboxes on all document cards (visible when selectionMode is true)
- Checkboxes positioned absolutely in top-right corner of cards
- Selected cards highlighted with `T.primaryLight` background
- Card click blocked when in selection mode (doesn't open doc)
- Floating action bar at bottom center when items selected:
  - Shows "{N} dipilih" count
  - Archive button (yellow theme)
  - Publish button (green theme)
  - Delete button (red theme)

Modified `src/App.jsx`:
- Added `handleBulkAction(action, ids)` handler
- Confirmation dialog before executing bulk action
- Local state updates after successful API call
- Cache invalidation via react-query
- Passes `onBulkAction` prop to DocList

## Concerns

None. All icons used (`archive`, `world`, `trash`, `check`, `x`) exist in the Icon component's PATHS map.
