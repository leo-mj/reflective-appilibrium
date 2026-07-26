import { describe, it, expect } from "vitest";
import {
  elementsAtRound,
  nextElementId,
  makeDiff,
  makeLogEntry,
  sortElementIds,
  argumentPostulateExplanation,
} from "./stateUtils.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const j1 = { id: "J1", type: "judgment", status: "active", addedRound: 1 };
const j2 = { id: "J2", type: "judgment", status: "active", addedRound: 2 };
const j3withdrawn = {
  id: "J3",
  type: "judgment",
  status: "withdrawn",
  addedRound: 1,
  withdrawnRound: 3,
};

// ─── elementsAtRound ──────────────────────────────────────────────────────────

describe("elementsAtRound", () => {
  it("includes elements added by the given round", () => {
    const { active } = elementsAtRound([j1, j2], 1);
    expect(active.map((e) => e.id)).toEqual(["J1"]);
  });

  it("includes elements added in exactly that round", () => {
    const { active } = elementsAtRound([j1, j2], 2);
    expect(active.map((e) => e.id)).toContain("J2");
  });

  it("excludes elements added after the given round", () => {
    const { active } = elementsAtRound([j1, j2], 1);
    expect(active.map((e) => e.id)).not.toContain("J2");
  });

  it("moves withdrawn elements to the withdrawn list", () => {
    const { active, withdrawn } = elementsAtRound([j1, j3withdrawn], 4);
    expect(active.map((e) => e.id)).not.toContain("J3");
    expect(withdrawn.map((e) => e.id)).toContain("J3");
  });

  it("keeps withdrawn element active before its withdrawnRound", () => {
    const { active, withdrawn } = elementsAtRound([j3withdrawn], 2);
    expect(active.map((e) => e.id)).toContain("J3");
    expect(withdrawn).toHaveLength(0);
  });

  it("returns empty lists when no elements are added yet", () => {
    const { active, withdrawn } = elementsAtRound([j2], 1);
    expect(active).toHaveLength(0);
    expect(withdrawn).toHaveLength(0);
  });
});

// ─── nextElementId ────────────────────────────────────────────────────────────

describe("nextElementId", () => {
  it("returns J1 when no judgments exist", () => {
    expect(nextElementId([], "judgment")).toBe("J1");
  });

  it("returns the next sequential ID", () => {
    expect(nextElementId([j1, j2], "judgment")).toBe("J3");
  });

  it("skips gaps and uses max+1", () => {
    const elements = [
      { id: "J1", type: "judgment" },
      { id: "J5", type: "judgment" },
    ];
    expect(nextElementId(elements, "judgment")).toBe("J6");
  });

  it("scopes by type prefix (P independent of J)", () => {
    expect(nextElementId([j1, j2], "principle")).toBe("P1");
  });

  it("handles theory type", () => {
    const t1 = { id: "T1", type: "theory" };
    expect(nextElementId([t1], "theory")).toBe("T2");
  });
});

// ─── makeDiff ─────────────────────────────────────────────────────────────────

describe("makeDiff", () => {
  it("returns empty array when nothing changed", () => {
    expect(
      makeDiff(["status"], { status: "active" }, { status: "active" }),
    ).toEqual([]);
  });

  it("returns changed fields formatted as 'field: old → new'", () => {
    const result = makeDiff(
      ["status", "confidence"],
      { status: "active", confidence: 1.0 },
      { status: "revised", confidence: 1.0 },
    );
    expect(result).toEqual(["status: active → revised"]);
  });

  it("reports multiple changed fields", () => {
    const result = makeDiff(
      ["status", "confidence"],
      { status: "active", confidence: 1.0 },
      { status: "revised", confidence: 0.33 },
    );
    expect(result).toHaveLength(2);
  });

  it("ignores fields not in the fields list", () => {
    const result = makeDiff(
      ["status"],
      { status: "active", text: "old" },
      { status: "active", text: "new" },
    );
    expect(result).toHaveLength(0);
  });
});

// ─── makeLogEntry ─────────────────────────────────────────────────────────────

describe("makeLogEntry", () => {
  it("returns a log entry with the given fields", () => {
    const entry = makeLogEntry(3, "findings text", "Added", "Added J4");
    expect(entry).toEqual({
      round: 3,
      findings: "findings text",
      options: "",
      decision: "Added",
      changes: "Added J4",
    });
  });

  it("always sets options to empty string", () => {
    const entry = makeLogEntry(1, "", "x", "y");
    expect(entry.options).toBe("");
  });
});

// ─── sortElementIds ───────────────────────────────────────────────────────────

describe("sortElementIds", () => {
  it("sorts J before P before T", () => {
    const ids = ["T1", "P1", "J1"];
    expect(ids.sort(sortElementIds)).toEqual(["J1", "P1", "T1"]);
  });

  it("sorts numerically within the same type", () => {
    const ids = ["J10", "J2", "J1"];
    expect(ids.sort(sortElementIds)).toEqual(["J1", "J2", "J10"]);
  });

  it("sorts J13 before T1", () => {
    const ids = ["T1", "J13", "J1", "P2"];
    expect(ids.sort(sortElementIds)).toEqual(["J1", "J13", "P2", "T1"]);
  });

  it("returns 0 for identical IDs", () => {
    expect(sortElementIds("J1", "J1")).toBe(0);
  });
});

// ─── argumentPostulateExplanation ─────────────────────────────────────────────

describe("argumentPostulateExplanation", () => {
  it("returns empty string for no postulates", () => {
    expect(argumentPostulateExplanation([])).toBe("");
    expect(argumentPostulateExplanation(undefined)).toBe("");
    expect(argumentPostulateExplanation(null)).toBe("");
  });

  it("prefixes a single postulate with 'Valid given: '", () => {
    expect(argumentPostulateExplanation(["A entails B."])).toBe(
      "Valid given: A entails B.",
    );
  });

  it("joins multiple postulates with a space after the prefix", () => {
    expect(argumentPostulateExplanation(["First bridge.", "Second bridge."])).toBe(
      "Valid given: First bridge. Second bridge.",
    );
  });
});
