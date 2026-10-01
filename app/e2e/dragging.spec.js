import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  gotoHome,
  startFresh,
  addElement,
  exportDownload,
  openMenu,
  park,
  waitForReady,
} from "./helpers.js";

/**
 * Dragging a node on the Graph tab, where only a browser can tell: the
 * pointer actually carrying the node, and where it was dropped surviving the
 * autosave, a reload and an export → import round trip. The unit tests cover
 * the pieces — the gesture, the pins' bookkeeping, the undo rules — in jsdom,
 * which neither lays out nor downloads anything.
 *
 * Mouse only, as the feature is: a finger on a node pans.
 */

/** The shape of a node, found by the id on it — see `clickNode` in helpers. */
const nodeShape = (page, id) =>
  page.locator(
    `xpath=//*[name()='text'][normalize-space(text())='${id}']/preceding-sibling::*[1]`,
  );

/** The centre of a node on screen. */
async function centreOf(page, id) {
  const box = await nodeShape(page, id).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Waits for the nodes to look still, so the press lands on the node it aims
 * at. Only *look*: the layout itself may run on for seconds after its nodes
 * have stopped visibly moving — which is the case the drag has to cope with,
 * and the reason this is not a wait for it to end.
 */
async function settle(page) {
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify([
          await centreOf(page, "J1"),
          await centreOf(page, "J2"),
        ]);
        const still = now === last;
        last = now;
        return still;
      },
      { intervals: [250, 250, 500, 500, 1000], timeout: 20_000 },
    )
    .toBe(true);
}

/** Exports, and hands back the state the file's `re-state` block carries. */
async function exportedState(page) {
  const download = await exportDownload(page);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "re-e2e-")), "export.md");
  await download.saveAs(file);
  const fenced = fs.readFileSync(file, "utf8").match(/```re-state\n([\s\S]*?)```/);
  expect(fenced, "export must carry a re-state block").not.toBeNull();
  await park(page);
  return { state: JSON.parse(fenced[1]), file };
}

test.describe("Dragging a node", () => {
  test.skip(({ isMobile }) => isMobile, "dragging is for a mouse");

  test("moves only the node held, and where it lands survives a reload and a round trip", async ({
    page,
  }) => {
    await gotoHome(page);
    await startFresh(page, "Drag check");
    await addElement(page, "judgment", "A judgment to drag.");
    await addElement(page, "judgment", "A judgment to leave where it is.");
    await park(page);
    await expect(nodeShape(page, "J2")).toBeVisible();
    await settle(page);

    const from = await centreOf(page, "J1");
    const stayed = await centreOf(page, "J2");
    // Across J2's path: a neighbour passed close by is the one a running
    // layout would shove.
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 120, from.y + 60, { steps: 12 });
    await page.mouse.up();
    // Long enough for anything still running to show.
    await page.waitForTimeout(1000);
    await park(page);

    // Carried with the pointer, and nothing else moved with it.
    const to = await centreOf(page, "J1");
    expect(to.x).toBeCloseTo(from.x + 120, -1);
    expect(to.y).toBeCloseTo(from.y + 60, -1);
    const j2 = await centreOf(page, "J2");
    expect(Math.hypot(j2.x - stayed.x, j2.y - stayed.y)).toBeLessThan(2);

    // Pinned where it was dropped, in the file.
    const { state: first } = await exportedState(page);
    expect(Object.keys(first.pins ?? {})).toEqual(["J1"]);
    const pin = first.pins.J1;

    // Through the autosave and a reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('button:text-is("Resume")').click();
    await waitForReady(page);
    const { state: resumed, file } = await exportedState(page);
    expect(resumed.pins).toEqual({ J1: pin });

    // And through Import, into a process of its own.
    await gotoHome(page);
    await startFresh(page, "Throwaway");
    await openMenu(page);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /Import/ }).click();
    await (await chooser).setFiles(file);
    await park(page);
    await expect(page.locator("body")).toContainText("A judgment to drag.");
    const { state: imported } = await exportedState(page);
    expect(imported.pins).toEqual({ J1: pin });
  });
});
