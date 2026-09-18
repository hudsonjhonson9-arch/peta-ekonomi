# Task 2: Add ThemeContext to App.jsx

**Status:** DONE

**Commits:**
- `ef0ca16` feat(theme): add ThemeContext provider to App

**Changes:**
- Added `createContext`, `useMemo` imports from React
- Added `LIGHT`, `DARK`, `getTheme`, `isDarkTheme` imports from `./theme.js`
- Created `ThemeContext` with default value `{ T: LIGHT, isDark: false, theme: "system", setTheme: () => {} }`
- Exported `ThemeContext` for child components to import
- Added `theme` state (persisted to localStorage, default "system")
- Added `T` and `isDark` via `useMemo`
- Added `setTheme` function that updates state + localStorage + `data-theme` attribute
- Added `useEffect` to set `data-theme` on mount/change
- Wrapped entire return JSX with `<ThemeContext.Provider value={{ T, isDark, theme, setTheme }}>`
- Cleaned up duplicate `useState2` import (was unnecessary)

**Concerns:** None
