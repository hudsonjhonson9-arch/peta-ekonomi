# Task 3: Convert DocPages.jsx to Use Theme

## Status: DONE

## Commits
- `7ef9589` — feat(theme): convert DocPages.jsx to use ThemeContext

## Changes
- **DocPages.jsx**: Removed hardcoded `const T = { ... }` block. Added `useContext(ThemeContext)` in `DocList` and `DocDetail`. Converted module-level style objects (`btnBase`, `cardStyle`, `inputStyle`, `selStyle`) to `make*` helper functions that take `T` as parameter (since they can't be module-level constants anymore).
- **theme.js**: Added missing properties to LIGHT and DARK (`primaryHover`, `danger*`, `success*`, `focusRing`, `shadowLg`, `radius`, `radiusLg`, `font`) that DocPages.jsx referenced but weren't in the original theme objects.

## Concerns
- None.
