# Task 13: Add Sort Dropdown to DocList

## Status: DONE

## Changes
- Added `sortOpt` state (default: `"date-desc"`)
- Added `sorted` useMemo with 6 sort options: date-desc, date-asc, title-asc, title-desc, size-desc, size-asc
- Replaced `filtered` with `sorted` in `tanpaBidangDocs` and `folderDocs` memos
- Updated empty state check to use `sorted.length`
- Added sort `<select>` dropdown in filter bar after status filter

## Commit
- `3a46329` — feat(sort): add sort dropdown to doc list

## Concerns
- None
