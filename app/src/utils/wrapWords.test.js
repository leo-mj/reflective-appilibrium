import { describe, it, expect } from "vitest";

import { wrapWords } from "./wrapWords.js";

describe("wrapWords", () => {
  it("fills each line up to the limit on word boundaries", () => {
    expect(wrapWords("aa bb cc dd", 5, 3)).toEqual(["aa bb", "cc dd"]);
  });

  it("ellipsises the last line when words are left over", () => {
    expect(wrapWords("aa bb cc dd ee", 5, 2)).toEqual(["aa bb", "cc d…"]);
  });

  it("returns one empty line for empty text", () => {
    expect(wrapWords("", 5, 2)).toEqual([""]);
    expect(wrapWords(undefined, 5, 2)).toEqual([""]);
  });
});

describe("wrapWords, by measured width", () => {
  // A font twice as wide as its character count: lines hold half as much.
  const wide = (s) => s.length * 2;

  it("wraps to the width the measure gives, not the character count", () => {
    // "aa bb" would fit 9 characters, but is 10 wide.
    expect(wrapWords("aa bb cc dd", 9, 4, wide)).toEqual(["aa", "bb", "cc", "dd"]);
  });

  it("trims an overlong last line until it and its ellipsis fit", () => {
    const [line] = wrapWords("abcdefghij", 10, 1, wide);
    expect(line).toBe("abcd…");
    expect(wide(line)).toBeLessThanOrEqual(10);
  });
});
