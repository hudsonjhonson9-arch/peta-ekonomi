# Task 9 Report: Add Dark Mode Toggle to Sidebar

**Status:** DONE

## Changes

- `src/components/ui.jsx`: Added `moon`, `sun`, `monitor` SVG paths to the Icon PATHS object
- `src/components/Sidebar.jsx`: Added theme toggle button in sidebar footer (above user info section)
  - Destructures `theme` and `setTheme` from ThemeContext
  - 3-way cycle: system → light → dark → system
  - Shows icon (monitor/sun/moon) and label (Sistem/Terang/Gelap)
  - Matches sidebar styling with hover effects
  - Supports collapsed mode with title tooltip

## Commits

- `1027dee` feat(dark-mode): add theme toggle to sidebar

## Notes

- Added proper SVG icons to `ui.jsx` instead of using emojis (consistent with codebase)
- Plan suggested emojis; replaced with `<Icon>` for consistency with existing icon system
