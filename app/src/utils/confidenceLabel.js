/**
 * @fileoverview How a confidence value should read on screen.
 * @module utils/confidenceLabel
 */

/** Mirrors the preset buttons in `ConfidenceInput`. */
export const CONFIDENCE_PRESETS = [
  { label: "Low", value: 0.33 },
  { label: "Moderate", value: 0.67 },
  { label: "High", value: 1.0 },
];

/** Half the gap between neighbouring presets, so the bands cannot overlap. */
const TOLERANCE = 0.01;

/**
 * Renders a confidence as the word the user actually chose.
 *
 * The presets are ordinal categories. Printing `0.33` for "Low" states a
 * precision nobody expressed — it invites reading 0.33 and 0.34 as different
 * when only one of them can be picked. A value typed into the free-entry field
 * *is* numeric, so it stays a number.
 *
 * @param {number|string|null|undefined} value
 * @returns {{ text: string, title: string|undefined }} `title` carries the
 *   underlying number for a preset, since it still feeds the rethon weights.
 */
export function confidenceLabel(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { text: value == null ? "" : String(value), title: undefined };
  }
  const preset = CONFIDENCE_PRESETS.find(
    (p) => Math.abs(p.value - value) < TOLERANCE,
  );
  return preset
    ? { text: preset.label, title: value.toFixed(2) }
    : { text: value.toFixed(2), title: undefined };
}

/**
 * Label and value together, for surfaces that are already a tooltip and so
 * have nowhere further to hide the number.
 *
 * @param {number|string|null|undefined} value
 * @returns {string} e.g. `"Moderate (0.67)"`, or just `"0.42"` for a typed value.
 */
export function confidenceDetail(value) {
  const { text, title } = confidenceLabel(value);
  return title ? `${text} (${title})` : text;
}
