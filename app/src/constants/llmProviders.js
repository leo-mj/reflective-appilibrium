/**
 * @fileoverview Closed list of supported LLM providers for BYOK.
 *
 * The base URLs here must be kept in sync with ALLOWED_BASE_URLS in
 * backend/dependencies.py — the backend whitelist is the security boundary.
 *
 * **No models.** There used to be a short list per provider, whose first entry
 * became the default. It went out of date without anything noticing, and it
 * chose for the user: the cheapest model happened to be listed first, and a
 * reader paying with their own key had it picked for them. The settings modal
 * now asks the provider which models the key can use (`GET /api/llm/models`)
 * and otherwise takes the model id as typed.
 * @module constants/llmProviders
 */

export class LLMProvider {
  /**
   * @param {string}      id            - Unique identifier, matched against VITE_DEFAULT_PROVIDER
   * @param {string}      label         - Display name shown in the dropdown
   * @param {string}      baseUrl       - OpenAI-compatible API base URL (never shown to user)
   * @param {string|null} defaultApiKey - Pre-filled key sent automatically (null = user must supply)
   */
  constructor(id, label, baseUrl, defaultApiKey = null) {
    if (!id || !label || !baseUrl) throw new Error(`Invalid LLMProvider: ${id}`);
    this.id = id;
    this.label = label;
    this.baseUrl = baseUrl;
    this.defaultApiKey = defaultApiKey;
  }

  /**
   * Whether the URL names the machine the backend runs on. The backend makes
   * the call, so this reaches the reader's own machine only when that is where
   * the backend runs.
   */
  get loopback() {
    return LOOPBACK.has(new URL(this.baseUrl).hostname);
  }
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const LLM_PROVIDERS = [
  new LLMProvider("openai", "OpenAI", "https://api.openai.com/v1"),
  new LLMProvider("mistral", "Mistral", "https://api.mistral.ai/v1"),
  new LLMProvider("anthropic", "Anthropic", "https://api.anthropic.com/v1"),
  new LLMProvider("local", "Local (Ollama)", "http://localhost:11434/v1", "ollama"),
];

/**
 * The providers worth offering against a backend in `deployment` mode, as
 * `/api/health` reports it. A hosted backend refuses every loopback URL
 * (`allowed_base_urls` in backend/dependencies.py, by the same test): there
 * "localhost" is the server, never the visitor. Anything else, including a
 * mode not yet known, offers the whole list — the backend still decides.
 *
 * @param {string|null|undefined} deployment
 * @returns {LLMProvider[]}
 */
export function offeredProviders(deployment) {
  if (deployment !== "hosted") return LLM_PROVIDERS;
  return LLM_PROVIDERS.filter((p) => !p.loopback);
}
