/**
 * @fileoverview Tab identifiers, icons, and labels shared across header and panels.
 * @module constants/tabConstants
 */

import { LLM_ENABLED, VITE_USE_DUMMY } from "../config.js";
import {
  NetworkIcon,
  HistoryIcon,
  MatrixIcon,
  ClusterIcon,
  SuggestIcon,
  PrincipleIcon,
  JudgmentIcon,
} from "../components/Icons.jsx";

export const ASSIST_TABS =
  LLM_ENABLED | VITE_USE_DUMMY
    ? ["elicitJudgments", "suggestPrinciples", "suggestRelations"]
    : [];

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
