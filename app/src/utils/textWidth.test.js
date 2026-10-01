import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("textMeasurer", () => {
  it("is null where there is no canvas to measure with", async () => {
    vi.stubGlobal("OffscreenCanvas", undefined);
    const { textMeasurer } = await import("./textWidth.js");
    expect(textMeasurer("14px monospace")).toBeNull();
  });

  it("measures in the font it was asked for, once per string", async () => {
    const calls = [];
    class FakeCanvas {
      getContext() {
        return {
          font: "",
          measureText(text) {
            calls.push([this.font, text]);
            return { width: text.length * (this.font.startsWith("20px") ? 10 : 7) };
          },
        };
      }
    }
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    const { textMeasurer } = await import("./textWidth.js");

    const small = textMeasurer("14px Menlo");
    const large = textMeasurer("20px Menlo");
    expect(small("abc")).toBe(21);
    expect(large("abc")).toBe(30);
    expect(small("abc")).toBe(21);
    expect(calls).toEqual([
      ["14px Menlo", "abc"],
      ["20px Menlo", "abc"],
    ]);
  });
});
