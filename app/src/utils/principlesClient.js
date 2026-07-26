/**
 * @fileoverview Backend client for the principle suggestion endpoint.
 * @module utils/principlesClient
 */

import samplePrinciples from "../sample-data/sample-principles.js";
import { makeLLMClient } from "./llmClientFactory.js";

export const fetchPrincipleSuggestions = makeLLMClient({
  endpoint: "/api/principles/suggest",
  dummyData: samplePrinciples,
  buildBody: (state) => ({ topic: state.topic, elements: state.elements }),
});
