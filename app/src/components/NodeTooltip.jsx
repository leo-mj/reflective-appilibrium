/**
 * @fileoverview Hover tooltip shown above a graph node.
 *
 * Shared between {@link module:components/Graph} and {@link module:components/HistoryTab}.
 * Rendered as an HTML `<div>` (not SVG) so it can overflow the SVG boundary.
 *
 * @module components/NodeTooltip
 */

/** @import { REElement } from '../types.js' */

import { createPortal } from "react-dom";
import { C } from "../constants/colors.js";

/**
 * @typedef {Object} TooltipState
 * @property {number}    x  - Horizontal position in the SVG container (px).
 * @property {number}    y  - Vertical position in the SVG container (px).
 * @property {REElement} el - The element being hovered.
 */

/**
 * Absolutely-positioned tooltip card rendered above a hovered graph node.
 * Returns `null` when `tooltip` is `null`.
 *
 * @param {Object}            props
 * @param {TooltipState|null} props.tooltip - Current tooltip data, or `null` to hide.
 * @returns {React.ReactElement|null}
 */
export function NodeTooltip({ tooltip }) {
  if (!tooltip) return null;
  const { x, y, el } = tooltip;
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: Math.round(x),
        top: Math.round(y),
        transform: "translate(-50%, -100%)",
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "8px 12px",
        maxWidth: 300,
        pointerEvents: "none",
        zIndex: 10,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          color: C.text,
          fontSize: 12,
          fontWeight: "bold",
          marginBottom: 4,
        }}
      >
        {el.id} ({el.type}) — {el.status}
      </div>
      <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.4 }}>
        {el.text}
      </div>
      {el.previousText && (
        <div
          style={{
            color: C.revised,
            fontSize: 10,
            marginTop: 4,
            fontStyle: "italic",
          }}
        >
          Previously: {el.previousText}
        </div>
      )}
      {el.reason && (
        <div
          style={{
            color: C.withdrawnMark,
            fontSize: 10,
            marginTop: 4,
            fontStyle: "italic",
          }}
        >
          Withdrawn: {el.reason}
        </div>
      )}
      <div style={{ color: C.dim, fontSize: 10, marginTop: 4 }}>
        Confidence: {el.confidence} · Origin: {el.origin}
        {el.addedRound && ` · Added: Round ${el.addedRound}`}
      </div>
    </div>,
    document.body,
  );
}
