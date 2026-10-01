/**
 * @fileoverview The sample process's log, written out step by step as the app
 * would have written it.
 *
 * The app logs every change — every step — with the entry its handler writes
 * (`useElementActions`, `useRelationActions`). The sample used to keep one
 * entry per round, a narrative of the round at its last step, so History's
 * log box on the demo showed a summary at step 24 and nothing at the seven
 * steps before it, and read as broken beside a process of one's own.
 *
 * Built from the sample's own elements and relations — each one's step and
 * history — rather than written by hand, so the log cannot drift from the
 * process it records. The wording is the handlers', and has to follow them if
 * they change.
 *
 * @module sample-data/sampleLog
 */

import {
  ARGUMENT_RELATION_TYPES,
  editChanges,
  historyOf,
  makeLogEntry,
} from "../utils/stateUtils.js";

/** What happened to an item at one of its history events, as the handlers log it. */
function eventEntry(what, item, event) {
  switch (event.type) {
    case "withdrawn":
      return makeLogEntry(
        event.round,
        `${what} was withdrawn by the user.`,
        "Withdrawn",
        `${what}: status → withdrawn`,
      );
    case "reinstated":
      return makeLogEntry(
        event.round,
        `${what} was withdrawn earlier and has been reinstated by the user.`,
        "Reinstated",
        `${what}: status → active`,
      );
    case "revised": {
      // An element is revised in its wording, a relation in its explanation.
      const field = "text" in item ? "text" : "explanation";
      const now = item[field];
      const before = event.previousText ?? item.previousText;
      return makeLogEntry(
        event.round,
        `${what} was edited by the user.`,
        "Changes applied",
        editChanges(what, [`${field}: ${before} → ${now}`]),
      );
    }
    default:
      return null;
  }
}

/**
 * @param {{ elements: Object[], relations: Object[] }} process
 * @returns {Array<{ round: number, findings: string, options: string, decision: string, changes: string }>}
 */
export function sampleLog({ elements, relations }) {
  const entries = [];

  for (const e of elements) {
    entries.push(
      makeLogEntry(e.addedRound, `${e.id} was added by the user.`, "Added", `${e.id} added`),
    );
    for (const event of historyOf(e)) entries.push(eventEntry(e.id, e, event));
  }

  // An argument's premises were added together, as one step and one entry.
  const argumentsById = new Map();
  for (const r of relations) {
    if (ARGUMENT_RELATION_TYPES.has(r.type) && r.argumentId) {
      (argumentsById.get(r.argumentId) ??
        argumentsById.set(r.argumentId, []).get(r.argumentId)
      ).push(r);
      continue;
    }
    entries.push(
      makeLogEntry(
        r.addedRound,
        `Relation ${r.from} → ${r.to} was added by the user.`,
        "Added",
        `${r.from} → ${r.to} (${r.type}) added`,
      ),
    );
    for (const event of historyOf(r))
      entries.push(eventEntry(`Relation ${r.from} → ${r.to}`, r, event));
  }
  for (const rels of argumentsById.values()) {
    const arrow = `${rels.map((r) => r.from).join(", ")} → ${rels[0].to}`;
    entries.push(
      makeLogEntry(
        rels[0].addedRound,
        `Argument ${arrow} was added by the user.`,
        "Added",
        `${arrow} (${rels[0].type}) added`,
      ),
    );
  }

  return entries.filter(Boolean).sort((a, b) => a.round - b.round);
}
