/**
 * @fileoverview Thin layout wrapper around TextTab, handling the side-panel sizing.
 * @module components/TextPanel
 */

import { C } from "../constants/colors.js";
import { TextTab } from "./TextTab.jsx";

export function TextPanel({
  isWide,
  clusterSectionRef,
  scrollToRelationsKey,
  ...textTabProps
}) {
  return (
    <div
      data-tutorial="text-panel"
      style={{
        width: isWide ? "50%" : "100%",
        flex: isWide ? undefined : 1,
        height: isWide ? "auto" : undefined,
        flexShrink: isWide ? 0 : undefined,
        borderRight: isWide ? `1px solid ${C.border}` : "none",
        borderBottom: isWide ? "none" : `1px solid ${C.border}`,
        paddingRight: isWide ? 12 : 0,
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
