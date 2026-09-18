# Task 16: Create RecentActivity Component

## Status: DONE

## What was done

- Added `RecentActivity` component inline in `Sidebar.jsx` (no separate file needed)
- Accepts `logs` prop, renders latest 5 entries with action icon, user, action, doc title, and relative time
- Uses `ThemeContext` for styling, fits compactly in sidebar
- Hidden when sidebar is collapsed
- Handles both server log format (`user_name`, `doc_title`, `created_at`) and local log format (`user`, `doc`, `time`)
- Passed `logs` prop from `App.jsx` to `Sidebar`

## Commits

- `143e818` — feat(activity): add recent activity panel to sidebar

## Concerns

None.
