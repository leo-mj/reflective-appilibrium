/**
 * @fileoverview Reads an Argdown document into a fresh RE state — the way into
 * the app for an argument map written elsewhere, such as the reconstruction of
 * a paper. See https://argdown.org/syntax/.
 *
 * The inverse of {@link module:utils/exportArgdown} as far as Argdown allows,
 * so an exported file comes back as the position it was, minus what Argdown
 * cannot hold (history, log, reviews, `undermines`). A file
 * written by hand gets the same reading:
 *
 * - **Statements** become elements. `#judgment`, `#principle` and `#theory`
 *   choose the type; an untagged statement is a judgment, which the domain
 *   model allows at any generality. `#withdrawn` and `#rejected` set the status,
 *   and `{confidence: 0.8}` the confidence (default 0.67, the add form's).
 * - **Arguments with a premise-conclusion structure** become inferential
 *   relations, one argument per inference step: one premise is `entails`,
 *   several `jointly_entails`. A step's premises are the statements since the
 *   previous conclusion, that conclusion included, unless the inference line
 *   names them: `-- {uses: [1, 3]} --`. A conclusion titled `not X` that is
 *   tied to `[X]` by `><` — the exporter's spelling of a negation — makes the
 *   step `precludes` X, and is not an element of its own.
 * - **Arguments without one** are elements: their description is the claim a
 *   map node stands for, and without premises there is no inference to draw.
 * - **Statement relations** follow Argdown's interpretation mode, which the
 *   parser reads from the front matter (`model: {mode: strict}`); loose is the
 *   default. Loose mode is the dialectical family and strict mode the
 *   inferential one:
 *
 *   | Argdown         | Loose mode  | Strict mode |
 *   |-----------------|-------------|-------------|
 *   | `+>` support    | supports    | entails     |
 *   | `->` attack     | conflicts   | precludes   |
 *   | `><` contradict | precludes   | precludes   |
 *
 *   Strict `->` is contrariety — not both true — which is A entailing not-B.
 *   `><` is logical in either mode and keeps only that half: its "not both
 *   false" has no counterpart, which the log entry says. Each `entails` or
 *   `precludes` read this way is a one-premise argument of its own, unless a
 *   premise-conclusion structure already holds it. The `><` tying an
 *   exporter's `not X` to `[X]` is the exception: it is read into that
 *   argument, above, and is not a relation.
 *
 * - **Headings** become groups, as they do in Argdown's own maps: each element
 *   joins the nearest heading above its definition, unless that heading says
 *   `{isGroup: false}`, and `{isClosed: true}` makes the group collapsed.
 *   Groups here do not nest, so an inner heading is a group of its own, and a
 *   heading over a single statement is none. The exporter marks its `# Groups`
 *   and type headings `{isGroup: false}`, so only the groups under the first
 *   are read as groups.
 *
 * Two Argdown relations have no RE counterpart and are left out, each counted
 * in the import's log entry: an undercut (`_>`), which attacks an inference
 * rather than a claim, and a support or attack aimed at a whole reconstructed
 * argument, which Argdown leaves unassigned to any one premise.
 *
 * Statement titles do not survive — an element's id is its type letter and a
 * number — so the log entry spells out which title became which id. A title
 * that already is such an id, of the element's own type, is kept: that is what
 * makes an exported file come back with the same ids.
 *
 * The parser is loaded on first use, so it adds nothing to the main bundle.
 *
 * @module utils/importArgdown
 */

/** @import { REState, REElement, RERelation } from '../types.js' */

import { validateState } from "./importMarkdown.js";
import {
  argumentRelationType,
  makeLogEntry,
  newArgumentId,
  nextElementId,
} from "./stateUtils.js";

const MAX_FILE_SIZE = 500_000; // 500 KB, as for a markdown import
const DEFAULT_CONFIDENCE = 0.67;
const TYPE_TAGS = ["judgment", "principle", "theory"];
const STATUS_TAGS = ["withdrawn", "rejected"];
const ID_PREFIX = { judgment: "J", principle: "P", theory: "T" };
/** The log's text fields are capped at 5 000 characters on import. */
const MAX_LOG_TEXT = 4_000;

