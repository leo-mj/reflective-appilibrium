import { describe, it, expect } from "vitest";
import {
  ARGDOWN_IMPORT_PROMPT,
  ARGDOWN_PROMPT_EXAMPLE,
  argdownFromReply,
  pastedArgdownFile,
} from "./argdownPrompt.js";
import { importArgdownFromFile } from "./importArgdown.js";

const byText = (state, start) =>
  state.elements.find((e) => e.text.startsWith(start));

describe("the prompt's example", () => {
  // The prompt teaches by this example, so it has to import as described.
  it("imports as the map it describes", async () => {
    const state = await importArgdownFromFile(
      pastedArgdownFile(ARGDOWN_PROMPT_EXAMPLE),
    );
    expect(state.topic).toBe("Famine relief");
    expect(state.elements).toHaveLength(8);

    const id = (start) => byText(state, start).id;
    expect(byText(state, "If we can prevent").type).toBe("principle");
    expect(byText(state, "Suffering and death").confidence).toBe(0.95);
    expect(byText(state, "Affluent people can prevent").type).toBe("theory");
    expect(byText(state, "Affluent people ought").type).toBe("judgment");
    // The parser drops the comment marking an unstated premise.
    expect(byText(state, "Giving until").text).toMatch(/those helped\.$/);
    // Every type is tagged, so nothing falls back to a judgment unasked.
    expect(state.log[0].findings).not.toMatch(/without #judgment/);
    // Nothing is left out.
    expect(state.log[0].findings).not.toMatch(/left out/);

    const rel = (from, type, to) =>
      state.relations.filter(
        (r) => r.from === id(from) && r.type === type && r.to === id(to),
      );
    const conclusion = "Affluent people ought";
    for (const p of [
      "If we can prevent",
      "Suffering and death",
      "Affluent people can prevent",
    ])
      expect(rel(p, "jointly_entails", conclusion)).toHaveLength(1);
    for (const p of ["Morality cannot", "Giving until"])
      expect(rel(p, "jointly_precludes", conclusion)).toHaveLength(1);
    expect(
      rel("One ought to wade", "supports", "If we can prevent"),
    ).toHaveLength(1);
    expect(rel("People may put", "conflicts", conclusion)).toHaveLength(1);
    expect(state.relations).toHaveLength(7);
  });

  it("is in the prompt", () => {
    expect(ARGDOWN_IMPORT_PROMPT).toContain(ARGDOWN_PROMPT_EXAMPLE.trimEnd());
  });
});

describe("argdownFromReply", () => {
  it("takes the argdown block out of a reply with notes around it", () => {
    const reply = [
      "Here is the map:",
      "",
      "```argdown",
      "[A]: Lying is wrong. #principle",
      "```",
      "",
      "I left out the historical asides.",
    ].join("\n");
    expect(argdownFromReply(reply)).toBe("[A]: Lying is wrong. #principle\n");
  });

  it("prefers the argdown block to another one", () => {
    const reply = "```text\nnot this\n```\n\n```argdown\n[A]: this\n```\n";
    expect(argdownFromReply(reply)).toBe("[A]: this\n");
  });

  it("takes an unmarked block, or the whole reply when there is none", () => {
    expect(argdownFromReply("```\n[A]: x\n```")).toBe("[A]: x\n");
    expect(argdownFromReply("[A]: x\r\n  +> [B]")).toBe("[A]: x\n  +> [B]\n");
  });
});

describe("pastedArgdownFile", () => {
  it("is named after the map's title", () => {
    const file = pastedArgdownFile(
      '```argdown\n===\ntitle: "Lying / harm"\n===\n\n[A]: x\n```',
    );
    expect(file.name).toBe("Lying   harm.argdown");
  });

  it("has a name of its own without one", () => {
    expect(pastedArgdownFile("[A]: x").name).toBe(
      "Pasted argument map.argdown",
    );
  });
});
