/**
 * @fileoverview The playback speeds, as a row of buttons — History's and the
 * Simulate tab's alike, both being driven by `usePlayback`.
 * @module components/SpeedButtons
 */

import { C } from "../constants/colors.js";
import { SPEEDS } from "../hooks/usePlayback.js";

/**
 * @param {Object} props
 * @param {number} props.speed
 * @param {(speed: number) => void} props.setSpeed
 * @param {boolean} [props.compact] - Tighter buttons, for a row that also
 *   holds the slider.
 */
export function SpeedButtons({ speed, setSpeed, compact = false }) {
  return (
    <div
      role="group"
      aria-label="Playback speed"
      style={{ display: "flex", gap: 2, alignItems: "center" }}
    >
      {SPEEDS.map((s) => (
        <button
          key={s}
          onClick={() => setSpeed(s)}
          aria-pressed={speed === s}
          style={{
            background: speed === s ? C.border : "transparent",
            border: `1px solid ${speed === s ? C.dim : C.border}`,
            color: speed === s ? C.text : C.dim,
            borderRadius: 4,
            padding: compact ? "3px 5px" : "6px 8px",
            cursor: "pointer",
            fontSize: compact ? 11 : 12,
            minWidth: compact ? "2.2em" : "2.5em",
          }}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}
