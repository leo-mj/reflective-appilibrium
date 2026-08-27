import { test, expect } from "@playwright/test";
import { gotoHome, loadSample, park } from "./helpers.js";

/**
 * The pan/zoom layer inside the graph's own `<svg>`.
 *
 * Everything below counts shapes, and the page is full of `<svg>` icons — the
 * tab bar, the legend swatches, the group chips — several of which are drawn
 * out of the same primitives as an edge. `GraphCanvas` is the only one that
 * wraps its contents in a scaled `<g>`, which makes that the graph's root.
 */
const CANVAS = 'svg > g[transform*="scale"]';

/**
 * Element ids currently drawn on the canvas.
 *
 * A collapsed group's own labels — the member count, "elements", its name — are
 * filtered out by the id shape, so this answers only "which elements is the
 * graph still showing".
 *
 * @param {import('@playwright/test').Page} page
 */
function drawnIds(page) {
  return page.$$eval(`${CANVAS} text`, (ns) =>
    ns.map((n) => n.textContent.trim()).filter((t) => /^[JPT]\d+$/.test(t)),
  );
}

/** Every label the canvas is drawing, ids and group names alike. */
function drawnText(page) {
  return page.$$eval(`${CANVAS} text`, (ns) =>
    ns.map((n) => n.textContent.trim()),
  );
}

/**
 * How many edges are drawn.
 *
 * `GraphEdge` lays a transparent stroke behind each edge as a hit area, so the
 * visible ones are the paths with a real colour. Joint arguments draw `<line>`
 * elements instead, and are counted alongside.
 *
 * @param {import('@playwright/test').Page} page
 */
function edgeCount(page) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    return (
      [...root.querySelectorAll("path")].filter(
        (p) => p.getAttribute("stroke") !== "transparent",
      ).length + root.querySelectorAll("line").length
    );
  }, CANVAS);
}

/**
 * Ctrl/Cmd-clicks a node, which adds it to the accumulating selection rather
 * than replacing it.
 *
 * `ControlOrMeta` rather than `Control`: on macOS a control-click is a
 * secondary click, which would open a context menu instead of reaching the
 * canvas. The app accepts either modifier.
 */
async function ctrlClickNode(page, id) {
  const shape = page.locator(
    `xpath=//*[name()='text'][normalize-space(text())='${id}']/preceding-sibling::*[1]`,
  );
  await expect(shape, `no node "${id}" in the graph`).toHaveCount(1);
  await shape.click({ modifiers: ["ControlOrMeta"] });
}

/**
 * Clicks a collapsed group's disc, by the name written inside it.
 *
 * The disc has no id label, so it is reached through the name — its own text is
 * the only thing on the canvas that identifies it. The whole `<g>` rather than
 * a shape inside it: the disc is two concentric circles, and the nearer one to
 * the label is the *inner* ring, which the outer disc covers.
 */
async function clickGroupNode(page, label) {
  const node = page.locator(
    `xpath=//*[name()='text'][normalize-space(text())='${label}']/parent::*`,
  );
  await expect(node, `no group "${label}" on the canvas`).toHaveCount(1);
  await node.click();
}

/**
 * Clicks an expanded group's box, somewhere nothing else is.
 *
 * The box is the bounding rectangle of the group's members, so other nodes —
 * and the edges between them — can sit anywhere inside it, and a fixed offset
 * from a corner is not reliably empty. The canvas hit-tests nodes and edges
 * before the box, so the point has to be clear of both: `elementFromPoint`
 * answers that, and it is asked about a small square rather than a single
 * point because a node's hit radius reaches past the shape drawn for it.
 */
