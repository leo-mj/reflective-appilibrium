/**
 * @fileoverview User-defined node groups, and the projection that draws a
 * collapsed one as a single node.
 *
 * A **group** is a set of elements the user has bracketed together to tidy the
 * canvas. It is a view device, not an RE move: grouping does not advance the
 * round, does not touch an element's status or confidence, and does not enter
 * the coherence analysis. That keeps it clear of the domain model — where a
 * "cluster" already means something else, namely the *computed* coherent
 * cluster of `utils/clusterUtils.js`, which nobody chooses.
 *
 * Collapsing a group replaces its members with one node. The relations that
 * ran between members disappear with them — they are internal to the box now —
 * but every relation crossing the boundary is kept and re-drawn against the
 * group node, each one still its own edge, so nothing a member said about the
 * rest of the graph is lost by tidying it away.
 *
 * @module utils/groupUtils
 */

/** @import { REElement, RERelation, REGroup, REState, PositionMap } from '../types.js' */

// ─── Reading groups off a state ───────────────────────────────────────────────

/**
 * A state's groups, defaulting to none.
 *
 * Every saved state written before groups existed lacks the key, and both the
 * file importer and the draft store hand those back untouched — so read through
 * this rather than `state.groups` directly.
 *
 * @param {REState} [state]
 * @returns {REGroup[]}
 */
export function groupsOf(state) {
  return state?.groups ?? [];
}

/** True for the pseudo-element a collapsed group is drawn as. */
export const isGroupNode = (el) => el?.type === "group";

/**
 * The group an element belongs to, or `undefined`. An element is in at most
 * one group — {@link createGroup} merges rather than nests.
 *
 * @param {REGroup[]} groups
 * @param {string} elementId
 * @returns {REGroup|undefined}
 */
export function groupOfElement(groups, elementId) {
  return groups.find((g) => g.members.includes(elementId));
}

/**
 * What a selection actually covers.
 *
 * Selection is one id, and for an element that is the whole story. A group is
 * not: collapsed it is drawn as a node of its own, expanded it is only its
 * members, and it may be selected in either state — so "what is selected" is
 * the group's node *and* everything in it, and the caller keeps whichever of
 * those it is currently drawing.
 *
 * Both the graph and the text panel highlight from this, which is what keeps
 * them agreeing about a selected group.
 *
 * @param {REGroup[]} groups
 * @param {string|null} selected
 * @returns {string[]} Empty when nothing is selected.
 */
export function selectionIds(groups, selected) {
  if (!selected) return [];
  const group = (groups ?? []).find((g) => g.id === selected);
  return group ? [group.id, ...group.members] : [selected];
}

// ─── Mutations (pure; each returns a new groups array) ────────────────────────

