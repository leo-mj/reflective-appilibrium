import { describe, it, expect } from "vitest";
import {
  computeJunction,
  distToQuadBezier,
  distToSegment,
  groupJointArguments,
  hitRadius,
  nodeRadius,
  parallelEdgeOffsets,
} from "./graphHelpers.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rel = (from, to, overrides = {}) => ({
  from,
  to,
  type: "supports",
  explanation: "",
  addedRound: 1,
  ...overrides,
});

const joint = (from, to, argumentId) =>
  rel(from, to, { type: "jointly_entails", argumentId });

// ─── nodeRadius / hitRadius ───────────────────────────────────────────────────

describe("nodeRadius", () => {
  const TYPES = ["judgment", "principle", "theory"];

  it("gives a confident element several times the area of a tentative one", () => {
    // Size is the main confidence cue on the graph, so the ends have to be
    // obviously different. Area, not radius, is what the eye compares.
    for (const type of TYPES) {
      const area = (c) => Math.PI * nodeRadius(type, c) ** 2;
      expect(area(1) / area(0), type).toBeGreaterThan(3);
    }
  });

  it("keeps the smallest node wide enough for a three-character id", () => {
    // What sets the floor. "J14" at 11px bold is ~20px wide; below that the
    // label spills out of its own shape.
    expect(nodeRadius("judgment", 0) * 2).toBeGreaterThan(20);
  });

  it("orders the three types by generality at equal confidence", () => {
    // A principle covers judgments, so it draws bigger; a theory sits between.
    for (const c of [0, 0.5, 1]) {
      expect(nodeRadius("principle", c)).toBeGreaterThan(nodeRadius("theory", c));
      expect(nodeRadius("theory", c)).toBeGreaterThan(nodeRadius("judgment", c));
    }
  });

  it("clamps confidence rather than extrapolating off the ramp", () => {
    expect(nodeRadius("judgment", -1)).toBe(nodeRadius("judgment", 0));
    expect(nodeRadius("judgment", 5)).toBe(nodeRadius("judgment", 1));
  });
});

describe("hitRadius", () => {
  it("keeps the smallest node tappable", () => {
    // A zero-confidence judgment is ~7px across. Without the floor its target
    // would be smaller than a fingertip, and it is still a node one must be
    // able to pick.
    for (const type of ["judgment", "principle", "theory"]) {
      expect(hitRadius(type, 0), type).toBeGreaterThanOrEqual(18);
    }
  });

  it("always exceeds the visual radius", () => {
    for (const type of ["judgment", "principle", "theory"]) {
      for (const c of [0, 0.5, 1]) {
        expect(hitRadius(type, c)).toBeGreaterThan(nodeRadius(type, c));
      }
    }
  });
});

// ─── groupJointArguments ──────────────────────────────────────────────────────

describe("groupJointArguments", () => {
  it("leaves ordinary relations solo", () => {
    const rels = [rel("J1", "P1"), rel("P1", "J2", { type: "conflicts" })];
    const { solo, jointGroups } = groupJointArguments(rels);
    expect(solo).toEqual(rels);
    expect(jointGroups).toEqual([]);
  });

  it("groups premises that share an argumentId", () => {
    const a = joint("J1", "J3", "arg1");
    const b = joint("J2", "J3", "arg1");
    const { solo, jointGroups } = groupJointArguments([a, b]);
    expect(jointGroups).toEqual([[a, b]]);
    expect(solo).toEqual([]);
  });

  it("keeps separate arguments in separate groups", () => {
    const rels = [
      joint("J1", "J3", "arg1"),
      joint("J2", "J3", "arg1"),
      joint("J4", "J6", "arg2"),
      joint("J5", "J6", "arg2"),
    ];
    const { jointGroups } = groupJointArguments(rels);
    expect(jointGroups).toHaveLength(2);
    expect(jointGroups.map((g) => g.length)).toEqual([2, 2]);
  });

  it("falls back to solo when only one premise of a group survives filtering", () => {
    // A joint argument whose other premises were filtered out still has to draw
    // as an ordinary edge rather than vanish.
    const only = joint("J1", "J3", "arg1");
    const { solo, jointGroups } = groupJointArguments([only]);
    expect(solo).toEqual([only]);
    expect(jointGroups).toEqual([]);
  });

  it("treats a joint relation with no argumentId as solo", () => {
    const orphan = rel("J1", "J3", { type: "jointly_entails" });
    const { solo, jointGroups } = groupJointArguments([orphan]);
    expect(solo).toEqual([orphan]);
    expect(jointGroups).toEqual([]);
  });

  it("groups jointly_precludes the same way", () => {
    const a = rel("J1", "J3", { type: "jointly_precludes", argumentId: "x" });
    const b = rel("J2", "J3", { type: "jointly_precludes", argumentId: "x" });
    expect(groupJointArguments([a, b]).jointGroups).toEqual([[a, b]]);
  });

  it("handles an empty list", () => {
    expect(groupJointArguments([])).toEqual({ solo: [], jointGroups: [] });
  });
});

// ─── parallelEdgeOffsets ──────────────────────────────────────────────────────

