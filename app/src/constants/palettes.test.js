import { describe, it, expect } from "vitest";
import { PALETTES, resolvePalette, inkWeight, headerAccent } from "./palettes.js";
import { getColors } from "./colors.js";

/**
 * The two palettes make different promises, and these tests hold them to the
 * one each actually makes.
 *
 * `default` is chosen by eye and does **not** clear AA everywhere — its ramp
 * crosses the luminance at which the readable ink flips, so no single ink can.
 * What it is held to is a floor (3:1, the threshold for large type and UI
 * components) so it cannot quietly get worse, plus the structural properties
 * that make the graph readable at all.
 *
 * `accessible` is the compliant path and is held to AAA. If that ever stops
 * being true the mode has no reason to exist.
 *
 * The hexes themselves are a design choice and are not asserted.
 */
const luminance = (hex) => {
  const body = hex.replace("#", "");
  const n = parseInt(body.length === 3 ? body.replace(/./g, (c) => c + c) : body, 16);
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const distance = (a, b) =>
  Math.hypot(
    ...[0, 2, 4].map(
      (i) => parseInt(a.slice(1 + i, 3 + i), 16) - parseInt(b.slice(1 + i, 3 + i), 16),
    ),
  );

const TYPES = ["judgment", "principle", "theory"];
const NAMES = Object.keys(PALETTES);
/** Every stop the ramp is actually sampled at, not just the endpoints. */
const STOPS = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1];

describe.each(NAMES)("the %s palette", (name) => {
  const palette = PALETTES[name];

  it("names itself, and its ink comes with a weight", () => {
    // The weight is derived from the ink rather than set beside it, so a
    // palette cannot arrive with white ids at normal weight or black at bold.
    expect(palette.id).toBe(name);
    expect(inkWeight(palette.ink)).toBe(name === "accessible" ? "normal" : "bold");
  });

  it("outlines every node in something that reads on both grounds", () => {
    // A pale fill on the light page is separated from it by the stroke, not by
    // the fill. Both themes are checked for every palette because accessible
    // mode is used on either one.
    for (const bg of ["#0f172a", "#f2f3f4"]) {
      for (const type of TYPES) {
        expect(
          contrast(palette[type].stroke, bg),
          `${type} stroke ${palette[type].stroke} on ${bg}`,
        ).toBeGreaterThan(2.5);
      }
    }
  });

  it("keeps low and high far enough apart to read as different", () => {
    // The tint half of the confidence cue; size carries the rest.
    for (const type of TYPES) {
      const { low, high } = palette[type];
      expect(distance(low, high), `${type}: ${low} → ${high}`).toBeGreaterThan(60);
    }
  });

  it("keeps the three types apart from each other", () => {
    // Written after a revision pulled the judgment blue and the principle
    // purple close enough together to read as one colour.
    for (const end of ["low", "high"]) {
      for (const [a, b] of [
        ["judgment", "principle"],
        ["judgment", "theory"],
        ["principle", "theory"],
      ]) {
        const [x, y] = [palette[a][end], palette[b][end]];
        expect(distance(x, y), `${a} vs ${b} @ ${end}: ${x} / ${y}`).toBeGreaterThan(45);
      }
    }
  });

});

describe("the accessible palette", () => {
  it("clears AAA at every point on every ramp", () => {
    // The mode's entire reason to exist. If this stops holding there is no
    // compliant path left in the app.
    for (const type of TYPES) {
      for (const confidence of STOPS) {
        const { fill } = getColors(
          { type, confidence, status: "active" },
          PALETTES.accessible,
        );
        expect(
          contrast(fill, PALETTES.accessible.ink),
          `${type} @ ${confidence} (${fill})`,
        ).toBeGreaterThanOrEqual(7);
      }
    }
  });
});

describe("resolvePalette", () => {
  it("gives the default palette unless accessible mode is on", () => {
    expect(resolvePalette()).toBe(PALETTES.default);
    expect(resolvePalette(false)).toBe(PALETTES.default);
    expect(resolvePalette(true)).toBe(PALETTES.accessible);
  });

  it("ignores anything beyond the accessible flag", () => {
    // The theme used to be the *first* parameter. This catches a call site left
    // on the old signature, which would otherwise silently invert the modes.
    expect(resolvePalette(false, true)).toBe(PALETTES.default);
    expect(resolvePalette(true, false)).toBe(PALETTES.accessible);
  });
});

