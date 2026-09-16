// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startConversation, sendConversationMessage } from "./conversationsClient.js";

/**
 * The backend's conversation endpoints both depend on `get_llm_service`, which
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
      json: async () => ({ session_id: "s1", reply: "hi", model: "gpt-4o" }),
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

  it("sends the BYOK headers when starting a conversation", async () => {
    savedSettings();
    await startConversation({ topic: "t" }, { text: "s" }, "why?");

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers["x-base-url"]).toBe("https://api.openai.com/v1");
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(headers["x-model"]).toBe("gpt-4o");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends the BYOK headers on a follow-up message", async () => {
    savedSettings();
    await sendConversationMessage("s1", "and then?");

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers["x-base-url"]).toBe("https://api.openai.com/v1");
    expect(headers["x-api-key"]).toBe("sk-test");
  });

  it("still sends Content-Type when no key is saved", async () => {
    await startConversation({ topic: "t" }, { text: "s" }, "why?");

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["x-base-url"]).toBeUndefined();
  });

  it("surfaces a backend error rather than resolving", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"detail":"Missing x-base-url header"}',
    });
    await expect(startConversation({ topic: "t" }, {}, "why?")).rejects.toThrow(/400/);
  });
});
