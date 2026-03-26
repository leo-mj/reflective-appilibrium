import { describe, it, expect } from "vitest";
import {
  findCoherentClusters,
  findCrossClusterTensions,
  findMergeCandidates,
} from "./clusterUtils.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function el(id) {
  return { id, type: "judgment", status: "active", addedRound: 1 };
}

function rel(from, to, type = "supports") {
  return { from, to, type, addedRound: 1, explanation: "" };
}

function state(elements, relations) {
  return {
    elements,
    relations,
    coherence: { tensions: [], orphans: [], clusters: [] },
    log: [],
  };
}

// ─── findCoherentClusters ─────────────────────────────────────────────────────

describe("findCoherentClusters", () => {
  it("returns empty array when no elements", () => {
    expect(findCoherentClusters(state([], []))).toEqual([]);
  });

  it("returns empty array when no support edges", () => {
    const s = state([el("J1"), el("J2")], []);
    expect(findCoherentClusters(s)).toEqual([]);
  });

  it("finds a simple two-element cluster", () => {
    const s = state([el("J1"), el("J2")], [rel("J1", "J2")]);
    const clusters = findCoherentClusters(s);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toEqual(new Set(["J1", "J2"]));
  });

  it("finds a three-element chain cluster", () => {
    const s = state(
      [el("J1"), el("J2"), el("J3")],
      [rel("J1", "J2"), rel("J2", "J3")],
    );
    const clusters = findCoherentClusters(s);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toEqual(new Set(["J1", "J2", "J3"]));
  });

  it("does not merge clusters separated by a conflict", () => {
    const s = state(
      [el("J1"), el("J2"), el("J3"), el("J4")],
      [rel("J1", "J2"), rel("J3", "J4"), rel("J2", "J3", "conflicts")],
    );
    const clusters = findCoherentClusters(s);
    expect(clusters).toHaveLength(2);
  });

  it("does not merge clusters separated by an undermines edge", () => {
    const s = state(
      [el("J1"), el("J2"), el("J3"), el("J4")],
      [rel("J1", "J2"), rel("J3", "J4"), rel("J2", "J3", "undermines")],
    );
    const clusters = findCoherentClusters(s);
    expect(clusters).toHaveLength(2);
  });

  it("excludes withdrawn elements", () => {
    const withdrawn = { ...el("J2"), status: "withdrawn" };
    const s = state(
      [el("J1"), withdrawn, el("J3")],
      [rel("J1", "J2"), rel("J2", "J3")],
    );
    // J1 and J3 are not directly connected — no cluster
    expect(findCoherentClusters(s)).toHaveLength(0);
  });

  it("sorts clusters by size descending", () => {
    const s = state(
      [el("J1"), el("J2"), el("J3"), el("J4"), el("J5")],
      [rel("J1", "J2"), rel("J2", "J3"), rel("J4", "J5")],
    );
    const clusters = findCoherentClusters(s);
    expect(clusters[0].size).toBeGreaterThanOrEqual(clusters[1]?.size ?? 0);
  });
});

// ─── findCrossClusterTensions ─────────────────────────────────────────────────

describe("findCrossClusterTensions", () => {
  it("returns empty when no cross-cluster conflict edges", () => {
    const c1 = { members: new Set(["J1", "J2"]) };
    const c2 = { members: new Set(["J3", "J4"]) };
    const s = state(
      [el("J1"), el("J2"), el("J3"), el("J4")],
      [rel("J1", "J2"), rel("J3", "J4")],
    );
    expect(findCrossClusterTensions([c1, c2], s)).toEqual([]);
  });

  it("detects a conflict edge crossing cluster boundaries", () => {
    const c1 = { members: new Set(["J1", "J2"]) };
    const c2 = { members: new Set(["J3", "J4"]) };
    const conflictRel = rel("J2", "J3", "conflicts");
    const s = state(
      [el("J1"), el("J2"), el("J3"), el("J4")],
      [rel("J1", "J2"), rel("J3", "J4"), conflictRel],
    );
    const tensions = findCrossClusterTensions([c1, c2], s);
    expect(tensions).toHaveLength(1);
    expect(tensions[0].clusterIndices).toEqual([0, 1]);
    expect(tensions[0].edge).toBe(conflictRel);
  });

  it("detects an undermines edge crossing cluster boundaries", () => {
    const c1 = { members: new Set(["J1"]) };
    const c2 = { members: new Set(["J2"]) };
    const underminesRel = rel("J1", "J2", "undermines");
    const s = state([el("J1"), el("J2")], [underminesRel]);
    const tensions = findCrossClusterTensions([c1, c2], s);
    expect(tensions).toHaveLength(1);
  });

  it("ignores supports edges between clusters", () => {
    const c1 = { members: new Set(["J1"]) };
    const c2 = { members: new Set(["J2"]) };
    const s = state([el("J1"), el("J2")], [rel("J1", "J2")]);
    expect(findCrossClusterTensions([c1, c2], s)).toHaveLength(0);
  });
});

// ─── findMergeCandidates ──────────────────────────────────────────────────────

describe("findMergeCandidates", () => {
  it("returns empty when clusters have no support bridges", () => {
    const c1 = { members: new Set(["J1", "J2"]) };
    const c2 = { members: new Set(["J3", "J4"]) };
    const s = state(
      [el("J1"), el("J2"), el("J3"), el("J4")],
      [rel("J1", "J2"), rel("J3", "J4")],
    );
    expect(findMergeCandidates([c1, c2], s)).toHaveLength(0);
  });

  it("identifies a ready-to-merge pair (no conflicts)", () => {
    const c1 = { members: new Set(["J1", "J2"]) };
    const c2 = { members: new Set(["J3", "J4"]) };
    const bridge = rel("J2", "J3");
    const s = state(
      [el("J1"), el("J2"), el("J3"), el("J4")],
      [rel("J1", "J2"), rel("J3", "J4"), bridge],
    );
    const candidates = findMergeCandidates([c1, c2], s);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].conflictsToResolve).toHaveLength(0);
    expect(candidates[0].mergedSize).toBe(4);
    expect(candidates[0].wouldBeClean).toBe(true);
  });

  it("excludes pairs with more than 2 conflicts", () => {
    const c1 = { members: new Set(["J1"]) };
    const c2 = { members: new Set(["J2"]) };
    const s = state(
      [el("J1"), el("J2")],
      [
        rel("J1", "J2"),
        rel("J1", "J2", "conflicts"),
        rel("J2", "J1", "conflicts"),
        rel("J1", "J2", "undermines"),
      ],
    );
    // 3 conflict/undermines edges → excluded
    expect(findMergeCandidates([c1, c2], s)).toHaveLength(0);
  });

  it("sorts by conflictsToResolve ascending", () => {
    const c1 = { members: new Set(["J1"]) };
    const c2 = { members: new Set(["J2"]) };
    const c3 = { members: new Set(["J3"]) };
    const s = state(
      [el("J1"), el("J2"), el("J3")],
      [rel("J1", "J2"), rel("J1", "J2", "conflicts"), rel("J1", "J3")],
    );
    const candidates = findMergeCandidates([c1, c2, c3], s);
    // J1-J3 has 0 conflicts, J1-J2 has 1 conflict
    expect(candidates[0].conflictsToResolve.length).toBeLessThanOrEqual(
      candidates[candidates.length - 1].conflictsToResolve.length,
    );
  });
});
