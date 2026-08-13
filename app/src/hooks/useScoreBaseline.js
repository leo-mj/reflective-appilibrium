/**
 * @fileoverview The current state's equilibrium scores, against which a
 * suggestion's effect is measured.
 * @module hooks/useScoreBaseline
 */

import { useEffect, useState } from "react";
import { quickScore } from "../utils/simulateRethonClient.js";

/**
 * Account and systematicity for the state as it stands.
 *
 * `ScoreDeltaBadge` subtracts this from the score of the state-plus-suggestion
 * to show what accepting would do. Null until it arrives, and null when scoring
 * is unavailable — the demo build has no backend to ask — which the badge reads
 * as "render nothing".
 *
 * @param {import('../types.js').REState} state
 * @param {Object|null} weights
 * @returns {{account: number, systematicity: number}|null}
 */
export function useScoreBaseline(state, weights) {
  const [baseline, setBaseline] = useState(null);

  useEffect(() => {
    let cancelled = false;
    quickScore(state.elements, state.relations, weights).then((scores) => {
      if (!cancelled) setBaseline(scores ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [state.elements, state.relations, weights]);

  return baseline;
}