/** Next free `G<n>` id. */
function nextGroupNumber(groups) {
  const nums = groups
    .map((g) => parseInt(g.id.slice(1), 10))
    .filter((n) => !isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

/**
 * The id {@link upsertGroup} would give a new group.
 *
 * Exported so a caller can select the group it is about to create: the id is
 * allocated inside a state updater, which cannot report anything back.
 *
 * @param {REGroup[]} groups
 * @returns {string}
 */
export function nextGroupId(groups) {
  return `G${nextGroupNumber(groups ?? [])}`;
}

/**
 * Groups `memberIds` together.
 *
 * If any of them already belongs to a group, they all join *that* group rather
 * than starting a new one — which is what makes "select a node and a member,
 * then Group" read as adding to the group, and what merges two groups when the
 * selection spans both. Otherwise a new group is created.
 *
 * Returns `groups` unchanged for a selection of fewer than two elements.
 *
 * @param {REGroup[]} groups
 * @param {string[]} memberIds
 * @returns {REGroup[]}
 */
export function createGroup(groups, memberIds) {
  const ids = [...new Set(memberIds)].filter(Boolean);
  if (ids.length < 2) return groups;

  const touched = groups.filter((g) => g.members.some((m) => ids.includes(m)));
  if (touched.length === 0) {
    const n = nextGroupNumber(groups);
    return [
      ...groups,
      { id: `G${n}`, label: `Group ${n}`, members: ids, collapsed: true },
    ];
  }

  // Everything the selection touched folds into the first such group, so the
  // name the user already gave one of them survives the merge.
  const [host, ...absorbed] = touched;
  const absorbedIds = new Set(absorbed.map((g) => g.id));
  const members = [
    ...new Set([...touched.flatMap((g) => g.members), ...ids]),
  ];
  return groups
    .filter((g) => !absorbedIds.has(g.id))
    .map((g) => (g.id === host.id ? { ...g, members } : g));
}

/**
 * Dissolves a group. Its members stay exactly as they were — ungrouping is
 * undoing the bracket, not the work inside it.
 *
 * @param {REGroup[]} groups
 * @param {string} groupId
 * @returns {REGroup[]}
 */
export function removeGroup(groups, groupId) {
  return groups.filter((g) => g.id !== groupId);
}

/**
 * Takes one element out of whatever group holds it, dissolving that group if
 * it would be left with a single member.
 *
 * @param {REGroup[]} groups
 * @param {string} elementId
 * @returns {REGroup[]}
 */
export function removeFromGroups(groups, elementId) {
  return groups
    .map((g) =>
      g.members.includes(elementId)
        ? { ...g, members: g.members.filter((m) => m !== elementId) }
        : g,
    )
    .filter((g) => g.members.length > 1);
}

/**
 * Collapses an expanded group, or expands a collapsed one.
 *
 * @param {REGroup[]} groups
 * @param {string} groupId
 * @param {boolean} [collapsed] - Force a state rather than toggling.
 * @returns {REGroup[]}
 */
export function toggleGroup(groups, groupId, collapsed) {
  return groups.map((g) =>
    g.id === groupId ? { ...g, collapsed: collapsed ?? !g.collapsed } : g,
  );
}

/**
 * Renames a group. An empty name falls back to the group's id, so a chip
 * always has something to show.
 *
 * @param {REGroup[]} groups
 * @param {string} groupId
 * @param {string} label
 * @returns {REGroup[]}
 */
export function renameGroup(groups, groupId, label) {
  const clean = label.trim();
  return groups.map((g) =>
    g.id === groupId ? { ...g, label: clean || g.id } : g,
  );
}

/**
 * Sets a group's membership, creating the group when `id` is null.
 *
 * The counterpart to {@link createGroup}, and it differs on purpose. Grouping a
 * canvas selection is a vague instruction — "these belong together" — so it
 * folds into whatever group the selection already touches. Editing a group's
 * membership in a dialog is an exact one: this list, nothing else. An element
 * picked here therefore *moves* out of any group that had it, and a group left
 * with fewer than two members is dissolved, here being one member short of
 * meaning anything.
 *
 * @param {REGroup[]} groups
 * @param {{ id?: string|null, label?: string, members: string[], collapsed?: boolean }} group
 * @returns {REGroup[]}
 */
export function upsertGroup(groups, { id = null, label, members, collapsed }) {
  const ids = [...new Set(members)].filter(Boolean);
  if (ids.length < 2) return id ? removeGroup(groups, id) : groups;

  const existing = id ? groups.find((g) => g.id === id) : null;
  const groupId = existing?.id ?? `G${nextGroupNumber(groups)}`;
  const claimed = new Set(ids);
  const next = {
    id: groupId,
    label: (label ?? existing?.label ?? `Group ${groupId.slice(1)}`).trim() || groupId,
    members: ids,
    collapsed: collapsed ?? existing?.collapsed ?? true,
  };

  return (existing ? groups : [...groups, next])
    .map((g) =>
      g.id === groupId
        ? next
        : { ...g, members: g.members.filter((m) => !claimed.has(m)) },
    )
    .filter((g) => g.id === groupId || g.members.length > 1);
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

/** Radius of the smallest collapsed group node. */
const GROUP_BASE_RADIUS = 30;

/** Type metrics for the name drawn inside a collapsed group's disc. */
const LABEL_FONT_SIZE = 11;
const LABEL_LINE_HEIGHT = 13;
/** Mean advance width of system-ui at {@link LABEL_FONT_SIZE}, bold. */
const LABEL_CHAR_WIDTH = 6.4;
const LABEL_MAX_CHARS = 12;
const LABEL_MAX_LINES = 2;
/** The `n nodes` line under the name. */
const COUNT_LINE_HEIGHT = 12;

/**
 * A group's name, wrapped to fit inside its disc.
 *
 * Wrapped on word boundaries where they fall in the right place and mid-word
 * where they do not, then ellipsised — a name is what tells two collapsed
 * groups apart, so it is drawn inside the node rather than hung underneath it,
 * and being inside a circle it has to be short. Two lines is the most a disc
 * this size can hold above the member count.
 *
 * @param {string} label
 * @returns {string[]} One or two lines; never empty.
 */
export function groupLabelLines(label) {
  const words = String(label ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last != null && last.length + 1 + word.length <= LABEL_MAX_CHARS) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else if (lines.length < LABEL_MAX_LINES) {
      lines.push(word);
    } else {
      // Out of lines with words left over: the tail is cut below anyway.
      lines[lines.length - 1] = `${last} ${word}`;
    }
  }

  return lines.slice(0, LABEL_MAX_LINES).map((line, i, all) => {
    const overlong = line.length > LABEL_MAX_CHARS;
    // Only the last line may be trimmed: an earlier one that is too long means
    // a single unbreakable word, and cutting it there would drop the rest.
    if (!overlong) return line;
    if (i === all.length - 1) return `${line.slice(0, LABEL_MAX_CHARS - 1)}…`;
    return line.slice(0, LABEL_MAX_CHARS);
  });
}

/**
 * Visual radius of a collapsed group node.
 *
 * Grows with what the group holds — on √(n−1) rather than on n, because a group
 * is drawn as a disc, so *area* tracking membership is what makes two of them
 * comparable at a glance, and area goes as the square of this. Capped, because
 * past a dozen members the point is only that it is large, and an unbounded
 * disc would swallow its neighbours.
 *
 * Then widened, if need be, to hold the name: the disc has to contain the text
 * block rather than the other way round, so the block's half-diagonal is the
 * floor. Both the line count and the characters per line are capped, so this
 * cannot run away either.
 *
 * @param {number} memberCount
 * @param {string} [label] - Omit for the size membership alone would ask for.
 * @returns {number}
 */
export function groupRadius(memberCount = 0, label) {
  const n = Math.max(1, memberCount);
  const byMembership = GROUP_BASE_RADIUS + Math.min(24, Math.sqrt(n - 1) * 11);
  if (!label) return byMembership;

  const lines = groupLabelLines(label);
  const width = Math.max(...lines.map((l) => l.length)) * LABEL_CHAR_WIDTH;
  const height = lines.length * LABEL_LINE_HEIGHT + COUNT_LINE_HEIGHT;
  const byLabel = Math.hypot(width, height) / 2 + 6;
  return Math.max(byMembership, byLabel);
}

/** Type metrics the graph and the SVG export both draw the disc's label with. */
export const GROUP_LABEL_METRICS = {
  fontSize: LABEL_FONT_SIZE,
  lineHeight: LABEL_LINE_HEIGHT,
  countLineHeight: COUNT_LINE_HEIGHT,
};

/** Padding between the outermost member and its group's hull. */
const HULL_PADDING = 26;

/**
 * The rounded box drawn around an expanded group, in simulation coordinates.
 * Returns `null` when no member has been placed yet.
 *
 * @param {string[]} memberIds
 * @param {PositionMap} positions
 * @param {function(string): number} radiusOf - Visual radius of a member, by id.
 * @returns {{ x: number, y: number, w: number, h: number }|null}
 */
export function groupHull(memberIds, positions, radiusOf) {
  const pts = memberIds
    .map((id) => ({ p: positions[id], r: radiusOf(id) }))
    .filter((d) => d.p);
  if (!pts.length) return null;

  const minX = Math.min(...pts.map((d) => d.p.x - d.r));
  const maxX = Math.max(...pts.map((d) => d.p.x + d.r));
  const minY = Math.min(...pts.map((d) => d.p.y - d.r));
  const maxY = Math.max(...pts.map((d) => d.p.y + d.r));
  return {
    x: minX - HULL_PADDING,
    y: minY - HULL_PADDING,
    w: maxX - minX + HULL_PADDING * 2,
    h: maxY - minY + HULL_PADDING * 2,
  };
}

// ─── Projection ───────────────────────────────────────────────────────────────

/**
 * Rewrites the visible graph so that each collapsed group is one node.
 *
 * The relations that survive are the whole point. An edge with both ends inside
 * the same collapsed group is dropped — it is describing the inside of a box
 * the user asked to stop looking into. Every other edge is kept: one whose
 * endpoint sits in a collapsed group is re-pointed at the group node, and it
 * stays a *separate* edge, so five members each supporting the same outside
 * element still read as five reasons rather than one. `parallelEdgeOffsets`
 * fans them out.
 *
 * Re-pointed edges are copies; untouched ones are the very objects passed in.
 * That matters because selection compares relations by identity — hence
 * `relSource`, which maps a copy back to the relation actually held in state.
 *
 * @param {Object} args
 * @param {REElement[]} args.elements   - Already filtered to what is visible.
 * @param {RERelation[]} args.relations - Likewise.
 * @param {REGroup[]} args.groups
 * @param {PositionMap} args.positions
 * @param {function(REElement): number} args.radiusOf - Visual radius of an element.
 * @returns {{ elements: REElement[], groupNodes: REElement[], relations: RERelation[],
 *             relSource: Map<RERelation, RERelation>, positions: PositionMap,
 *             hulls: Array<{ group: REGroup, box: Object }>, memberToGroup: Map<string,string> }}
 */
export function projectGroups({
  elements,
  relations,
  groups,
  positions,
  radiusOf,
}) {
  const byId = new Map(elements.map((e) => [e.id, e]));
  // A group whose members are all hidden — by the legend, or because they are
  // `possible` — has nothing left to stand for, so it drops out entirely.
  const present = (groups ?? [])
    .map((g) => ({ ...g, members: g.members.filter((id) => byId.has(id)) }))
    .filter((g) => g.members.length > 0);

  const collapsed = present.filter((g) => g.collapsed);
  const memberToGroup = new Map();
  for (const g of collapsed)
    for (const id of g.members) memberToGroup.set(id, g.id);

  const nextPositions = { ...positions };
  const groupNodes = collapsed.map((g) => {
    const pts = g.members.map((id) => positions[id]).filter(Boolean);
    if (pts.length) {
      nextPositions[g.id] = {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      };
    }
    return {
      id: g.id,
      type: "group",
      status: "active",
      confidence: 1,
      origin: "user",
      label: g.label,
      memberIds: g.members,
      members: g.members.map((id) => byId.get(id)).filter(Boolean),
      text: g.members.join(", "),
    };
  });

  const outRelations = [];
  const relSource = new Map();
  for (const r of relations) {
    const from = memberToGroup.get(r.from) ?? r.from;
    const to = memberToGroup.get(r.to) ?? r.to;
    if (from === to) continue; // internal to one collapsed group
    if (from === r.from && to === r.to) {
      outRelations.push(r);
      continue;
    }
    // `sourceFrom`/`sourceTo` keep the edge's React key unique: two members of
    // one group holding the same relation type against the same outside
    // element would otherwise collapse to the same key.
    const copy = { ...r, from, to, sourceFrom: r.from, sourceTo: r.to };
    relSource.set(copy, r);
    outRelations.push(copy);
  }

  const hulls = present
    .filter((g) => !g.collapsed && g.members.length > 1)
    .map((g) => ({
      group: g,
      box: groupHull(g.members, positions, (id) => radiusOf(byId.get(id))),
    }))
    .filter((h) => h.box);

  return {
    elements: [
      ...elements.filter((e) => !memberToGroup.has(e.id)),
      ...groupNodes,
    ],
    groupNodes,
    relations: outRelations,
    relSource,
    positions: nextPositions,
    hulls,
    memberToGroup,
  };
}
