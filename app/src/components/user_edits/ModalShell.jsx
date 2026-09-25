/**
 * @fileoverview Shared modal overlay wrapper used by all edit and add modals.
 *
 * Provides the backdrop, the centred panel box, title, subtitle, form area,
 * and the Cancel / Save button row.  Callers pass form fields as `children`.
 *
 * @module components/ModalShell
 */

import { useEffect, useId, useRef, useState } from "react";
import { C } from "../../constants/colors.js";
import { Tooltip } from "../Tooltip.jsx";
import { FIELD_STYLE, LABEL_STYLE } from "../../constants/modalConstants.js";

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Label + input wrapper shared across all modal form fields. */
export function FormField({ label, children }) {
  return (
    <div style={FIELD_STYLE}>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

/** What Tab can land on inside the dialog. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centred modal overlay with a standard two-button footer.
 *
 * Clicking the backdrop calls `onCancel`.  The inner box stops propagation so
 * clicks inside do not reach the backdrop.
 *
 * **A dialog to a keyboard, too.** It is announced as one (`role="dialog"`,
 * modal, named by its title), takes the focus when it opens — its first
 * field, unless a field has focused itself — keeps Tab inside it, closes on
 * Escape, and hands the focus back to whatever opened it. It did none of
 * this: a reader revising an element from the text panel by keyboard was left
 * on the Revise button behind the backdrop, with Tab walking the page under
 * it and no key to close it. Every add, edit and withdraw form is this shell,
 * so they all had the same gap. A dropdown inside keeps Escape for itself
 * while its list is open (`Dropdown` stops it), so Escape there closes the
 * list and not the dialog.
 *
 * @param {Object}           props
 * @param {string}           props.title        - Bold heading shown at the top of the modal.
 * @param {string}           props.subtitle     - Smaller descriptive text below the heading.
 * @param {React.ReactNode}  props.children     - Form fields rendered in the body.
 * @param {function(): void} props.onCancel     - Called when the user cancels or clicks the backdrop.
 * @param {function(): void} props.onSave       - Called when the user clicks the save button.
 * @param {string}           [props.saveLabel]  - Label for the save button (default: `"Save"`).
 * @param {boolean}          [props.saveDisabled] - Disables the save button when `true`.
 * @param {function(): void} [props.onClear]    - When given, a Clear button appears at
 *   the far side of the footer from Save. Kept apart from it deliberately: it
 *   throws away what Save would commit, and the two should not sit together.
 * @returns {React.ReactElement}
 */
export function ModalShell({
  title,
  subtitle,
  children,
  onCancel,
  onSave,
  onClear,
  saveLabel = "Save",
  saveDisabled = false,
}) {
  const titleId = useId();
  const subtitleId = useId();
  const boxRef = useRef(null);
  // Whatever had the focus when the dialog opened: read on the first render,
  // before a field inside can take the focus with `autoFocus`.
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : document.activeElement,
  );

  useEffect(() => {
    const box = boxRef.current;
    if (box && !box.contains(document.activeElement))
      (box.querySelector(FOCUSABLE) ?? box).focus();
    return () => {
      if (opener && document.contains(opener)) opener.focus?.();
    };
  }, [opener]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && e.ctrlKey && !saveDisabled) {
      e.preventDefault();
      onSave();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    const stops = [...boxRef.current.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (!stops.length) return;
    const first = stops[0];
    const last = stops.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

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
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
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
          id={titleId}
          style={{
            fontSize: 15,
            fontWeight: "bold",
            color: C.text,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div id={subtitleId} style={{ fontSize: 11, color: C.dim, marginBottom: 24 }}>
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
          {onClear && (
            <Tooltip text="Start this form over">
              <button
                onClick={onClear}
                style={{
                  marginRight: "auto",
                  padding: "7px 18px",
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                  background: "transparent",
                  color: C.dim,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Clear
              </button>
            </Tooltip>
          )}
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
              color: C.onFill,
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
