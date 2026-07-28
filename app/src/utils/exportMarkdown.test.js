// @vitest-environment jsdom
//
// The prose half of the export used to show only the most recent prior wording,
// so a twice-revised element lost its first version outside the JSON block.
// These tests cover the history trail that replaced it.
import { describe, it, expect } from "vitest";
import { buildMarkdown } from "./exportMarkdown.js";

function makeState(overrides = {}) {
  return {
    topic: "Test topic",
    phase: 2,
    round: 8,
    elements: [
      {
        id: "J1",
        type: "judgment",
        status: "active",
        confidence: 1,
        origin: "user",
        text: "Current wording",
        addedRound: 1,
      },
    ],
    relations: [],
    coherence: { tensions: [], orphans: [], clusters: [] },
    log: [],
    ...overrides,
  };
}

/** The Elements section only, so graph/cluster SVG noise stays out of matches. */
function elementsBlock(md) {
  return md.split("\n\n---\n\n")[1];
}

describe("buildMarkdown history trail", () => {
  it("lists every revision, not just the last", () => {
    const md = buildMarkdown(
      makeState({
        elements: [
          {
            ...makeState().elements[0],
            status: "revised",
            previousText: "Second wording",
            history: [
              { round: 3, type: "revised", previousText: "First wording" },
              { round: 6, type: "revised", previousText: "Second wording" },
            ],
          },
        ],
      }),
      {},
    );
    const block = elementsBlock(md);
    expect(block).toContain('Round 3: reworded from "First wording"');
    expect(block).toContain('Round 6: reworded from "Second wording"');
  });

  it("records withdrawal with its reason, and reinstatement", () => {
    const md = buildMarkdown(
      makeState({
        elements: [
          {
            ...makeState().elements[0],
            history: [
              { round: 2, type: "withdrawn", reason: "Too broad" },
              { round: 5, type: "reinstated" },
            ],
          },
        ],
      }),
      {},
    );
    const block = elementsBlock(md);
    expect(block).toContain("Round 2: withdrawn — Too broad");
    expect(block).toContain("Round 5: reinstated");
  });

  it("reads the legacy fields for states saved before history existed", () => {
    const md = buildMarkdown(
      makeState({
        elements: [
          {
            ...makeState().elements[0],
            status: "withdrawn",
            withdrawnRound: 4,
            reason: "No longer held",
          },
        ],
      }),
      {},
    );
    expect(elementsBlock(md)).toContain("Round 4: withdrawn — No longer held");
  });

  it("tags a rejected element, which the export used to leave unmarked", () => {
    const md = buildMarkdown(
      makeState({
        elements: [
          { ...makeState().elements[0], status: "rejected", rejectedRound: 3 },
        ],
      }),
      {},
    );
    expect(elementsBlock(md)).toContain("*(rejected)*");
  });

  it("gives relations the same trail, nested under the relation", () => {
    const md = buildMarkdown(
      makeState({
        relations: [
          {
            from: "J1",
            to: "J1",
            type: "supports",
            explanation: "Because",
            addedRound: 1,
            status: "active",
            history: [
              { round: 4, type: "withdrawn" },
              { round: 7, type: "reinstated" },
            ],
          },
        ],
      }),
      {},
    );
    expect(md).toContain("  - Round 4: withdrawn");
    expect(md).toContain("  - Round 7: reinstated");
  });

  it("leaves an untouched element with no trail", () => {
    const block = elementsBlock(buildMarkdown(makeState(), {}));
    expect(block).toContain("Current wording");
    expect(block).not.toContain("Round ");
  });

  it("still embeds the machine-readable state block", () => {
    const md = buildMarkdown(makeState(), {});
    expect(md).toContain("```re-state");
    expect(JSON.parse(md.split("```re-state\n")[1].split("\n```")[0]).topic).toBe(
      "Test topic",
    );
  });
});
