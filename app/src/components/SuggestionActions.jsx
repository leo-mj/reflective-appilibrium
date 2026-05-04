/**
 * @fileoverview Shared action buttons, textarea, and error banner used by the
 * three LLM suggestion tabs: JudgmentElicitTab, PrincipleSuggestTab,
 * RelationSuggestTab.
 * @module components/SuggestionActions
 */

import { C } from "../constants/colors.js";
import { CheckIcon, XIcon, EditIcon, ChatIcon } from "./Icons.jsx";
import { Tooltip } from "./Tooltip.jsx";

const CIRCLE_BTN = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};

/**
 * @param {Object}   props
 * @param {Function} props.onClick
 * @param {string}   props.accentColor  Border/icon colour — varies by element type.
 */
export function AcceptButton({ onClick, accentColor }) {
  const color = accentColor ?? C.supports;
  return (
    <Tooltip text="Accept">
      <button onClick={onClick} style={{
        ...CIRCLE_BTN,
        background: color + "20",
        border: `1.5px solid ${color}`,
        color,
      }}>
        <CheckIcon size="11px" />
      </button>
    </Tooltip>
  );
}

/**
 * @param {Object}   props
 * @param {Function} props.onClick
 */
export function RejectButton({ onClick }) {
  return (
    <Tooltip text="Reject">
      <button onClick={onClick} style={{
        ...CIRCLE_BTN,
        background: C.conflicts + "20",
        border: `1.5px solid ${C.conflicts}`,
        color: C.conflicts,
      }}>
        <XIcon size="11px" />
      </button>
    </Tooltip>
  );
}

/**
 * @param {Object}   props
 * @param {Function} props.onClick
 */
export function ModifyButton({ onClick }) {
  return (
    <Tooltip text="Modify">
      <button onClick={onClick} style={{
        ...CIRCLE_BTN,
        background: "transparent",
        border: `1.5px solid ${C.border}`,
        color: C.dim,
      }}>
        <EditIcon size="10px" />
      </button>
    </Tooltip>
  );
}

/**
 * @param {Object}   props
 * @param {Function} props.onClick
 */
export function CancelButton({ onClick }) {
  return (
    <Tooltip text="Cancel">
      <button onClick={onClick} style={{
        ...CIRCLE_BTN,
        background: "transparent",
        border: `1.5px solid ${C.border}`,
        color: C.dim,
      }}>
        <XIcon size="11px" />
      </button>
    </Tooltip>
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
 * @param {Object}   props
 * @param {boolean}  props.isOpen    Whether the conversation panel is open.
 * @param {Function} props.onClick
 * @param {string}   props.accentColor  Border/icon colour when open.
 */
export function ChatButton({ isOpen, onClick, accentColor }) {
  return (
    <Tooltip text="Discuss with AI">
      <button
        onClick={onClick}
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: isOpen ? (accentColor ?? C.supports) + "20" : "transparent",
          border: `1.5px solid ${isOpen ? (accentColor ?? C.supports) : C.border}`,
          color: isOpen ? (accentColor ?? C.supports) : C.dim,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <ChatIcon size="11px" />
      </button>
    </Tooltip>
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
