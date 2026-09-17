import { test, expect } from "@playwright/test";
import { FAKE_BACKEND } from "../playwright.config.js";
import { gotoHome, loadSample, showView, park } from "./helpers.js";

/**
 * The Discuss panel on a suggestion, in the backend build.
 *
 * Every other spec runs the demo, where suggestions are samples and Discuss is
 * not offered at all. This one needs a build with a backend and a saved key, so
 * it runs under the `backend` project, and the backend is this file: every
 * request to it is answered by `page.route`, and anything not answered here
 * fails rather than reaching a real server or provider.
 *
 * The server keeps nothing between questions, so what these pin is what the
 * browser sends: the state, the suggestion and the whole conversation, every
 * time.
 */

const QUESTION = "Should we discount harms that fall centuries from now?";
const JUDGMENT = "Harms to people three centuries from now count as much as harms today.";

const SETTINGS = {
  apiKey: "sk-e2e",
  baseUrl: "https://api.openai.com/v1",
  model: "e2e-model",
};

/**
 * Stand in for the backend. Returns the bodies sent to /api/conversations, in
 * order, so a test can read what each question carried.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ conversation?: (body: any) => { status: number, json: any } }} [opts]
 */
async function fakeBackend(page, { conversation } = {}) {
  const asked = [];
  await page.route(`${FAKE_BACKEND}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();

    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors() });

    if (pathname === "/api/health") {
      return json(route, 200, { status: "ok", sessions: false, max_elements: 0 });
    }
    if (pathname === "/api/judgments/elicit") {
      return json(route, 200, {
        model: "e2e-model",
        suggestions: [{ question: QUESTION, judgments: [{ text: JUDGMENT, confidence: 0.7 }] }],
      });
    }
    if (pathname === "/api/conversations") {
      const body = route.request().postDataJSON();
      asked.push(body);
      if (conversation) {
        const { status, json: payload } = conversation(body);
        return json(route, status, payload);
      }
      const question = body.messages.at(-1).content;
      return json(route, 200, { reply: `Reply to: ${question}`, model: "e2e-model" });
    }
    // Scores, providers, sessions: nothing this spec is about. A failure is
    // what the app already tolerates from each of them.
    return json(route, 503, { detail: "not part of this test" });
  });
  return asked;
}

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "*",
  };
}

function json(route, status, body) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: cors(),
    body: JSON.stringify(body),
  });
}

/** Load the sample and start the workflow, which opens on Elicit Judgments. */
async function openJudgmentSuggestions(page) {
  await gotoHome(page);
  await loadSample(page);
  await showView(page, "Assist");
  await page.getByRole("button", { name: /Start Workflow/ }).click();
  await park(page);
  await expect(page.getByText(JUDGMENT)).toBeVisible();
}

async function openDiscuss(page) {
  await page.getByText(JUDGMENT).hover();
  await page.getByRole("button", { name: "Discuss with AI" }).first().click();
  await expect(askField(page)).toBeVisible();
}

const askField = (page) => page.getByPlaceholder("Ask about this suggestion…");

async function ask(page, question) {
  await askField(page).fill(question);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
}

test.describe("Discuss, with a key saved", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((settings) => {
      sessionStorage.setItem("llmSettings", JSON.stringify(settings));
    }, SETTINGS);
  });

  test("a question gets a reply", async ({ page }) => {
    const asked = await fakeBackend(page);
    await openJudgmentSuggestions(page);
    await openDiscuss(page);

    await ask(page, "Why a pure time preference?");
    await expect(page.getByText("Reply to: Why a pure time preference?")).toBeVisible();
    await expect(askField(page)).toHaveValue("");

    expect(asked).toHaveLength(1);
    expect(asked[0].messages).toEqual([
      { role: "user", content: "Why a pure time preference?" },
    ]);
    expect(asked[0].suggestion).toMatchObject({ question: QUESTION, text: JUDGMENT });
    expect(asked[0].state.elements.length).toBeGreaterThan(0);
  });

  test("a follow-up carries the whole conversation", async ({ page }) => {
    const asked = await fakeBackend(page);
    await openJudgmentSuggestions(page);
    await openDiscuss(page);

    await ask(page, "First question");
    await expect(page.getByText("Reply to: First question")).toBeVisible();
    await ask(page, "Second question");
    await expect(page.getByText("Reply to: Second question")).toBeVisible();

    // The server has nothing from the first request to go on — the second has
    // to carry it, and carry the state again.
    expect(asked).toHaveLength(2);
    expect(asked[1].messages).toEqual([
      { role: "user", content: "First question" },
      { role: "assistant", content: "Reply to: First question" },
      { role: "user", content: "Second question" },
    ]);
    expect(asked[1].state).toEqual(asked[0].state);
    expect(asked[1].suggestion).toEqual(asked[0].suggestion);
  });

  test("the request carries the saved key to the backend", async ({ page }) => {
    await fakeBackend(page);
    const request = page.waitForRequest(`${FAKE_BACKEND}/api/conversations`);
    await openJudgmentSuggestions(page);
    await openDiscuss(page);
    await ask(page, "Anything");

    const headers = (await request).headers();
    expect(headers["x-api-key"]).toBe(SETTINGS.apiKey);
    expect(headers["x-base-url"]).toBe(SETTINGS.baseUrl);
    expect(headers["x-model"]).toBe(SETTINGS.model);
  });

  test("a failed question is shown and not resent with the next", async ({ page }) => {
    let fail = true;
    const asked = await fakeBackend(page, {
      conversation: (body) => {
        if (fail) {
          fail = false;
          return { status: 429, json: { detail: "Rate limit exceeded" } };
        }
        return {
          status: 200,
          json: { reply: `Reply to: ${body.messages.at(-1).content}`, model: "e2e-model" },
        };
      },
    });
    await openJudgmentSuggestions(page);
    await openDiscuss(page);

    await ask(page, "Lost question");
    await expect(page.getByText(/Too many requests/)).toBeVisible();
    await expect(page.getByText("Lost question")).toHaveCount(0);

    await ask(page, "Next question");
    await expect(page.getByText("Reply to: Next question")).toBeVisible();
    expect(asked.at(-1).messages).toEqual([{ role: "user", content: "Next question" }]);
  });
});

test("without a key, suggestions are samples and Discuss is not offered", async ({ page }) => {
  await fakeBackend(page);
  await gotoHome(page);
  await loadSample(page);
  await showView(page, "Assist");
  await page.getByRole("button", { name: /Start Workflow/ }).click();
  await park(page);

  await expect(page.locator("text=/AI-generated by/").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Discuss with AI" })).toHaveCount(0);
});
