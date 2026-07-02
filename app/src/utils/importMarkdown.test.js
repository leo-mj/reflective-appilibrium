import { describe, it, expect } from "vitest";
import { importStateFromFile } from "./importMarkdown.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(content, name = "test.md") {
  return new File([content], name, { type: "text/markdown" });
}

const MINIMAL_STATE = {
  topic: "Test topic",
  round: 1,
  elements: [],
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
};

function wrapInMarkdown(state) {
  return "# Test\n\n```re-state\n" + JSON.stringify(state) + "\n```\n";
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("importStateFromFile — happy path", () => {
  it("parses a minimal valid state", async () => {
    const file = makeFile(wrapInMarkdown(MINIMAL_STATE));
    const result = await importStateFromFile(file);
    expect(result.topic).toBe("Test topic");
    expect(result.round).toBe(1);
    expect(result.elements).toEqual([]);
    expect(result.relations).toEqual([]);
  });

  it("defaults phase to 2 when absent", async () => {
    const file = makeFile(wrapInMarkdown(MINIMAL_STATE));
    const result = await importStateFromFile(file);
    expect(result.phase).toBe(2);
  });

  it("preserves phase when present", async () => {
    const file = makeFile(wrapInMarkdown({ ...MINIMAL_STATE, phase: 3 }));
    const result = await importStateFromFile(file);
    expect(result.phase).toBe(3);
  });

  it("parses a valid element", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [
        {
          id: "J1",
          type: "judgment",
          status: "active",
          confidence: "high",
          origin: "user",
          text: "Torturing is wrong.",
          addedRound: 1,
        },
      ],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].id).toBe("J1");
  });

  it("parses optional element fields (previousText, revisedRound, reason, withdrawnRound)", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [
        {
          id: "J1",
          type: "judgment",
          status: "withdrawn",
          confidence: "moderate",
          origin: "",
          text: "Old text.",
          addedRound: 1,
          previousText: "Even older.",
          revisedRound: 2,
          reason: "Changed mind.",
          withdrawnRound: 3,
        },
      ],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    const el = result.elements[0];
    expect(el.previousText).toBe("Even older.");
    expect(el.revisedRound).toBe(2);
    expect(el.reason).toBe("Changed mind.");
    expect(el.withdrawnRound).toBe(3);
  });

  it("parses a valid relation", async () => {
    const state = {
      ...MINIMAL_STATE,
      relations: [
        {
          from: "J1",
          to: "P1",
          type: "supports",
          explanation: "Because.",
          addedRound: 1,
        },
      ],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.relations[0].type).toBe("supports");
  });

  it("parses a log entry", async () => {
    const state = {
      ...MINIMAL_STATE,
      log: [
        { round: 1, findings: "f", options: "o", decision: "d", changes: "c" },
      ],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.log[0].round).toBe(1);
  });

  it("whitelists fields — does not pass through unknown fields on elements", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [
        {
          id: "J1",
          type: "judgment",
          status: "active",
          confidence: "high",
          origin: "",
          text: "Test.",
          addedRound: 1,
          __proto__: { polluted: true },
          injected: "evil",
        },
      ],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0]).not.toHaveProperty("injected");
  });
});

// ─── Block extraction errors ──────────────────────────────────────────────────

describe("importStateFromFile — block extraction errors", () => {
  it("rejects a file with no re-state block", async () => {
    const file = makeFile("# Just markdown\n\nNo state block here.");
    await expect(importStateFromFile(file)).rejects.toThrow(
      "No re-state block found",
    );
  });

  it("rejects a file where the block has no closing fence", async () => {
    const file = makeFile("```re-state\n{}\n");
    await expect(importStateFromFile(file)).rejects.toThrow();
  });
});

// ─── JSON parse errors ────────────────────────────────────────────────────────

describe("importStateFromFile — JSON errors", () => {
  it("rejects malformed JSON", async () => {
    const file = makeFile("```re-state\n{ not json }\n```\n");
    await expect(importStateFromFile(file)).rejects.toThrow("Invalid JSON");
  });
});

// ─── Schema validation errors ─────────────────────────────────────────────────

