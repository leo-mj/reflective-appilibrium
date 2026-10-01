/**
 * @fileoverview Confidence input: three preset buttons (Low / Moderate / High) plus a
 * free-entry number field for values in [0, 1].
 * @module components/ConfidenceInput
 */

import { C } from "../../constants/colors.js";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { CONFIDENCE_PRESETS } from "../../utils/confidenceLabel.js";
import { FormField } from "./ModalShell.jsx";

/**
 * @param {Object} props
 * @param {number} props.value           - Current confidence in [0, 1].
 * @param {function(number): void} props.onChange
 */
export function ConfidenceInput({ value, onChange }) {
  const handleInput = (e) => {
    const v = parseFloat(e.target.value);
    if (!Number.isNaN(v)) onChange(Math.max(0, Math.min(1, v)));
  };

  return (
    <FormField label="Confidence">
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {CONFIDENCE_PRESETS.map((p) => {
          const active = Math.abs(value - p.value) < 0.01;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.value)}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                borderRadius: 4,
                border: `1px solid ${active ? C.judgment.accent : C.border}`,
                background: active ? C.judgment.accent : C.bg,
                color: active ? C.onFill : C.text,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {p.label}
            </button>
          );
        })}
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={value}
          onChange={handleInput}
          style={{ ...INPUT_STYLE, width: 70 }}
        />
      </div>
    </FormField>
  );
}
