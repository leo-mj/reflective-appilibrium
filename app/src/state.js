/**
 * @fileoverview RE state data source for the visualisation component.
 *
 * Exports {@link SAMPLE_STATE}, the single {@link REState} object consumed by
 * the entire component tree.  There are two sources:
 *
 * 1. **Inline state** (`_inlineState`) — an empty skeleton committed to the repo.
 *    Replace the `elements`, `relations`, `coherence`, and `log` arrays with real
 *    data produced by the Claude RE Skill when generating a visualisation artifact.
 *
 * 2. **Sample state** (`sample-state.js`) — a rich fixture used in both dev and
 *    prod.  Always loaded as the initial state so visitors (and developers)
 *    see a populated example on first load.
 *
 * @module state
 */

/** @import { REState } from './types.js' */

import _sampleState from "./sample-data/sample-state.js"; // dev fixture — not used in production builds
import { argumentRelationType } from "./utils/stateUtils.js";

// ============================================================
// REPLACE THIS OBJECT WITH CURRENT STATE DATA WHEN GENERATING
// ============================================================
/**
 * Inline skeleton — swap the arrays below for real Claude output.
 * Every element must include `addedRound`. Anything that has been revised,
 * withdrawn, reinstated, or rejected carries a `history` list of round-stamped
 * events; see {@link module:utils/stateUtils.historyOf}, which also still reads
 * the older single-round fields.
 *
 * @type {REState}
 */
const _inlineState = {
  topic: "",
  phase: 0,
  round: 0,
  elements: [
    // { id: "J1", type: "judgment", status: "active", confidence: 1.0, origin: "user", text: "...", addedRound: 1 },
    // { id: "P1", type: "principle", status: "active", confidence: 0.67, origin: "user", text: "...", addedRound: 1 },
    // { id: "T1", type: "theory", status: "active", confidence: 1.0, origin: "llm", text: "...", addedRound: 5 },
    // Revised elements also carry: previousText: "...", revisedRound: N
    // Withdrawn elements also carry: reason: "..."
    // History, on anything that has changed hands:
    //   history: [{ round: 3, type: "revised", previousText: "..." },
    //             { round: 5, type: "withdrawn", reason: "..." },
    //             { round: 8, type: "reinstated" }]
  ],
  relations: [
    // { from: "J1", to: "P1", type: "supports", explanation: "...", addedRound: 1 },
    // types: "supports", "conflicts", "undermines", "depends",
    //        "entails", "precludes", "jointly_entails", "jointly_precludes"
    // Argument relations share an argumentId; relations take `history` too.
  ],
  coherence: {
    tensions: [],
    orphans: [],
    clusters: [],
  },
  groups: [
    // { id: "G1", label: "Group 1", members: ["J1", "J2"], collapsed: false }
  ],
  log: [
    // { round: 1, findings: "...", options: "...", decision: "...", changes: "..." }
  ],
};
// ============================================================

/**
 * The active RE state used by all components.
 *
 * Always the sample data fixture so both dev and prod start with a populated
 * example.  The inline skeleton above is kept as a copy-paste template for
 * generating visualisation artifacts from Claude RE Skill output.
 *
 * @type {REState}
 */
export const SAMPLE_STATE = _sampleState;

/**
 * Factory that returns a blank RE state for a given topic.
 *
 * @param {string} topic
 * @returns {REState}
 */
export function makeEmptyState(topic) {
  return { ..._inlineState, topic, phase: 1, round: 1 };
}

/**
 * Factory that returns a pre-populated questionnaire RE state from a spec.
 *
 * All judgment elements are created with `status: "possible"` so they are
 * invisible until the user selects them via the Questionnaire tab.  All
 * argument relations are pre-computed from the spec and stored in `relations`,
 * so the full argument graph is present without a separate detect-arguments step.
 *
 * When the user answers a question, `handleQuestionnaireSelectAnswer` activates
 * the chosen element and keeps unchosen siblings as `"possible"`. Pure-conclusion
 * elements are automatically activated whenever every premise of at least one
 * argument leading to them is active.
 *
 * @returns {REState}
 */
export function makeQuestionnaireState(spec) {
  const elements = spec.suggestions.flatMap(({ judgments }) =>
    judgments.map(({ id, index, confidence, text }) => ({
      id,
      type: "judgment",
      status: "possible",
      confidence,
      origin: spec.id,
      text,
      addedRound: 1,
      questionnaireIndex: index,
    }))
  );

  const lookup = {};
  for (const el of elements) lookup[el.questionnaireIndex] = el;

  const relations = [];
  const allArgs = [...spec.participantArguments, ...spec.furtherArguments];
  for (let i = 0; i < allArgs.length; i++) {
    const arg = allArgs[i];
    if (!arg.every((n) => lookup[Math.abs(n)] != null)) continue;
    const conclusionIdx = arg.at(-1);
    const conclusion = lookup[Math.abs(conclusionIdx)];
    const premiseCount = arg.length - 1;
    const relationType = argumentRelationType(premiseCount, conclusionIdx < 0);
    const argumentId = `questionnaire-arg-${i}`;
    for (const n of arg.slice(0, -1)) {
      relations.push({
        from: lookup[Math.abs(n)].id,
        to: conclusion.id,
        type: relationType,
        argumentId,
        explanation: "",
        addedRound: 1,
      });
    }
  }

  return { ..._inlineState, topic: spec.name, phase: 1, round: 1, model: "questionnaire", questionnaireSpec: spec, elements, relations };
}
