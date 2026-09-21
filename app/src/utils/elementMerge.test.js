import { describe, it, expect } from "vitest";
import {
  isMergeablePair,
  mergeElementPair,
  mergePool,
  samplePairs,
} from "./elementMerge.js";
import { tabVisibility } from "../constants/tabConstants.jsx";

const el = (id, text, extra = {}) => ({
  id,
  type: { J: "judgment", P: "principle", T: "theory" }[id[0]],
  status: "active",
  confidence: 0.7,
  origin: "user",
  text,
  addedRound: 1,
  ...extra,
});

const rel = (from, to, type = "supports", extra = {}) => ({
  from,
  to,
  type,
  explanation: "",
  addedRound: 1,
  ...extra,
});

// A: J1, J2, P1.  B: J3, J4, P2.  J5 fused from both. J6 added after the merge.
const PROCESSES = [
  { id: "A", label: "Lying", members: ["J1", "J2", "P1", "J5"], round: 2 },
  { id: "B", label: "Promises", members: ["J3", "J4", "P2", "J5"], round: 2 },
];
const state = {
  topic: "Honesty",
  phase: 2,
  round: 2,
  elements: [
    el("J1", "Lying to a friend is wrong."),
    el("J2", "Keeping secrets can be fine."),
    el("P1", "Never deceive."),
    el("J3", "It is wrong to lie to your friends.", { confidence: 0.9 }),
    el("J4", "Promises bind."),
    el("P2", "Never deceive anyone."),
    el("J5", "Honesty matters."),
    el("J6", "Added later."),
  ],
  relations: [
    rel("P1", "J1", "entails", { argumentId: "arg-1" }),
    rel("P2", "J3", "entails", { argumentId: "arg-2" }),
    rel("J4", "J3", "supports"),
    rel("J2", "J1", "conflicts"),
  ],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
  processes: PROCESSES,
};

describe("which pairs may be merged", () => {
  it("takes only elements that came from a process", () => {
    expect(mergePool(state, PROCESSES).map((p) => p.element.id)).not.toContain("J6");
  });

  it("allows one element from each process, of one type", () => {
    expect(isMergeablePair(state, PROCESSES, "J1", "J3")).toBe(true);
    expect(isMergeablePair(state, PROCESSES, "J1", "J2")).toBe(false); // same process
    expect(isMergeablePair(state, PROCESSES, "J1", "P2")).toBe(false); // across types
    expect(isMergeablePair(state, PROCESSES, "J5", "J3")).toBe(false); // J5 is in B already
    expect(isMergeablePair(state, PROCESSES, "J1", "J6")).toBe(false); // J6 is in no process
    expect(isMergeablePair(state, PROCESSES, "J1", "J99")).toBe(false);
  });

  it("offers sample pairs by overlapping wording, across processes only", () => {
    const pairs = samplePairs(state, PROCESSES);
    expect(pairs.map((p) => [p.a, p.b])).toContainEqual(["P1", "P2"]);
    pairs.forEach((p) => expect(isMergeablePair(state, PROCESSES, p.a, p.b)).toBe(true));
  });
});

