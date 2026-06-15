/**
 * @fileoverview Backend client for the relation suggestion endpoint.
 * @module utils/relationsClient
 */

import dummyRelations from "../dummy-data/dummy-relations.js";
import { makeLLMClient } from "./llmClientFactory.js";

export const fetchRelationSuggestions = makeLLMClient({
  endpoint: "/api/relations/suggest",
  dummyData: dummyRelations,
  buildBody: (state) => ({ topic: state.topic, elements: state.elements, existing_relations: state.relations }),
});
