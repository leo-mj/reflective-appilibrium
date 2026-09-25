/**
 * @fileoverview The Graph tab's own add buttons — + J, + P, + T, + Rel, + Arg,
 * + Grp — stacked in the canvas's top-right corner.
 * @module components/graph/AddButtonsOverlay
 */

import { C, typeTokens, inkOn } from "../../constants/colors.js";
import { usePalette } from "../../hooks/useTheme.js";
import { Tooltip } from "../Tooltip.jsx";

export function AddButtonsOverlay({
  onAddEl,
  onAddRel,
  onAddArg,
  onAddGroup,
  hideNonEntailsRels,
}) {
  const palette = usePalette();
  return (
    <div
      // Ringed by the tour when it gets to making your own position.
      data-tutorial="graph-add"
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {[
        ["judgment", "J"],
        ["principle", "P"],
        ["theory", "T"],
      ].map(([type, label]) => (
        <Tooltip key={type} text={`Add ${type}`}>
          <button
            onClick={() => onAddEl(type)}
            aria-label={`Add ${type}`}
            style={{
              // Fill matches the nodes it adds, in whichever mode is on. The ink
              // does not: this is an HTML control, where AA is enforced and the
              // node palette's black lands at 3.7:1 on the saturated violet. The
              // nodes themselves are a deliberate exception to that; a button is
              // not.
              background: typeTokens(type, palette).high,
              border: "none",
              color: inkOn(typeTokens(type, palette).high),
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + {label}
          </button>
        </Tooltip>
      ))}
      {!hideNonEntailsRels && (
        <Tooltip text="Add relation">
          <button
            onClick={onAddRel}
            aria-label="Add relation"
            style={{
              background: C.border,
              border: "none",
              color: C.text,
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            + Rel
          </button>
        </Tooltip>
      )}
      <Tooltip text="Add argument">
        <button
          onClick={onAddArg}
          aria-label="Add argument"
          style={{
            background: C.jointly_entails + "33",
            border: `1px solid ${C.jointly_entails}`,
            color: C.jointly_entails,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + Arg
        </button>
      </Tooltip>
      {/* The one affordance that says grouping exists at all. Ctrl-clicking
          nodes and choosing Group is the quicker way and the tooltip says so,
          but nobody discovers a modifier key by looking at a canvas. Chrome
          colours, not a relation's: a group asserts nothing. */}
      <Tooltip text="Bracket elements into a group, which can then collapse into one node. Ctrl/⌘-click nodes on the graph to group them there instead.">
        <button
          onClick={onAddGroup}
          aria-label="New group"
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.dim,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 13,
            cursor: "pointer",
            width: "100%",
          }}
        >
          + Grp
        </button>
      </Tooltip>
    </div>
  );
}
