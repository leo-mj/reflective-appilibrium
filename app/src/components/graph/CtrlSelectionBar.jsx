/**
 * @fileoverview The bar a ctrl+click selection on the Graph tab raises.
 * @module components/graph/CtrlSelectionBar
 */

import { C } from "../../constants/colors.js";

/**
 * Floating bar summarising a ctrl+click selection, with a button to turn it
 * into an argument — or, when `asRelation`, into a single relation whose type
 * is picked in the modal that follows.
 */
export function CtrlSelectionBar({
  selected,
  ctrlArgNodes,
  asRelation,
  onConfirm,
  onGroup,
  onCancel,
}) {
  if (!selected || ctrlArgNodes.length === 0) return null;
  const all = [selected, ...ctrlArgNodes];
  const premises = all.slice(0, -1);
  const conclusion = all.at(-1);
  // A relation's type is not chosen yet, so the bar stays neutral rather than
  // borrowing the entails colour.
  const accent = asRelation ? C.border : C.jointly_entails;
  const label = asRelation ? C.text : C.jointly_entails;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: "50%",
        transform: "translateX(-50%)",
        background: C.panel,
        border: `1px solid ${accent}`,
        borderRadius: 8,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12,
        color: C.text,
        whiteSpace: "nowrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        zIndex: 10,
      }}
    >
      <span style={{ color: C.dim }}>
        {premises.join(", ")}
        <span
          style={{
            color: label,
            fontWeight: "bold",
            margin: "0 6px",
          }}
        >
          →
        </span>
        {conclusion}
      </span>
      <button
        onClick={onConfirm}
        style={{
          background: asRelation ? "transparent" : C.jointly_entails + "22",
          border: `1px solid ${accent}`,
          borderRadius: 4,
          color: label,
          fontSize: 12,
          padding: "2px 10px",
          cursor: "pointer",
        }}
      >
        {asRelation ? "Add relation" : "Add argument"}
      </button>
      {/* Same selection, a different thing to do with it. Grouping says nothing
          about what follows from what, so it sits apart from the inferential
          action rather than replacing it. */}
      <button
        onClick={onGroup}
        aria-label="Group the selected elements"
        style={{
          background: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          color: C.dim,
          fontSize: 12,
          padding: "2px 10px",
          cursor: "pointer",
        }}
      >
        Group
      </button>
      <button
        onClick={onCancel}
        style={{
          background: "transparent",
          border: "none",
          color: C.dim,
          fontSize: 14,
          cursor: "pointer",
          padding: "0 2px",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