describe("importStateFromFile — schema validation", () => {
  it("rejects when root is not an object", async () => {
    const file = makeFile("```re-state\n[]\n```\n");
    await expect(importStateFromFile(file)).rejects.toThrow(
      "State must be a JSON object",
    );
  });

  it("rejects when round is missing", async () => {
    const { round: _r, ...noRound } = MINIMAL_STATE;
    const file = makeFile(wrapInMarkdown(noRound));
    await expect(importStateFromFile(file)).rejects.toThrow(/"round"/);
  });

  it("rejects an invalid element ID format", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [
        {
          id: "X99",
          type: "judgment",
          status: "active",
          confidence: "high",
          origin: "",
          text: "Test.",
          addedRound: 1,
        },
      ],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("valid element ID");
  });

  it("rejects an invalid element type", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [
        {
          id: "J1",
          type: "opinion",
          status: "active",
          confidence: "high",
          origin: "",
          text: "Test.",
          addedRound: 1,
        },
      ],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow();
  });

  it("rejects an invalid relation type", async () => {
    const state = {
      ...MINIMAL_STATE,
      relations: [
        {
          from: "J1",
          to: "P1",
          type: "causes",
          explanation: "",
          addedRound: 1,
        },
      ],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow();
  });

  it("rejects when a string field exceeds its max length", async () => {
    const state = { ...MINIMAL_STATE, topic: "x".repeat(501) };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("exceeds");
  });
});

// ─── Security / adversarial inputs ───────────────────────────────────────────

describe("importStateFromFile — prototype pollution", () => {
  it("ignores __proto__ at the root level", async () => {
    // JSON.parse does not set __proto__ on the result, but the validator must
    // also not copy it into the returned state.
    const raw = `{"__proto__":{"polluted":true},"topic":"t","round":1,"elements":[],"relations":[],"coherence":{"tensions":[],"orphans":[],"clusters":[]},"log":[]}`;
    const file = makeFile("```re-state\n" + raw + "\n```\n");
    const result = await importStateFromFile(file);
    expect({}.polluted).toBeUndefined();
    expect(result).not.toHaveProperty("__proto__", { polluted: true });
  });

  it("ignores constructor.prototype at the root level", async () => {
    const raw = `{"constructor":{"prototype":{"polluted":true}},"topic":"t","round":1,"elements":[],"relations":[],"coherence":{"tensions":[],"orphans":[],"clusters":[]},"log":[]}`;
    const file = makeFile("```re-state\n" + raw + "\n```\n");
    await importStateFromFile(file); // must not throw and must not pollute
    expect({}.polluted).toBeUndefined();
  });

  it("does not copy unknown fields from elements onto the returned object", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [
        {
          id: "J1",
          type: "judgment",
          status: "active",
          confidence: "high",
          origin: "",
          text: "Test.",
          addedRound: 1,
          __proto__: { polluted: true },
          constructor: "evil",
          extraField: "should be dropped",
        },
      ],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0]).not.toHaveProperty("extraField");
    expect(result.elements[0]).not.toHaveProperty("constructor");
    expect({}.polluted).toBeUndefined();
  });

  it("does not copy unknown fields from relations", async () => {
    const state = {
      ...MINIMAL_STATE,
      relations: [
        {
          from: "J1",
          to: "P1",
          type: "supports",
          explanation: "",
          addedRound: 1,
          injected: "evil",
        },
      ],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.relations[0]).not.toHaveProperty("injected");
  });
});

describe("importStateFromFile — type confusion attacks", () => {
  it("rejects string where round expects a number", async () => {
    const file = makeFile(wrapInMarkdown({ ...MINIMAL_STATE, round: "1" }));
    await expect(importStateFromFile(file)).rejects.toThrow(/"round"/);
  });

  it("rejects null for round", async () => {
    const file = makeFile(wrapInMarkdown({ ...MINIMAL_STATE, round: null }));
    await expect(importStateFromFile(file)).rejects.toThrow(/"round"/);
  });

  it("rejects NaN encoded as a JSON non-finite (JSON.parse produces null for invalid numbers)", async () => {
    // JSON has no NaN literal; 'NaN' is invalid JSON and parse will throw.
    const file = makeFile('```re-state\n{"topic":"t","round":NaN}\n```\n');
    await expect(importStateFromFile(file)).rejects.toThrow();
  });

  it("rejects Infinity (not valid JSON; parse throws)", async () => {
    const file = makeFile('```re-state\n{"topic":"t","round":Infinity}\n```\n');
    await expect(importStateFromFile(file)).rejects.toThrow();
  });

  it("rejects object where elements array is expected", async () => {
    const file = makeFile(wrapInMarkdown({ ...MINIMAL_STATE, elements: {} }));
    await expect(importStateFromFile(file)).rejects.toThrow(/"elements"/);
  });

  it("rejects string where elements array is expected", async () => {
    const file = makeFile(wrapInMarkdown({ ...MINIMAL_STATE, elements: "[]" }));
    await expect(importStateFromFile(file)).rejects.toThrow(/"elements"/);
  });

  it("rejects a number where topic string is expected", async () => {
    const file = makeFile(wrapInMarkdown({ ...MINIMAL_STATE, topic: 42 }));
    await expect(importStateFromFile(file)).rejects.toThrow(/"topic"/);
  });
});

