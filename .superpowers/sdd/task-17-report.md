# Task 17: Final Integration Test & Polish

## Status: DONE

## Build Status
- `npm run build` succeeded (2.08s)
- Chunk size warning is expected (pdf.js worker + react-query bundle)

## Features Implemented (Tasks 1-16)
1. **Dark Mode** — ThemeContext + theme tokens in theme.js, toggle in sidebar, CSS fallback in index.html
2. **Search Highlighting** — HighlightText component in DocPages.jsx and Pages.jsx
3. **Sort Dropdown** — Date/name/status sorting in DocList filter bar
4. **Bulk Actions** — POST /api/docs/bulk endpoint + selection UI with floating action bar
5. **Recent Activity** — Sidebar panel showing audit log entries

## Polish Applied in Task 17
- Replaced hardcoded `#fff` backgrounds in `makeInputStyle`/`makeSelStyle` with `T.inputBg`
- Fixed skeleton loader gradients to use `T.border`/`T.borderHover` instead of hardcoded colors
- Fixed drag overlay card background (`#fff` → `T.card`)
- Fixed floating action bar buttons (archive/publish/delete) to use theme tokens
- Fixed DocDetail action bar hover colors (`#E2E8F0` → `T.surfaceHover`, `#FEE2E2` → `T.dangerHover`, etc.)
- Added `warning`/`warningBg`/`warningBorder` tokens to theme.js for archive button
- Converted BankDataDashboard.jsx to use ThemeContext (was fully hardcoded)
- Converted BankData.jsx + NilaiRow to use ThemeContext (was fully hardcoded)

## Remaining Hardcoded Colors (intentional)
- **Color maps** (BIDANG_COLORS, FILE_TYPE_COLORS, EXT_MAP, TYPE_COLORS) — semantic category colors, not structural
- **Dashboard stat colors** (#2563EB, #2e7d32, #f57f17, #c62828) — intentional status accent colors
- **`#fff` on primary buttons** — white text on colored backgrounds, correct in both themes
- **`#f59e0b`** — notification badge accent color, intentional
- **Tooltip** (#0F172A bg) — intentionally dark for floating overlay

## Commits
- `dcf53fd` fix(theme): replace remaining hardcoded colors with theme tokens for dark mode

## Files Modified
- `src/theme.js` — added warning/warningBg/warningBorder tokens
- `src/components/DocPages.jsx` — theme tokens for inputs, skeleton, action bar, detail buttons
- `src/components/BankData.jsx` — full ThemeContext conversion
- `src/components/BankDataDashboard.jsx` — full ThemeContext conversion
