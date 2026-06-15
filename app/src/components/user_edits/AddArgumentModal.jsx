/**
 * @fileoverview Modal dialog for manually adding an entails/precludes argument.
 * @module components/AddArgumentModal
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { ModalShell, FormField } from "./ModalShell.jsx";
import { sortElementIds } from "../../utils/stateUtils.js";

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
 * @param {import('../../types.js').REElement[]} props.elements - Active elements to choose from.
 * @param {number}      props.currentRound
 * @param {function({ premises: string[], conclusion: string, negated: boolean, explanation: string }): void} props.onSave
 * @param {function(): void} props.onCancel
 * @param {string[]}    [props.initialPremises]
 * @param {string}      [props.initialConclusion]
 */
export function AddArgumentModal({ elements, currentRound, onSave, onCancel, initialPremises, initialConclusion }) {
  const ids = elements.map((e) => e.id).sort(sortElementIds);
  const [premises, setPremises] = useState(
    initialPremises?.filter((id) => ids.includes(id)).length
      ? initialPremises.filter((id) => ids.includes(id))
      : [ids[0] ?? ""]
  );
  const [conclusion, setConclusion] = useState(
    initialConclusion && ids.includes(initialConclusion)
      ? initialConclusion
      : (ids[1] ?? ids[0] ?? "")
  );
  const [explanation, setExplanation] = useState("");
  const [negated, setNegated] = useState(false);

  const setPremise = (i, id) =>
    setPremises((prev) => prev.map((p, j) => (j === i ? id : p)));

  const addPremise = () =>
    setPremises((prev) => [
      ...prev,
      ids.find((id) => !prev.includes(id) && id !== conclusion) ?? ids[0] ?? "",
    ]);

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
      saveDisabled={!isValid}
      saveLabel="Add argument"
    >
      <FormField label="Premises">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {premises.map((p, i) => (
            <div key={p} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select
                value={p}
                onChange={(e) => setPremise(i, e.target.value)}
                style={{ ...INPUT_STYLE, flex: 1 }}
              >
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
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
            { value: true,  label: "Precludes", color: C.precludes },
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
          onChange={(e) => setConclusion(e.target.value)}
          style={INPUT_STYLE}
        >
          {ids.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Explanation (optional)">
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          style={{ ...INPUT_STYLE, height: 72, resize: "vertical" }}
          placeholder={negated
            ? "Why do these premises preclude the conclusion?"
            : "Why do these premises entail the conclusion?"}
        />
      </FormField>
    </ModalShell>
  );
}
