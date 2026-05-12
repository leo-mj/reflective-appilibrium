/**
 * @fileoverview Legend bar shown above all graph tabs.
 * @module components/Legend
 */

import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";

export function Legend({ hiddenLegendKeys, setHiddenLegendKeys }) {
  const items = [
    {
      label: "Judgment (high)",
      shape: "circle",
      color: "#2563eb",
      key: "J-high",
    },
    {
      label: "Judgment (mod)",
      shape: "circle",
      color: "#60a5fa",
      key: "J-moderate",
    },
    {
      label: "Judgment (low)",
      shape: "circle",
      color: "#93c5fd",
      key: "J-low",
    },
    { label: "Principle", shape: "roundrect", color: "#7c3aed", key: "P" },
    { label: "Theory", shape: "diamond", color: "#d97706", key: "T" },
    { label: "Withdrawn", shape: "circle", color: "#64748b", key: "withdrawn" },
    { label: "Rejected", shape: "circle", color: "#fb7185", key: "rejected" },
  ];
  const lines = [
    { label: "Supports", color: C.supports, dash: "", key: "supports" },
    { label: "Conflicts", color: C.conflicts, dash: "8,4", key: "conflicts" },
    {
      label: "Undermines",
      color: C.undermines,
      dash: "4,4",
      key: "undermines",
    },
    { label: "(Jointly) Entails", color: C.jointly_entails, dash: "", key: "jointly_entails" },
    { label: "Jointly Precludes", color: C.jointly_precludes, dash: "", key: "jointly_precludes" },
  ];

  const hidden = (key) => hiddenLegendKeys?.has(key) ?? false;
  const toggle = (key) =>
    setHiddenLegendKeys?.((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const itemStyle = (key) => ({
    display: "flex",
    alignItems: "center",
    gap: 4,
    opacity: hidden(key) ? 0.4 : 1,
    cursor: "pointer",
    userSelect: "none",
  });

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
        <Tooltip
          key={it.key}
          text={
            hidden(it.key)
              ? `Show ${it.label.toLowerCase()}`
              : `Hide ${it.label.toLowerCase()}`
          }
          delay={100}
        >
          <div onClick={() => toggle(it.key)} style={itemStyle(it.key)}>
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
        </Tooltip>
      ))}
      {lines.map((l) => (
        <Tooltip
          key={l.key}
          text={
            hidden(l.key)
              ? `Show ${l.label.toLowerCase()}`
              : `Hide ${l.label.toLowerCase()}`
          }
          delay={100}
        >
          <div onClick={() => toggle(l.key)} style={itemStyle(l.key)}>
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
        </Tooltip>
      ))}
    </div>
  );
}
