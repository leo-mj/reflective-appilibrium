import { describe, it, expect } from "vitest";

import { withdrawalScale, WITHDRAWAL_SCALE_STEPS } from "./withdrawalScale.js";

const at = (...pairs) =>
  Object.fromEntries(
    pairs.map(([id, a, s]) => [
      id,
      { delta_account: a, delta_systematicity: s },
    ]),
  );

describe("withdrawalScale", () => {
  it("takes the smallest step that holds every value", () => {
    // The sample process's own numbers: account tops out at 0.048 and
    // systematicity at 0.172, so the panel is on the 0.2 scale.
    expect(
      withdrawalScale(at(["J1", 0.0434, 0], ["P2", -0.0138, 0.1719])),
    ).toBe(0.2);
  });

  it("reads both measures, not only the account", () => {
    expect(withdrawalScale(at(["P1", 0.001, 0.09]))).toBe(0.1);
  });

  it("ignores the sign", () => {
    expect(withdrawalScale(at(["J1", -0.4, 0]))).toBe(0.5);
  });

  it("floors at the first step rather than magnifying noise", () => {
    // Three scores that move by a thousandth are three empty tracks, not three
    // full ones.
    expect(withdrawalScale(at(["J1", 0.002, 0]))).toBe(0.05);
    expect(withdrawalScale(at(["J1", 0, 0]))).toBe(0.05);
  });

  it("caps at 1, the range the measures themselves have", () => {
    expect(withdrawalScale(at(["J1", -1, 1]))).toBe(1);
    // Beyond it is not reachable, but a bar has to be drawable anyway.
    expect(withdrawalScale(at(["J1", -4, 0]))).toBe(1);
  });

  it("survives a panel with nothing scored", () => {
    // `null` before the first run, and one entry per element that could not be
    // scored at all.
    for (const deltas of [null, undefined, {}, { J1: null }]) {
      expect(withdrawalScale(deltas)).toBe(WITHDRAWAL_SCALE_STEPS[0]);
    }
  });
});
