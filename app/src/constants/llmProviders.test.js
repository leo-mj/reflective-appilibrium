import { describe, it, expect } from "vitest";
import {
  LLMProvider,
  LLM_PROVIDERS,
  offeredProviders,
} from "./llmProviders.js";

// A hosted backend's "localhost" is the server, so it refuses those URLs and
// the settings modal must not offer them (backend/dependencies.py).
describe("offeredProviders", () => {
  it("leaves out Ollama against a hosted backend", () => {
    const ids = offeredProviders("hosted").map((p) => p.id);
    expect(ids).not.toContain("local");
    expect(ids).toEqual(["openai", "mistral", "anthropic"]);
  });

  it("offers everything against a local backend, or one not yet heard from", () => {
    expect(offeredProviders("local")).toBe(LLM_PROVIDERS);
    expect(offeredProviders(null)).toBe(LLM_PROVIDERS);
  });

  it("tells loopback URLs by host, not by the word in them", () => {
    expect(new LLMProvider("a", "A", "http://127.0.0.1:1/v1").loopback).toBe(true);
    expect(new LLMProvider("b", "B", "http://[::1]:1/v1").loopback).toBe(true);
    expect(new LLMProvider("c", "C", "https://localhost.example/v1").loopback).toBe(false);
  });
});

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
      expect(p.baseUrl).toMatch(/^https?:\/\//);
    }
  });

  it("names no models: the provider is asked which a key can use", () => {
    for (const p of LLM_PROVIDERS) expect(p.models).toBeUndefined();
  });

  it("no two providers share an id", () => {
    const ids = LLM_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("remote providers use HTTPS; local providers may use HTTP", () => {
    for (const p of LLM_PROVIDERS) {
      const isLocal = p.baseUrl.includes("localhost") || p.baseUrl.includes("127.0.0.1");
      if (isLocal) {
        expect(p.baseUrl).toMatch(/^https?:\/\//);
      } else {
        expect(p.baseUrl.startsWith("https://")).toBe(true);
      }
    }
  });

  it("constructor throws on a missing base URL", () => {
    expect(() => new LLMProvider("x", "X", "")).toThrow();
  });
});
