/**
 * @fileoverview The add bar folded away: it gives its height back to whatever
 * is above it and keeps one line, which is the whole way back.
 *
 * @module components/user_edits/CollapsedAddBar
 */

import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";

/**
 * It says which tab is folded, since what the bar was left holding is still in
 * there — minimising hides the bar, it does not clear it.
 *
 * Two things about the shape of it. **The chevron stays in the corner it was
 * pressed in**: a control that moves to the far side of the bar when used is
 * one the reader has to find again, and the pair reads as one switch only
 * while it holds still. And **the line is the button** rather than a button on
 * a line — a strip this wide holding a 24px chevron is a target to aim at —
 * with the chevron inside it, wearing the same box the minimise button wears
 * so that the corner looks the same too.
 *
 * No aria-label: the visible words are the accessible name, which is what
 * WCAG 2.5.3 asks and what an aria-label of its own would have broken. The
 * chevron is not part of the name, so it is hidden from it.
 *
 * @param {Object}   props
 * @param {Object}   props.barRef     - The bar's own, which sizes it.
 * @param {string}   props.tab        - The tab it is folded on.
 * @param {function} props.onExpand
 * @param {Object}   props.ghostStyle - The minimise button's box.
 */
export function CollapsedAddBar({ barRef, tab, onExpand, ghostStyle }) {
  return (
    <div
      ref={barRef}
      data-tutorial="add-bar"
      data-collapsed="true"
      style={{
        flexShrink: 0,
        borderTop: `1px solid ${C.border}`,
        background: C.panel,
        display: "flex",
      }}
    >
      <Tooltip text="Bring the add bar back">
        <button
          onClick={onExpand}
          aria-expanded={false}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            // The strip's own row, padded to the bar's own left and right edges
            // so the chevron lands where the minimise button stood.
            padding: "4px 16px",
            minHeight: 32,
            background: "transparent",
            border: "none",
            color: C.dim,
            font: "inherit",
            fontSize: 12,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          Show add bar
          {/* Which tab it is folded on: the one thing worth knowing before
            deciding to open it, and part of the name for the same reason. */}
          <span style={{ opacity: 0.75 }}>· {tab}</span>
          <span
            aria-hidden="true"
            style={{
              ...ghostStyle,
              padding: "3px 8px",
              // Out to the corner the ▾ was in. Decoration inside the button
              // rather than a button of its own: the whole line already answers
              // a click, and a second target inside the first would only be a
              // smaller way of doing the same thing.
              marginLeft: "auto",
              flexShrink: 0,
              cursor: "inherit",
            }}
          >
            ▴
          </span>
        </button>
      </Tooltip>
    </div>
  );
}
