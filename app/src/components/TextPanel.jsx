/**
 * @fileoverview Thin layout wrapper around TextTab, handling the side-panel sizing.
 * @module components/TextPanel
 */

import { C } from "../constants/colors.js";
import { TextTab } from "./TextTab.jsx";

/**
 * @param {"left"|"right"} [side] - Which half of the row the panel occupies, so
 *   it is padded on the edge it shares with what is beside it. Analyze mode puts
 *   the text left of the graph; an assist tab keeps its workflow panel on the
 *   left and the text moves to the right of it.
 *
 *   The line on that edge belongs to the draggable divider between the two, not
 *   to this panel — see {@link module:hooks/useSplitRatio}. Wide, there is
 *   always one; narrow, the panel is the whole width and rules itself off from
 *   what is under it instead.
 * @param {string} [width] - Its share of the row, from the divider. Wide only:
 *   narrow it takes the width and the row is a column.
 */
export function TextPanel({
  isWide,
  clusterSectionRef,
  scrollToRelationsKey,
  side = "left",
  width = "50%",
  ...textTabProps
}) {
  const onRight = isWide && side === "right";
  return (
    <div
      data-tutorial="text-panel"
      style={{
        width: isWide ? width : "100%",
        flex: isWide ? undefined : 1,
        height: isWide ? "auto" : undefined,
        flexShrink: isWide ? 0 : undefined,
        borderBottom: isWide ? "none" : `1px solid ${C.border}`,
        paddingRight: isWide && !onRight ? 12 : 0,
        paddingLeft: onRight ? 12 : 0,
        paddingBottom: isWide ? 0 : 8,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <TextTab
        {...textTabProps}
        clusterSectionRef={clusterSectionRef}
        scrollToRelationsKey={scrollToRelationsKey}
        isWide={isWide}
      />
    </div>
  );
}
