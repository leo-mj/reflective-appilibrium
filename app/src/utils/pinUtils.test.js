import { describe, it, expect } from "vitest";
import { carryPins, pinsOf, withPins, withoutPins } from "./pinUtils.js";

const el = (id) => ({
  id,
  type: "judgment",
  status: "active",
  confidence: 1,
  text: `${id}.`,
  addedRound: 1,
});

const STATE = {
  topic: "t",
  round: 1,
  elements: [el("J1"), el("J2")],
  relations: [],
  log: [],
};

describe("pinsOf", () => {
  it("is empty for a state nothing was dragged in", () => {
    expect(pinsOf(STATE)).toEqual({});
    expect(pinsOf(undefined)).toEqual({});
  });
});

describe("withPins", () => {
  it("adds to the pins already there, the newest winning", () => {
    const once = withPins(STATE, { J1: { x: 1, y: 1 } });
    const twice = withPins(once, { J1: { x: 5, y: 5 }, J2: { x: 2, y: 2 } });
    expect(twice.pins).toEqual({ J1: { x: 5, y: 5 }, J2: { x: 2, y: 2 } });
  });

  it("drops pins for elements the state no longer holds", () => {
    // A later element may be given the id again, and must not inherit a place.
    const s = withPins({ ...STATE, pins: { GONE: { x: 0, y: 0 } } }, {
      J1: { x: 1, y: 1 },
    });
    expect(s.pins).toEqual({ J1: { x: 1, y: 1 } });
  });

  it("leaves the rest of the state alone", () => {
    const s = withPins(STATE, { J1: { x: 1, y: 1 } });
    expect(s.elements).toBe(STATE.elements);
    expect(s.log).toBe(STATE.log);
    expect(s.round).toBe(STATE.round);
  });
});

describe("withoutPins", () => {
  it("unpins the named elements and keeps the others", () => {
    const s = withPins(STATE, { J1: { x: 1, y: 1 }, J2: { x: 2, y: 2 } });
    expect(withoutPins(s, ["J1"]).pins).toEqual({ J2: { x: 2, y: 2 } });
  });

  it("hands back the state itself when none of them was pinned", () => {
    const s = withPins(STATE, { J1: { x: 1, y: 1 } });
    expect(withoutPins(s, ["J2"])).toBe(s);
    expect(withoutPins(STATE, ["J1"])).toBe(STATE);
  });
});

describe("carryPins", () => {
  it("carries the present's pins onto an older state, so undo keeps later drags", () => {
    const edited = { ...STATE, elements: [...STATE.elements, el("J3")] };
    const dragged = withPins(edited, { J2: { x: 1, y: 2 } });
    expect(carryPins(STATE, dragged).pins).toEqual({ J2: { x: 1, y: 2 } });
  });

  it("removes pins the present no longer has", () => {
    const older = withPins(STATE, { J1: { x: 1, y: 1 } });
    const present = { ...STATE, elements: [...STATE.elements, el("J3")] };
    expect(carryPins(older, present)).not.toHaveProperty("pins");
  });

  it("leaves a step that changed only the pins to be undone — Reset layout", () => {
    const pinned = withPins(STATE, { J1: { x: 5, y: 5 } });
    const reset = withoutPins(pinned, ["J1"]);
    expect(carryPins(pinned, reset)).toBe(pinned);
    // And redone.
    expect(carryPins(reset, pinned)).toBe(reset);
  });
});
