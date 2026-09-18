# Tasks 11-12 Report: HighlightText Component

**Status:** DONE

## What was done

### Task 11: Create HighlightText Component
- Created `src/components/HighlightText.jsx` — standalone component using ThemeContext for `T.markBg`
- Takes `text` and `query` props, splits text by query (case-insensitive regex), wraps matches in `<mark>` with theme background
- Handles empty query (returns plain text)

### Task 12: Apply HighlightText to Card Renderings
- **DocPages.jsx** — imported HighlightText, applied to 5 title locations:
  1. Grid tanpa bidang cards (`d.title`)
  2. Grid folder docs cards (`d.title`)
  3. List tanpa bidang cards (`d.title`)
  4. List folder docs cards (`d.title`)
  5. DocDetail title (`doc.title`)
- **Pages.jsx** — imported HighlightText, applied to Pencarian search results (`d.title` with `q` query)

## Commits
- `4913609` feat(search): add HighlightText component and apply to card renderings

## Build
- ✅ `npm run build` passes (2.17s)

## Concerns
- None
