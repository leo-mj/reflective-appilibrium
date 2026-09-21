/**
 * @fileoverview Backend client for the merge-pairs endpoint: which elements of a
 * merged process make the same claim in different words.
 *
 * The prompt, and the check that every returned pair spans two processes, live
 * in `backend/routers/merge.py`. Which process an element came from is not part
 * of the backend's state model, so the caller passes the state with its
 * `processes` on it — the real record, not the view with tags hidden.
 *
 * @module utils/elementMergeClient
 */

import { makeLLMClient } from "./llmClientFactory.js";
import sampleMergePairs from "../sample-data/sample-merge-pairs.js";

export const fetchMergePairs = makeLLMClient({
  endpoint: "/api/merge/pairs",
  // No model to ask: the fixture's own pairs for the sample processes, and word
  // overlap for anything else.
  dummyData: (state) => ({
    suggestions: sampleMergePairs(state, state.processes ?? []),
    model: "sample",
  }),
  buildBody: (state) => ({
    topic: state.topic,
    elements: state.elements,
    processes: state.processes ?? [],
  }),
});
