import { describe, it, expect } from "vitest";
import {
  elementsAtRound,
  nextElementId,
  makeDiff,
  makeLogEntry,
  sortElementIds,
  argumentPostulateExplanation,
  linkableElements,
  defaultPickerIds,
  historyOf,
  isWithdrawnAt,
  isWithdrawnNow,
  withEvent,
  textAtRound,
  asOfRound,
  stateAtRound,
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

  it("reflects every withdraw/reinstate cycle", () => {
    const j4 = {
      id: "J4",
      type: "judgment",
      status: "withdrawn",
      addedRound: 1,
      withdrawals: [
        { from: 3, to: 6 },
        { from: 8 },
      ],
    };
    const gone = (round) =>
      elementsAtRound([j4], round).withdrawn.map((e) => e.id);
    expect(gone(2)).toEqual([]);
    expect(gone(3)).toEqual(["J4"]);
    expect(gone(5)).toEqual(["J4"]);
    expect(gone(6)).toEqual([]); // back
    expect(gone(7)).toEqual([]);
    expect(gone(8)).toEqual(["J4"]); // gone again
    expect(gone(99)).toEqual(["J4"]); // still gone
  });

  it("returns empty lists when no elements are added yet", () => {
    const { active, withdrawn } = elementsAtRound([j2], 1);
    expect(active).toHaveLength(0);
    expect(withdrawn).toHaveLength(0);
  });
});

// ─── Item history ─────────────────────────────────────────────────────────────

describe("historyOf", () => {
  it("returns a stored list as-is", () => {
    const events = [{ round: 2, type: "withdrawn" }];
    expect(historyOf({ history: events })).toBe(events);
  });

  it("rebuilds events from the legacy scalar fields, in order", () => {
    expect(
      historyOf({
        withdrawnRound: 6,
        reinstatedRound: 8,
        reason: "Too broad",
        revisedRound: 3,
        previousText: "Older wording",
      }),
    ).toEqual([
      { round: 3, type: "revised", previousText: "Older wording" },
      { round: 6, type: "withdrawn", reason: "Too broad" },
      { round: 8, type: "reinstated" },
    ]);
  });

  it("rebuilds events from the interim withdrawals list", () => {
    expect(
      historyOf({ withdrawals: [{ from: 2, to: 4 }, { from: 7 }], reason: "Why" }),
    ).toEqual([
      { round: 2, type: "withdrawn" },
      { round: 4, type: "reinstated" },
      // `reason` described the latest withdrawal, so it lands there only.
      { round: 7, type: "withdrawn", reason: "Why" },
    ]);
  });

  it("returns nothing for an untouched item", () => {
    expect(historyOf({ id: "J1" })).toEqual([]);
    expect(historyOf(undefined)).toEqual([]);
  });
});

describe("isWithdrawnAt", () => {
  const item = {
    history: [
      { round: 3, type: "withdrawn" },
      { round: 6, type: "reinstated" },
      { round: 8, type: "withdrawn" },
    ],
  };

  it("applies an event from its own round onward", () => {
    expect(isWithdrawnAt(item, 2)).toBe(false);
    expect(isWithdrawnAt(item, 3)).toBe(true); // withdrawal takes effect
    expect(isWithdrawnAt(item, 5)).toBe(true);
    expect(isWithdrawnAt(item, 6)).toBe(false); // reinstatement takes effect
  });

  it("runs the latest withdrawal forward indefinitely", () => {
    expect(isWithdrawnAt(item, 8)).toBe(true);
    expect(isWithdrawnAt(item, 1000)).toBe(true);
  });
});

describe("isWithdrawnNow", () => {
  it("is true only when the latest presence event is a withdrawal", () => {
    expect(isWithdrawnNow({ history: [{ round: 3, type: "withdrawn" }] })).toBe(true);
    expect(
      isWithdrawnNow({
        history: [
          { round: 3, type: "withdrawn" },
          { round: 6, type: "reinstated" },
        ],
      }),
    ).toBe(false);
    expect(isWithdrawnNow({})).toBe(false);
  });

  it("ignores revisions after a withdrawal", () => {
    expect(
      isWithdrawnNow({
        history: [
          { round: 3, type: "withdrawn" },
          { round: 5, type: "revised", previousText: "x" },
        ],
      }),
    ).toBe(true);
  });
});

describe("withEvent", () => {
  it("appends, migrating legacy fields into the list first", () => {
    expect(
      withEvent({ withdrawnRound: 2, reinstatedRound: 4 }, {
        round: 7,
        type: "withdrawn",
      }),
    ).toEqual([
      { round: 2, type: "withdrawn" },
      { round: 4, type: "reinstated" },
      { round: 7, type: "withdrawn" },
    ]);
  });
});

describe("textAtRound", () => {
  const item = {
    text: "Third wording",
    history: [
      { round: 3, type: "revised", previousText: "First wording" },
      { round: 7, type: "revised", previousText: "Second wording" },
    ],
  };

  it("returns the wording in force at that round", () => {
    expect(textAtRound(item, 2)).toBe("First wording");
    expect(textAtRound(item, 5)).toBe("Second wording");
    expect(textAtRound(item, 9)).toBe("Third wording");
  });

  it("falls back to a relation's explanation", () => {
    const rel = { explanation: "Because", history: [] };
    expect(textAtRound(rel, 4)).toBe("Because");
  });
});

