/**
 * @fileoverview Animated round-by-round history playback tab.
 * @module components/HistoryTab
 */

/** @import { REState, PositionMap } from '../types.js' */

import { useState, useEffect, useRef } from "react";
import { C } from "../constants/colors.js";
import { useContainerDims } from "../hooks/useContainerDims.js";
import { usePan } from "../hooks/usePan.js";
import { useAutoFit } from "../hooks/useAutoFit.js";
import { elementsAtRound } from "../utils/stateUtils.js";
import {
  GraphCanvas,
  OffscreenIndicators,
} from "./graphs_shared/GraphElements.jsx";
import {
  renderEdge,
  renderNode,
  historyEdgeVisuals,
  historyNodeVisuals,
} from "./graphs_shared/graphRender.jsx";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Available playback speed multipliers. */
const SPEEDS = [0.5, 1, 2, 4];
/** Base interval between rounds at 1× speed, in milliseconds. */
const BASE_ROUND_INTERVAL_MS = 3200;
/** Exponential easing factor per animation frame (0–1; lower = slower). */
const EASING_FACTOR = 0.08;

// ─── usePlayback ──────────────────────────────────────────────────────────────

/**
 * Manages all playback state and side-effects for the History tab.
 *
 * @param {number} maxRound
 * @returns {{ displayRound, targetRound, setTargetRound, playing, setPlaying,
 *             speed, setSpeed, snappedRound, resetPlayback, togglePlay }}
 */
function usePlayback(maxRound) {
  const [displayRound, setDisplayRound] = useState(0);
  const [targetRound, setTargetRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  /** Ref copy of `playing` so the interval callback reads the latest value. */
  const playRef = useRef(false);
  const animRef = useRef(null);

  useEffect(() => {
    playRef.current = playing;
  }, [playing]);

  /**
   * Smooth animation loop: eases `displayRound` toward `targetRound`
   * using exponential smoothing (factor 0.08 per frame).
   */
  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const animate = () => {
      setDisplayRound((prev) => {
        const diff = targetRound - prev;
        if (Math.abs(diff) < 0.01) return targetRound;
        animRef.current = requestAnimationFrame(animate);
        return prev + diff * EASING_FACTOR;
      });
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [targetRound]);

  /** Auto-advances `targetRound` at the current speed while playing. */
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      if (!playRef.current) return;
      setTargetRound((prev) => {
        if (prev >= maxRound) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, BASE_ROUND_INTERVAL_MS / speed);
    return () => clearInterval(iv);
  }, [playing, maxRound, speed]);

  const snappedRound = Math.round(displayRound);

  const resetPlayback = () => {
    setTargetRound(0);
    setDisplayRound(0);
    setPlaying(false);
  };
  const togglePlay = () => {
    if (targetRound >= maxRound) resetPlayback();
    setPlaying((p) => !p);
  };

  return {
    displayRound,
    targetRound,
    setTargetRound,
    playing,
    setPlaying,
    speed,
    setSpeed,
    snappedRound,
    resetPlayback,
    togglePlay,
  };
}

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
 * @param {ReturnType<typeof usePlayback>} props.playback
 * @param {number} props.maxRound
 */