describe("parallelEdgeOffsets", () => {
  it("gives a lone edge no offset", () => {
    const r = rel("J1", "P1");
    expect(parallelEdgeOffsets([r]).get(r)).toBe(0);
  });

  it("spreads two edges symmetrically around zero", () => {
    const a = rel("J1", "P1");
    const b = rel("J1", "P1", { type: "conflicts" });
    const offsets = parallelEdgeOffsets([a, b]);
    expect(offsets.get(a)).toBe(-offsets.get(b));
    expect(offsets.get(a)).not.toBe(0);
  });

  it("centres an odd number of edges on zero", () => {
    const rels = [
      rel("J1", "P1"),
      rel("J1", "P1", { type: "conflicts" }),
      rel("J1", "P1", { type: "undermines" }),
    ];
    const values = rels.map((r) => parallelEdgeOffsets(rels).get(r));
    expect(values[1]).toBe(0);
    expect(values[0]).toBe(-values[2]);
  });

  it("negates a reversed edge's offset so both shift off the same axis", () => {
    // An offset is a perpendicular shift in its own edge's direction frame, and
    // P1→J1's frame is J1→P1's flipped. So the second slot's raw +11 becomes -11
    // when the edge runs backwards — which puts it on the opposite screen side
    // from the forward edge, not on top of it. Compare the two arrangements:
    const forward = rel("J1", "P1");
    const alsoForward = rel("J1", "P1", { type: "conflicts" });
    const backward = rel("P1", "J1");

    const bothForward = parallelEdgeOffsets([forward, alsoForward]);
    const mixed = parallelEdgeOffsets([forward, backward]);

    expect(mixed.get(forward)).toBe(bothForward.get(forward));
    expect(mixed.get(backward)).toBe(-bothForward.get(alsoForward));
  });

  it("groups both directions of a pair together", () => {
    // Otherwise each direction would be offset as if it were alone — i.e. not at
    // all — and the two edges would overlap exactly.
    const forward = rel("J1", "P1");
    const backward = rel("P1", "J1");
    const offsets = parallelEdgeOffsets([forward, backward]);
    expect(offsets.get(forward)).not.toBe(0);
    expect(offsets.get(backward)).not.toBe(0);
  });

  it("offsets different node pairs independently", () => {
    const a = rel("J1", "P1");
    const b = rel("J2", "P2");
    const offsets = parallelEdgeOffsets([a, b]);
    expect(offsets.get(a)).toBe(0);
    expect(offsets.get(b)).toBe(0);
  });
});

// ─── computeJunction ──────────────────────────────────────────────────────────

describe("computeJunction", () => {
  it("places the junction between centroid and conclusion", () => {
    const { jx, jy } = computeJunction(100, 0, { x: 0, y: 0 }, 10);
    expect(jy).toBe(0);
    expect(jx).toBeGreaterThan(0);
    expect(jx).toBeLessThanOrEqual(100);
  });

  it("keeps the junction clear of the conclusion node's radius", () => {
    // Centroid very close to the conclusion: the junction must still sit outside
    // the node rather than inside it.
    const tr = 30;
    const { jx } = computeJunction(2, 0, { x: 0, y: 0 }, tr);
    expect(Math.abs(jx)).toBeGreaterThanOrEqual(tr);
  });

  it("does not produce NaN when the centroid coincides with the conclusion", () => {
    const { jx, jy } = computeJunction(0, 0, { x: 0, y: 0 }, 10);
    expect(Number.isNaN(jx)).toBe(false);
    expect(Number.isNaN(jy)).toBe(false);
  });
});

// ─── Hit-testing ──────────────────────────────────────────────────────────────

describe("distToSegment", () => {
  it("is zero for a point on the segment", () => {
    expect(distToSegment(5, 0, 0, 0, 10, 0)).toBe(0);
  });

  it("measures perpendicular distance from the middle", () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBe(3);
  });

  it("clamps past the ends rather than measuring to the infinite line", () => {
    // 20 is beyond the segment end at 10, so the answer is the distance to the
    // endpoint (10), not the perpendicular distance to the line (0).
    expect(distToSegment(20, 0, 0, 0, 10, 0)).toBe(10);
    expect(distToSegment(-5, 0, 0, 0, 10, 0)).toBe(5);
  });

  it("handles a degenerate zero-length segment", () => {
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});

describe("distToQuadBezier", () => {
  it("is zero at the curve's start and end points", () => {
    expect(distToQuadBezier(0, 0, 0, 0, 5, 10, 10, 0)).toBe(0);
    expect(distToQuadBezier(10, 0, 0, 0, 5, 10, 10, 0)).toBe(0);
  });

  it("finds a near-zero distance at the curve's midpoint", () => {
    // A quadratic bezier passes through (cx/2 + ends/4) at t = 0.5 — here (5, 5).
    expect(distToQuadBezier(5, 5, 0, 0, 5, 10, 10, 0)).toBeLessThan(0.001);
  });

  it("reports a real distance for a point well off the curve", () => {
    expect(distToQuadBezier(5, -50, 0, 0, 5, 10, 10, 0)).toBeGreaterThan(49);
  });

  it("degenerates to a straight line when the control point is collinear", () => {
    expect(distToQuadBezier(5, 4, 0, 0, 5, 0, 10, 0)).toBeCloseTo(4, 5);
  });

  it("gets more accurate with more samples", () => {
    const coarse = distToQuadBezier(5, 5.2, 0, 0, 5, 10, 10, 0, 2);
    const fine = distToQuadBezier(5, 5.2, 0, 0, 5, 10, 10, 0, 64);
    expect(fine).toBeLessThanOrEqual(coarse);
  });
});