describe("asOfRound", () => {
  const item = {
    id: "J1",
    text: "Now",
    status: "withdrawn",
    reason: "Superseded",
    previousText: "Before",
    history: [
      { round: 3, type: "revised", previousText: "Before" },
      { round: 5, type: "withdrawn", reason: "Superseded" },
    ],
  };

  it("projects status, wording and reason back", () => {
    const at2 = asOfRound(item, 2);
    expect(at2.status).toBe("active");
    expect(at2.text).toBe("Before");
    expect(at2.reason).toBeUndefined();
    expect(at2.previousText).toBeUndefined();
  });

  it("keeps a revision visible once it has happened", () => {
    const at4 = asOfRound(item, 4);
    expect(at4.status).toBe("revised");
    expect(at4.text).toBe("Now");
    expect(at4.previousText).toBe("Before");
  });

  it("returns the same object when nothing differs", () => {
    expect(asOfRound(item, 9)).toBe(item);
  });

  it("shows the reason belonging to the withdrawal in force", () => {
    const twice = {
      id: "J4",
      text: "x",
      status: "withdrawn",
      reason: "Second reason",
      history: [
        { round: 2, type: "withdrawn", reason: "First reason" },
        { round: 4, type: "reinstated" },
        { round: 6, type: "withdrawn", reason: "Second reason" },
      ],
    };
    expect(asOfRound(twice, 3).reason).toBe("First reason");
    expect(asOfRound(twice, 5).reason).toBeUndefined();
    expect(asOfRound(twice, 7).reason).toBe("Second reason");
  });

  it("leaves an item with no recorded history untouched", () => {
    const bare = { id: "J2", status: "possible", text: "x" };
    expect(asOfRound(bare, 4)).toBe(bare);
  });

  it("reports a rejection that was later reinstated", () => {
    const el = {
      id: "J3",
      text: "x",
      status: "active",
      history: [
        { round: 2, type: "rejected" },
        { round: 6, type: "reinstated" },
      ],
    };
    expect(asOfRound(el, 3).status).toBe("rejected");
    expect(asOfRound(el, 6).status).toBe("active");
  });
});

// ─── linkableElements ─────────────────────────────────────────────────────────

describe("linkableElements", () => {
  const byStatus = (status) => ({ id: `J${status.length}`, status });

  it("keeps withdrawn and rejected elements available", () => {
    const els = ["active", "revised", "withdrawn", "rejected"].map(byStatus);
    expect(linkableElements(els)).toEqual(els);
  });

  it("excludes elements the user has not affirmed yet", () => {
    const possible = byStatus("possible");
    expect(linkableElements([j1, possible])).toEqual([j1]);
  });

  it("keeps elements with no status set", () => {
    const bare = { id: "J9" };
    expect(linkableElements([bare])).toEqual([bare]);
  });
});

// ─── defaultPickerIds ─────────────────────────────────────────────────────────

describe("defaultPickerIds", () => {
  it("seeds from elements that are in play", () => {
    const els = [
      { id: "J1", status: "withdrawn" },
      { id: "J2", status: "active" },
      { id: "P1", status: "rejected" },
      { id: "P2", status: "revised" },
    ];
    expect(defaultPickerIds(els)).toEqual(["J2", "P2"]);
  });

  it("falls back to the whole pool when nothing is in play", () => {
    const els = [
      { id: "J2", status: "withdrawn" },
      { id: "J1", status: "rejected" },
    ];
    expect(defaultPickerIds(els)).toEqual(["J1", "J2"]);
  });

  it("returns an empty list for no elements", () => {
    expect(defaultPickerIds([])).toEqual([]);
  });
});

// ─── stateAtRound ─────────────────────────────────────────────────────────────

describe("stateAtRound", () => {
  const state = {
    topic: "t",
    round: 9,
    elements: [
      { id: "J1", type: "judgment", status: "active", addedRound: 1 },
      {
        id: "P1",
        type: "principle",
        status: "withdrawn",
        addedRound: 1,
        withdrawals: [{ from: 3, to: 6 }, { from: 8 }],
      },
    ],
    relations: [
      {
        from: "J1",
        to: "P1",
        type: "supports",
        addedRound: 2,
        status: "withdrawn",
        withdrawals: [{ from: 4 }],
      },
    ],
    log: [],
  };
  const statusOf = (round, id) =>
    stateAtRound(state, round).elements.find((e) => e.id === id).status;

  it("rewrites element status to what it was that round", () => {
    expect(statusOf(2, "P1")).toBe("active");
    expect(statusOf(4, "P1")).toBe("withdrawn");
    expect(statusOf(7, "P1")).toBe("active");
    expect(statusOf(8, "P1")).toBe("withdrawn");
  });

  it("rewrites relation status the same way", () => {
    const relAt = (round) => stateAtRound(state, round).relations[0];
    expect(relAt(3).status).toBe("active");
    expect(relAt(5).status).toBe("withdrawn");
  });

  it("still excludes relations added after the round", () => {
    expect(stateAtRound(state, 1).relations).toHaveLength(0);
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
