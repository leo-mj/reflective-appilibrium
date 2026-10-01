// @vitest-environment jsdom
//
// handleArgumentRevise: premises swapped, reworded, taken out or added, as one
// step. A changed set of premises replaces the argument, so History still shows
// it as it was before that step (stateUtils, isSupersededAt).
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useREActions } from "./useREActions.js";
import {
  argumentRelationsOf,
  stateAtRound,
  withoutSuperseded,
} from "../utils/stateUtils.js";
import { validateState } from "../utils/importMarkdown.js";

const el = (id, text) => ({
  id,
  type: id.startsWith("P") ? "principle" : "judgment",
  status: "active",
  confidence: 0.7,
  origin: "user",
  text,
  addedRound: 1,
});
const link = (from) => ({
  from,
  to: "J3",
  type: "jointly_entails",
  argumentId: "a1",
  explanation: "Together.",
  origin: "user",
  addedRound: 2,
});

const process = () => ({
  topic: "t",
  phase: 2,
  round: 2,
  elements: [
    el("J1", "One."),
    el("P2", "Two."),
    el("J3", "Three."),
    el("J4", "Four."),
  ],
  relations: [link("J1"), link("P2")],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
});

function revise(form, initial = process()) {
  const hook = renderHook(() => useREActions(initial));
  act(() => hook.result.current.setEditingRel(initial.relations[0]));
  act(() =>
    hook.result.current.handleArgumentRevise({
      negated: false,
      explanation: "Together.",
      ...form,
    }),
  );
  return hook;
}
const premisesOf = (state) =>
  argumentRelationsOf(
    state.relations,
    state.relations.find((r) => r.to === "J3"),
  )
    .map((r) => r.from)
    .sort();

describe("revising an argument", () => {
  it("changes nothing when nothing was changed", () => {
    const initial = process();
    const { result } = revise(
      {
        premises: [
          { id: "J1", text: "One." },
          { id: "P2", text: "Two." },
        ],
      },
      initial,
    );
    expect(result.current.state).toBe(initial);
  });

  it("revises in place when only the explanation changed", () => {
    const { result } = revise({
      premises: [
        { id: "J1", text: "One." },
        { id: "P2", text: "Two." },
      ],
      explanation: "Jointly, as it turns out.",
    });
    const s = result.current.state;
    expect(s.round).toBe(3);
    expect(s.relations).toHaveLength(2);
    expect(
      s.relations.every((r) => r.argumentId === "a1" && r.status === "revised"),
    ).toBe(true);
  });

  it("rewords a premise by revising the element, leaving the links alone", () => {
    const initial = process();
    const { result } = revise(
      {
        premises: [
          { id: "J1", text: "One, reworded." },
          { id: "P2", text: "Two." },
        ],
      },
      initial,
    );
    const s = result.current.state;
    const j1 = s.elements.find((e) => e.id === "J1");
    expect(j1.text).toBe("One, reworded.");
    expect(j1.previousText).toBe("One.");
    expect(j1.history.at(-1)).toMatchObject({ round: 3, type: "revised" });
    expect(s.relations).toBe(initial.relations);
  });

  it("replaces the argument when a premise is taken out", () => {
    const { result } = revise({ premises: [{ id: "J1", text: "One." }] });
    const s = result.current.state;
    const replaced = s.relations.filter((r) => r.argumentId === "a1");
    const current = s.relations.filter((r) => r.argumentId !== "a1");

    expect(replaced.every((r) => r.status === "withdrawn")).toBe(true);
    expect(
      replaced.every((r) => r.supersededBy === current[0].argumentId),
    ).toBe(true);
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({
      from: "J1",
      to: "J3",
      type: "entails",
      addedRound: 3,
    });
    expect(s.log.at(-1).changes).toContain("premises: J1, P2 → J1");
  });

  it("adds a premise written as a new statement, as an element of its own", () => {
    const { result } = revise({
      premises: [
        { id: "J1", text: "One." },
        { id: "P2", text: "Two." },
        { type: "principle", text: "A new principle." },
      ],
    });
    const s = result.current.state;
    const added = s.elements.find((e) => e.text === "A new principle.");
    expect(added).toMatchObject({ id: "P3", type: "principle", addedRound: 3 });
    expect(premisesOf(withoutSuperseded(s))).toEqual(["J1", "P2", "P3"]);
  });

  it("shows the argument as it was before the step, and as revised after", () => {
    const { result } = revise({
      premises: [
        { id: "J1", text: "One." },
        { id: "J4", text: "Four." },
      ],
    });
    const s = result.current.state;
    expect(premisesOf(stateAtRound(s, 2))).toEqual(["J1", "P2"]);
    expect(premisesOf(stateAtRound(s, 3))).toEqual(["J1", "J4"]);
    // And the present views hold only the revised one — nothing to reinstate.
    expect(withoutSuperseded(s).relations.every((r) => !r.supersededBy)).toBe(
      true,
    );
  });

  it("is one undo step, however much changed", () => {
    const initial = process();
    const { result } = revise(
      {
        premises: [
          { id: "J1", text: "One, reworded." },
          { type: "judgment", text: "Five." },
        ],
        negated: true,
      },
      initial,
    );
    act(() => result.current.handleUndo());
    expect(result.current.state).toEqual(initial);
  });

  it("carries the replacement through a file", () => {
    const { result } = revise({ premises: [{ id: "J1", text: "One." }] });
    const read = validateState(
      JSON.parse(JSON.stringify(result.current.state)),
    );
    expect(read.relations.filter((r) => r.supersededBy)).toHaveLength(2);
  });

  it("replaces the argument when the conclusion is swapped", () => {
    const { result } = revise({
      premises: [
        { id: "J1", text: "One." },
        { id: "P2", text: "Two." },
      ],
      conclusion: { id: "J4", text: "Four." },
    });
    const s = result.current.state;
    const now = withoutSuperseded(s).relations;
    expect(now.map((r) => r.to)).toEqual(["J4", "J4"]);
    expect(s.relations.filter((r) => r.supersededBy)).toHaveLength(2);
    expect(s.log.at(-1).changes).toContain("conclusion: J3 → J4");
    // Before the step it was an argument for J3.
    expect(stateAtRound(s, 2).relations.map((r) => r.to)).toEqual(["J3", "J3"]);
  });

  it("takes a new statement as the conclusion", () => {
    const { result } = revise({
      premises: [
        { id: "J1", text: "One." },
        { id: "P2", text: "Two." },
      ],
      conclusion: { type: "judgment", text: "A new verdict." },
    });
    const s = result.current.state;
    const verdict = s.elements.find((e) => e.text === "A new verdict.");
    expect(verdict).toMatchObject({ id: "J5", addedRound: 3 });
    expect(withoutSuperseded(s).relations.every((r) => r.to === "J5")).toBe(
      true,
    );
  });

  it("rewords the conclusion in place, as a premise is", () => {
    const initial = process();
    const { result } = revise(
      {
        premises: [
          { id: "J1", text: "One." },
          { id: "P2", text: "Two." },
        ],
        conclusion: { id: "J3", text: "Three, reworded." },
      },
      initial,
    );
    const s = result.current.state;
    expect(s.elements.find((e) => e.id === "J3")).toMatchObject({
      text: "Three, reworded.",
      previousText: "Three.",
    });
    expect(s.relations).toBe(initial.relations);
  });
});
