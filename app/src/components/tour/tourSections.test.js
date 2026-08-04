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
    // Otherwise the honest reading of a pre-filled graph is that the app has
    // opinions of its own about the topic.
    expect(textOf(question)).toMatch(/somebody's finished process/i);
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
    expect(withArguments.length).toBeGreaterThanOrEqual(3);
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
    // The topic sits in the header's title row, which never goes away. Anything
    // else lives in the tab bar, so its section has to have asked for the bar.
    build()
      .filter((s) => s.target && s.target !== "topic")
      .forEach((s) => {
        expect(s.chrome, `${s.id} rings ${s.target} with no tab bar`).toBe(true);
      });
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
