import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, showView, park, openMenu } from "./helpers.js";

/**
 * Demo mode, so the Theories tab serves the pre-set example suggestions rather
 * than calling out — the same arrangement assist.spec.js relies on, and what
 * makes this safe to run in CI without a key.
 *
 * The fixture is what carries the verification states here: the demo build has
 * no backend, so nothing is ever checked against Crossref at runtime, and the
 * three states would otherwise never be seen at all.
 */

const openTab = async (page) => {
  await showView(page, "Assist");
  await page.locator('button:text-is("Theories")').click();
  await park(page);
};

test.describe("Background theories", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await openTab(page);
  });

  test("asks for nothing until the button is pressed", async ({ page }) => {
    // The run button carries the disclosure that this sends the position to an
    // LLM, so merely opening the tab must fetch nothing. Checked on a reference,
    // which only a returned suggestion has.
    await expect(page.getByRole("button", { name: /Suggest/ })).toBeVisible();
    await expect(page.locator("text=/Parfit/")).toHaveCount(0);
  });

  test("shows each theory with its references and no relations", async ({ page }) => {
    await page.getByRole("button", { name: /Suggest/ }).click();
    await park(page);

    await expect(page.locator("text=/AI-generated/").first()).toBeVisible();
    await expect(page.locator("text=/Parfit/").first()).toBeVisible();
    // Which relations hold is the Relations tab's business; a theory arriving
    // pre-annotated would duplicate it and pre-empt the user's own reading.
    await expect(
      page.locator("text=/(supports|conflicts|undermines|depends) [JPT][0-9]/"),
    ).toHaveCount(0);
  });

  test("distinguishes a confirmed reference from one Crossref does not index", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Suggest/ }).click();
    await park(page);

    await expect(page.locator("a[href^='https://doi.org/']").first()).toBeVisible();
    // Worded as a fact about the index, never as suspicion: Crossref's coverage
    // of philosophy monographs is patchy, and flagging the canon as doubtful
    // would be worse than not checking at all.
    const unmatched = page.locator("text=/not found in Crossref/").first();
    await expect(unmatched).toBeVisible();
    await expect(unmatched).not.toContainText(/suspect|invented|fabricat/i);
  });

  test("accepting adds a T node that keeps its reference", async ({ page }) => {
    await page.getByRole("button", { name: /Suggest/ }).click();
    await park(page);
    await page.getByRole("button", { name: /Accept/i }).first().click();
    await park(page);

    // The node reaches the graph…
    await showView(page, "Analyze");
    await expect(
      page.locator("svg text").filter({ hasText: /^T\d+$/ }).first(),
    ).toBeVisible();

    // …and the reference stays visible on its card, which is where it lives for
    // most of the time the user spends with it.
    await expect(page.locator("text=/Sources \\(AI-generated\\)/").first()).toBeVisible();
  });

  test("the exported document carries the references and says what they are", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /Suggest/ }).click();
    await park(page);
    await page.getByRole("button", { name: /Accept/i }).first().click();
    await park(page);

    await openMenu(page);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export/ }).click();
    const download = await downloadPromise;
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "re-e2e-")),
      "export.md",
    );
    await download.saveAs(file);
    const markdown = fs.readFileSync(file, "utf8");

    // The label travels with the data: an exported document is the artefact
    // someone might go on to cite *from*, so a caveat that lived only in the UI
    // would evaporate at the moment it started to matter.
    expect(markdown).toContain("*Sources (AI-generated, unverified):*");
    expect(markdown).toMatch(/Parfit, D\. \(1984\)\. \*Reasons and persons\*/);

    // And it round-trips: the reference is in the machine-readable block too.
    const fenced = markdown.match(/```re-state\n([\s\S]*?)```/);
    const state = JSON.parse(fenced[1]);
    const cited = state.elements.find((e) => e.sources?.length);
    expect(cited.type).toBe("theory");
    expect(cited.sources[0].title).toBe("Reasons and persons");
    // The verdict is response-only — it goes stale as Crossref indexes more,
    // where the DOI it yielded does not.
    expect(cited.sources[0]).not.toHaveProperty("verification");
    expect(cited.sources[0].doi).toBeTruthy();
  });

  test("the guided workflow reaches this tab third", async ({ page }) => {
    // Theories run after the principles they have to bear on and before the two
    // phases that connect what is on the board — an argument drawn while the
    // theories are still missing is one the user has to draw again.
    await page.locator('button:text-is("Judgments")').click();
    await page.getByRole("button", { name: /Start Workflow/ }).click();
    await park(page);

    for (const step of ["Suggest Principles", "Suggest Theories"]) {
      await page
        .getByRole("button", { name: new RegExp(`Workflow Step: ${step}`) })
        .click();
      await park(page);
    }

    await expect(
      page.locator("text=/Suggest Background Theories/").first(),
    ).toBeVisible();
    // And it leaves for the arguments phase rather than looping back.
    await expect(
      page.getByRole("button", { name: /Workflow Step: Detect Arguments/ }),
    ).toBeVisible();
  });
});
