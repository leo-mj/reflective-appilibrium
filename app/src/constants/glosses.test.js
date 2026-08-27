// What a picker's rows say. The gloss map is prose and is checked only for
// covering what the picker offers — a type added to the picker and not to the
// map is a row that silently loses its explanation.
import { describe, it, expect } from "vitest";

import { ARGUMENT_RELATION_TYPES } from "../utils/stateUtils.js";
import {
  ARGUMENT_GLOSS,
  RELATION_GLOSS,
  STATUS_NOTE,
  elementDetail,
} from "./glosses.js";

describe("the gloss maps", () => {
  it("covers the dialectical four and the single-premise pair", () => {
    expect(Object.keys(RELATION_GLOSS).sort()).toEqual([
      "conflicts",
      "depends",
      "entails",
      "precludes",
      "supports",
      "undermines",
    ]);
  });

  // The two-endpoint pickers do not offer them — an argument's premises are how
  // they are made — so their absence here is the picker's shape, not a gap.
  it("leaves the joint forms to the argument panels", () => {
    const joint = [...ARGUMENT_RELATION_TYPES].filter((t) =>
      t.startsWith("jointly_"),
    );
    expect(joint).toHaveLength(2);
    for (const type of joint) expect(RELATION_GLOSS[type]).toBeUndefined();
    expect(Object.keys(ARGUMENT_GLOSS).sort()).toEqual([
      "entails",
      "precludes",
    ]);
  });
});

// A word, not a parenthesised suffix: the picker holds it out in a column of
// its own at the right of the row, so it must not carry its own punctuation or
// the spacing that ran it onto the id.
describe("the status note", () => {
  it("marks the two states that are selectable but not in play", () => {
    expect(STATUS_NOTE).toEqual({
      withdrawn: "withdrawn",
      rejected: "rejected",
    });
  });

  it("says nothing about an element that is in play", () => {
    expect(STATUS_NOTE.active).toBeUndefined();
    expect(STATUS_NOTE.possible).toBeUndefined();
  });
});

describe("elementDetail", () => {
  const el = (text) => ({ id: "J1", type: "judgment", status: "active", text });

  it("is the statement, without the id the row's label already carries", () => {
    expect(elementDetail(el("Waste is wrong."))).toBe("Waste is wrong.");
  });

  it("is undefined where there is nothing to say", () => {
    expect(elementDetail(el(""))).toBeUndefined();
    expect(elementDetail(el("   "))).toBeUndefined();
    expect(elementDetail(undefined)).toBeUndefined();
  });

  // The row clamps itself to two lines, which follows the list's width rather
  // than guessing at it — so nothing is cut here.
  it("hands over a long statement whole", () => {
    const long = "a".repeat(400);
    expect(elementDetail(el(long))).toBe(long);
  });
});
