// @vitest-environment jsdom
//
// Steps and rounds (stateUtils, "Steps and rounds"). A step is one change, as
// `state.round` always counted; a round is a run of steps, closed as a workflow
// iteration completes or by hand. These pin the arithmetic, the close action,
// and that a file carries the rounds in and out.
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  canCloseRound,
  currentRound,
  roundEndsOf,
  roundOfStep,
  roundStops,
  stateAtRound,
} from "./stateUtils.js";
import { validateState } from "./importMarkdown.js";
import { buildMarkdown } from "./exportMarkdown.js";
import { useREActions } from "../hooks/useREActions.js";

const logAt = (...steps) =>
  steps.map((round) => ({
    round,
    findings: "",
    options: "",
    decision: "",
    changes: `change ${round}`,
  }));

const process = (over = {}) => ({
  topic: "t",
  phase: 2,
  round: 6,
  elements: [],
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: logAt(2, 3, 4, 5, 6),
  ...over,
});

describe("the arithmetic", () => {
  it("reads a state written before rounds as one open round", () => {
    const old = process();
    expect(roundEndsOf(old)).toEqual([]);
    expect(currentRound(old)).toBe(1);
    expect(roundOfStep(old, 6)).toBe(1);
  });

  it("puts each step in the round whose end is at or after it", () => {
    const s = process({ roundEnds: [2, 4] });
    expect([1, 2, 3, 4, 5, 6].map((step) => roundOfStep(s, step))).toEqual([
      1, 1, 2, 2, 3, 3,
    ]);
    expect(currentRound(s)).toBe(3);
  });

  it("stops History at each round's end and at the latest step", () => {
    expect(roundStops(process({ roundEnds: [2, 4] }))).toEqual([0, 2, 4, 6]);
    // Just closed: the open round is empty, so no stop past the last end.
    expect(roundStops(process({ roundEnds: [2, 6] }))).toEqual([0, 2, 6]);
  });

  it("projects only the rounds closed by the step being played", () => {
    expect(stateAtRound(process({ roundEnds: [2, 4] }), 3).roundEnds).toEqual([
      2,
    ]);
    expect(stateAtRound(process(), 3).roundEnds).toBeUndefined();
  });
});

describe("closing a round", () => {
  it("needs a change since the last close", () => {
    expect(canCloseRound(process())).toBe(true);
    expect(canCloseRound(process({ roundEnds: [6] }))).toBe(false);
    // Nothing recorded at all: a new, untouched process.
    expect(canCloseRound(process({ round: 1, log: [] }))).toBe(false);
  });

  it("ends the round at the latest step, without a step or a log entry of its own", () => {
    const initial = process();
    const { result } = renderHook(() => useREActions(initial));
    act(() => result.current.handleCloseRound());
    const s = result.current.state;
    expect(s.roundEnds).toEqual([6]);
    expect(s.round).toBe(6);
    expect(s.log).toBe(initial.log);
    expect(currentRound(s)).toBe(2);
  });

  it("is an undo step, and does nothing on an empty round", () => {
    const { result } = renderHook(() => useREActions(process()));
    act(() => result.current.handleCloseRound());
    act(() => result.current.handleCloseRound());
    expect(result.current.state.roundEnds).toEqual([6]);
    act(() => result.current.handleUndo());
    expect(roundEndsOf(result.current.state)).toEqual([]);
    expect(result.current.canUndo).toBe(false);
  });
});

describe("a file", () => {
  it("carries the rounds through the importer, tidied", () => {
    const read = validateState(process({ roundEnds: [4, 2, 2, 9, 0] }));
    expect(read.roundEnds).toEqual([2, 4]);
    expect(validateState(process()).roundEnds).toBeUndefined();
  });

  it("writes the round and the step in the heading, and the log by round", () => {
    const md = buildMarkdown(process({ roundEnds: [3] }), {});
    expect(md).toContain("**Round:** 2 · **Step:** 6");
    const log = md.split("## Log")[1];
    const [one, two] = log.split("### Round 1")[1].split("### Round 2");
    expect(one).toContain("**Step 2.** change 2");
    expect(one).toContain("**Step 3.** change 3");
    expect(two).toContain("**Step 4.** change 4");
    expect(two).toContain("**Step 6.** change 6");
  });
});

// The sample was written in eight rounds, each holding many changes; each
// change is a step of its own, as the app would have recorded it.
describe("the sample process", async () => {
  const { SAMPLE_STATE } = await import("../state.js");
  const ARGUMENT = new Set([
    "entails",
    "precludes",
    "jointly_entails",
    "jointly_precludes",
  ]);

  it("has eight rounds", () => {
    expect(roundEndsOf(SAMPLE_STATE)).toHaveLength(7);
    expect(currentRound(SAMPLE_STATE)).toBe(8);
    expect(SAMPLE_STATE.round).toBeGreaterThan(8);
  });

  it("gives every change a step of its own — an argument's premises sharing one", () => {
    const additions = [
      ...SAMPLE_STATE.elements.map((e) => [e.addedRound, e.id]),
      ...SAMPLE_STATE.relations.map((r, i) => [
        r.addedRound,
        ARGUMENT.has(r.type) && r.argumentId ? r.argumentId : `rel${i}`,
      ]),
    ];
    const changesAt = new Map();
    for (const [step, change] of additions) {
      (changesAt.get(step) ?? changesAt.set(step, new Set()).get(step)).add(
        change,
      );
    }
    for (const [step, changes] of changesAt)
      expect([...changes], `step ${step}`).toHaveLength(1);
  });

  it("logs every step once, as the app does", () => {
    // It used to keep one entry per round, at the round's last step, so
    // History's log box on the demo sat on a summary of the round before
    // while the next one played, and read as broken.
    expect(SAMPLE_STATE.log.map((l) => l.round)).toEqual(
      Array.from({ length: SAMPLE_STATE.round }, (_, i) => i + 1),
    );
  });

  it("logs in the app's own words", () => {
    const at = (step) => SAMPLE_STATE.log.find((l) => l.round === step);
    expect(at(1).findings).toBe("J1 was added by the user.");
    expect(at(23).changes).toBe("J6: status → withdrawn");
    expect(at(31).changes).toBe("P2, P3 → J5 (jointly_entails) added");
    // An edit says whose wording changed, not only how.
    expect(at(45).changes).toMatch(/^J4 — text: /);
    expect(at(60).changes).toMatch(/^Relation T2 → P2 — explanation: /);
  });
});