async function clickInsideHull(page) {
  // Wait for the layout to stop moving first. Expanding a group re-heats the
  // force simulation, and a point picked while the nodes are still drifting is
  // stale by the time the click lands — one of them slides over it.
  await page.waitForFunction(
    () => {
      const r = document
        .querySelector("svg rect[stroke-dasharray]")
        ?.getBoundingClientRect();
      if (!r) return false;
      const key = `${r.x | 0},${r.y | 0},${r.width | 0},${r.height | 0}`;
      const settled = window.__hullKey === key;
      window.__hullKey = key;
      return settled;
    },
    null,
    { polling: 300, timeout: 30_000 },
  );

  const point = await page.evaluate(() => {
    const hull = document.querySelector("svg rect[stroke-dasharray]");
    if (!hull) return null;
    const box = hull.getBoundingClientRect();
    const clear = (x, y) =>
      [[0, 0], [-10, 0], [10, 0], [0, -10], [0, 10]].every(
        ([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === hull,
      );
    for (let y = box.top + 12; y < box.bottom - 12; y += 6)
      for (let x = box.left + 12; x < box.right - 12; x += 6)
        if (clear(x, y)) return { x, y };
    return null;
  });
  expect(point, "no clear spot inside the group's box").not.toBeNull();
  await page.mouse.click(point.x, point.y);
}

/** Picks two judgments the sample is currently drawing. */
async function twoJudgments(page) {
  const ids = (await drawnIds(page)).filter((id) => id.startsWith("J"));
  expect(ids.length).toBeGreaterThan(1);
  return ids.slice(0, 2);
}

test.describe("Grouping nodes", () => {
  test("groups a ctrl+click selection and collapses it to one node", async ({
    page,
  }) => {
    await gotoHome(page);
    await loadSample(page);

    const [a, b] = await twoJudgments(page);
    const edgesBefore = await edgeCount(page);

    // Ctrl-clicking the *first* node too, not a plain click: a plain click
    // pins that node's tooltip card, and the card can land over whichever node
    // the next click is aiming at.
    await ctrlClickNode(page, a);
    await ctrlClickNode(page, b);

    await page.locator('button:text-is("Group")').click();
    await park(page);

    // Collapsed on arrival: grouping is asked for to tidy the canvas, so the
    // members are gone and one node — carrying the group's name — stands in.
    const collapsedIds = await drawnIds(page);
    expect(collapsedIds).not.toContain(a);
    expect(collapsedIds).not.toContain(b);
    expect(await drawnText(page)).toContain("Group 1");
    expect(await drawnText(page)).toContain("2 elements");
    // The handles stay off the canvas until the group is reached for.
    await expect(page.locator('[aria-label^="Expand group"]')).toHaveCount(0);

    // A group is a lid, so clicking one opens it — and both members and every
    // edge come back.
    await clickGroupNode(page, "Group 1");
    await park(page);

    await expect(page.locator('[aria-label^="Collapse group"]')).toHaveCount(1);
    expect(await drawnIds(page)).toEqual(expect.arrayContaining([a, b]));
    expect(await edgeCount(page)).toBe(edgesBefore);
  });

  test("expanding puts back exactly what collapsing took away", async ({
    page,
  }) => {
    // The guarantee that matters: a group is a way of looking at the graph, so
    // nothing may be lost by collapsing one.
    await gotoHome(page);
    await loadSample(page);

    const [a, b] = await twoJudgments(page);
    const idsBefore = (await drawnIds(page)).sort();
    const edgesBefore = await edgeCount(page);

    // Ctrl-clicking the *first* node too, not a plain click: a plain click
    // pins that node's tooltip card, and the card can land over whichever node
    // the next click is aiming at.
    await ctrlClickNode(page, a);
    await ctrlClickNode(page, b);
    await page.locator('button:text-is("Group")').click();
    await park(page);

    await clickGroupNode(page, "Group 1");
    await park(page);

    expect((await drawnIds(page)).sort()).toEqual(idsBefore);
    expect(await edgeCount(page)).toBe(edgesBefore);
  });

  test("renames and dissolves a group from its chip", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);

    const [a, b] = await twoJudgments(page);
    // Ctrl-clicking the *first* node too, not a plain click: a plain click
    // pins that node's tooltip card, and the card can land over whichever node
    // the next click is aiming at.
    await ctrlClickNode(page, a);
    await ctrlClickNode(page, b);
    await page.locator('button:text-is("Group")').click();

    await clickGroupNode(page, "Group 1"); // selects it, and opens it
    await page.locator('[aria-label^="Edit group"]').click();
    await page.getByLabel("Group name").fill("Consequences");
    await page.locator('button:text-is("Save")').click();
    await park(page);
    expect(await drawnText(page)).toContain("Consequences");

    await page.locator('[aria-label="Ungroup Consequences"]').click();
    await park(page);
    await expect(page.locator('[aria-label^="Collapse group"]')).toHaveCount(0);
    // Dissolving the box leaves everything that was in it.
    expect(await drawnIds(page)).toEqual(expect.arrayContaining([a, b]));
  });

  test("clicks back into an expanded group to close it again", async ({
    page,
  }) => {
    // Once open, a group's members are ordinary nodes and its own node is gone;
    // the box is the only handle it has left, and its handles have to be
    // reachable there however near the panel's edge the layout has put it.
    await gotoHome(page);
    await loadSample(page);

    const [a, b] = await twoJudgments(page);
    await ctrlClickNode(page, a);
    await ctrlClickNode(page, b);
    await page.locator('button:text-is("Group")').click();
    await park(page);

    // The canvas handles, named exactly: the text panel has buttons for the
    // same group, and a looser match would find those instead.
    const canvasHandles = page.locator(
      '[aria-label="Collapse group Group 1"], [aria-label="Expand group Group 1"]',
    );
    // Nothing is selected yet, so none are floating over the canvas.
    await expect(canvasHandles).toHaveCount(0);

    await clickGroupNode(page, "Group 1"); // opens it, and holds on to it
    await park(page);
    await expect(
      page.locator('[aria-label="Collapse group Group 1"]'),
    ).toHaveCount(1);

    // Closing it puts it away, handles and all.
    await page.locator('[aria-label="Collapse group Group 1"]').click();
    await park(page);
    await expect(canvasHandles).toHaveCount(0);

    await clickGroupNode(page, "Group 1"); // open it again
    await park(page);

    // Clicking what is already selected drops it, the same as clicking a
    // selected node does…
    await clickInsideHull(page);
    await park(page);
    await expect(
      page.locator('[aria-label="Collapse group Group 1"]'),
    ).toHaveCount(0);

    // …and clicking back into the box picks the group up again, which is the
    // only handle it has left once its members are ordinary nodes.
    await clickInsideHull(page);
    await park(page);

    await page.locator('[aria-label="Collapse group Group 1"]').click();
    await park(page);

    const ids = await drawnIds(page);
    expect(ids).not.toContain(a);
    expect(ids).not.toContain(b);
  });

  test("says grouping exists, and makes one without a modifier key", async ({
    page,
  }) => {
    // Nobody discovers ctrl+click by looking at a canvas, so there has to be
    // something on screen that says the feature is there.
    await gotoHome(page);
    await loadSample(page);

    // Two controls open this dialog and share a name — the graph's toolbar
    // button and the panel section's "+". That is fine for a reader, since they
    // do the same thing; the locator just has to say which one it means.
    await page.locator('button[aria-label="New group"]:has-text("Grp")').click();
    const dialog = page.getByLabel("Group name").locator("..").locator("..");
    await expect(dialog).toContainText(/ctrl/i);

    const [a, b] = await twoJudgments(page);
    await page.getByLabel(new RegExp(`^${a}:`)).check();
    await page.getByLabel(new RegExp(`^${b}:`)).check();
    await page.getByLabel("Group name").fill("Made from the toolbar");
    await page.locator('button:text-is("Create group")').click();
    await park(page);

    // The name is wrapped to fit the disc, so it arrives as its lines.
    expect(await drawnText(page)).toContain("Made from");
    const ids = await drawnIds(page);
    expect(ids).not.toContain(a);
    expect(ids).not.toContain(b);
  });

  test("lists a collapsed group's members in the text panel", async ({
    page,
  }) => {
    // The canvas hides them; the panel is the one place they are still spelled
    // out, which is also where they can be taken out again.
    await gotoHome(page);
    await loadSample(page);

    const [a, b] = await twoJudgments(page);
    await ctrlClickNode(page, a);
    await ctrlClickNode(page, b);
    await page.locator('button:text-is("Group")').click();
    await park(page);

    await page.getByRole("button", { name: /Jump to groups/ }).click();
    const section = page.getByLabel("Actions for Group 1").locator("..");
    await expect(section).toContainText("2 members");
    await expect(section).toContainText("collapsed");

    // Taking one out on its own, without the dialog.
    await page.getByLabel(`Remove ${a} from Group 1`).click();
    await park(page);
    // Down to one member, so the group is gone and both nodes are back.
    expect(await drawnText(page)).not.toContain("Group 1");
    expect(await drawnIds(page)).toEqual(expect.arrayContaining([a, b]));
  });

  test("a selected group shows its members in the panel, not an empty card", async ({
    page,
  }) => {
    // Selection is one id, and the panel holds no card called "G1".
    await gotoHome(page);
    await loadSample(page);

    const [a, b] = await twoJudgments(page);
    await ctrlClickNode(page, a);
    await ctrlClickNode(page, b);
    await page.locator('button:text-is("Group")').click();
    await park(page);

    await clickGroupNode(page, "Group 1");
    await park(page);

    // The heading is the group's name and its size, and both members are under
    // it — the id "G1" is an internal handle and never appears.
    const panel = page.locator('[data-tutorial="text-panel"]');
    await expect(panel).toContainText("Group 1 (2)");
    await expect(panel).toContainText(a);
    await expect(panel).toContainText(b);
    // Both members are the selection itself, so neither is listed again below
    // it as its own neighbour.
    await expect(panel).toContainText("All elements");
  });

  test("tags a grouped element in the panel, and selects the group from it", async ({
    page,
  }) => {
    await gotoHome(page);
    await loadSample(page);

    const [a, b] = await twoJudgments(page);
    await ctrlClickNode(page, a);
    await ctrlClickNode(page, b);
    await page.locator('button:text-is("Group")').click();
    await park(page);

    // A collapsed group is the reason its members are not on the canvas, so a
    // card that said nothing about it would look like a disagreement.
    await page.getByRole("button", { name: /Jump to judgments/ }).click();
    await expect(
      page.getByLabel("Select group Group 1").first(),
    ).toBeVisible();

    await page.getByLabel("Select group Group 1").first().click();
    await park(page);
    await expect(
      page.locator('[data-tutorial="text-panel"]'),
    ).toContainText("Group 1 (2)");
  });

  test("changes a group's membership from the dialog", async ({ page }) => {
    await gotoHome(page);
    await loadSample(page);

    const [a, b] = await twoJudgments(page);
    await ctrlClickNode(page, a);
    await ctrlClickNode(page, b);
    await page.locator('button:text-is("Group")').click();
    await park(page);

    // Clicking the disc opens the group, which is also how its chip is reached.
    await clickGroupNode(page, "Group 1");
    await page.locator('[aria-label^="Edit group"]').click();
    // Swap one member for a third element the group did not hold.
    const c = (await drawnIds(page)).find((id) => id !== a && id !== b);
    await page.getByLabel(new RegExp(`^${a}:`)).uncheck();
    await page.getByLabel(new RegExp(`^${c}:`)).check();
    await page.locator('button:text-is("Save")').click();
    await park(page);

    // Still selected, so the chip is there to close it again — which is what
    // makes the new membership visible as an absence.
    await page.locator('[aria-label^="Collapse group"]').click();
    await park(page);

    const ids = await drawnIds(page);
    // `a` is out of the group, so it is drawn again; `c` has taken its place.
    expect(ids).toContain(a);
    expect(ids).not.toContain(b);
    expect(ids).not.toContain(c);
  });
});
