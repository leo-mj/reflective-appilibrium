/**
 * @fileoverview The "Import from text" dialog: a prompt to copy into a chat with
 * any LLM, and a box for the map it writes back.
 *
 * The app calls no model here — the reader takes the prompt and the text
 * wherever they like, which is why the dialog says that nothing is sent from
 * it, and why it works in the demo build. The reply is read as Argdown
 * (`utils/argdownPrompt.js`), then goes the way a picked `.argdown` file goes:
 * Import (with its "replace?" when a process is open) or Merge (with its
 * preview). A reply that does not parse keeps the dialog open with the parser's
 * message, so the paste is not lost to a fix of one line.
 *
 * @module components/user_edits/TextImportModal
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { LABEL_STYLE } from "../../constants/modalConstants.js";
import {
  ARGDOWN_IMPORT_PROMPT,
  pastedArgdownFile,
} from "../../utils/argdownPrompt.js";
import { ModalShell } from "./ModalShell.jsx";
import { ErrorBanner } from "../SuggestionActions.jsx";

const STEP_STYLE = {
  fontSize: 12,
  color: C.text,
  lineHeight: 1.6,
  marginBottom: 8,
};

const OUTLINE_BUTTON = {
  flexShrink: 0,
  padding: "7px 14px",
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  background: "transparent",
  color: C.text,
  cursor: "pointer",
  fontSize: 12,
};

const TEXTAREA_STYLE = {
  alignSelf: "stretch",
  display: "block",
  boxSizing: "border-box",
  width: "100%",
  padding: 8,
  borderRadius: 4,
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.text,
  fontFamily: "monospace",
  fontSize: 11,
  overflowX: "hidden",
  resize: "vertical",
};

/**
 * @param {Object} props
 * @param {boolean} props.canMerge - Offers merging the map into the open
 *   process as well as replacing it.
 * @param {function(File, "import"|"merge"): Promise<void>} props.onSubmit -
 *   Takes the pasted map on; rejects with a message for the reader when it
 *   cannot be read, which keeps the dialog open.
 * @param {function(): void} props.onCancel
 */
export function TextImportModal({ canMerge, onSubmit, onCancel }) {
  const [copied, setCopied] = useState(null); // null | "done" | "failed"
  const [showPrompt, setShowPrompt] = useState(false);
  const [reply, setReply] = useState("");
  const [mode, setMode] = useState("import");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ARGDOWN_IMPORT_PROMPT);
      setCopied("done");
    } catch {
      // No clipboard outside a secure context, or permission refused: the
      // prompt is shown instead, to be selected by hand.
      setCopied("failed");
      setShowPrompt(true);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pastedArgdownFile(reply), canMerge ? mode : "import");
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Import from text"
      subtitle="Have an LLM reconstruct a text's arguments as an Argdown map, then bring the map in."
      onCancel={onCancel}
      onSave={submit}
      saveLabel={canMerge && mode === "merge" ? "Merge" : "Import"}
      saveDisabled={!reply.trim() || busy}
      width={600}
    >
      <div style={STEP_STYLE}>
        <strong>1.</strong> Copy this prompt into a chat with an LLM of your
        choice, and add the text — a paper, a chapter, an op-ed — after it or as
        an attachment.
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <button onClick={copy} style={OUTLINE_BUTTON}>
          Copy prompt
        </button>
        <button
          onClick={() => setShowPrompt((s) => !s)}
          aria-expanded={showPrompt}
          style={{ ...OUTLINE_BUTTON, border: "none", color: C.dim }}
        >
          {showPrompt ? "Hide prompt" : "Show prompt"}
        </button>
        <span role="status" style={{ fontSize: 11, color: C.dim }}>
          {copied === "done" && "Copied."}
          {copied === "failed" &&
            "Could not reach the clipboard: select the prompt below and copy it."}
        </span>
      </div>
      {showPrompt && (
        <textarea
          readOnly
          aria-label="Prompt"
          value={ARGDOWN_IMPORT_PROMPT}
          rows={10}
          onFocus={(e) => e.target.select()}
          style={{ ...TEXTAREA_STYLE, marginBottom: 8 }}
        />
      )}
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 20 }}>
        Nothing is sent from here: the text goes only to the LLM you paste it
        into. Check what comes back — a reconstruction is a reading of the text,
        and premises marked <code>// unstated</code> are the model&apos;s.
      </div>

      <label style={{ ...STEP_STYLE, display: "block" }}>
        <strong>2.</strong> Paste the reply here. The <code>argdown</code> block
        is picked out of it; the model&apos;s notes around it are left behind.
        <textarea
          value={reply}
          onChange={(e) => {
            setReply(e.target.value);
            setError(null);
          }}
          rows={8}
          placeholder={"```argdown\n===\ntitle: …\n===\n…\n```"}
          style={{ ...TEXTAREA_STYLE, marginTop: 6 }}
        />
      </label>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 12 }}>
        Or save the map as an <code>.argdown</code> file and use Import or Merge
        in the ☰ menu.
      </div>

      {canMerge && (
        <div
          role="radiogroup"
          aria-label="What to do with the map"
          style={{ display: "flex", gap: 16, marginBottom: 12 }}
        >
          {[
            ["import", "Replace this process"],
            ["merge", "Merge into this process"],
          ].map(([value, label]) => (
            <label
              key={value}
              style={{
                ...LABEL_STYLE,
                display: "flex",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="text-import-mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                style={{ accentColor: C.supports }}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {error && (
        <div role="alert">
          <ErrorBanner message={error} />
        </div>
      )}
    </ModalShell>
  );
}
