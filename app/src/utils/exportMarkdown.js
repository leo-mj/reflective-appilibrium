/**
 * @fileoverview Generates and triggers a markdown download of the full RE state.
 * Covers the Text tab (elements, relations, coherence), Graph tab (SVG),
 * and Clusters tab (cluster analysis with per-cluster SVGs).
 * @module utils/exportMarkdown
 */

/** @import { REState, PositionMap } from '../types.js' */

import {
  findCoherentClusters,
  findCrossClusterTensions,
  findMergeCandidates,
} from "./clusterUtils.js";
import { buildPrincipleCovers } from "./textTabHelpers.js";
import { sortElementIds, historyOf } from "./stateUtils.js";
import { generateGraphSVG, svgToDataUrl } from "./generateSVG.js";

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
        return `Round ${ev.round}: reworded${
          ev.previousText ? ` from "${esc(ev.previousText)}"` : ""
        }`;
      case "withdrawn":
        return `Round ${ev.round}: withdrawn${
          ev.reason ? ` — ${esc(ev.reason)}` : ""
        }`;
      case "reinstated":
        return `Round ${ev.round}: reinstated`;
      case "rejected":
        return `Round ${ev.round}: rejected`;
      default:
        return `Round ${ev.round}: ${esc(ev.type)}`;
    }
  });
}

function elementsSection(elements, type, label, pCovers) {
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
    lines.push(
      `**${el.id}** · ${el.confidence}${statusTag}\n${bodyText}${covers}${trail}\n`,
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

function graphSection(elements, relations, positions) {
  const svg = generateGraphSVG(elements, relations, positions);
  if (!svg) return "";
  return (
    '## Graph\n\n<img src="' + svgToDataUrl(svg) + '" style="max-width:100%"/>'
  );
}

function clustersSection(state, positions) {
  const clusters = findCoherentClusters(state);
  if (!clusters.length) return "";

  const lines = ["## Clusters"];
  clusters.forEach((cluster, i) => {
    const members = [...cluster.members].sort(sortElementIds).join(", ");
    const clusterEls = state.elements.filter((e) => cluster.members.has(e.id));
    const clusterRels = state.relations.filter(
      (r) => cluster.members.has(r.from) && cluster.members.has(r.to),
    );
    const svg = generateGraphSVG(clusterEls, clusterRels, positions);
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

function logSection(log) {
  if (!log.length) return "";
  const lines = ["## Round Log"];
  [...log]
    .sort((a, b) => a.round - b.round)
    .forEach((l) => {
      lines.push(`\n### Round ${l.round}\n\n${esc(l.changes)}`);
    });
  return lines.join("\n");
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Renders `state` as a markdown document. Split out from `downloadMarkdown` so
 * the document itself can be asserted on without touching the DOM.
 *
 * @param {REState}    state
 * @param {PositionMap} positions
 * @returns {string}
 */
export function buildMarkdown(state, positions) {
  const date = new Date().toISOString().slice(0, 10);
  const visIds = new Set(state.elements.map((e) => e.id));
  const pCovers = buildPrincipleCovers(
    state.elements.filter((e) => e.type === "principle"),
    state.relations,
    visIds,
    state.elements,
  );

  const header = `# Reflective Equilibrium: ${esc(state.topic)}\n\n**Round:** ${state.round} · **Date:** ${date}`;

  const elementsBlock =
    "## Elements\n\n" +
    elementsSection(state.elements, "judgment", "Judgments", pCovers) +
    elementsSection(state.elements, "principle", "Principles", pCovers) +
    elementsSection(state.elements, "theory", "Background Theories", pCovers);

  // Machine-readable state block — used by the import feature to restore this session.
  const stateBlock = "```re-state\n" + JSON.stringify(state, null, 2) + "\n```";

  const parts = [
    header,
    elementsBlock,
    relationsSection(state.relations),
    graphSection(state.elements, state.relations, positions),
    clustersSection(state, positions),
    coherenceSection(state.coherence),
    logSection(state.log),
    stateBlock,
  ].filter(Boolean);

  return parts.join("\n\n---\n\n");
}

/**
 * Generates a markdown document from `state` and triggers a browser download.
 * `positions` is the force-simulation position map from `useStablePositions`.
 *
 * @param {REState}    state
 * @param {PositionMap} positions
 */
export function downloadMarkdown(state, positions) {
  const markdown = buildMarkdown(state, positions);
  const slug = state.topic.slice(0, 30).replace(/\s+/g, "-").toLowerCase();
  const filename = `re-${slug}-round${state.round}.md`;

  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
