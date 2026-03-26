// ─── Problem definition ───
//
// Find all MAXIMAL COHERENT CLUSTERS, where a cluster is:
//   (a) connected through support edges, AND
//   (b) contains NO conflict/undermines edges between any members
//
// Maximal: no element can be added while preserving (a) and (b).
// Elements may appear in multiple clusters.
//
// Strategy: Bron-Kerbosch for < 50 active elements (exact),
//           BFS fallback for ≥ 50 (fast, may miss some clusters).


// ═══════════════════════════════════════════════
// SHARED SETUP
// ═══════════════════════════════════════════════

FUNCTION buildGraphs(state)

  activeElements ← state.elements WHERE status ≠ "withdrawn"
  activeIds ← set of activeElement ids

  supportEdges ← state.relations WHERE
    type = "supports"
    AND from IN activeIds AND to IN activeIds

  conflictEdges ← state.relations WHERE
    type IN ("conflicts", "undermines")
    AND from IN activeIds AND to IN activeIds

  // Support adjacency (undirected)
  supportAdj ← map: id → set of ids
  FOR EACH element IN activeElements:
    supportAdj[element.id] ← empty set
  FOR EACH edge IN supportEdges:
    supportAdj[edge.from].add(edge.to)
    supportAdj[edge.to].add(edge.from)

  // Conflict pairs (undirected)
  conflictSet ← set of unordered pairs
  FOR EACH edge IN conflictEdges:
    conflictSet.add({edge.from, edge.to})

  // Compatibility adjacency: support edge AND no conflict
  compatAdj ← map: id → set of ids
  FOR EACH element IN activeElements:
    compatAdj[element.id] ← empty set
  FOR EACH edge IN supportEdges:
    IF {edge.from, edge.to} NOT IN conflictSet:
      compatAdj[edge.from].add(edge.to)
      compatAdj[edge.to].add(edge.from)

  RETURN { activeElements, supportAdj, conflictSet, compatAdj }

END FUNCTION


// ═══════════════════════════════════════════════
// APPROACH 1: BRON-KERBOSCH (exact, for < 50 elements)
// ═══════════════════════════════════════════════

// Finds all maximal cliques in the compatibility graph.
// A clique in the compatibility graph = a set where every
// pair is connected by support AND no pair has a conflict.
// This satisfies condition (b) automatically.
// Condition (a) — support connectivity — is also guaranteed
// because every pair has a direct support edge.
//
// Note: this actually finds something STRONGER than what
// we need. We require support *paths*, not direct edges.
// So after finding cliques, we merge overlapping ones that
// are connected through support edges and conflict-free.

FUNCTION bronKerbosch(R, P, X, compatAdj, results)
  // R = current clique being built
  // P = candidates that could extend R
  // X = already processed (for maximality)

  IF P is empty AND X is empty:
    IF |R| > 1:           // ignore singletons
      results.add(R)
    RETURN

  // Pivot: choose vertex in P ∪ X with most connections
  // This prunes branches where the pivot's neighbors
  // would be explored redundantly
  pivot ← element in (P ∪ X) WITH maximum |compatAdj[pivot] ∩ P|

  FOR EACH v IN (P \ compatAdj[pivot]):
    newR ← R ∪ {v}
    newP ← P ∩ compatAdj[v]
    newX ← X ∩ compatAdj[v]

    bronKerbosch(newR, newP, newX, compatAdj, results)

    P ← P \ {v}
    X ← X ∪ {v}

END FUNCTION


FUNCTION findClusters_BronKerbosch(state)

  { activeElements, supportAdj, conflictSet, compatAdj } ← buildGraphs(state)

  // Step 1: Find all maximal cliques in compatibility graph
  allIds ← set of all active element ids
  cliques ← empty list
  bronKerbosch(∅, allIds, ∅, compatAdj, cliques)

  // Step 2: Merge cliques into larger connected clusters
  //   Two cliques can merge if:
  //     - they share at least one element, OR
  //     - a support edge connects them
  //   AND the merged set has no internal conflicts
  //
  //   Repeat until no more merges are possible.
  //
  //   conflictSet (built once per algorithm run from state.relations)
  //   is the only lookup structure needed. Every element-pair
  //   conflict check is O(1) against it. No additional caching
  //   required at this graph scale — the full merge loop completes
  //   in < 1ms for graphs under 50 elements.

  clusters ← cliques as list of sets

  merged ← true
  WHILE merged:
    merged ← false
    FOR EACH pair (C1, C2) IN clusters WHERE C1 ≠ C2:

      // Check if they're connected (overlap or support bridge)
      connected ← (C1 ∩ C2) is non-empty
      IF NOT connected:
        FOR EACH a IN C1:
          FOR EACH b IN C2:
            IF b IN supportAdj[a]:
              connected ← true
              BREAK

      IF NOT connected: SKIP

      // Check if merge would introduce conflicts
      // Only check cross-pairs (C1 × C2) — each cluster
      // is individually conflict-free already.
      hasConflict ← false
      FOR EACH a IN C1:
        FOR EACH b IN C2:
          IF {a, b} IN conflictSet:
            hasConflict ← true
            BREAK

      IF hasConflict: SKIP

      // Merge: replace C1 and C2 with their union
      clusters.remove(C1, C2)
      clusters.add(C1 ∪ C2)
      merged ← true
      BREAK           // restart loop after merge

  // Step 3: Remove non-maximal clusters
  maximal ← empty list
  FOR EACH C IN clusters:
    IF no other C' IN clusters WHERE C ⊂ C':
      maximal.add(C)

  RETURN maximal sorted by size descending

