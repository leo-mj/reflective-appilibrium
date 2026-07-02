import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("BACKEND_ENABLED", () => {
  it("is false in demo", async () => {
    vi.stubEnv("VITE_APP_ENV", "demo");
    const { BACKEND_ENABLED } = await import("./config.js");
    expect(BACKEND_ENABLED).toBe(false);
  });

  it("is true in dev", async () => {
    vi.stubEnv("VITE_APP_ENV", "dev");
    const { BACKEND_ENABLED } = await import("./config.js");
    expect(BACKEND_ENABLED).toBe(true);
  });

  it("is true in backend mode", async () => {
    vi.stubEnv("VITE_APP_ENV", "backend");
    const { BACKEND_ENABLED } = await import("./config.js");
    expect(BACKEND_ENABLED).toBe(true);
  });
});

describe("LLM_ENABLED and BYOK_ENABLED", () => {
  it("equal BACKEND_ENABLED in all modes", async () => {
    for (const env of ["demo", "dev", "backend"]) {
      vi.resetModules();
      vi.stubEnv("VITE_APP_ENV", env);
      const { BACKEND_ENABLED, LLM_ENABLED, BYOK_ENABLED } = await import("./config.js");
      expect(LLM_ENABLED).toBe(BACKEND_ENABLED);
      expect(BYOK_ENABLED).toBe(BACKEND_ENABLED);
      vi.unstubAllEnvs();
    }
  });
});
