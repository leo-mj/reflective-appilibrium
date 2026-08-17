/**
 * @fileoverview Coherent-cluster detection for the RE state.
 *
 * A **coherent cluster** is a maximal set of active elements that:
 *   (a) are mutually connected via support paths (supports / entails / jointly_entails), AND
 *   (b) contain no conflict-like edges (conflicts / undermines / precludes / jointly_precludes)
 *       between any pair of members.
 *
 * Algorithm: Bron-Kerbosch (exact) for < 50 active elements;
 *            BFS fallback for ≥ 50 (fast, may miss some clusters).
 *
 * @module utils/clusterUtils
 */

/** @import { REState, RERelation } from '../types.js' */

// ─── Shared setup ─────────────────────────────────────────────────────────────

/**
 * Builds the adjacency structures needed by both algorithms.
 *
 * @param {REState} state
 * @param {boolean} hideNonEntailsRels - When true, only entails/precludes relations
 *   are used for support/conflict; supports/conflicts/undermines are ignored.
 * @returns {{ activeElements, supportAdj: Map<string,Set<string>>,
 *             conflictSet: Set<string>, compatAdj: Map<string,Set<string>> }}
 */
function buildGraphs(state, hideNonEntailsRels) {
  const activeElements = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.status !== "possible",
  );
  const activeIds = new Set(activeElements.map((e) => e.id));

  const supportRels = ["entails", "jointly_entails"];
  const conflictRels = ["precludes", "jointly_precludes"];
  if (!hideNonEntailsRels) {
    supportRels.push("supports");
    conflictRels.push("conflicts", "undermines");
  }

  const supportEdges = state.relations.filter(
    (r) =>
      supportRels.includes(r.type) && activeIds.has(r.from) && activeIds.has(r.to),
  );
  const conflictEdges = state.relations.filter(
    (r) =>
      conflictRels.includes(r.type) &&
      activeIds.has(r.from) &&
      activeIds.has(r.to),
  );

  // Support adjacency (undirected).
  const supportAdj = new Map(activeElements.map((e) => [e.id, new Set()]));
  for (const e of supportEdges) {
    supportAdj.get(e.from).add(e.to);
    supportAdj.get(e.to).add(e.from);
  }

  // Conflict pair set — sorted string key for O(1) lookup.
  const conflictSet = new Set();
  for (const e of conflictEdges)
    conflictSet.add([e.from, e.to].sort().join("\0"));

  // Compatibility adjacency: support edge AND no conflict.
  const compatAdj = new Map(activeElements.map((e) => [e.id, new Set()]));
  for (const e of supportEdges) {
    if (!conflictSet.has([e.from, e.to].sort().join("\0"))) {
      compatAdj.get(e.from).add(e.to);
      compatAdj.get(e.to).add(e.from);
    }
  }

  return { activeElements, supportAdj, conflictSet, compatAdj };
}

/** @param {string} a @param {string} b @param {Set<string>} conflictSet */
const inConflict = (a, b, conflictSet) =>
  conflictSet.has([a, b].sort().join("\0"));

// ─── Bron-Kerbosch (exact, < 50 elements) ────────────────────────────────────

function bronKerbosch(R, P, X, compatAdj, results) {
  if (P.size === 0 && X.size === 0) {
    if (R.size > 1) results.push(new Set(R));
    return;
  }

  // Pivot: element in P ∪ X with most neighbours in P (reduces branches).
  let pivot = null,
    best = -1;
  for (const v of [...P, ...X]) {
    const score = [...compatAdj.get(v)].filter((n) => P.has(n)).length;
    if (score > best) {
      best = score;
      pivot = v;
    }
  }

  const pivotNeighbors = compatAdj.get(pivot);
  for (const v of [...P].filter((v) => !pivotNeighbors.has(v))) {
    const N = compatAdj.get(v);
    bronKerbosch(
      new Set([...R, v]),
      new Set([...P].filter((n) => N.has(n))),
      new Set([...X].filter((n) => N.has(n))),
      compatAdj,
      results,
    );
    P.delete(v);
    X.add(v);
  }
}

function findClusters_BronKerbosch(state, hideNonEntailsRels) {
  const { activeElements, supportAdj, conflictSet, compatAdj } =
    buildGraphs(state, hideNonEntailsRels);

  // Step 1: all maximal cliques in the compatibility graph.
  const cliques = [];
  bronKerbosch(
    new Set(),
    new Set(activeElements.map((e) => e.id)),
    new Set(),
    compatAdj,
    cliques,
  );

  // Step 2: merge cliques that are support-connected and conflict-free.
  let clusters = cliques.map((c) => new Set(c));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const C1 = clusters[i],
          C2 = clusters[j];

        const connected =
          [...C1].some((a) => C2.has(a)) ||
          [...C1].some((a) => [...C2].some((b) => supportAdj.get(a)?.has(b)));
        if (!connected) continue;

        let hasConflict = false;
        for (const a of C1) {
          for (const b of C2) {
            if (inConflict(a, b, conflictSet)) {
              hasConflict = true;
              break;
            }
          }
          if (hasConflict) break;
        }
        if (hasConflict) continue;

        clusters.splice(j, 1);
        clusters.splice(i, 1);
        clusters.push(new Set([...C1, ...C2]));
        merged = true;
        break outer;
      }
    }
  }

  // Step 3: remove non-maximal clusters.
  clusters = clusters.filter(
    (C, i) =>
      !clusters.some(
        (C2, j) =>
          i !== j && C2.size > C.size && [...C].every((id) => C2.has(id)),
      ),
  );

  return clusters
    .sort((a, b) => b.size - a.size)
    .map((members) => ({ members, size: members.size }));
}

