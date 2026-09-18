# Task 4: Convert Pages.jsx to Use Theme

## Status: DONE

## Changes

- Removed hardcoded `const T = { ... }` block (18+ token definitions duplicating theme.js)
- Added `import { ThemeContext } from "../App.jsx"` and `useContext, useMemo` to React imports
- Converted module-level style objects (`btnBase`, `btnPrimary`, `btnGhost`, `btnDanger`, `cardStyle`, `inputStyle`, `inputErrorStyle`) into a `makeStyles(T)` factory function — called via `useMemo` in each component
- Added `const { T } = useContext(ThemeContext)` to all 6 exported components: `Pencarian`, `PortalPublik`, `ManajemenPengguna`, `ManajemenKategoriDokumen`, `AuditTrail`, `ManajemenSektor`
- Replaced hardcoded color strings (`#0F172A`, `#666`, `#888`, `#999`, `#fff`, `#e8e8e8`, `#EFF6FF`, `#2563EB`, `#BFDBFE`, `#F1F5F9`, `#E2E8F0`, `#F87171`, `#f5f5f5`) with `T.*` tokens
- PortalPublik gradient now uses `T.sidebarBg` and `T.primary`
- inputStyle `background` changed from `#fff` to `T.inputBg`

## Files Modified

- `src/components/Pages.jsx` — 162 insertions, 185 deletions

## Commit

- `421e345` — `feat(theme): convert Pages.jsx to use ThemeContext`

## Build

- ✅ `npm run build` passes

## Notes

- `ROLE_COLOR` fallback badge colors (`#F1F5F9` / `#475569`) left as-is — these are semantic badge colors, not theme colors
- `ACTION_COLOR` map (AuditTrail) left as-is — semantic action colors
- `color: "#fff"` on primary buttons left as-is — intentional white-on-color contrast
