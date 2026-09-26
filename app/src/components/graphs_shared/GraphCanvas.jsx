/**
 * @fileoverview The SVG canvas both graph tabs draw on, with its view controls and off-screen arrows.
 *
 * One of the drawing components gathered in `GraphElements.jsx`, which both
 * graph tabs import from.
 *
 * @module components/graphs_shared/GraphCanvas
 */

/** @import { REElement } from '../../types.js' */

import { useEffect, useRef } from "react";
import { C } from "../../constants/colors.js";
import { elementRadius } from "../../utils/graphHelpers.js";
import { NodeTooltip } from "./NodeTooltip.jsx";
import { Tooltip } from "../Tooltip.jsx";
import { StatementCardIcon } from "../Icons.jsx";

const ZOOM_BTN = {
  width: 44,
  height: 44,
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  background: C.panel,
  color: C.dim,
  cursor: "pointer",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  padding: 0,
};

/**
 * Switches the graph's statement view on and off — see `hooks/useStatementView.js`.
 * One of the canvas's own controls rather than a ☰ setting, being a way of
 * reading this canvas and nothing else: the text panel, the other graph tabs
 * and the export do not follow it.
 *
 * @param {{ on: boolean, onToggle: function(): void }} props
 */
export function StatementToggle({ on, onToggle }) {
  return (
    <Tooltip text={on ? "Hide element text" : "Show element text"}>
      <button
        style={{
          ...ZOOM_BTN,
          ...(on && { color: C.text, borderColor: C.text }),
        }}
        onClick={onToggle}
        aria-label="Show element text"
        aria-pressed={on}
        // Ringed by the tour's section on the statement view.
        data-tutorial="statement-toggle"
      >
        <StatementCardIcon size={22} />
      </button>
    </Tooltip>
  );
}

/**
 * Shared SVG container used by both Graph and HistoryTab.
 *
 * @param {Object}              props
 * @param {React.Ref}           props.containerRef
 * @param {{ w: number, h: number }} props.dims
 * @param {{ x: number, y: number }} props.pan
 * @param {number}              [props.zoom=1]
 * @param {boolean}             props.isDragging
 * @param {Function}            props.onPointerDown
 * @param {Function}            props.onPointerMove
 * @param {Function}            props.onPointerUp
 * @param {Function}            [props.onPointerCancel]
 * @param {Function}            [props.onPointerLeave]
 * @param {Function}            [props.applyWheel]   - Non-passive wheel handler for zoom.
 * @param {Function}            [props.zoomIn]
 * @param {Function}            [props.zoomOut]
 * @param {React.ReactNode}     [props.viewControls] - Drawn above the zoom buttons.
 * @param {Object|null}         props.tooltip
 * @param {React.CSSProperties} [props.containerStyle]
 * @param {React.ReactNode}     [props.overlay]
 * @param {React.ReactNode}     [props.children]
 */
export function GraphCanvas({
  containerRef,
  dims,
  pan,
  zoom = 1,
  isDragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  applyWheel,
  zoomIn,
  zoomOut,
  viewControls,
  tooltip,
  tooltipActions,
  containerStyle,
  overlay,
  children,
}) {
  const svgRef = useRef(null);

  // Non-passive wheel listener so e.preventDefault() suppresses page scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !applyWheel) return;
    const handler = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyWheel(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [applyWheel]);

  return (
    <div ref={containerRef} style={{ position: "relative", ...containerStyle }}>
      {dims.w > 0 && (
        <svg
          ref={svgRef}
          width={dims.w}
          height={dims.h}
          style={{
            background: C.bg,
            borderRadius: 8,
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
            // A drag is a pan, and nothing drawn here is text to copy: without
            // this, panning across the canvas selects every label it passes.
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          onPointerDown={(e) => {
            // `userSelect` above covers the canvas and nothing else: a drag
            // that starts here and runs off the edge — a node carried to the
            // border, a pan overshooting it — went on to select the text panel
            // and the legend beside it. A press on the canvas starts no
            // selection at all, as the central divider's does not. Mouse only:
            // on a touch screen the default is what makes a long press work.
            if (e.pointerType === "mouse" && e.button === 0) {
              e.preventDefault();
              // The default also took the focus away from whatever held it —
              // the search box, a field in the add bar. That part is kept.
              document.activeElement?.blur?.();
            }
            onPointerDown?.(e);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerLeave}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {children}
          </g>
        </svg>
      )}
      {(zoomIn || zoomOut) && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {viewControls}
          <Tooltip text="Zoom in">
            <button style={ZOOM_BTN} onClick={zoomIn} aria-label="Zoom in">
              +
            </button>
          </Tooltip>
          <Tooltip text="Zoom out">
            <button style={ZOOM_BTN} onClick={zoomOut} aria-label="Zoom out">
              −
            </button>
          </Tooltip>
        </div>
      )}
      <NodeTooltip tooltip={tooltip} actions={tooltipActions} />
      {overlay}
    </div>
  );
}

const ARROW = { left: "◀", right: "▶", top: "▲", bottom: "▼" };

/**
 * Renders directional arrow badges at container edges for any nodes whose
 * screen position falls outside the visible area. Place as the `overlay` prop
 * of `GraphCanvas` (or composed alongside other overlays in a fragment).
 *
 * @param {Object}      props
 * @param {REElement[]} props.els       - Elements to check.
 * @param {PositionMap} props.positions - World-space positions keyed by element ID.
 * @param {{ x: number, y: number }} props.pan
 * @param {number}      props.zoom
 * @param {{ w: number, h: number }} props.dims
 * @param {string}      props.color     - Badge accent color.
 */
export function OffscreenIndicators({
  els,
  positions,
  pan,
  zoom,
  dims,
  color,
}) {
  const hidden = { left: false, right: false, top: false, bottom: false };
  els.forEach((el) => {
    const pos = positions[el.id];
    if (!pos) return;
    // A statement card is wider than tall; anything else is a radius both ways.
    const rx = (el.card?.hw ?? elementRadius(el)) * zoom;
    const ry = (el.card?.hh ?? elementRadius(el)) * zoom;
    const sx = pos.x * zoom + pan.x;
    const sy = pos.y * zoom + pan.y;
    if (sx - rx < 0) hidden.left = true;
    if (sx + rx > dims.w) hidden.right = true;
    if (sy - ry < 0) hidden.top = true;
    if (sy + ry > dims.h) hidden.bottom = true;
  });

  const sides = Object.keys(hidden).filter((s) => hidden[s]);
  if (!sides.length) return null;

  const badgePos = (side) =>
    ({
      left: { left: 4, top: "50%", transform: "translateY(-50%)" },
      right: { right: 4, top: "50%", transform: "translateY(-50%)" },
      top: { top: 4, left: "50%", transform: "translateX(-50%)" },
      bottom: { bottom: 4, left: "50%", transform: "translateX(-50%)" },
    })[side];

  return (
    <>
      {sides.map((side) => (
        <div
          key={side}
          style={{
            position: "absolute",
            pointerEvents: "none",
            ...badgePos(side),
            fontSize: 10,
            lineHeight: 1,
            padding: "2px 5px",
            borderRadius: 4,
            background: color + "33",
            border: `1px solid ${color}66`,
            color,
          }}
        >
          {ARROW[side]}
        </div>
      ))}
    </>
  );
}
