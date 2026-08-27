import { describe, it, expect } from "vitest";
import { C, typeTokens, inkOn, getColors } from "./colors.js";
import { PALETTES } from "./palettes.js";

/**
 * This file covers the plumbing: which token a caller gets, and how `getColors`
 * combines an element with a palette. The palettes' own guarantees — that each
 * one's ink is legible on every fill it can produce — live in palettes.test.js,
 * since they are properties of the palette rather than of these functions.
 *
 * Ratios are computed locally rather than pinned as hexes so the numbers stay
 * true if the palette moves.
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

describe("typeTokens", () => {
  it("gives each element type its own text tone", () => {
    expect(typeTokens("judgment")).toBe(C.judgment);
    expect(typeTokens("principle")).toBe(C.principle);
    expect(typeTokens("theory")).toBe(C.theory);
  });

  it("adds the fills when handed a palette", () => {
    // Fills are mode-dependent, so they only exist once a palette is named.
    const withPalette = typeTokens("theory", PALETTES.default);
    expect(withPalette.high).toBe(PALETTES.default.theory.high);
    expect(withPalette.stroke).toBe(PALETTES.default.theory.stroke);
    // …and the text tone survives the merge, rather than being shadowed by it.
    expect(withPalette.text).toBe(C.theory.text);
  });

  it("falls back to judgment rather than throwing on an unknown type", () => {
    // A half-validated element should still render.
    expect(typeTokens("nonsense")).toBe(C.judgment);
    expect(typeTokens(undefined)).toBe(C.judgment);
    expect(typeTokens("nonsense", PALETTES.accessible).high).toBe(PALETTES.accessible.judgment.high);
  });
});

describe("getColors", () => {
  it("reads its fills from the palette it is given", () => {
    const el = { type: "theory", confidence: 1, status: "active" };
    expect(getColors(el, PALETTES.default).fill).toBe(PALETTES.default.theory.high);
    expect(getColors(el, PALETTES.accessible).fill).toBe(PALETTES.accessible.theory.high);
  });

  it("uses the state colour for withdrawn and rejected, whatever the palette", () => {
    // Withdrawn is withdrawn in every mode — the grey is a state, not a type.
    for (const palette of Object.values(PALETTES)) {
      expect(getColors({ type: "judgment", status: "withdrawn" }, palette).fill).toBe(C.withdrawn);
      expect(getColors({ type: "judgment", status: "rejected" }, palette).fill).toBe(C.rejected);
    }
  });

  it("clamps confidence to the ends of the ramp", () => {
    const at = (confidence) =>
      getColors({ type: "judgment", confidence, status: "active" }, PALETTES.accessible).fill;
    expect(at(-1)).toBe(at(0));
    expect(at(9)).toBe(at(1));
  });
});

describe("inkOn", () => {
  it("switches to dark ink on the light palette colours", () => {
    // White on the `undermines` amber is 1.72:1, on `supports` teal 2.32:1 —
    // these are the fills the helper actually earns its keep on.
    expect(inkOn(C.undermines)).toBe(C.onAmber);
    expect(inkOn(C.supports)).toBe(C.onAmber);
  });

  it("picks the more readable of the two inks, whatever the fill", () => {
    for (const fill of [C.supports, C.conflicts, C.undermines, C.depends, C.rejected]) {
      const ink = inkOn(fill);
      const other = ink === C.onFill ? C.onAmber : C.onFill;
      expect(contrast(fill, ink), fill).toBeGreaterThanOrEqual(contrast(fill, other));
    }
  });

  it("defaults to white for values it cannot measure", () => {
    // The theme tokens are `var(--…)` strings, not hexes.
    expect(inkOn(C.bg)).toBe(C.onFill);
    expect(inkOn(undefined)).toBe(C.onFill);
  });
});
