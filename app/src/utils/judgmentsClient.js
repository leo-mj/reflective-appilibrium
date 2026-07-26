/**
 * @fileoverview Backend client for the judgment elicitation endpoint.
 * @module utils/judgmentsClient
 */

import sampleJudgments from "../sample-data/sample-judgments.js";
import { makeLLMClient } from "./llmClientFactory.js";

export const fetchJudgmentElicitations = makeLLMClient({
  endpoint: "/api/judgments/elicit",
  dummyData: sampleJudgments,
  buildBody: (state) => ({ topic: state.topic, elements: state.elements, log: state.log }),
});
