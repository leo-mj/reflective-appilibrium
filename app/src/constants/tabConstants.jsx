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
} from "../components/Icons.jsx";

export const ASSIST_TABS = ["elicitJudgments", "suggestPrinciples", "suggestRelations"];

export const TAB_ICONS = {
  graph: <NetworkIcon />,
  history: <HistoryIcon />,
  matrix: <MatrixIcon />,
  clusters: <ClusterIcon />,
  suggestRelations: <SuggestIcon />,
  suggestPrinciples: <PrincipleIcon />,
  elicitJudgments: <JudgmentIcon />,
};

export const TAB_LABELS = {
  graph: "Graph",
  history: "History",
  matrix: "Matrix",
  clusters: "Clusters",
  elicitJudgments: "Elicit Judgments",
  suggestPrinciples: "Suggest Principles",
  suggestRelations: "Suggest Relations",
};

export const TAB_TOOLTIPS = {
  graph: "Force-directed graph. Click a node to select; Ctrl+click to start a relation.",
  history: "Replay your RE process round by round using the history slider.",
  clusters: "Coherence clusters — the largest possible groups of connected elements with no conflicts.",
  matrix: "LLM-based relation matrix between every pair of elements.",
  elicitJudgments: "AI helps you surface and refine your moral judgments.",
  suggestPrinciples: "AI proposes general principles that systematize your judgments.",
  suggestRelations: "AI suggests missing relations between existing elements.",
};
