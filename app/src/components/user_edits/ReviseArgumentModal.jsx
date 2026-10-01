/**
 * @fileoverview Revising an argument: its premises, its conclusion, what the
 * one establishes of the other, and why.
 *
 * The dialog used to offer only Entails or Precludes and the explanation —
 * nothing about the statements, which are what an argument is. Now each
 * premise, and the conclusion, is a line that can be:
 *
 * - **swapped** for another element on the board, or for a new statement;
 * - **reworded** in place, which revises that element itself — everywhere it
 *   appears, as the note under a reworded line says;
 *
 * and a premise can be **taken out** with ✕, and `+ premise` adds another.
 * The conclusion has no ✕: an argument without one is not an argument.
 *
 * Saving is `handleArgumentRevise` (useRelationActions): one step for all of
 * it. A changed set of premises, or another conclusion, replaces the argument,
 * so History can show it as it was.
 *
 * @module components/user_edits/ReviseArgumentModal
 */

/** @import { REElement, RERelation } from '../../types.js' */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { Tooltip } from "../Tooltip.jsx";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { Dropdown } from "./Dropdown.jsx";
import { elementOptions } from "./ElementOptions.jsx";
import { pickerWidth, slotSource } from "./addPanelShared.js";
import {
  argumentRelationType,
  sortElementIds,
} from "../../utils/stateUtils.js";

const NEW_GROUP = "New";
const BOARD_GROUP = "On the board";
const NEW_OPTIONS = [
  { value: "new:judgment", label: "New judgment", group: NEW_GROUP },
  { value: "new:principle", label: "New principle", group: NEW_GROUP },
  { value: "new:theory", label: "New theory", group: NEW_GROUP },
];
const NEGATING = new Set(["precludes", "jointly_precludes"]);

/**
 * What stops the form being saved, as one sentence, or null. Checked before
 * whether anything changed, since an unsaveable form says why.
 *
 * @param {{ premises: Array<{ id?: string, text: string }>,
 *   conclusion: { id?: string, text: string } }} form
 * @returns {string|null}
 */
function argumentFormProblem({ premises, conclusion }) {
  if (!premises.length) return "An argument needs at least one premise.";
  const blank = premises.findIndex((p) => !p.text.trim());
  if (blank >= 0) return `Premise ${blank + 1} needs a statement.`;
  if (!conclusion.text.trim()) return "The conclusion needs a statement.";
  const ids = premises.map((p) => p.id).filter(Boolean);
  const twice = ids.find((id, i) => ids.indexOf(id) !== i);
  if (twice) return `${twice} is a premise twice.`;
  if (conclusion.id && ids.includes(conclusion.id))
    return `${conclusion.id} is the conclusion, so it cannot also be a premise.`;
  return null;
}

/**
 * @param {Object}       props
 * @param {RERelation[]} props.argument - Every link of the argument.
 * @param {REElement[]}  props.elements - What a line may be taken from.
 * @param {number}       props.currentRound - The latest step.
 * @param {function({ premises: Array<{ id?: string, type?: string, text: string }>,
 *   conclusion: { id?: string, type?: string, text: string },
 *   negated: boolean, explanation: string }): void} props.onSave
 * @param {function(): void} props.onCancel
 */
