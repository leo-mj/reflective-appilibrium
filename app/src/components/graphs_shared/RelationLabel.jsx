/**
 * @fileoverview The box an edge's type and explanation show in, under the pointer.
 *
 * One of the drawing components gathered in `GraphElements.jsx`, which both
 * graph tabs import from.
 *
 * @module components/graphs_shared/RelationLabel
 */

import { C } from "../../constants/colors.js";
import { RELATION_LABELS } from "../../utils/graphHelpers.js";
import { textMeasurer } from "../../utils/textWidth.js";
import { wrapWords } from "../../utils/wrapWords.js";

/** Metrics for the box an edge's explanation shows in, in screen px. */
const RELATION_LABEL = {
  fontSize: 12,
  lineHeight: 15,
  maxWidth: 240,
  maxLines: 6,
  padX: 8,
  padY: 6,
  /** Between the anchor on the edge and the box's bottom edge. */
  lift: 12,
  /** For the estimate where nothing can measure; see `utils/textWidth.js`. */
  charWidth: 0.6,
};

/**
 * What an edge says, shown while the pointer is on it (or after a tap): its
 * type, and the explanation given for it — which the graph otherwise never
 * shows, and which is most of what there is to read about a relation. A joint
 * argument shows each distinct explanation its premises carry.
 *
 * Held at one size on screen whatever the zoom, by scaling against it: a box
 * zoomed out with the graph would be unreadable exactly when the graph is
 * too small to follow without it. Outlined in the edge's colour, so it says
 * which edge it belongs to; written in the text colours, since relation
 * colours are not all legible as type (see `palette.edges`).
 *
 * @param {{ hit: { rel: object, rels: object[], x: number, y: number },
 *   zoom: number, color: string, fontFamily: string }} props
 */
export function RelationLabel({ hit, zoom, color, fontFamily }) {
  const { fontSize, lineHeight, maxWidth, maxLines, padX, padY, lift, charWidth } =
    RELATION_LABEL;
  const estimate = (s) => s.length * fontSize * charWidth;
  const measure = textMeasurer(`${fontSize}px ${fontFamily}`) ?? estimate;
  const measureBold = textMeasurer(`600 ${fontSize}px ${fontFamily}`) ?? estimate;

  const heading = RELATION_LABELS[hit.rel.type] ?? hit.rel.type;
  const explanations = [
    ...new Set(hit.rels.map((r) => r.explanation?.trim()).filter(Boolean)),
  ];
  const lines = explanations.flatMap((t) =>
    wrapWords(t, maxWidth, maxLines, measure),
  );
  const w =
    Math.max(measureBold(heading), ...lines.map(measure), 0) + 2 * padX;
  const h = (1 + lines.length) * lineHeight + 2 * padY;
  return (
    <g
      transform={`translate(${hit.x},${hit.y}) scale(${1 / zoom})`}
      style={{ pointerEvents: "none" }}
      data-testid="relation-label"
    >
      <rect
        x={-w / 2}
        y={-h - lift}
        width={w}
        height={h}
        rx={6}
        fill={C.panel}
        stroke={color}
        strokeWidth={1.5}
      />
      <text fontSize={fontSize} fill={C.text}>
        <tspan
          x={-w / 2 + padX}
          y={-h - lift + padY + fontSize}
          fontWeight={600}
        >
          {heading}
        </tspan>
        {lines.map((line, i) => (
          <tspan
            key={i}
            x={-w / 2 + padX}
            y={-h - lift + padY + fontSize + (i + 1) * lineHeight}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
