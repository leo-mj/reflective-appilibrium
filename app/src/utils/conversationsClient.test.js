// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { askInConversation } from "./conversationsClient.js";

const question = [{ role: "user", content: "why?" }];

/**
 * The backend's conversation endpoint depends on `get_llm_service`, which
 * raises 400 on a missing `x-base-url` *before* it considers any API key. So a
 * request without the BYOK headers cannot succeed in any deployment mode — and
 * the panel swallowed that into a generic error banner, which is why it went
 * unnoticed. These tests pin the headers onto the request itself.
 */
describe("conversationsClient", () => {
  let fetchMock;

  beforeEach(() => {
    sessionStorage.clear();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "hi", model: "gpt-4o" }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  function savedSettings() {
    sessionStorage.setItem(
      "llmSettings",
      JSON.stringify({
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
      })
    );
  }

  it("sends the BYOK headers", async () => {
    savedSettings();
    await askInConversation({ topic: "t" }, { text: "s" }, question);

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers["x-base-url"]).toBe("https://api.openai.com/v1");
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(headers["x-model"]).toBe("gpt-4o");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("still sends Content-Type when no key is saved", async () => {
    await askInConversation({ topic: "t" }, { text: "s" }, question);

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["x-base-url"]).toBeUndefined();
  });

  // The server keeps nothing, so the state, the suggestion and every earlier
  // turn have to travel with each question.
  it("sends the state, the suggestion and the whole conversation", async () => {
    const messages = [
      { role: "user", content: "why?" },
      { role: "assistant", content: "because", model: "gpt-4o" },
      { role: "user", content: "and then?" },
    ];
    await askInConversation({ topic: "t" }, { text: "s" }, messages);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/conversations$/);
    expect(body.state).toEqual({ topic: "t" });
    expect(body.suggestion).toEqual({ text: "s" });
    // Only role and content: the model name is the panel's, not the schema's.
    expect(body.messages).toEqual([
      { role: "user", content: "why?" },
      { role: "assistant", content: "because" },
      { role: "user", content: "and then?" },
    ]);
  });

  // The backend's answer to a keyless request is `400 Missing x-base-url
  // header`, which names a header the reader has never heard of. What it means
  // to them is that they have not set a key, so that is what the banner says —
  // and the status stays on the error for anything that wants to branch.
  it("turns the missing-header 400 into a key prompt", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"detail":"Missing x-base-url header"}',
    });
    await expect(askInConversation({ topic: "t" }, {}, question)).rejects.toThrow(
      /No API key configured/,
    );
  });

  it("keeps the status and the server's own wording on the error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"detail":"Missing x-base-url header"}',
    });
    await expect(askInConversation({ topic: "t" }, {}, question)).rejects.toMatchObject({
      status: 400,
      detail: "Missing x-base-url header",
    });
  });
});
