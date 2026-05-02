/**
 * @fileoverview Legend bar shown above all graph tabs.
 * @module components/Legend
 */

import { C } from "../../constants/colors.js";

export function Legend({ showWithdrawn, setShowWithdrawn, showRejected, setShowRejected }) {
  const items = [
    { label: "Judgment (high)", shape: "circle", color: "#2563eb" },
    { label: "Judgment (mod)", shape: "circle", color: "#60a5fa" },
    { label: "Judgment (low)", shape: "circle", color: "#93c5fd" },
    { label: "Principle", shape: "roundrect", color: "#7c3aed" },
    { label: "Theory", shape: "diamond", color: "#d97706" },
    { label: "Withdrawn", shape: "circle", color: "#64748b", toggle: "withdrawn" },
    { label: "Rejected", shape: "circle", color: "#fb7185", toggle: "rejected" },
  ];
  const lines = [
    { label: "Supports", color: C.supports, dash: "" },
    { label: "Conflicts", color: C.conflicts, dash: "8,4" },
    { label: "Undermines", color: C.undermines, dash: "4,4" },
  ];

  const isVisible = (it) => {
    if (it.toggle === "withdrawn") return showWithdrawn;
    if (it.toggle === "rejected") return showRejected;
    return true;
  };
  const handleClick = (it) => {
    if (it.toggle === "withdrawn") setShowWithdrawn?.((s) => !s);
    if (it.toggle === "rejected") setShowRejected?.((s) => !s);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        padding: "6px 0",
        fontSize: 11,
        color: C.dim,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          onClick={it.toggle ? () => handleClick(it) : undefined}
          title={it.toggle ? (isVisible(it) ? `Hide ${it.label.toLowerCase()}` : `Show ${it.label.toLowerCase()}`) : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            opacity: it.toggle ? (isVisible(it) ? 1 : 0.4) : 1,
            cursor: it.toggle ? "pointer" : "default",
          }}
        >
          {it.shape === "circle" && (
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: it.color,
              }}
            />
          )}
          {it.shape === "roundrect" && (
            <div
              style={{
                width: 14,
                height: 10,
                borderRadius: 3,
                background: it.color,
              }}
            />
          )}
          {it.shape === "diamond" && (
            <svg width={12} height={12} viewBox="0 0 12 12">
              <polygon points="6,0 12,6 6,12 0,6" fill={it.color} />
            </svg>
          )}
          {it.label}
        </div>
      ))}
      {lines.map((l) => (
        <div
          key={l.label}
          style={{ display: "flex", alignItems: "center", gap: 4 }}
        >
          <svg width={20} height={10}>
            <line
              x1={0}
              y1={5}
              x2={20}
              y2={5}
              stroke={l.color}
              strokeWidth={2}
              strokeDasharray={l.dash}
            />
          </svg>
          {l.label}
        </div>
      ))}
    </div>
  );
}
