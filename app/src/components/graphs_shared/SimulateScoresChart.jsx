/**
 * @fileoverview SVG line chart of Z, account, systematicity, and faithfulness
 * over RE evolution steps. Used by SimulateRethonTab.
 * @module components/SimulateScoresChart
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { scaleLinear, line as d3Line, curveMonotoneX } from "d3";
import { C } from "../../constants/colors.js";

export const SCORE_SERIES = [
  { key: "z", label: "Z-score", color: C.supports, width: 1 },
  { key: "account", label: "Account", color: C.judgment.high, width: 0.5 },
  { key: "systematicity", label: "Systematicity", color: C.principle.high, width: 0.5 },
  { key: "faithfulness", label: "Faithfulness", color: C.theory.high, width: 0.5 },
];

/** SVG line chart of Z, account, systematicity, and faithfulness over evolution steps. */
export function SimulateScoresChart({ scores }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [hiddenSeries, setHiddenSeries] = useState(new Set());

  const toggleSeries = (key) =>
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Measure the container so we can compute a compensating font size.
  // The SVG uses a fixed viewBox (keeping proportional scaling), and we derive
  // the label font size in SVG user units that renders as exactly 11 CSS px:
  //   labelSize = 11 × (viewBoxWidth / containerWidth)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pair each score with its step index; discard nulls (step 0 has no theory yet).
  const points = useMemo(
    () => scores.map((s, i) => (s ? { step: i, ...s } : null)).filter(Boolean),
    [scores],
  );

  if (points.length < 2) {
    return <div ref={containerRef} style={{ width: "100%" }} />;
  }

  const W = 300; // viewBox width (SVG user units)
  const H = 120; // viewBox height (SVG user units)
  const m = { top: 8, right: 10, bottom: 20, left: 28 };
  const iW = W - m.left - m.right;
  const iH = H - m.top - m.bottom;

  // Font size in SVG user units that renders as 11 CSS px at the current scale.
  const labelSize = containerWidth > 0 ? 11 * (W / containerWidth) : 9;

  // Auto-range y to the actual data with a little padding.
  const allValues = points.flatMap((d) => SCORE_SERIES.map(({ key }) => d[key]));
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const pad = Math.max((dataMax - dataMin) * 0.15, 0.02);
  const yMin = Math.max(0, dataMin - pad);
  const yMax = Math.min(1, dataMax + pad);

  const xMin = points[0].step;
  const xMax = points[points.length - 1].step;
  const xScale = scaleLinear().domain([xMin, xMax]).range([0, iW]);
  const yScale = scaleLinear().domain([yMin, yMax]).range([iH, 0]);

  const makePath = (key) =>
    d3Line()
      .x((d) => xScale(d.step))
      .y((d) => yScale(d[key]))
      .curve(curveMonotoneX)(points);

  const allSteps = points.map((p) => p.step);
  const labelEvery = allSteps.length <= 10 ? 1 : Math.ceil(allSteps.length / 10);
  const yTicks = scaleLinear().domain([yMin, yMax]).ticks(4);
  const fmtY = (v) => String(+v.toFixed(2));

  // Find the nearest data point by Euclidean distance in SVG user units.
  const THRESHOLD = 8;
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgPerPx = W / rect.width;
    const svgX = (e.clientX - rect.left) * svgPerPx - m.left;
    const svgY = (e.clientY - rect.top) * svgPerPx - m.top;

    let minDist = Infinity;
    let best = null;
    for (const { key, label, color } of SCORE_SERIES.filter((s) => !hiddenSeries.has(s.key))) {
      for (const d of points) {
        const dist = Math.hypot(xScale(d.step) - svgX, yScale(d[key]) - svgY);
        if (dist < minDist) {
          minDist = dist;
          best = { d, key, label, color };
        }
      }
    }
    if (best && minDist < THRESHOLD) {
      const pxPerSvg = rect.width / W;
      setTooltip({
        cx: (xScale(best.d.step) + m.left) * pxPerSvg,
        cy: (yScale(best.d[best.key]) + m.top) * pxPerSvg,
        label: best.label,
        color: best.color,
        value: best.d[best.key],
      });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", marginTop: 4, marginBottom: 8 }}
    >
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <g transform={`translate(${m.left},${m.top})`}>
          {/* Transparent background rect to capture mouse events */}
          <rect x={0} y={0} width={iW} height={iH} fill="transparent" />

          {/* Y gridlines */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={0} x2={iW} y1={yScale(t)} y2={yScale(t)}
                stroke={C.border} strokeWidth={0.5}
              />
              <text
                x={-4} y={yScale(t)}
                textAnchor="end" dominantBaseline="middle"
                fill={C.dim} fontSize={labelSize}
              >
                {fmtY(t)}
              </text>
            </g>
          ))}

          {/* Lines */}
          {SCORE_SERIES.map(({ key, color, width }) =>
            hiddenSeries.has(key) ? null : (
              <path
                key={key}
                d={makePath(key)}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ),
          )}

          {/* Dots */}
          {SCORE_SERIES.map(({ key, color }) =>
            hiddenSeries.has(key)
              ? null
              : points.map((d) => (
                  <circle
                    key={`dot-${key}-${d.step}`}
                    cx={xScale(d.step)}
                    cy={yScale(d[key])}
                    r={0.5}
                    fill={color}
                  />
                )),
          )}

          {/* X-axis step labels */}
          {allSteps.map((s, idx) =>
            idx % labelEvery === 0 ? (
              <text
                key={s}
                x={xScale(s)} y={iH + 13}
                textAnchor="middle" fill={C.dim} fontSize={labelSize}
              >
                {s}
              </text>
            ) : null,
          )}
        </g>
      </svg>

      {/* Tooltip — CSS pixel coordinates */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.cx + 8,
            top: tooltip.cy - 26,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 11,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          <span style={{ color: tooltip.color, fontWeight: "bold" }}>{tooltip.label}</span>{" "}
          <span style={{ color: C.text }}>{tooltip.value.toFixed(3)}</span>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: C.dim }}>
        {SCORE_SERIES.map(({ key, label, color, width }) => {
          const hidden = hiddenSeries.has(key);
          return (
            <span
              key={key}
              onClick={() => toggleSeries(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: hidden ? 0.4 : 1,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <svg width={14} height={4} style={{ flexShrink: 0 }}>
                <line x1={0} y1={2} x2={14} y2={2} stroke={color} strokeWidth={width * 2} />
              </svg>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
