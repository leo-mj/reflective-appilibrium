/**
 * @fileoverview Shared action buttons, textarea, and error banner used by the
 * three LLM suggestion tabs: JudgmentElicitTab, PrincipleSuggestTab,
 * RelationSuggestTab.
 * @module components/SuggestionActions
 */

import { C } from "../constants/colors.js";
import { CheckIcon, XIcon, EditIcon, RevertIcon, ChatIcon } from "./Icons.jsx";
import { Tooltip } from "./Tooltip.jsx";
import { requestLLMSettings, useKeyMissing } from "../utils/llmKey.js";

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
      <button
        onClick={onClick}
        style={{
          ...CIRCLE_BTN,
          background: color + "20",
          border: `1.5px solid ${color}`,
          color,
        }}
      >
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
      <button
        onClick={onClick}
        style={{
          ...CIRCLE_BTN,
          background: C.conflicts + "20",
          border: `1.5px solid ${C.conflicts}`,
          color: C.conflicts,
        }}
      >
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
      <button
        onClick={onClick}
        style={{
          ...CIRCLE_BTN,
          background: "transparent",
          border: `1.5px solid ${C.border}`,
          color: C.dim,
        }}
      >
        <EditIcon size="10px" />
      </button>
    </Tooltip>
  );
}

/**
 * Leaves an edit in progress, putting the wording back as it was.
 *
 * A revert arrow rather than an ✕. It takes the Modify button's place while
 * editing, so it sits next to Reject — and with an ✕ on both, the two buttons
 * were the same button twice, one of which throws the suggestion away and one
 * of which throws only the rewording away.
 *
 * @param {Object}   props
 * @param {Function} props.onClick
 */
export function CancelButton({ onClick }) {
  return (
    <Tooltip text="Cancel edit">
      <button
        onClick={onClick}
        style={{
          ...CIRCLE_BTN,
          background: "transparent",
          border: `1.5px solid ${C.border}`,
          color: C.dim,
        }}
      >
        <RevertIcon size="11px" />
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
      // This box only ever appears in answer to Modify on one card, so the
      // cursor belongs in it. Rendering one per card unasked would put the
      // focus — and with it the scroll position — at the last card in the list.
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
          background: isOpen
            ? (accentColor ?? C.supports) + "20"
            : "transparent",
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
        background: C.dangerSurface,
        border: `1px solid ${C.danger}`,
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 12,
        color: C.dangerInk,
        marginBottom: 14,
      }}
    >
      {message}
    </div>
  );
}

/**
 * Shown on an assist tab when the LLM is available but the visitor has supplied
 * no API key — the public site's ordinary first state, not a fault.
 *
 * It sits beside {@link ErrorBanner} so the copy is written once for all six
 * tabs. Deliberately not styled as an error: nothing has gone wrong, the tab is
 * showing what it shows to everyone who has not configured a provider, and the
 * suggestions below it are real examples of the tab's own output. Amber rather
 * than the danger red, and the wording says what is on screen before it says
 * what is missing.
 *
 * Decides for itself whether to appear, and takes no props at all. What it
 * renders on is a build constant and the key store, neither of which the tab
 * hosting it knows anything about — threading a `keyMissing` prop down to six
 * tabs only moved the same two reads further from the thing that needed them.
 * Its button goes through `requestLLMSettings()` for the same reason: a tab six
 * levels down can open a modal the header owns without `llmOpen` being lifted
 * through everything in between.
 */
export function NeedsKeyNotice() {
  const keyMissing = useKeyMissing();
  if (!keyMissing) return null;
  return (
    <div
      style={{
        background: C.undermines + "14",
        border: `1px solid ${C.undermines}55`,
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 11,
        color: C.dim,
        lineHeight: 1.5,
        marginBottom: 14,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ flex: 1, minWidth: 180 }}>
        <span style={{ fontWeight: "bold", color: C.text }}>
          These are sample suggestions.
        </span>{" "}
        Add your own API key to get suggestions about the position you are
        actually building.
      </span>
      <button
        onClick={requestLLMSettings}
        style={{
          background: "transparent",
          border: `1px solid ${C.undermines}`,
          borderRadius: 4,
          color: C.undermines,
          fontSize: 11,
          padding: "4px 10px",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Add a key
      </button>
    </div>
  );
}

/**
 * EU AI Act Art. 50 transparency notice — shown whenever an assist tab is
 * displaying live LLM output, so users are informed the content on screen
 * was AI-generated, and by which model, before they accept it into their
 * RE state.
 *
 * @param {Object} props
 * @param {string} [props.model]  Model name/id that generated the content.
 * @param {string} [props.note]   Trailing caution clause; defaults to the accept-flow wording.
 */
export function AiDisclosureBanner({
  model,
  note = "Review carefully before accepting.",
}) {
  return (
    <div
      style={{
        background: C.supports + "14",
        border: `1px solid ${C.supports}55`,
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 11,
        color: C.dim,
        lineHeight: 1.5,
        marginBottom: 14,
      }}
    >
      <span style={{ fontWeight: "bold", color: C.text }}>
        AI-generated by {model || "an LLM"}.
      </span>{" "}
      {note}
    </div>
  );
}

/**
 * Small inline pill marking a piece of UI as AI-authored (e.g. a chat reply),
 * naming the specific model that produced it.
 *
 * @param {Object} props
 * @param {string} [props.model]
 */
export function AiTag({ model }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: "bold",
        color: C.supports,
        border: `1px solid ${C.supports}`,
        borderRadius: 3,
        padding: "1px 4px",
        marginRight: 6,
        flexShrink: 0,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      AI{model ? ` · ${model}` : ""}
    </span>
  );
}
