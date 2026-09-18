# Task 8: Convert App.jsx Shell Colors to Use Theme

## Status: DONE

## Commit
- `1dcf470` feat(theme): use theme tokens for app shell colors

## Changes Made
Replaced 14 hardcoded color values in `src/App.jsx` with theme tokens from `T`:

| Location | Old Value | New Token |
|----------|-----------|-----------|
| Main container bg | `#f5f7f5` | `T.bg` |
| Topbar bg | `#fff` | `T.card` |
| Topbar border | `#e8e8e8` | `T.border` |
| Toggle button | `#666` | `T.textSecondary` |
| Mobile page title | `#0d2b1a` | `T.text` |
| "Halo," text | `#666` | `T.textSecondary` |
| FAB button bg | `#2563eb` | `T.primary` |
| ProfileMenu avatar | `#2563EB` | `T.primary` |
| ProfileMenu name | `#333` | `T.textSecondary` |
| ProfileMenu dropdown bg | `#fff` | `T.card` |
| ProfileMenu dropdown border | `#e8e8e8` | `T.border` |
| ProfileMenu dropdown shadow | hardcoded | `T.shadowLg` |
| ProfileMenu divider | `#f0f0f0` | `T.border` |
| ProfileMenu user name | `#0F172A` | `T.text` |
| ProfileMenu user role | `#888` | `T.textMuted` |
| ProfileMenu logout | `#c62828` | `T.danger` |

## Notes
- Added `useContext(ThemeContext)` to `ProfileMenu` component to access T tokens
- Warning/notification colors (`#f59e0b`) kept as-is — no T token for these
- FAB shadow kept as-is — hardcoded blue glow is intentional visual effect
- Build: ✓ passed
