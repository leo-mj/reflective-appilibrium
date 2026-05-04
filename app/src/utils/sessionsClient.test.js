import { vi, describe, it, expect, afterEach } from "vitest";
import { fetchSessions, loadSession, deleteSession, saveSession } from "./sessionsClient.js";

afterEach(() => vi.unstubAllGlobals());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(data) {
  return { ok: true, json: () => Promise.resolve(data), text: () => Promise.resolve("") };
}

function err(status, body = "Something went wrong") {
  return { ok: false, status, text: () => Promise.resolve(body) };
}

// ─── fetchSessions ────────────────────────────────────────────────────────────

describe("fetchSessions", () => {
  it("calls GET /api/sessions and returns parsed JSON", async () => {
    const sessions = [{ session_id: "s1", topic: "Ethics", round: 3, saved_at: "2024-01-01T00:00:00Z" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(sessions)));

    const result = await fetchSessions();

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/sessions"));
    expect(result).toEqual(sessions);
  });

  it("uses GET (no explicit method option)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok([])));
    await fetchSessions();
    const [, options] = fetch.mock.calls[0];
    expect(options).toBeUndefined();
  });

  it("throws 'Backend error <status>: <body>' on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(err(500, "Internal error")));
    await expect(fetchSessions()).rejects.toThrow("Backend error 500: Internal error");
  });

  it("includes the exact error body in the thrown message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(err(404, "Not found")));
    await expect(fetchSessions()).rejects.toThrow("Backend error 404: Not found");
  });
});

// ─── loadSession ──────────────────────────────────────────────────────────────

describe("loadSession", () => {
  it("calls GET /api/sessions/:id and returns parsed JSON", async () => {
    const state = { topic: "Ethics", round: 2, elements: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(state)));

    const result = await loadSession("abc-123");

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/sessions/abc-123"));
    expect(result).toEqual(state);
  });

  it("URL-encodes the session id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({})));
    await loadSession("session with spaces/and/slashes");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("session%20with%20spaces%2Fand%2Fslashes"),
    );
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(err(404, "Session not found")));
    await expect(loadSession("missing")).rejects.toThrow("Backend error 404: Session not found");
  });
});

// ─── deleteSession ────────────────────────────────────────────────────────────

describe("deleteSession", () => {
  it("calls DELETE /api/sessions/:id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await deleteSession("abc-123");

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sessions/abc-123"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("URL-encodes the session id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await deleteSession("id with spaces");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("id%20with%20spaces"),
      expect.anything(),
    );
  });

  it("resolves to undefined on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await expect(deleteSession("abc-123")).resolves.toBeUndefined();
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(err(403, "Forbidden")));
    await expect(deleteSession("abc-123")).rejects.toThrow("Backend error 403: Forbidden");
  });
});

// ─── saveSession ──────────────────────────────────────────────────────────────

describe("saveSession", () => {
  const state = { topic: "Ethics", round: 2, elements: [], relations: [], coherence: {}, log: [] };
  const savedMeta = { session_id: "new-id", topic: "Ethics", round: 2, saved_at: "2024-01-01T00:00:00Z" };

  it("calls POST /api/sessions and returns session metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(savedMeta)));

    const result = await saveSession(state);

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sessions"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(savedMeta);
  });

  it("sends Content-Type: application/json header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(savedMeta)));
    await saveSession(state);
    const [, options] = fetch.mock.calls[0];
    expect(options.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("sends the full state serialised as JSON in the request body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(savedMeta)));
    await saveSession(state);
    const [, options] = fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual(state);
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(err(422, "Validation error")));
    await expect(saveSession(state)).rejects.toThrow("Backend error 422: Validation error");
  });
});