export function ReviseArgumentModal({
  argument,
  elements,
  currentRound,
  onSave,
  onCancel,
}) {
  const first = argument[0];
  const byId = new Map(elements.map((e) => [e.id, e]));
  const [initial] = useState(() => ({
    premises: argument
      .map((r) => r.from)
      .sort(sortElementIds)
      .map((id) => ({ id, text: byId.get(id)?.text ?? "" })),
    conclusion: { id: first.to, text: byId.get(first.to)?.text ?? "" },
    negated: NEGATING.has(first.type),
    explanation: first.explanation ?? "",
  }));
  const [form, setForm] = useState(initial);
  const { premises, conclusion } = form;

  // One list for every line; what a line may not take — the conclusion as a
  // premise, a premise twice — is refused with a reason rather than hidden,
  // so a swap between the two can be made one line at a time.
  const options = [
    ...NEW_OPTIONS,
    ...elementOptions(elements.filter((e) => e.status !== "possible")).map(
      (o) => ({ ...o, group: BOARD_GROUP }),
    ),
  ];

  const setPremise = (i, patch) =>
    setForm((f) => ({
      ...f,
      premises: f.premises.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));
  const setConclusion = (patch) =>
    setForm((f) => ({ ...f, conclusion: { ...f.conclusion, ...patch } }));
  // Choosing an element fills the line with its words; going back to "New"
  // keeps whatever the line says, so changing one's mind costs nothing.
  const sourcePatch = (value) =>
    value.startsWith("new:")
      ? { id: undefined, type: value.slice(4) }
      : { id: value, type: undefined, text: byId.get(value)?.text ?? "" };

  const problem = argumentFormProblem(form);
  const unchanged = JSON.stringify(form) === JSON.stringify(initial);
  const type = argumentRelationType(premises.length, form.negated);
  const trimmed = (line) => ({ ...line, text: line.text.trim() });

  /**
   * One line: its mark, where its statement comes from, the statement, and —
   * for a premise — the ✕ that takes it out. A note under it when its wording
   * has been changed, since that revises the element everywhere.
   */
  const line = ({ key, mark, name, slot, onEdit, remove }) => {
    const picked = slot.id ? byId.get(slot.id) : null;
    const reworded = picked && slot.text.trim() !== picked.text;
    return (
      <div key={key}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span aria-hidden="true" style={MARK_STYLE}>
            {mark}
          </span>
          <Dropdown
            label={`${name} source`}
            value={slotSource(slot)}
            onChange={(v) => onEdit(sourcePatch(v))}
            options={options}
            style={INPUT_STYLE}
            // 13 for "New principle", the longest label either group offers.
            layout={pickerWidth(13)}
          />
          <textarea
            aria-label={name}
            value={slot.text}
            onChange={(e) => onEdit({ text: e.target.value })}
            placeholder={`${name}…`}
            style={{
              ...INPUT_STYLE,
              flex: 1,
              minHeight: 52,
              resize: "vertical",
            }}
          />
          {remove}
        </div>
        {/* Said where it is done: the element is one statement, and every
            argument and relation it is in reads the new words. */}
        {reworded && (
          <div style={NOTE_STYLE}>
            Rewording revises {slot.id} everywhere it appears.
          </div>
        )}
      </div>
    );
  };

  return (
    <ModalShell
      title="Revise argument"
      subtitle={`Saving records every change here as step ${currentRound + 1}`}
      onCancel={onCancel}
      onSave={() =>
        onSave({
          premises: premises.map(trimmed),
          conclusion: trimmed(conclusion),
          negated: form.negated,
          explanation: form.explanation,
        })
      }
      saveDisabled={unchanged || Boolean(problem)}
      // Twice the other dialogs: the premises are whole statements, and read
      // side by side with their pickers they want the room to show.
      width={1000}
    >
      <FormField label="Premises">
        <div
          role="group"
          aria-label="Premises"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {premises.map((p, i) =>
            line({
              key: i,
              mark: i + 1,
              name: `Premise ${i + 1}`,
              slot: p,
              onEdit: (patch) => setPremise(i, patch),
              remove: premises.length > 1 && (
                <Tooltip text={`Take premise ${i + 1} out of the argument`}>
                  <button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        premises: f.premises.filter((_, j) => j !== i),
                      }))
                    }
                    aria-label={`Remove premise ${i + 1}`}
                    style={REMOVE_STYLE}
                  >
                    ✕
                  </button>
                </Tooltip>
              ),
            }),
          )}
          <button
            onClick={() =>
              setForm((f) => ({
                ...f,
                premises: [...f.premises, { type: "principle", text: "" }],
              }))
            }
            style={{
              ...REMOVE_STYLE,
              alignSelf: "flex-start",
              marginLeft: "1.6em",
            }}
          >
            + premise
          </button>
        </div>
      </FormField>

      {/* Swapped or reworded like a premise, never taken out: without a
          conclusion there is no argument left to revise. */}
      <FormField label="Conclusion">
        {line({
          key: "conclusion",
          mark: "∴",
          name: "Conclusion",
          slot: conclusion,
          onEdit: setConclusion,
          remove: null,
        })}
      </FormField>

      <FormField label="Relation to conclusion">
        <select
          aria-label="Relation to conclusion"
          value={form.negated ? "precludes" : "entails"}
          onChange={(e) =>
            setForm((f) => ({ ...f, negated: e.target.value === "precludes" }))
          }
          style={INPUT_STYLE}
        >
          <option value="entails">
            {premises.length > 1 ? "Jointly entail" : "Entails"}
          </option>
          <option value="precludes">
            {premises.length > 1 ? "Jointly preclude" : "Precludes"}
          </option>
        </select>
      </FormField>

      <FormField label="Explanation">
        <textarea
          value={form.explanation}
          onChange={(e) =>
            setForm((f) => ({ ...f, explanation: e.target.value }))
          }
          style={{ ...INPUT_STYLE, height: 80, resize: "vertical" }}
        />
      </FormField>

      <div
        role="status"
        style={{ ...NOTE_STYLE, minHeight: "1.5em", marginBottom: 8 }}
      >
        {problem ??
          (unchanged
            ? ""
            : `Saves as ${type.replace("_", " ")}, one step for all of it.`)}
      </div>
    </ModalShell>
  );
}

const REMOVE_STYLE = {
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.dim,
  cursor: "pointer",
  fontSize: 12,
  padding: "5px 9px",
  flexShrink: 0,
};

const MARK_STYLE = {
  color: C.dim,
  width: "1.2em",
  paddingTop: 7,
  flexShrink: 0,
};

const NOTE_STYLE = {
  fontSize: 11,
  color: C.dim,
  lineHeight: 1.5,
  marginTop: 4,
  marginLeft: "1.6em",
};
