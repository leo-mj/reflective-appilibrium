/**
 * @fileoverview Merging two elements of a merged process into one.
 *
 * A process merge fuses only elements worded identically. Two processes will
 * often hold the same claim in different words, and deciding that they are the
 * same claim is the reader's call — the Merge assist tab has a model propose
 * pairs, one from each process, and the reader accepts or dismisses each.
 *
 * Accepting removes one element outright, as the reader chose: its relations
 * are re-pointed at the one kept, and it leaves the groups and the process
 * record. The kept element is then a member of both processes, exactly as a
 * fused one is. A consequence worth knowing: history playback shows the
 * re-pointed relations on the kept element in rounds before the merge too, and
 * earlier log entries still name the removed id.
 *
 * @module utils/elementMerge
 */

import { removeFromGroups } from "./groupUtils.js";
import { argumentSignature, byArgument, processesOf } from "./mergeStates.js";
import {
  ARGUMENT_RELATION_TYPES,
  argumentRelationType,
  historyOf,
  isWithdrawnNow,
  makeLogEntry,
  withUserEdit,
} from "./stateUtils.js";

/** @import { REState, REElement } from '../types.js' */

/**
 * Element id → the ids of the processes it belongs to.
 *
 * @param {{ id: string, members: string[] }[]} processes
 * @returns {Map<string, Set<string>>}
 */
function processIndex(processes) {
  const index = new Map();
  for (const p of processes)
    for (const m of p.members) index.set(m, (index.get(m) ?? new Set()).add(p.id));
  return index;
}

/**
 * The elements a pair may be drawn from: those that came from some process and
 * are not `possible`. An element added since the merge came from none, and so
 * cannot be half of a pair that spans two.
 *
 * @param {REState} state
 * @param {{ id: string, members: string[] }[]} processes
 * @returns {{ element: REElement, processes: string[] }[]}
 */
export function mergePool(state, processes) {
  const index = processIndex(processes);
  return state.elements
    .filter((e) => e.status !== "possible" && index.has(e.id))
    .map((e) => ({ element: e, processes: [...index.get(e.id)] }));
}

/**
 * Whether `a` and `b` may be merged: both present, of one type, and from
 * different processes — no process in common, so an element already fused from
 * two is not paired with either of its own sides again.
 *
 * The same rule as `valid_pairs` in `backend/routers/merge.py`, which applies it
 * to what the model returns. It is applied again here because the state moves
 * on while the pairs are on screen: a merge can remove an element another pair
 * names, or leave two of them sharing a process.
 *
 * @param {REState} state
 * @param {{ id: string, members: string[] }[]} processes
 * @param {string} a
 * @param {string} b
 */
export function isMergeablePair(state, processes, a, b) {
  if (a === b) return false;
  const ea = state.elements.find((e) => e.id === a);
  const eb = state.elements.find((e) => e.id === b);
  if (!ea || !eb || ea.type !== eb.type) return false;
  if (ea.status === "possible" || eb.status === "possible") return false;
  const index = processIndex(processes);
  const pa = index.get(a);
  const pb = index.get(b);
  if (!pa || !pb) return false;
  return ![...pa].some((p) => pb.has(p));
}

/** Lower-cased words of three letters or more. */
const words = (text) =>
  new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

/**
 * Pairs whose wording largely overlaps — the sample answer, for the demo build
 * and the "use sample data" mode, where no model is asked. Word overlap is a
 * crude stand-in for sameness of claim, which is why it is only ever labelled
 * as sample output.
 *
 * @param {REState} state
 * @param {{ id: string, members: string[] }[]} processes
 * @returns {{ a: string, b: string, reason: string }[]}
 */
export function samplePairs(state, processes) {
  const pool = mergePool(state, processes);
  const scored = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i].element;
      const b = pool[j].element;
      if (!isMergeablePair(state, processes, a.id, b.id)) continue;
      const wa = words(a.text);
      const wb = words(b.text);
      const shared = [...wa].filter((w) => wb.has(w)).length;
      const score = shared / (new Set([...wa, ...wb]).size || 1);
      if (score >= 0.35) scored.push({ a: a.id, b: b.id, score });
    }
  return scored
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)
    .map(({ a, b }) => ({
      a,
      b,
      reason: "Sample suggestion: the two share most of their wording.",
    }));
}

/**
 * Merges `removeId` into `keepId` as one round.
 *
 * The kept element keeps its id, status and history; its wording and confidence
 * become what the reader settled on, and a change of wording is recorded as a
 * revision, exactly as an edit would be. Every relation of the removed element
 * is re-pointed at the kept one. What that turns into a loop is dropped, and so
 * is whatever it turns into a duplicate of a relation or argument already held;
 * an argument that loses a premise to the merge is retyped for the premises it
 * has left.
 *
 * Pure, so it is safe as a reducer's updater.
 *
 * @param {REState} state
 * @param {{ keepId: string, removeId: string, text: string, confidence: number, reason?: string }} choice
 * @returns {REState}
 */
