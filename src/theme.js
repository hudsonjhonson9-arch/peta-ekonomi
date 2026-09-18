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
  primaryLight: "#EFF6FF",
  primaryRing: "#BFDBFE",
  shadowSm: "0 1px 2px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
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
  primaryLight: "#1E3A5F",
  primaryRing: "#60A5FA",
  shadowSm: "0 1px 3px rgba(0,0,0,0.3)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.4)",
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
