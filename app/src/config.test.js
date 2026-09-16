import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

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

/**
 * `.env.backend` is tracked and ships a placeholder backend URL. A build that
 * picks it up produces a bundle whose every request throws a `TypeError` from
 * somewhere deep in a component — so config.js says so at load instead. These
 * pin that it fires when it should and stays quiet when it should not.
 *
 * config.js reads `import.meta.env` at module scope, so each case imports it
 * again against a fresh registry — the `beforeEach` above does the reset.
 */
describe("the backend-URL placeholder guard", () => {
  async function loadConfig({ appEnv, backendUrl }) {
    vi.stubEnv("VITE_APP_ENV", appEnv);
    vi.stubEnv("VITE_BACKEND_URL", backendUrl);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("./config.js");
    return error;
  }

  it("complains when a backend build ships the placeholder", async () => {
    const error = await loadConfig({
      appEnv: "backend",
      backendUrl: "https://<deployed-backend-url>",
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain("VITE_BACKEND_URL");
  });

  it("names the offending value, so the fix is obvious", async () => {
    const error = await loadConfig({
      appEnv: "backend",
      backendUrl: "https://<deployed-backend-url>",
    });
    expect(error.mock.calls[0][0]).toContain("<deployed-backend-url>");
  });

  it("stays quiet for a real URL", async () => {
    const error = await loadConfig({
      appEnv: "backend",
      backendUrl: "https://re-backend.example.com",
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("stays quiet in dev, where the URL falls back to localhost", async () => {
    const error = await loadConfig({ appEnv: "dev", backendUrl: "" });
    expect(error).not.toHaveBeenCalled();
  });

  // The demo build reads no backend URL at all, so a placeholder left in the
  // environment there is not a fault worth a console error.
  it("stays quiet in the demo build even with a placeholder set", async () => {
    const error = await loadConfig({
      appEnv: "demo",
      backendUrl: "https://<deployed-backend-url>",
    });
    expect(error).not.toHaveBeenCalled();
  });
});
