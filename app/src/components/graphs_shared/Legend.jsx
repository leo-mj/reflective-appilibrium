/**
 * @fileoverview Legend bar shown above all graph tabs.
 * @module components/Legend
 */

import { C } from "../../constants/colors.js";
import { usePalette } from "../../hooks/useTheme.js";
import { Tooltip } from "../Tooltip.jsx";

export function Legend({ hiddenLegendKeys, setHiddenLegendKeys, hideNonEntailsRels }) {
  // The element swatches come from the palette in force, not from the fixed
  // accent tones: a legend that keeps showing the default blue while the graph
  // is drawn in the high-contrast one is worse than no legend.
  const palette = usePalette();
  const items = [
    { label: "Judgment", shape: "judgment-gradient", ramp: palette.judgment, key: "J" },
    { label: "Principle", shape: "roundrect", color: palette.principle.high, key: "P" },
    { label: "Theory", shape: "diamond", color: palette.theory.high, key: "T" },
    { label: "Withdrawn", shape: "circle", color: C.withdrawn, key: "withdrawn" },
    { label: "Rejected", shape: "circle", color: C.rejected, key: "rejected" },
  ];
  // Lines follow the palette too, for the same reason: high-contrast mode
  // retunes every relation colour, and a legend naming the old ones would be
  // telling the reader something the canvas is not doing.
  const e = palette.edges;
  const lines = [
    ...(!hideNonEntailsRels ? [
      { label: "Supports", color: e.supports, dash: "", key: "supports" },
      { label: "Conflicts", color: e.conflicts, dash: "8,4", key: "conflicts" },
      { label: "Undermines", color: e.undermines, dash: "4,4", key: "undermines" },
      { label: "Depends on", color: e.depends, dash: "", key: "depends" },
    ] : []),
    { label: "Entails", color: e.entails, dash: "", key: "entails" },
    { label: "Jointly Entails", color: e.jointly_entails, dash: "", key: "jointly_entails" },
    { label: "Precludes", color: e.precludes, dash: "", key: "precludes" },
    { label: "Jointly Precludes", color: e.jointly_precludes, dash: "", key: "jointly_precludes" },
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
            {it.shape === "judgment-gradient" && (
              <div
                style={{
                  width: 22,
                  height: 10,
                  borderRadius: 5,
                  // The whole confidence ramp in one swatch — which is what
                  // makes it the judgment entry rather than a plain circle.
                  background: `linear-gradient(to right, ${it.ramp.low}, ${it.ramp.high})`,
                  border: `1px solid ${it.ramp.stroke}`,
                }}
              />
            )}
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
            <svg width={24} height={10}>
              <line
                x1={0}
                y1={5}
                x2={17}
                y2={5}
                stroke={l.color}
                strokeWidth={l.key === "entails" || l.key === "precludes" ? 3 : 2}
                strokeDasharray={l.dash}
              />
              {l.key === "entails" || l.key === "precludes" ? (
                <polygon
                  points="24,5 17,2 17,8"
                  fill="none"
                  stroke={l.color}
                  strokeWidth={1.5}
                />
              ) : (
                <polygon points="24,5 17,2 17,8" fill={l.color} />
              )}
            </svg>
            {l.label}
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
