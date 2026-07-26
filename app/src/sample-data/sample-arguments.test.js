import { describe, it, expect } from "vitest";
import { getSampleArguments } from "./sample-arguments.js";
import { ELICITABLE_ARGUMENT_PREMISES } from "./sample-judgments.js";
import { argumentPostulateExplanation } from "../utils/stateUtils.js";

// Sample-state element order: J1–J13 = 1–13, P1–P6 = 14–19, T1 = 20, T2 = 21,
// J14 = 22 (the premise promoted into the state).
const elements = [
  ...Array.from({ length: 13 }, (_, i) => ({
    id: `J${i + 1}`,
    type: "judgment",
    status: "active",
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `P${i + 1}`,
    type: "principle",
    status: "active",
  })),
  { id: "T1", type: "theory", status: "active" },
  { id: "T2", type: "theory", status: "active" },
  { id: "J14", type: "judgment", status: "active" },
];

describe("getSampleArguments", () => {
  it("surfaces all 15 audited arguments over the full pool", () => {
    const res = getSampleArguments(elements, "8");
    expect(res.num_arguments).toHaveLength(15);
    expect(res.model).toBe("claude-fable-5");
    expect(res.rejected_count).toBe(0);
  });

  it("returns argument_postulates parallel to num_arguments, one bridge each", () => {
    const res = getSampleArguments(elements, "8");
    expect(res.argument_postulates).toHaveLength(res.num_arguments.length);
    expect(res.translated_arguments).toHaveLength(res.num_arguments.length);
    // Every surfaced argument relies on exactly one meaning postulate.
    expect(res.argument_postulates.every((p) => p.length === 1)).toBe(true);
  });

  it("keeps the first surfaced argument in its postulate-stripped form", () => {
    const res = getSampleArguments(elements, "8");
    // P1 + J14 → J1, reconstructed from existing elements (22 = J14). No
    // postulate index (30–44) leaks in, and every index resolves in the lookup.
    expect(res.num_arguments[0]).toEqual([14, 22, 1]);
    for (const arg of res.num_arguments) {
      for (const n of arg) expect(res.lookup[Math.abs(n)]).toBeDefined();
    }
  });

  it("reuses an accepted Elicit-Judgments premise instead of re-proposing it", () => {
    // Simulate the user having accepted the "2100 affected" judgment in Elicit
    // Judgments: it is now an element appended after the base state (position 23).
    const accepted = {
      id: "J15",
      type: "judgment",
      status: "active",
      text: ELICITABLE_ARGUMENT_PREMISES.affected2100,
    };
    const grown = [...elements, accepted];
    const res = getSampleArguments(grown, "8");
    // P5 + [2100-affected] → J2 (canonical [18, 24, 2]) now points at the
    // accepted element (index 23), not a freshly injected premise.
    expect(res.num_arguments).toContainEqual([18, 23, 2]);
    // No injected premise carries that text — it was reused from the pool.
    const injected = Object.values(res.lookup).filter((e) => !grown.includes(e));
    expect(injected.map((e) => e.text)).not.toContain(
      ELICITABLE_ARGUMENT_PREMISES.affected2100,
    );
  });

  it("proposes the elicitable premise as new when it is not yet in the pool", () => {
    // Without acceptance, P5 + premise → J2 injects the premise at index 24.
    const res = getSampleArguments(elements, "8");
    expect(res.num_arguments).toContainEqual([18, 24, 2]);
    expect(res.lookup[24].text).toBe(ELICITABLE_ARGUMENT_PREMISES.affected2100);
  });

  it("composes a 'Valid given: …' explanation from each argument's postulates", () => {
    const res = getSampleArguments(elements, "8");
    for (const postulates of res.argument_postulates) {
      const explanation = argumentPostulateExplanation(postulates);
      expect(explanation.startsWith("Valid given: ")).toBe(true);
      expect(explanation.length).toBeGreaterThan("Valid given: ".length);
    }
  });

  it("dedups against arguments already in the state, keeping postulates parallel", () => {
    // arg-sample-1 (T1 + T2 → P2, indices [20, 21, 15]) already recorded.
    const relations = [
      { from: "T1", to: "P2", type: "jointly_entails", argumentId: "arg-sample-1" },
      { from: "T2", to: "P2", type: "jointly_entails", argumentId: "arg-sample-1" },
    ];
    const res = getSampleArguments(elements, "8", relations);
    expect(res.num_arguments).toHaveLength(14);
    expect(res.argument_postulates).toHaveLength(14);
    expect(res.num_arguments).not.toContainEqual([20, 21, 15]);
  });
});
