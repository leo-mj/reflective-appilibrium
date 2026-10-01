// @vitest-environment jsdom
//
// The prose half of the export used to show only the most recent prior wording,
// so a twice-revised element lost its first version outside the JSON block.
// These tests cover the history trail that replaced it.
import { describe, it, expect } from "vitest";
import {
  buildMarkdown,
  DEFAULT_EXPORT_SECTIONS,
  EXPORT_SECTIONS,
  exportSectionsFor,
} from "./exportMarkdown.js";
import { importStateFromFile } from "./importMarkdown.js";
import { importArgdownFromFile } from "./importArgdown.js";

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
    expect(block).toContain('Step 3: reworded from "First wording"');
    expect(block).toContain('Step 6: reworded from "Second wording"');
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
    expect(block).toContain("Step 2: withdrawn — Too broad");
    expect(block).toContain("Step 5: reinstated");
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
    expect(elementsBlock(md)).toContain("Step 4: withdrawn — No longer held");
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
    expect(md).toContain("  - Step 4: withdrawn");
    expect(md).toContain("  - Step 7: reinstated");
  });

  it("leaves an untouched element with no trail", () => {
    const block = elementsBlock(buildMarkdown(makeState(), {}));
    expect(block).toContain("Current wording");
    expect(block).not.toContain("Step ");
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
    expect(md).toContain("### Step 3 — First reading.");
    expect(md).toContain("### Step 7 — Second reading.");
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

describe("buildMarkdown element sources", () => {
  const aBook = (over = {}) => ({
    type: "book",
    authors: ["Parfit, D."],
    year: "1984",
    title: "Reasons and persons",
    container: "",
    editors: [],
    publisher: "Oxford University Press",
    volume: "",
    issue: "",
    pages: "",
    doi: "",
    ...over,
  });

  const cited = (sources) =>
    makeState({
      elements: [
        {
          id: "T1",
          type: "theory",
          status: "active",
          confidence: 0.67,
          origin: "claude-fable-5",
          text: "A theory",
          addedRound: 4,
          sources,
        },
      ],
    });

  it("renders each reference in APA 7, with italics", () => {
    const md = elementsBlock(buildMarkdown(cited([aBook()]), {}));
    expect(md).toContain(
      "Parfit, D. (1984). *Reasons and persons*. Oxford University Press.",
    );
  });

  it("labels them as AI-generated and unverified", () => {
    // The label travels with the data: an exported document is the artefact
    // someone might cite *from*, so a caveat that lived only in the UI would
    // evaporate at the moment it started to matter.
    const md = elementsBlock(buildMarkdown(cited([aBook()]), {}));
    expect(md).toContain("*Sources (AI-generated, unverified):*");
  });

  it("appends the resolver URL when Crossref confirmed the work", () => {
    const md = elementsBlock(
      buildMarkdown(cited([aBook({ doi: "10.1093/019824908x.001.0001" })]), {}),
    );
    expect(md).toContain("https://doi.org/10.1093/019824908x.001.0001");
  });

  it("writes nothing for an element with no sources", () => {
    const md = elementsBlock(buildMarkdown(makeState(), {}));
    expect(md).not.toContain("Sources");
  });

  it("writes nothing for a state saved before the field existed", () => {
    const md = elementsBlock(buildMarkdown(cited(undefined), {}));
    expect(md).not.toContain("Sources");
  });

  it("escapes reference text without defusing its own emphasis", () => {
    // `esc` escapes `*`, so it has to be applied per run rather than to the
    // finished string — otherwise every marker the formatter added is neutered.
    const md = elementsBlock(
      buildMarkdown(cited([aBook({ title: "Reasons & persons" })]), {}),
    );
    expect(md).toContain("*Reasons &amp; persons*");
  });

  it("carries the sources into the machine-readable block for re-import", () => {
    const md = buildMarkdown(cited([aBook()]), {});
    const parsed = JSON.parse(md.split("```re-state\n")[1].split("\n```")[0]);
    expect(parsed.elements[0].sources[0].title).toBe("Reasons and persons");
  });
});

describe("buildMarkdown sections", () => {
  const only = (...keys) => new Set(keys);

  it("writes today's export by default, and no Argdown", () => {
    const md = buildMarkdown(makeState(), {});
    expect(md).toContain("## Elements");
    expect(md).toContain("```re-state");
    expect(md).not.toContain("## Argdown");
    expect([...DEFAULT_EXPORT_SECTIONS]).not.toContain("argdown");
  });

  it("writes only what was chosen, always under the title", () => {
    const md = buildMarkdown(makeState(), {}, only("relations"));
    expect(md).toMatch(/^# Reflective Equilibrium: Test topic/);
    expect(md).not.toContain("## Elements");
    expect(md).not.toContain("```re-state");
    expect(md).not.toContain("## Graph");
  });

  it("embeds the Argdown map in a fence a statement cannot close", async () => {
    const state = makeState({
      elements: [
        { ...makeState().elements[0], text: "Quoting ``` inside a statement" },
      ],
    });
    const md = buildMarkdown(state, {}, only("argdown"));
    expect(md).toContain("## Argdown\n\n````argdown\n===\ntitle:");
    // What the fence holds is the Argdown export, and it reads back.
    const argdown = md.split("````argdown\n")[1].split("\n````")[0];
    const back = await importArgdownFromFile(
      new File([argdown], "map.argdown", { type: "text/plain" }),
    );
    expect(back.elements[0]).toMatchObject({
      id: "J1",
      text: "Quoting ``` inside a statement",
    });
  });

  it("reopens a file written with the full history alone", async () => {
    const md = buildMarkdown(makeState(), {}, only("history"));
    const back = await importStateFromFile(
      new File([md], "re.md", { type: "text/markdown" }),
    );
    expect(back.topic).toBe("Test topic");
  });

  it("offers groups, merged processes and reviews only where there are some", () => {
    const keys = (state) => exportSectionsFor(state).map((s) => s.key);
    for (const k of ["groups", "processes", "reviews"])
      expect(keys(makeState())).not.toContain(k);
    const full = makeState({
      groups: [{ id: "G1", label: "G", members: ["J1", "J2"], collapsed: false }],
      processes: [{ id: "A", label: "L", members: ["J1"], round: 1 }],
      reviews: [{ id: "r", round: 1, headline: "h", arc: "", surprises: "", missed: "", method: "", model: "", origin: "" }],
    });
    expect(keys(full)).toEqual(EXPORT_SECTIONS.map((s) => s.key));
  });
});

describe("buildMarkdown merged processes", () => {
  const merged = makeState({
    processes: [
      { id: "A", label: "Lying", members: ["J1"], round: 5 },
      { id: "B", label: "Promises", members: ["J1"], round: 5 },
    ],
  });

  it("names each element's process in the prose", () => {
    expect(elementsBlock(buildMarkdown(merged, {}))).toContain(
      "**J1** · 1 · process A+B",
    );
  });

  it("keys the letters the graph images carry", () => {
    const md = buildMarkdown(merged, {});
    expect(md).toContain("## Merged Processes");
    expect(md).toContain("- **A** — Lying *(merged at step 5)*: J1");
  });

  it("says nothing about processes when there was no merge", () => {
    const md = buildMarkdown(makeState(), {});
    expect(md).not.toContain("Merged Processes");
    expect(elementsBlock(md)).not.toContain("process");
  });
});

describe("buildMarkdown graph, and the statement view", () => {
  const state = makeState({
    elements: [
      makeState().elements[0],
      {
        id: "P1",
        type: "principle",
        status: "active",
        confidence: 1,
        origin: "user",
        text: "A principle",
        addedRound: 1,
      },
    ],
    relations: [
      { from: "J1", to: "P1", type: "entails", explanation: "", addedRound: 1 },
    ],
  });
  const positions = { J1: { x: 0, y: 0 }, P1: { x: 300, y: 0 } };

  /** The SVG embedded in the Graph section. */
  function graphSvg(md) {
    const [, b64] = md.match(/## Graph\n\n<img src="data:image\/svg\+xml;base64,([^"]+)"/);
    return decodeURIComponent(escape(atob(b64)));
  }

  it("draws nodes when the graph is not showing statements", () => {
    const svg = graphSvg(buildMarkdown(state, positions, new Set(["graph"])));
    expect(svg).not.toContain('fill="var(--c-panel)"');
    expect(svg).not.toContain("Current wording");
  });

  it("draws cards, wording and all, when it is", () => {
    const svg = graphSvg(
      buildMarkdown(state, positions, new Set(["graph"]), { statements: true }),
    );
    expect(svg).toContain('fill="var(--c-panel)"');
    expect(svg).toContain(">Current wording</tspan>");
    expect(svg).toContain(">A principle</tspan>");
  });

  it("follows the view for the graph only, not the cluster diagrams", () => {
    const md = buildMarkdown(state, positions, new Set(["clusters"]), {
      statements: true,
    });
    expect(md).not.toContain("## Graph");
    const [, b64] = md.match(/data:image\/svg\+xml;base64,([^"]+)"/);
    expect(decodeURIComponent(escape(atob(b64)))).not.toContain("tspan");
  });
});
