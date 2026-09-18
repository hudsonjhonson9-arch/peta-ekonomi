# Task 6: Convert BottomNav.jsx to Use Theme

**Status:** DONE

**Changes:**
- Added `useContext` import to React import line
- Added `ThemeContext` import from `../App.jsx`
- Added `const { T } = useContext(ThemeContext)` at top of component
- Replaced hardcoded colors:
  - `#fff` → `T.bottomNavBg` (bar and popup background)
  - `#e8e8e8` → `T.border` (popup border), `T.bottomNavBorder` (bar border)
  - `rgba(0,0,0,0.12)` → `T.shadowMd` (popup shadow)
  - `#2563EB` → `T.primary` (active nav items)
  - `#999` → `T.textMuted` (inactive nav items)
  - `#333` → `T.text` (more menu item text)

**Build:** Passed
**Commit:** `d26d6e0` — feat(theme): convert BottomNav to use ThemeContext
