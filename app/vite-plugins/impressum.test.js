// The Impressum is chosen per build. A build without VITE_IMPRESSUM must write
// nothing, and one naming text that does not exist must fail rather than ship
// a link to a page that is not there.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  impressum,
  impressumPage,
  impressumSource,
  PAGE,
} from "./impressum.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Runs the plugin as a build would, returning the files it emits. */
function build(env) {
  const plugin = impressum();
  plugin.configResolved({ base: "/", root, env });
  const emitted = {};
  plugin.generateBundle.call({
    emitFile: ({ fileName, source }) => (emitted[fileName] = source),
  });
  return emitted;
}

describe("impressumSource", () => {
  it("names a file in legal/", () => {
    expect(impressumSource("tuhh")).toBe(join("legal", "impressum.tuhh.html"));
  });

  it.each(["../secrets", "TUHH", "a/b", ""])("refuses %j", (name) => {
    expect(() => impressumSource(name)).toThrow(/VITE_IMPRESSUM/);
  });
});

describe("impressumPage", () => {
  const page = impressumPage("<!-- a note -->\n<h1>Impressum</h1>");

  it("is a German page of its own, styled from a file the CSP allows", () => {
    expect(page).toMatch(/^<!doctype html>/);
    expect(page).toContain('<html lang="de">');
    expect(page).toContain('<link rel="stylesheet" href="impressum.css" />');
    expect(page).not.toMatch(/<style|style=/);
  });

  it("drops the maintainers' comments and leads back to the app", () => {
    expect(page).not.toContain("a note");
    expect(page).toContain('<a href="./">Zurück zur Anwendung</a>');
  });
});

describe("the plugin", () => {
  it("writes nothing for a build that names no provider", () => {
    expect(build({})).toEqual({});
  });

  it("writes the page and its stylesheet for one that does", () => {
    const files = build({ VITE_IMPRESSUM: "tuhh" });
    expect(Object.keys(files).sort()).toEqual(["impressum.css", PAGE]);
    expect(files[PAGE]).toContain("Technische Universität Hamburg");
  });

  it("fails at the start of the build when the text is missing", () => {
    expect(() => build({ VITE_IMPRESSUM: "nowhere" })).toThrow(
      /impressum\.nowhere\.html/,
    );
  });
});

// What § 5 DDG asks for, so an edit that drops one fails here.
describe("the TU Hamburg text", () => {
  // As published: the file's own comment explains the TMG change, and is not.
  const text = impressumPage(
    readFileSync(join(root, "legal", "impressum.tuhh.html"), "utf8"),
  );

  it.each([
    ["the provider and its address", "Am Schwarzenberg-Campus 1"],
    ["its legal form", "Körperschaft des öffentlichen Rechts"],
    ["its legal representative", "Gesetzlicher Vertreter"],
    ["its supervisory authority", "Zuständige Aufsichtsbehörde"],
    ["its VAT id", "DE 245 980 291"],
    ["an email address", 'href="mailto:leo.maedje@tuhh.de"'],
  ])("names %s", (_, needle) => {
    expect(text).toContain(needle);
  });

  it("cites the DDG, not the TMG it replaced", () => {
    expect(text).toContain("§ 5 Digitale-Dienste-Gesetz");
    expect(text).not.toMatch(/Telemediengesetz|TMG/);
  });
});
