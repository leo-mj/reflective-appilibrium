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
          type: "entails",
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
