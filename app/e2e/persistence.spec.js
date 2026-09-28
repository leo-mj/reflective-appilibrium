import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  gotoHome,
  startFresh,
  addElement,
  expectCounts,
  exportDownload,
  loadSample,
  openMenu,
  park,
} from "./helpers.js";

test.describe("Session draft", () => {
  test("a reload offers the work back, and Resume restores it", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Persistence check");
    await addElement(page, "judgment", "A judgment that should survive a reload.");

    await page.reload({ waitUntil: "domcontentloaded" });
    await park(page);

    // The state lives in React only, so a reload lands back on the home page
    // with the draft offered rather than straight back in the editor.
    await expect(page.getByRole("heading", { name: "Continue where you left off" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Persistence check");

    await page.locator('button:text-is("Resume")').click();
    await park(page);
    await expect(page.locator("body")).toContainText("should survive a reload");
    await expectCounts(page, { J: 1 });
  });

  test("Discard drops the draft", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Discard me");
    await addElement(page, "judgment", "This judgment is about to be discarded.");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('button:text-is("Discard")').click();
    await park(page);

    await expect(page.getByRole("heading", { name: "Continue where you left off" })).toBeHidden();
  });

  test("starting another process asks before replacing the draft", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "First process");
    await addElement(page, "judgment", "A judgment in the first process.");

    await page.reload({ waitUntil: "domcontentloaded" });
    await park(page);
    const topic = page.getByLabel("Topic of your reflective equilibrium process");
    await topic.fill("Second process");
    await page.getByRole("button", { name: "Start", exact: true }).click();

    // One draft slot: the new process's first autosave would write over it.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("First process");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    // Cancel changed nothing, so a reload still offers the first process.
    await page.reload({ waitUntil: "domcontentloaded" });
    await park(page);
    await expect(page.getByRole("heading", { name: "Continue where you left off" })).toBeVisible();
    await expect(page.locator("body")).toContainText("First process");
  });

  // The sample is not autosaved — it would take the one draft slot — so what the
  // reader is owed instead is being told, before a reload takes the edits.
  test("edits to the sample are not kept, and the app says so", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    const notice = page.getByRole("status").filter({ hasText: "Changes to the demo are not saved" });
    await expect(notice).toBeHidden();

    await addElement(page, "judgment", "A judgment added to the demo.");
    await expect(notice).toBeVisible();

    // Its Export is the ☰ one, a press away.
    await notice.getByRole("button", { name: "Export" }).click();
    await expect(page.getByRole("dialog")).toContainText("Choose what goes into the Markdown file.");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    // As the notice says: a reload keeps nothing, and offers nothing back.
    await page.waitForTimeout(1_200); // past the autosave's debounce, were there one
    await page.reload({ waitUntil: "domcontentloaded" });
    await park(page);
    await expect(page.getByRole("heading", { name: "Continue where you left off" })).toBeHidden();
  });

  // Said once: a line kept up over every later edit stops being read.
  test("the notice goes with the next edit, and stays gone", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    const notice = page.getByRole("status").filter({ hasText: "Changes to the demo are not saved" });
    await addElement(page, "judgment", "The edit that brings the notice up.");
    await expect(notice).toBeVisible();

    await addElement(page, "judgment", "The edit that puts it away.");
    await expect(notice).toBeHidden();
    await addElement(page, "judgment", "And one that does not bring it back.");
    await expect(notice).toBeHidden();
  });

  test("the notice can be closed, and stays closed", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    const notice = page.getByRole("status").filter({ hasText: "Changes to the demo are not saved" });
    await addElement(page, "judgment", "The edit that brings the notice up.");
    await notice.getByRole("button", { name: "Close notice" }).click();
    await expect(notice).toBeHidden();

    await addElement(page, "judgment", "A later edit.");
    await expect(notice).toBeHidden();
  });
});

