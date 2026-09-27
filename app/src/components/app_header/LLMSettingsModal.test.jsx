// @vitest-environment jsdom
//
// The demo build shows this modal so visitors can see what configuring a
// provider involves, but there is no backend to relay a key to. Anything that
// would reach the network, or bank a key for a request that cannot be made,
// has to be inert — and visibly so, or the form is a trap.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";

const flags = vi.hoisted(() => ({ byok: false }));
vi.mock("../../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  get BYOK_ENABLED() {
    return flags.byok;
  },
}));

import { LLMSettingsModal } from "./LLMSettingsModal.jsx";
import { useLLMSettings } from "../../utils/llmKey.js";
import { getLLMHeaders } from "../../utils/openaiClient.js";
import { tooltipText } from "../tooltipTestUtils.js";

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ base_urls: [] }) }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  flags.byok = false;
});

const open = () => render(<LLMSettingsModal open onClose={() => {}} />);
const button = (label) =>
  [...document.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label,
  );
const keyField = () => document.querySelector('input[type="password"]');

describe("in the demo build", () => {
  it("says so, rather than letting the form look live", () => {
    open();
    expect(screen.getByText(/Demo only/)).toBeTruthy();
    expect(document.body.textContent).toContain("no key can be sent");
  });

  it("shows the API key field but does not accept a key", () => {
    open();
    expect(keyField()).toBeTruthy();
    expect(keyField().disabled).toBe(true);
  });

  it("disables testing and saving, with the reason on hover", () => {
    open();
    for (const label of ["Test connection", "Save"]) {
      expect(button(label).disabled, label).toBe(true);
      expect(tooltipText(button(label)), label).toContain("demo");
    }
  });

  it("makes no claim about where a key goes, since none can be entered", () => {
    open();
    expect(document.body.textContent).not.toContain("not saved permanently");
  });

  it("asks the backend for nothing on open", () => {
    open();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("banks no key, since Save cannot be reached", () => {
    open();
    fireEvent.click(button("Save"));
    expect(sessionStorage.getItem("llmSettings")).toBeNull();
  });
});

describe("when BYOK is available", () => {
  beforeEach(() => {
    flags.byok = true;
  });

  it("drops the demo notice", () => {
    open();
    expect(screen.queryByText(/Demo only/)).toBeNull();
  });

  it("accepts a key", () => {
    open();
    expect(keyField().disabled).toBe(false);
    fireEvent.change(keyField(), { target: { value: "sk-test" } });
    expect(keyField().value).toBe("sk-test");
  });

  it("allows a connection test", () => {
    open();
    expect(button("Test connection").disabled).toBe(false);
  });

  it("says, beside the key, how long it is kept and where it goes", () => {
    open();
    const t = document.body.textContent;
    // Not "forgotten when it closes": a reopened tab brings sessionStorage back.
    expect(t).toContain("not saved permanently");
    expect(t).toContain("reopening a closed tab");
    expect(t).toContain("does not store or log it");
    expect(t).toContain("spending limit");
  });

  it("looks up which providers the server already has keys for", () => {
    open();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/llm/configured-providers");
  });
});

// The model list is the provider's, not the app's: no default is picked for a
// key the app does not pay for, and the suggestions are what that key can use.
describe("choosing a model", () => {
  beforeEach(() => {
    flags.byok = true;
    fetchMock.mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            String(url).includes("/api/llm/models")
              ? { models: ["newest-model", "older-model"] }
              : String(url).includes("/api/llm/test")
                ? { model: "newest-model" }
                : { base_urls: [] },
          ),
      }),
    );
  });

  const modelField = () => document.querySelector("input[list]");
  const suggestions = () =>
    [...document.querySelectorAll("#llm-model-suggestions option")].map((o) => o.value);

  it("starts with no model chosen and nothing suggested", () => {
    open();
    expect(modelField().value).toBe("");
    expect(suggestions()).toEqual([]);
  });

  it("lists the key's models on a test, and asks for a choice before saving", async () => {
    open();
    fireEvent.change(keyField(), { target: { value: "sk-live" } });
    fireEvent.click(button("Test connection"));
    await waitFor(() =>
      expect(suggestions()).toEqual(["newest-model", "older-model"]),
    );
    expect(document.body.textContent).toContain("Key accepted");
    expect(button("Save").disabled).toBe(true);
    const listCall = fetchMock.mock.calls.find(([u]) => u.includes("/api/llm/models"));
    expect(listCall[1].headers["x-api-key"]).toBe("sk-live");
  });

  it("lists them on opening when a key is already saved for the provider", async () => {
    sessionStorage.setItem(
      "llmSettings",
      JSON.stringify({ apiKey: "sk-saved", baseUrl: "https://api.openai.com/v1", model: "older-model" }),
    );
    open();
    expect(modelField().value).toBe("older-model");
    await waitFor(() => expect(suggestions()).toContain("newest-model"));
  });

  it("keeps the saved key when only the model changes", async () => {
    sessionStorage.setItem(
      "llmSettings",
      JSON.stringify({ apiKey: "sk-saved", baseUrl: "https://api.openai.com/v1", model: "older-model" }),
    );
    open();
    fireEvent.change(modelField(), { target: { value: "newest-model" } });
    fireEvent.click(button("Test connection"));
    await waitFor(() => expect(button("Save").disabled).toBe(false));
    fireEvent.click(button("Save"));
    expect(JSON.parse(sessionStorage.getItem("llmSettings"))).toMatchObject({
      apiKey: "sk-saved",
      model: "newest-model",
    });
  });
});

