/**
 * @fileoverview The narrow screen's way in to adding: a floating + that opens
 * the same add bar the wide layout keeps permanently at the foot of the panel.
 *
 * It hosts {@link module:components/TextTabAddPanel} rather than dialogs of its
 * own, so the two layouts cannot drift. The element, relation and argument
 * tabs, the multi-premise argument builder, the validation, and the rule that
 * withholds the relation tab while the graph is showing arguments only all come
 * from there and are the same on both. What differs is only the container: a
 * sheet over the list rather than a bar beneath it, because at this width there
 * is no room to show both the position and the form for adding to it.
 * @module components/text_panel/MobileAddButton
 */

/** @import { REElement } from '../../types.js' */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { AddBar } from "../user_edits/TextTabAddPanel.jsx";

/**
 * @param {Object}      props
 * @param {REElement[]} props.elements - Elements that may be referenced; see linkableElements.
 * @param {function}    props.onAddElement
 * @param {function}    props.onAddRelation
 * @param {boolean}     [props.hideNonEntailsRels] - Passed through: with plain
 *   relations hidden the bar offers arguments in their place.
 */
export function MobileAddButton({
  elements,
  onAddElement,
  onAddRelation,
  hideNonEntailsRels,
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Add to your position"
        aria-expanded={open}
        style={{
          position: "absolute",
          bottom: 10,
          right: 10,
          zIndex: 99,
          background: C.supports,
          border: "none",
          borderRadius: 6,
          color: "#fff",
          cursor: "pointer",
          fontSize: 20,
          lineHeight: 1,
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        +
      </button>

      {open && (
        <>
          {/* The sheet covers the list it is adding to, so there has to be a way
              out that is not a hunt for a button. */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 200,
            }}
          />
          <div
            role="dialog"
            aria-label="Add to your position"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 201,
              maxHeight: "85dvh",
              display: "flex",
              flexDirection: "column",
              background: C.panel,
              borderTop: `1px solid ${C.border}`,
              borderRadius: "10px 10px 0 0",
              overflow: "hidden",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 8px 0 16px",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: "bold", color: C.dim }}>
                Add
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="tap-target-square"
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.dim,
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>
            {/* The bar sizes itself from its own content and can outgrow a
                phone once an argument has several premises; the sheet is capped
                above, so what overflows scrolls rather than reaching past the
                bottom of the screen. */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <AddBar
                roomy
                elements={elements}
                onAddElement={onAddElement}
                onAddRelation={onAddRelation}
                selected={null}
                ctrlTo={null}
                hideNonEntailsRels={hideNonEntailsRels}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
