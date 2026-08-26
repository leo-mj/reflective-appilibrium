/**
 * @fileoverview Backend client for the background theory suggestion endpoint.
 * @module utils/theoriesClient
 */

import sampleTheories from "../sample-data/sample-theories.js";
import { makeLLMClient } from "./llmClientFactory.js";

export const fetchTheorySuggestions = makeLLMClient({
  endpoint: "/api/theories/suggest",
  dummyData: sampleTheories,
  buildBody: (state) => ({ topic: state.topic, elements: state.elements }),
});