function PlaybackControls({ playback, maxRound }) {
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
            padding: "2px 8px",
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
            padding: "4px 12px",
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
                padding: "2px 6px",
                cursor: "pointer",
                fontSize: 11,
                minWidth: "3em",
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

// ─── LogOverlay ───────────────────────────────────────────────────────────────

/**
 * Absolutely-positioned overlay showing all log entries up to `snappedRound`.
 * Future entries are hidden (opacity 0, no pointer events) and fade in as
 * playback advances. Auto-scrolls the current entry into view via `currentLogRef`.
 *
 * @param {Object}      props
 * @param {Array}       props.sortedLog     - Log entries sorted ascending by round.
 * @param {number}      props.snappedRound
 * @param {React.Ref}   props.logRef        - Ref on the scrollable container.
 * @param {React.Ref}   props.currentLogRef - Ref on the current-round entry.
 */
function LogOverlay({ sortedLog, snappedRound, logRef, currentLogRef }) {
  if (snappedRound === 0 || sortedLog.length === 0) return null;
  return (
    <div
      ref={logRef}
      className="history-log"
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        width: 260,
        maxHeight: 130,
        overflowY: "auto",
        background: `${C.panel}cc`,
        backdropFilter: "blur(4px)",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {sortedLog.map((entry) => {
        const isCurrent = entry.round === snappedRound;
        const isFuture = entry.round > snappedRound;
        return (
          <div
            key={entry.round}
            ref={isCurrent ? currentLogRef : null}
            style={{
              flexShrink: 0,
              fontSize: 11,
              lineHeight: 1.6,
              padding: "4px 6px",
              borderRadius: 5,
              background: isCurrent ? `${C.supports}22` : "transparent",
              border: isCurrent
                ? `1px solid ${C.supports}55`
                : "1px solid transparent",
              color: isCurrent ? C.text : C.dim,
              opacity: isFuture ? 0 : 1,
              transition: isFuture ? "none" : "opacity 2.2s ease-in-out",
              pointerEvents: isFuture ? "none" : "auto",
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                color: isCurrent ? C.supports : C.dim,
              }}
            >
              Round {entry.round}:
            </span>{" "}
            {entry.changes}
          </div>
        );
      })}
    </div>
  );
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

/**
 * Renders the History tab: animated, slider-controlled playback of the RE process
 * round by round.
 *
 * @param {Object}      props
 * @param {REState}     props.state
 * @param {PositionMap} props.positions
 * @param {function(number): void} props.onRoundChange - Notifies parent of the current round.
 * @returns {React.ReactElement}
 */
export function HistoryTab({ state, positions, onRoundChange, isWide }) {
  const containerRef = useRef();
  const dims = useContainerDims(containerRef);
  const [tooltip, setTooltip] = useState(null);
  const logRef = useRef();
  const currentLogRef = useRef();

  const {
    pan,
    zoom,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    applyWheel,
    zoomIn,
    zoomOut,
    resetView,
  } = usePan();
  useAutoFit({ positions, dims, resetView, refitKey: state.elements.length });
  const playback = usePlayback(state.round);
  const { snappedRound } = playback;

  useEffect(() => {
    onRoundChange?.(snappedRound);
  }, [snappedRound, onRoundChange]);
  useEffect(() => {
    currentLogRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [snappedRound]);

  const { withdrawn } = elementsAtRound(state.elements, snappedRound);
  const wIds = new Set(withdrawn.map((e) => e.id));
  const newIds = new Set(
    snappedRound > 0
      ? state.elements
          .filter((e) => e.addedRound === snappedRound)
          .map((e) => e.id)
      : [],
  );
  const sortedLog = [...state.log].sort((a, b) => a.round - b.round);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PlaybackControls playback={playback} maxRound={state.round} />
      <GraphCanvas
        containerRef={containerRef}
        dims={dims}
        pan={pan}
        zoom={zoom}
        isDragging={isDragging}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        applyWheel={applyWheel}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        tooltip={tooltip}
        containerStyle={{ flex: 1, minHeight: 0 }}
        overlay={
          <>
            {isWide && (
              <LogOverlay
                sortedLog={sortedLog}
                snappedRound={snappedRound}
                logRef={logRef}
                currentLogRef={currentLogRef}
              />
            )}
            <OffscreenIndicators
              els={state.elements}
              positions={positions}
              pan={pan}
              zoom={zoom}
              dims={dims}
              color={C.dim}
            />
          </>
        }
      >
        {state.relations.map((r, i) =>
          renderEdge(
            r,
            i,
            positions,
            state.elements,
            historyEdgeVisuals(r, wIds, snappedRound),
          ),
        )}
        {state.elements.map((el) =>
          renderNode(
            el,
            positions,
            historyNodeVisuals(el, wIds, newIds, snappedRound),
            isDragging,
            setTooltip,
          ),
        )}
      </GraphCanvas>
    </div>
  );
}
