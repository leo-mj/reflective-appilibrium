/**
 * @fileoverview Backend client for the relation suggestion endpoint.
 * @module utils/relationsClient
 */

import sampleRelations from "../sample-data/sample-relations.js";
import { makeLLMClient } from "./llmClientFactory.js";

export const fetchRelationSuggestions = makeLLMClient({
  endpoint: "/api/relations/suggest",
  dummyData: sampleRelations,
  buildBody: (state) => ({ topic: state.topic, elements: state.elements, existing_relations: state.relations }),
});
