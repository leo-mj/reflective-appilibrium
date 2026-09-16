// @vitest-environment jsdom
//
// The keyless visitor, end to end through GraphPanel's own wiring.
//
// Tab-level tests can only pin what a tab does with the props it is handed;
// what matters here is which props GraphPanel derives, and that is where this
// went wrong once already. The tabs used to be handed `useDummyAssist` as
// `useDummy` and a separate `suggestionsAreSample` for display, so a visitor
// with no key would have been shown "these are samples" while the tab fired a
// real request — which `get_llm_service` rejects with a 400 before it looks at
// anything. The assertion that no fetch happens is the point of this file.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

const flags = vi.hoisted(() => ({ llm: true }));
vi.mock("../config.js", async (importOriginal) => ({
  ...(await importOriginal()),
  get LLM_ENABLED() {
    return flags.llm;
  },
  get APP_ENV() {
    return "backend";
  },
}));

import { GraphPanel } from "./GraphPanel.jsx";
import { notifyLLMKeyChanged } from "../utils/llmKey.js";

let fetchMock;

beforeEach(() => {
  flags.llm = true;
  sessionStorage.clear();
  notifyLLMKeyChanged();
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ model: "test-model", suggestions: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  notifyLLMKeyChanged();
});

const aState = () => ({
  topic: "Obligations to future generations",
  round: 2,
  elements: [
    {
      id: "J1",
      type: "judgment",
      status: "active",
      confidence: 0.67,
      text: "A judgment",
      addedRound: 1,
    },
  ],
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
});

/**
 * The assist tabs are `lazy()` behind a `null` Suspense fallback, so a panel
 * that has not finished loading renders as an empty div — which every
 * `queryByText(...).toBeNull()` assertion below would pass against for entirely
 * the wrong reason. Hence waiting for the tab's own run button, and asserting
 * it is really there before handing back.
 */
async function renderPanel(props = {}) {
  await act(async () => {
    render(
      <GraphPanel
        tab="elicitJudgments"
        state={aState()}
        positions={{}}
        hiddenLegendKeys={[]}
        weights={{}}
        isWide
        {...props}
      />,
    );
  });
  // One more flush: the first settles the dynamic import, the second the render
  // of what it resolved to.
  await act(async () => {});
  await screen.findByText(/Elicit Judgments/i);
}

/**
 * The URLs of requests that would spend an API key.
 *
 * Not "every request": the assist panel also asks `/simulate_rethon/quick_score`
 * for the score badges on its suggestion cards, which is analytic, needs no key,
 * and has its own rate bucket on the server precisely because it is fired this
 * freely. Asserting on the whole call list would fail on that and say nothing
 * about the thing under test.
 */
function llmCalls() {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => !url.includes("/simulate_rethon/"));
}

function saveKey() {
  sessionStorage.setItem(
    "llmSettings",
    JSON.stringify({
      apiKey: "sk-live",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    }),
  );
  notifyLLMKeyChanged();
}

describe("an assist tab with no API key saved", () => {
  it("says the suggestions on screen are samples", async () => {
    await renderPanel();
    expect(screen.getByText(/These are sample suggestions/)).toBeTruthy();
  });

  it("offers a way to supply one", async () => {
    await renderPanel();
    expect(screen.getByRole("button", { name: /Add a key/ })).toBeTruthy();
  });

  // The whole point. A keyless visitor pressing a suggest button, or arriving on
  // a tab that auto-fetches, must be served the fixture rather than a request
  // that can only 400.
  it("fires no LLM request when the workflow auto-fetches", async () => {
    await renderPanel({ workflowPhase: "elicitJudgments" });
    expect(llmCalls()).toEqual([]);
  });
});

describe("once a key is saved", () => {
  it("drops the notice", async () => {
    saveKey();
    await renderPanel();
    expect(screen.queryByText(/These are sample suggestions/)).toBeNull();
  });

  it("goes to the network on an auto-fetch", async () => {
    saveKey();
    await renderPanel({ workflowPhase: "elicitJudgments" });
    expect(llmCalls()).not.toEqual([]);
  });

  // No reload: the panel is already mounted when the key arrives, which is what
  // the store in utils/llmKey.js exists for.
  it("switches a mounted panel from samples to live without remounting", async () => {
    await renderPanel();
    expect(screen.getByText(/These are sample suggestions/)).toBeTruthy();

    await act(async () => saveKey());
    expect(screen.queryByText(/These are sample suggestions/)).toBeNull();
  });
});

describe("a build with no LLM at all", () => {
  it("shows no key notice, since there is nothing a key would buy", async () => {
    flags.llm = false;
    await renderPanel();
    expect(screen.queryByText(/These are sample suggestions/)).toBeNull();
  });
});
