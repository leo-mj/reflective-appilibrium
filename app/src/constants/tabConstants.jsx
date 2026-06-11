/**
 * @fileoverview Tab identifiers, icons, and labels shared across header and panels.
 * @module constants/tabConstants
 */

import {
  NetworkIcon,
  HistoryIcon,
  MatrixIcon,
  ClusterIcon,
  SuggestIcon,
  PrincipleIcon,
  JudgmentIcon,
  SimulateIcon,
} from "../components/Icons.jsx";

export const ASSIST_TABS = [
  "questionnaire",
  "elicitJudgments",
  "suggestPrinciples",
  "detectArguments",
  "suggestRelations",
];

export const SIMULATE_TABS = ["simulateRethon"];

export const TAB_ICONS = {
  questionnaire: <JudgmentIcon />,
  graph: <NetworkIcon />,
  history: <HistoryIcon />,
  matrix: <MatrixIcon />,
  clusters: <ClusterIcon />,
  suggestRelations: <SuggestIcon />,
  suggestPrinciples: <PrincipleIcon />,
  elicitJudgments: <JudgmentIcon />,
  detectArguments: <SimulateIcon />,
  simulateRethon: <SimulateIcon />,
};

export const TAB_LABELS = {
  questionnaire: "Questions",
  graph: "Graph",
  history: "History",
  matrix: "Matrix",
  clusters: "Clusters",
  elicitJudgments: "Judgments",
  suggestPrinciples: "Principles",
  detectArguments: "Arguments",
  suggestRelations: "Relations",
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
  matrix: "LLM-based relation matrix between every pair of elements.",
  elicitJudgments: "AI helps you surface and refine your moral judgments.",
  suggestPrinciples:
    "AI proposes general principles that systematize your judgments.",
  suggestRelations: "AI suggests missing relations between existing elements.",
  simulateRethon:
    "Run the formal rethon RE simulation on your active elements.",
  detectArguments:
    "AI detects logically valid arguments formed of existing elements and additional premises.",
};
