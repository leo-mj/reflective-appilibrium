/**
 * @fileoverview Backend client for the relatedness matrix endpoint.
 * @module utils/matrixClient
 */

import sampleMatrix from "../sample-data/sample-matrix.json";
import { makeLLMClient } from "./llmClientFactory.js";

export const fetchRelatednessMatrix = makeLLMClient({
  endpoint: "/api/matrix/analyze",
  dummyData: () => ({ ...sampleMatrix, _model: "claude-fable-5" }),
  buildBody: (state) => ({ topic: state.topic, elements: state.elements }),
  transformResponse: (data) => ({
    overview: data.overview,
    matrix: data.matrix,
    pairDescriptions: data.pairDescriptions,
    _model: data.model,
  }),
});
