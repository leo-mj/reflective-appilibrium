/**
 * @fileoverview Playback slider and controls toolbar for the History tab.
 * @module components/history/HistoryPlaybackControls
 */

import { C } from "../../constants/colors.js";
import { SPEEDS } from "../../hooks/usePlayback.js";

// ─── PlaybackSlider ───────────────────────────────────────────────────────────

/**
 * Styled range slider with tick marks and a filled progress track.
 *
 * @param {Object}   props
 * @param {number}   props.maxRound
 * @param {number}   props.targetRound
 * @param {number}   props.displayRound  - Floating-point animated value (for track fill).
 * @param {number}   props.snappedRound  - Integer round (for tick highlight).
 * @param {Function} props.setTargetRound
 * @param {Function} props.setPlaying
 */
function PlaybackSlider({
  maxRound,
  targetRound,
  displayRound,
  snappedRound,
  setTargetRound,
  setPlaying,
}) {
  const sliderPct = maxRound > 0 ? (displayRound / maxRound) * 100 : 0;
  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        height: 20,
        minWidth: 100,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 4,
          borderRadius: 2,
          background: C.border,
        }}
      >
        <div
          style={{
            width: `${sliderPct}%`,
            height: "100%",
            borderRadius: 2,
            background: C.supports,
            transition: "width 0.15s linear",
          }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={maxRound}
        step={1}
        value={targetRound}
        onChange={(e) => {
          setTargetRound(Number(e.target.value));
          setPlaying(false);
        }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          width: "100%",
          opacity: 0,
          cursor: "pointer",
          height: 20,
        }}
      />
      {Array.from({ length: maxRound + 1 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(i / maxRound) * 100}%`,
            width: 2,
            height: snappedRound === i ? 12 : 6,
            background: snappedRound === i ? C.supports : C.dim,
            borderRadius: 1,
            transform: "translateX(-1px)",
            transition: "height 0.3s ease, background 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── PlaybackControls ─────────────────────────────────────────────────────────

/**
 * Toolbar row: Reset, Play/Pause, speed buttons, slider, round display.
 *
 * @param {Object} props
 * @param {ReturnType<import('../../hooks/usePlayback.js').usePlayback>} props.playback
 * @param {number} props.maxRound
 */
export function PlaybackControls({ playback, maxRound }) {
  const {
    resetPlayback,
    togglePlay,
    playing,
    speed,
    setSpeed,
    displayRound,
    targetRound,
    snappedRound,
    setTargetRound,
    setPlaying,
  } = playback;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 0",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 2 }}>
        <button
          onClick={resetPlayback}
          style={{
            background: "none",
            border: `1px solid ${C.border}`,
            color: C.dim,
            borderRadius: 4,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Reset
        </button>

        <button
          onClick={togglePlay}
          style={{
            background: playing ? C.conflicts : C.supports,
            border: "none",
            color: "#fff",
            borderRadius: 4,
            padding: "6px 14px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: "bold",
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <div
          style={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            marginLeft: "1em",
          }}
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                background: speed === s ? C.border : "transparent",
                border: `1px solid ${speed === s ? C.dim : C.border}`,
                color: speed === s ? C.text : C.dim,
                borderRadius: 4,
                padding: "6px 8px",
                cursor: "pointer",
                fontSize: 12,
                minWidth: "2.5em",
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 3,
          alignItems: "center",
          flex: "auto",
          flexBasis: "100%",
        }}
      >
        <PlaybackSlider
          maxRound={maxRound}
          targetRound={targetRound}
          displayRound={displayRound}
          snappedRound={snappedRound}
          setTargetRound={setTargetRound}
          setPlaying={setPlaying}
        />

        <div
          style={{
            minWidth: 80,
            textAlign: "center",
            padding: "4px 10px",
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: C.dim,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Round
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: C.text,
              lineHeight: 1.2,
            }}
          >
            {snappedRound === 0 ? "—" : snappedRound}
          </div>
          <div style={{ fontSize: 9, color: C.dim }}>of {maxRound}</div>
        </div>
      </div>
    </div>
  );
}
