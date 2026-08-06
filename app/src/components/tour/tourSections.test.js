// The tour's job is to answer, in order, the questions a first-time visitor
// arrives with: what reflective equilibrium is for, what is already on screen,
// what judgments and principles are — and only then, where the AI is and what
// the buttons do. These tests hold that order, and hold the script to what the
// app can actually show while each section is being read.
import { describe, it, expect } from "vitest";

import { buildTourSections } from "./tourSections.js";

const build = (overrides = {}) =>
  buildTourSections({
    isSample: true,
    hideNonEntailsRels: true,
    llmEnabled: false,
    topic: "Do we have obligations to people who do not yet exist?",
    ...overrides,
  });

const ids = (sections) => sections.map((s) => s.id);
const textOf = (section) =>
  [section.chapter, section.title, ...section.body].filter(Boolean).join(" ");

describe("the tour's shape", () => {
  it("explains the method before it shows anything, and the graph before the interface", () => {
    const order = ids(build());
    const method = order.indexOf("what-re-is");
    const graph = order.indexOf("judgments");
    const ai = order.indexOf("assist");
    const chrome = order.indexOf("analyze");

    expect(method).toBe(0);
    expect(graph).toBeGreaterThan(method);
    expect(ai).toBeGreaterThan(graph);
    expect(chrome).toBeGreaterThan(ai);
  });

  it("says what reflective equilibrium is for, in the first section", () => {
    const [first] = build();
    expect(textOf(first)).toMatch(/justification/i);
  });

  it("says why the graph already has something in it", () => {
    const question = build().find((s) => s.id === "the-question");
    // Left unsaid, the honest reading of a pre-filled graph is that the app has
    // opinions of its own about the topic. It has to be marked as someone
    // else's worked example.
    expect(textOf(question)).toMatch(/graph/i);
    expect(textOf(question)).toMatch(/fictional|example|someone|somebody/i);
  });

  it("quotes the topic it is pointing at", () => {
    const question = build({ topic: "What do we owe animals?" });
    expect(textOf(question.find((s) => s.id === "the-question"))).toContain(
      "What do we owe animals?",
    );
  });

  it("introduces judgments and principles by pointing at one of each", () => {
    const sections = build();
    const judgments = sections.find((s) => s.id === "judgments");
    const principles = sections.find((s) => s.id === "principles");
    expect(judgments.quote).toEqual(["J1"]);
    expect(judgments.focus).toContain("J1");
    expect(principles.quote).toEqual(["P1"]);
    expect(principles.focus).toContain("P1");
  });

  it("shows arguments on the graph rather than describing them", () => {
    const withArguments = build().filter((s) => s.argument);
    expect(withArguments.length).toBeGreaterThanOrEqual(2);
    // Every element an argument section names has to be framed with it, or the
    // premises are being discussed off-screen.
    withArguments.forEach((s) => {
      s.quote.forEach((id) => expect(s.focus).toContain(id));
    });
  });

  it("drops the demo-graph chapter on someone's own process", () => {
    // Those sections name the demo's elements by ID. On another state the IDs
    // mean something else, or nothing.
    const own = ids(build({ isSample: false }));
    expect(own).not.toContain("judgments");
    expect(own).not.toContain("argument");
    expect(own).toContain("what-re-is");
    expect(own).toContain("assist");
    expect(own).toContain("analyze");
  });
});

describe("what the tour claims", () => {
  it("owns up to the demo build having no model behind it", () => {
    const assist = build({ llmEnabled: false }).find((s) => s.id === "assist");
    expect(textOf(assist)).toMatch(/no model connected/i);
  });

  it("does not say that where a model is connected", () => {
    const assist = build({ llmEnabled: true }).find((s) => s.id === "assist");
    expect(textOf(assist)).not.toMatch(/no model connected/i);
    expect(textOf(assist)).toMatch(/live/i);
  });

  it("says the model proposes and the user disposes", () => {
    const assist = build().find((s) => s.id === "assist");
    expect(textOf(assist)).toMatch(/accept and a reject/i);
  });

  it("shows how a model would be connected, and says what that takes", () => {
    const section = build().find((s) => s.id === "llm-settings");
    // The entry lives in the ☰ menu, so the menu has to be open to ring it.
    expect(section.target).toBe("btn-llm");
    expect(section.menu).toBe(true);
    // The dialog itself is no longer a stop of its own, so this section has to
    // carry what it would have said.
    expect(textOf(section)).toMatch(/provider/i);
  });

  it("does not promise a working connection where there is no backend", () => {
    const find = (llmEnabled) =>
      textOf(build({ llmEnabled }).find((s) => s.id === "llm-settings"));
    expect(find(false)).not.toBe(find(true));
    expect(find(false)).toMatch(/demo|not enabled|no backend/i);
  });

  it("names the cycle after the relation modes that are switched on", () => {
    const armed = build({ hideNonEntailsRels: false }).find(
      (s) => s.id === "cycle",
    );
    const off = build({ hideNonEntailsRels: true }).find((s) => s.id === "cycle");
    expect(armed.title).toContain("relations");
    expect(off.title).not.toContain("relations");
  });
});

describe("what the app is doing while a section is read", () => {
  it("keeps the chrome out of the way until it is what the reader is shown", () => {
    const sections = build();
    const firstWithChrome = sections.findIndex((s) => s.chrome);
    const lastWithout = sections.map((s) => !!s.chrome).lastIndexOf(false);
    // The tab bar comes back once and stays: flickering it on and off between
    // sections would move the graph under the reader.
    expect(firstWithChrome).toBeGreaterThan(lastWithout);
  });

  it("only rings controls that are on screen when it rings them", () => {
    // These live in the tab bar, which the opening chapters hide — so a section
    // ringing one has to have asked for the bar first. The rest are drawn
    // whatever else is hidden: the title row, the graph, the ☰ menu.
    const IN_THE_TAB_BAR = /^(meta-|tab-|btn-workflow)/;
    build()
      .filter((s) => IN_THE_TAB_BAR.test(s.target ?? ""))
      .forEach((s) => {
        expect(s.chrome, `${s.id} rings ${s.target} with no tab bar`).toBe(true);
      });
  });

  it("opens the ☰ menu for every entry it rings inside it", () => {
    // These only exist in the DOM while the menu is open; ringing one without
    // asking for the menu measures nothing and draws no ring.
    const INSIDE_THE_MENU = /^(menu-|btn-llm|btn-home)/;
    build()
      .filter((s) => INSIDE_THE_MENU.test(s.target ?? ""))
      .forEach((s) => {
        expect(s.menu, `${s.id} rings ${s.target} with the menu shut`).toBe(true);
      });
  });

  it("never points twice at the same control", () => {
    // Two sections ringing one control is a section that could be folded into
    // the other, which is how the tour got long enough to need cutting.
    const targets = build()
      .map((s) => s.target)
      .filter(Boolean);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("gives every section a title and something to read", () => {
    build().forEach((s) => {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.filter(Boolean).length).toBeGreaterThan(0);
    });
  });

  it("keeps section ids unique, since they key the scroll targets", () => {
    const all = ids(build());
    expect(new Set(all).size).toBe(all.length);
  });
});
