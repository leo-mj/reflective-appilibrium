/**
 * @fileoverview Shared action buttons, textarea, and error banner used by the
 * three LLM suggestion tabs: JudgmentElicitTab, PrincipleSuggestTab,
 * RelationSuggestTab.
 * @module components/SuggestionActions
 */

import { C } from "../constants/colors.js";

// Button base styles (card-level, smaller than toolbar buttons)
const SOLID = {
  borderRadius: 4,
  padding: "2px 10px",
  fontSize: 11,
  cursor: "pointer",
  border: "none",
};
const OUTLINE = {
  borderRadius: 4,
  padding: "2px 10px",
  fontSize: 11,
  cursor: "pointer",
  background: "transparent",
  border: `1px solid ${C.border}`,
};

/**
 * @param {Object}   props
 * @param {Function} props.onClick
 * @param {string}   props.accentColor  Background colour — varies by element type.
 */
export function AcceptButton({ onClick, accentColor }) {
  return (
    <button
      onClick={onClick}
      style={{ ...SOLID, background: accentColor, color: "#fff" }}
    >
      Accept
    </button>
  );
}

/**
 * @param {Object}   props
 * @param {Function} props.onClick
 */
export function RejectButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ ...SOLID, background: "#dc2626", color: "#fff" }}
    >
      Reject
    </button>
  );
}

/**
 * @param {Object}   props
 * @param {Function} props.onClick
 */
export function ModifyButton({ onClick }) {
  return (
    <button onClick={onClick} style={{ ...OUTLINE, color: C.dim }}>
      Modify
    </button>
  );
}

/**
 * @param {Object}   props
 * @param {Function} props.onClick
 */
export function CancelButton({ onClick }) {
  return (
    <button onClick={onClick} style={{ ...OUTLINE, color: C.dim }}>
      Cancel
    </button>
  );
}

/**
 * Inline textarea shown when the user edits a suggestion before accepting it.
 *
 * @param {Object}   props
 * @param {string}   props.value
 * @param {Function} props.onChange   Called with the new string value.
 * @param {string}   props.accentColor  Border colour — varies by element type.
 */
export function ModifyTextarea({ value, onChange, accentColor }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus
      style={{
        flex: 1,
        fontSize: 12,
        lineHeight: 1.6,
        color: C.text,
        background: C.bg,
        border: `1px solid ${accentColor}`,
        borderRadius: 4,
        padding: "4px 6px",
        resize: "vertical",
        minHeight: 60,
      }}
    />
  );
}

/**
 * @param {Object} props
 * @param {string} props.message
 */
export function ErrorBanner({ message }) {
  return (
    <div
      style={{
        background: "#7c1d1d44",
        border: "1px solid #dc2626",
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 12,
        color: "#fca5a5",
        marginBottom: 14,
      }}
    >
      {message}
    </div>
  );
}
