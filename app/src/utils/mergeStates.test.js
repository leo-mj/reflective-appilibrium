import { describe, it, expect } from "vitest";
import {
  assertMergeable,
  mergeStates,
  processesOf,
  processesOfElement,
  processTagMap,
} from "./mergeStates.js";
import { elementsAtRound, stateAtRound } from "./stateUtils.js";

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

const process = (extra) => ({
  topic: "",
  phase: 2,
  round: 3,
  elements: [],
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
  ...extra,
});

const current = process({
  topic: "Lying",
  round: 4,
  elements: [el("J1", "Lying is wrong."), el("P1", "Never deceive.")],
  relations: [rel("P1", "J1")],
  log: [{ round: 4, findings: "", options: "", decision: "", changes: "" }],
});

describe("mergeStates", () => {
  it("renumbers incoming elements past the current ones, in one new round", () => {
    const incoming = process({
      topic: "Promises",
      elements: [el("J1", "Keep promises."), el("P1", "Honour commitments.")],
      relations: [rel("P1", "J1")],
    });
    const out = mergeStates(current, incoming);

    expect(out.round).toBe(5);
    expect(out.topic).toBe("Lying");
    expect(out.elements.map((e) => e.id)).toEqual(["J1", "P1", "J2", "P2"]);
    expect(out.elements.slice(2).every((e) => e.addedRound === 5)).toBe(true);
    expect(out.relations.at(-1)).toMatchObject({ from: "P2", to: "J2", addedRound: 5 });

    const entry = out.log.at(-1);
    expect(entry).toMatchObject({ round: 5, decision: "Merged" });
    expect(entry.findings).toContain('"Promises"');
    expect(entry.changes).toContain("J1 → J2");
    expect(entry.changes).toContain("P1 → P2");
  });

  it("fuses identical elements into the current copy and logs each pair", () => {
    const incoming = process({
      elements: [
        el("J1", "Keep promises."),
        el("J2", "  Lying   is wrong. ", { confidence: 0.1 }),
      ],
      relations: [rel("J1", "J2", "conflicts")],
    });
    const out = mergeStates(current, incoming);

    expect(out.elements).toHaveLength(3);
    // The current copy wins, untouched.
    expect(out.elements[0]).toBe(current.elements[0]);
    expect(out.relations.at(-1)).toMatchObject({ from: "J2", to: "J1" });
    expect(out.log.at(-1).findings).toContain("J2 → J1");
  });

  it("does not fuse across element types", () => {
    const incoming = process({ elements: [el("P1", "Lying is wrong.")] });
    expect(mergeStates(current, incoming).elements).toHaveLength(3);
  });

  it("drops relations that fusing turned into duplicates or loops", () => {
    const incoming = process({
      elements: [
        el("J1", "Lying is wrong."),
        el("P1", "Never deceive."),
        el("J2", "Lying is wrong."),
      ],
      relations: [rel("P1", "J1"), rel("J1", "J2", "supports")],
    });
    const out = mergeStates(current, incoming);

    expect(out.relations).toHaveLength(1);
    expect(out.log.at(-1).findings).toContain("2 incoming relations dropped");
  });

  it("keeps a joint argument together under a fresh, deterministic argumentId", () => {
    const incoming = process({
      elements: [el("P1", "A."), el("P2", "B."), el("J1", "C.")],
      relations: [
        rel("P1", "J1", "jointly_entails", { argumentId: "arg-x" }),
        rel("P2", "J1", "jointly_entails", { argumentId: "arg-x" }),
      ],
    });
    const out = mergeStates(current, incoming);
    const args = out.relations.slice(1);

    expect(args).toHaveLength(2);
    expect(new Set(args.map((r) => r.argumentId))).toEqual(new Set(["arg-m5-1"]));
    expect(mergeStates(current, incoming)).toEqual(out);
  });

  it("drops an incoming argument that duplicates one already present", () => {
    const withArg = {
      ...current,
      elements: [...current.elements, el("P2", "Honesty matters.")],
      relations: [
        rel("P1", "J1", "jointly_entails", { argumentId: "arg-a" }),
        rel("P2", "J1", "jointly_entails", { argumentId: "arg-a" }),
      ],
    };
    const incoming = process({
      elements: [el("P1", "Honesty matters."), el("P2", "Never deceive."), el("J1", "Lying is wrong.")],
      relations: [
        rel("P1", "J1", "jointly_entails", { argumentId: "arg-b" }),
        rel("P2", "J1", "jointly_entails", { argumentId: "arg-b" }),
      ],
    });
    expect(mergeStates(withArg, incoming).relations).toHaveLength(2);
  });

  it("brings withdrawn items in as withdrawn at the merge round, and drops past revisions", () => {
    const incoming = process({
      elements: [
        el("J1", "Old view.", {
          status: "withdrawn",
          history: [
            { round: 1, type: "revised", previousText: "Older view." },
            { round: 2, type: "withdrawn", reason: "Outgrown." },
          ],
        }),
        el("J2", "Revised view.", {
          status: "revised",
          previousText: "First view.",
          history: [{ round: 2, type: "revised", previousText: "First view." }],
        }),
      ],
    });
    const out = mergeStates(current, incoming);
    const [withdrawn, revised] = out.elements.slice(2);

    expect(withdrawn.history).toEqual([{ round: 5, type: "withdrawn", reason: "Outgrown." }]);
    expect(revised).toMatchObject({ status: "active", text: "Revised view." });
    expect(revised.history).toBeUndefined();
    expect(revised.previousText).toBeUndefined();

    // Playback: nothing incoming exists before the merge round.
    expect(stateAtRound(out, 4).elements).toHaveLength(2);
    expect(elementsAtRound(out.elements, 5).withdrawn.map((e) => e.id)).toEqual(["J2"]);
  });

  it("renumbers incoming groups and never puts an element in two groups", () => {
    const grouped = { ...current, groups: [{ id: "G1", label: "Mine", members: ["J1", "P1"], collapsed: true }] };
    const incoming = process({
      elements: [el("J1", "Lying is wrong."), el("J2", "X."), el("J3", "Y.")],
      groups: [
        { id: "G1", label: "Theirs", members: ["J2", "J3"], collapsed: false },
        { id: "G2", label: "Clash", members: ["J1", "J2"], collapsed: false },
      ],
    });
    const out = mergeStates(grouped, incoming);

    expect(out.groups).toEqual([
      grouped.groups[0],
      { id: "G2", label: "Theirs", members: ["J2", "J3"], collapsed: false },
    ]);
  });

  it("leaves the incoming reviews and log out, and says so", () => {
    const incoming = process({
      elements: [el("J1", "New.")],
      reviews: [{ id: "rev-1", round: 2, headline: "h" }],
      log: [{ round: 1 }, { round: 2 }],
    });
    const out = mergeStates(current, incoming);

    expect(out.reviews).toBeUndefined();
    expect(out.log).toHaveLength(2);
    expect(out.log.at(-1).findings).toContain("1 process review was not carried over");
  });

  it("letters both processes on the first merge, and a fused element belongs to both", () => {
    const incoming = process({
      topic: "Promises",
      elements: [el("J1", "Keep promises."), el("J2", "Lying is wrong.")],
    });
    const out = mergeStates(current, incoming, { label: "promises-file" });

    expect(out.processes).toEqual([
      { id: "A", label: "Lying", members: ["J1", "P1"], round: 5 },
      { id: "B", label: "Promises", members: ["J2", "J1"], round: 5 },
    ]);
    expect(processTagMap(out.processes)).toEqual(
      new Map([["J1", "A+B"], ["P1", "A"], ["J2", "B"]]),
    );
    expect(processesOfElement(out.processes, "J1").map((p) => p.id)).toEqual(["A", "B"]);
    // Provenance lives on the state, never on the elements.
    expect(out.elements.some((e) => "processes" in e)).toBe(false);
    expect(out.log.at(-1).findings).toContain('Merged "Promises" as process B');
  });

  it("falls back to the file name for an untitled process", () => {
    const out = mergeStates(current, process({ elements: [el("J1", "New.")] }), {
      label: "session-3",
    });
    expect(out.processes[1].label).toBe("session-3");
  });

  it("adds a third process under the next letter, leaving elements added since untagged", () => {
    const once = mergeStates(current, process({ topic: "B", elements: [el("J1", "X.")] }));
    const addedSince = { ...once, elements: [...once.elements, el("J9", "Mine, later.")] };
    const twice = mergeStates(addedSince, process({ topic: "C", elements: [el("J1", "Y.")] }));

    expect(twice.processes.map((p) => [p.id, p.label])).toEqual([
      ["A", "Lying"],
      ["B", "B"],
      ["C", "C"],
    ]);
    expect(processTagMap(twice.processes).has("J9")).toBe(false);
  });

  it("keeps apart the processes an incoming merged process was built from", () => {
    const inner = process({
      topic: "Both",
      elements: [el("J1", "X."), el("J2", "Y."), el("J3", "Added after.")],
      processes: [
        { id: "A", label: "Ex", members: ["J1"] },
        { id: "B", label: "Why", members: ["J2"] },
      ],
    });
    const out = mergeStates(current, inner);

    expect(out.processes.slice(1)).toEqual([
      { id: "B", label: "Ex", members: ["J2"], round: 5 },
      { id: "C", label: "Why", members: ["J3"], round: 5 },
      { id: "D", label: "Both", members: ["J4"], round: 5 },
    ]);
    expect(out.log.at(-1).findings).toContain("as process B, C, D");
  });

  it("shows no processes before the merge that made them, in playback or the text panel", () => {
    const once = mergeStates(current, process({ topic: "B", elements: [el("J1", "X.")] }));
    const twice = mergeStates(
      { ...once, round: 8 },
      process({ topic: "C", elements: [el("J1", "Y.")] }),
    );

    expect(processesOf(twice, 4)).toEqual([]);
    expect(processesOf(twice, 5).map((p) => p.id)).toEqual(["A", "B"]);
    expect(processesOf(twice).map((p) => p.id)).toEqual(["A", "B", "C"]);
    // A state projected back to a round reads its own round by default.
    expect(processesOf(stateAtRound(twice, 6)).map((p) => p.id)).toEqual(["A", "B"]);
  });

  it("does not add a groups key to a state that had none", () => {
    const out = mergeStates(current, process({ elements: [el("J1", "New.")] }));
    expect("groups" in out).toBe(false);
  });
});

describe("assertMergeable", () => {
  it("refuses questionnaire sessions on either side", () => {
    const q = process({ model: "questionnaire", elements: [el("J1", "x")] });
    expect(() => assertMergeable(q, current)).toThrow(/Questionnaire/);
    expect(() => assertMergeable(current, q)).toThrow(/Questionnaire/);
  });

  it("refuses an empty incoming process", () => {
    expect(() => assertMergeable(current, process())).toThrow(/no elements/);
  });
});
