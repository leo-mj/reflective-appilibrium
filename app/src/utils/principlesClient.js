/**
 * @fileoverview Backend client for the principle suggestion endpoint.
 * @module utils/principlesClient
 */

import dummyPrinciples from "../dummy-data/dummy-principles.js";
import { makeLLMClient } from "./llmClientFactory.js";

export const fetchPrincipleSuggestions = makeLLMClient({
  endpoint: "/api/principles/suggest",
  dummyData: dummyPrinciples,
  buildBody: (state) => ({ topic: state.topic, elements: state.elements }),
});
