/**
 * @fileoverview rethon's default simulation weights.
 *
 * The backend's too, which is why REState sends null rather than these while
 * they are unchanged. REState, the weight triangle and the Simulate tab all
 * read them from here.
 *
 * @module constants/simulationWeights
 */

export const DEFAULT_WEIGHTS = Object.freeze({
  account: 0.35,
  systematicity: 0.55,
  faithfulness: 0.1,
});
