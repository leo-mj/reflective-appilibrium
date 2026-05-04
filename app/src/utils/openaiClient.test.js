// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { getLLMHeaders } from "./openaiClient.js";

describe("getLLMHeaders", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns empty object when nothing stored", () => {
    expect(getLLMHeaders()).toEqual({});
  });

  it("returns all three headers when settings are complete", () => {
    sessionStorage.setItem(
      "llmSettings",
      JSON.stringify({
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
      })
    );
    const h = getLLMHeaders();
    expect(h["x-api-key"]).toBe("sk-test");
    expect(h["x-base-url"]).toBe("https://api.openai.com/v1");
    expect(h["x-model"]).toBe("gpt-4o");
  });

  it("omits headers for empty fields", () => {
    sessionStorage.setItem(
      "llmSettings",
      JSON.stringify({
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
      })
    );
    const h = getLLMHeaders();
    expect(h["x-api-key"]).toBeUndefined();
    expect(h["x-base-url"]).toBeDefined();
  });
});
