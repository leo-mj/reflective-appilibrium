/**
 * @fileoverview Confidence input: three preset buttons (Low / Mod / High) plus a
 * free-entry number field for values in [0, 1].
 * @module components/ConfidenceInput
 */

import { C } from "../../constants/colors.js";
import { INPUT_STYLE } from "../../constants/modalConstants.js";
import { FormField } from "./ModalShell.jsx";

const PRESETS = [
  { label: "Low", value: 0.33 },
  { label: "Mod", value: 0.67 },
  { label: "High", value: 1.0 },
];

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
        {PRESETS.map((p) => {
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
                border: `1px solid ${active ? C.judgment.high : C.border}`,
                background: active ? C.judgment.high : C.bg,
                color: active ? "#fff" : C.text,
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