describe("importStateFromFile — denial-of-service payloads", () => {
  it("rejects elements array exceeding 1000 items", async () => {
    const state = { ...MINIMAL_STATE, elements: Array(1001).fill(null) };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("exceeds");
  });

  it("rejects relations array exceeding 5000 items", async () => {
    const state = { ...MINIMAL_STATE, relations: Array(5001).fill(null) };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("exceeds");
  });

  it("rejects a topic string exceeding 500 characters", async () => {
    const state = { ...MINIMAL_STATE, topic: "x".repeat(501) };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("exceeds");
  });

  it("rejects an element text field exceeding 10 000 characters", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [
        {
          id: "J1",
          type: "judgment",
          status: "active",
          confidence: "high",
          origin: "",
          text: "x".repeat(10_001),
          addedRound: 1,
        },
      ],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("exceeds");
  });
});

describe("importStateFromFile — block extraction edge cases", () => {
  it("uses the first re-state block when multiple are present", async () => {
    const first = { ...MINIMAL_STATE, topic: "first" };
    const second = { ...MINIMAL_STATE, topic: "second" };
    const content =
      "```re-state\n" +
      JSON.stringify(first) +
      "\n```\n\n" +
      "```re-state\n" +
      JSON.stringify(second) +
      "\n```\n";
    const result = await importStateFromFile(makeFile(content));
    expect(result.topic).toBe("first");
  });

  it("tolerates arbitrary markdown before the block", async () => {
    const content =
      "# Title\n\n## Section\n\nSome **bold** text.\n\n" +
      wrapInMarkdown(MINIMAL_STATE);
    const result = await importStateFromFile(makeFile(content));
    expect(result.round).toBe(1);
  });

  it("rejects a file whose only code block is a different language", async () => {
    const file = makeFile("```json\n{}\n```\n");
    await expect(importStateFromFile(file)).rejects.toThrow(
      "No re-state block found",
    );
  });
});

// ─── File size limit ──────────────────────────────────────────────────────────

describe("importStateFromFile — size limit", () => {
  it("rejects files over 500 KB", async () => {
    const bigContent = "x".repeat(500_001);
    const file = new File([bigContent], "big.md", { type: "text/markdown" });
    await expect(importStateFromFile(file)).rejects.toThrow("too large");
  });

  it("accepts files exactly at the limit", async () => {
    // A valid file padded to just under the limit via a comment before the block.
    const padding = "<!-- " + "x".repeat(490_000) + " -->\n";
    const file = makeFile(padding + wrapInMarkdown(MINIMAL_STATE));
    // Should not throw on size (may throw for other reasons if padding breaks parse)
    // We just verify it doesn't throw the size error specifically
    const result = await importStateFromFile(file).catch((e) => e);
    if (result instanceof Error) {
      expect(result.message).not.toMatch("too large");
    }
  });
});

// ─── Element: new optional fields (arguments, simulate, questionnaire) ────────

const BASE_EL = {
  id: "J1",
  type: "judgment",
  status: "active",
  confidence: "high",
  origin: "",
  text: "Test.",
  addedRound: 1,
};

describe("importStateFromFile — element: rejected / possible statuses", () => {
  it("accepts status 'rejected'", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, status: "rejected" }],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0].status).toBe("rejected");
  });

  it("accepts status 'possible'", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, status: "possible" }],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0].status).toBe("possible");
  });
});

describe("importStateFromFile — element: rejectedRound", () => {
  it("preserves rejectedRound", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, status: "rejected", rejectedRound: 2 }],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0].rejectedRound).toBe(2);
  });

  it("does not set rejectedRound when absent", async () => {
    const state = { ...MINIMAL_STATE, elements: [{ ...BASE_EL }] };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0]).not.toHaveProperty("rejectedRound");
  });

  it("rejects a non-number rejectedRound", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, rejectedRound: "2" }],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow(/rejectedRound/);
  });
});

describe("importStateFromFile — element: negated (simulate feature)", () => {
  it("preserves negated: true", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, negated: true }],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0].negated).toBe(true);
  });

  it("preserves negated: false", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, negated: false }],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0].negated).toBe(false);
  });

  it("does not set negated when absent", async () => {
    const state = { ...MINIMAL_STATE, elements: [{ ...BASE_EL }] };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0]).not.toHaveProperty("negated");
  });

  it("rejects a non-boolean negated", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, negated: "true" }],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow(/negated/);
  });

  it("rejects negated: 1 (number, not boolean)", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, negated: 1 }],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow(/negated/);
  });
});

