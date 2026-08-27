/**
 * @fileoverview Tab identifiers, icons, and labels shared across header and panels.
 * @module constants/tabConstants
 */

import {
  NetworkIcon,
  HistoryIcon,
  ClusterIcon,
  SuggestIcon,
  PrincipleIcon,
  JudgmentIcon,
  ReviewIcon,
  SimulateIcon,
  TheoryIcon,
} from "../components/Icons.jsx";

// The guided workflow's five phases come first, in the order it runs them; the
// one after them is an Assist tab that is deliberately *not* a phase — see
// WORKFLOW_NEXT_PHASE in utils/workflowUtils.js, which it stays out of.
export const ASSIST_TABS = [
  "questionnaire",
  "elicitJudgments",
  "suggestPrinciples",
  "suggestTheories",
  "detectArguments",
  "suggestRelations",
  "processReview",
];

export const SIMULATE_TABS = ["simulateRethon"];

/**
 * What the add bar opens on, for the tabs that have an answer.
 *
 * The bar is one control shown under every tab rather than a strip in analyze
 * mode and a panel per assist tab — the assist tabs used to carry three cut-down
 * panels of their own, which is what these presets replace. A tab that is about
 * principles is a tab whose add bar should be ready to add a principle; the
 * picker is still there, so this is where it starts rather than what it may be.
 *
 * Frozen module constants, and looked up by tab rather than built at the call
 * site, because the bar applies a preset when the *identity* of the one it is
 * handed changes — see {@link module:components/TextTabAddPanel.AddBar}. An
 * object built inline would be a new one every render, and the bar would reset
 * under the reader's hands each time.
 *
 * The tabs missing from this map — the analyze ones, Review, Questions, and
 * Simulate — hand it nothing, and the bar keeps whatever it was left on. That is
 * the analyze behaviour, and there is nothing about reading a review or running
 * a simulation that says what the reader is about to add.
 */
export const ADD_BAR_PRESETS = {
  elicitJudgments: Object.freeze({ tab: "element", elementType: "judgment" }),
  suggestPrinciples: Object.freeze({
    tab: "element",
    elementType: "principle",
  }),
  suggestTheories: Object.freeze({ tab: "element", elementType: "theory" }),
  detectArguments: Object.freeze({ tab: "argument" }),
  suggestRelations: Object.freeze({ tab: "relation" }),
};

/**
 * Whether a sub-tab is on offer, given the current model and relation filter.
 *
 * Both header layouts must agree on this. The wide bar and the narrow menu are
 * two views of one set, so a tab offered by only one of them drops the user on
 * a panel that renders nothing — the panels are gated on the same flags.
 *
 * @param {Object} opts
 * @param {string} [opts.model] — `"questionnaire"` in questionnaire mode.
 * @param {boolean} [opts.hideNonEntailsRels]
 * @returns {(tab: string) => boolean}
 */
export function tabVisibility({ model, hideNonEntailsRels } = {}) {
  return (t) =>
    (!hideNonEntailsRels || t !== "suggestRelations") &&
    (model === "questionnaire" || t !== "questionnaire");
}

export const TAB_ICONS = {
  questionnaire: <JudgmentIcon />,
  graph: <NetworkIcon />,
  history: <HistoryIcon />,
  clusters: <ClusterIcon />,
  suggestRelations: <SuggestIcon />,
  suggestPrinciples: <PrincipleIcon />,
  elicitJudgments: <JudgmentIcon />,
  detectArguments: <SimulateIcon />,
  suggestTheories: <TheoryIcon />,
  processReview: <ReviewIcon />,
  simulateRethon: <SimulateIcon />,
};

export const TAB_LABELS = {
  questionnaire: "Questions",
  graph: "Graph",
  history: "History",
  clusters: "Clusters",
  elicitJudgments: "Judgments",
  suggestPrinciples: "Principles",
  detectArguments: "Arguments",
  suggestRelations: "Relations",
  suggestTheories: "Theories",
  processReview: "Review",
  simulateRethon: "Simulate",
};

export const TAB_TOOLTIPS = {
  questionnaire:
    "Answer a questionnaire based on pre-set questions to conduct a guided RE process.",
  graph:
    "Force-directed graph. Click a node to select; Ctrl+click to start a relation.",
  history: "Replay your RE process round by round using the history slider.",
  clusters:
    "Coherence clusters — the largest possible groups of connected elements with no conflicts.",
  elicitJudgments: "AI helps you surface and refine your moral judgments.",
  suggestPrinciples:
    "AI proposes general principles that systematize your judgments.",
  suggestRelations: "AI suggests missing relations between existing elements.",
  simulateRethon:
    "Run the formal rethon RE simulation on your active elements.",
  detectArguments:
    "AI detects logically valid arguments formed of existing elements and additional premises.",
  suggestTheories:
    "AI proposes well-supported background theories that bear on your topic and your current position — those that ground it, and those it is in tension with.",
  processReview:
    "AI reads your process so far and reports the major shifts across rounds.",
};
