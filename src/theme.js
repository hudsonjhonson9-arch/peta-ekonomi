// src/theme.js
const LIGHT = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  borderHover: "#CBD5E1",
  primary: "#2563EB",
  primaryHover: "#1D4ED8",
  primaryLight: "#EFF6FF",
  primaryRing: "rgba(37,99,235,0.15)",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  dangerHover: "#FEE2E2",
  dangerRing: "rgba(220,38,38,0.15)",
  warning: "#D97706",
  warningBg: "#FEF3C7",
  warningBorder: "#FDE68A",
  surfaceHover: "#F8FAFC",
  success: "#059669",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  successHover: "#D1FAE5",
  focusRing: "0 0 0 3px rgba(37,99,235,0.15)",
  shadowSm: "0 1px 2px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
  shadowLg: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)",
  radius: "10px",
  radiusLg: "14px",
  font: "'Lexend', 'Source Sans 3', system-ui, -apple-system, sans-serif",
  sidebarBg: "#0F172A",
  sidebarHover: "#1E293B",
  sidebarText: "#CBD5E1",
  sidebarTextActive: "#FFFFFF",
  bottomNavBg: "#FFFFFF",
  bottomNavBorder: "#E2E8F0",
  inputBg: "#FFFFFF",
  inputBorder: "#E2E8F0",
  markBg: "#FEF08A",
};

const DARK = {
  bg: "#0F172A",
  card: "#1E293B",
  text: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  border: "#334155",
  borderHover: "#475569",
  primary: "#3B82F6",
  primaryHover: "#60A5FA",
  primaryLight: "#1E3A5F",
  primaryRing: "rgba(59,130,246,0.25)",
  danger: "#F87171",
  dangerBg: "#450A0A",
  dangerBorder: "#7F1D1D",
  dangerHover: "#991B1B",
  dangerRing: "rgba(248,113,113,0.25)",
  warning: "#FBBF24",
  warningBg: "#78350F",
  warningBorder: "#92400E",
  surfaceHover: "#1E293B",
  success: "#34D399",
  successBg: "#064E3B",
  successBorder: "#065F46",
  successHover: "#047857",
  focusRing: "0 0 0 3px rgba(59,130,246,0.25)",
  shadowSm: "0 1px 3px rgba(0,0,0,0.3)",
  shadowMd: "0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3)",
  shadowLg: "0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -4px rgba(0,0,0,0.3)",
  radius: "10px",
  radiusLg: "14px",
  font: "'Lexend', 'Source Sans 3', system-ui, -apple-system, sans-serif",
  sidebarBg: "#020617",
  sidebarHover: "#0F172A",
  sidebarText: "#94A3B8",
  sidebarTextActive: "#FFFFFF",
  bottomNavBg: "#1E293B",
  bottomNavBorder: "#334155",
  inputBg: "#1E293B",
  inputBorder: "#334155",
  markBg: "#854D0E",
};

function getTheme(preference) {
  if (preference === "dark") return DARK;
  if (preference === "light") return LIGHT;
  // system
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return DARK;
  }
  return LIGHT;
}

function isDarkTheme(preference) {
  if (preference === "dark") return true;
  if (preference === "light") return false;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return true;
  }
  return false;
}

export { LIGHT, DARK, getTheme, isDarkTheme };
