import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, park } from "./helpers.js";

test.describe("Landing page", () => {
  test("renders the title, both logos, and the entry cards", async ({ page }) => {
    await gotoHome(page);

    await expect(page.getByRole("heading", { name: "Explore the demo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start your own process" })).toBeVisible();

    // naturalWidth is the only honest check that an <img> actually decoded —
    // a 404 still renders an <img> element with the right src.
    const images = await page.$$eval("img", (ns) =>
      ns.map((n) => ({ src: n.getAttribute("src"), width: n.naturalWidth })),
    );
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img.width, `${img.src} failed to load`).toBeGreaterThan(0);
    }
  });

  test("theme toggle swaps the palette", async ({ page }) => {
    await gotoHome(page);
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const before = await bg();
    await page.click('button[title*="Switch to"]');
    await expect.poll(bg).not.toBe(before);

    // and back again
    await page.click('button[title*="Switch to"]');
    await expect.poll(bg).toBe(before);
  });

  test("the demo loads with its elements and graph", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);
    await park(page);

    await expect(page.locator("h1")).toContainText("Round");

    // The force layout draws one shape per element; if the simulation throws,
    // the SVG is present but empty, so count the shapes rather than the <svg>.
    const shapes = await page.locator("svg circle, svg rect").count();
    expect(shapes).toBeGreaterThan(0);

    const labels = await page.$$eval("svg text", (ns) =>
      ns.map((n) => n.textContent.trim()).filter((t) => /^[JPT]\d+$/.test(t)),
    );
    expect(labels.length).toBeGreaterThan(0);
  });

  test("the tutorial opens and steps forward", async ({ page }) => {
    await gotoHome(page);
    await page.locator('button:text-is("Tutorial")').click();

    const next = page.getByRole("button", { name: /Next/ });
    await expect(next).toBeVisible();

    const counter = page.locator("text=/^\\d+ \\/ \\d+$/").first();
    const first = await counter.textContent();
    await next.click();
    await expect.poll(() => counter.textContent()).not.toBe(first);
  });
});
