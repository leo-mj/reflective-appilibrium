/**
 * @fileoverview Generates and triggers an Argdown download of the RE state —
 * the elements as statements, the dialectical relations as statement-to-
 * statement relations, and every argument as a premise-conclusion structure.
 * See https://argdown.org/syntax/.
 *
 * The file is written in Argdown's loose mode, the default, which is the
 * dialectical family: `supports` is `+>` and `conflicts` is `->`. The
 * inferential family goes into premise-conclusion structures instead, where a
 * negated conclusion is a `not X` statement tied to `[X]` by `><`.
 *
 * Groups come first, under a `# Groups` heading, each a `##` heading over its
 * members, since a heading is what Argdown's maps draw as a group. The type
 * headings after them hold the rest. Both `# Groups` and the type headings
 * carry `{isGroup: false}`, so the maps box only the groups themselves.
 *
 * Unlike the markdown export this is not a restore format: it carries no state
 * block. {@link module:utils/importArgdown} reads it back as far as Argdown
 * allows, and one loss is built in: `undermines` has no symbol of its own, so
 * it is written as `->` and comes back as `conflicts`. The original type is
 * kept in a trailing comment for a human reader, but the parser drops comments.
 *
 * @module utils/exportArgdown
 */

/** @import { REState } from '../types.js' */

import { citationText } from "./citation.js";
import { groupsOf } from "./groupUtils.js";
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
 * Argdown has only support, attack and contradiction between statements, so one
 * of ours lands on a symbol it shares with another, and each line carries the
 * original type as a trailing comment:
 * - `supports` and `conflicts` are Argdown's loose-mode support (`+>`) and
 *   attack (`->`): a reason for and a reason against, neither a logical
 *   relation. Contradiction (`><`) is logical in both modes, and is kept for
 *   the negations in the arguments section.
 * - `undermines` is weaker than an attack, but the only other one Argdown has,
 *   undercut, runs from an argument to an inference; `->` is the nearest. The
 *   import reads it back as `conflicts`.
 */
const RELATION_SYMBOL = {
  supports: "+>",
  conflicts: "->",
  undermines: "->",
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

/**
 * A heading Argdown's maps should not draw as a box: the type headings sort the
 * file for a reader, and grouping is the group headings' business.
 */
const NOT_A_GROUP = "{isGroup: false}";

/** Type order first, then id — the order of the type sections. */
const TYPE_ORDER = TYPE_HEADINGS.map(([type]) => type);
const byTypeThenId = (a, b) =>
  TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
  sortElementIds(a.id, b.id);

function statementLines(el, dialectical) {
  const statusTag = el.status !== "active" ? ` #${el.status}` : "";
  return [
    `[${el.id}]: ${clean(el.text)} #${el.type}${statusTag} ${statementData(el)}`,
    ...dialectical.filter((r) => r.from === el.id).map(relationLine),
    "",
  ];
}

function statementsSection(elements, dialectical, byType) {
  const els = elements
    .filter((e) => e.type === byType[0])
    .sort((a, b) => sortElementIds(a.id, b.id));
  if (!els.length) return "";

  const lines = [`# ${byType[1]} ${NOT_A_GROUP}`, ""];
  for (const el of els) lines.push(...statementLines(el, dialectical));
  return lines.join("\n").trimEnd();
}

/**
 * Every group, each a second-level heading over its members of whatever type,
 * all under one `# Groups` heading — so a group reads as a different kind of
 * section from `# Judgments` at a glance. Argdown's maps draw each group heading
 * as a box, the import reads each back as a group, and `# Groups` itself opts
 * out of both. `isClosed` is Argdown's own word for a collapsed group.
 */
function groupsSection(groups, dialectical) {
  if (!groups.length) return "";
  const lines = [`# Groups ${NOT_A_GROUP}`, ""];
  for (const { group, members } of groups) {
    const title = clean(group.label) || group.id;
    lines.push(`## ${title}${group.collapsed ? " {isClosed: true}" : ""}`, "");
    for (const el of [...members].sort(byTypeThenId))
      lines.push(...statementLines(el, dialectical));
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
  const lines = [`# Arguments ${NOT_A_GROUP}`, ""];
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

  // A group left with one exported member — the rest `possible` — is not a
  // group any more, and its member goes under its type heading.
  const byId = new Map(elements.map((e) => [e.id, e]));
  const groups = groupsOf(state)
    .map((g) => ({
      group: g,
      members: g.members.map((id) => byId.get(id)).filter(Boolean),
    }))
    .filter(({ members }) => members.length > 1);
  const grouped = new Set(
    groups.flatMap(({ members }) => members.map((e) => e.id)),
  );
  const ungrouped = elements.filter((e) => !grouped.has(e.id));

  const frontmatter = [
    "===",
    `title: ${JSON.stringify(state.topic ?? "")}`,
    `subTitle: ${JSON.stringify(`Reflective equilibrium, round ${state.round}, ${date}`)}`,
    "===",
  ].join("\n");

  const parts = [
    frontmatter,
    groupsSection(groups, active),
    ...TYPE_HEADINGS.map((t) => statementsSection(ungrouped, active, t)),
    argumentsSection(
      collectArguments(
        relations.filter((r) => ARGUMENT_RELATION_TYPES.has(r.type)),
      ),
    ),
    inactive.length
      ? [`# Withdrawn relations ${NOT_A_GROUP}`, "", ...inactive.map(inactiveRelationLine)].join("\n")
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
