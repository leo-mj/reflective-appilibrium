/**
 * @fileoverview Generates and triggers a markdown download of the RE state.
 * Covers the Text tab (elements, relations, coherence), Graph tab (SVG),
 * Clusters tab (cluster analysis with per-cluster SVGs), an Argdown rendering,
 * and the machine-readable state block Import reads back — each a section the
 * reader picks in the Export dialog ({@link EXPORT_SECTIONS}).
 * @module utils/exportMarkdown
 */

/** @import { REState, PositionMap } from '../types.js' */

import {
  findCoherentClusters,
  findCrossClusterTensions,
  findMergeCandidates,
} from "./clusterUtils.js";
import { buildPrincipleCovers } from "./textTabHelpers.js";
import { citationMarkdown } from "./citation.js";
import {
  sortElementIds,
  historyOf,
  reviewsOf,
  roundOfStep,
  currentRound,
} from "./stateUtils.js";
import { groupsOf } from "./groupUtils.js";
import { generateGraphSVG, svgToDataUrl } from "./generateSVG.js";
import { STATEMENT_CARD, statementGraph } from "./statementCards.js";
import { pageFontFamily, textMeasurer } from "./textWidth.js";
import { processesOf, processTagMap } from "./mergeStates.js";
import { buildArgdown } from "./exportArgdown.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Escapes free text for safe embedding in a markdown document. */
function esc(text) {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^([ \t]*)(\d+)[.)]/gm, "$1$2\\.") // numbered lists
    .replace(/([*_`#|[\]\\])/g, "\\$1");
}

// ─── Sections ─────────────────────────────────────────────────────────────────

const STATUS_TAG = {
  withdrawn: " *(withdrawn)*",
  revised: " *(revised)*",
  rejected: " *(rejected)*",
};

/** One human-readable line per recorded event, oldest first. */
function historyEntries(item) {
  return historyOf(item).map((ev) => {
    switch (ev.type) {
      case "revised":
        return `Step ${ev.round}: reworded${
          ev.previousText ? ` from "${esc(ev.previousText)}"` : ""
        }`;
      case "withdrawn":
        return `Step ${ev.round}: withdrawn${
          ev.reason ? ` — ${esc(ev.reason)}` : ""
        }`;
      case "reinstated":
        return `Step ${ev.round}: reinstated`;
      case "rejected":
        return `Step ${ev.round}: rejected`;
      default:
        return `Step ${ev.round}: ${esc(ev.type)}`;
    }
  });
}

/**
 * The works an element is attributed to, in APA 7.
 *
 * The label carries the provenance, and does so here rather than only on screen:
 * an exported document is the artefact someone might go on to cite *from*, so a
 * caveat that lived in the UI alone would evaporate at exactly the moment it
 * started to matter. What it can honestly say is narrow — these were named by a
 * model, and a Crossref match (the DOI) establishes that a work exists, never
 * that it says what the element claims.
 */
function sourcesLines(el) {
  if (!el.sources?.length) return "";
  const refs = el.sources
    // `esc` escapes `*` and `_`, so it is passed *into* the formatter to be
    // applied per run — escaping the finished string would put a backslash in
    // front of every emphasis marker the formatter had just added.
    .map((s) => `\n> ${citationMarkdown(s, esc)}`)
    .join("");
  return `\n\n*Sources (AI-generated, unverified):*${refs}`;
}

function elementsSection(elements, type, label, pCovers, processTags) {
  const els = elements.filter((e) => e.type === type);
  if (!els.length) return "";
  const lines = [`### ${label}\n`];
  for (const el of els) {
    const statusTag = STATUS_TAG[el.status] ?? "";
    const covers = pCovers[el.id]?.length
      ? `\n*Covers: ${pCovers[el.id].join(", ")}*`
      : "";
    const bodyText =
      el.status === "withdrawn" ? `~~${esc(el.text)}~~` : esc(el.text);
    // The full trail, so a wording revised more than once is still recoverable
    // from the prose and not only from the JSON block.
    const trail = historyEntries(el)
      .map((line) => `\n> ${line}`)
      .join("");
    const process = processTags.has(el.id)
      ? ` · process ${processTags.get(el.id)}`
      : "";
    lines.push(
      `**${el.id}** · ${el.confidence}${process}${statusTag}\n${bodyText}${covers}${trail}` +
        `${sourcesLines(el)}\n`,
    );
  }
  return lines.join("\n");
}

function relationsSection(relations) {
  if (!relations.length) return "";
  const lines = relations.map((r) => {
    const statusTag = STATUS_TAG[r.status] ?? "";
    const explanation = r.explanation ? `: ${esc(r.explanation)}` : "";
    const trail = historyEntries(r)
      .map((line) => `\n  - ${line}`)
      .join("");
    return `- **${r.from}** → *${r.type}* → **${r.to}**${statusTag}${explanation}${trail}`;
  });
  return "## Relations\n\n" + lines.join("\n");
}

/**
 * The user's groups, as prose.
 *
 * The graph image below already shows them, but an export is also read as text
 * — and a collapsed group's members are, by construction, the elements the
 * picture does not name.
 */
function groupsSection(groups) {
  if (!groups.length) return "";
  const lines = groups.map(
    (g) =>
      `- **${esc(g.label)}**${g.collapsed ? " *(collapsed)*" : ""}: ${g.members.join(", ")}`,
  );
  return "## Groups\n\n" + lines.join("\n");
}

/**
 * The key to the letters the graph images put on nodes after a merge. A key the
 * picture lacks, like the canvas's legend, so it is written here in prose.
 */
function processesSection(processes) {
  if (!processes.length) return "";
  const lines = processes.map(
    (p) =>
      `- **${esc(p.id)}** — ${esc(p.label)}` +
      `${p.round != null ? ` *(merged at step ${p.round})*` : ""}: ${[...p.members].sort(sortElementIds).join(", ")}`,
  );
  return (
    "## Merged Processes\n\nElements fused from two processes carry both letters.\n\n" +
    lines.join("\n")
  );
}

/**
 * The graph as the reader left it — as cards when the Graph tab is showing
 * statements. That one view setting is followed and no other: a picture drawn
 * some other way than the reader chose to look at the graph is not the graph
 * as they left it, while the palette and the like are how *they* read it, not
 * what it says.
 *
 * Laid out afresh (`statementGraph`), so it agrees with the canvas in all but
 * the few pixels the canvas's warm-started pass may have left a card off.
 */
function graphSection(elements, relations, positions, groups, processTags, statements) {
  // As `generateGraphSVG` would show them — the cards are laid out among the
  // elements actually drawn, not among withdrawn ones it will drop.
  const shown = elements.filter((e) => e.status !== "withdrawn");
  const shownIds = new Set(shown.map((e) => e.id));
  const shownRels = relations.filter(
    (r) => shownIds.has(r.from) && shownIds.has(r.to),
  );
  const fontFamily = pageFontFamily();
  const view = statements
    ? statementGraph(
        shown,
        shownRels,
        positions,
        groups,
        textMeasurer(`${STATEMENT_CARD.fontSize}px ${fontFamily}`),
      )
    : null;
  const svg = generateGraphSVG(
    view?.elements ?? shown,
    shownRels,
    view?.positions ?? positions,
    { groups, processTags, ...(fontFamily && { fontFamily }) },
  );
  if (!svg) return "";
  return (
    '## Graph\n\n<img src="' + svgToDataUrl(svg) + '" style="max-width:100%"/>'
  );
}

function clustersSection(state, positions, processTags) {
  const clusters = findCoherentClusters(state);
  if (!clusters.length) return "";

  const lines = ["## Clusters"];
  clusters.forEach((cluster, i) => {
    const members = [...cluster.members].sort(sortElementIds).join(", ");
    const clusterEls = state.elements.filter((e) => cluster.members.has(e.id));
    const clusterRels = state.relations.filter(
      (r) => cluster.members.has(r.from) && cluster.members.has(r.to),
    );
    const svg = generateGraphSVG(clusterEls, clusterRels, positions, {
      processTags,
    });
    const imgTag = svg
      ? '\n\n<img src="' + svgToDataUrl(svg) + '" style="max-width:100%"/>'
      : "";
    lines.push(`\n### Cluster ${i + 1}\n\n**Members:** ${members}${imgTag}`);
  });

  const tensions = findCrossClusterTensions(clusters, state);
  if (tensions.length) {
    lines.push("\n### Cross-cluster tensions\n");
    tensions.forEach((t) => {
      lines.push(
        `- **${t.edge.from}** *${t.edge.type}* **${t.edge.to}** ` +
          `(Cluster ${t.clusterIndices[0] + 1} ↔ Cluster ${t.clusterIndices[1] + 1})`,
      );
    });
  }

  const merges = findMergeCandidates(clusters, state);
  if (merges.length) {
    lines.push("\n### Merge candidates\n");
    merges.forEach((m) => {
      const status =
        m.conflictsToResolve.length === 0
          ? "ready to merge"
          : `resolve ${m.conflictsToResolve.length} conflict(s)`;
      lines.push(
        `- Cluster ${m.clusterIndices[0] + 1} + Cluster ${m.clusterIndices[1] + 1}: ` +
          `${status} (merged size: ${m.mergedSize}${m.wouldBeClean ? ", would be clean" : ""})`,
      );
    });
  }

  return lines.join("\n");
}

function coherenceSection({ tensions, orphans, clusters }) {
  if (!tensions.length && !orphans.length && !clusters.length) return "";
  const lines = ["## Coherence Analysis"];
  if (tensions.length) {
    lines.push("\n### Tensions\n");
    tensions.forEach((t) => lines.push(`- ${t}`));
  }
  if (orphans.length) {
    lines.push("\n### Orphans\n");
    orphans.forEach((o) => lines.push(`- ${o}`));
  }
  if (clusters.length) {
    lines.push("\n### Clusters\n");
    clusters.forEach((c) => lines.push(`- ${c}`));
  }
  return lines.join("\n");
}

/** The parts of a review, in the order the tab shows them. */
const REVIEW_PARTS = [
  ["arc", "How the position moved"],
  ["surprises", "Surprising turns"],
  ["missed", "Missed opportunities"],
  ["method", "How the process was conducted"],
];

/**
 * The accepted process reviews, oldest first — the order they were written in,
 * so the series reads forward and each one's back-references land after what
 * they refer to.
 */
function reviewsSection(reviews) {
  if (!reviews.length) return "";
  const lines = ["## Process Reviews"];
  reviews.forEach((r) => {
    lines.push(`\n### Step ${r.round} — ${esc(r.headline)}\n`);
    if (r.origin) lines.push(`*AI-generated by ${esc(r.origin)}*\n`);
    REVIEW_PARTS.forEach(([key, label]) => {
      if (r[key]) lines.push(`**${label}**\n\n${esc(r[key])}\n`);
    });
  });
  return lines.join("\n");
}

/**
 * What changed, one line per step, under a heading for each round — the round
 * being the unit of the method and the step the unit of the record.
 */
function logSection(state) {
  if (!state.log.length) return "";
  const lines = ["## Log"];
  let heading = null;
  [...state.log]
    .sort((a, b) => a.round - b.round)
    .forEach((l) => {
      const round = roundOfStep(state, l.round);
      if (round !== heading) {
        lines.push(`\n### Round ${round}`);
        heading = round;
      }
      lines.push(`\n**Step ${l.round}.** ${esc(l.changes)}`);
    });
  return lines.join("\n");
}

/**
 * The position as an Argdown document, fenced so a Markdown reader shows it
 * verbatim. The fence is longer than any run of backticks inside it, which a
 * statement's text may contain.
 */
function argdownSection(state) {
  const argdown = buildArgdown(state).trimEnd();
  const longest = Math.max(
    0,
    ...[...argdown.matchAll(/`+/g)].map((m) => m[0].length),
  );
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `## Argdown\n\n${fence}argdown\n${argdown}\n${fence}`;
}

// ─── Sections offered ─────────────────────────────────────────────────────────

/**
 * What the Export dialog offers, in document order. The title and round head
 * every file and are not a choice.
 *
 * `history` is the machine-readable state block — the whole process, with its
 * log, reviews and every item's history — and the only part Import reads, so a
 * file without it is a report and not a way back in. `has` leaves out a
 * section with nothing to say: offering "Groups" on a process with none is a
 * box that changes nothing.
 *
 * @type {{ key: string, label: string, detail: string, on: boolean, has?: (state: REState) => boolean }[]}
 */
export const EXPORT_SECTIONS = [
  {
    key: "elements",
    label: "Elements",
    detail: "Every judgment, principle and theory, with its wording history.",
    on: true,
  },
  {
    key: "relations",
    label: "Relations",
    detail: "Each relation and argument step, with its explanation.",
    on: true,
  },
  {
    key: "groups",
    label: "Groups",
    detail: "Your groups and their members.",
    on: true,
    has: (state) => groupsOf(state).length > 0,
  },
  {
    key: "processes",
    label: "Merged processes",
    detail: "Which process each element came from.",
    on: true,
    has: (state) => processesOf(state).length > 0,
  },
  {
    key: "graph",
    label: "Graph",
    detail: "An image of the graph as you left it — as cards, if it is showing statements.",
    on: true,
  },
  {
    key: "clusters",
    label: "Clusters",
    detail: "The coherent clusters, with an image of each.",
    on: true,
  },
  {
    key: "coherence",
    label: "Coherence analysis",
    detail: "Tensions and orphans.",
    on: true,
  },
  {
    key: "reviews",
    label: "Process reviews",
    detail: "The reviews you accepted, oldest first.",
    on: true,
    has: (state) => reviewsOf(state).length > 0,
  },
  {
    key: "log",
    label: "Log",
    detail: "What changed at each step, grouped by round.",
    on: true,
  },
  {
    key: "argdown",
    label: "Argdown",
    detail: "The position as an Argdown map, for the Argdown tools.",
    on: false,
  },
  {
    key: "history",
    label: "Full history",
    detail: "Everything needed to continue this process later: import the file to pick up where you left off.",
    on: true,
  },
];

/** The sections worth offering for `state`. */
export const exportSectionsFor = (state) =>
  EXPORT_SECTIONS.filter((s) => !s.has || s.has(state));

/** What the export writes when nobody has chosen. */
export const DEFAULT_EXPORT_SECTIONS = new Set(
  EXPORT_SECTIONS.filter((s) => s.on).map((s) => s.key),
);

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Renders `state` as a markdown document. Split out from `downloadMarkdown` so
 * the document itself can be asserted on without touching the DOM.
 *
 * @param {REState}    state
 * @param {PositionMap} positions
 * @param {Set<string>} [sections] - Keys of {@link EXPORT_SECTIONS} to write.
 * @param {{ statements?: boolean }} [view] - Whether the Graph tab is showing
 *   statements, which the graph section follows.
 * @returns {string}
 */
export function buildMarkdown(
  state,
  positions,
  sections = DEFAULT_EXPORT_SECTIONS,
  { statements = false } = {},
) {
  const want = (key) => sections.has(key);
  const date = new Date().toISOString().slice(0, 10);
  const visIds = new Set(state.elements.map((e) => e.id));
  const pCovers = buildPrincipleCovers(
    state.elements.filter((e) => e.type === "principle"),
    state.relations,
    visIds,
    state.elements,
  );

  const header = `# Reflective Equilibrium: ${esc(state.topic)}\n\n**Round:** ${currentRound(state)} · **Step:** ${state.round} · **Date:** ${date}`;

  const processes = processesOf(state);
  const processTags = processTagMap(processes);
  const elementsBlock =
    "## Elements\n\n" +
    elementsSection(state.elements, "judgment", "Judgments", pCovers, processTags) +
    elementsSection(state.elements, "principle", "Principles", pCovers, processTags) +
    elementsSection(state.elements, "theory", "Background Theories", pCovers, processTags);

  // Machine-readable state block — used by the import feature to restore this session.
  const stateBlock = "```re-state\n" + JSON.stringify(state, null, 2) + "\n```";

  // Each section is built only when asked for: the graph and the clusters
  // render SVGs, which is the expensive part of an export.
  const parts = [
    header,
    want("elements") && elementsBlock,
    want("relations") && relationsSection(state.relations),
    want("groups") && groupsSection(groupsOf(state)),
    want("processes") && processesSection(processes),
    // Groups are the user's own filing, so the graph is drawn as they left it.
    // The cluster diagrams below are not: a coherent cluster is computed from
    // the relations, and cuts across the grouping rather than following it.
    // Process letters go on both, being a fact about each element.
    want("graph") &&
      graphSection(
        state.elements,
        state.relations,
        positions,
        groupsOf(state),
        processTags,
        statements,
      ),
    want("clusters") && clustersSection(state, positions, processTags),
    want("coherence") && coherenceSection(state.coherence),
    want("reviews") && reviewsSection(reviewsOf(state)),
    want("log") && logSection(state),
    want("argdown") && argdownSection(state),
    want("history") && stateBlock,
  ].filter(Boolean);

  return parts.join("\n\n---\n\n");
}

/**
 * Generates a markdown document from `state` and triggers a browser download.
 * `positions` is the force-simulation position map from `useStablePositions`.
 *
 * @param {REState}    state
 * @param {PositionMap} positions
 * @param {Set<string>} [sections] - As for {@link buildMarkdown}.
 * @param {{ statements?: boolean }} [view] - As for {@link buildMarkdown}.
 */
export function downloadMarkdown(state, positions, sections, view) {
  const markdown = buildMarkdown(state, positions, sections, view);
  const slug = state.topic.slice(0, 30).replace(/\s+/g, "-").toLowerCase();
  const filename = `re-${slug}-step${state.round}.md`;

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
