// Edge and node styling for history playback. `historyEdgeVisuals` decides
// whether an edge reads as present, gone, or not yet existing at a given round —
// the only place relation withdrawal reaches the History tab.
import { describe, it, expect } from "vitest";
import { historyEdgeVisuals, historyNodeVisuals } from "./graphRender.jsx";

const rel = (overrides = {}) => ({
  from: "J1",
  to: "P1",
  type: "supports",
  addedRound: 1,
  ...overrides,
});

const NONE = new Set();

describe("historyEdgeVisuals", () => {
  it("shows an edge whose endpoints are both in play", () => {
    const v = historyEdgeVisuals(rel(), NONE, 5);
    expect(v.isWithdrawn).toBe(false);
    expect(v.opacity).toBeGreaterThan(0.5);
  });

  it("greys an edge when an endpoint is withdrawn", () => {
    const v = historyEdgeVisuals(rel(), new Set(["P1"]), 5);
    expect(v.isWithdrawn).toBe(true);
    expect(v.opacity).toBe(0.25);
  });

  it("greys an edge withdrawn on its own, endpoints intact", () => {
    // Previously invisible to playback: only endpoint withdrawal was checked.
    const r = rel({ history: [{ round: 4, type: "withdrawn" }] });
    expect(historyEdgeVisuals(r, NONE, 3).isWithdrawn).toBe(false);
    expect(historyEdgeVisuals(r, NONE, 4).isWithdrawn).toBe(true);
  });

  it("brings a reinstated edge back", () => {
    const r = rel({
      history: [
        { round: 4, type: "withdrawn" },
        { round: 7, type: "reinstated" },
      ],
    });
    expect(historyEdgeVisuals(r, NONE, 5).isWithdrawn).toBe(true);
    expect(historyEdgeVisuals(r, NONE, 7).isWithdrawn).toBe(false);
  });

  it("reads the legacy withdrawnRound shape", () => {
    const r = rel({ withdrawnRound: 4 });
    expect(historyEdgeVisuals(r, NONE, 3).isWithdrawn).toBe(false);
    expect(historyEdgeVisuals(r, NONE, 4).isWithdrawn).toBe(true);
  });

  it("hides an edge that does not exist yet", () => {
    const v = historyEdgeVisuals(rel({ addedRound: 6 }), NONE, 3);
    expect(v.opacity).toBe(0);
    expect(v.transition).toBe("none");
  });

  it("greys a joint argument when any premise is gone", () => {
    const group = [rel({ from: "J1" }), rel({ from: "J2" })];
    expect(historyEdgeVisuals(group[0], new Set(["J2"]), 5, group).isWithdrawn).toBe(
      true,
    );
  });

  it("greys a joint argument when one of its relations is withdrawn", () => {
    const group = [
      rel({ from: "J1" }),
      rel({ from: "J2", history: [{ round: 3, type: "withdrawn" }] }),
    ];
    expect(historyEdgeVisuals(group[0], NONE, 5, group).isWithdrawn).toBe(true);
  });
});

describe("historyNodeVisuals", () => {
  const el = { id: "J1", type: "judgment", confidence: 1, addedRound: 2 };

  it("hides a node before the round it was added", () => {
    expect(historyNodeVisuals(el, NONE, NONE, 1).opacity).toBe(0);
  });

  it("fades a withdrawn node", () => {
    expect(historyNodeVisuals(el, new Set(["J1"]), NONE, 5).opacity).toBe(0.25);
  });

  it("rings a node added this round, but not a withdrawn one", () => {
    expect(historyNodeVisuals(el, NONE, new Set(["J1"]), 2).children).not.toBeNull();
    expect(
      historyNodeVisuals(el, new Set(["J1"]), new Set(["J1"]), 2).children,
    ).toBeNull();
  });
});
