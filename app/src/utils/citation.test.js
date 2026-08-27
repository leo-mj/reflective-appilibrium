import { describe, it, expect } from "vitest";
import { citationRuns, citationMarkdown, citationText } from "./citation.js";

const book = (over = {}) => ({
  type: "book",
  authors: ["Parfit, D."],
  year: "1984",
  title: "Reasons and persons",
  container: "",
  editors: [],
  publisher: "Oxford University Press",
  volume: "",
  issue: "",
  pages: "",
  doi: "",
  ...over,
});

const chapter = (over = {}) =>
  book({
    type: "chapter",
    title: "Moral anti-realism",
    container: "The Stanford encyclopedia of philosophy",
    editors: ["E. N. Zalta"],
    publisher: "Metaphysics Research Lab",
    pages: "12-40",
    ...over,
  });

const article = (over = {}) =>
  book({
    type: "article",
    authors: ["Street, S."],
    year: "2006",
    title: "A Darwinian dilemma for realist theories of value",
    container: "Philosophical Studies",
    publisher: "",
    volume: "127",
    issue: "1",
    pages: "109-166",
    ...over,
  });

describe("citationText", () => {
  it("renders a book", () => {
    expect(citationText(book())).toBe(
      "Parfit, D. (1984). Reasons and persons. Oxford University Press.",
    );
  });

  it("renders a chapter in an edited volume, editors initials-first", () => {
    expect(citationText(chapter())).toBe(
      "Parfit, D. (1984). Moral anti-realism. In E. N. Zalta (Ed.), " +
        "The Stanford encyclopedia of philosophy (pp. 12-40). Metaphysics Research Lab.",
    );
  });

  it("renders a journal article", () => {
    expect(citationText(article())).toBe(
      "Street, S. (2006). A Darwinian dilemma for realist theories of value. " +
        "Philosophical Studies, 127(1), 109-166.",
    );
  });

  it("appends a resolver URL for a DOI, and nothing without one", () => {
    expect(citationText(book({ doi: "10.1234/abc" }))).toMatch(
      /https:\/\/doi\.org\/10\.1234\/abc$/,
    );
    expect(citationText(book())).not.toMatch(/doi\.org/);
  });

  it("marks an undated work n.d. rather than leaving a gap", () => {
    expect(citationText(book({ year: "" }))).toContain("(n.d.).");
  });

  it("omits parts the record does not have", () => {
    // A chapter with no pages must not render "(pp. )", and an article with no
    // volume must not render a stray comma.
    expect(citationText(chapter({ pages: "" }))).not.toContain("pp.");
    expect(citationText(article({ volume: "", issue: "" }))).toBe(
      "Street, S. (2006). A Darwinian dilemma for realist theories of value. " +
        "Philosophical Studies, 109-166.",
    );
  });

  it("does not double a title's own end punctuation", () => {
    expect(citationText(article({ title: "What is it like to be a bat?" }))).toContain(
      "bat? Philosophical Studies",
    );
  });
});

describe("author lists", () => {
  const names = (n) =>
    Array.from({ length: n }, (_, i) => `Author${String(i + 1).padStart(2, "0")}, A.`);

  it("joins two authors with an ampersand", () => {
    expect(citationText(book({ authors: names(2) }))).toContain(
      "Author01, A., & Author02, A.",
    );
  });

  it("lists three authors with a serial comma before the ampersand", () => {
    expect(citationText(book({ authors: names(3) }))).toContain(
      "Author01, A., Author02, A., & Author03, A.",
    );
  });

  it("elides at twenty-one, keeping the first nineteen and the last", () => {
    const rendered = citationText(book({ authors: names(21) }));
    expect(rendered).toContain("Author19, A., . . . Author21, A.");
    expect(rendered).not.toContain("Author20");
  });

  it("keeps all twenty when there are exactly twenty", () => {
    const rendered = citationText(book({ authors: names(20) }));
    expect(rendered).toContain("& Author20, A.");
    expect(rendered).not.toContain(". . .");
  });

  it("renders a work with no authors without a leading gap", () => {
    expect(citationText(book({ authors: [] }))).toBe(
      "(1984). Reasons and persons. Oxford University Press.",
    );
  });

  it("says Eds. for more than one editor", () => {
    expect(citationText(chapter({ editors: ["E. N. Zalta", "U. Nodelman"] }))).toContain(
      "E. N. Zalta, & U. Nodelman (Eds.),",
    );
  });
});

describe("italics", () => {
  const italicised = (source) =>
    citationRuns(source)
      .filter((run) => run.italic)
      .map((run) => run.text.trim());

  it("italicises a book's title", () => {
    expect(italicised(book())).toEqual(["Reasons and persons"]);
  });

  it("italicises the containing volume of a chapter, not the chapter title", () => {
    expect(italicised(chapter())).toEqual(["The Stanford encyclopedia of philosophy"]);
  });

  it("italicises an article's journal and volume but not its issue", () => {
    // The detail that is got wrong by hand, and the reason this is a function.
    expect(italicised(article())).toEqual(["Philosophical Studies", "127"]);
    const runs = citationRuns(article());
    expect(runs.find((r) => r.text.includes("(1)")).italic).toBe(false);
  });

  it("never emits two adjacent runs of the same style", () => {
    // Adjacent same-style runs would render as `*a**b*`, which is not emphasis.
    const runs = citationRuns(chapter());
    expect(runs.every((run, i) => i === 0 || runs[i - 1].italic !== run.italic)).toBe(
      true,
    );
  });
});

describe("citationMarkdown", () => {
  it("wraps italic runs in emphasis and leaves the rest alone", () => {
    expect(citationMarkdown(book())).toBe(
      "Parfit, D. (1984). *Reasons and persons*. Oxford University Press.",
    );
  });

  it("renders exactly the runs, so screen and export cannot disagree", () => {
    const fromRuns = citationRuns(article())
      .map(({ text, italic }) => (italic ? `*${text}*` : text))
      .join("");
    expect(citationMarkdown(article())).toBe(fromRuns);
  });

  it("escapes run text without defusing its own emphasis markers", () => {
    // The exporter's `esc` escapes `*` and `_`, so escaping the finished string
    // would put a backslash in front of every marker this just added.
    const escape = (t) => t.replace(/([*_])/g, "\\$1");
    const out = citationMarkdown(book({ title: "Reasons *and* persons" }), escape);
    expect(out).toContain("*Reasons \\*and\\* persons*");
    expect(out).not.toContain("\\*Reasons");
  });

  it("keeps emphasis markers flush against the text", () => {
    // `* title *` is not emphasis in any dialect, so surrounding space has to
    // move outside the markers. Split on the markers and check the emphasised
    // halves rather than pattern-matching: a space *before* an opening marker is
    // correct, so a naive regex flags the right output.
    const emphasised = citationMarkdown(chapter()).split("*").filter((_, i) => i % 2);
    expect(emphasised.length).toBeGreaterThan(0);
    for (const span of emphasised) expect(span).toBe(span.trim());
  });

  it("returns nothing for a missing source rather than throwing", () => {
    expect(citationRuns(null)).toEqual([]);
    expect(citationMarkdown(undefined)).toBe("");
  });
});
