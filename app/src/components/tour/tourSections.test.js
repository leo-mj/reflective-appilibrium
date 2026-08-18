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

  it("introduces the third element type off an argument it is a premise of", () => {
    // Background theories are the layer that makes the equilibrium wide, and
    // the demo has them arguing for a principle the reader has just been shown
    // — so they land as part of the same web rather than as a fourth shape.
    const sections = build();
    const theories = sections.find((s) => s.id === "theories");
    expect(theories.quote).toEqual(["T1", "T2"]);
    expect(theories.argument).toBe("arg-sample-1");
    // After the section that says what an argument is, or the argument it is
    // shown through means nothing yet.
    expect(ids(sections).indexOf("theories")).toBeGreaterThan(
      ids(sections).indexOf("argument"),
    );
  });

  it("shows the text panel while it is still about changing the position", () => {
    // Its point is that none of the editing is limited to the graph, which only
    // lands next to the sections about editing the graph.
    const sections = build();
    const order = ids(sections);
    expect(order.indexOf("text")).toBeGreaterThan(order.indexOf("revising"));
    expect(order.indexOf("text")).toBeLessThan(order.indexOf("assist"));
    // Shown early, it is shown with the tab bar hidden — so it has to say where
    // the panel is to be found once the tour has handed the app back.
    expect(textOf(sections.find((s) => s.id === "text"))).toMatch(/analyze/i);
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

describe("the same tour at either width", () => {
  // The phone used to get a different tour entirely — nine cards that walked
  // the ☰ menu and never said what reflective equilibrium was, which is the one
  // thing a first-time visitor is there to find out. One script now serves
  // both, and what may differ between them is the route to a control: never
  // which chapters a reader gets.
  const narrow = (overrides = {}) => build({ narrow: true, ...overrides });
  const byId = (sections) => new Map(sections.map((s) => [s.id, s]));

  it("says the same things on a phone as on a desktop", () => {
    const narrowIds = ids(narrow());
    ids(build()).forEach((id) => expect(narrowIds).toContain(id));
  });

  it("adds only what the other width has no equivalent of", () => {
    // The tab bar's chapter is the ☰ menu's chapter here, so the menu has to be
    // introduced once before the tour starts opening it.
    const wideIds = ids(build());
    expect(ids(narrow()).filter((id) => !wideIds.includes(id))).toEqual([
      "narrow-menu",
    ]);
  });

  it("tells both widths as much as each other, section for section", () => {
    // A paragraph dropped rather than reworded is the old narrow tour coming
    // back one line at a time.
    const wide = byId(build());
    narrow().forEach((s) => {
      const twin = wide.get(s.id);
      if (twin) expect(s.body.length, s.id).toBe(twin.body.length);
    });
  });

  it("points at each control where that width actually keeps it", () => {
    const wide = byId(build());
    const thin = byId(narrow());
    // Undo is a header button on one and a ☰ entry on the other; Assist is a
    // tab-bar group on one and a menu group on the other.
    expect(wide.get("revising").target).toBe("btn-undo");
    expect(thin.get("revising").target).toBe("menu-undo");
    expect(wide.get("assist").target).toBe("meta-assist");
    expect(thin.get("assist").target).toBe("menu-assist");
    // And the text is a panel beside the graph on one, a tab of its own on the
    // other — so it is reached by opening it rather than by asking for chrome.
    expect(wide.get("text").text).toBe(true);
    expect(thin.get("text").tab).toBe("text");
  });

  it("only rings what is on screen at that width", () => {
    // There is no tab bar here, so everything the tour points at is either
    // always drawn or inside the ☰ menu — and the menu ones have to open it.
    const ALWAYS_DRAWN = ["topic", "btn-menu", "graph-add", "text-panel"];
    narrow()
      .filter((s) => s.target && !ALWAYS_DRAWN.includes(s.target))
      .forEach((s) => {
        expect(s.menu, `${s.id} rings ${s.target} with the menu shut`).toBe(
          true,
        );
      });
  });

  it("never points twice at the same control either", () => {
    const targets = narrow()
      .flatMap((s) => (s.target ? [s.target].flat() : []))
      .filter(Boolean);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("hands the tour plain strings, whichever width is reading", () => {
    // The per-layout wordings are resolved here, so neither tour has to know
    // that the other exists.
    [...build(), ...narrow()].forEach((s) => {
      expect(typeof s.title, s.id).toBe("string");
      expect(s.title.length).toBeGreaterThan(0);
      s.body.filter(Boolean).forEach((p) => expect(typeof p).toBe("string"));
    });
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
    const off = build({ hideNonEntailsRels: true }).find(
      (s) => s.id === "cycle",
    );
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

  it("asks for the panel it rings, where the ring is not on a control", () => {
    // The text panel is hidden with the rest of the chrome, so the section that
    // points at it has to bring it back first — there is nothing to measure
    // otherwise.
    const text = build().find((s) => s.id === "text");
    expect(text.target).toBe("text-panel");
    expect(text.text).toBe(true);
  });

  it("only rings controls that are on screen when it rings them", () => {
    // These live in the tab bar, which the opening chapters hide — so a section
    // ringing one has to have asked for the bar first. The rest are drawn
    // whatever else is hidden: the title row, the graph, the ☰ menu.
    const IN_THE_TAB_BAR = /^(meta-|tab-|btn-workflow)/;
    build()
      .filter((s) => IN_THE_TAB_BAR.test(s.target ?? ""))
      .forEach((s) => {
        expect(s.chrome, `${s.id} rings ${s.target} with no tab bar`).toBe(
          true,
        );
      });
  });

  it("opens the ☰ menu for every entry it rings inside it", () => {
    // These only exist in the DOM while the menu is open; ringing one without
    // asking for the menu measures nothing and draws no ring.
    const INSIDE_THE_MENU = /^(menu-|btn-llm|btn-home)/;
    build()
      .filter((s) => INSIDE_THE_MENU.test(s.target ?? ""))
      .forEach((s) => {
        expect(s.menu, `${s.id} rings ${s.target} with the menu shut`).toBe(
          true,
        );
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