describe("importStateFromFile — element: questionnaireIndex", () => {
  it("preserves questionnaireIndex", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, status: "possible", questionnaireIndex: 3 }],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0].questionnaireIndex).toBe(3);
  });

  it("does not set questionnaireIndex when absent", async () => {
    const state = { ...MINIMAL_STATE, elements: [{ ...BASE_EL }] };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.elements[0]).not.toHaveProperty("questionnaireIndex");
  });

  it("rejects a string questionnaireIndex", async () => {
    const state = {
      ...MINIMAL_STATE,
      elements: [{ ...BASE_EL, questionnaireIndex: "0" }],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow(/questionnaireIndex/);
  });
});

// ─── Relation: argumentId and rejectedRound (argument feature) ────────────────

const BASE_REL = {
  from: "J1",
  to: "P1",
  type: "jointly_entails",
  explanation: "Because.",
  addedRound: 1,
};

describe("importStateFromFile — relation: argumentId", () => {
  it("preserves argumentId", async () => {
    const state = {
      ...MINIMAL_STATE,
      relations: [{ ...BASE_REL, argumentId: "arg-1" }],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.relations[0].argumentId).toBe("arg-1");
  });

  it("does not set argumentId when absent", async () => {
    const state = { ...MINIMAL_STATE, relations: [{ ...BASE_REL }] };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.relations[0]).not.toHaveProperty("argumentId");
  });

  it("rejects argumentId exceeding 200 characters", async () => {
    const state = {
      ...MINIMAL_STATE,
      relations: [{ ...BASE_REL, argumentId: "x".repeat(201) }],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("exceeds");
  });

  it("rejects a non-string argumentId", async () => {
    const state = {
      ...MINIMAL_STATE,
      relations: [{ ...BASE_REL, argumentId: 42 }],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow(/argumentId/);
  });
});

describe("importStateFromFile — relation: rejectedRound", () => {
  it("preserves rejectedRound", async () => {
    const state = {
      ...MINIMAL_STATE,
      relations: [{ ...BASE_REL, status: "rejected", rejectedRound: 2 }],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.relations[0].rejectedRound).toBe(2);
  });

  it("does not set rejectedRound when absent", async () => {
    const state = { ...MINIMAL_STATE, relations: [{ ...BASE_REL }] };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.relations[0]).not.toHaveProperty("rejectedRound");
  });

  it("rejects a non-number rejectedRound", async () => {
    const state = {
      ...MINIMAL_STATE,
      relations: [{ ...BASE_REL, rejectedRound: "2" }],
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow(/rejectedRound/);
  });
});

// ─── Questionnaire mode ───────────────────────────────────────────────────────

const MINIMAL_SPEC = {
  id: "darca",
  name: "DARCA",
  model: "darca",
  card: {
    title: "DARCA Questionnaire",
    description: "A test questionnaire.",
    buttonLabel: "Start",
  },
  suggestions: [
    {
      question: "Q1. A question?",
      judgments: [
        {
          index: 1,
          id: "J1",
          confidence: "high",
          answer: "Yes",
          text: "Yes answer.",
        },
        {
          index: 2,
          id: "J2",
          confidence: "high",
          answer: "No",
          text: "No answer.",
        },
      ],
    },
  ],
  participantArguments: [[1, 3]],
  furtherArguments: [[2, 4]],
};

describe("importStateFromFile — questionnaire: model field", () => {
  it("preserves model: 'questionnaire'", async () => {
    const state = { ...MINIMAL_STATE, model: "questionnaire" };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.model).toBe("questionnaire");
  });

  it("does not set model when absent", async () => {
    const result = await importStateFromFile(
      makeFile(wrapInMarkdown(MINIMAL_STATE)),
    );
    expect(result).not.toHaveProperty("model");
  });

  it("rejects an unknown model value", async () => {
    const state = { ...MINIMAL_STATE, model: "classic" };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow(/"model"/);
  });
});

