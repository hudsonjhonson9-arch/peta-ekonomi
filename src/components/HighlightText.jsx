import { useContext } from "react";
import { ThemeContext } from "../App.jsx";

export default function HighlightText({ text, query }) {
  const { T } = useContext(ThemeContext);
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return <>{parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: T.markBg || "#FEF08A", color: "inherit", padding: 0, borderRadius: 2 }}>{p}</mark>
      : p
  )}</>;
}