describe("mergeElementPair", () => {
  const merge = (choice) =>
    mergeElementPair(state, {
      keepId: "J1",
      removeId: "J3",
      text: "Lying to a friend is wrong.",
      confidence: 0.7,
      ...choice,
    });

  it("removes one element and re-points its relations at the other, in one round", () => {
    const out = merge();
    expect(out.round).toBe(3);
    expect(out.elements.map((e) => e.id)).not.toContain("J3");
    expect(out.relations).toContainEqual(expect.objectContaining({ from: "P2", to: "J1", argumentId: "arg-2" }));
    expect(out.relations).toContainEqual(expect.objectContaining({ from: "J4", to: "J1", type: "supports" }));
    expect(out.relations.some((r) => r.from === "J3" || r.to === "J3")).toBe(false);
  });

  it("leaves untouched relations as the very same objects", () => {
    const out = merge();
    expect(out.relations[0]).toBe(state.relations[0]);
    expect(out.relations.at(-1)).toBe(state.relations.at(-1));
  });

  it("makes the kept element a member of both processes", () => {
    const out = merge();
    expect(out.processes[1].members).toEqual(["J1", "J4", "P2", "J5"]);
    expect(out.processes.every((p) => p.members.includes("J1"))).toBe(true);
    expect(out.processes.some((p) => p.members.includes("J3"))).toBe(false);
  });

  it("records a new wording as a revision, and a new confidence", () => {
    const out = merge({ text: "Lying to friends is wrong.", confidence: 0.9 });
    const j1 = out.elements.find((e) => e.id === "J1");
    expect(j1).toMatchObject({
      text: "Lying to friends is wrong.",
      confidence: 0.9,
      status: "revised",
      previousText: "Lying to a friend is wrong.",
    });
    expect(j1.history.at(-1)).toEqual({ round: 3, type: "revised", previousText: "Lying to a friend is wrong." });
    const entry = out.log.at(-1);
    expect(entry.decision).toBe("Merged elements");
    expect(entry.findings).toContain("J3 (process B) merged into J1 (process A)");
    expect(entry.changes).toContain("J1 reworded");
    expect(entry.changes).toContain("confidence: 0.7 → 0.9");
  });

  it("does not revise an element whose wording is kept as it was", () => {
    const j1 = merge().elements.find((e) => e.id === "J1");
    expect(j1.history).toBeUndefined();
    expect(j1.status).toBe("active");
  });

  it("drops a relation the merge turns into a loop", () => {
    const withLink = { ...state, relations: [...state.relations, rel("J1", "J3", "supports")] };
    const out = mergeElementPair(withLink, { keepId: "J1", removeId: "J3", text: "", confidence: 0.7 });
    expect(out.relations.some((r) => r.from === r.to)).toBe(false);
    expect(out.log.at(-1).changes).toContain("dropped as duplicates");
  });

  it("drops a relation the merge turns into a duplicate", () => {
    const dup = { ...state, relations: [...state.relations, rel("J2", "J3", "conflicts")] };
    const out = mergeElementPair(dup, { keepId: "J1", removeId: "J3", text: "", confidence: 0.7 });
    expect(out.relations.filter((r) => r.from === "J2" && r.to === "J1")).toHaveLength(1);
  });

  it("retypes a joint argument that loses a premise to the merge", () => {
    const joint = {
      ...state,
      relations: [
        rel("J1", "J4", "jointly_entails", { argumentId: "arg-j" }),
        rel("J3", "J4", "jointly_entails", { argumentId: "arg-j" }),
      ],
    };
    const out = mergeElementPair(joint, { keepId: "J1", removeId: "J3", text: "", confidence: 0.7 });
    expect(out.relations).toEqual([
      expect.objectContaining({ from: "J1", to: "J4", type: "entails", argumentId: "arg-j" }),
    ]);
  });

  it("takes the removed element out of its group", () => {
    const grouped = { ...state, groups: [{ id: "G1", label: "G", members: ["J3", "J4", "P2"], collapsed: false }] };
    const out = mergeElementPair(grouped, { keepId: "J1", removeId: "J3", text: "", confidence: 0.7 });
    expect(out.groups[0].members).toEqual(["J4", "P2"]);
  });

  it("changes nothing for an id that is not there", () => {
    expect(mergeElementPair(state, { keepId: "J1", removeId: "J99", text: "", confidence: 1 })).toBe(state);
  });
});

describe("the Merge tab's visibility", () => {
  it("is offered only after a merge", () => {
    expect(tabVisibility({})("mergeElements")).toBe(false);
    expect(tabVisibility({ hasMerged: true })("mergeElements")).toBe(true);
  });
});
