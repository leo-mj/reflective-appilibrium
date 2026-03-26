/**
 * @fileoverview Shared modal overlay wrapper used by all edit and add modals.
 *
 * Provides the backdrop, the centred panel box, title, subtitle, form area,
 * and the Cancel / Save button row.  Callers pass form fields as `children`.
 *
 * @module components/ModalShell
 */

import { C } from "../../constants/colors.js";

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Centred modal overlay with a standard two-button footer.
 *
 * Clicking the backdrop calls `onCancel`.  The inner box stops propagation so
 * clicks inside do not reach the backdrop.
 *
 * @param {Object}           props
 * @param {string}           props.title        - Bold heading shown at the top of the modal.
 * @param {string}           props.subtitle     - Smaller descriptive text below the heading.
 * @param {React.ReactNode}  props.children     - Form fields rendered in the body.
 * @param {function(): void} props.onCancel     - Called when the user cancels or clicks the backdrop.
 * @param {function(): void} props.onSave       - Called when the user clicks the save button.
 * @param {string}           [props.saveLabel]  - Label for the save button (default: `"Save"`).
 * @param {boolean}          [props.saveDisabled] - Disables the save button when `true`.
 * @returns {React.ReactElement}
 */
export function ModalShell({
  title,
  subtitle,
  children,
  onCancel,
  onSave,
  saveLabel = "Save",
  saveDisabled = false,
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 28,
          width: 500,
          maxWidth: "92vw",
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: "bold",
            color: C.text,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 24 }}>
          {subtitle}
        </div>

        {children}

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 8,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "7px 18px",
              borderRadius: 4,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.dim,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saveDisabled}
            style={{
              padding: "7px 18px",
              borderRadius: 4,
              border: "none",
              background: saveDisabled ? C.border : C.supports,
              color: "#fff",
              cursor: saveDisabled ? "default" : "pointer",
              fontSize: 12,
              fontWeight: "bold",
            }}
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
