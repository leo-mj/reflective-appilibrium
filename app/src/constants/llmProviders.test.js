import { describe, it, expect } from "vitest";
import { LLMProvider, LLM_PROVIDERS } from "./llmProviders.js";

describe("LLM_PROVIDERS", () => {
  it("every entry is an LLMProvider instance", () => {
    for (const p of LLM_PROVIDERS) {
      expect(p).toBeInstanceOf(LLMProvider);
    }
  });

  it("every provider has required fields", () => {
    for (const p of LLM_PROVIDERS) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.baseUrl).toMatch(/^https:\/\//);
      expect(p.models.length).toBeGreaterThan(0);
    }
  });

  it("no two providers share an id", () => {
    const ids = LLM_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("base URLs are HTTPS", () => {
    for (const p of LLM_PROVIDERS) {
      expect(p.baseUrl.startsWith("https://")).toBe(true);
    }
  });

  it("constructor throws on empty models list", () => {
    expect(() => new LLMProvider("x", "X", "https://x.com/v1", [])).toThrow();
  });
});
