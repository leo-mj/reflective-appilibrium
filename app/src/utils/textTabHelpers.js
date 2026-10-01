/**
 * @fileoverview Pure helper functions for TextTab and its sub-components.
 * No React imports — safe to use in any context.
 * @module utils/textTabHelpers
 */

/** @import { REElement, RERelation } from '../types.js' */

/**
 * Builds a map from principle ID to the judgment IDs it covers
 * via "supports" relations.
 *
 * @param {REElement[]}  principles
 * @param {RERelation[]} relations
 * @param {Set<string>}  visIds
 * @param {REElement[]}  elements
 * @returns {Object.<string, string[]>}
 */
export function buildPrincipleCovers(principles, relations, visIds, elements) {
  const covers = {};
  principles.forEach((p) => {
    covers[p.id] = [];
  });
  relations.forEach((r) => {
    if (!visIds.has(r.from) || !visIds.has(r.to) || r.type !== "supports")
      return;
    const f = elements.find((e) => e.id === r.from);
    const t = elements.find((e) => e.id === r.to);
    if (f?.type === "principle" && t?.type === "judgment")
      covers[f.id]?.push(t.id);
    if (t?.type === "principle" && f?.type === "judgment")
      covers[t.id]?.push(f.id);
  });
  return covers;
}

/**
 * Returns true when an element's id, text, or type contains the query string.
 *
 * @param {REElement} el
 * @param {string}    q
 * @returns {boolean}
 */
export function matchesSearch(el, q) {
  const lq = q.toLowerCase();
  return (
    el.id.toLowerCase().includes(lq) ||
    el.text.toLowerCase().includes(lq) ||
    el.type.toLowerCase().includes(lq)
  );
}

/**
 * Returns true when a relation's from/to IDs or explanation contain the query.
 *
 * @param {RERelation} r
 * @param {string}     q
 * @returns {boolean}
 */
export function matchesSearchRel(r, q) {
  const lq = q.toLowerCase();
  return (
    r.from.toLowerCase().includes(lq) ||
    r.to.toLowerCase().includes(lq) ||
    (r.explanation ?? "").toLowerCase().includes(lq)
  );
}

/**
 * Which of a canvas's drawn elements a search finds, by the panel's own test
 * ({@link matchesSearch}), so the graph and the text panel agree on what
 * matches. A collapsed group — drawn as one node, with `memberIds` — is found
 * when any member is.
 *
 * @param {Array<REElement | { id: string, type: "group", memberIds?: string[] }>} drawn
 * @param {string} query - Already trimmed; empty finds nothing to filter by.
 * @param {Map<string, REElement>} elementById - For a group's members.
 * @returns {Set<string>|null} The ids found, or `null` when there is no query —
 *   nothing to fade, as opposed to nothing found.
 */
export function searchFinds(drawn, query, elementById) {
  if (!query) return null;
  return new Set(
    drawn
      .filter((e) =>
        e.type === "group"
          ? e.memberIds?.some((id) => {
              const m = elementById.get(id);
              return m && matchesSearch(m, query);
            })
          : matchesSearch(e, query),
      )
      .map((e) => e.id),
  );
}