// ─── BFS fallback (≥ 50 elements) ────────────────────────────────────────────

function findClusters_BFS(state, hideNonEntailsRels) {
  const { activeElements, supportAdj, conflictSet } = buildGraphs(state, hideNonEntailsRels);

  const allClusters = [];
  for (const seed of activeElements) {
    const cluster = new Set();
    const queue = [seed.id];
    while (queue.length) {
      const cur = queue.shift();
      if (cluster.has(cur)) continue;
      if ([...cluster].some((m) => inConflict(cur, m, conflictSet))) continue;
      cluster.add(cur);
      for (const nb of supportAdj.get(cur) ?? [])
        if (!cluster.has(nb)) queue.push(nb);
    }
    if (cluster.size > 1) allClusters.push(cluster);
  }

  // Deduplicate.
  const seen = new Set();
  const unique = allClusters.filter((c) => {
    const key = [...c].sort().join(",");
    return seen.has(key) ? false : (seen.add(key), true);
  });

  const maximal = unique.filter(
    (C, i) =>
      !unique.some(
        (C2, j) =>
          i !== j && C2.size > C.size && [...C].every((id) => C2.has(id)),
      ),
  );

  return maximal
    .sort((a, b) => b.size - a.size)
    .map((members) => ({ members, size: members.size }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Finds all maximal coherent clusters in the current RE state.
 *
 * @param {REState} state
 * @param {boolean} [hideNonEntailsRels=false] - When true, only entails/precludes
 *   relations count as support/conflict (computational RE mode).
 * @returns {{ members: Set<string>, size: number }[]} Sorted by size descending.
 */
export function findCoherentClusters(state, hideNonEntailsRels = false) {
  const activeCount = state.elements.filter(
    (e) => e.status !== "withdrawn" && e.status !== "possible",
  ).length;
  return activeCount < 50
    ? findClusters_BronKerbosch(state, hideNonEntailsRels)
    : findClusters_BFS(state, hideNonEntailsRels);
}

/** All relation types treated as conflict-like for cluster analysis. */
const CONFLICT_TYPES = new Set(["conflicts", "undermines", "precludes", "jointly_precludes"]);
/** All relation types treated as support-like for cluster analysis. */
const SUPPORT_TYPES = new Set(["supports", "entails", "jointly_entails"]);

/**
 * Finds conflict-like edges that cross cluster boundaries.
 * Includes conflicts, undermines, precludes, and jointly_precludes.
 *
 * @param {{ members: Set<string> }[]} clusters
 * @param {REState} state
 * @returns {{ clusterIndices: [number,number], edge: RERelation }[]}
 */
export function findCrossClusterTensions(clusters, state) {
  const tensions = [];
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const { members: C1 } = clusters[i];
      const { members: C2 } = clusters[j];
      for (const r of state.relations) {
        if (!CONFLICT_TYPES.has(r.type)) continue;
        if (
          (C1.has(r.from) && C2.has(r.to)) ||
          (C2.has(r.from) && C1.has(r.to))
        )
          tensions.push({ clusterIndices: [i, j], edge: r });
      }
    }
  }
  return tensions;
}

/**
 * Finds pairs of clusters that are close to being mergeable:
 * connected by at least one support bridge and separated by ≤ 2 conflicts.
 * Support bridges include supports, entails, and jointly_entails.
 * Conflicts include conflicts, undermines, precludes, and jointly_precludes.
 *
 * @param {{ members: Set<string> }[]} clusters
 * @param {REState} state
 * @returns {{ clusterIndices: [number,number], clusters: object[],
 *             mergedSize: number, conflictsToResolve: RERelation[],
 *             bridges: RERelation[], wouldBeClean: boolean }[]}
 *   Sorted by number of conflicts to resolve ascending.
 */
export function findMergeCandidates(clusters, state) {
  const candidates = [];

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const { members: C1 } = clusters[i];
      const { members: C2 } = clusters[j];

      const bridges = state.relations.filter(
        (r) =>
          SUPPORT_TYPES.has(r.type) &&
          ((C1.has(r.from) && C2.has(r.to)) ||
            (C2.has(r.from) && C1.has(r.to))),
      );

      const conflicts = state.relations.filter(
        (r) =>
          CONFLICT_TYPES.has(r.type) &&
          ((C1.has(r.from) && C2.has(r.to)) ||
            (C2.has(r.from) && C1.has(r.to))),
      );

      if (bridges.length === 0 || conflicts.length > 2) continue;

      const mergedSet = new Set([...C1, ...C2]);
      const remainingConflicts = state.relations.filter(
        (r) =>
          CONFLICT_TYPES.has(r.type) &&
          mergedSet.has(r.from) &&
          mergedSet.has(r.to) &&
          !conflicts.includes(r),
      );

      candidates.push({
        clusterIndices: [i, j],
        clusters: [clusters[i], clusters[j]],
        mergedSize: mergedSet.size,
        conflictsToResolve: conflicts,
        bridges,
        wouldBeClean: remainingConflicts.length === 0,
      });
    }
  }

  return candidates.sort(
    (a, b) => a.conflictsToResolve.length - b.conflictsToResolve.length,
  );
}
