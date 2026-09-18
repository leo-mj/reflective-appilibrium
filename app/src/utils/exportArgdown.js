/**
 * @fileoverview Generates and triggers an Argdown download of the RE state —
 * the elements as statements, the dialectical relations as statement-to-
 * statement relations, and every argument as a premise-conclusion structure.
 * See https://argdown.org/syntax/.
 *
 * Unlike the markdown export this is not a restore format: it carries no
 * state block, and nothing reads it back. It is for the Argdown toolchain.
 *
 * @module utils/exportArgdown
 */

/** @import { REState } from '../types.js' */

import { citationText } from "./citation.js";
import { ARGUMENT_RELATION_TYPES, sortElementIds } from "./stateUtils.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_HEADINGS = [
  ["judgment", "Judgments"],
  ["principle", "Principles"],
  ["theory", "Background theories"],
];

/** Relation statuses that take a relation out of the position. */
const INACTIVE = new Set(["withdrawn", "rejected"]);

/**
 * Dialectical relation → Argdown's outgoing statement-to-statement symbol.
 *
 * Argdown has only support, attack and contradiction between statements, so two
 * of ours land on a symbol they share with another, and each line carries the
 * original type as a trailing comment:
 * - `conflicts` is incompatibility — both cannot be true, both may be false —
 *   which is Argdown's contrariness (`->`), not its contradiction (`><`).
 * - `undermines` is weaker than that, but the only other attack Argdown has,
 *   undercut, runs from an argument to an inference; `->` is the nearest.
 * - `depends` (A presupposes B) means A cannot be true without B, i.e. A
 *   entails B, which is what `+>` asserts between statements.
 */
const RELATION_SYMBOL = {
  supports: "+>",
  conflicts: "->",
  undermines: "->",
  depends: "+>",
};

const NEGATING = new Set(["precludes", "jointly_precludes"]);

/**
 * Statement text on one line, with the characters Argdown would read as syntax
 * defused: brackets would open a statement or argument reference, `#` a tag,
 * `{` a data block, `//` a comment.
 */
