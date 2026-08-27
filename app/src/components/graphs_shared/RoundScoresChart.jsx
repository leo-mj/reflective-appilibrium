/**
 * @fileoverview Z-score line chart shared by HistoryTab and TextTab.
 * @module components/graphs_shared/RoundScoresChart
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { scaleLinear, line as d3Line, curveMonotoneX } from "d3";
import { C } from "../../constants/colors.js";

export const SCORE_SERIES = [
  { key: "z", label: "Z-score", color: C.supports, width: 1 },
  { key: "account", label: "Account", color: C.judgment.accent, width: 0.5 },
  { key: "systematicity", label: "Systematicity", color: C.principle.accent, width: 0.5 },
  { key: "faithfulness", label: "Faithfulness", color: C.theory.accent, width: 0.5 },
];

/**
 * Compact SVG line chart of equilibrium Z-scores across workflow rounds.
 * A dashed vertical marker follows the playback slider position.
 *
 * @param {Object} props
 * @param {Array<{round: number, scores: Object|null}>} props.roundScores
 * @param {number} props.snappedRound  — current round for the vertical marker
 */
export function RoundScoresChart({ roundScores, snappedRound }) {
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(
    () =>
      roundScores
        .filter((rs) => rs.scores != null)
        .map((rs) => ({ round: rs.round, ...rs.scores })),
    [roundScores],
  );

  if (points.length < 2) {
    return (
      <div ref={containerRef} style={{ width: "100%", fontSize: 11, color: C.dim, paddingBottom: 4 }}>
        Not enough data to chart (need arguments in at least 2 rounds).
      </div>
    );
  }

  const W = 300;
  const H = 90;
  const m = { top: 6, right: 10, bottom: 20, left: 28 };
  const iW = W - m.left - m.right;
  const iH = H - m.top - m.bottom;

  const labelSize = containerWidth > 0 ? 11 * (W / containerWidth) : 9;

  const allValues = points.flatMap((d) => SCORE_SERIES.map(({ key }) => d[key]));
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const pad = Math.max((dataMax - dataMin) * 0.15, 0.02);
  const yMin = Math.max(0, dataMin - pad);
  const yMax = Math.min(1, dataMax + pad);

  const allRounds = roundScores.map((rs) => rs.round);
  const xMin = allRounds[0];
  const xMax = allRounds[allRounds.length - 1];
  const xScale = scaleLinear().domain([xMin, xMax]).range([0, iW]);
  const yScale = scaleLinear().domain([yMin, yMax]).range([iH, 0]);

  const makePath = (key) =>
    d3Line()
      .x((d) => xScale(d.round))
      .y((d) => yScale(d[key]))
      .curve(curveMonotoneX)(points);

  const labelEvery = allRounds.length <= 10 ? 1 : Math.ceil(allRounds.length / 10);
  const yTicks = scaleLinear().domain([yMin, yMax]).ticks(3);
  const fmtY = (v) => String(+v.toFixed(2));

  const markerInRange = snappedRound >= xMin && snappedRound <= xMax;
  const markerX = markerInRange ? xScale(snappedRound) : null;

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
        const dist = Math.hypot(xScale(d.round) - svgX, yScale(d[key]) - svgY);
        if (dist < minDist) {
          minDist = dist;
          best = { d, key, label, color };
        }
      }
    }
    if (best && minDist < THRESHOLD) {
      const pxPerSvg = rect.width / W;
      setTooltip({
        cx: (xScale(best.d.round) + m.left) * pxPerSvg,
        cy: (yScale(best.d[best.key]) + m.top) * pxPerSvg,
        label: best.label,
        color: best.color,
        value: best.d[best.key],
        round: best.d.round,
      });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", marginBottom: 4 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <g transform={`translate(${m.left},${m.top})`}>
          <rect x={0} y={0} width={iW} height={iH} fill="transparent" />

          {yTicks.map((t) => (
            <g key={t}>
              <line x1={0} x2={iW} y1={yScale(t)} y2={yScale(t)} stroke={C.border} strokeWidth={0.5} />
              <text x={-4} y={yScale(t)} textAnchor="end" dominantBaseline="middle" fill={C.dim} fontSize={labelSize}>
                {fmtY(t)}
              </text>
            </g>
          ))}

          {markerX != null && (
            <line
              x1={markerX} x2={markerX}
              y1={0} y2={iH}
              stroke={C.supports}
              strokeWidth={1}
              strokeDasharray="3,2"
              opacity={0.7}
            />
          )}

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

          {SCORE_SERIES.map(({ key, color }) =>
            hiddenSeries.has(key)
              ? null
              : points.map((d) => (
                  <circle
                    key={`${key}-${d.round}`}
                    cx={xScale(d.round)}
                    cy={yScale(d[key])}
                    r={0.8}
                    fill={d.round > snappedRound ? C.dim : color}
                    opacity={d.round > snappedRound ? 0.35 : 1}
                  />
                )),
          )}

          {allRounds.map((r, idx) =>
            idx % labelEvery === 0 ? (
              <text
                key={r}
                x={xScale(r)}
                y={iH + 13}
                textAnchor="middle"
                fill={r === snappedRound ? C.supports : C.dim}
                fontSize={labelSize}
                fontWeight={r === snappedRound ? "bold" : "normal"}
              >
                {r}
              </text>
            ) : null,
          )}
        </g>
      </svg>

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
          <span style={{ color: C.dim }}>Round {tooltip.round} · </span>
          <span style={{ color: tooltip.color, fontWeight: "bold" }}>{tooltip.label}</span>{" "}
          <span style={{ color: C.text }}>{tooltip.value.toFixed(3)}</span>
        </div>
      )}

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
