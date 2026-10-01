/**
 * @fileoverview Says that edits to the sample process are not kept.
 *
 * The sample is not autosaved — it is a fixed demonstration anyone can reopen
 * from the home page, and saving it would take the one draft slot from the
 * reader's own work — but it can be edited like any process. Without this, a
 * reader who had built on it lost that work on reload, with nothing to say so.
 * Shown from the first edit, not before: until then there is nothing to lose.
 * Said once, not kept up: the next change or the close button puts it away
 * (REState), since a line that stays over every later edit stops being read.
 * @module components/app_header/SampleEditsNotice
 */

import { C } from "../../constants/colors.js";

/**
 * @param {Object}   props
 * @param {Function} props.onExport - Opens the export dialog.
 * @param {Function} props.onClose
 */
export function SampleEditsNotice({ onExport, onClose }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "4px 10px",
        fontSize: 11,
        lineHeight: 1.5,
        color: C.text,
        background: C.panel,
        border: `1px solid ${C.theory.accent}`,
        borderRadius: 4,
        padding: "5px 10px",
        margin: "0 0 8px",
      }}
    >
      <span>
        <strong style={{ color: C.theory.text }}>
          Changes to the demo are not saved.
        </strong>{" "}
        A reload or leaving it loses them. Export to keep a copy, or start your
        own process from the home page.
      </span>
      <button
        onClick={onExport}
        style={{
          background: "transparent",
          border: `1px solid ${C.supportsText}`,
          borderRadius: 4,
          color: C.supportsText,
          cursor: "pointer",
          fontSize: 11,
          padding: "2px 10px",
        }}
      >
        Export
      </button>
      {/* A symbol for text, so it carries its own name. */}
      <button
        onClick={onClose}
        aria-label="Close notice"
        style={{
          marginLeft: "auto",
          background: "transparent",
          border: "none",
          color: C.dim,
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          padding: "2px 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}