function clean(text) {
  return (text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/</g, "‹")
    .replace(/>/g, "›")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/#/g, "＃")
    .replace(/\/\//g, "/ /")
    .replace(/\/\*/g, "/ *");
}

/** A comment is only broken by a newline. */
function commentText(text) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Title of the statement a precluding argument concludes. */
const negationTitle = (id) => `not ${id}`;

function statementData(el) {
  const data = { confidence: el.confidence };
  if (el.origin) data.origin = el.origin;
  if (el.addedRound != null) data.addedRound = el.addedRound;
  if (el.sources?.length) data.sources = el.sources.map(citationText);
  // JSON is valid YAML flow syntax, so each value arrives quoted and escaped.
  return `{${Object.entries(data)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ")}}`;
}

function relationLine(r) {
  const why = r.explanation ? `: ${commentText(r.explanation)}` : "";
  return `  ${RELATION_SYMBOL[r.type]} [${r.to}] // ${r.type}${why}`;
}

function inactiveRelationLine(r) {
  const why = r.explanation ? `: ${commentText(r.explanation)}` : "";
  return `// ${r.status}: [${r.from}] ${r.type} [${r.to}]${why}`;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function statementsSection(elements, dialectical, byType) {
  const els = elements
    .filter((e) => e.type === byType[0])
    .sort((a, b) => sortElementIds(a.id, b.id));
  if (!els.length) return "";

  const lines = [`# ${byType[1]}`, ""];
  for (const el of els) {
    const statusTag = el.status !== "active" ? ` #${el.status}` : "";
    lines.push(
      `[${el.id}]: ${clean(el.text)} #${el.type}${statusTag} ${statementData(el)}`,
    );
    for (const r of dialectical.filter((r) => r.from === el.id)) {
      lines.push(relationLine(r));
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/**
 * Groups the inferential relations into arguments by `argumentId`. A relation
 * without one (older states) is an argument of its own.
 */
function collectArguments(relations) {
  const byId = new Map();
  relations.forEach((r, i) => {
    const key = r.argumentId ?? `single-${i}`;
    if (!byId.has(key)) byId.set(key, []);
    byId.get(key).push(r);
  });
  return [...byId.values()].map((rels) => ({
    premises: [...new Set(rels.map((r) => r.from))],
    conclusion: rels[0].to,
    negated: NEGATING.has(rels[0].type),
    explanation: rels.find((r) => r.explanation)?.explanation ?? "",
    status: rels[0].status,
    addedRound: rels[0].addedRound,
  }));
}

function argumentsSection(args) {
  if (!args.length) return "";
  const lines = ["# Arguments", ""];
  const negationsDefined = new Set();

  args.forEach((arg, i) => {
    const title = `Argument ${i + 1}`;
    const inactive = INACTIVE.has(arg.status);
    const block = [];

    const desc = arg.explanation ? `: ${clean(arg.explanation)}` : "";
    const round = arg.addedRound != null ? ` {addedRound: ${arg.addedRound}}` : "";
    block.push(`<${title}>${desc}${round}`, "");
    arg.premises.forEach((p, j) => block.push(`(${j + 1}) [${p}]`));
    block.push("----");

    const n = arg.premises.length + 1;
    if (!arg.negated) {
      block.push(`(${n}) [${arg.conclusion}]`);
    } else {
      // Argdown has no negation operator, so the negated conclusion is its own
      // statement, defined once and tied to the original as its contradiction.
      const neg = negationTitle(arg.conclusion);
      if (negationsDefined.has(neg) || inactive) {
        block.push(`(${n}) [${neg}]`);
      } else {
        negationsDefined.add(neg);
        block.push(
          `(${n}) [${neg}]: It is not the case that @[${arg.conclusion}].`,
          `  >< [${arg.conclusion}]`,
        );
      }
    }

    if (inactive) {
      lines.push(`// ${title} (${arg.status})`);
      block.forEach((l) => lines.push(l ? `// ${l}` : "//"));
    } else {
      lines.push(...block);
    }
    lines.push("");
  });
  return lines.join("\n").trimEnd();
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Renders `state` as an Argdown document.
 *
 * `possible` elements — options offered but never affirmed — are left out, and
 * so is every relation touching one. Withdrawn and rejected relations are kept
 * as comments, so the record survives without entering the map.
 *
 * @param {REState} state
 * @returns {string}
 */
export function buildArgdown(state) {
  const date = new Date().toISOString().slice(0, 10);
  const elements = state.elements.filter((e) => e.status !== "possible");
  const ids = new Set(elements.map((e) => e.id));
  const relations = state.relations.filter(
    (r) => ids.has(r.from) && ids.has(r.to),
  );

  const dialectical = relations.filter(
    (r) => !ARGUMENT_RELATION_TYPES.has(r.type),
  );
  const active = dialectical.filter((r) => !INACTIVE.has(r.status));
  const inactive = dialectical.filter((r) => INACTIVE.has(r.status));

  const frontmatter = [
    "===",
    `title: ${JSON.stringify(state.topic ?? "")}`,
    `subTitle: ${JSON.stringify(`Reflective equilibrium, round ${state.round}, ${date}`)}`,
    "===",
  ].join("\n");

  const parts = [
    frontmatter,
    ...TYPE_HEADINGS.map((t) => statementsSection(elements, active, t)),
    argumentsSection(
      collectArguments(
        relations.filter((r) => ARGUMENT_RELATION_TYPES.has(r.type)),
      ),
    ),
    inactive.length
      ? ["# Withdrawn relations", "", ...inactive.map(inactiveRelationLine)].join("\n")
      : "",
  ].filter(Boolean);

  return parts.join("\n\n") + "\n";
}

/**
 * Generates an Argdown document from `state` and triggers a browser download.
 *
 * @param {REState} state
 */
export function downloadArgdown(state) {
  const argdown = buildArgdown(state);
  const slug = state.topic.slice(0, 30).replace(/\s+/g, "-").toLowerCase();
  const filename = `re-${slug}-round${state.round}.argdown`;

  const blob = new Blob([argdown], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
