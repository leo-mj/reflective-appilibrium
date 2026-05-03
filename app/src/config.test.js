import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("LLM_ENABLED", () => {
  it("is false in prod without BYOK", async () => {
    vi.stubEnv("VITE_APP_ENV", "prod");
    vi.stubEnv("VITE_BYOK_ENABLED", "false");
    const { LLM_ENABLED } = await import("./config.js");
    expect(LLM_ENABLED).toBe(false);
  });

  it("is true in dev", async () => {
    vi.stubEnv("VITE_APP_ENV", "dev");
    const { LLM_ENABLED } = await import("./config.js");
    expect(LLM_ENABLED).toBe(true);
  });

  it("is true in prod when BYOK is enabled", async () => {
    vi.stubEnv("VITE_APP_ENV", "prod");
    vi.stubEnv("VITE_BYOK_ENABLED", "true");
    const { LLM_ENABLED } = await import("./config.js");
    expect(LLM_ENABLED).toBe(true);
  });
});

describe("BACKEND_ENABLED", () => {
  it("is false in prod without BYOK", async () => {
    vi.stubEnv("VITE_APP_ENV", "prod");
    vi.stubEnv("VITE_BYOK_ENABLED", "false");
    const { BACKEND_ENABLED } = await import("./config.js");
    expect(BACKEND_ENABLED).toBe(false);
  });

  it("is true in dev", async () => {
    vi.stubEnv("VITE_APP_ENV", "dev");
    const { BACKEND_ENABLED } = await import("./config.js");
    expect(BACKEND_ENABLED).toBe(true);
  });
});
