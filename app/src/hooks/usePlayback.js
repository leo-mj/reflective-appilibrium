/**
 * @fileoverview Playback state and animation for the History tab.
 * @module hooks/usePlayback
 */

import { useState, useEffect, useRef } from "react";

/** Available playback speed multipliers. */
export const SPEEDS = [0.5, 1, 2, 4];
/** Base interval between rounds at 1× speed, in milliseconds. */
const BASE_ROUND_INTERVAL_MS = 3200;
/** Exponential easing factor per animation frame (0–1; lower = slower). */
const EASING_FACTOR = 0.08;

/**
 * Manages all playback state and side-effects for the History tab.
 *
 * @param {number} maxRound
 * @returns {{ displayRound, targetRound, setTargetRound, playing, setPlaying,
 *             speed, setSpeed, snappedRound, resetPlayback, togglePlay }}
 */
export function usePlayback(maxRound) {
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
