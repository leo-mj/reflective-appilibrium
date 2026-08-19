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

// ─── Process reviews ──────────────────────────────────────────────────────────

describe("buildMarkdown process reviews", () => {
  const aReview = (overrides = {}) => ({
    id: "rev-1",
    round: 3,
    headline: "The centre moved.",
    arc: "How it moved.",
    surprises: "What turned.",
    missed: "What was left.",
    method: "How it was done.",
    model: "gpt-4o",
    origin: "gpt-4o & user",
    ...overrides,
  });

  it("omits the section entirely when there are no reviews", () => {
    expect(buildMarkdown(makeState(), {})).not.toContain("## Process Reviews");
  });

  it("omits the section on a state written before the feature", () => {
    // `reviews` is absent, not empty, on every such state — reading it directly
    // rather than through reviewsOf is what would throw here.
    const state = makeState();
    delete state.reviews;
    expect(() => buildMarkdown(state, {})).not.toThrow();
  });

  it("writes one heading per review, oldest first", () => {
    const md = buildMarkdown(
      makeState({
        reviews: [
          aReview({ id: "rev-1", round: 3, headline: "First reading." }),
          aReview({ id: "rev-2", round: 7, headline: "Second reading." }),
        ],
      }),
      {},
    );
    expect(md).toContain("## Process Reviews");
    expect(md).toContain("### Round 3 — First reading.");
    expect(md).toContain("### Round 7 — Second reading.");
    // Oldest first, so a later review's back-references land after what they
    // refer to rather than before it.
    expect(md.indexOf("First reading.")).toBeLessThan(md.indexOf("Second reading."));
  });

  it("labels all four prose parts and attributes the review", () => {
    const md = buildMarkdown(makeState({ reviews: [aReview()] }), {});
    // The origin carries a model name and a user marker, both free text, so it
    // goes through `esc` like everything else the export writes.
    expect(md).toContain("*AI-generated by gpt-4o &amp; user*");
    expect(md).toContain("**How the position moved**");
    expect(md).toContain("**Surprising turns**");
    expect(md).toContain("**Missed opportunities**");
    expect(md).toContain("**How the process was conducted**");
  });

  it("skips a part the model left empty", () => {
    const md = buildMarkdown(
      makeState({ reviews: [aReview({ method: "" })] }),
      {},
    );
    expect(md).toContain("**Missed opportunities**");
    expect(md).not.toContain("**How the process was conducted**");
  });

  it("escapes review prose like every other free text", () => {
    const md = buildMarkdown(
      makeState({ reviews: [aReview({ arc: "P1 & J2 [see #3]" })] }),
      {},
    );
    expect(md).toContain("P1 &amp; J2 \\[see \\#3\\]");
  });

  it("carries the reviews into the machine-readable block for re-import", () => {
    const md = buildMarkdown(makeState({ reviews: [aReview()] }), {});
    const parsed = JSON.parse(md.split("```re-state\n")[1].split("\n```")[0]);
    expect(parsed.reviews).toHaveLength(1);
    expect(parsed.reviews[0].id).toBe("rev-1");
  });
});
