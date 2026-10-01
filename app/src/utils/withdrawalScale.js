/**
 * @fileoverview The scale the withdrawal-score bars are drawn against.
 *
 * The bars used to run on 0–1, the range the measures themselves have, and that
 * made every one of them a sliver: withdrawing an element moves account by
 * `(2D ± 1)/N²` — a few hundredths on any real process, and *smaller the larger
 * the process gets*, since `N` is the whole sentence pool. The sample's own
 * numbers are 0.014–0.048 for account and 0.052–0.172 for systematicity, so a
 * 0–1 bar spent 95% of its width on space no element will ever reach.
 *
 * That `1/N²` is also why a fixed maximum cannot serve: a scale generous enough
 * for a six-element process leaves a forty-element one flat, and one fitted to
 * forty clips at six. So the maximum comes from the values on screen — one
 * scale for every card, which is what lets the bars answer the question they
 * are actually asked ("which of my elements is load-bearing?") — and is
 * *quantised*, so it stays put as the numbers shift underneath it and can be
 * named in a tooltip. An unrounded peer maximum would redraw every bar in the
 * panel on each recompute, and the one element at the top would always be full
 * width, which reads as a verdict rather than a measurement.
 *
 * @module utils/withdrawalScale
 */

/**
 * The maxima a bar may be drawn against. Coarse on purpose: a reader is meant
 * to recognise the scale they are on, and it has to survive a delta wobbling.
 */
export const WITHDRAWAL_SCALE_STEPS = [0.05, 0.1, 0.2, 0.5, 1];

/**
 * The smallest step that holds every delta in the panel.
 *
 * The first step doubles as the floor, for the case the bars would otherwise
 * magnify rounding noise into drama: a process whose largest score moves by
 * 0.002 should show three empty tracks, not three full ones.
 *
 * @param {Record<string, {delta_account: number, delta_systematicity: number}|null>|null} deltas
 * @returns {number} One of {@link WITHDRAWAL_SCALE_STEPS}.
 */
export function withdrawalScale(deltas) {
  let max = 0;
  for (const d of Object.values(deltas ?? {})) {
    if (!d) continue;
    max = Math.max(
      max,
      Math.abs(d.delta_account ?? 0),
      Math.abs(d.delta_systematicity ?? 0),
    );
  }
  return (
    WITHDRAWAL_SCALE_STEPS.find((step) => max <= step) ??
    WITHDRAWAL_SCALE_STEPS[WITHDRAWAL_SCALE_STEPS.length - 1]
  );
}
