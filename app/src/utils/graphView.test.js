import { describe, it, expect } from "vitest";

import { drawnOnGraph, graphHighlights } from "./graphView.js";

const el = (id, overrides = {}) => ({
  id,
  type: id.startsWith("P") ? "principle" : id.startsWith("T") ? "theory" : "judgment",
  status: "active",
  confidence: 1,
  text: `Text of ${id}`,
  addedRound: 1,
  ...overrides,
});
const rel = (from, to, overrides = {}) => ({
  from,
  to,
  type: "supports",
  explanation: "",
  addedRound: 1,
  ...overrides,
});
const ids = (els) => els.map((e) => e.id).sort();

describe("drawnOnGraph", () => {
  const state = {
    round: 4,
    elements: [
      el("J1"),
      el("J2", { status: "withdrawn", history: [{ round: 3, type: "withdrawn" }] }),
      el("P1"),
      el("P2", { status: "rejected" }),
      el("T1"),
      el("J3", { status: "possible" }),
    ],
    relations: [
      rel("J1", "P1"),
      rel("J2", "P1"),
      rel("P2", "J1", { type: "conflicts" }),
      rel("T1", "P1", { type: "entails" }),
    ],
  };

  it("draws everything in play, withdrawn and rejected included, a possible element never", () => {
    const { visibleEls, wIds } = drawnOnGraph(state);
    expect(ids(visibleEls)).toEqual(["J1", "J2", "P1", "P2", "T1"]);
    expect([...wIds]).toEqual(["J2"]);
  });

  it("draws a rejected element once", () => {
    const { visibleEls } = drawnOnGraph(state);
    expect(visibleEls.filter((e) => e.id === "P2")).toHaveLength(1);
  });

  it("hides what the legend hides, and every relation to it", () => {
    const { visibleEls, visRels } = drawnOnGraph(state, new Set(["T", "withdrawn"]));
    expect(ids(visibleEls)).toEqual(["J1", "P1", "P2"]);
    expect(visRels.map((r) => `${r.from}>${r.to}`)).toEqual(["J1>P1", "P2>J1"]);
  });

  it("hides a relation type the legend hides", () => {
    const { visRels } = drawnOnGraph(state, new Set(["conflicts"]));
    expect(visRels.some((r) => r.type === "conflicts")).toBe(false);
  });

  it("leaves out the edges of what the equilibrium preview would withdraw", () => {
    const { visibleEls, visRels } = drawnOnGraph(state, null, new Set(["P1"]));
    expect(ids(visibleEls)).toContain("P1");
    expect(visRels.some((r) => r.from === "P1" || r.to === "P1")).toBe(false);
  });
});

describe("graphHighlights", () => {
  const displayEls = ["J1", "J2", "P1", "P2"].map((id) => el(id));
  const argument = [
    rel("J1", "P1", { type: "jointly_entails", argumentId: "A1" }),
    rel("J2", "P1", { type: "jointly_entails", argumentId: "A1" }),
  ];
  const other = rel("P2", "J2", { type: "conflicts" });
  const displayRels = [...argument, other];
  const base = {
    groups: [],
    selected: null,
    selectedRel: null,
    ctrlArgNodes: [],
    displayEls,
    displayRels,
    toSourceRel: (r) => r,
    query: "",
    elementById: new Map(displayEls.map((e) => [e.id, e])),
  };

  it("fades nothing with nothing selected or searched", () => {
    const h = graphHighlights(base);
    expect(h.highlightedIds).toBeNull();
    expect(displayEls.some((e) => h.dimNode(e.id))).toBe(false);
    expect(displayRels.some(h.dimEdge)).toBe(false);
  });

  it("lights a selected element and its neighbours, and the edges at it", () => {
    const h = graphHighlights({ ...base, selected: "J1" });
    expect([...h.highlightedIds].sort()).toEqual(["J1", "P1"]);
    expect(h.dimNode("P2")).toBe(true);
    expect(h.dimEdge(argument[0])).toBe(false);
    expect(h.dimEdge(other)).toBe(true);
  });

  it("lights a whole argument when one of its relations is selected", () => {
    const h = graphHighlights({ ...base, selectedRel: argument[1] });
    expect([...h.highlightedIds].sort()).toEqual(["J1", "J2", "P1"]);
    expect(h.dimEdge(argument[0])).toBe(false);
    expect(h.dimEdge(other)).toBe(true);
  });

  it("lights a ctrl+click chain as picked", () => {
    const h = graphHighlights({ ...base, selected: "J1", ctrlArgNodes: ["P2"] });
    expect([...h.highlightedIds].sort()).toEqual(["J1", "P2"]);
  });

  it("fades what a search did not find, and the relations the panel would not list", () => {
    const h = graphHighlights({ ...base, query: "j1" });
    expect(h.dimNode("J1")).toBe(false);
    expect(h.dimNode("P1")).toBe(true);
    expect(h.dimEdge(argument[0])).toBe(false); // J1 → P1: listed by its end's id
    expect(h.dimEdge(other)).toBe(true);
  });

  it("asks a search of the relation held in state, not a copy re-pointed at a group", () => {
    const copy = { ...other, from: "G1" };
    const h = graphHighlights({
      ...base,
      displayRels: [...argument, copy],
      toSourceRel: (r) => (r === copy ? other : r),
      query: "p2",
    });
    expect(h.dimEdge(copy)).toBe(false);
  });
});