/**
 * Argdown's statement relation → ours. The parser has already applied the
 * mode: loose gives `support` and `attack`, strict `entails` and `contrary`,
 * and both give `contradictory`. An inferential type carries `negated`, for
 * `argumentRelationType`.
 */
const STATEMENT_RELATION = {
  support: { type: "supports" },
  attack: { type: "conflicts" },
  entails: { negated: false },
  contrary: { negated: true },
  contradictory: { negated: true },
};

/** Whether `file` should be read as Argdown rather than as an exported state. */
export function isArgdownFile(file) {
  return /\.(argdown|ad)$/i.test(file?.name ?? "");
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Runs the Argdown parser and model builder over `text`.
 *
 * @param {string} text
 * @returns {Promise<Object>} Argdown's response: statements, arguments,
 *   relations, plus `interpretationMode`, the mode the model plugin applied.
 * @throws {Error} On a syntax error, with its line — a partial map would be
 *   imported without anyone knowing what was lost.
 */
async function parseArgdown(text) {
  const { ArgdownApplication, ParserPlugin, DataPlugin, ModelPlugin } =
    await import("@argdown/core");
  const app = new ArgdownApplication();
  app.addPlugin(new ParserPlugin(), "parse-input");
  app.addPlugin(new DataPlugin(), "build-model");
  app.addPlugin(new ModelPlugin({ removeTagsFromText: true }), "build-model");
  const request = {
    process: ["parse-input", "build-model"],
    input: text,
    logLevel: "none",
  };
  const response = app.run(request);
  // The front matter's `model:` is merged into the request, and the plugin
  // reads its mode from there — so this is the mode the relations were built
  // in, not a second reading of the front matter.
  response.interpretationMode =
    request.model?.mode === "strict" ? "strict" : "loose";

  const [error] = [
    ...(response.lexerErrors ?? []),
    ...(response.parserErrors ?? []),
  ];
  if (error) {
    const line = error.line ?? error.token?.startLine;
    throw new Error(
      `Argdown syntax error${line ? ` on line ${line}` : ""}: ${error.message}`,
    );
  }
  return response;
}

// ─── Reading the model ────────────────────────────────────────────────────────

/** The text Argdown itself would show for a statement or argument. */
function canonicalText(node) {
  const members = node.members ?? [];
  for (let i = members.length - 1; i >= 0; i--) {
    const m = members[i];
    if (!m.isReference && m.text?.trim())
      return m.text.replace(/\s+/g, " ").trim();
  }
  return "";
}

/** Type, status and confidence from a node's tags and data. */
function readAttributes(node, title, notes) {
  const tags = (node.tags ?? []).map((t) => t.toLowerCase());
  const types = TYPE_TAGS.filter((t) => tags.includes(t));
  if (types.length > 1)
    notes.push(
      `[${title}] is tagged ${types.map((t) => `#${t}`).join(" and ")}; read as a ${types[0]}.`,
    );
  const type = types[0] ?? "judgment";
  const status = STATUS_TAGS.find((t) => tags.includes(t)) ?? "active";

  const raw = Number(node.data?.confidence);
  const confidence =
    Number.isFinite(raw) && node.data?.confidence !== ""
      ? Math.min(1, Math.max(0, raw))
      : DEFAULT_CONFIDENCE;
  const origin =
    typeof node.data?.origin === "string" && node.data.origin.trim()
      ? node.data.origin.trim().slice(0, 200)
      : "user";
  return { type, status, confidence, origin, typed: types.length > 0 };
}

/**
 * The nearest heading above a node that is a group, or null. Argdown reads
 * every heading as one unless it says `{isGroup: false}`, and so does this.
 */
function groupSectionOf(node) {
  let s = node.section;
  while (s && s.isGroup === false) s = s.parent;
  return s ?? null;
}

/** Whether an argument has a premise-conclusion structure to read. */
const isReconstructed = (arg) => (arg.pcs?.length ?? 0) > 0;

/**
 * Statements that are only the negation of another, written as the exporter
 * writes one: titled `not X`, tied to `[X]` by `><` and by nothing else, and
 * never a premise. Keyed by title, valued by the title of X.
 */
function findNegations(statements) {
  const negations = new Map();
  for (const [title, ec] of Object.entries(statements)) {
    const m = /^not (.+)$/.exec(title);
    if (!m || !statements[m[1]] || ec.isUsedAsPremise) continue;
    const rels = ec.relations ?? [];
    const onlyContradicts =
      rels.length > 0 &&
      rels.every(
        (r) =>
          r.relationType === "contradictory" &&
          [r.from.title, r.to.title].includes(m[1]),
      );
    if (onlyContradicts) negations.set(title, m[1]);
  }
  return negations;
}

/**
 * The PCS positions (0-based) of each inference step's premises. Explicit
 * `uses` data wins; otherwise a step reads everything since the previous
 * conclusion, that conclusion included.
 */
function inferenceSteps(pcs) {
  const steps = [];
  let start = 0;
  pcs.forEach((s, k) => {
    if (s.role !== "intermediary-conclusion" && s.role !== "main-conclusion")
      return;
    const uses = s.inference?.data?.uses;
    const premises = Array.isArray(uses)
      ? uses
          .map((n) => Number(n) - 1)
          .filter((i) => Number.isInteger(i) && i >= 0 && i < k)
      : Array.from({ length: k - start }, (_, j) => start + j);
    steps.push({
      conclusion: k,
      premises,
      rules: s.inference?.inferenceRules ?? [],
    });
    start = k;
  });
  return steps;
}

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Converts a parsed Argdown model into an RE state at round 1.
 *
 * @param {Object} model - Argdown's response, from `parseArgdown`.
 * @param {string} fallbackTopic - Used when the front matter has no title.
 * @returns {REState}
 */
export function modelToState(model, fallbackTopic) {
  const statements = model.statements ?? {};
  const args = model.arguments ?? {};
  const notes = [];
  const negations = findNegations(statements);

  // Every node that becomes an element, in document order: statements first,
  // then the arguments that have no structure to become relations.
  const nodes = [
    ...Object.entries(statements)
      .filter(([title]) => !negations.has(title))
      .map(([title, node]) => ({
        key: `s:${title}`,
        title,
        node,
        isArgument: false,
      })),
    ...Object.entries(args)
      .filter(([, arg]) => !isReconstructed(arg))
      .map(([title, node]) => ({
        key: `a:${title}`,
        title,
        node,
        isArgument: true,
      })),
  ].map((n) => ({ ...n, ...readAttributes(n.node, n.title, notes) }));

  // A title that is already a well-formed id of the element's type keeps it;
  // everything else is numbered after those, so nothing is taken twice.
  const idOf = new Map();
  const taken = new Set();
  for (const n of nodes) {
    const m = /^([JPT])(\d{1,6})$/.exec(n.title);
    if (
      !n.isArgument &&
      m &&
      m[1] === ID_PREFIX[n.type] &&
      !taken.has(n.title)
    ) {
      idOf.set(n.key, n.title);
      taken.add(n.title);
    }
  }
  const renamed = [];
  const elements = [];
  for (const n of nodes) {
    if (!idOf.has(n.key)) {
      const id = nextElementId(
        [...taken].map((id) => ({ id })),
        n.type,
      );
      idOf.set(n.key, id);
      taken.add(id);
      if (!/^Untitled \d+$/.test(n.title))
        renamed.push(
          `${n.isArgument ? `<${n.title}>` : `[${n.title}]`} → ${id}`,
        );
    }
    const id = idOf.get(n.key);
    const text = canonicalText(n.node) || n.title;
    /** @type {REElement} */
    const element = {
      id,
      type: n.type,
      status: n.status,
      confidence: n.confidence,
      origin: n.origin,
      text,
      addedRound: 1,
    };
    if (n.status !== "active") element.history = [{ round: 1, type: n.status }];
    elements.push(element);
  }

  // Headings: each element joins the nearest one above it that is a group. The
  // app's groups are flat, so a heading nested in another keeps its own
  // statements and the outer one keeps the rest.
  const sections = new Map();
  for (const n of nodes) {
    const s = groupSectionOf(n.node);
    if (!s) continue;
    if (!sections.has(s)) sections.set(s, []);
    sections.get(s).push(idOf.get(n.key));
  }
  const bySection = [...sections].sort(
    ([a], [b]) => (a.startLine ?? 0) - (b.startLine ?? 0),
  );
  const groups = bySection
    .filter(([, members]) => members.length > 1)
    .map(([s, members], i) => ({
      id: `G${i + 1}`,
      label: s.title.slice(0, 200) || `Group ${i + 1}`,
      members,
      collapsed: s.isClosed === true,
    }));
  const lone = bySection.length - groups.length;
  if (lone)
    notes.push(
      `${lone} heading${lone === 1 ? "" : "s"} over a single statement ${lone === 1 ? "was" : "were"} not made ${lone === 1 ? "a group" : "groups"}.`,
    );
  const nested = bySection.filter(
    ([s, members]) =>
      members.length > 1 && groupSectionOf({ section: s.parent }),
  ).length;
  if (nested)
    notes.push(
      `${nested} nested heading${nested === 1 ? "" : "s"} became ${nested === 1 ? "a group" : "groups"} of ${nested === 1 ? "its" : "their"} own: groups here do not nest.`,
    );

  const untyped = nodes.filter((n) => !n.typed).length;
  if (untyped)
    notes.push(
      `${untyped} statement${untyped === 1 ? "" : "s"} without #judgment, #principle or #theory ${untyped === 1 ? "was" : "were"} read as ${untyped === 1 ? "a judgment" : "judgments"}.`,
    );
  const structureless = nodes.filter((n) => n.isArgument).length;
  if (structureless)
    notes.push(
      `${structureless} argument${structureless === 1 ? "" : "s"} without premises and conclusion became ${structureless === 1 ? "an element" : "elements"}, from ${structureless === 1 ? "its" : "their"} description.`,
    );

  /** The element id a relation end refers to, or null for none. */
  const endpoint = (node) => {
    if (node.type === "equivalence-class")
      return idOf.get(`s:${node.title}`) ?? null;
    if (node.type === "argument") return idOf.get(`a:${node.title}`) ?? null;
    return null;
  };

  /** @type {RERelation[]} */
  const relations = [];
  const seen = new Set();
  // Every from/type/to an argument already holds, whichever argument it is.
  const argued = new Set();
  const push = (rel) => {
    const key = `${rel.from} ${rel.type} ${rel.to} ${rel.argumentId ?? ""}`;
    if (rel.from === rel.to || seen.has(key)) return;
    seen.add(key);
    if (rel.argumentId) argued.add(`${rel.from} ${rel.type} ${rel.to}`);
    relations.push(rel);
  };

  // Arguments with a structure: one argument per inference step.
  for (const arg of Object.values(args).filter(isReconstructed)) {
    const pcsId = (s) => idOf.get(`s:${s.title}`) ?? null;
    const description = canonicalText(arg);
    for (const step of inferenceSteps(arg.pcs)) {
      const concl = arg.pcs[step.conclusion];
      const negated = negations.get(concl.title);
      const to = negated ? idOf.get(`s:${negated}`) : pcsId(concl);
      const premises = [
        ...new Set(step.premises.map((i) => pcsId(arg.pcs[i]))),
      ].filter((p) => p && p !== to);
      if (!to || !premises.length) continue;
      const type = argumentRelationType(premises.length, !!negated);
      const rule = step.rules.length
        ? `Inference: ${step.rules.join(", ")}.`
        : "";
      const explanation = [description, rule]
        .filter(Boolean)
        .join(" ")
        .slice(0, 2_000);
      const argumentId = newArgumentId();
      for (const from of premises)
        push({ from, to, type, explanation, addedRound: 1, argumentId });
    }
  }

  // Relations between claims.
  let undercuts = 0;
  let atArguments = 0;
  let contradictions = 0;
  for (const r of model.relations ?? []) {
    if (r.relationType === "undercut") {
      undercuts++;
      continue;
    }
    const from = endpoint(r.from);
    const to = endpoint(r.to);
    if (!from || !to) {
      // A negation absorbed into a `precludes` is not a lost relation.
      if (
        r.relationType === "contradictory" &&
        [r.from.title, r.to.title].some((t) => negations.has(t))
      )
        continue;
      atArguments++;
      continue;
    }
    const mapped = STATEMENT_RELATION[r.relationType];
    if (!mapped) continue;
    if (mapped.type) {
      push({ from, to, type: mapped.type, explanation: "", addedRound: 1 });
      continue;
    }
    // An inferential relation between two statements is a one-premise argument.
    const type = argumentRelationType(1, mapped.negated);
    if (from === to || argued.has(`${from} ${type} ${to}`)) continue;
    if (r.relationType === "contradictory") contradictions++;
    push({
      from,
      to,
      type,
      explanation: "",
      addedRound: 1,
      argumentId: newArgumentId(),
    });
  }
  if (contradictions)
    notes.push(
      `${contradictions} contradiction${contradictions === 1 ? "" : "s"} (><) read as precludes, which keeps only ${contradictions === 1 ? "its" : "their"} "not both true" half: the "not both false" half has no counterpart here.`,
    );
  if (undercuts)
    notes.push(
      `${undercuts} undercut${undercuts === 1 ? "" : "s"} (_>) left out: an attack on an inference has no counterpart here.`,
    );
  if (atArguments)
    notes.push(
      `${atArguments} relation${atArguments === 1 ? "" : "s"} to or from a whole reconstructed argument left out: aim ${atArguments === 1 ? "it" : "them"} at a premise or the conclusion to keep ${atArguments === 1 ? "it" : "them"}.`,
    );

  const title = model.frontMatter?.title;
  const topic = (
    typeof title === "string" && title.trim() ? title.trim() : fallbackTopic
  ).slice(0, 500);
  const clip = (s) =>
    s.length > MAX_LOG_TEXT ? `${s.slice(0, MAX_LOG_TEXT - 1)}…` : s;
  const mode =
    model.interpretationMode === "strict"
      ? "Read in strict mode."
      : "Read in loose mode (the default).";
  const grouping = groups.length
    ? ` Grouped by heading: ${groups.map((g) => `"${g.label}"`).join(", ")}.`
    : "";
  const changes = `${mode} Added ${elements.length} element${elements.length === 1 ? "" : "s"} and ${relations.length} relation${relations.length === 1 ? "" : "s"}.${grouping}${renamed.length ? ` Renamed: ${renamed.join(", ")}.` : ""}`;

  return validateState({
    topic,
    phase: 1,
    round: 1,
    elements,
    relations,
    coherence: { tensions: [], orphans: [], clusters: [] },
    ...(groups.length ? { groups } : {}),
    log: [
      makeLogEntry(
        1,
        clip(
          notes.length
            ? `Imported from Argdown. ${notes.join(" ")}`
            : "Imported from Argdown.",
        ),
        "Imported",
        clip(changes),
      ),
    ],
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Reads an Argdown File into a fresh RE state.
 *
 * @param {File} file
 * @returns {Promise<REState>}
 * @throws {Error} With a user-readable message on any failure.
 */
export async function importArgdownFromFile(file) {
  if (file.size > MAX_FILE_SIZE)
    throw new Error(
      `File too large (max 500 KB, got ${Math.round(file.size / 1024)} KB).`,
    );
  const model = await parseArgdown(await file.text());
  const state = modelToState(model, file.name.replace(/\.(argdown|ad)$/i, ""));
  if (!state.elements.length)
    throw new Error("No statements or arguments found in that Argdown file.");
  return state;
}
