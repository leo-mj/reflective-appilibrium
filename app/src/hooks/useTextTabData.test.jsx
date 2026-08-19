// @vitest-environment jsdom
//
// Selection is one id, and for an element that is the whole story. A group is
// not: the panel holds no card called "G1", so reading the selection literally
// left a selected group showing its own name over nothing at all.
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { useTextTabData } from "./useTextTabData.js";

const el = (id, type = "judgment") => ({
  id,
  type,
  status: "active",
  confidence: 1,
  origin: "user",
  text: `Text for ${id}`,
  addedRound: 1,
});

const rel = (from, to, type = "supports") => ({
  from,
  to,
  type,
  explanation: "",
  addedRound: 1,
});

/** J1 and J2 are grouped; P1 hears from J1; T1 is off on its own. */
const STATE = {
  topic: "Test",
  phase: 2,
  round: 2,
  elements: [el("J1"), el("J2"), el("P1", "principle"), el("T1", "theory")],
  relations: [rel("J1", "P1"), rel("J2", "J1"), rel("T1", "P1")],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
  groups: [
    { id: "G1", label: "Duties", members: ["J1", "J2"], collapsed: true },
  ],
};

const read = (selected, state = STATE) =>
  renderHook(() =>
    useTextTabData({
      state,
      hiddenLegendKeys: new Set(),
      selected,
      selectedRel: null,
      recentlyAdded: null,
      recentlyAddedRel: null,
      search: "",
      hideNonEntailsRels: false,
    }),
  ).result.current;

const ids = (els) => els.map((e) => e.id).sort();

describe("selecting an element", () => {
  it("shows the element and its neighbours", () => {
    const d = read("P1");
    expect(ids(d.selectedEls)).toEqual(["P1"]);
    expect(d.selectedGroup).toBeNull();
    expect(ids(d.neighbourEls)).toEqual(["J1", "T1"]);
  });
});

describe("selecting a group", () => {
  it("shows the members, which is what the group is", () => {
    const d = read("G1");
    expect(d.selectedGroup).toMatchObject({ id: "G1", label: "Duties" });
    expect(ids(d.selectedEls)).toEqual(["J1", "J2"]);
  });

  it("does not list a member as its own neighbour", () => {
    // J2 supports J1, and both are in the group; the card belongs in one place.
    const d = read("G1");
    expect(ids(d.neighbourEls)).toEqual(["P1"]);
  });

  it("highlights every relation either member holds", () => {
    const d = read("G1");
    expect(d.hlRels.map((r) => [r.from, r.to])).toEqual([
      ["J1", "P1"],
      ["J2", "J1"],
    ]);
    // …and nothing else. T1→P1 touches neither member.
    expect(d.restRels.map((r) => [r.from, r.to])).toEqual([["T1", "P1"]]);
  });

  it("leaves the rest of the panel dimmed behind it", () => {
    const d = read("G1");
    expect(ids(d.restEls)).toEqual(["T1"]);
  });

  it("reads an expanded group exactly the same way", () => {
    // The group is what is selected either way; whether its members happen to
    // be drawn separately is the canvas's business, not the panel's.
    const expanded = {
      ...STATE,
      groups: [{ ...STATE.groups[0], collapsed: false }],
    };
    const d = read("G1", expanded);
    expect(ids(d.selectedEls)).toEqual(["J1", "J2"]);
    expect(ids(d.neighbourEls)).toEqual(["P1"]);
  });

  it("falls back to nothing selected for a group id that is gone", () => {
    const d = read("G9");
    expect(d.selectedGroup).toBeNull();
    expect(d.selectedEls).toEqual([]);
  });
});
