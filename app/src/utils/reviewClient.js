/**
 * @fileoverview Backend client for the process-review endpoint.
 * @module utils/reviewClient
 */

import sampleReview from "../sample-data/sample-review.js";
import { makeLLMClient } from "./llmClientFactory.js";

export const fetchProcessReview = makeLLMClient({
  endpoint: "/api/review/analyze",
  dummyData: sampleReview,
  // The whole state: a review reads the *shape* of the process, so it needs the
  // history trails and the round each thing arrived in, not just what is active.
  // Previously accepted reviews ride along in `state.reviews`, which is what lets
  // this one carry their thread forward — hence no field of their own.
  buildBody: (state) => ({ state }),
  // One review, carried as a one-element list because that is the shape
  // `useSuggestionWorkflow` consumes. The stretch of the plural is worth it: a
  // review *is* a suggestion the user accepts, rejects, or modifies, so the
  // hook's loading, error, and draft handling all fit as they are.
  transformResponse: (d) => ({
    suggestions: [
      {
        headline: d.headline,
        arc: d.arc,
        surprises: d.surprises,
        missed: d.missed,
        method: d.method,
      },
    ],
    model: d.model,
  }),
});
