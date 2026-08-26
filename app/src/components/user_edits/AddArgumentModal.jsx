/**
 * @fileoverview Modal dialog for manually adding an entails/precludes argument.
 * @module components/AddArgumentModal
 */

import { useState, useEffect } from "react";
import { C } from "../../constants/colors.js";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { ElementOptions } from "./ElementOptions.jsx";
import { sortElementIds, defaultPickerIds } from "../../utils/stateUtils.js";

const ghostBtn = {
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  color: C.dim,
  fontSize: 11,
  padding: "2px 8px",
  cursor: "pointer",
};

/**
 * @param {Object}      props
 * @param {import('../../types.js').REElement[]} props.elements - Elements to choose from.
 *   May include withdrawn ones: an argument can rest on a premise that was later
 *   withdrawn, and recording it leaves that premise withdrawn.
 * @param {number}      props.currentRound
 * @param {function({ premises: string[], conclusion: string, negated: boolean, explanation: string }): void} props.onSave
 * @param {function(): void} props.onCancel
 * @param {string[]}    [props.initialPremises]
 * @param {string}      [props.initialConclusion]
 */
export function AddArgumentModal({
  elements,
  currentRound,
  onSave,
  onCancel,
  initialPremises,
  initialConclusion,
  draft,
  onDraftChange,
}) {
  const ids = elements.map((e) => e.id).sort(sortElementIds);
  // Any linkable element can be picked, but an unseeded form opens on ones in play.
  const seed = defaultPickerIds(elements);
  const seededPremises =
    initialPremises?.filter((id) => ids.includes(id)) ?? [];
  const defaultPremises = () => [seed[0] ?? ""];
  const defaultConclusion = () => seed[1] ?? seed[0] ?? "";
  // A graph selection outranks the draft — it is a fresh instruction. Where
  // nothing was selected the draft stands, so closing the dialog and reopening
  // it leaves the argument as it was rather than starting over.
  const [premises, setPremises] = useState(
    seededPremises.length
      ? seededPremises
      : (draft?.premises ?? defaultPremises()),
  );
  const [conclusion, setConclusion] = useState(
    initialConclusion && ids.includes(initialConclusion)
      ? initialConclusion
      : (draft?.conclusion ?? defaultConclusion()),
  );
  const [explanation, setExplanation] = useState(draft?.explanation ?? "");
  const [negated, setNegated] = useState(draft?.negated ?? false);

  useEffect(() => {
    onDraftChange?.({ premises, conclusion, negated, explanation });
  }, [premises, conclusion, negated, explanation, onDraftChange]);

  const clear = () => {
    setPremises(defaultPremises());
    setConclusion(defaultConclusion());
    setExplanation("");
    setNegated(false);
  };

  const setPremise = (i, id) =>
    setPremises((prev) => prev.map((p, j) => (j === i ? id : p)));

  const addPremise = () =>
    setPremises((prev) => {
      // In-play first, then anything else linkable — see AddArgumentPanel.
      const taken = new Set([...prev, conclusion]);
      const free = (list) => list.find((id) => !taken.has(id));
      return [...prev, free(seed) ?? free(ids) ?? ""];
    });

  const removePremise = (i) =>
    setPremises((prev) => prev.filter((_, j) => j !== i));

  const premiseSet = new Set(premises);
  const hasDuplicates = premiseSet.size < premises.length;
  const conclusionClash = premiseSet.has(conclusion);
  const hasEmpty = premises.some((p) => !p) || !conclusion;
  const isValid =
    premises.length >= 1 && !hasDuplicates && !conclusionClash && !hasEmpty;

  return (
    <ModalShell
      title="Add argument"
      subtitle={`Will be added in Round ${currentRound + 1}`}
      onCancel={onCancel}
      onSave={() => onSave({ premises, conclusion, negated, explanation })}
      onClear={clear}
      saveDisabled={!isValid}
      saveLabel="Add argument"
    >
      <FormField label="Premises">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {premises.map((p, i) => (
            <div
              key={p}
              style={{ display: "flex", gap: 6, alignItems: "center" }}
            >
              <select
                value={p}
                // FormField's <label> is a sibling with no htmlFor, so it names
                // nothing; and several premises would share one name in any
                // case. Numbered and explicit here.
                aria-label={`Premise ${i + 1}`}
                onChange={(e) => setPremise(i, e.target.value)}
                style={{ ...INPUT_STYLE, flex: 1 }}
              >
                <ElementOptions elements={elements} />
              </select>
              {premises.length > 1 && (
                <button onClick={() => removePremise(i)} style={ghostBtn}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addPremise}
            disabled={ids.length <= premises.length + 1}
            style={{ ...ghostBtn, alignSelf: "flex-start" }}
          >
            + Add premise
          </button>
          {hasDuplicates && (
            <div style={{ fontSize: 10, color: C.conflicts }}>
              Premises must be distinct.
            </div>
          )}
          {conclusionClash && (
            <div style={{ fontSize: 10, color: C.conflicts }}>
              A premise cannot also be the conclusion.
            </div>
          )}
        </div>
      </FormField>

      <FormField label="Relation to conclusion">
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { value: false, label: "Entails", color: C.entails },
            { value: true, label: "Precludes", color: C.precludes },
          ].map(({ value, label, color }) => (
            <button
              key={label}
              onClick={() => setNegated(value)}
              style={{
                ...ghostBtn,
                flex: 1,
                padding: "5px 0",
                border: `1px solid ${negated === value ? color : C.border}`,
                color: negated === value ? color : C.dim,
                background: negated === value ? color + "18" : "transparent",
                fontWeight: negated === value ? "bold" : "normal",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Conclusion">
        <select
          value={conclusion}
          aria-label="Conclusion"
          onChange={(e) => setConclusion(e.target.value)}
          style={INPUT_STYLE}
        >
          <ElementOptions elements={elements} />
        </select>
      </FormField>

      <FormField label="Explanation (optional)">
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          style={{ ...INPUT_STYLE, height: 72, resize: "vertical" }}
          placeholder={
            negated
              ? "Why do these premises preclude the conclusion?"
              : "Why do these premises entail the conclusion?"
          }
        />
      </FormField>
    </ModalShell>
  );
}
