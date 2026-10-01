/**
 * @fileoverview Playback state and animation for the History tab and the
 * Simulate tab's simulation history — one hook, so the two play alike and
 * offer the same speeds.
 * @module hooks/usePlayback
 */

import { useState, useEffect, useRef } from "react";

/** Available playback speed multipliers, the same on every tab that plays. */
export const SPEEDS = [0.5, 1, 2, 4];
/** Where every playback starts. */
export const DEFAULT_SPEED = 1;
/**
 * Time per notch at 1×, in milliseconds — History's and the Simulate tab's
 * alike, so a speed means the same pace on both. History used to take 3.2s a
 * step, which dragged; Simulate scaled its own pace to the run's length, as
 * fast as 250ms, which could not be followed on the graph.
 */
export const BASE_INTERVAL_MS = 1000;
/** Exponential easing factor per animation frame (0–1; lower = slower). */
const EASING_FACTOR = 0.08;

/**
 * Manages all playback state and side-effects.
 *
 * Counts notches, not steps: the tab hands it how many there are, and maps a
 * notch to a step itself — every step, or the end of each round (stateUtils,
 * "Steps and rounds"). The names still say "round" from when the two were one.
 *
 * The pace is not an option: one scale, `BASE_INTERVAL_MS` times `SPEEDS`,
 * for every tab, so that 1× means the same on each.
 *
 * @param {number} maxRound - The last notch.
 * @param {Object} [options]
 * @param {boolean} [options.ease] - Whether `displayRound` glides toward the
 *   target, as History's slider and graph do between steps. Off, it is the
 *   target: the Simulate tab's steps are discrete positions, and a glide only
 *   delayed each one.
 * @returns {{ displayRound, targetRound, setTargetRound, playing, setPlaying,
 *             speed, setSpeed, snappedRound, resetPlayback, togglePlay, jumpTo }}
 */
export function usePlayback(maxRound, { ease = true } = {}) {
  const [easedRound, setDisplayRound] = useState(0);
  const [targetRound, setTargetRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
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
    if (!ease) return undefined;
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
  }, [targetRound, ease]);

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
    }, BASE_INTERVAL_MS / speed);
    return () => clearInterval(iv);
  }, [playing, maxRound, speed]);

  const displayRound = ease ? easedRound : targetRound;
  const snappedRound = Math.round(displayRound);

  const resetPlayback = () => {
    setTargetRound(0);
    setDisplayRound(0);
    setPlaying(false);
  };
  /** Goes straight to a notch, without easing — for a change of unit, where
   *  the slider is re-scaled and a glide across it would show nothing real. */
  const jumpTo = (index) => {
    setTargetRound(index);
    setDisplayRound(index);
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
    jumpTo,
  };
}
