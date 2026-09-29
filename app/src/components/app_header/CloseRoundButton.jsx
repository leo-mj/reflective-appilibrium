/**
 * @fileoverview The header's way to close a round by hand.
 *
 * A round is a run of steps (stateUtils, "Steps and rounds"). The workflow
 * closes one as each iteration completes; this is for a reader working without
 * it, or who wants to mark a point in the middle of one. Beside the heading
 * that shows the round, rather than in the menu, since the heading is where a
 * reader looks for what round it is.
 * @module components/app_header/CloseRoundButton
 */

import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";

/**
 * @param {Object}   props
 * @param {number}   props.round    - The round open now.
 * @param {boolean}  props.enabled  - Whether it has anything in it to close.
 * @param {Function} props.onClose
 */
export function CloseRoundButton({ round, enabled, onClose }) {
  return (
    // `wrap`: a disabled button fires no mouse events, and "why can't I?" is
    // exactly when the tooltip is wanted.
    <Tooltip
      wrap
      text={
        enabled
          ? `Close round ${round}: the changes since the last close become one round, and the next change starts round ${round + 1}.`
          : `Nothing has changed in round ${round} yet, so there is nothing to close.`
      }
    >
      <button
        onClick={onClose}
        disabled={!enabled}
        style={{
          background: "transparent",
          border: `1px solid ${enabled ? C.supportsText : C.border}`,
          borderRadius: 4,
          color: enabled ? C.supportsText : C.dim,
          cursor: enabled ? "pointer" : "not-allowed",
          fontSize: 11,
          padding: "2px 8px",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Close round
      </button>
    </Tooltip>
  );
}
