/**
 * @fileoverview APA 7 reference formatting, from bibliographic fields.
 *
 * The model that proposes a background theory supplies *data* — authors, year,
 * title, container — and this module turns it into a reference. Asking a model
 * for formatted APA instead would make output quality depend on its typography
 * rather than on what it knows: a small local model punctuates worse than a
 * large one while knowing the same works, and a formatted string can be neither
 * validated per type nor restyled later.
 *
 * One ordering function, {@link citationRuns}, and two renderers over it — the
 * `<Citation>` component and {@link citationMarkdown}. Screen and export
 * therefore cannot drift, which is also what makes italics affordable: the
 * formatter knows which spans are italic, so neither renderer has to parse
 * anything or trust markup from a model.
 *
 * @module utils/citation
 */

/**
 * @typedef {Object} Run
 * @property {string}  text
 * @property {boolean} italic
 * @property {string} [href]  Set on the DOI resolver only, so a renderer can make
 *   it a link without re-parsing the finished reference for something URL-shaped.
 */

/**
 * APA 7's author-list punctuation.
 *
 * The names themselves arrive already in single-name form ("Parfit, D.") — the
 * shape of a name is data, and language-specific, so a formatter that tried to
 * derive it would get "van Inwagen" and "de Beauvoir" wrong. What belongs here
 * is only the punctuation *between* names, which is style.
 *
 * @param {string[]} names
 * @returns {string}
 */
function authorList(names) {
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length <= 20) {
    return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  }
  // 21 or more: the first nineteen, an ellipsis, and the last — the one author
  // who is never elided. Vanishingly rare in philosophy, but the rule is three
  // lines and its absence would silently produce a wrong reference.
  return `${names.slice(0, 19).join(", ")}, . . . ${names[names.length - 1]}`;
}

/**
 * Editor names for the "In … (Ed.)" position, which APA renders initials-first.
 *
 * @param {string[]} names
 * @returns {string}
 */
function editorList(names) {
  const label = names.length > 1 ? "Eds." : "Ed.";
  return `${authorList(names)} (${label})`;
}

/** Sentence-ending period, unless the text already ends in its own punctuation. */
function endsSentence(text) {
  return /[.?!]$/.test(text.trim());
}

/**
 * Build the reference as ordered runs.
 *
 * Missing parts are omitted rather than rendered empty: a chapter with no page
 * range should read as a chapter without pages, not as "(pp. )".
 *
 * @param {Object} source  An `RESource` — see types.js.
 * @returns {Run[]}
 */
export function citationRuns(source) {
  if (!source) return [];
  const runs = [];
  const put = (text, italic = false) => {
    if (text) runs.push({ text, italic });
  };

  const authors = authorList(source.authors ?? []);
  if (authors) put(`${authors}${endsSentence(authors) ? "" : "."} `);
  // "(n.d.)" is APA's own marker for an undated work, and is what the field's
  // empty case means — not a missing value to leave blank.
  put(`(${source.year || "n.d."}). `);

  const title = (source.title ?? "").trim();
  const container = (source.container ?? "").trim();

  if (source.type === "book") {
    put(title, true);
    put(endsSentence(title) ? " " : ". ");
    put(source.publisher ? `${source.publisher}.` : "");
  } else if (source.type === "chapter") {
    put(title);
    put(endsSentence(title) ? " " : ". ");
    put("In ");
    const editors = source.editors ?? [];
    if (editors.length) put(`${editorList(editors)}, `);
    put(container, true);
    if (source.pages) put(` (pp. ${source.pages})`);
    put(". ");
    put(source.publisher ? `${source.publisher}.` : "");
  } else {
    put(title);
    put(endsSentence(title) ? " " : ". ");
    put(container, true);
    if (source.volume) {
      put(", ");
      // The volume is italic and the issue is not — the detail people get wrong
      // when formatting by hand, and the reason this is worth a function.
      put(source.volume, true);
      if (source.issue) put(`(${source.issue})`);
    }
    if (source.pages) put(`, ${source.pages}`);
    put(".");
  }

  if (source.doi) {
    const url = `https://doi.org/${source.doi}`;
    // The separating space stays outside the link, so the underline in a
    // rendered reference starts at the URL rather than a space before it.
    put(" ");
    runs.push({ text: url, italic: false, href: url });
  }

  // Merge adjacent runs of the same style so a renderer never emits `*a**b*`,
  // and trim the trailing space a missing publisher leaves behind.
  const merged = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && last.italic === run.italic && !last.href && !run.href) {
      last.text += run.text;
    } else merged.push({ ...run });
  }
  if (merged.length) {
    merged[merged.length - 1].text = merged[merged.length - 1].text.trimEnd();
  }
  return merged.filter((run) => run.text);
}

/**
 * The reference as Markdown, with italics as emphasis.
 *
 * @param {Object}   source
 * @param {Function} [escape]  Applied to the *text* of each run and never to the
 *   emphasis markers. The exporter's `esc` escapes `*` and `_` among other
 *   things, so escaping the finished string instead would defuse the very
 *   emphasis this adds.
 * @returns {string}
 */
export function citationMarkdown(source, escape = (t) => t) {
  return citationRuns(source)
    .map(({ text, italic }) => {
      const body = escape(text);
      // Emphasis needs its markers flush against the text: `* title *` is not
      // emphasis in any Markdown dialect. Any surrounding space moves outside.
      if (!italic) return body;
      const [, before, core, after] = body.match(/^(\s*)([\s\S]*?)(\s*)$/);
      return core ? `${before}*${core}*${after}` : body;
    })
    .join("");
}

/**
 * The reference as one plain string, italics dropped.
 *
 * For accessible names, titles and tests — anywhere the runs would be noise.
 *
 * @param {Object} source
 * @returns {string}
 */
export function citationText(source) {
  return citationRuns(source)
    .map((run) => run.text)
    .join("");
}
