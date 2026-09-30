import { describe, it, expect } from "vitest";

import {
  changesNothing,
  heldTheoryOf,
  positionAt,
  positionChanges,
  previewOf,
  stepChanges,
  stepLog,
} from "./simulationDiff.js";

const e = (id, overrides = {}) => ({
  id,
  type: id.startsWith("P") ? "principle" : "judgment",
  text: `Text of ${id}`,
  ...overrides,
});
const not = (id) => e(id, { negated: true });
const ids = (els) => els.map((x) => (x.negated ? `¬${x.id}` : x.id));

// C0 → T1 → C2 → T3 → C4, as rethon alternates them.
const EVOLUTION = [
  [e("J1"), e("J2"), e("P1")], // 0: the commitments it starts from
  [e("P1")], // 1: the held theory
  [e("J1"), e("P1"), e("J3")], // 2: drops J2, takes up J3
  [e("P1"), e("P2")], // 3: P2 joins the theory
  [e("J1"), e("P1"), e("J3"), not("J4")], // 4: commits against J4
];

describe("positionAt", () => {
  it("holds what the commitments or the theory in force contain", () => {
    const { held, rejected } = positionAt(EVOLUTION, 4);
    expect([...held].sort()).toEqual(["J1", "J3", "P1", "P2"]);
    expect([...rejected]).toEqual(["J4"]);
  });

  it("reads the theory before a commitments step, and none before the first", () => {
    expect([...positionAt(EVOLUTION, 0).held].sort()).toEqual(["J1", "J2", "P1"]);
    expect(positionAt(EVOLUTION, 3).held.has("J2")).toBe(false);
  });
});

describe("positionChanges", () => {
  const elements = [
    e("J1", { status: "active" }),
    e("J2", { status: "active" }),
    e("J3", { status: "withdrawn" }),
    e("J4", { status: "active" }),
    e("P1", { status: "revised" }),
    e("P2", { status: "rejected" }),
    e("J5", { status: "rejected" }),
  ];

  it("says what accepting a position would withdraw, take up and reject", () => {
    const changes = positionChanges(elements, positionAt(EVOLUTION, 4));
    expect(ids(changes.withdraw)).toEqual(["J2"]);
    expect(ids(changes.takeUp)).toEqual(["J3", "P2"]);
    expect(ids(changes.reject)).toEqual(["J4"]);
  });

  it("leaves a rejection alone that the position does not speak to", () => {
    const changes = positionChanges(elements, positionAt(EVOLUTION, 4));
    const all = [...changes.withdraw, ...changes.takeUp, ...changes.reject];
    expect(all.map((x) => x.id)).not.toContain("J5");
  });

  it("changes nothing when the position is the one held", () => {
    const held = [e("J1", { status: "active" }), e("P1", { status: "active" })];
    const changes = positionChanges(held, positionAt([[e("J1"), e("P1")]], 0));
    expect(changesNothing(changes)).toBe(true);
  });

  it("previews a rejection as the graph draws a withdrawal", () => {
    const preview = previewOf(positionChanges(elements, positionAt(EVOLUTION, 4)));
    expect([...preview.withdrawn].sort()).toEqual(["J2", "J4"]);
    expect([...preview.takenUp].sort()).toEqual(["J3", "P2"]);
  });
});

describe("stepChanges", () => {
  const steps = stepChanges(EVOLUTION, [e("P1")]);

  it("reads each step against the last one of its kind", () => {
    expect(steps.map((s) => s.kind)).toEqual([
      "commitments",
      "theory",
      "commitments",
      "theory",
      "commitments",
    ]);
    expect(ids(steps[2].joined)).toEqual(["J3"]);
    expect(ids(steps[2].left)).toEqual(["J2"]);
    expect(ids(steps[3].joined)).toEqual(["P2"]);
    expect(ids(steps[4].joined)).toEqual(["¬J4"]);
  });

  it("changes nothing at the start, the simulation starting where the user stands", () => {
    expect(steps[0].joined).toEqual([]);
    expect(steps[1].joined).toEqual([]);
    expect(steps[1].left).toEqual([]);
  });

  it("shows a first theory that is not the held one as a change", () => {
    // The fallback, where rethon could not take the held theory.
    const [, first] = stepChanges(EVOLUTION, [e("P1"), e("P3")]);
    expect(ids(first.left)).toEqual(["P3"]);
  });
});

describe("stepLog", () => {
  const log = stepLog(stepChanges(EVOLUTION, [e("P1")]));

  it("says each step in words, one entry per step", () => {
    expect(log.map((l) => l.round)).toEqual([0, 1, 2, 3, 4]);
    expect(log[1].changes).toMatch(/starts from the theory you hold/i);
    expect(log[2].changes).toBe("Takes up J3. Drops J2.");
    expect(log[3].changes).toBe("P2 joins the theory.");
    expect(log[4].changes).toBe("Rejects J4.");
  });

  it("says so when a step changes nothing", () => {
    const [, , , , still] = stepLog(
      stepChanges([...EVOLUTION.slice(0, 3), EVOLUTION[1], EVOLUTION[2]], [e("P1")]),
    );
    expect(still.changes).toBe("No change.");
  });
});

describe("heldTheoryOf", () => {
  it("is the active and revised principles and theories", () => {
    const held = heldTheoryOf([
      e("J1", { status: "active" }),
      e("P1", { status: "active" }),
      e("P2", { status: "withdrawn" }),
      e("T1", { type: "theory", status: "revised" }),
    ]);
    expect(ids(held)).toEqual(["P1", "T1"]);
  });
});
