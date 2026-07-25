/**
 * @fileoverview Backend client for the arguments/detect endpoint.
 * @module utils/argumentsClient
 */

import { getSampleArguments } from "../sample-data/sample-arguments.js";
import { makeLLMClient } from "./llmClientFactory.js";

export const detectArguments = makeLLMClient({
  endpoint: "/api/arguments/detect",
  dummyData: (state) => getSampleArguments(state.elements, `${state.round}`, state.relations),
  buildBody: (state) => ({ elements: state.elements, relations: state.relations, round: `${state.round}` }),
});