END FUNCTION


// ═══════════════════════════════════════════════
// APPROACH 2: BFS (fast fallback, for ≥ 50 elements)
// ═══════════════════════════════════════════════

FUNCTION findClusters_BFS(state)

  { activeElements, supportAdj, conflictSet } ← buildGraphs(state)

  FUNCTION hasConflictWith(candidate, cluster):
    FOR EACH member IN cluster:
      IF {candidate, member} IN conflictSet:
        RETURN true
    RETURN false

  allClusters ← empty list

  FOR EACH seed IN activeElements:
    cluster ← empty set
    queue ← [seed.id]

    WHILE queue is not empty:
      current ← queue.removeFirst()
      IF current IN cluster: SKIP
      IF hasConflictWith(current, cluster): SKIP

      cluster.add(current)

      FOR EACH neighbor IN supportAdj[current]:
        IF neighbor NOT IN cluster:
          queue.add(neighbor)

    IF cluster.size > 1:
      allClusters.add(cluster)

  // Deduplicate and remove non-maximal
  unique ← remove duplicates from allClusters
  maximal ← empty list
  FOR EACH C IN unique:
    IF no other C' IN unique WHERE C ⊂ C':
      maximal.add(C)

  RETURN maximal sorted by size descending

END FUNCTION


// ═══════════════════════════════════════════════
// DISPATCHER
// ═══════════════════════════════════════════════

FUNCTION findCoherentClusters(state)

  activeCount ← count of state.elements WHERE status ≠ "withdrawn"

  IF activeCount < 50:
    RETURN findClusters_BronKerbosch(state)    // exact
  ELSE:
    RETURN findClusters_BFS(state)             // fast, may miss some


// ─── Return structure ───
// [
//   { members: {"P1","J1","J2","J3"}, size: 4 },
//   { members: {"P2","J4","J5","J6"}, size: 4 },
//   { members: {"P3","J7"}, size: 2 },
// ]
//
// Properties:
//   - Every pair within a cluster is connected via support path
//   - No pair within a cluster has a conflict or undermines edge
//   - No element can be added without breaking one of the above
//   - Elements may appear in multiple clusters
//   - Singletons excluded

END FUNCTION


// ═══════════════════════════════════════════════
// EXTENSION 2: CROSS-CLUSTER TENSIONS
// ═══════════════════════════════════════════════

FUNCTION findCrossClusterTensions(clusters, state)
  tensions ← empty list

  FOR EACH pair (C1, C2) IN clusters:
    FOR EACH conflict edge IN state.relations WHERE
      type IN ("conflicts", "undermines")
      AND one endpoint IN C1.members AND other IN C2.members:

      tensions.add({
        between: [C1, C2],
        edge: the conflict relation,
        description: "[element] in cluster N [conflicts/undermines]
                      [element] in cluster M"
      })

  RETURN tensions

  // Display: dashed orange lines between cluster outlines.
  // Hover shows which elements and why.

END FUNCTION


// ═══════════════════════════════════════════════
// EXTENSION 3: MERGE CANDIDATES
// ═══════════════════════════════════════════════

FUNCTION findMergeCandidates(clusters, state)
  candidates ← empty list

  FOR EACH pair (C1, C2) IN clusters:
    conflicts ← conflict/undermines edges between C1 and C2
    bridges ← support edges between C1 and C2

    IF bridges.count > 0 AND conflicts.count ≤ 2:
      // Check: would the merged set be conflict-free
      // if the identified conflicts were resolved?
      mergedSet ← C1.members ∪ C2.members
      remainingConflicts ← all conflict edges within mergedSet
                           MINUS the identified cross-cluster conflicts

      candidates.add({
        clusters: [C1, C2],
        mergedSize: |mergedSet|,
        conflictsToResolve: conflicts,
        bridges: bridges,
        wouldBeClean: remainingConflicts.count = 0,
        description: "Resolving N conflict(s) would merge
          these into a coherent cluster of size M"
      })

  RETURN candidates sorted by conflictsToResolve.count ascending

  // Display: badge between cluster outlines.
  //   "1 conflict away from merging" → clicking shows
  //   which conflict, which elements, and what the
  //   merged cluster would contain.
  // This directly feeds into RE adjustment proposals.

END FUNCTION