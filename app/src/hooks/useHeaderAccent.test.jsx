// @vitest-environment jsdom
//
// How an assist tab's header is drawn, per viewing mode. The colour half is
// pinned in constants/palettes.test.js; what is here is the part that depends on
// the mode in force — and, since the mode is a module-level store rather than
// component state, that a header already on screen follows a change of mode
// without being remounted.
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useHeaderAccent } from "./useHeaderAccent.js";
import { toggleAccessible } from "./useTheme.js";
import { PALETTES } from "../constants/palettes.js";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-contrast");
});

/** Leaves high-contrast on; the afterEach clears it. */
const goHighContrast = () => {
  act(() => toggleAccessible());
  expect(document.documentElement.dataset.contrast).toBe("high");
};

describe("useHeaderAccent", () => {
  it("writes the constant as type on the panel in the default mode", () => {
    const { result } = renderHook(() => useHeaderAccent("suggestPrinciples"));
    expect(result.current.ink).toBe(PALETTES.default.principle.high);
    expect(result.current.badge).toEqual({});
    expect(result.current.marker).toEqual({ "data-accent": "graph" });
  });

  it("fills a badge with the constant in high-contrast mode", () => {
    const { result } = renderHook(() => useHeaderAccent("suggestPrinciples"));
    goHighContrast();
    expect(result.current.accent).toBe(PALETTES.accessible.principle.high);
    expect(result.current.badge.background).toBe(PALETTES.accessible.principle.high);
    expect(result.current.ink).toBe(PALETTES.accessible.ink);
  });

  // The weight is bold on the panel, where thin coloured type at 12px needs it
  // to hold its colour, and normal on the chip, where the dark ink goes blobby —
  // the same rule, and the same reason, as the ids drawn on the nodes.
  it.each([
    "elicitJudgments",
    "suggestPrinciples",
    "suggestTheories",
    "detectArguments",
    "suggestRelations",
    "questionnaire",
  ])("drops the bold on the %s chip", (tab) => {
    const { result } = renderHook(() => useHeaderAccent(tab));
    expect(result.current.weight).toBe("bold");
    goHighContrast();
    expect(result.current.weight).toBe("normal");
  });

  // Review names no element or relation, so it borrows no colour — and must not
  // take the chip either. Giving it one put the panel's own text colour on a
  // black chip, which in the light theme was near-black on near-black.
  it("leaves a tab that names nothing unstyled in both modes", () => {
    const { result } = renderHook(() => useHeaderAccent("processReview"));
    expect(result.current.badge).toEqual({});
    expect(result.current.marker).toEqual({});
    goHighContrast();
    expect(result.current.badge).toEqual({});
    expect(result.current.marker).toEqual({});
  });

  // The mode store is shared by every reader, so a header already rendered has
  // to repaint on a toggle. The e2e audit walks the tabs *after* switching mode,
  // which mounts each one fresh and so cannot see a stale one.
  it("follows a mode change without being remounted", () => {
    const { result } = renderHook(() => useHeaderAccent("suggestTheories"));
    const before = { ...result.current };
    goHighContrast();
    expect(result.current.ink).not.toBe(before.ink);
    expect(result.current.accent).not.toBe(before.accent);
    act(() => toggleAccessible());
    expect(result.current.ink).toBe(before.ink);
    expect(result.current.accent).toBe(before.accent);
  });
});