// What a save has to reach. The header names the model in its menu and every
// assist tab decides from the key whether to show live suggestions or samples,
// and none of them are anywhere near this modal in the tree — so a save that
// only wrote sessionStorage would leave the app disagreeing with itself until
// something unrelated happened to re-render it. sessionStorage raises no event
// for a write from the page that made it, which is what utils/llmKey.js is for.
describe("a key saved here reaches the rest of the app", () => {
  /** Stands in for the header menu label and the assist tabs' key gate. */
  function Subscriber() {
    const settings = useLLMSettings();
    return <div data-testid="probe">{settings?.model ?? "no key"}</div>;
  }

  const probe = () => screen.getByTestId("probe").textContent;

  beforeEach(() => {
    flags.byok = true;
    fetchMock.mockImplementation((url) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            String(url).includes("/api/llm/test")
              ? { model: "the-tested-model" }
              : { base_urls: [] },
          ),
      }),
    );
  });

  /** Save is gated on a passing connection test, so one has to run first. */
  async function testAndSave(model) {
    fireEvent.change(document.querySelector("input[list]"), {
      target: { value: model },
    });
    fireEvent.change(keyField(), { target: { value: "sk-live" } });
    fireEvent.click(button("Test connection"));
    await waitFor(() => expect(button("Save").disabled).toBe(false));
    fireEvent.click(button("Save"));
  }

  it("updates a subscriber with no reload", async () => {
    render(
      <>
        <LLMSettingsModal open onClose={() => {}} />
        <Subscriber />
      </>,
    );
    expect(probe()).toBe("no key");

    await testAndSave("gpt-4o-mini");
    await waitFor(() => expect(probe()).toBe("gpt-4o-mini"));
  });

  it("updates a subscriber again when the key is changed", async () => {
    render(
      <>
        <LLMSettingsModal open onClose={() => {}} />
        <Subscriber />
      </>,
    );
    await testAndSave("gpt-4o-mini");
    await waitFor(() => expect(probe()).toBe("gpt-4o-mini"));

    // The second save is the one that matters: the settings already exist, so
    // nothing about this write is the transition from absent to present.
    await testAndSave("claude-opus-5");
    await waitFor(() => expect(probe()).toBe("claude-opus-5"));
  });

  it("puts the new key on the next request's headers", async () => {
    render(<LLMSettingsModal open onClose={() => {}} />);
    expect(getLLMHeaders()).toEqual({});

    await testAndSave("gpt-4o-mini");
    await waitFor(() => expect(getLLMHeaders()["x-api-key"]).toBe("sk-live"));
    expect(getLLMHeaders()["x-model"]).toBe("gpt-4o-mini");
  });

  it("tells a subscriber the key is gone when it is cleared", async () => {
    render(
      <>
        <LLMSettingsModal open onClose={() => {}} />
        <Subscriber />
      </>,
    );
    await testAndSave("gpt-4o-mini");
    await waitFor(() => expect(probe()).toBe("gpt-4o-mini"));

    fireEvent.click(button("Clear"));
    await waitFor(() => expect(probe()).toBe("no key"));
    expect(getLLMHeaders()).toEqual({});
  });
});
