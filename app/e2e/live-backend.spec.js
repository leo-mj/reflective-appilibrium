import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, park } from "./helpers.js";

/**
 * The SPA against the real FastAPI server — the one place the two meet for
 * real. Everywhere else one side of the line is a fake: Vitest stubs the
 * network, the `backend` project answers with `page.route`, pytest has no
 * browser. So a field renamed in a request, or a response shaped differently,
 * would pass every test but these.
 *
 * Only what needs no key and calls no third party: the rethon scoring and
 * simulation routes. `playwright.config.js` starts the server with every
 * behaviour-deciding setting pinned, and runs this file under `live-backend`
 * alone.
 *
 * Each test holds the request to three things: it reached the server and was
 * answered 200, the answer has the shape the client reads, and the reader
 * sees the result.
 */

const route = (path) => (res) =>
  res.url().includes(`/api/simulate_rethon/${path}`) &&
  res.request().method() === "POST";

test.describe("Against the real backend", () => {
  test("scores what withdrawing each element would change", async ({ page }) => {
    await gotoHome(page);
    // Fired as the process loads, so listened for before it does.
    const scored = page.waitForResponse(route("score_changes"), {
      timeout: 60_000,
    });
    await loadSample(page);
    const res = await scored;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.withdrawal_deltas)).toBe(true);
    expect(body.withdrawal_deltas.length).toBeGreaterThan(0);
    for (const d of body.withdrawal_deltas) {
      expect(typeof d.element_id).toBe("string");
      expect(typeof d.delta_account).toBe("number");
    }

    // And the text panel shows it on the element cards.
    await park(page);
    const panel = page.locator('[data-tutorial="text-panel"]');
    await expect(panel.getByText("If withdrawn").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("runs the simulation to an equilibrium", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await page.getByRole("button", { name: "Simulate", exact: true }).click();

    const simulated = page.waitForResponse(route("simulate"), {
      timeout: 120_000,
    });
    await page.getByRole("button", { name: /Equilibrate/ }).click();
    const res = await simulated;
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Exactly what SimulateRethonTab reads off it: the evolution it steps
    // through, with a label and a score per step, and whether it finished.
    const state = body.translated_re_state;
    expect(Array.isArray(body.translated_arguments)).toBe(true);
    expect(typeof state.finished).toBe("boolean");
    expect(state.evolution.length).toBeGreaterThan(0);
    expect(state.step_types).toHaveLength(state.evolution.length);
    expect(state.scores).toHaveLength(state.evolution.length);

    await expect(page.getByText(/Equilibrium (reached|not reached yet)/)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/Retained · \d+/)).toBeVisible();
  });

  test("scores the process round by round, for History", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await page.locator('[data-tutorial="meta-analyze"]').click();
    await page.locator('[data-tutorial="tab-history"]').click();

    const scored = page.waitForResponse(route("score_per_round"), {
      timeout: 120_000,
    });
    await page.getByRole("button", { name: "Calculate Z-scores per round" }).click();
    const res = await scored;
    // A refusal says why: this is how a 422 over an empty round-0 projection
    // — History scoring what it was showing rather than the whole process —
    // was found.
    expect(res.status(), JSON.stringify(await res.json()).slice(0, 1500)).toBe(200);
    const body = await res.json();
    // A score for every round of the process, not only those played so far.
    expect(body.round_scores.map((r) => r.round)).toEqual(
      Array.from({ length: 8 }, (_, i) => i + 1),
    );

    // The button gives way to the chart it draws from the answer.
    await expect(
      page.getByRole("button", { name: "Calculate Z-scores per round" }),
    ).toHaveCount(0, { timeout: 60_000 });
  });
});
