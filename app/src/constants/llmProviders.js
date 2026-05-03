/**
 * @fileoverview Closed list of supported LLM providers and models for BYOK.
 *
 * The base URLs here must be kept in sync with ALLOWED_BASE_URLS in
 * backend/dependencies.py — the backend whitelist is the security boundary.
 * @module constants/llmProviders
 */

export class LLMProvider {
  /**
   * @param {string}      id            - Unique identifier, matched against VITE_DEFAULT_PROVIDER
   * @param {string}      label         - Display name shown in the dropdown
   * @param {string}      baseUrl       - OpenAI-compatible API base URL (never shown to user)
   * @param {string[]}    models        - Ordered list of model ids for this provider
   * @param {string|null} defaultApiKey - Pre-filled key sent automatically (null = user must supply)
   */
  constructor(id, label, baseUrl, models, defaultApiKey = null) {
    if (!id || !label || !baseUrl || !models.length)
      throw new Error(`Invalid LLMProvider: ${id}`);
    this.id = id;
    this.label = label;
    this.baseUrl = baseUrl;
    this.models = models;
    this.defaultApiKey = defaultApiKey;
  }
}

export const LLM_PROVIDERS = [
  new LLMProvider("openai", "OpenAI", "https://api.openai.com/v1", [
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
  ]),
  new LLMProvider("mistral", "Mistral", "https://api.mistral.ai/v1", [
    "mistral-small-latest",
    "mistral-medium-latest",
    "mistral-large-latest",
  ]),
  new LLMProvider("anthropic", "Anthropic", "https://api.anthropic.com/v1", [
    "claude-haiku-4-5",
    "claude-sonnet-4-6",
    "claude-opus-4-7",
  ]),
  new LLMProvider(
    "local",
    "Local (Ollama)",
    "http://localhost:11434/v1",
    ["ministral", "ministral-3:8b", "mistral", "llama3.2", "qwen2.5"],
    "ollama",
  ),
];