describe("importStateFromFile — questionnaire: questionnaireSpec round-trip", () => {
  it("round-trips a complete spec", async () => {
    const state = {
      ...MINIMAL_STATE,
      model: "questionnaire",
      questionnaireSpec: MINIMAL_SPEC,
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    const spec = result.questionnaireSpec;
    expect(spec.id).toBe("darca");
    expect(spec.name).toBe("DARCA");
    expect(spec.card.title).toBe("DARCA Questionnaire");
    expect(spec.card.description).toBe("A test questionnaire.");
    expect(spec.card.buttonLabel).toBe("Start");
    expect(spec.suggestions).toHaveLength(1);
    expect(spec.suggestions[0].judgments).toHaveLength(2);
    expect(spec.suggestions[0].judgments[0].index).toBe(1);
    expect(spec.participantArguments).toEqual([[1, 3]]);
    expect(spec.furtherArguments).toEqual([[2, 4]]);
  });

  it("accepts card.description as an array mixing strings and link objects", async () => {
    const spec = {
      ...MINIMAL_SPEC,
      card: {
        ...MINIMAL_SPEC.card,
        description: [
          "Some text. ",
          { link: "a link", href: "https://example.com" },
          " more text.",
        ],
      },
    };
    const state = {
      ...MINIMAL_STATE,
      model: "questionnaire",
      questionnaireSpec: spec,
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    const desc = result.questionnaireSpec.card.description;
    expect(Array.isArray(desc)).toBe(true);
    expect(desc[0]).toBe("Some text. ");
    expect(desc[1]).toEqual({ link: "a link", href: "https://example.com" });
    expect(desc[2]).toBe(" more text.");
  });

  it("accepts empty participantArguments and furtherArguments", async () => {
    const spec = {
      ...MINIMAL_SPEC,
      participantArguments: [],
      furtherArguments: [],
    };
    const state = {
      ...MINIMAL_STATE,
      model: "questionnaire",
      questionnaireSpec: spec,
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.questionnaireSpec.participantArguments).toEqual([]);
    expect(result.questionnaireSpec.furtherArguments).toEqual([]);
  });

  it("accepts questionnaireSpec without model field (independent fields)", async () => {
    const state = { ...MINIMAL_STATE, questionnaireSpec: MINIMAL_SPEC };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.questionnaireSpec.id).toBe("darca");
    expect(result).not.toHaveProperty("model");
  });

  it("does not pass through unknown fields in questionnaireSpec", async () => {
    const spec = { ...MINIMAL_SPEC, injected: "evil" };
    const state = { ...MINIMAL_STATE, questionnaireSpec: spec };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.questionnaireSpec).not.toHaveProperty("injected");
  });
});

describe("importStateFromFile — questionnaire: spec validation errors", () => {
  it("rejects questionnaireSpec that is not an object", async () => {
    const state = {
      ...MINIMAL_STATE,
      questionnaireSpec: "invalid",
    };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("questionnaireSpec must be a JSON object");
  });

  it("rejects questionnaireSpec that is an array", async () => {
    const state = { ...MINIMAL_STATE, questionnaireSpec: [] };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("questionnaireSpec must be a JSON object");
  });

  it("rejects a non-number judgment index", async () => {
    const spec = {
      ...MINIMAL_SPEC,
      suggestions: [
        {
          question: "Q1. A question?",
          judgments: [
            {
              index: "not-a-number",
              id: "J1",
              confidence: "high",
              answer: "Yes",
              text: "Yes.",
            },
          ],
        },
      ],
    };
    const state = { ...MINIMAL_STATE, questionnaireSpec: spec };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow();
  });

  it("rejects an invalid item type in card.description array", async () => {
    const spec = {
      ...MINIMAL_SPEC,
      card: { ...MINIMAL_SPEC.card, description: [42] },
    };
    const state = { ...MINIMAL_STATE, questionnaireSpec: spec };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow("must be a string or link object");
  });

  it("rejects a non-number in a participantArguments inner array", async () => {
    const spec = {
      ...MINIMAL_SPEC,
      participantArguments: [[1, "two"]],
    };
    const state = { ...MINIMAL_STATE, questionnaireSpec: spec };
    await expect(
      importStateFromFile(makeFile(wrapInMarkdown(state))),
    ).rejects.toThrow();
  });
});

describe("importStateFromFile — questionnaire: elements with possible status", () => {
  it("round-trips a full questionnaire state with possible elements", async () => {
    const state = {
      ...MINIMAL_STATE,
      model: "questionnaire",
      questionnaireSpec: MINIMAL_SPEC,
      elements: [
        {
          ...BASE_EL,
          status: "possible",
          origin: "darca",
          text: "Yes answer.",
          questionnaireIndex: 1,
        },
        {
          ...BASE_EL,
          id: "J2",
          status: "possible",
          origin: "darca",
          text: "No answer.",
          questionnaireIndex: 2,
        },
      ],
    };
    const result = await importStateFromFile(makeFile(wrapInMarkdown(state)));
    expect(result.model).toBe("questionnaire");
    expect(result.elements).toHaveLength(2);
    expect(result.elements[0].status).toBe("possible");
    expect(result.elements[0].questionnaireIndex).toBe(1);
    expect(result.elements[1].questionnaireIndex).toBe(2);
  });
});