describe("inkWeight", () => {
  it("asks for bold on light ink and normal on dark", () => {
    expect(inkWeight("#ffffff")).toBe("bold");
    expect(inkWeight("#000000")).toBe("normal");
    expect(inkWeight("#0f172a")).toBe("normal");
  });
});

describe("the default palette's known limit", () => {
  it("crosses the luminance where the readable ink flips", () => {
    // Recorded rather than fixed. The ramp runs from tints that want dark type
    // to tones that want light, so one ink cannot clear AA along all of it —
    // which is exactly why the accessible mode exists. If this ever stops being
    // true, the trade-off has gone away and the mode can be reconsidered.
    const { judgment } = PALETTES.default;
    expect(luminance(judgment.low)).toBeGreaterThan(0.183);
    expect(luminance(judgment.high)).toBeLessThan(0.183);
  });

  it("clears AA where the ink was chosen for — the saturated end", () => {
    // White is picked for the confident nodes, which is where the eye goes.
    // Deliberately not asserted below this: on the pale tints white falls to
    // 1.4–1.9:1, and the high-contrast mode is the answer to that, not a
    // re-toning of these fills.
    for (const type of TYPES) {
      const { fill } = getColors({ type, confidence: 1, status: "active" }, PALETTES.default);
      const ratio = contrast(fill, PALETTES.default.ink);
      // Amber is the one type white does not clear even at full confidence.
      const floor = type === "theory" ? 3 : 4.5;
      expect(ratio, `${type} @ 1 (${fill})`).toBeGreaterThanOrEqual(floor);
    }
  });
});

// ─── Assist tab headers ───────────────────────────────────────────────────────

describe("headerAccent", () => {
  const ASSIST_TABS = [
    "questionnaire",
    "elicitJudgments",
    "suggestPrinciples",
    "detectArguments",
    "suggestRelations",
    "suggestTheories",
    "processReview",
  ];

  it("gives every tab that produces something its graph constant, exactly", () => {
    // Exactly, not a legibility-tuned variant: a header that is nearly the
    // constant is a different colour from the nodes it names.
    const p = PALETTES.default;
    expect(headerAccent(p, "elicitJudgments").fill).toBe(p.judgment.high);
    expect(headerAccent(p, "suggestPrinciples").fill).toBe(p.principle.high);
    expect(headerAccent(p, "suggestTheories").fill).toBe(p.theory.high);
    expect(headerAccent(p, "detectArguments").fill).toBe(p.edges.entails);
    expect(headerAccent(p, "suggestRelations").fill).toBe(p.edges.supports);
    expect(headerAccent(p, "questionnaire").fill).toBe(p.judgment.high);
  });

  it("follows the palette in force", () => {
    expect(headerAccent(PALETTES.accessible, "suggestPrinciples").fill).toBe(
      PALETTES.accessible.principle.high,
    );
    expect(headerAccent(PALETTES.accessible, "detectArguments").fill).toBe(
      PALETTES.accessible.edges.entails,
    );
  });

  it("gives an element tab the palette's own node ink", () => {
    // The point of the high-contrast badge: it is drawn the way the node is
    // drawn, down to the ink the node id is written in.
    for (const mode of Object.values(PALETTES)) {
      expect(headerAccent(mode, "suggestTheories").ink).toBe(mode.ink);
    }
  });

  it("returns nothing for a tab that names no element or relation", () => {
    // Review is prose about the whole process. It borrows no colour, and — the
    // bug this pins — no badge: it once got one with the panel's own text colour
    // on it, which in the light theme is near-black on near-black.
    expect(headerAccent(PALETTES.default, "processReview")).toBeNull();
    expect(headerAccent(PALETTES.accessible, "processReview")).toBeNull();
  });

  it("answers for every assist tab without throwing", () => {
    for (const tab of ASSIST_TABS) {
      const got = headerAccent(PALETTES.accessible, tab);
      expect(got === null || typeof got.fill === "string").toBe(true);
    }
  });

  it("writes every high-contrast badge in an ink that clears AA on it", () => {
    // What makes the badge the compliant path. The default mode is deliberately
    // not held to this — see the note at the top of this file.
    for (const tab of ASSIST_TABS) {
      const got = headerAccent(PALETTES.accessible, tab);
      if (!got) continue;
      expect(
        contrast(got.fill, got.ink),
        `${tab}: ${got.ink} on ${got.fill}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