export function mergeElementPair(state, { keepId, removeId, text, confidence, reason }) {
  const round = state.round + 1;
  const kept = state.elements.find((e) => e.id === keepId);
  const removed = state.elements.find((e) => e.id === removeId);
  if (!kept || !removed || keepId === removeId) return state;

  // ── The kept element ───────────────────────────────────────────────────────
  const wording = text.trim() || kept.text;
  const reworded = wording !== kept.text;
  const keptNext = { ...kept, confidence };
  if (reworded) {
    Object.assign(keptNext, {
      text: wording,
      origin: withUserEdit(kept.origin),
      status: "revised",
      previousText: kept.text,
      revisedRound: round,
      history: [
        ...historyOf(kept),
        ...(isWithdrawnNow(kept) ? [{ round, type: "reinstated" }] : []),
        { round, type: "revised", previousText: kept.text },
      ],
    });
  }

  // ── Relations ──────────────────────────────────────────────────────────────
  // Untouched arguments go through as the very objects they were — selection
  // compares relations by identity — and are never dropped as duplicates of one
  // the merge produced: only what the merge changed is at risk.
  const swap = (id) => (id === removeId ? keepId : id);
  const touched = (rels) => rels.some((r) => r.from === removeId || r.to === removeId);
  const args = byArgument(state.relations);
  const seen = new Set(
    [...args.values()].filter((rels) => !touched(rels)).map(argumentSignature),
  );
  // The first relation of each touched argument → what replaces the argument.
  const replacement = new Map();
  let repointed = 0;
  let dropped = 0;
  for (const [key, rels] of args) {
    if (!touched(rels)) continue;
    replacement.set(rels[0], []);
    const mapped = rels.map((r) => ({ ...r, from: swap(r.from), to: swap(r.to) }));
    if (mapped.some((r) => r.from === r.to)) {
      dropped += rels.length;
      continue;
    }
    // Two premises that are now one element are one premise.
    const premises = mapped.filter(
      (r, i) => mapped.findIndex((s) => s.from === r.from) === i,
    );
    const isArgument =
      !key.startsWith("solo-") && ARGUMENT_RELATION_TYPES.has(premises[0].type);
    const retyped = isArgument
      ? premises.map((r) => ({
          ...r,
          type: argumentRelationType(premises.length, r.type.includes("precludes")),
        }))
      : premises;
    const sig = argumentSignature(retyped);
    if (seen.has(sig)) {
      dropped += rels.length;
      continue;
    }
    seen.add(sig);
    dropped += rels.length - retyped.length;
    repointed += retyped.length;
    replacement.set(rels[0], retyped);
  }
  // In their original order, a touched argument standing where it stood.
  const touchedRels = new Set(
    [...args.values()].filter(touched).flat(),
  );
  const relations = state.relations.flatMap((r) =>
    replacement.has(r) ? replacement.get(r) : touchedRels.has(r) ? [] : [r],
  );

  // ── Groups and processes ───────────────────────────────────────────────────
  const next = {
    ...state,
    round,
    elements: state.elements
      .filter((e) => e.id !== removeId)
      .map((e) => (e.id === keepId ? keptNext : e)),
    relations,
  };
  if (state.groups !== undefined) next.groups = removeFromGroups(state.groups, removeId);
  if (state.processes !== undefined)
    next.processes = state.processes.map((p) =>
      p.members.includes(removeId)
        ? { ...p, members: [...new Set(p.members.map(swap))] }
        : p,
    );

  // ── Log ────────────────────────────────────────────────────────────────────
  const letters = (id) =>
    processesOf(state, Infinity)
      .filter((p) => p.members.includes(id))
      .map((p) => p.id)
      .join("+");
  const changes = [
    `${removeId} removed`,
    repointed ? `${repointed} relation${repointed === 1 ? "" : "s"} re-pointed to ${keepId}` : "",
    dropped ? `${dropped} dropped as duplicates` : "",
    reworded ? `${keepId} reworded` : "",
    confidence !== kept.confidence
      ? `${keepId} confidence: ${kept.confidence} → ${confidence}`
      : "",
  ]
    .filter(Boolean)
    .join("; ");
  next.log = [
    ...state.log,
    makeLogEntry(
      round,
      `${removeId} (process ${letters(removeId)}) merged into ${keepId} (process ${letters(keepId)}) as the same ${kept.type}.` +
        (reason ? ` Suggested because: ${reason}` : ""),
      "Merged elements",
      changes,
    ),
  ];
  return next;
}