test.describe("Export and import", () => {
  test("a process survives an export/import round trip", async ({ page }) => {
    await gotoHome(page);
    await startFresh(page, "Export round trip");
    await addElement(page, "judgment", "Judgment one for export.");
    await addElement(page, "principle", "Principle one for export.");

    const download = await exportDownload(page);

    // Markdown, not JSON: a human-readable report with the machine-readable
    // state in a fenced re-state block at the end.
    expect(download.suggestedFilename()).toMatch(/\.md$/);
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "re-e2e-")), "export.md");
    await download.saveAs(file);
    const markdown = fs.readFileSync(file, "utf8");

    const fenced = markdown.match(/```re-state\n([\s\S]*?)```/);
    expect(fenced, "export must carry a re-state block").not.toBeNull();
    const state = JSON.parse(fenced[1]);
    expect(state.topic).toBe("Export round trip");
    expect(state.elements.map((e) => e.type).sort()).toEqual(["judgment", "principle"]);
    expect(state.log.length).toBeGreaterThan(0);

    // Now read it back into a clean session.
    await gotoHome(page);
    await startFresh(page, "Throwaway");
    await openMenu(page);
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /Import/ }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(file);
    await park(page);

    await expect(page.locator("body")).toContainText("Export round trip");
    await expect(page.locator("body")).toContainText("Judgment one for export");
    await expectCounts(page, { J: 1, P: 1 });
  });

  test("an Argdown map imports as a graph", async ({ page }) => {
    // The parser is a chunk of its own, loaded on the press, so this is also
    // the check that the chunk loads in a real browser.
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "re-e2e-")),
      "paper.argdown",
    );
    fs.writeFileSync(
      file,
      [
        "===",
        "title: My paper",
        "===",
        "",
        "[Harm]: Preventing grave harm can outweigh honesty. #principle",
        "",
        "<Door>: The murderer at the door.",
        "",
        "(1) [Harm]",
        "(2) [Grave]: Lying to the murderer prevents grave harm.",
        "----",
        "(3) [Permissible]: Lying to the murderer is permissible.",
        "  -> [Kant]",
        "",
        "[Kant]: Never lie. #principle",
        "",
      ].join("\n"),
    );

    await gotoHome(page);
    await startFresh(page, "Throwaway");
    await openMenu(page);
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /Import/ }).click();
    // An empty process has nothing to replace, so there is no confirmation.
    await (await chooserPromise).setFiles(file);
    await park(page);

    await expect(page.locator("body")).toContainText("My paper");
    await expect(page.locator("body")).toContainText(
      "Lying to the murderer is permissible.",
    );
    await expectCounts(page, { J: 2, P: 2 });
  });

  test("the exported graph is self-contained", async ({ page }) => {
    // The SVG is embedded as a data URI and read outside the app, where the
    // app's stylesheet is not present. Any custom property it references has to
    // be defined inside the file, or it silently paints the node labels black.
    await gotoHome(page);
    await startFresh(page, "Export portability");
    await addElement(page, "judgment", "A judgment to draw in the exported graph.");

    const download = await exportDownload(page);
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "re-e2e-")), "export.md");
    await download.saveAs(file);

    const encoded = fs.readFileSync(file, "utf8").match(/base64,([^"]+)/);
    expect(encoded, "export must embed a graph").not.toBeNull();
    const svg = Buffer.from(encoded[1], "base64").toString("utf8");

    const referenced = [...new Set([...svg.matchAll(/var\((--[a-z-]+)\)/g)].map((m) => m[1]))];
    const defined = new Set([...svg.matchAll(/(--[a-z-]+)\s*:/g)].map((m) => m[1]));
    const undefined_ = referenced.filter((v) => !defined.has(v));
    expect(undefined_, `SVG references ${undefined_.join(", ")} without defining them`).toEqual([]);

    // Both schemes are declared, so the file suits a light or a dark viewer.
    expect(svg).toContain("prefers-color-scheme");
  });
});
