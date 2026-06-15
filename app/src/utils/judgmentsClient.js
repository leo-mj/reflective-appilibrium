/**
 * @fileoverview Backend client for the judgment elicitation endpoint.
 * @module utils/judgmentsClient
 */

import dummyJudgments from "../dummy-data/dummy-judgments.js";
import { makeLLMClient } from "./llmClientFactory.js";

export const fetchJudgmentElicitations = makeLLMClient({
  endpoint: "/api/judgments/elicit",
  dummyData: dummyJudgments,
  buildBody: (state) => ({ topic: state.topic, elements: state.elements, log: state.log }),
});
